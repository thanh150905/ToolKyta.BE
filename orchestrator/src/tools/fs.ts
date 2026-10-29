import fs from 'node:fs';
import path from 'node:path';
import { assertWritable, clip, resolvePath, type Tool } from './types.js';
import { acquirePathLock } from './lock.js';

const SKIP_DIR = new Set(['.git', 'node_modules', '.kyta', 'orchestrator', 'dist']);
const MAX_READ = 2 * 1024 * 1024;

function isBinary(buf: Buffer): boolean {
  return buf.subarray(0, 8000).includes(0);
}

function* walk(dir: string, depth: number): Generator<{ abs: string; isDir: boolean; depth: number }> {
  let ents: fs.Dirent[] = [];
  try { ents = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
  ents.sort((a, b) => Number(b.isDirectory()) - Number(a.isDirectory()) || a.name.localeCompare(b.name));
  for (const e of ents) {
    if (SKIP_DIR.has(e.name)) continue;
    const abs = path.join(dir, e.name);
    yield { abs, isDir: e.isDirectory(), depth };
    if (e.isDirectory() && depth > 1) yield* walk(abs, depth - 1);
  }
}

export const listDir: Tool = {
  name: 'list_dir',
  description: 'Liệt kê thư mục trong repo kyta (đường dẫn tương đối gốc repo). depth 1-3.',
  parameters: { type: 'object', properties: { path: { type: 'string' }, depth: { type: 'integer' } }, required: ['path'] },
  async run(a) {
    const { abs, rel } = resolvePath(a.path);
    const depth = Math.min(Math.max(Number(a.depth) || 1, 1), 3);
    const lines: string[] = [];
    for (const e of walk(abs, depth)) {
      const r = path.relative(abs, e.abs).split(path.sep).join('/');
      lines.push(e.isDir ? `${r}/` : `${r}  (${fs.statSync(e.abs).size} B)`);
      if (lines.length >= 400) { lines.push('…(còn nữa — thu hẹp đường dẫn)'); break; }
    }
    return `${rel}/\n` + (lines.join('\n') || '(rỗng)');
  },
};

export const readFile: Tool = {
  name: 'read_file',
  description: 'Đọc file văn bản (có số dòng). offset = dòng bắt đầu (1), limit = số dòng (mặc định 300).',
  parameters: { type: 'object', properties: { path: { type: 'string' }, offset: { type: 'integer' }, limit: { type: 'integer' } }, required: ['path'] },
  async run(a, ctx) {
    const { abs, rel } = resolvePath(a.path);
    const st = fs.statSync(abs);
    if (st.isDirectory()) return `"${rel}" là thư mục — dùng list_dir.`;
    if (st.size > MAX_READ) return `File quá lớn (${st.size} B).`;
    const buf = fs.readFileSync(abs);
    if (isBinary(buf)) return `File nhị phân (${rel}). Với .docx dùng kyta_run ["ewriter","docx","${rel}"].`;
    const all = buf.toString('utf8').split('\n');
    const from = Math.max(Number(a.offset) || 1, 1);
    const n = Math.min(Number(a.limit) || 300, 2000);
    ctx.touched(rel, 'read');
    const body = all.slice(from - 1, from - 1 + n).map((l, i) => `${from + i}\t${l}`).join('\n');
    const more = from - 1 + n < all.length ? `\n…(tổng ${all.length} dòng, đọc tiếp offset=${from + n})` : '';
    return clip(body + more, 24000);
  },
};

export const search: Tool = {
  name: 'search',
  description: 'Tìm regex trong các file văn bản dưới 1 thư mục. Trả "file:dòng: nội dung" (tối đa 60 kết quả).',
  parameters: { type: 'object', properties: { pattern: { type: 'string' }, path: { type: 'string' }, ignoreCase: { type: 'boolean' } }, required: ['pattern'] },
  async run(a) {
    const { abs } = resolvePath(a.path ?? '.');
    const re = new RegExp(String(a.pattern), a.ignoreCase ? 'i' : '');
    const out: string[] = [];
    const files = fs.statSync(abs).isDirectory() ? [...walk(abs, 12)].filter((e) => !e.isDir).map((e) => e.abs) : [abs];
    for (const f of files) {
      if (fs.statSync(f).size > 1024 * 1024) continue;
      const buf = fs.readFileSync(f);
      if (isBinary(buf)) continue;
      const rel = path.relative(resolvePath('.').abs, f).split(path.sep).join('/');
      buf.toString('utf8').split('\n').forEach((line, i) => {
        if (out.length < 60 && re.test(line)) out.push(`${rel}:${i + 1}: ${line.trim().slice(0, 200)}`);
      });
      if (out.length >= 60) break;
    }
    return out.join('\n') || 'Không có kết quả.';
  },
};

const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/gi, 'd').toLowerCase();

export const findLocal: Tool = {
  name: 'find_local',
  description:
    'Tìm form/quy trình/mẫu mail/bản in/danh mục ĐÃ CÓ ở local theo tên (không phân biệt dấu). ' +
    'Trả đường dẫn thư mục trong workspace; dòng có [STAGE] là <form-folder> dùng được cho lệnh eform. ' +
    'customer/env/module để thu hẹp (tuỳ chọn).',
  parameters: {
    type: 'object',
    properties: { name: { type: 'string' }, customer: { type: 'string' }, env: { type: 'string' }, module: { type: 'string' } },
    required: ['name'],
  },
  async run(a) {
    const base = ['workspace', a.customer, a.env, a.module].filter(Boolean).map(String).join('/');
    const { abs } = resolvePath(base);
    if (!fs.existsSync(abs)) return `Không có thư mục ${base}.`;
    const q = norm(String(a.name));
    const out: string[] = [];
    for (const e of walk(abs, 8)) {
      if (!e.isDir || !norm(path.basename(e.abs)).includes(q)) continue;
      const rel = path.relative(resolvePath('.').abs, e.abs).split(path.sep).join('/');
      out.push(`${fs.existsSync(path.join(e.abs, '.meta.json')) ? '[STAGE] ' : ''}${rel}`);
      if (out.length >= 40) break;
    }
    return out.join('\n') || `Không thấy "${a.name}" trong ${base}. Có thể chưa pull — dùng lệnh list của phân hệ để tìm id rồi pull.`;
  },
};

export const writeFile: Tool = {
  name: 'write_file',
  description: 'Ghi (tạo/ghi đè) toàn bộ nội dung 1 file. Chỉ trong thư mục được phép của bạn. Ưu tiên edit_file khi sửa một phần.',
  parameters: { type: 'object', properties: { path: { type: 'string' }, content: { type: 'string' } }, required: ['path', 'content'] },
  async run(a, ctx) {
    const { abs, rel } = resolvePath(a.path);
    assertWritable(ctx.agent, rel);
    if (ctx.taskId && ctx.runId) {
      acquirePathLock(rel, ctx.taskId, ctx.runId, ctx.agent.id);
    }
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    const content = String(a.content ?? '');
    fs.writeFileSync(abs, content);
    ctx.touched(rel, 'write');
    return `Đã ghi ${rel} (${Buffer.byteLength(content)} B).`;
  },
};

export const editFile: Tool = {
  name: 'edit_file',
  description: 'Thay đúng chuỗi old_string bằng new_string trong 1 file (old_string phải duy nhất, trừ khi replace_all=true).',
  parameters: {
    type: 'object',
    properties: { path: { type: 'string' }, old_string: { type: 'string' }, new_string: { type: 'string' }, replace_all: { type: 'boolean' } },
    required: ['path', 'old_string', 'new_string'],
  },
  async run(a, ctx) {
    const { abs, rel } = resolvePath(a.path);
    assertWritable(ctx.agent, rel);
    if (ctx.taskId && ctx.runId) {
      acquirePathLock(rel, ctx.taskId, ctx.runId, ctx.agent.id);
    }
    const src = fs.readFileSync(abs, 'utf8');
    const oldS = String(a.old_string);
    const count = src.split(oldS).length - 1;
    if (count === 0) return `Không tìm thấy old_string trong ${rel} — đọc lại file (read_file) rồi thử lại.`;
    if (count > 1 && !a.replace_all) return `old_string xuất hiện ${count} lần trong ${rel} — thêm ngữ cảnh cho duy nhất hoặc replace_all=true.`;
    const newS = String(a.new_string);
    // replacer dạng hàm: tránh "$&"/"$1" trong code bị hiểu là mẫu thay thế.
    fs.writeFileSync(abs, a.replace_all ? src.split(oldS).join(newS) : src.replace(oldS, () => newS));
    ctx.touched(rel, 'write');
    return `Đã sửa ${rel} (${a.replace_all ? count : 1} chỗ).`;
  },
};
