// @ts-check
'use strict';
const api = require('../api');
const { statusLabel, applicableLabel } = require('../status');
const { parseArgs, usage } = require('../../core/args');
const { grep } = require('../../core/pick');

const USAGE = 'kyta ecatalog list <customer> <env> [--grep "chuỗi"]';

async function run(/** @type {string[]} */ argv) {
  const { _, opts } = parseArgs(argv, { value: ['--grep'] });
  const [customer, env] = _;
  if (!customer || !env) usage(USAGE);
  const sess = await api.open(customer, env);
  const all = await api.listCategories(sess);
  const rows = grep(all, opts['--grep'], ['name', 'code']);
  console.log(`${rows.length}/${all.length} danh mục ở ${customer}/${env} (${sess.host}):\n`);
  for (const c of rows) {
    const st = statusLabel(c.status).padEnd(10);
    const ap = applicableLabel(c.applicableStatus).padEnd(12);
    console.log(`  ${String(c.id).padEnd(26)} ${st} ${ap} ${(c.code ? '[' + c.code + ']' : '').padEnd(16)} ${c.name || ''}`);
  }
}

module.exports = { run, usage: USAGE };
