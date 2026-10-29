// @ts-check
'use strict';
const api = require('../api');
const sync = require('../../core/sync');
const { SPEC } = require('../template');
const { parseArgs, usage } = require('../../core/args');

const USAGE = 'kyta email pull <customer> <env> <id...> | --all';

async function run(/** @type {string[]} */ argv) {
  const { _, flags } = parseArgs(argv);
  const [customer, env, ...ids] = _;
  const all = flags.has('--all');
  if (!customer || !env || (!all && !ids.length)) usage(USAGE);
  const sess = await api.open(customer, env);
  console.log(`Kéo mẫu mail từ ${sess.host}  (${customer}/${env})`);
  const targets = all ? (await api.list(sess)).map(t => t.id) : ids;
  if (all) console.log(`--all: ${targets.length} mẫu.`);
  await sync.pull(SPEC, sess, targets, id => api.getOne(sess, id));
}

module.exports = { run, usage: USAGE };
