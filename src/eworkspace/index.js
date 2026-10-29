// @ts-check
'use strict';
// Công cụ vận hành dashboard và người dùng của phân hệ eWorkspace.
/** @type {import('../cli').Module} */
module.exports = {
  title: 'eWorkspace: dashboard và người dùng',
  commands: {
    users: ['Tra ID người dùng từ email', () => require('./commands/users')],
    dashboard: ['Thêm dashboard cho user hoặc gỡ toàn bộ dashboard của user', () => require('./commands/dashboard')],
    preset: ['Quản lý danh sách dashboard dùng lại theo môi trường', () => require('./commands/preset')],
  },
};
