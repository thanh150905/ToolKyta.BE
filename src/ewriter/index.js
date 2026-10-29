// @ts-check
'use strict';
// Phân hệ eWriter — kho tài liệu bản in (.docx): quản lý tài liệu + gán biến từ eForm.
/** @type {import('../cli').Module} */
module.exports = {
  title: 'tài liệu bản in (.docx) + gán biến từ form',
  commands: {
    list: ['Liệt kê tài liệu bản in trên server', () => require('./commands/list')],
    pull: ['Kéo tài liệu (metadata + biến + file .docx) về local', () => require('./commands/pull')],
    push: ['Đẩy metadata + biến + file .docx (nếu sửa document.xml) lên', () => require('./commands/push')],
    changed: ['Tài liệu nào đã sửa cục bộ', () => require('./commands/changed')],
    status: ['Đổi trạng thái tài liệu (nháp|sẵn sàng|cuối cùng)', () => require('./commands/status')],
    clone: ['Nhân bản 1 tài liệu bản in', () => require('./commands/clone')],
    vars: ['Biến: forms|list|apply (kéo biến của form vào tài liệu)', () => require('./commands/vars')],
    docx: ['File bản in: info|check|fix|rename|field|table|strip-comments', () => require('./commands/docx')],
    preview: ['Render thử với dữ liệu mẫu + báo placeholder không được điền', () => require('./commands/preview')],
  },
};
