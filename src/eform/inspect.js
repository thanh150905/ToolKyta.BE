// @ts-check
'use strict';
// Trạng thái 1 form folder (chỉ đọc đĩa, không gọi mạng) — nguồn sự thật chung cho status / guard / push:
//   1. Đã sửa cục bộ chưa?  (hash code/ + ui/ so với snapshot lúc pull/push)
//   2. Rào chắn: đúng môi trường? đích push có trỏ đúng form của thư mục này?
const path = require('path');
const tree = require('./tree');
const fields = require('./fields');
const registry = require('./registry');
const config = require('../core/config');
const store = require('../core/store');
const { hash } = require('../core/fsx');

// Mã rào chắn → mức: error = chặn commit + push, block = chỉ chặn push, warn = cảnh báo.
/** @type {Record<string, 'error'|'block'|'warn'|'ok'>} */
const LEVEL = {
  'meta-broken': 'error', 'bad-env': 'error', mismatch: 'error',
  'meta-conflict': 'block',
  'no-id': 'warn', unregistered: 'warn', moved: 'warn', ambiguous: 'warn',
  override: 'ok', ok: 'ok',
};

/** @typedef {{ changed: string[], added: string[], removed: string[] }} Delta */

/** So 2 map { file: hash } → { changed, added, removed }. @returns {Delta} */
function compare(/** @type {Record<string, string>} */ before, /** @type {Record<string, string>} */ now) {
  const keys = [...new Set([...Object.keys(before), ...Object.keys(now)])].sort();
  return {
    changed: keys.filter(k => k in before && k in now && before[k] !== now[k]),
    added: keys.filter(k => !(k in before)),
    removed: keys.filter(k => !(k in now)),
  };
}
const isEmpty = (/** @type {Delta} */ d) => !d.changed.length && !d.added.length && !d.removed.length;

/** Hash từng file của 1 map nội dung. */
function hashes(/** @type {Record<string, string>} */ files) {
  /** @type {Record<string, string>} */ const out = {};
  for (const k in files) out[k] = hash(files[k]);
  return out;
}

/**
 * @param {string} dir form folder
 * @param {ReturnType<typeof registry.load>} [idx]
 */
function formState(dir, idx = registry.load()) {
  const loc = tree.locate(dir);
  const { target, identity, fingerprint: fp, meta } = tree.ids(dir);
  const targetFormId = meta.targetFormId || null;
  const metaFormId = meta.formId || null;

  // --- lệch cục bộ so với snapshot ---
  const snap = (identity && store.getSnapshot(identity)) || (target && store.getSnapshot(target)) || null;
  let code = compare({}, {}), ui = compare({}, {}), fld = compare({}, {});
  let status = 'untracked';
  if (snap?.files) {
    code = compare(snap.files, hashes(tree.readCode(dir)));
    if (snap.ui) ui = compare(snap.ui, hashes(tree.readUi(dir)));
    if (snap.fields) fld = compare(snap.fields, fields.docHashes(fields.readDoc(dir)));
    status = isEmpty(code) && isEmpty(ui) && isEmpty(fld) ? 'synced' : 'modified';
  }

  // --- rào chắn (thứ tự = mức nghiêm trọng giảm dần) ---
  const regTarget = target ? idx.byId[target] : null;
  const regFp = fp.id ? idx.byId[fp.id] : null;
  let guard = 'ok', why = `Đúng form, đúng môi trường (${loc.env}).`;
  if (tree.metaBroken(dir)) [guard, why] = ['meta-broken', '.meta.json hỏng JSON — sửa lại hoặc pull lại.'];
  else if (!config.envs().includes(loc.env)) [guard, why] = ['bad-env', `Môi trường "${loc.env}" lạ (cần: ${config.envs().join('/')}).`];
  else if (regTarget && regTarget.env !== loc.env) [guard, why] = ['mismatch', `LỆCH MÔI TRƯỜNG: formId ${target} thuộc ${regTarget.env} (${regTarget.path}) nhưng thư mục là ${loc.env}.`];
  else if (targetFormId) [guard, why] = ['override', `Đẩy tới form đã chỉ định (targetFormId ${targetFormId}).`];
  else if (!fp.id) [guard, why] = ['no-id', 'Code không chứa formId — push dùng formId trong .meta.json.'];
  else if (metaFormId && metaFormId !== fp.id) [guard, why] = ['meta-conflict', `SAI ĐÍCH PUSH: code nhúng ${fp.id} nhưng form thật là ${metaFormId} (form copy / dùng chung field). Khai "targetFormId" trong .meta.json.`];
  else if (!regFp) [guard, why] = ['unregistered', `formId ${fp.id} chưa có trong registry — chạy: kyta eform registry`];
  else if (regFp.path !== loc.repoPath) [guard, why] = ['moved', `Đã đổi chỗ/tên so với registry (${regFp.path}) — chạy: kyta eform registry`];

  return { dir, ...loc, formId: target, identityId: identity, targetFormId, metaFormId, fingerprintId: fp.id, status, code, ui, fields: fld, guard, why };
}

/** @typedef {ReturnType<typeof formState> & { level?: string }} FormState */

/**
 * Quét cả cây (hoặc 1 nhánh). Nhiều form cùng vân tay → đánh dấu 'ambiguous' (registry chỉ giữ được 1 chủ).
 * @param {string} [onlyAbs]
 */
function listStates(onlyAbs) {
  const idx = registry.load();
  // Luôn quét cả cây để phát hiện vân tay trùng, rồi mới lọc nhánh.
  const all = tree.listForms().map(d => formState(d, idx));
  /** @type {Record<string, FormState[]>} */ const byFp = {};
  for (const s of all) if (s.fingerprintId) (byFp[s.fingerprintId] ||= []).push(s);
  for (const group of Object.values(byFp)) {
    if (group.length < 2) continue;
    for (const s of group) {
      if (s.guard !== 'ok' && s.guard !== 'moved') continue;
      s.guard = 'ambiguous';
      s.why = `${group.length} form dùng chung vân tay ${s.fingerprintId} (${group.filter(x => x !== s).map(x => x.relPath).join(', ')}) — nên khai targetFormId.`;
    }
  }
  const out = onlyAbs ? all.filter(s => s.dir === onlyAbs || s.dir.startsWith(onlyAbs + path.sep)) : all;
  return out.sort((a, b) => a.relPath.localeCompare(b.relPath, 'vi'));
}

module.exports = { LEVEL, compare, isEmpty, hashes, formState, listStates };
