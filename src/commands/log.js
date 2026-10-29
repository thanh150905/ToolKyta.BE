// @ts-check
'use strict';
// Lịch sử thao tác (mọi phân hệ) từ nhật ký cục bộ .kyta/audit.jsonl.
const path = require('path');
const store = require('../core/store');
const paths = require('../core/paths');
const { readJson } = require('../core/fsx');
const { parseArgs } = require('../core/args');

const USAGE = 'kyta log [<thư mục form | quy trình | mẫu mail>] [--limit N]';

/** Id của thư mục: form → targetFormId/formId, quy trình / mẫu mail → id trong .meta.json. */
function idOf(/** @type {string} */ dir) {
  const loc = paths.parseWorkspacePath(dir);
  if (loc?.module === 'eform') return require('../eform/tree').ids(dir).identity;
  return readJson(path.join(dir, '.meta.json'), {}).id || null;
}

function run(/** @type {string[]} */ argv) {
  const { _, opts } = parseArgs(argv, { value: ['--limit'] });
  const limit = Number(opts['--limit']) || 200;
  const id = _[0] ? idOf(path.resolve(_[0])) : null;
  if (_[0] && !id) throw new Error('Không xác định được id từ: ' + _[0]);

  const rows = store.readAudit(10000).filter(e => !id || e.formId === id || e.id === id).slice(0, limit);
  if (!rows.length) return console.log(`Chưa có lịch sử${id ? ' cho ' + id : ''}.`);
  console.log(`Lịch sử${id ? ' ' + id : ''} — ${rows.length} bản ghi, mới nhất trước:\n`);
  for (const e of rows) {
    const when = String(e.at || '').replace('T', ' ').replace(/\.\d+Z$/, '');
    console.log(`  ${when}  ${String(e.op || '?').padEnd(18)} ${e.formId || e.id || ''}  ${e.customer ? e.customer + '/' + e.env : ''}`);
  }
}

module.exports = { run, usage: USAGE };
