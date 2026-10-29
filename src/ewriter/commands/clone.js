// @ts-check
'use strict';
// Nhân bản 1 tài liệu bản in (đổi tên). API: POST documents/duplicate?id=&name=&resourceParentId= (query string).
const api = require('../api');
const coreStore = require('../../core/store');
const { idOf } = require('../../core/http');
const { parseArgs, usage } = require('../../core/args');
const { pickOne } = require('../../core/pick');

const USAGE = 'kyta ewriter clone <customer> <env> <id|tên nguồn> --name "Tên mới"';

async function run(/** @type {string[]} */ argv) {
  const { _, opts } = parseArgs(argv, { value: ['--name'] });
  const [customer, env, ref] = _;
  const name = opts['--name'];
  if (!customer || !env || !ref || !name) usage(USAGE);

  const sess = await api.open(customer, env);
  const list = await api.list(sess);
  const src = pickOne(list, ref, {
    what: 'tài liệu', id: x => x.id, names: x => [x.name],
    show: x => `${x.id}  ${x.name}`,
  });
  console.log(`Clone "${src.name}" → "${name}"  (${customer}/${env})`);
  const created = await api.duplicate(sess, { id: src.id, name, resourceParentId: src.resourceParentId });
  const newId = idOf(created) || created?.id || null;
  coreStore.audit({ op: 'ewriter-clone', from: src.id, id: newId, customer, env });
  console.log(newId ? `  ✓ tài liệu mới: ${newId}` : `  ✓ đã tạo (id không rõ trong phản hồi: ${JSON.stringify(created).slice(0, 120)})`);
}

module.exports = { run, usage: USAGE };
