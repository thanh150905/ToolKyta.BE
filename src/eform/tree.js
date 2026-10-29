// @ts-check
'use strict';
// Cây form trên đĩa: workspace/<customer>/<env>/eform/<luồng...>/<form>/
//   code/*.js            code động (PUT /forms/{id}/code) — chứa vân tay formId
//   ui/<field>/          custom UI: index.html + style.css + script.js (nằm trong jsonForm)
//   .meta.json           formId thật, thứ tự file, hashid field, targetFormId (nếu ép đích push)
const fs = require('fs');
const path = require('path');
const paths = require('../core/paths');
const { readJson, writeJson, subdirs, isDir } = require('../core/fsx');
const { extractIds, dominant } = require('./formId');
const { UI_PARTS } = require('./formDef');

const META = '.meta.json';
const UI_FILES = Object.keys(UI_PARTS);

const codeDir = (/** @type {string} */ dir) => path.join(dir, 'code');
const uiDir = (/** @type {string} */ dir) => path.join(dir, 'ui');
const metaPath = (/** @type {string} */ dir) => path.join(dir, META);

/** Form folder = có code/ hoặc .meta.json (git không lưu code/ rỗng của form không có code động). */
const isForm = (/** @type {string} */ dir) => isDir(codeDir(dir)) || fs.existsSync(metaPath(dir));

/**
 * Tất cả form folder, lọc theo nhánh onlyAbs nếu có.
 * @param {string} [onlyAbs]
 */
function listForms(onlyAbs) {
  /** @type {string[]} */ const out = [];
  const walk = (/** @type {string} */ dir) => {
    if (isForm(dir)) out.push(dir);
    for (const n of subdirs(dir)) if (n !== 'code' && n !== 'ui') walk(path.join(dir, n));
  };
  paths.moduleRoots('eform').forEach(walk);
  return onlyAbs ? out.filter(d => d === onlyAbs || d.startsWith(onlyAbs + path.sep)) : out;
}

/** customer / env / luồng / tên form của 1 form folder. */
function locate(/** @type {string} */ dir) {
  const loc = paths.parseWorkspacePath(dir);
  if (!loc || loc.module !== 'eform' || !loc.rest.length) throw new Error(`Không phải thư mục form: ${dir} (cần workspace/<customer>/<env>/eform/...)`);
  return {
    customer: loc.customer, env: loc.env,
    group: loc.rest.slice(0, -1).join('/'), form: loc.rest[loc.rest.length - 1],
    relPath: loc.relPath, repoPath: paths.toRepoRel(path.resolve(dir)),
  };
}

/** Tên file .js trong code/ (đã sort). */
function codeFiles(/** @type {string} */ dir) {
  try { return fs.readdirSync(codeDir(dir)).filter(f => f.endsWith('.js')).sort(); } catch (_) { return []; }
}

/** { 'main.js': nội dung } */
function readCode(/** @type {string} */ dir) {
  /** @type {Record<string, string>} */ const out = {};
  for (const f of codeFiles(dir)) out[f] = fs.readFileSync(path.join(codeDir(dir), f), 'utf8');
  return out;
}

const uiFolders = (/** @type {string} */ dir) => subdirs(uiDir(dir));

/** { '<field>/index.html': nội dung } — chỉ file tồn tại. */
function readUi(/** @type {string} */ dir) {
  /** @type {Record<string, string>} */ const out = {};
  for (const folder of uiFolders(dir)) {
    for (const f of UI_FILES) {
      const fp = path.join(uiDir(dir), folder, f);
      if (fs.existsSync(fp)) out[`${folder}/${f}`] = fs.readFileSync(fp, 'utf8');
    }
  }
  return out;
}

/** .meta.json của form; null nếu thiếu hoặc hỏng (dùng metaBroken để phân biệt). */
const readMeta = (/** @type {string} */ dir) => readJson(metaPath(dir), null);
const metaBroken = (/** @type {string} */ dir) => fs.existsSync(metaPath(dir)) && readMeta(dir) === null;
const writeMeta = (/** @type {string} */ dir, /** @type {any} */ meta) => writeJson(metaPath(dir), meta);

/** Vân tay: formId xuất hiện nhiều nhất trong code/. */
function fingerprint(/** @type {string} */ dir) {
  /** @type {Record<string, number>} */ const total = {};
  for (const code of Object.values(readCode(dir))) {
    const c = extractIds(code);
    for (const id in c) total[id] = (total[id] || 0) + c[id];
  }
  return dominant(total);
}

/**
 * Hai loại id của 1 form folder:
 *  - target  : đích push  = targetFormId > vân tay > meta.formId
 *  - identity: form CỦA thư mục này (tra snapshot, diff) = targetFormId > meta.formId > vân tay
 * Khác nhau khi code nhúng token của form khác (form copy / dùng chung field).
 */
function ids(/** @type {string} */ dir) {
  const meta = readMeta(dir) || {};
  const fp = fingerprint(dir);
  return {
    target: meta.targetFormId || fp.id || meta.formId || null,
    identity: meta.targetFormId || meta.formId || fp.id || null,
    fingerprint: fp, meta,
  };
}

/** formId server khai trong .meta.json (targetFormId, formId) — danh tính thật, KHÔNG suy từ vân tay code. */
function metaIds(/** @type {string} */ dir) {
  const m = readMeta(dir) || {};
  return [...new Set([m.targetFormId, m.formId].filter(Boolean))];
}

/**
 * formId → các thư mục form của 1 customer/env khai formId đó trong .meta.json.
 * Đây là cách định vị đúng khi pull: vân tay code sai với form copy / form cha nhúng token form con.
 * @returns {Map<string, string[]>}
 */
function metaIndex(/** @type {string} */ customer, /** @type {string} */ env) {
  /** @type {Map<string, string[]>} */ const out = new Map();
  const add = (/** @type {string} */ id, /** @type {string} */ d) => { const a = out.get(id) || []; a.push(d); out.set(id, a); };
  const dirs = listForms(paths.moduleDir(customer, env, 'eform'));
  // Lượt 1: danh tính chính (targetFormId || formId). Lượt 2: formId phụ (khi có targetFormId khác) chỉ dùng nếu
  // không thư mục nào nhận id đó làm danh tính chính — formId phụ thường là id cũ / id form gốc của bản copy.
  for (const d of dirs) { const [primary] = metaIds(d); if (primary) add(primary, d); }
  const primaries = new Set(out.keys());
  for (const d of dirs) for (const id of metaIds(d).slice(1)) if (!primaries.has(id)) add(id, d);
  return out;
}

module.exports = {
  META, UI_FILES, codeDir, uiDir, metaPath, isForm, listForms, locate,
  codeFiles, readCode, uiFolders, readUi, readMeta, metaBroken, writeMeta, fingerprint, ids,
  metaIds, metaIndex,
};
