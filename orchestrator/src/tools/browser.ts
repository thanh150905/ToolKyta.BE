import path from 'node:path';
import { chromium, type BrowserContext, type Page } from 'playwright-core';
import { config } from '../config.js';
import { bus } from '../bus.js';
import { clip, type Tool } from './types.js';

/**
 * Trình duyệt dùng chung cho Recon: Google Chrome thật (headed) với profile riêng ở data/browser-profile.
 * Người dùng TỰ đăng nhập 1 lần trong cửa sổ này; Recon chỉ mở trang + đọc network (XHR/fetch) qua CDP —
 * bắt được cả request app gọi bằng tham chiếu fetch giữ sẵn (điều mà recorder inject sau-load bỏ sót).
 */
interface NetEntry { method: string; url: string; status: number; reqBody: string; resBody: string; ts: number }

let ctxP: Promise<BrowserContext> | null = null;
let page: Page | null = null;
const net: NetEntry[] = [];

const PROD_HOST = /(^|\.)kyta\.fpt\.com$|^(eform|eaccount|erequest)\.sabeco-app\.vn$/i;
const ALLOWED_HOST = /kytaplatform\.com$|kyta\.fpt\.com$|sabeco-app\.vn$|^10\.\d+\.\d+\.\d+$|^localhost$/i;

export function browserState() {
  return { open: !!ctxP, url: page?.url() ?? null, captured: net.length };
}

async function context(): Promise<BrowserContext> {
  if (!ctxP) {
    ctxP = chromium.launchPersistentContext(path.join(config.dataDir, 'browser-profile'), {
      channel: 'chrome', headless: false, viewport: null,
    }).then((c) => {
      c.on('requestfinished', async (req) => {
        const t = req.resourceType();
        if (t !== 'xhr' && t !== 'fetch') return;
        let resBody = '';
        const res = await req.response().catch(() => null);
        try {
          const ct = res?.headers()['content-type'] ?? '';
          if (/json|text/.test(ct)) resBody = (await res!.text()).slice(0, 4000);
        } catch { /* body đã bị giải phóng */ }
        net.push({ method: req.method(), url: req.url(), status: res?.status() ?? 0, reqBody: (req.postData() ?? '').slice(0, 2000), resBody, ts: Date.now() });
        if (net.length > 400) net.shift();
      });
      c.on('close', () => { ctxP = null; page = null; bus.emitEvt({ type: 'browser', ...browserState() }); });
      return c;
    }).catch((e: Error) => {
      ctxP = null;   // lần sau thử mở lại, không kẹt ở promise hỏng
      throw new Error(`Không mở được Chrome (${e.message.split('\n')[0]}). Kiểm tra đã cài Google Chrome và không có cửa sổ khác đang dùng profile data/browser-profile.`);
    });
  }
  return ctxP;
}

/** Mở cửa sổ cho người đăng nhập (nút Browser trên dashboard). */
export async function openBrowser(url?: string): Promise<void> {
  const c = await context();
  page = page && !page.isClosed() ? page : (c.pages()[0] ?? (await c.newPage()));
  if (url) await page.goto(url, { waitUntil: 'domcontentloaded' }).catch(() => undefined);
  bus.emitEvt({ type: 'browser', ...browserState() });
}

export const browserOpen: Tool = {
  name: 'browser_open',
  description:
    'Mở 1 URL của nền tảng trong trình duyệt dùng chung (đã/ sẽ được người dùng đăng nhập). Trả tiêu đề + chữ trên trang. ' +
    'Nếu thấy trang đăng nhập → ask_human nhờ người đăng nhập rồi mở lại.',
  parameters: { type: 'object', properties: { url: { type: 'string' } }, required: ['url'] },
  async run(a, ctx) {
    const url = new URL(String(a.url));
    if (!ALLOWED_HOST.test(url.hostname)) return `Host không được phép: ${url.hostname}`;
    if (PROD_HOST.test(url.hostname) && !(await ctx.approve(`Mở trang PROD: ${url.href}`, 'Trình duyệt sẽ truy cập môi trường thật.')))
      return 'Người dùng từ chối mở PROD.';
    await openBrowser(url.href);
    if (!page) return 'Không mở được trang.';
    await page.waitForTimeout(1500);
    const text = await page!.evaluate(() => document.body?.innerText ?? '').catch(() => '');
    return clip(`URL: ${page!.url()}\nTiêu đề: ${await page!.title()}\n---\n${text}`, 5000);
  },
};

import { sanitize } from '../sanitize.js';

export const browserNetwork: Tool = {
  name: 'browser_network',
  description:
    'Đọc các request XHR/fetch trình duyệt đã bắt (kể từ lần clear trước): method, status, URL, body gửi, body nhận. ' +
    'filter = chuỗi con của URL. clear=true để xoá bộ đệm sau khi đọc. Quy trình cào: clear → ask_human nhờ người thao tác trên UI → đọc lại.',
  parameters: { type: 'object', properties: { filter: { type: 'string' }, clear: { type: 'boolean' }, limit: { type: 'integer' } } },
  async run(a) {
    const f = String(a.filter ?? '');
    const list = net.filter((e) => !f || e.url.includes(f)).slice(-(Number(a.limit) || 30));
    if (a.clear) net.length = 0;
    if (!list.length) return ctxP ? 'Chưa bắt được request nào.' : 'Trình duyệt chưa mở — dùng browser_open trước.';
    const raw = list.map((e) =>
      `### ${e.method} ${e.status} ${e.url}` +
      (e.reqBody ? `\nREQ: ${e.reqBody}` : '') + (e.resBody ? `\nRES: ${e.resBody}` : '')).join('\n\n');
    return clip(sanitize(raw), 20000);
  },
};

