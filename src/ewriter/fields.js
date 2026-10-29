// @ts-check
'use strict';
// Dựng danh sách biến eWriter từ định nghĩa form (jsonForm).
// Biến eWriter: { code, apply, applyServer, variableName, variableType, fieldId, resourceId, viewerPermission, id }
//   fieldId  = node.id = "{formId}_{elementKey}"   (vd 000071..._textField-1)
//   code     = mã placeholder ngắn (9 ký tự [a-z0-9]) tự sinh
//   variableName = "{nhãn field} ({code})"

// Kiểu field NHẬP LIỆU → thành biến (allowlist, khớp cách eWriter chọn). Khoá = "base" của fieldId
// (phần chữ trước số/gạch, vd "textField-1"→"textField", "table_advance-2"→"table_advance").
// Loại trừ node layout/hiển thị (page/h/columns/splitter/view_ewriter/rich_text_advance/upload_file...).
// [Cần chốt] bổ sung base khi gặp form dùng kiểu field khác — thà thiếu còn hơn nhặt nhầm layout.
/** @type {Record<string, string>} */
const TYPE_MAP = {
  textField: 'string', textField_ticketName: 'string', textArea: 'string',
  number: 'string', currency: 'string', money: 'string', calculate: 'string',
  datepicker: 'string', timepicker: 'string', time: 'string', day: 'string',
  dropdown: 'string', select: 'string', radio: 'string', tags: 'string',
  email: 'string', phone: 'string', phoneNumber: 'string', url: 'string', address: 'string',
  check_box: 'check_box', checkbox: 'check_box',
  table_advance: 'table', table: 'table',
};
const INPUT_BASES = new Set(Object.keys(TYPE_MAP));

/** "base" của fieldId: phần chữ+"_" trước số/gạch. "textField-1"→"textField", "h1-1"→"h". */
const baseOf = (/** @type {string} */ key) => (key.match(/^([A-Za-z_]+?)(?=\d|-|$)/) || [])[1] || key;

/** jsonForm có thể là chuỗi JSON (double-encoded) hoặc object. */
function parseJsonForm(/** @type {any} */ form) {
  let def = form?.jsonForm;
  if (typeof def === 'string') { try { def = JSON.parse(def); } catch (_) { def = null; } }
  return def || null;
}

/** Sinh code 9 ký tự [a-z0-9] (giống code eWriter tự sinh). */
function genCode() {
  const abc = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let s = '';
  for (let i = 0; i < 9; i++) s += abc[Math.floor(Math.random() * abc.length)];
  return s;
}

/** Nhãn hiển thị của 1 field node. */
const labelOf = (/** @type {any} */ node) =>
  node.label || node.title || node.name || node.placeholder || node.fieldName || node.type || 'field';

/**
 * Thu các field NHẬP LIỆU của form → mảng { fieldId, label, base }.
 * Field nhận diện qua node.id = "{formId}_{key}" và base(key) thuộc INPUT_BASES.
 * @param {string} formId
 * @param {any} def jsonForm đã parse
 */
function collectFields(formId, def) {
  const prefix = formId + '_';
  /** @type {{fieldId: string, label: string, base: string}[]} */ const out = [];
  const seen = new Set();
  (function walk(/** @type {any} */ node) {
    if (Array.isArray(node)) return node.forEach(walk);
    if (!node || typeof node !== 'object') return;
    const id = node.id;
    if (typeof id === 'string' && id.startsWith(prefix) && !seen.has(id)) {
      const base = baseOf(id.slice(prefix.length));
      if (INPUT_BASES.has(base)) { seen.add(id); out.push({ fieldId: id, label: String(labelOf(node)), base }); }
    }
    for (const k in node) walk(node[k]);
  })(def);
  return out;
}

/**
 * Dựng object biến eWriter cho 1 field.
 * @param {{fieldId: string, label: string, base: string}} f
 * @param {string} formId
 * @param {string} [code]
 */
function toVariable(f, formId, code = genCode()) {
  const variableType = TYPE_MAP[f.base] || 'string';
  return {
    code, apply: true, applyServer: true,
    variableName: `${f.label} (${code})`,
    variableType, fieldId: f.fieldId, resourceId: formId,
    viewerPermission: [], id: null,
  };
}

/**
 * Toàn bộ biến khả dụng của 1 form (từ jsonForm).
 * @param {any} form object form (có formId + jsonForm)
 */
function variablesFromForm(form) {
  const formId = form.formId || form.id;
  const def = parseJsonForm(form);
  if (!formId || !def) return [];
  return collectFields(formId, def).map(f => toVariable(f, formId));
}

/**
 * @typedef {{ label: string, hashid: string, type: string, key: string|null, formId: string, columns: string[] }} PrintField
 */

/**
 * Field có thể in (có hashid) của các form — dùng đối chiếu placeholder "Nhãn (hashid)" + dựng payload preview.
 * @param {{ formId: string, def: any }[]} forms
 * @returns {PrintField[]}
 */
function printFields(forms) {
  const { collectAllFields } = require('../eform/formDef');
  /** @type {Map<string, PrintField>} */ const byHash = new Map();
  for (const { formId, def } of forms) {
    for (const f of collectAllFields(def)) {
      if (!f.hashid || byHash.has(f.hashid)) continue;
      const cols = f.node?.tableAdvanceConfig?.column_value;
      byHash.set(f.hashid, {
        label: f.label, hashid: f.hashid, type: f.type, key: f.key, formId,
        columns: Array.isArray(cols) ? cols.map((/** @type {any} */ c) => String(c?.title ?? '')) : [],
      });
    }
  }
  return [...byHash.values()];
}

module.exports = { printFields, TYPE_MAP, INPUT_BASES, baseOf, parseJsonForm, genCode, collectFields, toVariable, variablesFromForm };
