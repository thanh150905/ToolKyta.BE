export type TaskStatus = 'pending' | 'queued' | 'working' | 'blocked' | 'done' | 'failed' | 'cancelled' | 'interrupted';
export type RunStatus = 'planning' | 'awaiting_plan' | 'running' | 'done' | 'failed' | 'cancelled' | 'interrupted';
export type AgentStatus = 'idle' | 'working' | 'blocked' | 'paused';

export interface TaskEvidence {
  command?: string;
  exitCode?: number;
  readBack?: unknown;
  diff?: string;
  notes?: string;
}

export interface TaskVerification {
  required: boolean;
  type?: 'code' | 'workspace' | 'server' | 'none';
  passed: boolean;
  evidences: TaskEvidence[];
  unverifiedReason?: string;
}

export interface Task {
  id: string;            // duy nhất toàn cục: <runId>.<localId>
  localId: string;       // id trong kế hoạch (t1, t2…) — Overseer tham chiếu dependsOn bằng id này
  runId: string;
  agent: string;
  title: string;
  instructions: string;
  deps: string[];        // localId
  status: TaskStatus;
  result: string;
  handled?: boolean;     // thất bại đã được Overseer xử lý (lập lại kế hoạch)
  infra?: boolean;       // thất bại do hạ tầng LLM (429/5xx/mạng) — không lập lại kế hoạch
  verification?: TaskVerification;
  createdAt: number;
  startedAt?: number;
  finishedAt?: number;
}

export interface Run {
  id: string;
  prompt: string;
  title: string;
  intent: string;
  status: RunStatus;
  summary: string;
  digest: string;
  replans: number;
  createdAt: number;
  finishedAt?: number;
}

export interface PlanTask { id: string; agent: string; title: string; instructions: string; dependsOn: string[] }
export interface Plan { intent: string; title: string; summary: string; answer?: string; tasks: PlanTask[] }
