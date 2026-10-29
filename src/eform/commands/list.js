// @ts-check
'use strict';
const api = require('../api');
const { parseArgs, usage } = require('../../core/args');
const { grep } = require('../../core/pick');

const USAGE = 'kyta eform list <customer> <env> [--grep "chuỗi"]';

async function run(/** @type {string[]} */ argv) {
  const { _, opts } = parseArgs(argv, { value: ['--grep'] });
  const [customer, env] = _;
  if (!customer || !env) usage(USAGE);
  const sess = await api.open(customer, env);
  const all = await api.findOwned(sess);
  const rows = grep(all, opts['--grep'], ['formName', 'formCode']);
  console.log(`${rows.length}/${all.length} form ở ${customer}/${env} (${sess.host}):\n`);
  for (const f of rows) console.log(`  ${f.formId}  ${String(f.formCode || '').padEnd(16)}  ${f.formName || ''}`);
}

module.exports = { run, usage: USAGE };
