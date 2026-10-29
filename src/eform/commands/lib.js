// @ts-check
'use strict';
// Khối code dùng chung (marker // ===== [TÊN]) trong code/*.js và ui/<field>/script.js
// ↔ nguồn gốc workspace/<customer>/<env>/lib/<TÊN>.js.
//   lib list    — mỗi khối: bao nhiêu form, mấy biến thể, đã có lib chưa, bao nhiêu form lệch lib
//   lib extract — tạo lib từ biến thể duy nhất (hoặc từ 1 form chỉ định)
//   lib sync    — ghi thân khối từ lib vào mọi form có marker (thay {{@tham_số}} bằng @params từng form)
const fs = require('fs');
const path = require('path');
const tree = require('../tree');
const blocks = require('../blocks');
const paths = require('../../core/paths');
const { writeText, hash } = require('../../core/fsx');
const { parseArgs, usage } = require('../../core/args');

const USAGE = [
  'kyta eform lib list    <customer> <env>',
  'kyta eform lib extract <customer> <env> <TÊN> [--from <form-folder>] [--force]',
  'kyta eform lib sync    <customer> <env> <TÊN|--all> [--dry-run] [--push]',
  '',
  '  Khối: // ===== [TÊN] mô tả  @params {"k":"v"}  ...  // ===== [/TÊN] =====   (code/*.js + ui/<field>/script.js)',
  '  Lib : workspace/<customer>/<env>/lib/<TÊN>.js — {{@k}} được thay bằng @params của từng form.',
  '  sync chỉ ghi local; --push đẩy code các form vừa đổi (push --code-only, đủ rào chắn).',
].join('\n');

/**
 * File JS có thể chứa khối: code/*.js (code động) + ui/<field>/script.js (widget — bản copy ở form cha).
 * @returns {{ dir: string, file: string, kind: 'code'|'ui' }[]}
 */
function jsFiles(/** @type {string} */ customer, /** @type {string} */ env) {
  /** @type {{ dir: string, file: string, kind: 'code'|'ui' }[]} */ const out = [];
  for (const dir of tree.listForms(paths.moduleDir(customer, env, 'eform'))) {
    for (const f of tree.codeFiles(dir)) out.push({ dir, file: path.join(tree.codeDir(dir), f), kind: 'code' });
    for (const u of tree.uiFolders(dir)) {
      const file = path.join(tree.uiDir(dir), u, 'script.js');
      if (fs.existsSync(file)) out.push({ dir, file, kind: 'ui' });
    }
  }
  return out;
}

/**
 * Mọi khối trong code + widget của 1 customer/env.
 * @returns {{ name: string, dir: string, file: string, kind: 'code'|'ui', block: import('../blocks').Block, text: string }[]}
 */
function scan(/** @type {string} */ customer, /** @type {string} */ env) {
  const out = [];
  for (const { dir, file, kind } of jsFiles(customer, env)) {
    const text = fs.readFileSync(file, 'utf8');
    for (const block of blocks.parse(text).blocks) out.push({ name: block.name, dir, file, kind, block, text });
  }
  return out;
}

/** Khối có marker mở mà thiếu marker đóng. */
function brokenMarkers(/** @type {string} */ customer, /** @type {string} */ env) {
  const out = [];
  for (const { file } of jsFiles(customer, env)) {
    for (const name of blocks.parse(fs.readFileSync(file, 'utf8')).broken) out.push({ name, file });
  }
  return out;
}

/**
 * Trạng thái 1 khối của 1 form so với lib: 'ok' | 'drift' | 'error' (thiếu/sai @params) | 'no-lib'.
 * @param {string|null} lib
 * @param {import('../blocks').Block} block
 */
function blockState(lib, block) {
  if (lib == null) return { state: 'no-lib', expected: null, error: null };
  if (block.paramError) return { state: 'error', expected: null, error: block.paramError };
  try {
    const expected = blocks.render(lib, block.params);
    return { state: expected === block.body ? 'ok' : 'drift', expected, error: null };
  } catch (e) { return { state: 'error', expected: null, error: e.message }; }
}

function list(/** @type {string} */ customer, /** @type {string} */ env) {
  const all = scan(customer, env);
  /** @type {Map<string, typeof all>} */ const byName = new Map();
  for (const b of all) { const a = byName.get(b.name) || []; a.push(b); byName.set(b.name, a); }
  if (!byName.size) return console.log(`Không có khối marker nào trong ${customer}/${env}.`);
  console.log(`${'KHỐI'.padEnd(22)} ${'FORM'.padStart(4)} ${'BIẾN THỂ'.padStart(8)}  LIB`);
  for (const [name, arr] of [...byName].sort((a, b) => b[1].length - a[1].length)) {
    const variants = new Set(arr.map(b => hash(b.block.body))).size;
    const lib = blocks.readLib(customer, env, name);
    let libCol = 'chưa có';
    if (lib != null) {
      const st = arr.map(b => blockState(lib, b.block).state);
      const drift = st.filter(s => s === 'drift').length, err = st.filter(s => s === 'error').length;
      libCol = drift || err ? `${drift} form lệch${err ? `, ${err} lỗi @params` : ''} → lib sync` : 'khớp';
    }
    console.log(`${name.padEnd(22)} ${String(arr.length).padStart(4)} ${String(variants).padStart(8)}  ${libCol}`);
  }
  for (const b of brokenMarkers(customer, env)) console.log(`  ⚠ [${b.name}] thiếu marker đóng: ${paths.toRepoRel(b.file)}`);
  console.log(`\nLib: ${paths.toRepoRel(blocks.libDir(customer, env))}/<TÊN>.js — tạo bằng: kyta eform lib extract ${customer} ${env} <TÊN>`);
}

function extract(/** @type {string} */ customer, /** @type {string} */ env, /** @type {string} */ name, /** @type {Record<string,string>} */ opts, /** @type {Set<string>} */ flags) {
  const fp = blocks.libPath(customer, env, name);
  if (fs.existsSync(fp) && !flags.has('--force')) throw new Error(`${paths.toRepoRel(fp)} đã có — thêm --force để ghi đè.`);
  const arr = scan(customer, env).filter(b => b.name === name);
  if (!arr.length) throw new Error(`Không form nào có khối [${name}].`);
  let src;
  if (opts['--from']) {
    const dir = path.resolve(opts['--from']);
    src = arr.find(b => b.dir === dir);
    if (!src) throw new Error(`${opts['--from']} không có khối [${name}].`);
  } else {
    /** @type {Map<string, typeof arr>} */ const byBody = new Map();
    for (const b of arr) { const k = hash(b.block.body); byBody.set(k, [...(byBody.get(k) || []), b]); }
    if (byBody.size > 1) {
      const lines = [...byBody.values()].sort((a, b) => b.length - a.length).map(v => `    ${v.length} form, vd: ${tree.locate(v[0].dir).relPath}`);
      throw new Error(`[${name}] có ${byBody.size} biến thể — chọn bản gốc bằng --from <form-folder>:\n${lines.join('\n')}`);
    }
    src = arr[0];
  }
  writeText(fp, src.block.body);
  console.log(`✓ ${paths.toRepoRel(fp)} ← ${tree.locate(src.dir).relPath}`);
  const p = blocks.libParams(src.block.body);
  console.log(p.length ? `  tham số: ${p.join(', ')}` : '  Khối khác nhau theo form? Thay phần riêng bằng {{@tên}} trong lib, khai @params {"tên":...} ở dòng marker từng form.');
}

async function sync(/** @type {string} */ customer, /** @type {string} */ env, /** @type {string|null} */ only, /** @type {Set<string>} */ flags) {
  const dryRun = flags.has('--dry-run');
  const all = scan(customer, env).filter(b => !only || b.name === only);
  const names = [...new Set(all.map(b => b.name))].filter(n => blocks.readLib(customer, env, n) != null);
  if (only && !names.length) throw new Error(`Chưa có lib cho [${only}] — chạy: kyta eform lib extract ${customer} ${env} ${only}`);
  /** @type {Map<string, string>} */ const pending = new Map();   // file → nội dung mới
  /** @type {Map<string, Set<string>>} */ const changedDirs = new Map();   // form → {code, ui}
  let errors = 0;
  for (const b of all) {
    if (!names.includes(b.name)) continue;
    const st = blockState(blocks.readLib(customer, env, b.name), b.block);
    const rel = tree.locate(b.dir).relPath;
    if (st.state === 'error') { console.log(`  ✗ [${b.name}] ${rel}: ${st.error}`); errors++; continue; }
    if (st.state !== 'drift') continue;
    // Nhiều khối trong cùng 1 file: thay trên bản đang chờ ghi, parse lại để lấy vị trí mới.
    const cur = pending.get(b.file) ?? b.text;
    const blk = blocks.parse(cur).blocks.find(x => x.name === b.name && x.header === b.block.header);
    if (!blk) continue;
    pending.set(b.file, blocks.replaceBody(cur, blk, /** @type {string} */ (st.expected)));
    changedDirs.set(b.dir, (changedDirs.get(b.dir) || new Set()).add(b.kind));
    console.log(`  ${dryRun ? '~' : '✓'} [${b.name}] ${rel}/${path.relative(b.dir, b.file).split(path.sep).join('/')}`);
  }
  if (!dryRun) for (const [file, text] of pending) writeText(file, text);
  console.log(`\n${dryRun ? '[DRY-RUN] sẽ đổi' : 'Đã đổi'} ${pending.size} file / ${changedDirs.size} form${errors ? `, ${errors} lỗi @params` : ''}.`);
  if (errors) process.exitCode = 1;
  if (dryRun || !changedDirs.size) return;
  if (!flags.has('--push')) {
    console.log('Đẩy lên: thêm --push, hoặc từng form: kyta eform push <form> --code-only / --ui-only');
    return;
  }
  const push = require('./push');
  for (const [dir, kinds] of changedDirs) {
    console.log(`\n→ push ${tree.locate(dir).relPath}`);
    for (const k of kinds) {
      try { await push.run([dir, k === 'code' ? '--code-only' : '--ui-only']); } catch (e) { console.log('  ✗ ' + e.message); process.exitCode = 1; }
    }
  }
}

async function run(/** @type {string[]} */ argv) {
  const sub = argv[0];
  const { _, flags, opts } = parseArgs(argv.slice(1), { value: ['--from'] });
  const [customer, env, name] = _;
  if (!sub || !['list', 'extract', 'sync'].includes(sub) || !customer || !env) usage(USAGE);
  if (sub === 'list') return list(customer, env);
  if (sub === 'extract') return extract(customer, env, name || usage(USAGE), opts, flags);
  if (!name && !flags.has('--all')) usage(USAGE);
  return sync(customer, env, flags.has('--all') ? null : name, flags);
}

module.exports = { run, usage: USAGE, scan, blockState, brokenMarkers };
