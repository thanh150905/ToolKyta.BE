// @ts-check
'use strict';
// Danh sách dashboard dùng lại, lưu cục bộ theo môi trường (không đồng bộ lên server/Git).
const path = require('path');
const { STATE } = require('../core/paths');
const { readJson, writeJson } = require('../core/fsx');

/** @typedef {{id:string, name:string}} Dashboard */
const FILE = path.join(STATE, 'eworkspace-dashboards.json');
/** @type {Record<string, Dashboard[]>} */
const SEED = {
  sandbox: [],
  demo: [],
  dev: [],
  prod: [
    { id: '00006DzIyP8MIxDDXbLOV', name: 'Trang chủ' },
    { id: '0000615IDXR0u6QQ0RKmy', name: 'Văn bản cần ký' },
    { id: '0000663IdbMsv1Kzq68r', name: 'Văn bản chờ phát hành' },
    { id: '00006OWIJ13CJp4Rk04r', name: 'Văn bản bị trả lại' },
    { id: '00006bBImoXiQr10xDM0', name: 'Văn bản đã phát hành' },
    { id: '00006BXIkLoigM4523Wq', name: 'Tác nghiệp chưa hoàn thành' },
    { id: '00006N1IK56uNoy40lnw', name: 'Tác nghiệp đã hoàn thành' },
    { id: '00006owIP6pAHollW1xKR', name: 'Hồ sơ đang thi hành' },
    { id: '00006lKI663u08na2OVa', name: 'HDSD' },
    { id: '00006nPIRbvJfbWQJgQNB', name: 'TRƯỞNG/ PHÓ TRƯỞNG THI HÀNH ÁN_eQĐTHA' },
    { id: '00006MgIJDplUlqWVRz0B', name: 'CHẤP HÀNH VIÊN_eQĐTHA' },
    { id: '00006pyIpmlWFEOmW3Pqv', name: 'CHÁNH VP/ TRƯỞNG KV_eQĐTHA' },
  ],
};

/** @returns {Record<string, Dashboard[]>} */
function all() { return readJson(FILE, {}); }
/** @returns {Dashboard[]} */
function list(/** @type {string} */ env) {
  const data = all();
  if (!Array.isArray(data[env])) {
    data[env] = (SEED[env] || []).map(d => ({ ...d }));
    writeJson(FILE, data);
  }
  return data[env];
}
function save(/** @type {string} */ env, /** @type {Dashboard[]} */ rows) {
  const data = all();
  data[env] = rows;
  writeJson(FILE, data);
}
function add(/** @type {string} */ env, /** @type {string[]} */ ids, /** @type {string} */ name = '') {
  const rows = list(env);
  const have = new Set(rows.map(d => d.id));
  let added = 0;
  let duplicate = 0;
  for (const id of ids) {
    if (have.has(id)) { duplicate++; continue; }
    rows.push({ id, name: ids.length === 1 ? name : '' });
    have.add(id);
    added++;
  }
  save(env, rows);
  return { added, duplicate };
}
function rename(/** @type {string} */ env, /** @type {string} */ id, /** @type {string} */ name) {
  const rows = list(env);
  const row = rows.find(d => d.id === id);
  if (!row) return false;
  row.name = name;
  save(env, rows);
  return true;
}
function remove(/** @type {string} */ env, /** @type {string[]} */ ids) {
  const wanted = new Set(ids);
  const rows = list(env);
  const next = rows.filter(d => !wanted.has(d.id));
  save(env, next);
  return rows.length - next.length;
}
function reset(/** @type {string} */ env) {
  const rows = (SEED[env] || []).map(d => ({ ...d }));
  save(env, rows);
  return rows;
}

module.exports = { list, add, rename, remove, reset };
