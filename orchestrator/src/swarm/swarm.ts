import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { config, REPO } from '../config.js';
import { bus } from '../bus.js';
import { browserState } from '../tools/browser.js';
import { quotaState } from '../llm.js';
import { AgentRuntime } from './agent.js';
import { inbox } from './inbox.js';
import { digest, makePlan, overseerModel, replan } from './overseer.js';
import { addMessage, eventCount, loadRecentRuns, saveRun, saveTask, usage24h } from './store.js';
import { releaseLocksForRun } from '../tools/lock.js';
import type { Plan, PlanTask, Run, Task } from './types.js';

interface FileTouch { path: string; op: 'read' | 'write'; agent: string; size: number; ts: number }

const ACTIVE = new Set(['queued', 'working', 'blocked']);

/**
 * Bộ điều phối: prompt → Overseer lập kế hoạch (DAG các bước, mỗi bước giao 1 agent) → người duyệt →
 * phát bước khi đủ phụ thuộc → bước thất bại thì Overseer lập lại kế hoạch (tối đa maxReplans) → tổng kết.
 */
class Swarm {
  readonly agents = new Map<string, AgentRuntime>();
  readonly runs = new Map<string, Run>();
  readonly tasks = new Map<string, Task>();
  readonly files = new Map<string, FileTouch>();
  readonly plans = new Map<string, Plan>();

  constructor() {
    for (const def of config.agents) {
      this.agents.set(def.id, new AgentRuntime(def, {
        onDone: (t) => this.safe(this.advance(this.runs.get(t.runId)), t.runId),
        depContext: (t) => this.depContext(t),
        goal: (t) => this.runs.get(t.runId)?.prompt ?? '',
        touched: (rel, op, agent) => this.touch(rel, op, agent),
      }));
    }
    const { runs, tasks } = loadRecentRuns();
    for (const r of runs) this.runs.set(r.id, r);
    for (const t of tasks) this.tasks.set(t.id, t);
  }

  private overseer() { return this.agents.get('overseer')!; }

  /** Mọi promise chạy nền đi qua đây: lỗi ngoài dự kiến → run FAILED có lý do, KHÔNG làm sập tiến trình. */
  private safe(p: Promise<unknown>, runId: string): void {
    p.catch((e) => {
      const msg = (e as Error)?.stack ?? String(e);
      console.error(`[swarm] lỗi ngoài dự kiến ở run ${runId}:`, msg);
      const run = this.runs.get(runId);
      this.overseer().setStatus('idle', 'Chờ việc');
      if (run && !['done', 'failed', 'cancelled'].includes(run.status)) {
        run.status = 'failed';
        run.summary = `Lỗi hệ thống: ${(e as Error)?.message ?? e}`;
        run.finishedAt = Date.now();
        saveRun(run);
        addMessage({ agent: 'overseer', runId, taskId: null, role: 'system', content: run.summary, meta: null });
      }
    });
  }

  private cancelled(run: Run): boolean {
    if (run.status !== 'cancelled') return false;
    this.overseer().setStatus('idle', 'Chờ việc');
    return true;
  }

  /** Tóm tắt vài run gần nhất — Overseer biết việc vừa làm để nối tiếp, không làm lại từ đầu. */
  private history(exceptId: string): string {
    return [...this.runs.values()]
      .filter((r) => r.id !== exceptId && ['done', 'failed', 'cancelled'].includes(r.status))
      .sort((a, b) => b.createdAt - a.createdAt).slice(0, 5)
      .map((r) => `- [${r.status}] ${r.title}: ${(r.digest || r.summary).replace(/\s+/g, ' ').slice(0, 280)}`)
      .join('\n');
  }
  private runTasks(runId: string) { return [...this.tasks.values()].filter((t) => t.runId === runId); }

  // ─────────────── Vào ───────────────

  /** Người gõ prompt cho Overseer. */
  async submit(prompt: string): Promise<Run> {
    const run: Run = { id: randomUUID().slice(0, 8), prompt, title: prompt.slice(0, 60), intent: '', status: 'planning', summary: '', digest: '', replans: 0, createdAt: Date.now() };
    this.runs.set(run.id, run);
    saveRun(run);
    addMessage({ agent: 'overseer', runId: run.id, taskId: null, role: 'user', content: prompt, meta: null });
    bus.emitEvt({ type: 'run.created', runId: run.id }, { agent: 'overseer', text: `🧭 Yêu cầu mới: ${prompt.slice(0, 120)}` });
    this.safe(this.plan(run), run.id);
    return run;
  }

  /** Nhắn trực tiếp 1 agent (không qua kế hoạch) → thành 1 task riêng. */
  async direct(agentId: string, text: string): Promise<Run> {
    if (agentId === 'overseer') return this.submit(text);
    const ag = this.agents.get(agentId);
    if (!ag) throw new Error(`Không có agent ${agentId}`);
    const run: Run = { id: randomUUID().slice(0, 8), prompt: text, title: `Nhắn ${ag.def.name}: ${text.slice(0, 40)}`, intent: 'direct', status: 'running', summary: '', digest: '', replans: 0, createdAt: Date.now() };
    this.runs.set(run.id, run);
    saveRun(run);
    addMessage({ agent: agentId, runId: run.id, taskId: null, role: 'user', content: text, meta: null });
    this.addTasks(run, [{ id: 't1', agent: agentId, title: text.slice(0, 80), instructions: text, dependsOn: [] }]);
    await this.advance(run);
    return run;
  }

  // ─────────────── Lập kế hoạch ───────────────

  private async plan(run: Run, feedback?: string, previous?: Plan, attempt = 0): Promise<void> {
    const ov = this.overseer();
    ov.setStatus('working', feedback ? 'Lập lại kế hoạch theo góp ý…' : 'Phân tích yêu cầu, lập kế hoạch…');
    let plan: Plan;
    try {
      plan = await makePlan(run.prompt, feedback, previous, this.history(run.id), run.id);
    } catch (e) {
      ov.setStatus('idle', 'Chờ việc');
      run.status = 'failed';
      run.summary = (e as Error).message;
      run.finishedAt = Date.now();
      saveRun(run);
      addMessage({ agent: 'overseer', runId: run.id, taskId: null, role: 'system', content: `Lập kế hoạch lỗi: ${run.summary}`, meta: null });
      return;
    }
    ov.setStatus('idle', 'Chờ việc');
    if (this.cancelled(run)) return;
    run.title = plan.title;
    run.intent = plan.intent;
    run.summary = plan.summary;
    this.plans.set(run.id, plan);

    // Câu hỏi thuần → trả lời luôn, không cần đội.
    if (!plan.tasks.length) {
      run.status = 'done';
      run.digest = plan.answer || plan.summary;
      run.finishedAt = Date.now();
      saveRun(run);
      addMessage({ agent: 'overseer', runId: run.id, taskId: null, role: 'digest', content: run.digest, meta: null });
      return;
    }

    addMessage({ agent: 'overseer', runId: run.id, taskId: null, role: 'assistant', content: planText(plan), meta: { plan } });
    bus.emitEvt({ type: 'plan', runId: run.id, plan }, { agent: 'overseer', text: `🗺 Kế hoạch "${plan.title}" — ${plan.tasks.length} bước` });

    if (config.swarm.requirePlanApproval) {
      run.status = 'awaiting_plan';
      saveRun(run);
      const d = await inbox.create('plan', { agent: 'overseer', runId: run.id, taskId: null, title: `Kế hoạch: ${plan.title}`, body: plan });
      if (this.cancelled(run)) return;
      if (!d.approved) {
        if (d.answer && attempt < 2) return this.plan(run, d.answer, plan, attempt + 1);
        run.status = 'cancelled';
        run.finishedAt = Date.now();
        saveRun(run);
        return;
      }
    }
    run.status = 'running';
    saveRun(run);
    this.addTasks(run, plan.tasks);
    await this.advance(run);
  }

  private addTasks(run: Run, list: PlanTask[]): void {
    for (const p of list) {
      const t: Task = { id: `${run.id}.${p.id}`, localId: p.id, runId: run.id, agent: p.agent, title: p.title, instructions: p.instructions, deps: p.dependsOn, status: 'pending', result: '', createdAt: Date.now() };
      this.tasks.set(t.id, t);
      saveTask(t);
    }
  }

  // ─────────────── Điều phối ───────────────

  private advancing = new Set<string>();

  /** Gọi sau mỗi lần 1 bước kết thúc: phát bước sẵn sàng, xử lý thất bại, kết thúc run. */
  async advance(run: Run | undefined): Promise<void> {
    if (!run || run.status !== 'running' || this.advancing.has(run.id)) return;
    this.advancing.add(run.id);
    try {
      const tasks = this.runTasks(run.id);
      const byLocal = new Map(tasks.map((t) => [t.localId, t]));
      // Bước chờ phụ thuộc đã hỏng → huỷ (dây chuyền).
      let changed = true;
      while (changed) {
        changed = false;
        for (const t of tasks) {
          if (t.status === 'pending' && t.deps.some((d) => ['failed', 'cancelled'].includes(byLocal.get(d)?.status ?? ''))) {
            t.status = 'cancelled';
            t.result = 'Huỷ vì bước phụ thuộc thất bại.';
            saveTask(t);
            changed = true;
          }
        }
      }
      // Phát bước đủ điều kiện.
      for (const t of tasks) {
        if (t.status === 'pending' && t.deps.every((d) => byLocal.get(d)?.status === 'done')) {
          this.agents.get(t.agent)?.enqueue(t);
          bus.emitEvt({ type: 'handoff', runId: run.id, from: t.deps.map((d) => byLocal.get(d)?.agent).filter(Boolean), to: t.agent, taskId: t.id },
            { agent: t.agent, text: `➡ giao ${t.agent}: ${t.title}` });
        }
      }
      if (tasks.some((t) => ACTIVE.has(t.status))) return;

      const failed = tasks.filter((t) => t.status === 'failed' && !t.handled);
      if (failed.length) {
        failed.forEach((t) => { t.handled = true; });
        if (failed.some((t) => t.infra)) {
          // Quota/mạng: lập lại kế hoạch chỉ đốt thêm hạn mức — dừng và báo người.
          run.summary = 'Dừng do lỗi hạ tầng LLM (vd 429 vượt hạn mức). Chờ hạn mức hồi rồi gửi lại, hoặc giảm rpm / đổi model-key trong config.';
          return this.finish(run, 'failed');
        }
        if (run.intent !== 'direct' && run.replans < config.swarm.maxReplans) {
          run.replans++;
          saveRun(run);
          const ov = this.overseer();
          ov.setStatus('working', `Lập lại kế hoạch (lần ${run.replans})…`);
          bus.emitEvt({ type: 'replan', runId: run.id, n: run.replans }, { agent: 'overseer', text: `🔁 Lập lại kế hoạch lần ${run.replans}` });
          try {
            const p = await replan(run, tasks);
            if (this.cancelled(run)) return;
            ov.setStatus('idle', 'Chờ việc');
            if (p.tasks.length) {
              const plan = this.plans.get(run.id);
              if (plan) { plan.tasks.push(...p.tasks); bus.emitEvt({ type: 'plan', runId: run.id, plan }); }
              addMessage({ agent: 'overseer', runId: run.id, taskId: null, role: 'assistant', content: `Lập lại kế hoạch: ${p.summary}\n${planText(p)}`, meta: { replan: p } });
              this.addTasks(run, p.tasks);
              this.advancing.delete(run.id);
              return this.advance(run);
            }
            run.summary = p.summary;
          } catch (e) {
            ov.setStatus('idle', 'Chờ việc');
            run.summary = `Lập lại kế hoạch lỗi: ${(e as Error).message}`;
          }
        }
        return this.finish(run, 'failed');
      }
      // Bước hỏng ĐÃ được replan thay thế coi như đã giải quyết.
      const settled = (t: Task) => ['done', 'cancelled'].includes(t.status) || (t.status === 'failed' && t.handled);
      if (tasks.every(settled)) {
        return this.finish(run, tasks.some((t) => t.status === 'done') ? 'done' : 'cancelled');
      }
      // Không còn gì chạy mà vẫn chưa kết thúc được (vd bước 'interrupted') → đóng run thay vì treo.
      return this.finish(run, 'failed');
    } finally {
      this.advancing.delete(run.id);
    }
  }

  private async finish(run: Run, status: Run['status']): Promise<void> {
    run.status = status;
    run.finishedAt = Date.now();
    saveRun(run);
    const ov = this.overseer();
    const tasks = this.runTasks(run.id);
    if (tasks.length === 1 || tasks.some((t) => t.infra)) {
      // 1 bước (hoặc LLM đang lỗi hạ tầng): báo cáo của agent chính là tổng kết — khỏi tốn thêm 1 lượt gọi.
      run.digest = [run.summary, ...tasks.map((t) => t.result.replace(/\n?STATUS:.*$/s, '').trim())].filter(Boolean).join('\n\n');
    } else {
      ov.setStatus('working', 'Viết tổng kết…');
      try { run.digest = await digest(run, tasks); } catch (e) { run.digest = `(Không viết được tổng kết: ${(e as Error).message})`; }
      ov.setStatus('idle', 'Chờ việc');
    }
    saveRun(run);
    addMessage({ agent: 'overseer', runId: run.id, taskId: null, role: 'digest', content: run.digest, meta: { status } });
    bus.emitEvt({ type: 'run.finished', runId: run.id, status }, { agent: 'overseer', text: `${status === 'done' ? '🏁' : '⚠'} Run "${run.title}" → ${status}` });
  }

  private depContext(t: Task): string {
    const tasks = this.runTasks(t.runId);
    const done = tasks.filter((x) => x.status === 'done' && (t.deps.includes(x.localId) || x.agent === 'ba'));
    if (!done.length) return '';
    return '# Kết quả các bước trước (bàn giao cho bạn)\n' +
      done.map((x) => `## ${x.localId} · ${x.agent} · ${x.title}\n${x.result.slice(-3500)}`).join('\n\n');
  }

  private touch(rel: string, op: 'read' | 'write', agent: string): void {
    const prev = this.files.get(rel);
    if (prev?.op === 'write' && op === 'read') return;   // giữ dấu "đã ghi"
    let size = 0;
    try { size = fs.statSync(path.join(REPO, rel)).size; } catch { /* đã xoá */ }
    const f: FileTouch = { path: rel, op, agent, size, ts: Date.now() };
    this.files.set(rel, f);
    bus.emitEvt({ type: 'file', file: f }, op === 'write' ? { agent, text: `✏ ${rel}` } : undefined);
  }

  // ─────────────── Điều khiển ───────────────

  pauseTeam(): void { this.agents.forEach((a) => a.pause()); bus.emitEvt({ type: 'team', paused: true }, { text: '⏸ Tạm dừng cả đội' }); }
  resumeTeam(): void { this.agents.forEach((a) => a.resume()); bus.emitEvt({ type: 'team', paused: false }, { text: '▶ Tiếp tục cả đội' }); }

  stopAgent(id: string): void {
    const ag = this.agents.get(id);
    if (!ag) return;
    for (const t of ag.stop()) { t.status = 'cancelled'; t.result = 'Huỷ do dừng agent.'; saveTask(t); this.safe(this.advance(this.runs.get(t.runId)), t.runId); }
    bus.emitEvt({ type: 'agent.stop', agent: id }, { agent: id, text: `⏹ Dừng ${ag.def.name}` });
  }

  cancelRun(id: string): void {
    const run = this.runs.get(id);
    if (!run) return;
    releaseLocksForRun(id);
    inbox.cancelWhere((i) => i.runId === id);
    for (const t of this.runTasks(id)) {
      if (t.status === 'pending' || t.status === 'queued') { t.status = 'cancelled'; saveTask(t); }
      const ag = this.agents.get(t.agent);
      if (ag) { ag.queue = ag.queue.filter((q) => q.runId !== id); ag.emit(); }
      if (ag?.current?.runId === id) ag.abortCurrent();   // chỉ dừng task của run này, giữ hàng đợi run khác
    }
    run.status = 'cancelled';
    run.finishedAt = Date.now();
    saveRun(run);
  }

  /** Tiếp tục một run bị gián đoạn (interrupted) từ bước an toàn gần nhất. */
  async resumeRun(id: string): Promise<Run> {
    const run = this.runs.get(id);
    if (!run) throw new Error(`Không tìm thấy run "${id}"`);
    if (run.status !== 'interrupted' && run.status !== 'failed') {
      throw new Error(`Run "${id}" đang ở trạng thái "${run.status}", không thể tiếp tục.`);
    }

    const tasks = this.runTasks(id);
    if (!tasks.length) {
      if (run.status === 'interrupted' && run.intent !== 'direct') {
        run.status = 'planning';
        saveRun(run);
        this.safe(this.plan(run), run.id);
        return run;
      }
      throw new Error(`Run "${id}" không có bước nào để tiếp tục.`);
    }

    let resumedCount = 0;
    for (const t of tasks) {
      if (t.status === 'interrupted' || t.status === 'failed' || t.status === 'working' || t.status === 'queued') {
        t.status = 'pending';
        t.handled = false;
        t.infra = false;
        // Bổ sung hướng dẫn idempotent retry vào instructions nếu chưa có
        if (!t.instructions.includes('[PHỤC HỒI TỰ ĐỘNG]')) {
          t.instructions += '\n\n[PHỤC HỒI TỰ ĐỘNG]: Task này được tiếp tục sau khi gián đoạn. Trước khi thực hiện lệnh ghi, hãy kiểm tra (bằng lệnh đọc/diff/status) xem thao tác trước đó đã được áp dụng lên server hay chưa để đảm bảo tính idempotent, tránh ghi đè hoặc trùng lặp.';
        }
        saveTask(t);
        resumedCount++;
      }
    }

    if (resumedCount === 0) {
      throw new Error(`Tất cả các bước trong run "${id}" đã kết thúc hoặc không thể tiếp tục.`);
    }

    run.status = 'running';
    run.finishedAt = undefined;
    run.summary = '';
    saveRun(run);

    addMessage({
      agent: 'overseer',
      runId: run.id,
      taskId: null,
      role: 'system',
      content: `▶ Tiếp tục run "${run.title}" (${resumedCount} bước được kích hoạt lại từ bước an toàn gần nhất).`,
      meta: { resumed: true, resumedCount },
    });
    bus.emitEvt(
      { type: 'run.resumed', runId: run.id, resumedCount },
      { agent: 'overseer', text: `▶ Tiếp tục run "${run.title}" (${resumedCount} bước)` }
    );

    this.safe(this.advance(run), run.id);
    return run;
  }

  setModel(id: string, model: string): void {
    const ag = this.agents.get(id);
    if (ag) { ag.model = model; ag.emit(); }
    if (id === 'overseer') overseerModel.current = model;
  }

  snapshot() {
    const runs = [...this.runs.values()].sort((a, b) => b.createdAt - a.createdAt).slice(0, 20);
    const ids = new Set(runs.slice(0, 8).map((r) => r.id));
    return {
      agents: [...this.agents.values()].map((a) => a.view()),
      runs,
      tasks: [...this.tasks.values()].filter((t) => ids.has(t.runId)),
      plans: Object.fromEntries([...this.plans.entries()].filter(([k]) => ids.has(k))),
      inbox: inbox.pending(),
      files: [...this.files.values()].sort((a, b) => b.ts - a.ts).slice(0, 80),
      usage: usage24h(),
      events: eventCount(),
      browser: browserState(),
      models: Object.keys(config.prices),
      quota: quotaState(),
    };
  }
}

function planText(p: Plan): string {
  return `**${p.title}** — ${p.summary}\n` + p.tasks.map((t) =>
    `${t.id}. [${t.agent}] ${t.title}${t.dependsOn.length ? ` (sau ${t.dependsOn.join(', ')})` : ''}`).join('\n');
}

export const swarm = new Swarm();
