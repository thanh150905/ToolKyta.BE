// @ts-check
'use strict';
// Runtime giả lập code động eForm (offline) để thử logic main.js trước khi push.
// Hàm runtime theo docs/eform-code-api.md; giá trị field lấy từ fixture, thiếu thì lấy `value` trong fields.json.
// Đồng hồ giả: setTimeout/setInterval chạy theo thời gian ảo, không chờ thật.
// [Unverified] Hành vi runtime thật chưa đối chiếu: changeFieldValue bằng code có bắn bindFieldChangeEvent không
// (mặc định KHÔNG, bật bằng cascade), thời điểm gọi onInitData (giả lập: ngay sau khi nạp code).
const vm = require('vm');

/**
 * @typedef {{ t: number, op: string, field?: string, value?: any, detail?: string }} TraceRow
 * @typedef {{ values?: Record<string, any>, steps?: any[], fetch?: Record<string, { status?: number, json?: any, text?: string }>, time?: number }} Fixture
 */

/** "{{0000x_key}}" / "0000x_key" → "0000x_key". */
const norm = (/** @type {any} */ id) => String(id ?? '').trim().replace(/^\{\{\s*/, '').replace(/\s*\}\}$/, '');

/**
 * Phần tử DOM giả: mọi thuộc tính/lời gọi đều được nhận (trả phần tử giả khác) — code widget/DOM không văng lỗi.
 * @returns {any}
 */
function elementStub() {
  /** @type {Record<string, any>} */ const own = { style: {}, dataset: {}, classList: { add() {}, remove() {}, toggle() {}, contains: () => false }, children: [], childNodes: [], value: '', innerHTML: '', textContent: '' };
  /** @type {any} */ const p = new Proxy(function () {}, {
    get: (_t, k) => (typeof k === 'string' && k in own ? own[k] : k === Symbol.toPrimitive ? () => '' : k === 'then' ? undefined : p),
    set: (_t, k, v) => { own[/** @type {string} */ (k)] = v; return true; },
    apply: () => p,
  });
  return p;
}

/** document giả: không có phần tử nào trên trang (getElementById → null), tạo phần tử thì trả elementStub. */
function domStub() {
  return {
    getElementById: () => null, querySelector: () => null, querySelectorAll: () => [], getElementsByClassName: () => [], getElementsByTagName: () => [],
    createElement: () => elementStub(), createTextNode: () => elementStub(), head: elementStub(), body: elementStub(),
    addEventListener() {}, removeEventListener() {}, dispatchEvent() {},
  };
}

/**
 * @param {{ formId: string|null, fields: import('./fields').FieldEntry[], code: { file: string, text: string }[],
 *   fixture?: Fixture, cascade?: boolean }} opt
 */
function createRuntime(opt) {
  const fx = opt.fixture || {};
  /** @type {TraceRow[]} */ const trace = [];
  let now = 0;
  /** @type {{ id: number, at: number, fn: Function, every: number|null }[]} */ let timers = [];
  let seq = 0;

  // Định danh field: id đầy đủ (ưu tiên) → key ngắn. Key trùng (cha + form con) thì phải dùng id đầy đủ.
  /** @type {Map<string, import('./fields').FieldEntry>} */ const byId = new Map();
  /** @type {Map<string, import('./fields').FieldEntry[]>} */ const byKey = new Map();
  for (const e of opt.fields) {
    if (e.id) byId.set(e.id, e);
    if (e.key) byKey.set(e.key, [...(byKey.get(e.key) || []), e]);
  }
  /** Chuẩn hoá tham chiếu field (id đầy đủ, {{token}} hoặc key ngắn) về 1 khoá ổn định. */
  const keyOf = (/** @type {any} */ ref) => {
    const r = norm(ref);
    if (byId.has(r)) return r;
    const m = r.match(/^0000[0-9A-Za-z]+_(.+)$/);
    const short = m ? m[1] : r;
    const hits = byKey.get(short) || [];
    if (hits.length === 1) return hits[0].id || (opt.formId ? `${opt.formId}_${short}` : r);
    return r;
  };
  const label = (/** @type {string} */ k) => k.replace(/^0000[0-9A-Za-z]+_/, '');

  /** @type {Map<string, any>} */ const values = new Map();
  /** @type {Map<string, Record<string, any>>} */ const props = new Map();
  for (const [k, v] of Object.entries(fx.values || {})) values.set(keyOf(k), v);
  const getValue = (/** @type {string} */ k) => {
    if (values.has(k)) return values.get(k);
    const e = byId.get(k) || (byKey.get(label(k)) || [])[0];
    return e?.config?.value ?? '';
  };

  /** @type {Map<string, Function[]>} */ const onChange = new Map();
  /** @type {Map<string, Function[]>} */ const onAction = new Map();
  const log = (/** @type {string} */ op, /** @type {string|undefined} */ field, /** @type {any} */ value, /** @type {string} */ detail = '') =>
    trace.push({ t: now, op, ...(field !== undefined ? { field: label(field) } : {}), ...(value !== undefined ? { value } : {}), ...(detail ? { detail } : {}) });
  const safe = (/** @type {Function} */ fn, /** @type {string} */ where, /** @type {any[]} */ args = []) => {
    try { const r = fn(...args); if (r && typeof r.catch === 'function') r.catch((/** @type {any} */ e) => log('error', undefined, undefined, `${where}: ${e?.message || e}`)); }
    catch (e) { log('error', undefined, undefined, `${where}: ${e?.message || e}`); }
  };
  const fireChange = (/** @type {string} */ k, /** @type {any} */ v) => { for (const cb of onChange.get(k) || []) safe(cb, `change ${label(k)}`, [v]); };

  const setProp = (/** @type {string} */ k, /** @type {string} */ p, /** @type {any} */ v) => props.set(k, { ...(props.get(k) || {}), [p]: v });
  const api = {
    getFieldValue: (/** @type {any} */ id) => getValue(keyOf(id)),
    getFieldInfo: (/** @type {any} */ id) => { const k = keyOf(id); return { ...(byId.get(k)?.config || {}), ...(props.get(k) || {}) }; },
    changeFieldValue: (/** @type {any} */ id, /** @type {any} */ v) => { const k = keyOf(id); values.set(k, v); log('changeFieldValue', k, v); if (opt.cascade) fireChange(k, v); },
    changeFieldValueRadio: (/** @type {any} */ id, /** @type {any} */ v) => { const k = keyOf(id); values.set(k, v); log('changeFieldValueRadio', k, v); if (opt.cascade) fireChange(k, v); },
    setDisplayField: (/** @type {any} */ id, /** @type {boolean} */ v) => { const k = keyOf(id); setProp(k, 'display', v); log('setDisplayField', k, v); },
    setReadonlyField: (/** @type {any} */ id, /** @type {boolean} */ v) => { const k = keyOf(id); setProp(k, 'readonly', v); log('setReadonlyField', k, v); },
    changeFieldProp: (/** @type {any} */ id, /** @type {string} */ p, /** @type {any} */ v) => { const k = keyOf(id); setProp(k, p, v); log('changeFieldProp', k, v, p); },
    bindFieldChangeEvent: (/** @type {any} */ id, /** @type {Function} */ cb) => { const k = keyOf(id); onChange.set(k, [...(onChange.get(k) || []), cb]); },
    bindFieldAction: (/** @type {string} */ type, /** @type {any} */ id, /** @type {Function} */ cb) => { const k = type + '|' + keyOf(id); onAction.set(k, [...(onAction.get(k) || []), cb]); },
    setLoadingPage: (/** @type {boolean} */ v) => log('setLoadingPage', undefined, v),
    addRowTable: (/** @type {any} */ id, /** @type {number} */ n) => log('addRowTable', keyOf(id), n),
    deleteRowTable: (/** @type {any} */ id, /** @type {number[]} */ rows) => log('deleteRowTable', keyOf(id), rows),
    addTableAdvanceColumns: (/** @type {any} */ id, /** @type {number} */ at, /** @type {number} */ n) => log('addTableAdvanceColumns', keyOf(id), [at, n]),
    removeTableAdvanceColumns: (/** @type {any} */ id, /** @type {number} */ at, /** @type {number} */ n) => log('removeTableAdvanceColumns', keyOf(id), [at, n]),
    openModal: (/** @type {any} */ d) => log('openModal', undefined, d),
    setStyle: (/** @type {any} */ id, /** @type {any} */ v) => log('setStyle', keyOf(id), v),
    showToast: (/** @type {any} */ msg, /** @type {any} */ type) => log('showToast', undefined, msg, String(type ?? '')),
    alert: (/** @type {any} */ msg) => log('alert', undefined, msg),
  };

  const addTimer = (/** @type {Function} */ fn, /** @type {number} */ ms, /** @type {boolean} */ repeat) => {
    const id = ++seq;
    const delay = Math.max(0, Number(ms) || 0);
    timers.push({ id, at: now + delay, fn, every: repeat ? Math.max(1, delay) : null });
    return id;
  };
  const clearTimer = (/** @type {number} */ id) => { timers = timers.filter(t => t.id !== id); };

  /** fetch giả: khớp chuỗi con URL trong fixture.fetch; không khớp → reject (code phải tự xử lý lỗi mạng). */
  const fakeFetch = (/** @type {any} */ url, /** @type {any} */ init) => {
    const u = String(url);
    log('fetch', undefined, u, init?.method || 'GET');
    const hit = Object.entries(fx.fetch || {}).find(([k]) => u.includes(k));
    if (!hit) return Promise.reject(new Error('fetch không có trong fixture: ' + u));
    const r = hit[1];
    const body = r.text ?? JSON.stringify(r.json ?? null);
    return Promise.resolve({ ok: (r.status ?? 200) < 400, status: r.status ?? 200, json: async () => JSON.parse(body), text: async () => body });
  };

  const ctx = vm.createContext({
    ...api,
    fetch: fakeFetch,
    setTimeout: (/** @type {Function} */ fn, /** @type {number} */ ms) => addTimer(fn, ms, false),
    setInterval: (/** @type {Function} */ fn, /** @type {number} */ ms) => addTimer(fn, ms, true),
    clearTimeout: clearTimer, clearInterval: clearTimer,
    console: { log: (/** @type {any[]} */ ...a) => log('console', undefined, a.join(' ')), warn: (/** @type {any[]} */ ...a) => log('console.warn', undefined, a.join(' ')), error: (/** @type {any[]} */ ...a) => log('console.error', undefined, a.join(' ')), info: () => {} },
    CustomEvent: class { constructor(/** @type {string} */ type, /** @type {any} */ init) { this.type = type; this.detail = init?.detail; } },
    btoa: (/** @type {string} */ s) => Buffer.from(String(s), 'binary').toString('base64'),
    atob: (/** @type {string} */ s) => Buffer.from(String(s), 'base64').toString('binary'),
    window: {}, document: domStub(),
  });
  ctx.window = ctx;

  /** Chạy hết microtask (promise) đang chờ. */
  const flush = () => new Promise(r => setImmediate(r));

  /** Tiến đồng hồ ảo `ms`, chạy timer tới hạn theo thứ tự. */
  async function advance(/** @type {number} */ ms) {
    const end = now + ms;
    await flush();
    for (let guard = 0; guard < 100000; guard++) {
      const due = timers.filter(t => t.at <= end).sort((a, b) => a.at - b.at || a.id - b.id)[0];
      if (!due) break;
      now = due.at;
      if (due.every) due.at += due.every; else clearTimer(due.id);
      safe(due.fn, `timer@${now}ms`);
      await flush();
    }
    now = end;
  }

  async function load() {
    for (const c of opt.code) {
      // Quy ước Kyta: main.js "import 'x.js';" các file khác — ở đây file đã nạp theo order nên bỏ dòng import.
      const text = c.text.replace(/^[ \t]*import\s+['"][^'"]+['"];?.*$/gm, '');
      try { vm.runInContext(text, ctx, { filename: c.file, timeout: 5000 }); }
      catch (e) { log('error', undefined, undefined, `${c.file}: ${e?.message || e}`); }
    }
    await flush();
    for (const [k, cbs] of onAction) if (k.startsWith('onInitData|')) for (const cb of cbs) safe(cb, 'onInitData', [{}]);
    await flush();
  }

  /** Chạy 1 bước fixture: { change, value } | { action, field, data } | { wait }. */
  async function step(/** @type {any} */ s) {
    if (s.wait != null) return advance(Number(s.wait));
    if (s.change != null) {
      const k = keyOf(s.change);
      values.set(k, s.value);
      log('▶ user đổi', k, s.value);
      fireChange(k, s.value);
      return flush();
    }
    if (s.action != null) {
      const k = s.action + '|' + keyOf(s.field);
      log('▶ user ' + s.action, keyOf(s.field), s.data);
      for (const cb of onAction.get(k) || []) safe(cb, `${s.action} ${label(keyOf(s.field))}`, [s.data ?? {}]);
      return flush();
    }
    throw new Error('Bước fixture không hiểu: ' + JSON.stringify(s));
  }

  return {
    trace, load, step, advance,
    /** Giá trị field đã bị code đổi (khoá rút gọn). */
    changed: () => Object.fromEntries([...values].filter(([k]) => !(norm(k) in (fx.values || {})) || values.get(k) !== fx.values?.[k]).map(([k, v]) => [label(k), v])),
    props: () => Object.fromEntries([...props].map(([k, v]) => [label(k), v])),
    bindings: () => ({ change: [...onChange.keys()].map(label), action: [...onAction.keys()].map(k => k.split('|')[0] + ' ' + label(k.split('|')[1])) }),
  };
}

module.exports = { createRuntime, norm };
