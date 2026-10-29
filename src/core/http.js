// @ts-check
'use strict';
// HTTP client chung cho mọi phân hệ: timeout, tự đăng nhập lại khi 401, lỗi ngắn gọn.
const session = require('./session');

const TIMEOUT_MS = Number(process.env.KYTA_TIMEOUT_MS) || 60000;
/** @type {Record<number, string>} */
const HINT = {
  401: ' (đăng nhập lại vẫn bị từ chối — kiểm tra tài khoản)',
  403: ' (thiếu quyền hoặc tài nguyên đang khoá, vd form đang mở ở tab modeler)',
};

/**
 * @typedef {import('./session').Session} Session
 * @typedef {{ json?: any, text?: string, form?: FormData, binary?: boolean }} Body
 *   binary: trả Buffer thô (file .docx/.pdf) thay vì JSON/text
 */

/**
 * Gọi API; trả JSON nếu parse được, không thì trả text.
 * @param {Session} sess
 * @param {string} method
 * @param {string} pathname
 * @param {Body} [body]
 * @returns {Promise<any>}
 */
async function request(sess, method, pathname, body = {}, retried = false) {
  /** @type {Record<string, string>} */
  const headers = { Accept: 'application/json, text/plain, */*', ...sess.authHeaders };
  /** @type {any} */ let payload;
  if (body.json !== undefined) { headers['Content-Type'] = 'application/json'; payload = JSON.stringify(body.json); }
  else if (body.text !== undefined) { headers['Content-Type'] = 'text/plain'; payload = body.text; }
  else if (body.form) payload = body.form;   // multipart: fetch tự thêm boundary

  const label = `${method} ${pathname}`;
  let res;
  try {
    res = await fetch(sess.host + pathname, { method, headers, body: payload, signal: AbortSignal.timeout(TIMEOUT_MS) });
  } catch (e) {
    const timeout = e && (e.name === 'TimeoutError' || e.name === 'AbortError');
    throw new Error(`${label} → ${timeout ? `quá hạn ${TIMEOUT_MS / 1000}s` : 'lỗi mạng: ' + e.message}`);
  }
  if (body.binary && res.ok) return Buffer.from(await res.arrayBuffer());
  const text = await res.text();
  if (res.status === 401 && !retried) {
    // Token hết hạn → đăng nhập lại rồi gửi lại đúng 1 lần.
    const fresh = await session.open(sess.customer, sess.env, sess.service, { force: true });
    sess.authHeaders = fresh.authHeaders;
    return request(sess, method, pathname, body, true);
  }
  if (!res.ok) throw new Error(`${label} → HTTP ${res.status}${HINT[res.status] || ''}: ${text.slice(0, 300)}`);
  try { return text ? JSON.parse(text) : null; } catch (_) { return text; }
}

/**
 * Lấy mảng từ response dù server bọc kiểu gì: [..] | {content} | {data:{content}} | {result}.
 * @returns {any[]}
 */
function toList(/** @type {any} */ r) {
  if (Array.isArray(r)) return r;
  if (r && typeof r === 'object') {
    for (const k of ['content', 'data', 'result']) { const v = toList(r[k]); if (v.length) return v; }
  }
  return [];
}

/** Lấy object chứa field `key`, kể cả khi bị bọc trong data/result/content/form. */
function unwrap(/** @type {any} */ r, /** @type {string} */ key) {
  if (!r || typeof r !== 'object' || key in r) return r;
  for (const k of ['data', 'result', 'content', 'form']) if (r[k] && typeof r[k] === 'object' && key in r[k]) return r[k];
  return r;
}

/** Id của bản ghi vừa tạo (server trả {id} hoặc {data:{id}}). */
const idOf = (/** @type {any} */ r) => (r && (r.id || (r.data && r.data.id))) || null;

module.exports = { request, toList, unwrap, idOf };
