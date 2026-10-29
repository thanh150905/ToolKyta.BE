// @ts-check
'use strict';
// Kiểm tĩnh code động + widget (offline, không gọi mạng):
//   token  {{<formId>_<key>}}: lỗi khi key không có ở cả form đang xét (gồm bản nhúng) lẫn form <formId> —
//          tham chiếu chết (field đã xoá/đổi key). Form đích chưa pull / thiếu fields.json → cảnh báo.
//   lib    khối marker thiếu marker đóng / sai @params (lỗi), lệch lib (cảnh báo).
const fs = require('fs');
const path = require('path');
const tree = require('../tree');
const blocks = require('../blocks');
const graph = require('../../graph');
const paths = require('../../core/paths');
const { parseArgs } = require('../../core/args');
const { blockState } = require('./lib');

const USAGE = 'kyta eform lint [<path>...] [--errors-only]   (không path → các form có file eForm đang staged; "." → cả workspace)';

const TOKEN_RX = /\{\{(0000[0-9A-Za-z]+)_([^}\s]+)\}\}/g;
// Container bố cục không vào fields.json nhưng vẫn là node hợp lệ.
const LAYOUT_KEY_RX = /^(page|columns|row)-\d+$/;

/** @typedef {{ level: 'error'|'warn', file: string, msg: string }} Issue */

/**
 * Key hợp lệ của 1 form theo fields.json: { byId: id đầy đủ, byKey: key ngắn }.
 * @param {graph.FormNode|null} f
 */
function keysOf(f) {
  const byId = new Set(), byKey = new Set();
  for (const e of f?.doc?.fields || []) { if (e.id) byId.add(e.id); if (e.key) byKey.add(e.key); }
  return { byId, byKey };
}

/**
 * Lint 1 form.
 * @param {graph.Graph} g
 * @param {graph.FormNode} form
 * @returns {Issue[]}
 */
function lintForm(g, form) {
  /** @type {Issue[]} */ const out = [];
  const own = keysOf(form);
  /** @type {Set<string>} */ const noDoc = new Set();   // form thiếu fields.json → không kiểm được token của nó
  /** @type {Map<string, number>} */ const notPulled = new Map();   // formId được tham chiếu nhưng chưa pull
  /** @type {Map<string, ReturnType<typeof keysOf>>} */ const cache = new Map();
  const files = [
    ...tree.codeFiles(form.dir).map(f => path.join(tree.codeDir(form.dir), f)),
    ...tree.uiFolders(form.dir).flatMap(u => ['script.js', 'index.html'].map(f => path.join(tree.uiDir(form.dir), u, f))).filter(f => fs.existsSync(f)),
  ];
  for (const file of files) {
    const text = fs.readFileSync(file, 'utf8');
    const rel = paths.toRepoRel(file);
    /** @type {Set<string>} */ const seen = new Set();
    for (const m of text.matchAll(TOKEN_RX)) {
      const [tok, fid, key] = m;
      if (seen.has(tok) || LAYOUT_KEY_RX.test(key)) continue;
      seen.add(tok);
      const id = `${fid}_${key}`;
      // Form copy/clone giữ id node của form gốc nên token có thể mang prefix form khác; chỉ coi là lỗi khi key
      // không có ở CẢ form đang xét lẫn form đích (tham chiếu chết chắc chắn).
      if (own.byId.has(id) || own.byKey.has(key)) continue;
      const target = g.form(fid);
      if (target && !target.doc) { noDoc.add(target.rel); continue; }
      if (!target) {
        if (!form.ids.includes(fid)) notPulled.set(fid, (notPulled.get(fid) || 0) + 1);
        else if (!form.doc) noDoc.add(form.rel);
        else if (!own.byKey.has(key)) out.push({ level: 'error', file: rel, msg: `${tok}: form này không có field "${key}".` });
        continue;
      }
      let k = cache.get(fid);
      if (!k) { k = keysOf(target); cache.set(fid, k); }
      if (k.byId.has(id) || k.byKey.has(key)) continue;
      out.push({ level: 'error', file: rel, msg: `${tok}: form ${fid} (${target.rel.replace(/^workspace\//, '')}) không có field "${key}" — đã xoá/đổi key?` });
    }
    for (const name of blocks.parse(text).broken) out.push({ level: 'error', file: rel, msg: `khối [${name}] thiếu marker đóng // ===== [/${name}]` });
    if (!file.endsWith('.js')) continue;
    for (const b of blocks.parse(text).blocks) {
      const st = blockState(blocks.readLib(g.customer, g.env, b.name), b);
      if (st.state === 'error') out.push({ level: 'error', file: rel, msg: `khối [${b.name}]: ${st.error}` });
      else if (st.state === 'drift') out.push({ level: 'warn', file: rel, msg: `khối [${b.name}] lệch lib/${b.name}.js — kyta eform lib sync ${g.customer} ${g.env} ${b.name}` });
    }
  }
  for (const [fid, n] of notPulled) out.push({ level: 'warn', file: form.rel, msg: `${n} token trỏ form ${fid} chưa có trong workspace (chưa pull) — không kiểm được.` });
  for (const r of noDoc) out.push({ level: 'warn', file: form.rel, msg: `${r.replace(/^workspace\//, '')} chưa có fields.json (pull cũ) — bỏ qua kiểm token, pull lại để kiểm.` });
  return out;
}

/**
 * Lint các form dưới 1 tập thư mục. Trả số lỗi/cảnh báo, in ra màn hình.
 * @param {string[]} dirs thư mục form (hoặc thư mục cha)
 * @param {{ errorsOnly?: boolean, quiet?: boolean }} [opt]
 */
function lintDirs(dirs, opt = {}) {
  let errors = 0, warns = 0, forms = 0;
  const abs = dirs.map(d => path.resolve(d));
  for (const s of graph.scopes()) {
    const g = graph.load(s.customer, s.env);
    for (const f of g.forms) {
      if (!abs.some(d => f.dir === d || f.dir.startsWith(d + path.sep) || d === paths.REPO || d === paths.WORKSPACE)) continue;
      forms++;
      const issues = lintForm(g, f).filter(i => !opt.errorsOnly || i.level === 'error');
      if (!issues.length) continue;
      if (!opt.quiet) console.log(`\n${f.rel.replace(/^workspace\//, '')}`);
      for (const i of issues) {
        if (i.level === 'error') errors++; else warns++;
        if (!opt.quiet) console.log(`  ${i.level === 'error' ? '✗' : '⚠'} ${path.posix.relative(f.rel, i.file)}: ${i.msg}`);
      }
    }
  }
  return { errors, warns, forms };
}

/** Thư mục form có file eForm đang staged. */
function stagedFormDirs() {
  try {
    const out = require('child_process').execSync('git diff --cached --name-only -z --diff-filter=ACMR', { cwd: paths.REPO, encoding: 'utf8' });
    const dirs = new Set();
    for (const f of out.split('\0').filter(x => /^workspace\/[^/]+\/[^/]+\/eform\//.test(x))) {
      let d = path.dirname(path.join(paths.REPO, f));
      while (d.length > paths.WORKSPACE.length && !tree.isForm(d)) d = path.dirname(d);
      if (tree.isForm(d)) dirs.add(d);
    }
    return [...dirs];
  } catch (_) { return []; }
}

function run(/** @type {string[]} */ argv) {
  const { _, flags } = parseArgs(argv);
  const dirs = _.length ? _ : stagedFormDirs();
  if (!dirs.length) return console.log('lint: không có form nào để kiểm (truyền path, hoặc "." cho cả workspace).');
  const r = lintDirs(dirs, { errorsOnly: flags.has('--errors-only') });
  console.log(`\nlint: ${r.forms} form — ${r.errors} lỗi, ${r.warns} cảnh báo.`);
  if (r.errors) process.exitCode = 1;
}

module.exports = { run, usage: USAGE, lintForm, lintDirs };
