// @ts-check
'use strict';
const store = require('../store');
const input = require('../input');
const { parseArgs, usage } = require('../../core/args');

const USAGE = [
  'kyta eworkspace preset <env> list [--grep "chuỗi"]',
  'kyta eworkspace preset <env> add <dashboard-id...> [--name "Tên"]',
  'kyta eworkspace preset <env> rename <dashboard-id> <tên mới>',
  'kyta eworkspace preset <env> rm <dashboard-id...>',
  'kyta eworkspace preset <env> reset --yes',
].join('\n');

async function run(/** @type {string[]} */ argv) {
  const { _, flags, opts } = parseArgs(argv, { value: ['--grep', '--name'] });
  const [env, action, ...rest] = _;
  if (!env || !action) usage(USAGE);

  if (action === 'list') {
    if (rest.length) usage(USAGE);
    const filter = (opts['--grep'] || '').toLowerCase();
    const rows = store.list(env).filter(d => !filter || (d.id + ' ' + d.name).toLowerCase().includes(filter));
    console.log(rows.length + ' dashboard preset(s) cho ' + env + ':\n');
    for (const d of rows) console.log('  ' + d.id.padEnd(26) + ' ' + (d.name || ''));
    return;
  }
  if (action === 'add') {
    const ids = input.splitIds(rest);
    if (!ids.length) usage(USAGE);
    const result = store.add(env, ids, opts['--name'] || '');
    console.log('Đã thêm ' + result.added + ' dashboard, bỏ qua ' + result.duplicate + ' ID trùng.');
    return;
  }
  if (action === 'rename') {
    const [id, ...name] = rest;
    if (!id || !name.length) usage(USAGE);
    if (!store.rename(env, id, name.join(' '))) throw new Error('Không có dashboard preset ID ' + id + ' trong ' + env + '.');
    console.log('Đã đổi tên dashboard preset ' + id + '.');
    return;
  }
  if (action === 'rm') {
    const ids = input.splitIds(rest);
    if (!ids.length) usage(USAGE);
    console.log('Đã xóa ' + store.remove(env, ids) + ' dashboard preset khỏi danh sách ' + env + '.');
    return;
  }
  if (action === 'reset') {
    if (rest.length) usage(USAGE);
    if (!flags.has('--yes')) { console.log('Khôi phục preset mặc định sẽ bỏ tùy chỉnh local. Thêm --yes để xác nhận.'); process.exitCode = 2; return; }
    const rows = store.reset(env);
    console.log('Đã khôi phục ' + rows.length + ' dashboard preset mặc định cho ' + env + '.');
    return;
  }
  usage(USAGE);
}

module.exports = { run, usage: USAGE };
