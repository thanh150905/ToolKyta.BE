// @ts-check
'use strict';
const api = require('../api');
const modeler = require('../modeler');
const { parseArgs, usage } = require('../../core/args');
const { grep } = require('../../core/pick');

const USAGE = 'kyta eflow nodes <customer> <env> <quy trình> [--grep "x"] [--all]';

async function run(/** @type {string[]} */ argv) {
  const { _, flags, opts } = parseArgs(argv, { value: ['--grep'] });
  const [customer, env, ref] = _;
  if (!customer || !env || !ref) usage(USAGE);
  const sess = await api.open(customer, env);
  const loaded = await modeler.load(sess, ref);
  const all = flags.has('--all');
  const nodes = grep(all ? loaded.nodes : loaded.nodes.filter(n => !modeler.NON_TASK.has(n.stencil)), opts['--grep'], ['name']);
  console.log(`Node của "${loaded.name}" (${loaded.id}): ${nodes.length}${all ? '' : ' node tác vụ'}\n`);
  for (const n of nodes) console.log(`  ${String(n.rid).padEnd(40)} [${String(n.stencil).padEnd(14)}] ${n.name}`);
}

module.exports = { run, usage: USAGE };
