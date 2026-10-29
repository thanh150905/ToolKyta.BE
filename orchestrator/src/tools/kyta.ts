import { randomUUID } from 'node:crypto';
import { runKyta } from '../kyta/cli.js';
import { platformGet, SERVICES } from '../kyta/platform.js';
import { inspectCommand, type CommandInspection, type CommandTarget } from '../kyta/catalog.js';
import { assertWritable, clip, resolvePath, type Tool } from './types.js';
import { acquirePathLock } from './lock.js';

// ── Quản lý Dry-Run Receipt ──
export interface DryRunReceipt {
  id: string;
  signature: string;
  customer: string;
  env: string;
  resource: string;
  outputSummary: string;
  createdAt: number;
  used: boolean;
}

const receipts = new Map<string, DryRunReceipt>();
const RECEIPT_TTL_MS = 5 * 60 * 1000; // Hết hạn sau 5 phút

export function makeSignature(args: string[]): string {
  return args
    .filter((a) => a !== '--dry-run' && a !== '--yes-prod')
    .map((s) => s.trim())
    .join(' ');
}

export function createReceipt(args: string[], target: CommandTarget, output: string): DryRunReceipt {
  const sig = makeSignature(args);
  const receipt: DryRunReceipt = {
    id: randomUUID().slice(0, 8),
    signature: sig,
    customer: target.customer ?? 'unknown',
    env: target.env ?? 'unknown',
    resource: target.resource ?? 'unknown',
    outputSummary: output.slice(0, 2000),
    createdAt: Date.now(),
    used: false,
  };
  receipts.set(sig, receipt);
  return receipt;
}

export function findValidReceipt(args: string[], target: CommandTarget): DryRunReceipt | null {
  const sig = makeSignature(args);
  const r = receipts.get(sig);
  if (!r) return null;
  if (r.used) return null;
  if (Date.now() - r.createdAt > RECEIPT_TTL_MS) {
    receipts.delete(sig);
    return null;
  }
  if (target.customer && r.customer !== 'unknown' && r.customer !== target.customer) return null;
  if (target.env && r.env !== 'unknown' && r.env !== target.env) return null;
  return r;
}

export function markReceiptUsed(args: string[]): void {
  const sig = makeSignature(args);
  const r = receipts.get(sig);
  if (r) r.used = true;
}

export function clearReceipts(): void {
  receipts.clear();
}

/** Phân loại lệnh Kyta dựa trên Single Source of Truth inspectCommand */
export function classify(args: string[]): 'read' | 'write' {
  const insp = inspectCommand(args);
  if (!insp.valid) return 'write'; // Lệnh lạ mặc định xử lý như ghi để chặn
  return insp.impacts.includes('server_write') ? 'write' : 'read';
}

export const kytaRun: Tool = {
  name: 'kyta_run',
  description:
    'Chạy kyta-cli: args là MẢNG tham số, vd ["eform","list","saigoncoop","sandbox","--grep","thầu"]. ' +
    'Gọi ["eform"] (chỉ tên phân hệ) để xem cú pháp đầy đủ. Lệnh GHI server luôn chạy --dry-run trước; ' +
    'chạy thật (không --dry-run) sẽ tự hỏi người duyệt sau khi dry-run đạt. Không bao giờ tự thêm --yes-prod.',
  parameters: { type: 'object', properties: { args: { type: 'array', items: { type: 'string' } } }, required: ['args'] },
  async run(a, ctx) {
    let args = (Array.isArray(a.args) ? a.args : []).map(String);
    if (!args.length) return 'Thiếu args.';
    if (args[0] === 'login') return 'Không được chạy "login" — tài khoản do người quản lý.';
    args = args.filter((x) => x !== '--yes-prod'); // cờ prod chỉ orchestrator thêm sau khi người duyệt

    // 1. Kiểm tra danh mục lệnh tường minh (Single Source of Truth)
    const insp: CommandInspection = inspectCommand(args);
    if (!insp.valid) {
      return `LỖI BẢO MẬT: ${insp.error || `Lệnh không được công nhận: "kyta ${args.join(' ')}"`}`;
    }

    const target = insp.target ?? {};
    const isServerWrite = insp.impacts.includes('server_write');
    const isLocalWrite = insp.impacts.includes('local_write');
    const dry = args.includes('--dry-run');

    // 2. Kiểm tra quyền ghi local (Scope & Symlink)
    if (isLocalWrite) {
      // Kiểm tra các đường dẫn local ghi dự kiến
      if (target.localWritePaths?.length) {
        for (const lp of target.localWritePaths) {
          const { rel } = resolvePath(lp);
          assertWritable(ctx.agent, rel);
          if (ctx.taskId && ctx.runId) {
            acquirePathLock(rel, ctx.taskId, ctx.runId, ctx.agent.id);
          }
        }
      }
      // Kiểm tra tham số --into nếu là đường dẫn
      const intoIdx = args.indexOf('--into');
      if (intoIdx >= 0 && args[intoIdx + 1]) {
        const intoVal = args[intoIdx + 1];
        if (intoVal.includes('/') || intoVal.includes('\\') || intoVal.startsWith('.')) {
          const { rel } = resolvePath(intoVal);
          assertWritable(ctx.agent, rel);
          if (ctx.taskId && ctx.runId) {
            acquirePathLock(rel, ctx.taskId, ctx.runId, ctx.agent.id);
          }
        }
      }
    }

    // 3. Xử lý lệnh ghi Server
    if (isServerWrite) {
      // 3.1. Chặn agent chỉ đọc
      if (ctx.agent.kyta !== 'write') {
        return `TỪ CHỐI: ${ctx.agent.name} chỉ có quyền ĐỌC (kyta: read). Không được chạy lệnh ghi server "kyta ${args.join(' ')}".`;
      }

      // 3.2. Chạy DRY-RUN
      if (dry) {
        const r = await runKyta(args, 180_000, ctx.signal);
        if (r.ok) {
          const receipt = createReceipt(args, target, r.out);
          return clip(
            `$ kyta ${args.join(' ')}\n(exit ${r.code})\n${r.out}\n\n` +
            `[DRY-RUN THÀNH CÔNG] Đã cấp biên nhận dry-run (ID: ${receipt.id}). ` +
            `Để áp dụng thật, hãy chạy lại đúng lệnh này và bỏ cờ --dry-run để gửi yêu cầu phê duyệt.`,
            14000,
          );
        }
        return clip(`$ kyta ${args.join(' ')}\n(exit ${r.code})\n${r.out}`, 14000);
      }

      // 3.3. Chạy THẬT (không có --dry-run)
      // Điều kiện 1: Kill switch ALLOW_REAL_PUSH
      if (process.env.ALLOW_REAL_PUSH !== '1') {
        return (
          'TỪ CHỐI: Thao tác ghi server thật bị chặn bởi kill switch (ALLOW_REAL_PUSH=0). ' +
          'Mặc định hệ thống chỉ cho phép chạy --dry-run. Cần đặt ALLOW_REAL_PUSH=1 trong cấu hình để cho phép chạy thật.'
        );
      }

      // Điều kiện 2: Phải có Dry-Run Receipt hợp lệ, chưa dùng và chưa hết hạn
      const receipt = findValidReceipt(args, target);
      if (!receipt) {
        return (
          'TỪ CHỐI: Chưa có kết quả dry-run thành công cho lệnh này (hoặc dry-run đã hết hạn / đã được dùng). ' +
          'Quy tắc an toàn bắt buộc: Bạn phải chạy lệnh với cờ --dry-run thành công trước khi gửi lệnh chạy thật.'
        );
      }

      // Điều kiện 3: Người dùng phê duyệt thao tác cụ thể
      const prod = !!target.isProd;
      const dangerousFlags: string[] = [];
      if (target.hasForce) dangerousFlags.push('--force');
      if (target.hasYes) dangerousFlags.push('--yes');
      if (prod) dangerousFlags.push('--yes-prod');

      const title = `Lệnh GHI SERVER${prod ? ' [PROD]' : ''}: kyta ${args.join(' ')}`;
      const detail = [
        `Tài nguyên: ${target.resource || '(mặc định)'}`,
        `Môi trường: ${target.customer || 'mặc định'}/${target.env || 'mặc định'}${prod ? ' ⚠ CẢNH BÁO MÔI TRƯỜNG PROD!' : ''}`,
        dangerousFlags.length ? `Cờ cảnh báo nguy hiểm: ${dangerousFlags.join(', ')}` : '',
        `Tóm tắt kết quả dry-run trước đó:\n${receipt.outputSummary.slice(0, 1000)}`,
      ]
        .filter(Boolean)
        .join('\n');

      const approved = await ctx.approve(title, detail);
      markReceiptUsed(args); // Biên nhận chỉ dùng 1 lần

      if (!approved) {
        return 'Người dùng TỪ CHỐI phê duyệt lệnh này. Thao tác đã bị hủy bỏ an toàn, không có thay đổi nào trên server.';
      }

      if (prod && !args.includes('--yes-prod')) {
        args.push('--yes-prod');
      }
    }

    const r = await runKyta(args, 180_000, ctx.signal);
    return clip(`$ kyta ${args.join(' ')}\n(exit ${r.code})\n${r.out}`, 14000);
  },
};

export const platformGetTool: Tool = {
  name: 'platform_get',
  description:
    `GET (chỉ đọc) 1 endpoint của nền tảng bằng phiên đăng nhập kyta. service: ${SERVICES.join('|')}. ` +
    'path gồm cả prefix, vd "/services/ecategory/api/categories?page=0&size=5". Dùng để dò/khẳng định cấu trúc API.',
  parameters: {
    type: 'object',
    properties: { customer: { type: 'string' }, env: { type: 'string' }, service: { type: 'string' }, path: { type: 'string' } },
    required: ['customer', 'env', 'service', 'path'],
  },
  async run(a, ctx) {
    const env = String(a.env);
    if (env.toLowerCase() === 'prod' && !(await ctx.approve(`Đọc API PROD: ${a.service} ${a.path}`, 'Truy vấn dữ liệu thật trên PROD.')))
      return 'Người dùng từ chối đọc PROD.';
    const data = await platformGet(String(a.customer), env, String(a.service), String(a.path));
    return clip(typeof data === 'string' ? data : JSON.stringify(data, null, 1), 16000);
  },
};
