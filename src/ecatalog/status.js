// @ts-check
'use strict';
// Trạng thái category eCatalog. Hai trục độc lập (đã verify trên saigoncoop/sandbox):
//   status           — hoạt động: 1 = Hoạt động (verify), 0 = Ngừng (suy).
//   applicableStatus — áp dụng lên hệ thống: 1 = Áp dụng, 0 = Chưa áp dụng (verify).

/** @type {Record<number, string>} */
const STATUS_LABEL = { 0: 'ngừng', 1: 'hoạt động' };
/** @type {Record<number, string>} */
const APPLICABLE_LABEL = { 0: 'chưa áp dụng', 1: 'áp dụng' };

const statusLabel = (/** @type {number} */ v) => STATUS_LABEL[v] ?? String(v ?? '');
const applicableLabel = (/** @type {number} */ v) => APPLICABLE_LABEL[v] ?? String(v ?? '');

module.exports = { STATUS_LABEL, APPLICABLE_LABEL, statusLabel, applicableLabel };
