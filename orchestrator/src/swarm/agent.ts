import { config, priceOf, type AgentDef } from '../config.js';
import { bus } from '../bus.js';
import { chat, LlmInfraError, runCost, type Msg } from '../llm.js';
import { projectMap, inspectCommand } from '../kyta/catalog.js';
import { execTool, toolsFor, type ToolCtx } from '../tools/index.js';
import { inbox } from './inbox.js';
import { addMessage, saveTask } from './store.js';
import { sanitize } from '../sanitize.js';
import { releaseLocksForTask } from '../tools/lock.js';
import type { AgentStatus, Task } from './types.js';

const RULES = `## Quy tắc chung (bắt buộc)
- Làm việc bằng tool. Đường dẫn luôn tương đối gốc repo kyta. KHÔNG bịa endpoint/field/tham số — kiểm chứng bằng docs/ hoặc tool.
- Lệnh kyta: chép đúng cú pháp ở mục "Cú pháp lệnh" (kể cả khi chỉ dẫn của Overseer ghi khác). Tìm <form-folder> bằng find_local.
  Lệnh lỗi (exit ≠ 0, "Dùng:", "Không phải thư mục form") → sửa tham số rồi chạy lại; KHÔNG kết luận dựa trên lệnh lỗi.
- Tiết kiệm token: đọc đúng phần cần (search, read_file offset/limit). Không đọc ui/*/script.js, style.css (boilerplate custom UI) trừ khi task nói về custom UI.
- Mặc định customer/env = ${config.swarm.defaultCustomer}/${config.swarm.defaultEnv} nếu task không nói rõ.
- Lệnh ghi server: chạy --dry-run trước, đọc kết quả, rồi mới chạy thật (hệ thống tự hỏi người duyệt).
- Thiếu thông tin quan trọng → ask_human (nếu bạn có tool đó), đừng đoán.
- Kết thúc: báo cáo ngắn gọn (đã làm gì, file/lệnh nào, bằng chứng kiểm chứng) và DÒNG CUỐI đúng mẫu
  "STATUS: DONE" hoặc "STATUS: FAILED — <lý do ngắn>".`;

export interface AgentView {
  id: string; name: string; title: string; model: string; status: AgentStatus;
  queue: number; current: { id: string; title: string; runId: string } | null; ctxPct: number; activity: string; tools: string[];
}

export interface AgentHooks {
  onDone(task: Task, ok: boolean): void;
  depContext(task: Task): string;
  goal(task: Task): string;
  touched(rel: string, op: 'read' | 'write', agent: string): void;
}

export class AgentRuntime {
  status: AgentStatus = 'idle';
  model: string;
  queue: Task[] = [];
  current: Task | null = null;
  ctxPct = 0;
  activity = 'Chờ việc';
  private paused = false;
  private resumeWaiters: (() => void)[] = [];
  private abort: AbortController | null = null;

  constructor(readonly def: AgentDef, private hooks: AgentHooks) {
    this.model = def.model;
  }

  view(): AgentView {
    const d = this.def;
    return {
      id: d.id, name: d.name, title: d.title, model: this.model, status: this.paused && this.status === 'idle' ? 'paused' : this.status,
      queue: this.queue.length, current: this.current ? { id: this.current.id, title: this.current.title, runId: this.current.runId } : null,
      ctxPct: this.ctxPct, activity: this.activity, tools: d.tools,
    };
  }

  emit(): void { bus.emitEvt({ type: 'agent', agent: this.view() }); }

  setStatus(s: AgentStatus, activity?: string): void {
    this.status = s;
    if (activity !== undefined) this.activity = activity;
    this.emit();
  }

  enqueue(t: Task): void {
    t.status = 'queued';
    saveTask(t);
    this.queue.push(t);
    this.emit();
    void this.pump();
  }

  pause(): void { this.paused = true; this.emit(); }
  resume(): void { this.paused = false; this.resumeWaiters.splice(0).forEach((r) => r()); this.emit(); void this.pump(); }

  /** Dừng riêng task đang chạy (kéo theo cả tiến trình kyta/test đang chạy dở). */
  abortCurrent(): void {
    this.abort?.abort();
    if (this.current) {
      releaseLocksForTask(this.current.id);
      inbox.cancelWhere((i) => i.taskId === this.current!.id);
    }
  }

  /** Dừng task đang chạy + huỷ toàn bộ hàng đợi của agent. */
  stop(): Task[] {
    const dropped = this.queue.splice(0);
    this.abortCurrent();
    this.emit();
    return dropped;
  }

  private async gate(): Promise<void> {
    while (this.paused) await new Promise<void>((r) => this.resumeWaiters.push(r));
  }

  private async pump(): Promise<void> {
    if (this.current || this.paused) return;
    const t = this.queue.shift();
    if (!t) { this.setStatus('idle', 'Chờ việc'); return; }
    this.current = t;
    let ok = false;
    try { ok = await this.execute(t); }
    catch (e) {
      const aborted = this.abort?.signal.aborted;
      t.infra = e instanceof LlmInfraError;
      t.result = aborted ? 'Bị người dùng dừng.' : t.infra ? `Lỗi hạ tầng LLM: ${(e as Error).message}` : `Lỗi: ${(e as Error).message}`;
      t.status = aborted ? 'cancelled' : 'failed';
      addMessage({ agent: this.def.id, runId: t.runId, taskId: t.id, role: 'system', content: t.result, meta: null });
    } finally {
      if (t) releaseLocksForTask(t.id);
      t.finishedAt = Date.now();
      saveTask(t);
      this.current = null;
      this.abort = null;
      this.ctxPct = 0;
      try { this.hooks.onDone(t, ok); } catch (e) { console.error('[agent] onDone lỗi:', e); }
      void this.pump().catch((e) => console.error('[agent] pump lỗi:', e));
    }
  }

  private ctx(t: Task): ToolCtx {
    const agent = this.def;
    return {
      agent, runId: t.runId, taskId: t.id, signal: this.abort!.signal,
      approve: async (title, detail) => {
        this.setStatus('blocked', `Chờ duyệt: ${title}`);
        const d = await inbox.create('approval', { agent: agent.id, runId: t.runId, taskId: t.id, title, body: { detail } });
        this.setStatus('working', d.approved ? 'Đã được duyệt' : 'Bị từ chối');
        return d.approved;
      },
      ask: async (question) => {
        this.setStatus('blocked', `Hỏi người: ${question.slice(0, 80)}`);
        addMessage({ agent: agent.id, runId: t.runId, taskId: t.id, role: 'assistant', content: `❓ ${question}`, meta: { ask: true } });
        const d = await inbox.create('question', { agent: agent.id, runId: t.runId, taskId: t.id, title: question.slice(0, 140), body: { question } });
        this.setStatus('working', 'Đã có trả lời');
        const ans = d.approved ? d.answer || '(đồng ý)' : '(người dùng bỏ qua câu hỏi)';
        addMessage({ agent: agent.id, runId: t.runId, taskId: t.id, role: 'user', content: ans, meta: { answer: true } });
        return ans;
      },
      touched: (rel, op) => this.hooks.touched(rel, op, agent.id),
    };
  }

  /** Vòng tool-calling cho 1 task. true = STATUS DONE. */
  private async execute(t: Task): Promise<boolean> {
    this.abort = new AbortController();
    t.status = 'working';
    t.startedAt = Date.now();
    t.verification = { required: false, passed: true, evidences: [] };
    saveTask(t);
    this.setStatus('working', t.title);
    bus.emitEvt({ type: 'live', agent: this.def.id, taskId: t.id, kind: 'start', text: t.title }, { agent: this.def.id, text: `▶ ${t.title}` });

    const system = [config.prompt(this.def.prompt), projectMap(), RULES].join('\n\n');
    const user = [
      `# Mục tiêu chung của yêu cầu\n${this.hooks.goal(t)}`,
      `# Việc của bạn: ${t.title}\n${t.instructions}`,
      this.hooks.depContext(t),
    ].filter(Boolean).join('\n\n');
    addMessage({ agent: this.def.id, runId: t.runId, taskId: t.id, role: 'task', content: `${t.title}\n\n${t.instructions}`, meta: null });

    const messages: Msg[] = [{ role: 'system', content: system }, { role: 'user', content: user }];
    const tools = toolsFor(this.def);
    const ctx = this.ctx(t);
    let final = '';

    const nudge = (text: string) => messages.push({ role: 'user', content: `[Hệ thống] ${text}` });
    const seen = new Map<string, number>();   // chữ ký tool call → số lần
    let nudges = 0;
    let lastFinish = '';

    for (let step = 0; step < config.swarm.maxStepsPerTask; step++) {
      await this.gate();
      if (this.abort.signal.aborted) throw new Error('aborted');
      const budget = config.swarm.maxCostPerRun ?? 0;
      if (budget > 0 && runCost(t.runId) > budget)
        throw new LlmInfraError(`Run đã tiêu ~$${runCost(t.runId).toFixed(3)} > trần $${budget} (swarm.maxCostPerRun) — dừng để giữ ngân sách.`);
      this.activity = step === 0 ? 'Đang suy nghĩ…' : `Bước ${step + 1}: suy nghĩ…`;
      this.emit();
      const out = await chat({ agent: this.def.id, model: this.model, messages, tools, signal: this.abort.signal, runId: t.runId });
      const contextWindow = priceOf(this.model)?.context ?? 128000;
      this.ctxPct = Math.min(1, out.usage.prompt / contextWindow);
      const m = out.message;
      lastFinish = out.finish;
      messages.push(m as Msg);
      if (m.content?.trim() && m.tool_calls?.length) {
        bus.emitEvt({ type: 'live', agent: this.def.id, taskId: t.id, kind: 'think', text: m.content.slice(0, 1500) });
      }

      if (!m.tool_calls?.length) {
        const text = (m.content ?? '').trim();
        if (out.finish === 'content_filter') { final = `${text}\nSTATUS: FAILED — model chặn nội dung (content_filter)`; break; }
        // Trả rỗng / bị cắt / thiếu dòng STATUS → nhắc tối đa 2 lần thay vì kết luận sai.
        if (nudges < 2 && (!text || out.finish === 'length' || !/STATUS:\s*(DONE|FAILED)/i.test(text))) {
          nudges++;
          nudge(!text ? 'Bạn chưa trả lời gì. Tiếp tục bằng tool, hoặc kết luận theo mẫu STATUS.'
            : out.finish === 'length' ? 'Câu trả lời bị cắt vì quá dài. Viết lại báo cáo NGẮN GỌN, kết thúc bằng dòng STATUS.'
            : 'Báo cáo thiếu dòng cuối "STATUS: DONE" hoặc "STATUS: FAILED — <lý do>". Viết lại đủ.');
          continue;
        }
        final = text;
        break;
      }

      for (const tc of m.tool_calls) {
        if (tc.type !== 'function') continue;
        const name = tc.function.name;
        const args = tc.function.arguments ?? '';
        this.activity = `${name} ${args.slice(0, 90)}`;
        this.emit();
        bus.emitEvt({ type: 'live', agent: this.def.id, taskId: t.id, kind: 'call', name, text: args.slice(0, 1500) },
          { agent: this.def.id, text: `🔧 ${name} ${args.slice(0, 120)}` });
        // Gọi y hệt lần thứ 3 → không chạy nữa, bắt agent đổi hướng (chống vòng lặp vô ích đốt token).
        const sig = `${name}|${args}`;
        const n = (seen.get(sig) ?? 0) + 1;
        seen.set(sig, n);
        const result = n >= 3
          ? `[Hệ thống] Bạn đã gọi ${name} với đúng tham số này ${n} lần. Kết quả sẽ không khác — đổi cách tiếp cận hoặc kết luận (STATUS).`
          : await execTool(name, args, ctx);
        if (this.abort.signal.aborted) throw new Error('aborted');

        // Ghi nhận bằng chứng kiểm chứng độc lập
        if (t.verification) {
          if (name === 'run_tests') {
            const exitCode = result.includes('(exit 0)') ? 0 : 1;
            t.verification.evidences.push({ command: 'run_tests', exitCode, notes: result.slice(0, 300) });
            if (exitCode !== 0) t.verification.passed = false;
          } else if (name === 'git_diff') {
            t.verification.evidences.push({ command: 'git_diff', diff: result.slice(0, 1000) });
          } else if (name === 'write_file' || name === 'edit_file') {
            t.verification.required = true;
            t.verification.type = this.def.id === 'dev' ? 'code' : 'workspace';
          } else if (name === 'kyta_run') {
            try {
              const parsedArgs = (JSON.parse(args).args || []) as string[];
              const insp = inspectCommand(parsedArgs);
              if (insp.impacts.includes('server_write') && !parsedArgs.includes('--dry-run')) {
                t.verification.required = true;
                t.verification.type = 'server';
              }
              if (t.verification.type === 'server' && (insp.impacts.includes('server_read') || insp.impacts.includes('local_read'))) {
                t.verification.evidences.push({ command: `kyta ${parsedArgs.join(' ')}`, readBack: result.slice(0, 500) });
                t.verification.passed = true;
              }
            } catch {}
          } else if (name === 'platform_get') {
            if (t.verification.type === 'server') {
              t.verification.evidences.push({ command: 'platform_get', readBack: result.slice(0, 500) });
              t.verification.passed = true;
            }
          }
        }

        bus.emitEvt({ type: 'live', agent: this.def.id, taskId: t.id, kind: 'result', name, text: result.slice(0, 2500) });
        addMessage({ agent: this.def.id, runId: t.runId, taskId: t.id, role: 'tool', content: `${name}(${args.slice(0, 300)})`, meta: { result: result.slice(0, 4000) } });
        messages.push({ role: 'tool', tool_call_id: tc.id, content: sanitize(result) });
      }
      compact(messages);
    }

    if (!final) final = lastFinish === 'length'
      ? 'Câu trả lời liên tục bị cắt.\nSTATUS: FAILED — output quá dài'
      : `Hết ${config.swarm.maxStepsPerTask} bước mà chưa kết luận.\nSTATUS: FAILED — vượt maxStepsPerTask`;

    // Đánh giá kiểm chứng độc lập trước khi chốt kết quả
    if (t.verification) {
      if (this.def.id === 'dev' && t.verification.required) {
        const hasPassedTest = t.verification.evidences.some((e) => e.command === 'run_tests' && e.exitCode === 0);
        if (!hasPassedTest) {
          t.verification.passed = false;
          final += '\n[KIỂM CHỨNG ĐỘC LẬP THẤT BẠI] Code đã sửa nhưng chưa có bằng chứng chạy run_tests đạt exit code 0.';
        }
      }

      if (this.def.id === 'qa') {
        const failedTest = t.verification.evidences.some((e) => e.command === 'run_tests' && e.exitCode !== 0);
        if (failedTest) {
          t.verification.passed = false;
          final += '\n[KIỂM CHỨNG ĐỘC LẬP THẤT BẠI] Kiểm thử QA phát hiện lỗi (run_tests exit != 0).';
        }
      }

      if (this.def.id === 'config' && t.verification.type === 'server' && t.verification.required) {
        const hasReadBack = t.verification.evidences.some((e) => e.readBack != null);
        if (!hasReadBack) {
          t.verification.unverifiedReason = 'Thao tác server chưa được kiểm chứng lại qua read-after-write; cần người xem xét.';
        }
      }
    }

    // Chỉ DONE khi agent nói rõ DONE VÀ kiểm chứng độc lập đạt (nếu có yêu cầu kiểm chứng)
    let ok = /STATUS:\s*DONE/i.test(final) && !/STATUS:\s*FAILED/i.test(final);
    if (ok && t.verification?.required && !t.verification.passed) {
      ok = false;
    }
    if (ok && t.verification?.unverifiedReason) {
      final += `\n⚠ KẾT QUẢ CHƯA XÁC MINH: ${t.verification.unverifiedReason}`;
    }

    t.result = final;
    t.status = ok ? 'done' : 'failed';
    saveTask(t);
    addMessage({ agent: this.def.id, runId: t.runId, taskId: t.id, role: 'assistant', content: final, meta: { final: true, ok, verification: t.verification } });
    bus.emitEvt({ type: 'live', agent: this.def.id, taskId: t.id, kind: 'end', text: ok ? 'DONE' : 'FAILED' },
      { agent: this.def.id, text: `${ok ? '✅' : '❌'} ${t.title}` });
    return ok;
  }
}

/** Giữ context gọn: rút gọn kết quả tool cũ khi hội thoại phình (chỉ giữ nguyên 6 kết quả gần nhất). */
function compact(messages: Msg[]): void {
  const size = messages.reduce((n, m) => n + (typeof m.content === 'string' ? m.content.length : 0), 0);
  if (size < 150_000) return;
  const toolIdx = messages.map((m, i) => (m.role === 'tool' ? i : -1)).filter((i) => i >= 0);
  for (const i of toolIdx.slice(0, -6)) {
    const m = messages[i] as { content: string };
    if (m.content.length > 300) m.content = m.content.slice(0, 300) + '\n…[kết quả cũ đã rút gọn để tiết kiệm context]';
  }
}
