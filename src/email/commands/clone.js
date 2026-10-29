// @ts-check
'use strict';
// Tạo mẫu mới = bản sao 1 mẫu có sẵn (đổi tên, trạng thái draft) rồi kéo về local.
const api = require('../api');
const sync = require('../../core/sync');
const store = require('../../core/store');
const { idOf } = require('../../core/http');
const { SPEC } = require('../template');
const { parseArgs, usage } = require('../../core/args');

const USAGE = 'kyta email clone <srcId> <customer> <env> --name "Tên mới"';

async function run(/** @type {string[]} */ argv) {
  const { _, opts } = parseArgs(argv, { value: ['--name'] });
  const [srcId, customer, env] = _;
  const name = opts['--name'];
  if (!srcId || !customer || !env || !name) usage(USAGE);

  const sess = await api.open(customer, env);
  const src = await api.getOne(sess, srcId);
  if (!src || !src.content) throw new Error(`Không đọc được mẫu nguồn ${srcId}.`);
  console.log(`Clone ${srcId} → "${name}"  (${customer}/${env})`);
  const created = await api.create(sess, {
    name, content: src.content, status: 'draft', isFavourite: false,
    typeSend: src.typeSend || 'email', typeCreate: src.typeCreate || 'html',
    alias: src.alias || null, variables: src.variables || [], dataMailMerge: src.dataMailMerge || [],
  });
  const newId = idOf(created);
  if (!newId) return console.log('  ⚠ đã tạo nhưng không rõ id trả về: ' + JSON.stringify(created).slice(0, 120));
  store.audit({ op: 'email-clone', id: newId, from: srcId, customer, env });
  console.log(`  ✓ mẫu mới: ${newId}`);
  await sync.pull(SPEC, sess, [newId], id => api.getOne(sess, id));
}

module.exports = { run, usage: USAGE };
