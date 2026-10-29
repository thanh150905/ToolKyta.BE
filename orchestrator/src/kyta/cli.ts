import { execFile } from 'node:child_process';
import { config, REPO } from '../config.js';

export interface KytaResult { ok: boolean; code: number; out: string }

/** Chạy kyta bằng MẢNG tham số (execFile, không qua shell) — không có đường cho injection. */
export function runKyta(args: string[], timeoutMs = 180_000, signal?: AbortSignal): Promise<KytaResult> {
  return new Promise((resolve) => {
    execFile(process.execPath, [config.kytaBin, ...args],
      { cwd: REPO, timeout: timeoutMs, maxBuffer: 32 * 1024 * 1024, env: { ...process.env, NO_COLOR: '1' }, signal },
      (err, stdout, stderr) => {
        const code = err ? (typeof (err as { code?: unknown }).code === 'number' ? Number((err as { code: number }).code) : 1) : 0;
        const killed = err && ((err as { name?: string }).name === 'AbortError' || (err as { killed?: boolean }).killed);
        const note = killed ? `\n[đã dừng: ${signal?.aborted ? 'người dùng bấm Stop' : `quá ${timeoutMs / 1000}s`}]` : '';
        resolve({ ok: !err, code, out: [stdout, stderr].filter(Boolean).join('\n').trim() + note });
      });
  });
}
