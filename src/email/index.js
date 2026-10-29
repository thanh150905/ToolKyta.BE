// @ts-check
'use strict';
// Phân hệ Email — mẫu mail (service email-template).
/** @type {import('../cli').Module} */
module.exports = {
  title: 'mẫu mail',
  commands: {
    list: ['Liệt kê mẫu mail trên server', () => require('./commands/list')],
    pull: ['Kéo mẫu mail về local', () => require('./commands/pull')],
    push: ['Đẩy 1 mẫu lên (tự chuẩn hoá link portal theo env)', () => require('./commands/push')],
    status: ['Mẫu nào đã sửa cục bộ', () => require('./commands/status')],
    clone: ['Tạo mẫu mới từ mẫu có sẵn', () => require('./commands/clone')],
  },
};
