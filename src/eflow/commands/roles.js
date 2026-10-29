// @ts-check
'use strict';
const api = require('../api');
const { parseArgs, usage } = require('../../core/args');
const { grep } = require('../../core/pick');

const USAGE = 'kyta eflow roles <customer> <env> [--grep "x"]';

async function run(/** @type {string[]} */ argv) {
  const { _, opts } = parseArgs(argv, { value: ['--grep'] });
  const [customer, env] = _;
  if (!customer || !env) usage(USAGE);
  const sess = await api.open(customer, env);
  const all = await api.roles(sess);
  const rows = grep(all, opts['--grep'], ['name', 'code']);
  console.log(`${rows.length}/${all.length} role ở ${customer}/${env}:\n`);
  for (const r of rows) console.log(`  ${String(r.id).padEnd(8)} ${String(r.code || '').padEnd(20)} ${r.name || ''}`);
}

module.exports = { run, usage: USAGE };
