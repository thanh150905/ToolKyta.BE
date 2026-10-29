// @ts-check
'use strict';
// Form nào đã sửa cục bộ so với snapshot (lần pull/push gần nhất trên máy này) + form có rào chắn.
const path = require('path');
const inspect = require('../inspect');
const fields = require('../fields');

const USAGE = 'kyta eform status [<path>]';

function run(/** @type {string[]} */ argv) {
  const only = argv.find(a => !a.startsWith('--'));
  const states = inspect.listStates(only ? path.resolve(only) : undefined);
  const lines = [];
  let clean = 0, untracked = 0;
  for (const st of states) {
    if (st.status === 'synced') { clean++; continue; }
    if (st.status === 'untracked') { untracked++; lines.push(`  ? ${st.relPath}   (chưa pull trên máy này)`); continue; }
    const parts = [];
    // Delta fields khoá theo hashid → đổi sang key cho dễ đọc.
    const doc = fields.readDoc(st.dir);
    const keyOf = new Map((doc?.fields || []).map(f => [f.hashid || f.key, f.key || f.hashid]));
    const label3 = (/** @type {string[]} */ ids) => ids.map(id => keyOf.get(id) || id);
    for (const [label, d, xf] of [['', st.code], ['ui: ', st.ui], ['fields: ', st.fields, label3]]) {
      const delta = /** @type {import('../inspect').Delta} */ (d);
      const f = /** @type {(a: string[]) => string[]} */ (xf) || ((/** @type {string[]} */ a) => a);
      if (delta.changed.length) parts.push(`~ ${label}${f(delta.changed).join(', ')}`);
      if (delta.added.length) parts.push(`+ ${label}${f(delta.added).join(', ')}`);
      if (delta.removed.length) parts.push(`- ${label}${f(delta.removed).join(', ')}`);
    }
    lines.push(`  M ${st.relPath}\n      ${parts.join('   ')}`);
  }
  const modified = lines.length - untracked;

  if (!lines.length) console.log(`Sạch — không form nào lệch snapshot. (${clean} khớp)`);
  else {
    console.log('Trạng thái local vs snapshot:\n\n' + lines.join('\n'));
    console.log(`\nTổng: ${modified} sửa, ${clean} khớp, ${untracked} chưa theo dõi.`);
  }

  // "no-id" chỉ là thông tin (push dùng formId trong .meta.json) → gộp 1 dòng cho đỡ nhiễu.
  const risky = states.filter(s => inspect.LEVEL[s.guard] !== 'ok' && s.guard !== 'no-id');
  const noId = states.filter(s => s.guard === 'no-id').length;
  if (risky.length) {
    console.log(`\n⚠ ${risky.length} form cần chú ý trước khi push:`);
    for (const st of risky) console.log(`  ! ${st.relPath}\n      ${st.why}`);
  }
  if (noId) console.log(`\nⓘ ${noId} form không có formId trong code (push dùng formId trong .meta.json) — xem: kyta eform guard <path>`);
}

module.exports = { run, usage: USAGE };
