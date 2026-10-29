// @ts-check
'use strict';
// Cấu hình điều kiện (ẩn/hiện field) = form.jsonFormCondition (chuỗi double-encoded, cấp cao form object).
// Luật: KHI <field nguồn> <operator> <value> THÌ show/hide các field đích.
//   condition list   <form>
//   condition add    <form> <fieldNguồn> <operator> [value] [--show k1,k2] [--hide k3]
//   condition remove <form> <conditionId>
//   condition toggle <form> <conditionId> [--off]
const path = require('path');
const api = require('../api');
const tree = require('../tree');
const formDef = require('../formDef');
const inspect = require('../inspect');
const store = require('../../core/store');
const { elementKeyOf } = require('../formId');
const { parseArgs, usage, splitList } = require('../../core/args');

const OPS = ['equal', 'un_equal', 'empty', 'un_empty', 'include'];
const NEEDS_VALUE = new Set(['equal', 'un_equal', 'include']);

const USAGE = [
  'kyta eform condition list   <form-folder>',
  'kyta eform condition add    <form-folder> <fieldNguồn> <operator> [value] [--show k1,k2] [--hide k3] [--dry-run]',
  'kyta eform condition remove <form-folder> <conditionId> [--dry-run]',
  'kyta eform condition toggle <form-folder> <conditionId> [--off] [--dry-run]',
  '',
  'operator: ' + OPS.join(' | ') + '  (empty/un_empty không cần value)',
  'field nguồn & --show/--hide nhận key (vd dropdown-1) hoặc hashid.',
].join('\n');

/** Đọc jsonFormCondition (chuỗi double-encoded) → mảng luật. */
function parseRules(/** @type {any} */ form) {
  let jc = form.jsonFormCondition;
  if (typeof jc === 'string') { try { jc = JSON.parse(jc); } catch (_) { jc = []; } }
  return Array.isArray(jc) ? jc : [];
}

/** conditionId 8 ký tự base62, không trùng. */
function newCondId(/** @type {Set<string>} */ used) {
  const gen = () => Array.from({ length: 8 }, () => 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'[Math.floor(Math.random() * 62)]).join('');
  let id = gen(); while (used.has(id)) id = gen(); return id;
}

async function openForm(/** @type {string} */ target, /** @type {Set<string>} */ flags) {
  const dir = path.resolve(target);
  if (!tree.isForm(dir)) throw new Error('Không phải form folder: ' + target);
  const st = inspect.listStates(dir).find(s => s.dir === dir) || inspect.formState(dir);
  const level = inspect.LEVEL[st.guard];
  if (level === 'error' || level === 'block') throw new Error(st.why + ' Dừng.');
  if (!st.formId) throw new Error('Không xác định được formId đích.');
  if (st.env === 'prod' && !flags.has('--yes-prod')) throw new Error('Đích là PROD — thêm --yes-prod để xác nhận.');
  const sess = await api.open(st.customer, st.env);
  const form = await api.getForm(sess, st.formId);
  const { def, wasString } = formDef.parseFormDef(form);
  if (!def) throw new Error('Form trên server không có jsonForm.');
  return { dir, st, sess, form, def, wasString, dryRun: flags.has('--dry-run') };
}

/** Ghi lại jsonFormCondition (kèm 9 field chuẩn) — cơ chế đã kiểm chứng: gửi dạng CHUỖI. */
async function saveRules(/** @type {any} */ ctx, /** @type {any[]} */ rules) {
  await api.putForm(ctx.sess, { ...formDef.buildOwnerFormPayload(ctx.form, ctx.def, ctx.wasString), jsonFormCondition: JSON.stringify(rules) });
  store.audit({ op: 'condition-save', formId: ctx.st.formId, customer: ctx.st.customer, env: ctx.st.env, count: rules.length });
}

async function run(/** @type {string[]} */ argv) {
  const sub = argv[0];
  if (!sub || !['list', 'add', 'remove', 'toggle'].includes(sub)) usage(USAGE);
  const { _, flags, opts } = parseArgs(argv.slice(1), { value: ['--show', '--hide'] });
  const target = _[0];
  if (!target) usage(USAGE);

  const ctx = await openForm(target, flags);
  const rules = parseRules(ctx.form);
  // map id đầy đủ → key để in cho dễ đọc
  const idToKey = new Map(formDef.collectAllFields(ctx.def).map(f => [f.node.id, f.key]));
  const keyOf = (/** @type {string} */ id) => idToKey.get(id) || id;
  const resolveId = (/** @type {string} */ ref) => {
    const n = formDef.findNode(ctx.def, { key: ref }) || formDef.findNode(ctx.def, { hashid: ref });
    if (!n) throw new Error(`Không thấy field "${ref}".`);
    return n.id;
  };

  if (sub === 'list') {
    if (!rules.length) { console.log('Form chưa có luật điều kiện nào.'); return; }
    console.log(`${rules.length} luật điều kiện trong ${ctx.st.formId}:\n`);
    for (const r of rules) {
      const acts = (r.action || []).map((/** @type {any} */ a) => `${a.type} [${(a.fieldIds || []).map(keyOf).join(', ')}]`).join(' · ');
      // Dạng UI: { matchType, conditions: [...] }. Dạng phẳng cũ (fieldId/operator/value ở gốc) runtime vẫn đọc.
      const conds = Array.isArray(r.conditions) ? r.conditions : [r];
      const when = conds.map((/** @type {any} */ c) => `${keyOf(c.fieldId)} ${c.operator} ${JSON.stringify(c.value)}`).join(r.matchType === 'any' ? ' HOẶC ' : ' VÀ ');
      console.log(`  ${r.conditionId}  ${r.enable === false ? '(TẮT) ' : ''}KHI ${when} → ${acts}`);
    }
    return;
  }

  if (sub === 'add') {
    const [, srcRef, operator, value] = _;
    if (!srcRef || !operator) usage(USAGE);
    if (!OPS.includes(operator)) throw new Error(`operator không hợp lệ "${operator}". Chọn: ${OPS.join(', ')}`);
    if (NEEDS_VALUE.has(operator) && value == null) throw new Error(`operator "${operator}" cần <value>.`);
    const show = splitList(opts['--show']).map(resolveId);
    const hide = splitList(opts['--hide']).map(resolveId);
    if (!show.length && !hide.length) throw new Error('Cần ít nhất --show hoặc --hide.');
    const action = [];
    if (show.length) action.push({ type: show.length > 1 ? 'show_multiple' : 'show', fieldIds: show });
    if (hide.length) action.push({ type: hide.length > 1 ? 'hide_multiple' : 'hide', fieldIds: hide });
    // Ghi đúng dạng UI eForm hiện tại (matchType + conditions[]).
    const rule = {
      action, enable: true, matchType: 'all',
      conditions: [{ value: value == null ? '' : value, fieldId: resolveId(srcRef), operator, typeValue: '1' }],
      conditionId: newCondId(new Set(rules.map(r => r.conditionId))),
    };
    console.log(`Thêm luật: KHI ${srcRef} ${operator} ${JSON.stringify(rule.conditions[0].value)} → ${action.map(a => a.type + ' ' + a.fieldIds.map(keyOf).join('/')).join(' · ')}  (id ${rule.conditionId})${ctx.dryRun ? '   [DRY-RUN]' : ''}`);
    if (ctx.dryRun) return console.log('\n[DRY-RUN] Không gửi gì lên server.');
    rules.push(rule);
    await saveRules(ctx, rules);
    console.log('  ✓ đã lưu.');
    return;
  }

  if (sub === 'remove') {
    const id = _[1];
    if (!id) usage(USAGE);
    const next = rules.filter(r => r.conditionId !== id);
    if (next.length === rules.length) throw new Error(`Không thấy luật "${id}". Xem: kyta eform condition list <form>`);
    console.log(`Xoá luật ${id}${ctx.dryRun ? '   [DRY-RUN]' : ''}`);
    if (ctx.dryRun) return console.log('\n[DRY-RUN] Không gửi gì lên server.');
    await saveRules(ctx, next);
    console.log('  ✓ đã lưu.');
    return;
  }

  // toggle
  const id = _[1];
  if (!id) usage(USAGE);
  const rule = rules.find(r => r.conditionId === id);
  if (!rule) throw new Error(`Không thấy luật "${id}".`);
  rule.enable = flags.has('--off') ? false : true;
  console.log(`${rule.enable ? 'Bật' : 'Tắt'} luật ${id}${ctx.dryRun ? '   [DRY-RUN]' : ''}`);
  if (ctx.dryRun) return console.log('\n[DRY-RUN] Không gửi gì lên server.');
  await saveRules(ctx, rules);
  console.log('  ✓ đã lưu.');
}

module.exports = { run, usage: USAGE };
