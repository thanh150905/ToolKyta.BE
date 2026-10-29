// @ts-check
'use strict';
// Phân hệ eFlow — quy trình (modeler), người thực hiện, cấu hình thông báo.
/** @type {import('../cli').Module} */
module.exports = {
  title: 'quy trình, người thực hiện, thông báo, điều kiện, biểu mẫu, kế thừa',
  commands: {
    list: ['Liệt kê quy trình trên server', () => require('./commands/list')],
    pull: ['Kéo quy trình (jsonXml) về local', () => require('./commands/pull')],
    push: ['Đẩy 1 quy trình lên', () => require('./commands/push')],
    status: ['Quy trình nào đã sửa cục bộ', () => require('./commands/status')],
    nodes: ['Liệt kê node của 1 quy trình', () => require('./commands/nodes')],
    roles: ['Liệt kê role (dùng cho impl/notify)', () => require('./commands/roles')],
    impl: ['Người thực hiện user-task: list|add|rm|clear', () => require('./commands/impl')],
    notify: ['Thông báo eNotify: list-all|list|templates|fields|add|set|rm', () => require('./commands/notify')],
    cond: ['Điều kiện trên dây: list|fields|set (sửa flow.json local)', () => require('./commands/cond')],
    inherit: ['Kế thừa dữ liệu node: list|copy|auto', () => require('./commands/inherit')],
    form: ['Biểu mẫu gắn vào node: list|set', () => require('./commands/form')],
  },
};
