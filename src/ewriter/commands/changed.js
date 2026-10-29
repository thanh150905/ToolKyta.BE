// @ts-check
'use strict';
// Tài liệu nào đã sửa cục bộ (metadata/biến) so với lần pull/push gần nhất.
const store = require('../store');

const USAGE = 'kyta ewriter changed [<customer> [<env>]]';

function run(/** @type {string[]} */ argv) {
  const [customer, env] = argv.filter(a => !a.startsWith('--'));
  store.status(customer, env);
}

module.exports = { run, usage: USAGE };
