// @ts-check
'use strict';
// Đường dẫn chuẩn của repo. Dữ liệu theo khách hàng: workspace/<customer>/<env>/<module>/...
const path = require('path');
const { safeName, subdirs, isDir } = require('./fsx');

const REPO = path.resolve(__dirname, '..', '..');
const WORKSPACE = path.join(REPO, 'workspace');
const CONFIG = path.join(REPO, 'config');
const STATE = path.join(REPO, '.kyta');   // dữ liệu cục bộ theo máy (gitignore)
const REGISTRY_FILE = path.join(WORKSPACE, 'registry.json');

/** @typedef {'eform'|'eflow'|'email'|'ewriter'|'ecatalog'} Module */

/** workspace/<customer>/<env>/<module> */
const moduleDir = (/** @type {string} */ customer, /** @type {string} */ env, /** @type {Module} */ module) =>
  path.join(WORKSPACE, safeName(customer), safeName(env), module);

/**
 * Các thư mục gốc của 1 phân hệ, lọc theo customer/env nếu có.
 * @param {Module} module
 * @param {string} [customer]
 * @param {string} [env]
 */
function moduleRoots(module, customer, env) {
  const out = [];
  for (const c of customer ? [safeName(customer)] : subdirs(WORKSPACE)) {
    for (const e of env ? [safeName(env)] : subdirs(path.join(WORKSPACE, c))) {
      const d = path.join(WORKSPACE, c, e, module);
      if (isDir(d)) out.push(d);
    }
  }
  return out;
}

/**
 * Tách đường dẫn trong workspace → { customer, env, module, rest }. Ngoài workspace → null.
 * @param {string} p
 */
function parseWorkspacePath(p) {
  const rel = path.relative(WORKSPACE, path.resolve(p));
  if (!rel || rel.startsWith('..') || path.isAbsolute(rel)) return null;
  const [customer, env, module, ...rest] = rel.split(path.sep);
  return { customer, env, module, rest, relPath: rel.split(path.sep).join('/') };
}

/** Đường dẫn tương đối từ gốc repo, dùng dấu "/". */
const toRepoRel = (/** @type {string} */ abs) => path.relative(REPO, abs).split(path.sep).join('/');

module.exports = { REPO, WORKSPACE, CONFIG, STATE, REGISTRY_FILE, moduleDir, moduleRoots, parseWorkspacePath, toRepoRel };
