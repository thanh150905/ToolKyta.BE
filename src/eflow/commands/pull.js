// @ts-check
'use strict';
const api = require('../api');
const sync = require('../../core/sync');
const { SPEC, resolveJsonXml } = require('../modeler');
const { parseArgs, usage } = require('../../core/args');

const USAGE = 'kyta eflow pull <customer> <env> <id...> | --all';

async function run(/** @type {string[]} */ argv) {
  const { _, flags } = parseArgs(argv);
  const [customer, env, ...ids] = _;
  const all = flags.has('--all');
  if (!customer || !env || (!all && !ids.length)) usage(USAGE);
  const sess = await api.open(customer, env);
  console.log(`Kéo quy trình từ ${sess.host}  (${customer}/${env})`);
  const targets = all ? (await api.list(sess)).map(m => m.id) : ids;
  if (all) console.log(`--all: ${targets.length} quy trình.`);
  // jsonXml lưu S3 (URL) → kéo nội dung thật về flow.json, URL giữ ở .meta.json (jsonXmlUrl).
  await sync.pull(SPEC, sess, targets, async id => resolveJsonXml(await api.getOne(sess, id)));
}

module.exports = { run, usage: USAGE };
