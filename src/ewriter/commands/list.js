// @ts-check
'use strict';
const api = require('../api');
const { STATUS_LABEL } = require('../status');
const { parseArgs, usage } = require('../../core/args');
const { grep } = require('../../core/pick');

const USAGE = 'kyta ewriter list <customer> <env> [--grep "chuỗi"]';

async function run(/** @type {string[]} */ argv) {
  const { _, opts } = parseArgs(argv, { value: ['--grep'] });
  const [customer, env] = _;
  if (!customer || !env) usage(USAGE);
  const sess = await api.open(customer, env);
  const all = await api.list(sess);
  const rows = grep(all, opts['--grep'], ['name']);
  console.log(`${rows.length}/${all.length} tài liệu bản in ở ${customer}/${env} (${sess.host}):\n`);
  for (const d of rows) {
    const st = STATUS_LABEL[d.status] || String(d.status ?? '');
    console.log(`  ${String(d.id).padEnd(22)} ${st.padEnd(10)} ${(d.eformId ? 'form:' + d.eformId : '-').padEnd(28)} ${d.name || ''}`);
  }
}

module.exports = { run, usage: USAGE };
