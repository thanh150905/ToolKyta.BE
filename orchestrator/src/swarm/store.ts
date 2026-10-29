import { db, J, P } from '../db.js';
import { bus } from '../bus.js';
import { sanitize, sanitizeObject } from '../sanitize.js';
import type { Run, Task } from './types.js';

export function saveRun(r: Run): void {
  db.prepare(`INSERT INTO runs(id,prompt,title,intent,status,summary,digest,replans,created_at,finished_at) VALUES (?,?,?,?,?,?,?,?,?,?)
    ON CONFLICT(id) DO UPDATE SET title=excluded.title, intent=excluded.intent, status=excluded.status, summary=excluded.summary,
      digest=excluded.digest, replans=excluded.replans, finished_at=excluded.finished_at`)
    .run(r.id, r.prompt, r.title, r.intent, r.status, r.summary, r.digest, r.replans, r.createdAt, r.finishedAt ?? null);
  bus.emitEvt({ type: 'run', run: r });
}


export function saveTask(t: Task): void {
  db.prepare(`INSERT INTO tasks(id,run_id,agent,title,instructions,deps,status,result,created_at,started_at,finished_at,verification) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)
    ON CONFLICT(id) DO UPDATE SET status=excluded.status, result=excluded.result, started_at=excluded.started_at, finished_at=excluded.finished_at, verification=excluded.verification`)
    .run(t.id, t.runId, t.agent, t.title, t.instructions, J(t.deps), t.status, t.result, t.createdAt, t.startedAt ?? null, t.finishedAt ?? null, J(t.verification ?? null));
  bus.emitEvt({ type: 'task', task: t });
}

export interface MessageRow { id: number; agent: string; runId: string | null; taskId: string | null; role: string; content: string; meta: unknown; ts: number }

/** Tin nhắn của 1 agent (tab History). role: user | task | assistant | tool | digest | system */
export function addMessage(m: Omit<MessageRow, 'id' | 'ts'>): MessageRow {
  const ts = Date.now();
  const safeContent = sanitize(m.content);
  const safeMeta = m.meta ? sanitizeObject(m.meta) : null;
  const r = db.prepare('INSERT INTO messages(agent,run_id,task_id,role,content,meta,ts) VALUES (?,?,?,?,?,?,?)')
    .run(m.agent, m.runId, m.taskId, m.role, safeContent, J(safeMeta), ts);
  const row = { ...m, content: safeContent, meta: safeMeta, id: Number(r.lastInsertRowid), ts };
  bus.emitEvt({ type: 'message', message: row });
  return row;
}

export function listMessages(agent: string, limit = 200): MessageRow[] {
  const rows = db.prepare('SELECT * FROM messages WHERE agent=? ORDER BY id DESC LIMIT ?').all(agent, limit) as Record<string, unknown>[];
  return rows.reverse().map((r) => ({
    id: Number(r.id), agent: String(r.agent), runId: (r.run_id as string) ?? null, taskId: (r.task_id as string) ?? null,
    role: String(r.role), content: String(r.content ?? ''), meta: P(r.meta, null), ts: Number(r.ts),
  }));
}

export function recentEvents(limit = 300) {
  return (db.prepare('SELECT * FROM events ORDER BY id DESC LIMIT ?').all(limit) as Record<string, unknown>[]).reverse();
}

export function usage24h() {
  const since = Date.now() - 86_400_000;
  const r = db.prepare('SELECT COALESCE(SUM(cost),0) cost, COALESCE(SUM(prompt),0) prompt, COALESCE(SUM(completion),0) completion, COUNT(*) calls FROM usage WHERE ts>?').get(since) as Record<string, number>;
  const byAgent = db.prepare('SELECT agent, SUM(prompt) prompt, SUM(completion) completion, SUM(cost) cost, COUNT(*) calls FROM usage WHERE ts>? GROUP BY agent').all(since);
  return { ...r, byAgent };
}

export function eventCount(): number {
  return Number((db.prepare('SELECT COUNT(*) n FROM events').get() as { n: number }).n);
}

export function loadRecentRuns(limit = 15): { runs: Run[]; tasks: Task[] } {
  const runs = (db.prepare('SELECT * FROM runs ORDER BY created_at DESC LIMIT ?').all(limit) as Record<string, unknown>[]).map((r) => ({
    id: String(r.id), prompt: String(r.prompt), title: String(r.title ?? ''), intent: String(r.intent ?? ''), status: r.status as Run['status'],
    summary: String(r.summary ?? ''), digest: String(r.digest ?? ''), replans: Number(r.replans ?? 0), createdAt: Number(r.created_at),
    finishedAt: r.finished_at ? Number(r.finished_at) : undefined,
  }));
  const tasks: Task[] = [];
  for (const run of runs) {
    for (const r of db.prepare('SELECT * FROM tasks WHERE run_id=? ORDER BY created_at').all(run.id) as Record<string, unknown>[]) {
      tasks.push({
        id: String(r.id), localId: String(r.id).split('.').pop() ?? '', runId: run.id, agent: String(r.agent), title: String(r.title),
        instructions: String(r.instructions), deps: P<string[]>(r.deps, []), status: r.status as Task['status'], result: String(r.result ?? ''),
        verification: P<Task['verification']>(r.verification, undefined),
        createdAt: Number(r.created_at), startedAt: r.started_at ? Number(r.started_at) : undefined, finishedAt: r.finished_at ? Number(r.finished_at) : undefined,
      });
    }
  }
  return { runs, tasks };
}

