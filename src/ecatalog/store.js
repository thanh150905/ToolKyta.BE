// @ts-check
'use strict';
// Layout local eCatalog: workspace/<customer>/<env>/ecatalog/<tên>/
//   .meta.json   — object category đầy đủ + { customer, env, pulledAt, pulledHash }
//   fields.json  — tóm tắt field (đọc nhanh; nguồn chuẩn vẫn là struct trong .meta.json)
//   data.json    — bản ghi dữ liệu (đọc để tham khảo; có thể lớn)
const fs = require('fs');
const path = require('path');
const paths = require('../core/paths');
const { readJson, writeJson, hash, safeName, subdirs, metaDirs } = require('../core/fsx');
const { fieldSummary } = require('./fields');

const META = '.meta.json';
const FIELDS = 'fields.json';
const DATA = 'data.json';

// Field cấu hình được push (dùng tính drift + patch ở pha write). structTree suy từ struct nên bỏ khỏi hash.
const CONFIG_FIELDS = ['name', 'code', 'description', 'status', 'applicableStatus', 'applicableDate',
  'struct', 'tableConfig', 'searchConfig', 'filterConfig', 'actionConfig'];

/** Hash mốc đồng bộ = các field cấu hình. */
function syncHash(/** @type {any} */ cat) {
  /** @type {Record<string, any>} */ const m = {};
  for (const k of CONFIG_FIELDS) m[k] = cat?.[k] ?? null;
  return hash(JSON.stringify(m));
}

/** Thư mục cho 1 category: đã có (kể cả trong thư mục nhóm) thì giữ; chưa có → theo tên, trùng tên khác id → hậu tố __<id>. */
function dirFor(/** @type {string} */ customer, /** @type {string} */ env, /** @type {any} */ cat) {
  const root = paths.moduleDir(customer, env, 'ecatalog');
  const known = metaDirs(root, META).find(d => readJson(path.join(d, META), null)?.id === cat.id);
  if (known) return known;
  const base = safeName(cat.name || cat.id) || String(cat.id);
  const dir = path.join(root, base);
  const meta = readJson(path.join(dir, META), null);
  return !meta || meta.id === cat.id ? dir : path.join(root, `${base}__${cat.id}`);
}

/** Ghi bản server xuống đĩa. `data` = undefined thì không đụng data.json. */
function save(/** @type {string} */ customer, /** @type {string} */ env, /** @type {any} */ cat, /** @type {any[]|undefined} */ data) {
  const dir = dirFor(customer, env, cat);
  const meta = { ...cat, customer, env, pulledAt: new Date().toISOString(), pulledHash: syncHash(cat) };
  writeJson(path.join(dir, META), meta);
  writeJson(path.join(dir, FIELDS), fieldSummary(cat));
  if (data !== undefined) writeJson(path.join(dir, DATA), data || []);
  return { dir, fields: fieldSummary(cat).length, records: data ? data.length : null };
}

/** Đọc 1 thư mục category để push; chặn khi customer/env lệch meta (copy nhầm env). */
function load(/** @type {string} */ target) {
  const dir = path.resolve(target);
  const meta = readJson(path.join(dir, META), null);
  if (!meta || !meta.id) throw new Error(`Không thấy ${META} hợp lệ (thiếu id) ở: ${target}`);
  const loc = paths.parseWorkspacePath(dir);
  if (!loc || loc.module !== 'ecatalog') throw new Error('Thư mục phải nằm trong workspace/<customer>/<env>/ecatalog/');
  if (meta.customer !== loc.customer || meta.env !== loc.env) {
    throw new Error(`LỆCH MÔI TRƯỜNG: thư mục là ${loc.customer}/${loc.env} nhưng .meta.json ghi ${meta.customer}/${meta.env}.`);
  }
  return { dir, meta, customer: loc.customer, env: loc.env };
}

/** Cập nhật mốc hash sau khi push (pha write). */
function markSynced(/** @type {string} */ dir, /** @type {any} */ meta) {
  writeJson(path.join(dir, META), { ...meta, pulledHash: syncHash(meta), pulledAt: new Date().toISOString() });
}

/** In các category đã sửa cục bộ so với lần pull/push gần nhất. */
function status(/** @type {string} */ customer, /** @type {string} */ env) {
  /** @type {string[]} */ const dirs = [];
  const walk = (/** @type {string} */ d) => {
    if (fs.existsSync(path.join(d, META))) dirs.push(d);
    else subdirs(d).forEach(n => walk(path.join(d, n)));
  };
  paths.moduleRoots('ecatalog', customer, env).forEach(walk);

  let clean = 0;
  const changed = [];
  for (const d of dirs) {
    const meta = readJson(path.join(d, META), null);
    if (!meta) continue;
    if (syncHash(meta) === meta.pulledHash) clean++;
    else changed.push(`  M ${paths.toRepoRel(d)}`);
  }
  if (!changed.length) return console.log(`Sạch — không danh mục nào lệch. (${clean} khớp)`);
  console.log(`Danh mục eCatalog đã sửa cục bộ:\n${changed.join('\n')}\n\nTổng: ${changed.length} sửa, ${clean} khớp.`);
}

module.exports = { META, FIELDS, DATA, CONFIG_FIELDS, syncHash, save, load, markSynced, status };
