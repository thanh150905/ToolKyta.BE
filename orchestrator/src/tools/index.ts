import type { ChatCompletionTool } from 'openai/resources/chat/completions';
import type { AgentDef } from '../config.js';
import { editFile, findLocal, listDir, readFile, search, writeFile } from './fs.js';
import { kytaRun, platformGetTool } from './kyta.js';
import { browserNetwork, browserOpen } from './browser.js';
import { askHuman, checkJs, gitDiff, runTests } from './misc.js';
import type { Tool, ToolCtx } from './types.js';

const ALL: Tool[] = [listDir, findLocal, readFile, search, writeFile, editFile, kytaRun, platformGetTool, browserOpen, browserNetwork, runTests, askHuman, checkJs, gitDiff];
const BY_NAME = new Map(ALL.map((t) => [t.name, t]));

export function toolsFor(agent: AgentDef): ChatCompletionTool[] {
  return agent.tools
    .map((n) => BY_NAME.get(n))
    .filter((t): t is Tool => !!t)
    .map((t) => ({ type: 'function', function: { name: t.name, description: t.description, parameters: t.parameters } }));
}

/** Thực thi 1 tool call. Agent chỉ gọi được tool nằm trong danh sách của nó (agents.yaml). */
export async function execTool(name: string, rawArgs: string, ctx: ToolCtx): Promise<string> {
  const tool = BY_NAME.get(name);
  if (!tool || !ctx.agent.tools.includes(name)) return `Tool "${name}" không có hoặc ${ctx.agent.name} không được dùng.`;
  let args: Record<string, unknown>;
  try { args = rawArgs ? JSON.parse(rawArgs) : {}; } catch { return `Tham số không phải JSON hợp lệ: ${rawArgs.slice(0, 200)}`; }
  try {
    return await tool.run(args, ctx);
  } catch (e) {
    return `LỖI: ${(e as Error).message}`;
  }
}

export type { ToolCtx };
