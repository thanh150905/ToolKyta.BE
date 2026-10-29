// @ts-check
'use strict';
// Đổi trạng thái tài liệu: nháp | sẵn sàng | cuối cùng (0|1|2). Ghi qua updateResource (full object).
const api = require('../api');
const coreStore = require('../../core/store');
const { STATUS_LABEL, parseStatus } = require('../status');
const { parseArgs, usage } = require('../../core/args');
const { pickOne } = require('../../core/pick');

const USAGE = 'kyta ewriter status <customer> <env> <id|tên> <nháp|sẵn sàng|cuối cùng> [--dry-run]';

async function run(/** @type {string[]} */ argv) {
  const { _, flags } = parseArgs(argv);
  const [customer, env, ref, state] = _;
  if (!customer || !env || !ref || state === undefined) usage(USAGE);
  const code = parseStatus(state);
  if (code === null) usage(USAGE + '\n  trạng thái: nháp(0) | sẵn sàng(1) | cuối cùng(2)');

  const sess = await api.open(customer, env);
  const list = await api.list(sess);
  const brief = pickOne(list, ref, {
    what: 'tài liệu', id: x => x.id, names: x => [x.name],
    show: x => `${x.id}  ${x.name}`,
  });
  const doc = await api.details(sess, brief.id, brief.resourceId);
  if (doc.status === code) return console.log(`  (đã là "${STATUS_LABEL[code]}" rồi.)`);
  console.log(`Đổi trạng thái "${doc.name}"  ${STATUS_LABEL[doc.status] || doc.status} → ${STATUS_LABEL[code]}${flags.has('--dry-run') ? '   [DRY-RUN]' : ''}`);
  if (flags.has('--dry-run')) return;

  await api.updateResource(sess, { ...doc, status: code });
  coreStore.audit({ op: 'ewriter-status', id: brief.id, customer, env, status: code });
  console.log('  ✓ đã đổi.');
}

module.exports = { run, usage: USAGE };
