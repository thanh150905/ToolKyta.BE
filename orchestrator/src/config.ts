import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import yaml from 'js-yaml';

const here = path.dirname(fileURLToPath(import.meta.url));
export const ROOT = path.resolve(here, '..');          // orchestrator/
export const REPO = path.resolve(ROOT, '..');          // repo kyta (bin/, src/, workspace/, docs/)

const savedEnv = { ...process.env };
try {
  process.loadEnvFile(path.join(ROOT, '.env'));
  // Giữ lại các biến môi trường đã được set từ trước (vd khi chạy test hoặc override qua CLI)
  for (const [k, v] of Object.entries(savedEnv)) {
    if (v !== undefined) process.env[k] = v;
  }
} catch { /* chạy không cần .env */ }

export const ALLOW_REAL_PUSH = process.env.ALLOW_REAL_PUSH === '1';

export interface AgentDef {
  id: string;
  name: string;
  title: string;
  model: string;
  prompt: string;
  tools: string[];
  write?: string[];
  kyta?: 'read' | 'write';
}
export interface SwarmCfg {
  requirePlanApproval: boolean;
  maxReplans: number;
  maxStepsPerTask: number;
  defaultCustomer: string;
  defaultEnv: string;
  maxCostPerRun?: number;   // USD — vượt thì dừng run (0/không khai = không giới hạn)
}
export interface ModelPrice {
  input: number;
  output: number;
  context: number;
  rpm?: number;
  provider?: string;
  alias?: string;
}

const readYaml = <T>(file: string): T => yaml.load(fs.readFileSync(path.join(ROOT, 'config', file), 'utf8')) as T;

const agentsDoc = readYaml<{ swarm: SwarmCfg; agents: AgentDef[] }>('agents.yaml');
if (process.env.SWARM_PLAN_APPROVAL) agentsDoc.swarm.requirePlanApproval = process.env.SWARM_PLAN_APPROVAL === '1';

export const config = {
  port: Number(process.env.PORT ?? 5178),
  dataDir: process.env.SWARM_DATA_DIR ?? path.join(ROOT, 'data'),
  kytaBin: path.join(REPO, 'bin', 'kyta.js'),
  llm: {
    baseURL: process.env.LITELLM_BASE_URL ?? 'http://localhost:4000',
    apiKey: process.env.LITELLM_MASTER_KEY ?? 'sk-local-master',
  },
  swarm: agentsDoc.swarm,
  agents: agentsDoc.agents,
  prices: readYaml<Record<string, ModelPrice>>('models.yaml'),
  prompt: (file: string) => fs.readFileSync(path.join(ROOT, 'prompts', file), 'utf8'),
};

export function priceOf(model: string): ModelPrice | null {
  return config.prices[model] ?? null;
}

export function validateModelsConfig(): void {
  for (const agent of config.agents) {
    const p = config.prices[agent.model];
    if (!p) {
      throw new Error(`Cấu hình model không hợp lệ: Agent "${agent.id}" dùng model "${agent.model}" chưa được khai báo trong bảng giá/mapping (models.yaml).`);
    }
    if (typeof p.input !== 'number' || typeof p.output !== 'number' || typeof p.context !== 'number') {
      throw new Error(`Cấu hình model không hợp lệ: Model "${agent.model}" thiếu giá input/output hoặc context trong models.yaml.`);
    }
  }
}
