// @ts-check
'use strict';
// Phân hệ eCatalog — quản lý danh mục (master-data): field tự định nghĩa + cấu hình hiển thị + bản ghi dữ liệu.
// Đọc: list/pull/status. Ghi: cat (CRUD danh mục), field (thông số), display (hiển thị), data (CRUD bản ghi).
// Chưa có: import/export excel — xem docs/ecatalog-schema.md.
/** @type {import('../cli').Module} */
module.exports = {
  title: 'danh mục (master-data): field + cấu hình hiển thị + bản ghi',
  commands: {
    list: ['Liệt kê danh mục (category) trên server', () => require('./commands/list')],
    pull: ['Kéo cấu hình + field (+ dữ liệu) của danh mục về (theo id hoặc --all)', () => require('./commands/pull')],
    cat: ['CRUD danh mục: create|edit|clone|apply|unapply|rm', () => require('./commands/cat')],
    field: ['Xem/sửa field (thông số): list|add|rm|set', () => require('./commands/field')],
    display: ['Cấu hình hiển thị: chọn field cho bảng danh sách|tìm kiếm|lọc', () => require('./commands/display')],
    data: ['CRUD bản ghi dữ liệu: list|add|edit|clone|rm|clear', () => require('./commands/data')],
    status: ['Danh mục nào đã sửa cục bộ', () => require('./commands/status')],
  },
};
