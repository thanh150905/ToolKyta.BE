// @ts-check
'use strict';
// Danh mục nào đã sửa cục bộ (cấu hình/field) so với lần pull gần nhất.
const store = require('../store');

const USAGE = 'kyta ecatalog status [<customer> [<env>]]';

function run(/** @type {string[]} */ argv) {
  const [customer, env] = argv.filter(a => !a.startsWith('--'));
  store.status(customer, env);
}

module.exports = { run, usage: USAGE };
