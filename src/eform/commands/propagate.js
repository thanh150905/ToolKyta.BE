// @ts-check
'use strict';
// Lan thay đổi của 1 form con sang MỌI form cha nhúng nó (child_form) — thay các script reselect_* một lần.
// Form cha lấy từ đồ thị workspace; mỗi form cha refresh như `childform refresh` (giữ hashid/readonly,
// embed.overrides.json, chặn drift). Form bị chặn không ảnh hưởng form khác; cuối cùng in tổng kết.
const path = require('path');
const tree = require('../tree');
const inspect = require('../inspect');
const graph = require('../../graph');
const { parseArgs, usage, splitList } = require('../../core/args');
const { refreshParent } = require('./childform');

const USAGE = [
  'kyta eform propagate <thư mục form con> [--only <regex>] [--keep value,display,...] [--dry-run] [--force] [--yes-prod]',
  '',
  '  Dùng bản SERVER của form con (push form con trước). Form cha = mọi form nhúng nó trong workspace (kyta where <form con>).',
  '  --only   chỉ form cha có đường dẫn khớp regex.   --force  vẫn lan khi form cha drift (mất field chỉ có ở bản nhúng).',
  '  Mỗi form cha: giữ hashid + readonly/disabled bản nhúng, áp <form-cha>/embed.overrides.json, backup trước khi ghi.',
].join('\n');

async function run(/** @type {string[]} */ argv) {
  const { _, flags, opts } = parseArgs(argv, { value: ['--only', '--keep'] });
  if (!_[0]) usage(USAGE);
  const childDir = path.resolve(_[0]);
  if (!tree.isForm(childDir)) throw new Error('Không phải thư mục form: ' + _[0]);
  const childId = tree.metaIds(childDir)[0];
  if (!childId) throw new Error('.meta.json của form con không khai formId.');
  const loc = tree.locate(childDir);

  const st = inspect.formState(childDir);
  if (st.status === 'modified') console.log('⚠ form con còn sửa cục bộ chưa push — propagate dùng bản SERVER. Push form con trước nếu cần.\n');

  const only = opts['--only'] ? new RegExp(opts['--only']) : null;
  const parents = graph.load(loc.customer, loc.env).parentsOf(childId).filter(p => !only || only.test(p.rel));
  if (!parents.length) return console.log(`Không có form cha nào nhúng ${childId}${only ? ' (khớp --only)' : ''}.`);
  console.log(`Lan ${childId} (${loc.relPath}) → ${parents.length} form cha${flags.has('--dry-run') ? '   [DRY-RUN]' : ''}\n`);

  const keep = splitList(opts['--keep']);
  /** @type {Record<'updated'|'same'|'blocked'|'error', string[]>} */ const sum = { updated: [], same: [], blocked: [], error: [] };
  for (const [i, p] of parents.entries()) {
    const rel = tree.locate(p.dir).relPath;
    console.log(`[${i + 1}/${parents.length}] ${rel}`);
    try {
      const r = await refreshParent(p.dir, { flags, keep, childId });
      if (r.blocked) sum.blocked.push(rel);
      else if (r.changed) sum.updated.push(rel);
      else sum.same.push(rel);
    } catch (e) { console.log(`  ✗ ${e.message}`); sum.error.push(rel); }
  }
  graph.invalidate();

  const dry = flags.has('--dry-run');
  console.log(`\n${dry ? '[DRY-RUN] ' : ''}Tổng kết: ${sum.updated.length} ${dry ? 'sẽ cập nhật' : 'đã cập nhật'}, ${sum.same.length} đã khớp, ${sum.blocked.length} bị chặn (drift), ${sum.error.length} lỗi.`);
  for (const r of sum.blocked) console.log('  chặn: ' + r);
  for (const r of sum.error) console.log('  lỗi : ' + r);
  if (sum.blocked.length || sum.error.length) process.exitCode = 1;
}

module.exports = { run, usage: USAGE };
