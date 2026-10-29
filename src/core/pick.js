// @ts-check
'use strict';
// Chọn đúng 1 bản ghi theo tên người dùng gõ (id | tên chính xác | chứa chuỗi).

/**
 * Thứ tự khớp: id → tên chính xác → tên chứa chuỗi. Không thấy hoặc mơ hồ → lỗi kèm danh sách.
 * @template T
 * @param {T[]} items
 * @param {string} ref
 * @param {{ what: string, id: (x: T) => unknown, names: (x: T) => unknown[], show: (x: T) => string, hint?: string }} o
 * @returns {T}
 */
function pickOne(items, ref, o) {
  const low = String(ref).toLowerCase();
  const norm = (/** @type {unknown} */ v) => String(v ?? '').toLowerCase();
  const tiers = [
    items.filter(x => String(o.id(x)) === String(ref)),
    items.filter(x => o.names(x).some(n => norm(n) === low)),
    items.filter(x => o.names(x).some(n => norm(n).includes(low))),
  ];
  /** @type {T[]} */ let last = [];
  for (const hit of tiers) {
    if (hit.length === 1) return hit[0];
    if (hit.length) last = hit;
  }
  if (!last.length) throw new Error(`Không thấy ${o.what} khớp "${ref}".${o.hint ? ' ' + o.hint : ''}`);
  throw new Error(`"${ref}" khớp ${last.length} ${o.what} — nêu rõ hơn:\n` + last.slice(0, 15).map(x => '   ' + o.show(x)).join('\n'));
}

/** Lọc theo chuỗi con (không phân biệt hoa thường) trên các field. */
function grep(/** @type {any[]} */ rows, /** @type {string|undefined} */ text, /** @type {string[]} */ fields) {
  if (!text) return rows;
  const low = text.toLowerCase();
  return rows.filter(r => fields.some(f => String(r[f] ?? '').toLowerCase().includes(low)));
}

module.exports = { pickOne, grep };
