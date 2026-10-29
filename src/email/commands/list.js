// @ts-check
'use strict';
const api = require('../api');
const { parseArgs, usage } = require('../../core/args');
const { grep } = require('../../core/pick');

const USAGE = 'kyta email list <customer> <env> [--grep "chuỗi"]';

async function run(/** @type {string[]} */ argv) {
  const { _, opts } = parseArgs(argv, { value: ['--grep'] });
  const [customer, env] = _;
  if (!customer || !env) usage(USAGE);
  const sess = await api.open(customer, env);
  const all = await api.list(sess);
  const rows = grep(all, opts['--grep'], ['name']);
  console.log(`${rows.length}/${all.length} mẫu mail ở ${customer}/${env} (${sess.host}):\n`);
  for (const t of rows) console.log(`  ${String(t.id).padEnd(20)} ${String(t.typeCreate || '').padEnd(5)} ${String(t.status || '').padEnd(8)} ${t.name || ''}`);
}

module.exports = { run, usage: USAGE };
