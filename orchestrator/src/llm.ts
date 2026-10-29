import OpenAI from 'openai';
import type { ChatCompletionMessageParam, ChatCompletionTool } from 'openai/resources/chat/completions';
import { config, priceOf } from './config.js';
import { db } from './db.js';
import { bus } from './bus.js';

// Hết quota NGÀY của 1 model (đọc từ body 429) → dừng ngay, không retry vô ích tới hết ngày.
const dailyOut = new Map<string, number>();   // model → hết hạn chặn (ms)
const retryHint = new Map<string, number>();  // model → giây server gợi ý chờ

/** fetch bọc: SDK không parse được body 429 dạng mảng của Gemini, nên tự đọc để biết loại hạn mức. */
async function peekFetch(url: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const res = await fetch(url, init);
  if (res.status === 429) {
    let model = '';
    try { model = JSON.parse(String(init?.body ?? '{}')).model ?? ''; } catch { /* body không phải JSON */ }
    const text = await res.clone().text().catch(() => '');
    if (/PerDay/i.test(text)) {
      const midnight = new Date(); midnight.setHours(24, 0, 0, 0);
      dailyOut.set(model, midnight.getTime());
    }
    const m = /"retryDelay":\s*"(\d+(?:\.\d+)?)s"/.exec(text);
    if (m) retryHint.set(model, Number(m[1]));
  }
  return res;
}

// Một client OpenAI-compatible: trỏ LiteLLM (nhiều hãng, mỗi vai một key) hoặc thẳng endpoint Gemini.
// Tự quản lý retry (maxRetries: 0) để chờ đủ lâu khi bị giới hạn tốc độ.
function getClient(): OpenAI {
  const baseURL = process.env.LITELLM_BASE_URL ?? config.llm.baseURL;
  const apiKey = process.env.LITELLM_MASTER_KEY ?? config.llm.apiKey;
  return new OpenAI({ baseURL, apiKey, maxRetries: 0, fetch: peekFetch as never });
}

export function quotaState() {
  const now = Date.now();
  return Object.fromEntries([...dailyOut.entries()].filter(([, t]) => t > now).map(([m, t]) => [m, t]));
}

export type Msg = ChatCompletionMessageParam;
export interface ChatOut {
  message: OpenAI.Chat.Completions.ChatCompletionMessage;
  finish: string;   // stop | tool_calls | length | content_filter …
  usage: { prompt: number; completion: number; cost: number; costNote?: string };
}

const costByRun = new Map<string, number>();
const reservedCostByRun = new Map<string, number>();

/** Tổng chi phí ước tính đã tiêu cho 1 run (trần ngân sách: swarm.maxCostPerRun). */
export const runCost = (runId: string) => costByRun.get(runId) ?? 0;
export const runReservedCost = (runId: string) => reservedCostByRun.get(runId) ?? 0;

/** Lỗi hạ tầng LLM (quota 429, 5xx, mạng) — KHÔNG phải lỗi nghiệp vụ, đừng lập lại kế hoạch vì nó. */
export class LlmInfraError extends Error {}

const MAX_ATTEMPTS = 6;
const BACKOFF_MS = Number(process.env.SWARM_BACKOFF_MS) || 5000;   // test đặt nhỏ để khỏi chờ
const nextSlot = new Map<string, number>();

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(new Error('aborted'));
    const t = setTimeout(resolve, ms);
    signal?.addEventListener('abort', () => { clearTimeout(t); reject(new Error('aborted')); }, { once: true });
  });
}

/** Giãn cách lượt gọi theo `rpm` của model (models.yaml) — nhiều agent song song vẫn không vượt hạn mức. */
async function throttle(model: string, signal?: AbortSignal): Promise<void> {
  const p = priceOf(model);
  const rpm = p?.rpm;
  if (!rpm) return;
  const gap = 60_000 / rpm;
  const now = Date.now();
  const at = Math.max(now, (nextSlot.get(model) ?? 0) + gap);
  nextSlot.set(model, at);
  if (at > now) await sleep(at - now, signal);
}

const retriable = (e: unknown) => {
  if (e instanceof OpenAI.APIConnectionError) return true;   // mạng / timeout
  const status = (e as { status?: number }).status;
  return status === 429 || (typeof status === 'number' && status >= 500);
};

function estimateMaxCallCost(model: string, messages: Msg[]): number {
  const p = priceOf(model);
  if (!p) return 0;
  const approxPromptTokens = messages.reduce((n, m) => n + (typeof m.content === 'string' ? Math.ceil(m.content.length / 3) : 100), 0);
  const maxOutputTokens = 2048;
  return (approxPromptTokens * p.input + maxOutputTokens * p.output) / 1_000_000;
}

export async function chat(opts: {
  agent: string;
  model: string;
  messages: Msg[];
  tools?: ChatCompletionTool[];
  json?: boolean;
  signal?: AbortSignal;
  runId?: string;
}): Promise<ChatOut> {
  let resp: OpenAI.Chat.Completions.ChatCompletion | undefined;
  const blocked = () => (dailyOut.get(opts.model) ?? 0) > Date.now();
  const dailyErr = () => new LlmInfraError(`Model ${opts.model} đã HẾT QUOTA NGÀY của key (free tier). Chờ sang ngày mới, bật billing, hoặc đổi model cho agent này (nút Model).`);
  if (blocked()) throw dailyErr();

  const budget = config.swarm.maxCostPerRun ?? 0;
  const estCost = estimateMaxCallCost(opts.model, opts.messages);
  if (budget > 0 && opts.runId) {
    const curCost = costByRun.get(opts.runId) ?? 0;
    const curReserved = reservedCostByRun.get(opts.runId) ?? 0;
    if (curCost > budget) {
      throw new LlmInfraError(`Run đã tiêu ~$${curCost.toFixed(3)} > trần $${budget} (swarm.maxCostPerRun) — dừng để giữ ngân sách.`);
    }
    if (opts.agent !== 'overseer' && curCost + curReserved + estCost > budget && (curCost > 0 || curReserved > 0)) {
      throw new LlmInfraError(`Run đã tiêu/đặt trước ~$${(curCost + curReserved + estCost).toFixed(3)} > trần $${budget} (swarm.maxCostPerRun) — dừng để giữ ngân sách.`);
    }
    if (opts.agent !== 'overseer') {
      reservedCostByRun.set(opts.runId, curReserved + estCost);
    }
  }

  try {
    const client = getClient();
    for (let attempt = 1; !resp; attempt++) {
      await throttle(opts.model, opts.signal);
      try {
        resp = await client.chat.completions.create(
          {
            model: opts.model,
            messages: opts.messages,
            ...(opts.tools?.length ? { tools: opts.tools } : {}),
            ...(opts.json ? { response_format: { type: 'json_object' as const } } : {}),
            temperature: 0.2,
          },
          { signal: opts.signal },
        );
      } catch (e) {
        if (opts.signal?.aborted) throw e;
        const status = (e as { status?: number }).status;
        if (!retriable(e)) throw e;
        if (blocked()) {
          bus.emitEvt({ type: 'quota', model: opts.model, until: dailyOut.get(opts.model) }, { agent: opts.agent, text: `⛔ ${opts.model}: hết quota ngày — dừng, không thử lại` });
          throw dailyErr();
        }
        if (attempt >= MAX_ATTEMPTS) {
          throw new LlmInfraError(`LLM ${opts.model} lỗi ${status ?? 'mạng'} sau ${attempt} lần thử${status === 429 ? ' — vượt hạn mức tốc độ/quota của key' : ''}.`);
        }
        const wait = Math.min(60, Math.max(retryHint.get(opts.model) ?? 0, (BACKOFF_MS / 1000) * 2 ** (attempt - 1)));
        retryHint.delete(opts.model);
        bus.emitEvt({ type: 'llm.retry', agent: opts.agent, status, wait },
          { agent: opts.agent, text: `⏳ ${opts.model} trả ${status ?? 'lỗi mạng'} — chờ ${wait}s rồi thử lại (${attempt}/${MAX_ATTEMPTS - 1})` });
        await sleep(wait * 1000, opts.signal);
      }
    }
  } finally {
    if (budget > 0 && opts.runId) {
      reservedCostByRun.set(opts.runId, Math.max(0, (reservedCostByRun.get(opts.runId) ?? 0) - estCost));
    }
  }

  const u = resp.usage;
  const p = priceOf(opts.model);
  const prompt = u?.prompt_tokens ?? 0;
  const completion = u?.completion_tokens ?? 0;
  let cost: number | null = null;
  if (p && typeof p.input === 'number' && typeof p.output === 'number') {
    cost = (prompt * p.input + completion * p.output) / 1_000_000;
  }
  const recordedCost = cost ?? 0;
  const costNote = cost === null ? 'không có ước tính chi phí' : undefined;

  db.prepare('INSERT INTO usage(agent, model, prompt, completion, cost, ts, run_id) VALUES (?,?,?,?,?,?,?)')
    .run(opts.agent, opts.model, prompt, completion, recordedCost, Date.now(), opts.runId ?? null);
  if (opts.runId) costByRun.set(opts.runId, runCost(opts.runId) + recordedCost);
  bus.emitEvt({ type: 'usage', agent: opts.agent, model: opts.model, prompt, completion, cost: recordedCost, costNote });
  const choice = resp.choices?.[0];
  if (!choice?.message) throw new LlmInfraError(`LLM ${opts.model} trả response không có message (choices rỗng).`);
  return { message: choice.message, finish: String(choice.finish_reason ?? 'stop'), usage: { prompt, completion, cost: recordedCost, costNote } };
}

