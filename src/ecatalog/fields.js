// @ts-check
'use strict';
// Field của category eCatalog. `struct` = chuỗi JSON = mảng field (đúng schema field eForm).
// Field id (vd "textField_input-1") là khoá bền: các *Config trỏ tới qua `key`, và là khoá của bản ghi dữ liệu.

// Kiểu block LAYOUT/hiển thị (không mang dữ liệu) — loại khi lấy field nhập liệu.
/** @type {Set<string>} */
const LAYOUT_TYPES = new Set([
  'row', 'column', 'divider', 'text', 'paragraph',
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'heading', 'heading1', 'heading2', 'heading3',
]);

/** struct (chuỗi JSON hoặc mảng) → mảng field object. */
function parseStruct(/** @type {any} */ category) {
  let s = category?.struct;
  if (typeof s === 'string') { try { s = JSON.parse(s); } catch (_) { s = null; } }
  return Array.isArray(s) ? s : [];
}

/** Nhãn hiển thị của field. */
const labelOf = (/** @type {any} */ f) => f.label || f.title || f.name || f.placeholder || f.type || 'field';

/** Tóm tắt field để đọc nhanh / ghi fields.json. */
function fieldSummary(/** @type {any} */ category) {
  return parseStruct(category).map(f => ({
    id: f.id,
    type: f.type,
    label: String(labelOf(f)),
    required: !!(f.validate && f.validate.required),
    unique: !!(f.validate && f.validate.unique),
    display: f.display !== false,
  }));
}

/** Field NHẬP LIỆU (mang dữ liệu) — loại block layout. Dùng để đọc/khớp khoá bản ghi. */
function inputFields(/** @type {any} */ category) {
  return parseStruct(category).filter(f => f && f.id && !LAYOUT_TYPES.has(String(f.type)));
}

/** Slug ascii từ nhãn (bỏ dấu, chữ thường, [a-z0-9]) — làm phần giữa của id cho gần giống UI. */
function slugify(/** @type {string} */ label) {
  const s = String(label || '').normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/đ/gi, 'd').toLowerCase().replace(/[^a-z0-9]+/g, '').slice(0, 12);
  return s || 'input';
}

/** Sinh id field mới, duy nhất trong struct: "{type}_{slug}-{n}" (n = max hậu tố số + 1). */
function nextFieldId(/** @type {any[]} */ struct, /** @type {string} */ type, /** @type {string} */ label) {
  let max = 0;
  for (const f of struct) {
    const m = String(f && f.id || '').match(/-(\d+)$/);
    if (m) max = Math.max(max, Number(m[1]));
  }
  const ids = new Set(struct.map(f => f && f.id));
  let n = max + 1, id;
  do { id = `${type}_${slugify(label)}-${n}`; n++; } while (ids.has(id));
  return id;
}

/** Dựng 1 field object đầy đủ (đúng schema đã verify). Mặc định textField (input text). */
function makeField(/** @type {string} */ label, /** @type {{type?: string, id: string, required?: boolean, unique?: boolean, display?: boolean}} */ o) {
  return {
    type: o.type || 'textField', label: String(label), code: '', placeholder: '',
    inputType: 'text', value: '', labelPosition: 'above', tooltip: '', textTransform: 'none',
    description: '', display: o.display !== false, readonly: false, spellCheck: false,
    validate: { minLength: '', maxLength: '', regex: '', messErrorForRegex: '', listSelectedRegex_value: [], required: !!o.required, unique: !!o.unique },
    formula: { expression_value: [] }, extractCLMInfo: false,
    id: o.id, renderMode: 'builtin', customRenderCode: { html: '', css: '', js: '', version: 1 },
    allowRecord: '', slug: '',
  };
}

/** {key: active} của 1 mảng config (tableConfig/searchConfig/filterConfig). */
const activeMap = (/** @type {any[]} */ arr) => Object.fromEntries((arr || []).map(x => [x.key, !!x.active]));

/** Đặt active theo tập key (giữ nguyên các field khác thành false). */
const applyActive = (/** @type {any[]} */ arr, /** @type {Set<string>} */ keys) =>
  (arr || []).map(x => ({ ...x, active: keys.has(x.key) }));

module.exports = {
  LAYOUT_TYPES, parseStruct, labelOf, fieldSummary, inputFields,
  slugify, nextFieldId, makeField, activeMap, applyActive,
};
