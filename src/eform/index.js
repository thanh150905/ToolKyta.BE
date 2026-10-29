// @ts-check
'use strict';
// Phân hệ eForm — code động + custom UI của form.
/** @type {import('../cli').Module} */
module.exports = {
  title: 'code động + custom UI của form',
  commands: {
    list: ['Liệt kê form sở hữu trên server', () => require('./commands/list')],
    pull: ['Kéo code + custom UI + cấu hình field về (theo formId hoặc --all), tự dựng registry', () => require('./commands/pull')],
    push: ['Đẩy 1 form lên (chặn sai env / sai đích)', () => require('./commands/push')],
    field: ['Xem/sửa cấu hình field (label, required, readonly, datasource...)', () => require('./commands/field')],
    childform: ['Đồng bộ form con (child_form) từ form start (thay "chọn lại form start")', () => require('./commands/childform')],
    propagate: ['Lan form con sang mọi form cha nhúng nó (giữ hashid/readonly, chặn drift)', () => require('./commands/propagate')],
    lib: ['Khối code dùng chung (marker // ===== [TÊN]) ↔ workspace/<kh>/<env>/lib', () => require('./commands/lib')],
    condition: ['Cấu hình điều kiện ẩn/hiện field (jsonFormCondition)', () => require('./commands/condition')],
    status: ['Form nào đã sửa cục bộ + form có rào chắn', () => require('./commands/status')],
    diff: ['So chi tiết local ↔ server của 1 form', () => require('./commands/diff')],
    detect: ['Hỏi 1 file/folder thuộc customer/env nào', () => require('./commands/detect')],
    guard: ['Kiểm tra lệch môi trường (chạy ở pre-commit)', () => require('./commands/guard')],
    lint: ['Kiểm tĩnh token {{formId_key}} trỏ field có thật + khối lib (offline)', () => require('./commands/lint')],
    run: ['Chạy thử code động offline với runtime giả lập + fixture', () => require('./commands/run')],
    registry: ['Dựng lại workspace/registry.json', () => require('./commands/registry')],
  },
};
