// @ts-check
'use strict';
// Trạng thái tài liệu eWriter: 0 nháp, 1 sẵn sàng, 2 cuối cùng.
// (Chỉ 1 = "sẵn sàng" đã xác minh; 0/2 suy từ 3 lựa chọn bộ lọc — xem docs/ewriter-schema.md.)

/** @type {Record<number, string>} */
const STATUS_LABEL = { 0: 'nháp', 1: 'sẵn sàng', 2: 'cuối cùng' };

// Tên gõ ở CLI → mã.
/** @type {Record<string, number>} */
const STATUS_CODE = {
  draft: 0, 'nhap': 0, 'nháp': 0, '0': 0,
  ready: 1, 'san-sang': 1, 'sẵn sàng': 1, 'san sang': 1, '1': 1,
  final: 2, 'cuoi-cung': 2, 'cuối cùng': 2, 'cuoi cung': 2, '2': 2,
};

/** Chuẩn hoá tên/số trạng thái người dùng gõ → mã (0/1/2). Không hợp lệ → null. */
function parseStatus(/** @type {string} */ s) {
  const code = STATUS_CODE[String(s).trim().toLowerCase()];
  return code === undefined ? null : code;
}

module.exports = { STATUS_LABEL, STATUS_CODE, parseStatus };
