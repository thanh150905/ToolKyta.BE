// @ts-check
'use strict';
// Form con (child_form): form update nhúng BẢN SAO field của form start vào child_form.components.
// Sửa form start KHÔNG tự cập nhật vào bản sao này — trên UI phải "chọn lại form start". Lệnh refresh
// làm đúng việc đó bằng code: copy lại page.components mới nhất của form start vào child_form.components.
//   childform list    <form>            — liệt kê child_form + có lệch (cũ) so với form start không
//   childform refresh <form>            — đồng bộ bản sao từ form start mới nhất (thay cho "chọn lại")
// Refresh GIỮ những gì form cha chỉnh riêng trên bản nhúng (khớp field theo id): hashid (kế thừa eFlow/eWriter
// trỏ vào đó), readonly/disabled theo bước duyệt, + thuộc tính khai ở --keep. Field sẽ biến mất → chặn.
// Refresh cũng đồng bộ điều kiện ẩn/hiện nhúng: childFormConfig.childFormCondition_value = jsonFormCondition của
// form con (cùng định dạng, fieldIds mang prefix form con). Thiếu bước này thì form cha giữ điều kiện cũ.
// Chỉnh riêng cố định của 1 form cha khai ở <form-cha>/embed.overrides.json (dùng chung với `eform propagate`):
//   { "<childFormId>": { "keep": ["value"], "set": { "<id field>": { "value": "OK", "readonly": true } },
//                        "keepCondition": true } }   ← keepCondition: giữ điều kiện nhúng riêng của form cha
const path = require('path');
const api = require('../api');
const tree = require('../tree');
const formDef = require('../formDef');
const inspect = require('../inspect');
const store = require('../../core/store');
const { parseArgs, usage } = require('../../core/args');
const { hash } = require('../../core/fsx');
const { elementKeyOf } = require('../formId');
const { readJson } = require('../../core/fsx');
const { assertFieldsClean, resyncLocal } = require('./field');

const OVERRIDES_FILE = 'embed.overrides.json';

const USAGE = [
  'kyta eform childform list    <form-folder>',
  'kyta eform childform refresh <form-folder> [--keep value,display,...] [--dry-run] [--force] [--yes-prod]',
  '',
  'refresh: copy lại field mới nhất của form start vào child_form (thay cho thao tác "chọn lại form start" trên UI).',
  '  Luôn giữ của bản nhúng: hashid, readonly, disabled (khớp field theo id). --keep giữ thêm thuộc tính khác.',
  '  Chặn nếu bản nhúng có field mà form start không còn (form cha drift) — --force để vẫn bỏ.',
  '  Đồng bộ cả điều kiện ẩn/hiện nhúng (childFormCondition_value) theo jsonFormCondition của form start.',
  '  Chỉnh riêng cố định của form cha: <form-cha>/embed.overrides.json',
  '    { "<childFormId>": { "keep": ["value"], "set": { "<id field>": { "value": "OK" } }, "keepCondition": true } }',
].join('\n');

/** Mở form + rào chắn (như field ops). */
async function openForm(/** @type {string} */ target, /** @type {Set<string>} */ flags) {
  const dir = path.resolve(target);
  if (!tree.isForm(dir)) throw new Error('Không phải form folder: ' + target);
  const st = inspect.listStates(dir).find(s => s.dir === dir) || inspect.formState(dir);
  const level = inspect.LEVEL[st.guard];
  if (level === 'error' || level === 'block') throw new Error(st.why + ' Dừng.');
  if (!st.formId) throw new Error('Không xác định được formId đích.');
  if (st.env === 'prod' && !flags.has('--yes-prod')) throw new Error('Đích là PROD — thêm --yes-prod để xác nhận.');
  assertFieldsClean(st, flags);
  const sess = await api.open(st.customer, st.env);
  const form = await api.getForm(sess, st.formId);
  const { def, wasString } = formDef.parseFormDef(form);
  if (!def) throw new Error('Form trên server không có jsonForm.');
  return { dir, st, sess, form, def, wasString, dryRun: flags.has('--dry-run') };
}

/**
 * Mảng luật điều kiện từ jsonFormCondition / childFormCondition_value (chuỗi JSON hoặc mảng).
 * null/rỗng → []; không parse được → null (không rõ, đừng ghi đè).
 * @returns {any[]|null}
 */
function parseRules(/** @type {any} */ v) {
  if (v == null || v === '') return [];
  if (Array.isArray(v)) return v;
  if (typeof v !== 'string') return null;
  try { const r = JSON.parse(v); return Array.isArray(r) ? r : null; } catch (_) { return null; }
}

/**
 * Phần form start cần cho refresh: nội dung field + điều kiện ẩn/hiện. Thuần.
 * rules/raw = null khi GET không có jsonFormCondition hoặc hỏng → refresh không đụng điều kiện nhúng.
 * @param {any} form bản GET /owner/form của form start
 * @returns {{ components: any[], rules: any[]|null, raw: string|null }}
 */
function startFromForm(form) {
  const { def } = formDef.parseFormDef(form);
  const components = def ? formDef.contentComponents(def) : [];
  if (!form || !('jsonFormCondition' in form)) return { components, rules: null, raw: null };
  const rules = parseRules(form.jsonFormCondition);
  // Giữ nguyên chuỗi gốc của form con (đúng định dạng platform lưu), chỉ dựng lại khi server trả mảng.
  const raw = rules == null ? null : typeof form.jsonFormCondition === 'string' && form.jsonFormCondition ? form.jsonFormCondition : JSON.stringify(rules);
  return { components, rules, raw };
}

/** @type {Map<string, Promise<ReturnType<typeof startFromForm>>>} */ const startCache = new Map();

/** Form start mới nhất (cache theo host + formId trong 1 tiến trình). */
function loadStart(/** @type {any} */ sess, /** @type {string} */ id) {
  const k = sess.host + '|' + id;
  let p = startCache.get(k);
  if (!p) {
    p = api.getForm(sess, id).then(startFromForm);
    startCache.set(k, p);
  }
  return p;
}

/**
 * Kế hoạch đồng bộ điều kiện nhúng của 1 child_form. So theo NGỮ NGHĨA (parse 2 bên) → không ghi lại khi chỉ khác
 * định dạng chuỗi. Thuần.
 * @param {any} cf node child_form
 * @param {{ rules: any[]|null, raw: string|null }} start
 * @param {boolean} [keepCondition]
 * @returns {{ change: boolean, next: string|null, before: number|null, after: number|null, note: string|null }}
 */
function planCondition(cf, start, keepCondition = false) {
  const cur = parseRules(cf.childFormConfig?.childFormCondition_value);
  const before = cur ? cur.length : null;
  if (start.rules == null) return { change: false, next: null, before, after: null, note: 'form start không trả jsonFormCondition — giữ điều kiện nhúng' };
  const after = start.rules.length;
  if (cur && JSON.stringify(cur) === JSON.stringify(start.rules)) return { change: false, next: null, before, after, note: null };
  if (keepCondition) return { change: false, next: null, before, after, note: `${OVERRIDES_FILE} keepCondition — giữ điều kiện nhúng riêng (${before ?? '?'} luật, form start ${after})` };
  return { change: true, next: start.raw, before, after, note: null };
}

/**
 * Chỉnh riêng cố định của form cha cho từng form con nhúng.
 * @returns {Record<string, { keep?: string[], set?: Record<string, Record<string, any>>, keepCondition?: boolean }>}
 */
const readOverrides = (/** @type {string} */ dir) => readJson(path.join(dir, OVERRIDES_FILE), {}) || {};

const brief = (/** @type {string[]} */ a, n = 8) => a.slice(0, n).join(', ') + (a.length > n ? '…' : '');

/**
 * Refresh các child_form của 1 form cha (tất cả, hoặc chỉ những cái trỏ tới childId). Không ném lỗi khi bị chặn
 * vì drift — trả blocked để lệnh gọi (refresh 1 form / propagate nhiều form) tự quyết.
 * @param {string} target thư mục form cha
 * @param {{ flags: Set<string>, keep?: string[], childId?: string|null }} opt
 * @returns {Promise<{ changed: number, blocked: number, unchanged: number }>}
 */
async function refreshParent(target, { flags, keep = [], childId = null }) {
  const { dir, st, sess, form, def, wasString, dryRun } = await openForm(target, flags);
  const overrides = readOverrides(dir);
  const cfs = formDef.collectByType(def, 'child_form').filter(cf => !childId || cf.childFormConfig?.childFormId === childId);
  if (!cfs.length) { console.log('  Form không có child_form' + (childId ? ` trỏ tới ${childId}.` : '.')); return { changed: 0, blocked: 0, unchanged: 0 }; }

  let changed = 0, blocked = 0, unchanged = 0;
  for (const cf of cfs) {
    const name = cf.label || cf.hashid;
    const cid = cf.childFormConfig?.childFormId;
    if (!cid) { console.log(`  ⚠ ${name}: chưa chọn form start — bỏ qua.`); continue; }
    const ov = overrides[cid] || {};
    const start = await loadStart(sess, cid);
    const plan = planRefresh(cf.components || [], start.components, [...keep, ...(ov.keep || [])], ov.set || {});
    const cond = planCondition(cf, start, !!ov.keepCondition);
    const fieldsSame = hash(JSON.stringify(cf.components || [])) === hash(JSON.stringify(plan.next));
    if (fieldsSame && !cond.change) {
      console.log(`  ${name}: đã khớp form start ${cid}.${cond.note ? ' (' + cond.note + ')' : ''}`);
      unchanged++;
      continue;
    }
    console.log(`  ${name}: cập nhật từ start ${cid}${dryRun ? '   [DRY-RUN]' : ''}`);
    if (!fieldsSame) console.log(`    field: ${(cf.components || []).length} → ${plan.next.length} node`);
    if (cond.change) console.log(`    điều kiện ẩn/hiện nhúng: ${cond.before ?? 'hỏng'} → ${cond.after} luật`);
    else if (cond.note) console.log(`    ℹ ${cond.note}`);
    if (plan.keptHash.length) console.log(`    giữ hashid bản nhúng (${plan.keptHash.length}): ${brief(plan.keptHash)}`);
    if (plan.kept.length) console.log(`    giữ cấu hình bản nhúng (${plan.kept.length}): ${brief(plan.kept)}`);
    if (plan.missingSet.length) console.log(`    ⚠ ${OVERRIDES_FILE} trỏ field không còn: ${plan.missingSet.join(', ')}`);
    if (plan.diffs.length) console.log(`    ⚠ sẽ đổi theo form start (${plan.diffs.length}): ${brief(plan.diffs, 10)} — giữ bằng --keep hoặc ${OVERRIDES_FILE}.`);
    if (plan.removed.length) {
      console.log(`    ⚠ bản nhúng có ${plan.removed.length} field form start không còn → sẽ MẤT: ${plan.removed.join(', ')}`);
      if (!flags.has('--force')) { console.log('    → CHẶN (form cha drift khỏi form con). Đồng bộ lại form con trước, hoặc --force.'); blocked++; continue; }
    }
    applyRefresh(cf, plan, cond);
    changed++;
  }
  if (!changed || dryRun || blocked) {
    if (blocked && !dryRun && changed) console.log('  → có child_form bị chặn nên KHÔNG lưu form này.');
    return { changed: blocked ? 0 : changed, blocked, unchanged };
  }
  await api.putForm(sess, formDef.buildOwnerFormPayload(form, def, wasString));
  console.log(`  ✓ đã lưu (${changed} child_form).`);
  await resyncLocal(dir, st, sess);
  store.audit({ op: 'childform-refresh', formId: st.formId, customer: st.customer, env: st.env, count: changed, childId });
  return { changed, blocked, unchanged };
}

async function run(/** @type {string[]} */ argv) {
  const sub = argv[0];
  const { _, flags, opts } = parseArgs(argv.slice(1), { value: ['--keep'] });
  const target = _[0];
  if (!sub || !['list', 'refresh'].includes(sub) || !target) usage(USAGE);

  if (sub === 'refresh') {
    const keep = String(opts['--keep'] || '').split(',').map(x => x.trim()).filter(Boolean);
    const r = await refreshParent(target, { flags, keep });
    if (r.blocked && !flags.has('--dry-run')) throw new Error(`${r.blocked} child_form bị chặn — không lưu gì.`);
    if (flags.has('--dry-run')) return console.log('\n[DRY-RUN] Không gửi gì lên server.');
    return console.log(r.changed ? '\n✓ Refresh xong.' : '\n✓ Tất cả child_form đã khớp — không cần gì.');
  }

  // list
  const { st, sess, def, dir } = await openForm(target, new Set([...flags, '--dry-run']));
  const overrides = readOverrides(dir);
  const cfs = formDef.collectByType(def, 'child_form');
  if (!cfs.length) { console.log('Form không có field form con (child_form).'); return; }
  console.log(`${cfs.length} child_form trong ${st.formId} (${st.customer}/${st.env}):\n`);
  for (const cf of cfs) {
    const cid = cf.childFormConfig?.childFormId;
    const cur = cf.components || [];
    let flag = '?';
    if (cid) {
      const ov = overrides[cid] || {};
      const start = await loadStart(sess, cid);
      const plan = planRefresh(cur, start.components, ov.keep || [], ov.set || {});
      const cond = planCondition(cf, start, !!ov.keepCondition);
      const same = hash(JSON.stringify(cur)) === hash(JSON.stringify(plan.next));
      flag = same && !cond.change ? 'khớp'
        : plan.removed.length ? `CŨ + DRIFT (${plan.removed.length} field form start không còn)`
        : same ? `điều kiện nhúng CŨ (${cond.before ?? 'hỏng'} → ${cond.after} luật)` : 'CŨ (cần refresh)';
    }
    console.log(`  ${cf.label || cf.hashid}  → start ${cid || '—'}  | ${cur.length} field  | ${flag}`);
  }
}

/**
 * Ghi kế hoạch vào node child_form: components mới + điều kiện nhúng (nếu đổi). Giữ mọi khoá khác của childFormConfig.
 * @param {any} cf
 * @param {{ next: any[] }} plan
 * @param {{ change: boolean, next: string|null }} cond
 */
function applyRefresh(cf, plan, cond) {
  cf.components = plan.next;
  if (cond.change) cf.childFormConfig = { ...(cf.childFormConfig || {}), childFormCondition_value: cond.next };
}

const LOCK_PROPS = ['readonly', 'disabled'];

/**
 * Dựng components mới cho child_form từ form start, giữ phần form cha chỉnh riêng. Thuần (không gọi mạng).
 * @param {any[]} cur components bản nhúng hiện tại
 * @param {any[]} latest content components form start mới nhất
 * @param {string[]} [keep] thuộc tính giữ thêm (ngoài hashid/readonly/disabled)
 * @param {Record<string, Record<string, any>>} [set] ép giá trị theo id field (embed.overrides.json)
 */
function planRefresh(cur, latest, keep = [], set = {}) {
  const next = JSON.parse(JSON.stringify(latest));
  const idOf = (/** @type {any} */ n) => n.id || n.hashid || null;
  const nameOf = (/** @type {any} */ n) => elementKeyOf(n, n.type) || n.hashid;
  /** @type {Map<string, any>} */ const old = new Map();
  for (const f of formDef.collectAllFields(cur)) { const id = idOf(f.node); if (id) old.set(id, f.node); }
  /** @type {string[]} */ const keptHash = [], kept = [], diffs = [], missingSet = [];
  const seen = new Set();
  const same = (/** @type {any} */ a, /** @type {any} */ b) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
  /** @type {Map<string, any>} */ const nextById = new Map();
  for (const f of formDef.collectAllFields(next)) {
    const id = idOf(f.node);
    if (id) nextById.set(id, f.node);
    const o = id && old.get(id);
    if (!o) continue;
    seen.add(id);
    const n = f.node, name = nameOf(n);
    if (o.hashid && o.hashid !== n.hashid) { keptHash.push(`${name} ${n.hashid}→${o.hashid}`); n.hashid = o.hashid; }
    for (const p of [...LOCK_PROPS, ...keep]) {
      if (p in o && !same(o[p], n[p])) { n[p] = o[p]; kept.push(`${name}.${p}`); }
    }
    for (const p of LOCK_PROPS) {
      if (o.config && p in o.config && !same(o.config[p], n.config?.[p])) { n.config = n.config || {}; n.config[p] = o.config[p]; kept.push(`${name}.config.${p}`); }
    }
    for (const p of ['display', 'value', 'customRenderCode', 'validate']) {
      if (!keep.includes(p) && !(set[id] && p in set[id]) && !same(o[p], n[p])) diffs.push(`${name}.${p}`);
    }
  }
  for (const [id, props] of Object.entries(set)) {
    const n = nextById.get(id);
    if (!n) { missingSet.push(id); continue; }
    for (const [p, v] of Object.entries(props)) if (!same(n[p], v)) { n[p] = v; kept.push(`${nameOf(n)}.${p}(override)`); }
  }
  const removed = [...old.entries()].filter(([id]) => !seen.has(id)).map(([, n]) => nameOf(n));
  return { next, keptHash, kept, diffs, removed, missingSet };
}

module.exports = { run, usage: USAGE, planRefresh, planCondition, applyRefresh, startFromForm, parseRules, refreshParent, OVERRIDES_FILE };
