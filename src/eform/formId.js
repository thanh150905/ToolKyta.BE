// @ts-check
'use strict';
// Nhận diện formId nhúng trong code động: mỗi field được tham chiếu dạng {{<formId>_<elementKey>}}.
// formId bắt đầu bằng "0000" → là "vân tay môi trường" (cùng form, mỗi env một id khác).

const ID_RE = /\{\{(0000[0-9A-Za-z]+)_/g;
const FORM_ID_RE = /^0000[0-9A-Za-z]+$/;

/** Đếm số lần mỗi formId xuất hiện trong code. */
function extractIds(/** @type {string} */ code) {
  /** @type {Record<string, number>} */ const counts = {};
  for (const m of String(code).matchAll(ID_RE)) counts[m[1]] = (counts[m[1]] || 0) + 1;
  return counts;
}

/** Id xuất hiện nhiều nhất = form "chủ" của đoạn code. */
function dominant(/** @type {Record<string, number>} */ counts) {
  let id = null, count = 0;
  for (const k in counts) if (counts[k] > count) { id = k; count = counts[k]; }
  return { id, count, all: counts };
}

/**
 * Khoá field dùng trong code động (vd "table_advance-6"). Nguồn chuẩn: node.id = "<formId>_<key>";
 * fallback: property có dạng "<type><sep><số>". Không xác định được → null.
 * @param {any} node
 * @param {string} type
 */
function elementKeyOf(node, type) {
  const m = typeof node.id === 'string' && node.id.match(/^0000[0-9A-Za-z]+_(.+)$/);
  if (m && m[1].trim()) return m[1].trim();
  const re = new RegExp('^' + String(type).replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '[-_ ]?\\d+$');
  const candidates = [node.name, node.key, node.field, node.fieldName, node.elementId, ...Object.values(node)];
  const hit = candidates.find(v => typeof v === 'string' && re.test(v.trim()));
  return hit ? hit.trim() : null;
}

module.exports = { FORM_ID_RE, extractIds, dominant, elementKeyOf };
