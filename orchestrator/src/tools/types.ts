import fs from 'node:fs';
import path from 'node:path';
import type { AgentDef } from '../config.js';
import { REPO } from '../config.js';

export interface ToolCtx {
  agent: AgentDef;
  runId: string | null;
  taskId: string | null;
  signal: AbortSignal;
  /** Hỏi người duyệt 1 hành động nhạy cảm — chặn tới khi có quyết định. */
  approve(title: string, detail: string): Promise<boolean>;
  /** Hỏi người 1 câu (vd: "hãy đăng nhập trình duyệt rồi mở panel X") — chặn tới khi trả lời. */
  ask(question: string): Promise<string>;
  /** Ghi nhận file agent đã đọc/ghi (panel Workspace). */
  touched(rel: string, op: 'read' | 'write'): void;
}

export interface Tool {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
  run(args: Record<string, unknown>, ctx: ToolCtx): Promise<string>;
}

export const clip = (s: string, n = 16000) =>
  s.length > n ? `${s.slice(0, n)}\n…(đã cắt ${s.length - n} ký tự — thu hẹp phạm vi nếu cần xem thêm)` : s;

// ── Chính sách đường dẫn ──
const DENY_PREFIX = ['.git', '.kyta', 'node_modules', 'orchestrator'];
const isSecret = (rel: string) => /(^|\/)\.env(\.|$)|\.local\.json$|credentials/i.test(rel);

/** Chuẩn hoá đường dẫn tương đối gốc repo; chặn thoát repo, bí mật, symlink và chính orchestrator. */
export function resolvePath(p: unknown): { abs: string; rel: string } {
  const rawAbs = path.resolve(REPO, String(p || '.'));
  const rawRel = path.relative(REPO, rawAbs).split(path.sep).join('/');
  if (rawRel.startsWith('..') || path.isAbsolute(rawRel)) throw new Error(`Ngoài repo: ${p}`);
  if (DENY_PREFIX.some((d) => rawRel === d || rawRel.startsWith(d + '/')) || isSecret(rawRel))
    throw new Error(`Đường dẫn bị chặn: ${rawRel}`);

  // Chặn symlink thoát khỏi repo hoặc trỏ vào thư mục nhạy cảm
  let realAbs = rawAbs;
  try {
    if (fs.existsSync(rawAbs)) {
      realAbs = fs.realpathSync(rawAbs);
    } else {
      let cur = path.dirname(rawAbs);
      while (cur !== path.dirname(cur) && !fs.existsSync(cur)) {
        cur = path.dirname(cur);
      }
      if (fs.existsSync(cur)) {
        const realAncestor = fs.realpathSync(cur);
        const relToAncestor = path.relative(cur, rawAbs);
        realAbs = path.resolve(realAncestor, relToAncestor);
      }
    }
  } catch {
    throw new Error(`Không thể resolve đường dẫn: ${p}`);
  }

  const realRel = path.relative(REPO, realAbs).split(path.sep).join('/');
  if (realRel.startsWith('..') || path.isAbsolute(realRel)) {
    throw new Error(`Symlink thoát ngoài repo: ${p} -> ${realAbs}`);
  }
  if (DENY_PREFIX.some((d) => realRel === d || realRel.startsWith(d + '/')) || isSecret(realRel)) {
    throw new Error(`Đường dẫn đích (sau symlink) bị chặn: ${realRel}`);
  }

  return { abs: realAbs, rel: realRel || '.' };
}

export function assertWritable(agent: AgentDef, rel: string): void {
  const scope = agent.write ?? [];
  const normalized = rel.replace(/^\.\//, '');
  if (!scope.some((w) => normalized === w || normalized.startsWith(w.endsWith('/') ? w : w + '/')))
    throw new Error(`${agent.name} không được ghi "${normalized}" (chỉ được ghi: ${scope.join(', ') || 'không'}).`);
}

