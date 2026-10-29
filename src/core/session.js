// @ts-check
'use strict';
// Đăng nhập theo customer@env (host eaccount) và mở phiên gọi API cho từng service.
// Token/cookie cache ở .kyta/token-cache.json, tự đăng nhập lại khi sắp hết hạn.
const path = require('path');
const { CONFIG, STATE } = require('./paths');
const config = require('./config');
const { readJson, writeJson } = require('./fsx');

const CRED_FILE = path.join(CONFIG, 'credentials.local.json');
const CACHE_FILE = path.join(STATE, 'token-cache.json');
const TIMEOUT_MS = Number(process.env.KYTA_TIMEOUT_MS) || 60000;

/**
 * @typedef {'eform'|'eflow'|'ewriter'|'ecatalog'|'eworkspace'|'account'} Service
 * @typedef {{ host: string, authHeaders: Record<string, string>, customer: string, env: string, service: Service }} Session
 * @typedef {{ cookie: string, token: string|null, scheme: string, expiresAt: number, diag: Record<string, any> }} Login
 */

/** Tài khoản của customer@env (hoặc khai chung theo env). Mật khẩu có thể lấy từ biến môi trường. */
function credential(/** @type {string} */ customer, /** @type {string} */ env) {
  const creds = readJson(CRED_FILE, null);
  if (!creds) throw new Error('Thiếu config/credentials.local.json (copy từ credentials.example.json).');
  const c = creds[`${customer}@${env}`] || creds[env];
  if (!c || !c.username) throw new Error(`Chưa có tài khoản "${customer}@${env}" trong credentials.local.json.`);
  const password = c.passwordEnv ? process.env[c.passwordEnv] : c.password;
  if (!password) throw new Error(c.passwordEnv ? `Chưa set biến môi trường ${c.passwordEnv}.` : `Mật khẩu rỗng cho ${customer}@${env}.`);
  return { username: String(c.username), password: String(password) };
}

/** Có khai tài khoản cho customer@env không. */
const hasCredential = (/** @type {string} */ customer, /** @type {string} */ env) => {
  const creds = readJson(CRED_FILE, {});
  return !!(creds[`${customer}@${env}`] || creds[env]);
};

/**
 * Gọi API login. authScheme=auto: có Set-Cookie thì dùng cookie, không thì lấy token trong body.
 * @returns {Promise<Login>}
 */
async function login(/** @type {string} */ loginHost, /** @type {any} */ cfg, /** @type {{username: string, password: string}} */ cred) {
  const url = loginHost + cfg.loginPath;
  const body = JSON.stringify(cfg.bodyTemplate || {}, (_, v) =>
    v === '{{username}}' ? cred.username : v === '{{password}}' ? cred.password : v);
  let res;
  try {
    res = await fetch(url, {
      method: cfg.method || 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json, text/plain, */*' },
      body, signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (e) { throw new Error(`Đăng nhập lỗi mạng (${url}): ${e.message}`); }
  const text = await res.text();
  if (!res.ok) throw new Error(`Đăng nhập thất bại HTTP ${res.status} tại ${url}: ${text.slice(0, 200)}`);

  const setCookies = typeof res.headers.getSetCookie === 'function' ? res.headers.getSetCookie() : [];
  const cookie = setCookies.map(c => c.split(';')[0]).filter(Boolean).join('; ');
  let token = null;
  /** @type {string[]} */ let bodyKeys = [];
  try {
    const j = JSON.parse(text);
    bodyKeys = Object.keys(j || {});
    token = (cfg.tokenBodyKeys || []).map((/** @type {string} */ k) => j[k]).find(Boolean) || null;
  } catch (_) {}
  if (!cookie && !token) throw new Error(`Đăng nhập OK nhưng không có Set-Cookie lẫn token (body keys: ${bodyKeys.join(',') || 'none'}).`);

  let scheme = cfg.authScheme || 'auto';
  if (scheme === 'auto') scheme = cookie ? 'cookie' : 'bearer';
  if (scheme === 'cookie' && !cookie) scheme = 'bearer';
  const expiresAt = (token && jwtExp(token)) || Date.now() + (cfg.defaultTtlMinutes || 30) * 60_000;
  return { cookie, token, scheme, expiresAt, diag: { loginHost, scheme, hasCookie: !!cookie, hasToken: !!token, bodyKeys } };
}

/** Hạn dùng (ms) trong JWT, null nếu không đọc được. */
function jwtExp(/** @type {string} */ token) {
  try {
    const p = JSON.parse(Buffer.from(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8'));
    return p.exp ? p.exp * 1000 : null;
  } catch (_) { return null; }
}

/**
 * @param {Login} s
 * @returns {Record<string, string>}
 */
function toHeaders(s) {
  if (s.scheme === 'bearer' && s.token) return { Authorization: 'Bearer ' + s.token };
  if (s.cookie) return { Cookie: s.cookie };
  return s.token ? { Authorization: 'Bearer ' + s.token } : {};
}

/**
 * Header xác thực cho customer@env — dùng cache nếu còn hạn > 1 phút.
 * @returns {Promise<{ headers: Record<string, string>, diag: Record<string, any>, token: string|null, cookie: string }>}
 */
async function authenticate(/** @type {string} */ customer, /** @type {string} */ env, { force = false } = {}) {
  const loginHost = config.serviceHost(customer, env, 'account');
  if (!loginHost) throw new Error(`Chưa cấu hình host đăng nhập cho ${customer}@${env} (config/kyta.json).`);
  const key = `${customer}@${env}`;
  const cache = readJson(CACHE_FILE, {});
  const hit = cache[key];
  if (!force && hit && hit.diag?.loginHost === loginHost && hit.expiresAt - Date.now() > 60_000) {
    return { headers: toHeaders(hit), diag: hit.diag, token: hit.token || null, cookie: hit.cookie || '' };
  }
  const s = await login(loginHost, config.auth(), credential(customer, env));
  cache[key] = { ...s, savedAt: Date.now() };
  writeJson(CACHE_FILE, cache);
  return { headers: toHeaders(s), diag: s.diag, token: s.token, cookie: s.cookie };
}

/**
 * Mở phiên gọi API cho 1 service của customer@env.
 * @param {string} customer
 * @param {string} env
 * @param {Service} [service]
 * @param {{ force?: boolean }} [opts]
 * @returns {Promise<Session>}
 */
async function open(customer, env, service = 'eform', opts = {}) {
  const host = config.serviceHost(customer, env, service);
  if (!host) throw new Error(`Chưa cấu hình host ${service} cho ${customer}@${env} (config/kyta.json).`);
  const auth = await authenticate(customer, env, opts);
  const headers = { ...auth.headers };
  // eWorkspace tra user bằng Cookie access_token nhưng thêm/xoá dashboard bằng Bearer.
  // Cùng một session cần cung cấp cả hai cách xác thực theo hợp đồng của từng endpoint.
  if (service === 'eworkspace') {
    const cookieToken = /(?:^|;\s*)access_token=([^;]+)/i.exec(auth.cookie || '')?.[1];
    const token = auth.token || cookieToken || /^Bearer\s+(.+)$/i.exec(headers.Authorization || '')?.[1];
    if (token) {
      headers.Authorization = `Bearer ${token}`;
      headers.Cookie = `access_token=${token}`;
    }
  }
  return { host, authHeaders: headers, customer, env, service };
}

module.exports = { CRED_FILE, open, authenticate, hasCredential };
