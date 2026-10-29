// @ts-check
'use strict';
// Đọc file HAR (DevTools → Network → Export HAR) của 1 thao tác trên UI Kyta → liệt kê theo thứ tự mọi request GHI
// (POST/PUT/PATCH/DELETE vào /services/). Dùng để biết UI thực sự gọi những gì trước khi cho tool ghi thay UI.
// KHÔNG in header/cookie; trường token/password trong body bị che. File HAR chứa token thật — đừng để trong repo.
const fs = require('fs');
const path = require('path');
const { parseArgs, usage } = require('../core/args');
const { writeJson } = require('../core/fsx');

const USAGE = 'kyta har <file.har> [--all] [--grep "chuỗi"] [--body] [--out cleaned.json]\n'
  + '    --all: cả GET   --body: in nguyên body   --out: ghi danh sách đã làm sạch (không header) ra JSON';

const SECRET = /token|password|secret|authorization|cookie/i;

/**
 * Che giá trị nhạy cảm trong body JSON (đệ quy).
 * @param {any} v
 * @returns {any}
 */
function redact(v) {
  if (Array.isArray(v)) return v.map(redact);
  if (v && typeof v === 'object') {
    /** @type {Record<string, any>} */ const o = {};
    for (const [k, x] of Object.entries(v)) o[k] = SECRET.test(k) ? '***' : redact(x);
    return o;
  }
  return v;
}

/** Body request: JSON đã parse (che token) | {multipart field: giá trị} | text. Field multipart là JSON-string thì parse luôn. */
function bodyOf(/** @type {any} */ req) {
  const pd = req.postData;
  if (!pd) return null;
  const tryJson = (/** @type {string} */ s) => { try { return redact(JSON.parse(s)); } catch (_) { return s; } };
  if (Array.isArray(pd.params) && pd.params.length) {
    return Object.fromEntries(pd.params.map((/** @type {any} */ p) => [p.name, p.fileName ? `<file ${p.fileName}>` : tryJson(p.value ?? '')]));
  }
  return typeof pd.text === 'string' && pd.text ? tryJson(pd.text) : null;
}

/** Tóm tắt 1 body: các key cấp 1 (+ độ dài mảng). */
function brief(/** @type {any} */ b) {
  if (b == null) return '';
  if (typeof b !== 'object') return String(b).slice(0, 120);
  if (Array.isArray(b)) return `[${b.length} phần tử]`;
  return '{' + Object.entries(b).map(([k, v]) => (Array.isArray(v) ? `${k}[${v.length}]` : k)).join(', ') + '}';
}

function run(/** @type {string[]} */ argv) {
  const { _, flags, opts } = parseArgs(argv, { value: ['--grep', '--out'] });
  if (!_[0]) usage(USAGE);
  const har = JSON.parse(fs.readFileSync(path.resolve(_[0]), 'utf8'));
  const entries = /** @type {any[]} */ (har?.log?.entries || []);
  const grep = String(opts['--grep'] || '').toLowerCase();

  const rows = entries
    .filter(e => /\/services\//.test(e.request?.url || ''))
    .filter(e => flags.has('--all') || e.request.method !== 'GET')
    .map(e => {
      const u = new URL(e.request.url);
      return {
        at: e.startedDateTime, method: e.request.method, host: u.host, path: u.pathname + u.search,
        status: e.response?.status, body: bodyOf(e.request),
      };
    })
    .filter(r => !grep || (r.path + JSON.stringify(r.body)).toLowerCase().includes(grep));

  console.log(`${rows.length} request${flags.has('--all') ? '' : ' GHI'} trong ${_[0]} (theo thứ tự):\n`);
  rows.forEach((r, i) => {
    console.log(`${String(i + 1).padStart(3)}. ${r.method.padEnd(6)} ${r.status ?? '?'}  ${r.path}   [${r.host}]`);
    if (r.body != null) console.log(flags.has('--body') ? JSON.stringify(r.body, null, 2).replace(/^/gm, '       ') : `       ${brief(r.body)}`);
  });
  if (opts['--out']) { writeJson(path.resolve(opts['--out']), rows); console.log(`\n→ ${opts['--out']}`); }
}

module.exports = { run, usage: USAGE, bodyOf, redact };
