// @ts-check
'use strict';
// Kế thừa dữ liệu (entity variables-configs): field form node ĐÍCH ← field form node NGUỒN.
// Mỗi phần tử sources[] (khớp payload editor, xác minh từ bản ghi thật BMW KHSXTC 2026-10-23):
//   { elementTarget: <hashid đích>, fieldId: "<id field đích>-Target-null-null",
//     listElementSource: [{ hashId, fieldId: "<id field nguồn>-Root-<sid nguồn|null>-<modelerId>", userTaskId: sid|null, modelerId, label, type }],
//     formula: { expressionValue: [{ type: 'variable', value: <nhãn nguồn>, item }], context: "getValueForm('<item>')", type: null } }
//   item = "<modelerId>.<hashid>" (form Start) | "<modelerId>.<sid>.<hashid>" (form user-task) | "<hashid>" (bản cũ).
// Xem docs/eflow-schema.md mục 3.3.

/** Kiểu field editor cho kế thừa (danh sách `Of` trong bundle eflow). */
const INHERIT_TYPES = new Set(['textField', 'textArea', 'number', 'password', 'email', 'phone_number', 'radio_button', 'check_box',
  'dropdown', 'datepicker', 'calendar', 'upload_file', 'upload_img', 'hyperlink', 'table', 'table_advance', 'signature', 'rich_text',
  'textField_ticketName', 'ocrDocument', 'docNumberTHADS', 'view_ewriter', 'rich_text_advance', 'record_audio']);

/** @typedef {{ id: string, type: string, label: string, hashid: string }} Field */

/**
 * 1 dòng kế thừa đích ← nguồn (1 field, công thức getValueForm đơn).
 * @param {string} modelerId
 * @param {string|null} srcSid  null = form Start
 * @param {Field} src
 * @param {Field} tgt
 */
function buildSource(modelerId, srcSid, src, tgt) {
  const item = srcSid ? `${modelerId}.${srcSid}.${src.hashid}` : `${modelerId}.${src.hashid}`;
  return {
    elementTarget: tgt.hashid,
    fieldId: `${tgt.id}-Target-null-null`,
    listElementSource: [{
      hashId: src.hashid, fieldId: `${src.id}-Root-${srcSid || 'null'}-${modelerId}`,
      userTaskId: srcSid || null, modelerId, label: src.label, type: src.type,
    }],
    formula: { expressionValue: [{ type: 'variable', value: src.label, item }], context: `getValueForm('${item}')`, type: null },
  };
}

/**
 * Khớp field đích ↔ nguồn: hashid trước (form clone giữ hashid), rồi nhãn + kiểu (duy nhất).
 * @param {Field[]} tgtFields
 * @param {Field[]} srcFields
 * @returns {{ tgt: Field, src: Field|null, by: 'hashid'|'label'|null }[]}
 */
function matchFields(tgtFields, srcFields) {
  const srcOk = srcFields.filter(f => INHERIT_TYPES.has(f.type));
  const norm = (/** @type {string} */ s) => String(s || '').trim().toLowerCase();
  return tgtFields.filter(f => INHERIT_TYPES.has(f.type) && f.hashid).map(tgt => {
    const byHash = srcOk.filter(s => s.hashid === tgt.hashid);
    const h = byHash.find(s => s.type === tgt.type) || byHash[0];
    if (h) return { tgt, src: h, by: /** @type {const} */ ('hashid') };
    const byLabel = norm(tgt.label) ? srcOk.filter(s => s.type === tgt.type && norm(s.label) === norm(tgt.label)) : [];
    if (byLabel.length === 1) return { tgt, src: byLabel[0], by: /** @type {const} */ ('label') };
    return { tgt, src: null, by: null };
  });
}

/**
 * Chép sources của node A sang form node B: đổi elementTarget/fieldId sang field tương ứng của form B
 * (khớp hashid, rồi nhãn+kiểu của field A). Giữ nguyên nguồn + công thức.
 * @param {any[]} sources   sources của config node A
 * @param {Field[]} aFields  field form A (để biết nhãn/kiểu đích cũ)
 * @param {Field[]} bFields  field form B
 */
function retarget(sources, aFields, bFields) {
  const norm = (/** @type {string} */ s) => String(s || '').trim().toLowerCase();
  /** @type {any[]} */ const kept = [];
  /** @type {any[]} */ const dropped = [];
  for (const s of sources) {
    const old = aFields.find(f => f.hashid === s.elementTarget);
    let b = bFields.find(f => f.hashid === s.elementTarget && (!old || f.type === old.type)) || bFields.find(f => f.hashid === s.elementTarget);
    if (!b && old) {
      const hits = bFields.filter(f => f.type === old.type && norm(f.label) === norm(old.label));
      if (hits.length === 1) b = hits[0];
    }
    if (b) kept.push({ ...s, elementTarget: b.hashid, fieldId: `${b.id}-Target-null-null` });
    else dropped.push(s);
  }
  return { kept, dropped };
}

/** Công thức đọc được: getValueForm('<item>') → «[node] nhãn» theo listElementSource. */
function describeFormula(/** @type {any} */ src, /** @type {(sid: string|null) => string} */ nodeName) {
  const ctx = String(src.formula?.context || '');
  return ctx.replace(/getValueForm\('([^']*)'\)/g, (_, item) => {
    const parts = String(item).split('.');
    const hash = parts[parts.length - 1];
    const sid = parts.length === 3 ? parts[1] : null;
    const el = (src.listElementSource || []).find((/** @type {any} */ e) => (e.hashId || e.hashid) === hash && (parts.length < 3 || e.userTaskId === sid))
      || (src.listElementSource || []).find((/** @type {any} */ e) => (e.hashId || e.hashid) === hash);
    return `«[${nodeName(el ? el.userTaskId : sid)}] ${el?.label || hash}»`;
  });
}

module.exports = { INHERIT_TYPES, buildSource, matchFields, retarget, describeFormula };
