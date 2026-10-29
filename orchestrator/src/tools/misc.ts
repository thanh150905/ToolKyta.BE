import fs from 'node:fs';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { REPO } from '../config.js';
import { clip, resolvePath, type Tool } from './types.js';

export function run(bin: string, args: string[], timeout: number, signal?: AbortSignal): Promise<{ code: number; out: string }> {
  return new Promise((resolve) => {
    execFile(bin, args, { cwd: REPO, timeout, maxBuffer: 32 * 1024 * 1024, signal }, (err, so, se) =>
      resolve({ code: err ? 1 : 0, out: [so, se].filter(Boolean).join('\n') }));
  });
}

export const runTests: Tool = {
  name: 'run_tests',
  description: 'Chạy test của kyta (node --test). file = "test/xxx.test.js" để chạy 1 file; typecheck=true để chạy thêm tsc.',
  parameters: { type: 'object', properties: { file: { type: 'string' }, typecheck: { type: 'boolean' } } },
  async run(a, ctx) {
    const file = a.file ? String(a.file) : '';
    if (file && !/^test\/[\w.-]+\.test\.js$/.test(file)) return 'file phải dạng test/<tên>.test.js';
    const files = file ? [file] : fs.readdirSync(path.join(REPO, 'test')).filter((f) => f.endsWith('.test.js')).map((f) => `test/${f}`);
    const t = await run(process.execPath, ['--test', ...files], 300_000, ctx.signal);
    let out = `node --test (exit ${t.code})\n${t.out.split('\n').slice(-60).join('\n')}`;
    if (a.typecheck) {
      const tsc = path.join(REPO, 'node_modules', 'typescript', 'bin', 'tsc');
      const r = fs.existsSync(tsc) ? await run(process.execPath, [tsc, '-p', 'jsconfig.json'], 300_000, ctx.signal) : { code: 1, out: 'Chưa cài typescript ở repo gốc.' };
      out += `\n\ntsc (exit ${r.code})\n${r.out.split('\n').slice(-40).join('\n') || 'sạch'}`;
    }
    return clip(out, 12000);
  },
};

export const askHuman: Tool = {
  name: 'ask_human',
  description: 'Hỏi người dùng 1 câu và chờ trả lời (làm rõ yêu cầu, nhờ đăng nhập/thao tác trên UI, xác nhận giả định).',
  parameters: { type: 'object', properties: { question: { type: 'string' } }, required: ['question'] },
  async run(a, ctx) {
    const ans = await ctx.ask(String(a.question));
    return `Người dùng trả lời: ${ans}`;
  },
};

export const checkJs: Tool = {
  name: 'check_js',
  description: 'Kiểm cú pháp 1 file .js trong repo bằng node --check (không chạy code). Dùng ngay sau khi sửa code/*.js của form hoặc src/.',
  parameters: { type: 'object', properties: { path: { type: 'string' } }, required: ['path'] },
  async run(a, ctx) {
    const { abs, rel } = resolvePath(a.path);
    if (!rel.endsWith('.js')) return 'Chỉ kiểm file .js.';
    const r = await run(process.execPath, ['--check', abs], 30_000, ctx.signal);
    return r.code === 0 ? `✓ Cú pháp hợp lệ: ${rel}` : `✗ Lỗi cú pháp ${rel}:\n${r.out.split('\n').slice(0, 12).join('\n')}`;
  },
};

export const gitDiff: Tool = {
  name: 'git_diff',
  description: 'Xem thay đổi CHƯA commit trong repo (chỉ đọc). path để thu hẹp; bỏ trống = danh sách file đổi (--stat).',
  parameters: { type: 'object', properties: { path: { type: 'string' } } },
  async run(a, ctx) {
    const args = a.path ? ['diff', '--', resolvePath(a.path).rel] : ['status', '--short', '--', 'src', 'test', 'docs', 'workspace'];
    const r = await run('git', ['-c', 'core.quotepath=false', ...args], 30_000, ctx.signal);
    return clip(r.out.trim() || 'Không có thay đổi.', 14000);
  },
};
