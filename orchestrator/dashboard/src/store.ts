import { reactive, computed } from 'vue';
import { io } from 'socket.io-client';

// ── Kiểu dữ liệu khớp backend ──
export interface AgentView {
  id: string; name: string; title: string; model: string; status: 'idle' | 'working' | 'blocked' | 'paused';
  queue: number; current: { id: string; title: string; runId: string } | null; ctxPct: number; activity: string; tools: string[];
}
export interface Task { id: string; localId: string; runId: string; agent: string; title: string; instructions: string; deps: string[]; status: string; result: string; createdAt: number; startedAt?: number; finishedAt?: number }
export interface Run { id: string; prompt: string; title: string; intent: string; status: string; summary: string; digest: string; replans: number; createdAt: number; finishedAt?: number }
export interface PlanTask { id: string; agent: string; title: string; instructions: string; dependsOn: string[] }
export interface Plan { intent: string; title: string; summary: string; tasks: PlanTask[] }
export interface InboxItem { id: string; kind: 'plan' | 'approval' | 'question'; agent: string; runId: string | null; taskId: string | null; title: string; body: any; status: string; ts: number }
export interface FileTouch { path: string; op: 'read' | 'write'; agent: string; size: number; ts: number }
export interface MessageRow { id: number; agent: string; runId: string | null; taskId: string | null; role: string; content: string; meta: any; ts: number }
export interface LiveRow { kind: string; name?: string; text: string; ts: number; taskId: string }
export interface EventRow { type: string; agent: string | null; text: string; ts: number }
export interface Toast { id: number; tone: 'info' | 'ok' | 'warn' | 'bad'; title: string; text: string; action?: 'inbox' | 'digest' }

export const S = reactive({
  connected: false,
  loaded: false,
  agents: [] as AgentView[],
  runs: [] as Run[],
  tasks: {} as Record<string, Task>,
  plans: {} as Record<string, Plan>,
  inbox: [] as InboxItem[],
  files: [] as FileTouch[],
  usage: { cost: 0, prompt: 0, completion: 0, calls: 0, byAgent: [] as { agent: string; prompt: number; completion: number; cost: number; calls: number }[] },
  events: [] as EventRow[],
  eventCount: 0,
  browser: { open: false, url: null as string | null, captured: 0 },
  models: [] as string[],
  quota: {} as Record<string, number>,   // model → hết quota ngày tới (ms)
  teamPaused: false,
  selected: 'overseer',
  viewRunId: null as string | null,
  messages: {} as Record<string, MessageRow[]>,
  live: {} as Record<string, LiveRow[]>,
  flash: {} as Record<string, number>,      // khoá cạnh "a->b" → hết hạn (ms)
  now: Date.now(),
  toasts: [] as Toast[],
  ui: { inbox: false, models: false, compact: false, log: true, tab: 'history' as 'history' | 'live' | 'digests' },
});

// ── REST ──
async function call<T = any>(method: string, url: string, body?: unknown): Promise<T> {
  const r = await fetch(url, { method, headers: body ? { 'content-type': 'application/json' } : {}, body: body ? JSON.stringify(body) : undefined });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || r.statusText);
  return j as T;
}
export const api = {
  prompt: (text: string) => call('POST', '/api/prompt', { text }),
  message: (agent: string, text: string) => call('POST', `/api/agents/${agent}/message`, { text }),
  agent: (agent: string, action: 'pause' | 'resume' | 'stop') => call('POST', `/api/agents/${agent}/${action}`),
  model: (agent: string, model: string) => call('POST', `/api/agents/${agent}/model`, { model }),
  team: (action: 'pause' | 'resume') => call('POST', `/api/team/${action}`),
  inbox: (id: string, approved: boolean, answer = '') => call('POST', `/api/inbox/${id}`, { approved, answer }),
  cancelRun: (id: string) => call('POST', `/api/runs/${id}/cancel`),
  browser: (url?: string) => call('POST', '/api/browser/open', { url }),
};

export async function loadMessages(agent: string): Promise<void> {
  S.messages[agent] = await call<MessageRow[]>('GET', `/api/messages/${agent}`);
}

export function select(agent: string): void {
  S.selected = agent;
  if (!S.messages[agent]) void loadMessages(agent);
}

// ── Suy diễn ──
export const agentById = (id: string) => S.agents.find((a) => a.id === id);
export const viewRun = computed(() => S.runs.find((r) => r.id === S.viewRunId) ?? S.runs[0] ?? null);
export const runTasks = (runId: string) =>
  Object.values(S.tasks).filter((t) => t.runId === runId).sort((a, b) => a.createdAt - b.createdAt);
export const stats = computed(() => ({
  agents: S.agents.length,
  busy: S.agents.filter((a) => a.status === 'working' || a.status === 'blocked').length,
  queued: S.agents.reduce((n, a) => n + a.queue, 0),
}));
export const flashing = (key: string) => (S.flash[key] ?? 0) > S.now;

/** Cạnh "bàn giao" theo kế hoạch của run đang xem: agent của bước phụ thuộc → agent của bước sau. */
export const planEdges = computed(() => {
  const run = viewRun.value;
  if (!run) return [] as { from: string; to: string; key: string }[];
  const tasks = runTasks(run.id);
  const byLocal = new Map(tasks.map((t) => [t.localId, t]));
  const out = new Map<string, { from: string; to: string; key: string }>();
  for (const t of tasks) for (const d of t.deps) {
    const from = byLocal.get(d)?.agent;
    if (from && from !== t.agent) out.set(`${from}->${t.agent}`, { from, to: t.agent, key: `${from}->${t.agent}` });
  }
  return [...out.values()];
});
export const planAgents = computed(() => new Set(viewRun.value ? runTasks(viewRun.value.id).map((t) => t.agent) : []));
const busyIds = computed(() => new Set(S.agents.filter((a) => a.status === 'working' || a.status === 'blocked').map((a) => a.id)));
/** Cạnh đang "nóng": vừa bàn giao (flash) hoặc agent đích đang làm. */
export const edgeHot = (from: string, to: string) => flashing(`${from}->${to}`) || busyIds.value.has(to);

let toastId = 0;
const toastedRuns = new Set<string>();
export function toast(t: Omit<Toast, 'id'>, ms = 6000): void {
  const id = ++toastId;
  S.toasts.push({ ...t, id });
  if (S.toasts.length > 4) S.toasts.shift();
  setTimeout(() => { S.toasts = S.toasts.filter((x) => x.id !== id); }, ms);
}
const nameOf = (id: string) => S.agents.find((a) => a.id === id)?.name ?? id;

function upsert<T>(list: T[], item: T, key: (x: T) => string, front = false): void {
  const i = list.findIndex((x) => key(x) === key(item));
  if (i >= 0) list[i] = item;
  else if (front) list.unshift(item);
  else list.push(item);
}

// ── Sự kiện realtime ──
function onEvt(e: any): void {
  switch (e.type) {
    case 'agent': upsert(S.agents, e.agent, (a) => a.id); break;
    case 'run':
      upsert(S.runs, e.run, (r) => r.id, true);
      S.runs.sort((a, b) => b.createdAt - a.createdAt);
      if (['planning', 'awaiting_plan', 'running'].includes(e.run.status)) S.viewRunId = e.run.id;
      if (e.run.digest && ['done', 'failed'].includes(e.run.status) && !toastedRuns.has(e.run.id)) {
        toastedRuns.add(e.run.id);
        toast({ tone: e.run.status === 'done' ? 'ok' : 'bad', action: 'digest', title: e.run.status === 'done' ? 'Hoàn thành' : 'Không hoàn thành', text: e.run.title });
      }
      break;
    case 'task': S.tasks[e.task.id] = e.task; break;
    case 'plan': S.plans[e.runId] = e.plan; break;
    case 'message': S.messages[e.message.agent]?.push(e.message); break;
    case 'live': {
      const l = (S.live[e.agent] ||= []);
      l.push({ kind: e.kind, name: e.name, text: e.text, ts: e.ts, taskId: e.taskId });
      if (l.length > 400) l.splice(0, l.length - 400);
      if (e.kind === 'end') S.flash[`${e.text === 'DONE' ? 'done' : 'fail'}:${e.agent}`] = Date.now() + 1800;
      break;
    }
    case 'inbox':
      if (e.item.status === 'pending') {
        upsert(S.inbox, e.item, (i) => i.id);
        toast({
          tone: 'warn', action: 'inbox',
          title: e.item.kind === 'plan' ? 'Kế hoạch chờ bạn duyệt' : e.item.kind === 'question' ? `${nameOf(e.item.agent)} đang hỏi bạn` : `${nameOf(e.item.agent)} cần bạn duyệt`,
          text: e.item.title,
        }, 12000);
      } else S.inbox = S.inbox.filter((i) => i.id !== e.item.id);
      break;
    case 'file': upsert(S.files, e.file, (f) => f.path, true); S.files.sort((a, b) => b.ts - a.ts); break;
    case 'usage': {
      S.usage.cost += e.cost; S.usage.prompt += e.prompt; S.usage.completion += e.completion; S.usage.calls++;
      const b = S.usage.byAgent.find((x) => x.agent === e.agent);
      if (b) { b.prompt += e.prompt; b.completion += e.completion; b.cost += e.cost; b.calls++; }
      else S.usage.byAgent.push({ agent: e.agent, prompt: e.prompt, completion: e.completion, cost: e.cost, calls: 1 });
      break;
    }
    case 'event':
      S.events.push(e.event);
      S.eventCount++;
      if (S.events.length > 500) S.events.splice(0, S.events.length - 500);
      break;
    case 'browser': S.browser = { open: e.open, url: e.url, captured: e.captured }; break;
    case 'team': S.teamPaused = e.paused; break;
    case 'quota': S.quota[e.model] = e.until; break;
    case 'handoff': {
      const until = Date.now() + 3500;
      S.flash[`overseer->${e.to}`] = until;
      for (const f of e.from as string[]) S.flash[`${f}->${e.to}`] = until;
      break;
    }
    case 'replan': S.flash['replan'] = Date.now() + 4000; break;
  }
}

export async function init(): Promise<void> {
  const st = await call('GET', '/api/state');
  S.agents = st.agents; S.runs = st.runs; S.inbox = st.inbox; S.files = st.files; S.models = st.models;
  S.usage = st.usage; S.eventCount = st.events; S.browser = st.browser; S.plans = st.plans; S.quota = st.quota ?? {};
  for (const t of st.tasks) S.tasks[t.id] = t;
  S.events = await call('GET', '/api/events');
  S.viewRunId = st.runs[0]?.id ?? null;
  S.loaded = true;
  void loadMessages(S.selected);

  const sock = io();
  sock.on('connect', () => { S.connected = true; });
  sock.on('disconnect', () => { S.connected = false; });
  sock.on('evt', onEvt);
  setInterval(() => { S.now = Date.now(); }, 400);
}
