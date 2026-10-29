// @ts-check
'use strict';
const api = require('../api');
const { parseArgs, usage } = require('../../core/args');
const { grep } = require('../../core/pick');

const USAGE = 'kyta eflow list <customer> <env> [--grep "chuỗi"]';

async function run(/** @type {string[]} */ argv) {
  const { _, opts } = parseArgs(argv, { value: ['--grep'] });
  const [customer, env] = _;
  if (!customer || !env) usage(USAGE);
  const sess = await api.open(customer, env);
  const all = await api.list(sess);
  const rows = grep(all, opts['--grep'], ['name', 'keyValue']);
  console.log(`${rows.length}/${all.length} quy trình ở ${customer}/${env} (${sess.host}):\n`);
  for (const m of rows) {
    const pub = String(m.status) === 'true' ? 'active' : 'off';
    const apr = String(m.approved) === 'true' ? 'approved' : '-';
    console.log(`  ${String(m.id).padEnd(20)} ${String(m.keyValue || '').padEnd(22)} ${pub.padEnd(7)} ${apr.padEnd(9)} ${m.name || ''}`);
  }
}

module.exports = { run, usage: USAGE };
