import { randomUUID } from 'node:crypto';
import { db, J, P } from '../db.js';
import { bus } from '../bus.js';

export type InboxKind = 'plan' | 'approval' | 'question';
export interface InboxItem {
  id: string; kind: InboxKind; agent: string; runId: string | null; taskId: string | null;
  title: string; body: unknown; status: string; answer: string | null; ts: number;
}
export interface Decision { approved: boolean; answer: string }

/** Hộp thư của người: duyệt kế hoạch, duyệt lệnh nhạy cảm, trả lời câu hỏi của agent. */
class Inbox {
  private waiters = new Map<string, (d: Decision) => void>();

  create(kind: InboxKind, f: { agent: string; runId: string | null; taskId: string | null; title: string; body?: unknown }): Promise<Decision> {
    const item: InboxItem = { id: randomUUID().slice(0, 8), kind, ...f, body: f.body ?? null, status: 'pending', answer: null, ts: Date.now() };
    db.prepare('INSERT INTO inbox(id,kind,agent,run_id,task_id,title,body,status,answer,ts) VALUES (?,?,?,?,?,?,?,?,?,?)')
      .run(item.id, kind, item.agent, item.runId, item.taskId, item.title, J(item.body), 'pending', null, item.ts);
    // Đăng ký chờ TRƯỚC khi phát sự kiện (người duyệt đồng bộ không bị lỡ).
    const p = new Promise<Decision>((res) => this.waiters.set(item.id, res));
    bus.emitEvt({ type: 'inbox', item }, { agent: item.agent, text: `📥 ${kindLabel(kind)}: ${item.title}` });
    return p;
  }

  resolve(id: string, d: Decision): boolean {
    const status = d.approved ? (d.answer ? 'answered' : 'approved') : 'rejected';
    db.prepare('UPDATE inbox SET status=?, answer=? WHERE id=?').run(status, d.answer || null, id);
    const w = this.waiters.get(id);
    this.waiters.delete(id);
    w?.(d);
    const item = this.get(id);
    if (item) bus.emitEvt({ type: 'inbox', item }, { agent: item.agent, text: `✔ ${item.title} → ${status}` });
    return !!w;
  }

  /** Huỷ mọi mục đang chờ của 1 run / task (khi dừng agent hoặc huỷ run). */
  cancelWhere(pred: (i: InboxItem) => boolean): void {
    for (const i of this.pending()) if (pred(i)) this.resolve(i.id, { approved: false, answer: '' });
  }

  get(id: string): InboxItem | null {
    const r = db.prepare('SELECT * FROM inbox WHERE id=?').get(id) as Record<string, unknown> | undefined;
    return r ? row(r) : null;
  }

  pending(): InboxItem[] {
    return (db.prepare("SELECT * FROM inbox WHERE status='pending' ORDER BY ts").all() as Record<string, unknown>[]).map(row);
  }
}

const kindLabel = (k: InboxKind) => ({ plan: 'Duyệt kế hoạch', approval: 'Cần duyệt', question: 'Câu hỏi' })[k];
const row = (r: Record<string, unknown>): InboxItem => ({
  id: String(r.id), kind: r.kind as InboxKind, agent: String(r.agent), runId: (r.run_id as string) ?? null, taskId: (r.task_id as string) ?? null,
  title: String(r.title), body: P(r.body, null), status: String(r.status), answer: (r.answer as string) ?? null, ts: Number(r.ts),
});

export const inbox = new Inbox();
