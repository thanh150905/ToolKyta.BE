// @ts-check
'use strict';
// Chặn commit nhầm môi trường (chạy ở pre-commit). Không truyền path → kiểm tra các form có file đang staged.
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const inspect = require('../inspect');
const paths = require('../../core/paths');

const USAGE = 'kyta eform guard [<path>...]';
const STAGED_RE = /^workspace\/[^/]+\/[^/]+\/eform\/.+(\.js|\/\.meta\.json)$/;

/** Form folder chứa 1 file: cắt tại code/ hoặc ui/, còn lại là thư mục chứa file. */
function formDirOf(/** @type {string} */ file) {
  const abs = path.resolve(file);
  const parts = abs.split(path.sep);
  const cut = parts.lastIndexOf('code') > 0 ? parts.lastIndexOf('code') : parts.lastIndexOf('ui');
  return fs.existsSync(abs) && fs.statSync(abs).isDirectory() ? abs : cut > 0 ? parts.slice(0, cut).join(path.sep) : path.dirname(abs);
}

function stagedFiles() {
  try {
    // -z: không bị git quote tên file có dấu tiếng Việt (quote thì regex không khớp → bỏ sót).
    return execSync('git diff --cached --name-only -z --diff-filter=ACMR', { cwd: paths.REPO, encoding: 'utf8' })
      .split('\0').filter(f => STAGED_RE.test(f)).map(f => path.join(paths.REPO, f));
  } catch (_) { return []; }
}

function run(/** @type {string[]} */ argv) {
  const files = argv.length ? argv : stagedFiles();
  if (!files.length) return console.log('guard: không có file eform nào để kiểm tra.');
  const dirs = new Set(files.map(formDirOf));
  // Thư mục cha (vd cả 1 env) → kiểm tra mọi form bên trong.
  const states = inspect.listStates().filter(s => [...dirs].some(d => s.dir === d || s.dir.startsWith(d + path.sep)));

  let errors = 0, warns = 0;
  for (const st of states) {
    const level = inspect.LEVEL[st.guard];
    if (level === 'ok') continue;
    if (level === 'error') errors++; else warns++;
    console.log(`${level === 'error' ? '✗' : '⚠'} ${st.relPath}\n    ${st.why}`);
  }
  console.log(`\nguard: ${states.length} form, ${errors} lỗi, ${warns} cảnh báo.`);
  if (errors) process.exitCode = 1;
}

module.exports = { run, usage: USAGE };
