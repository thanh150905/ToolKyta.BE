// @ts-check
'use strict';
// Đồng bộ tài nguyên dạng "1 file nội dung + .meta.json" (mẫu mail, quy trình eFlow).
// Thư mục: workspace/<customer>/<env>/<module>/<tên>/{<file nội dung>, .meta.json}
const fs = require('fs');
const path = require('path');
const paths = require('./paths');
const store = require('./store');
const { readJson, writeJson, writeText, readText, hash, safeName, subdirs } = require('./fsx');

const META = '.meta.json';
const SERVER_ONLY = ['createdDate', 'createdBy', 'lastModifiedBy', 'lastModifiedDate'];

/**
 * @typedef {object} Spec
 * @property {'email'|'eflow'} module
 * @property {string} file    file nội dung local (content.html | flow.json)
 * @property {string} field   field nội dung trên server (content | jsonXml)
 * @property {string} noun    tên gọi khi in log
 */

/** Thư mục cho 1 tài nguyên: theo tên; trùng tên nhưng khác id thì thêm hậu tố __<id>. */
function dirFor(/** @type {Spec} */ spec, /** @type {string} */ customer, /** @type {string} */ env, /** @type {any} */ obj) {
  const root = paths.moduleDir(customer, env, spec.module);
  const base = safeName(obj.name || obj.id) || String(obj.id);
  const dir = path.join(root, base);
  const meta = readJson(path.join(dir, META), null);
  return !meta || meta.id === obj.id ? dir : path.join(root, `${base}__${obj.id}`);
}

/** Ghi bản server xuống đĩa: nội dung ra file riêng, các field còn lại vào .meta.json. */
function save(/** @type {Spec} */ spec, /** @type {string} */ customer, /** @type {string} */ env, /** @type {any} */ obj) {
  const content = obj[spec.field] == null ? '' : String(obj[spec.field]);
  /** @type {Record<string, any>} */ const meta = {};
  for (const k of Object.keys(obj)) if (k !== spec.field && !SERVER_ONLY.includes(k)) meta[k] = obj[k];
  Object.assign(meta, { customer, env, pulledHash: hash(content), pulledAt: new Date().toISOString() });
  const dir = dirFor(spec, customer, env, obj);
  writeText(path.join(dir, spec.file), content);
  writeJson(path.join(dir, META), meta);
  return { dir, content };
}

/**
 * Kéo nhiều tài nguyên về. fetchOne(id) trả object đầy đủ từ server.
 * @param {Spec} spec
 * @param {import('./session').Session} sess
 * @param {string[]} ids
 * @param {(id: string) => Promise<any>} fetchOne
 */
async function pull(spec, sess, ids, fetchOne) {
  let ok = 0, fail = 0;
  for (const id of ids) {
    try {
      const obj = await fetchOne(id);
      const { dir, content } = save(spec, sess.customer, sess.env, obj);
      store.audit({ op: `${spec.module}-pull`, id, customer: sess.customer, env: sess.env });
      console.log(`  ✓ ${id}  "${obj.name || ''}"  (${content.length} ký tự) → ${paths.toRepoRel(dir)}`);
      ok++;
    } catch (e) { console.log(`  ✗ ${id}: ${e.message}`); fail++; }
  }
  console.log(`\nXong: ${ok} ${spec.noun} OK, ${fail} lỗi.`);
  if (fail) process.exitCode = 1;
}

/** Đọc 1 thư mục tài nguyên để push; chặn khi customer/env của thư mục khác meta (copy nhầm env). */
function load(/** @type {Spec} */ spec, /** @type {string} */ target) {
  const dir = path.resolve(target);
  const meta = readJson(path.join(dir, META), null);
  if (!meta || !meta.id) throw new Error(`Không thấy ${META} hợp lệ (thiếu id) ở: ${target}`);
  const fp = path.join(dir, spec.file);
  if (!fs.existsSync(fp)) throw new Error(`Không thấy ${spec.file} ở: ${target}`);
  const loc = paths.parseWorkspacePath(dir);
  if (!loc || loc.module !== spec.module) throw new Error(`Thư mục phải nằm trong workspace/<customer>/<env>/${spec.module}/`);
  if (meta.customer !== loc.customer || meta.env !== loc.env) {
    throw new Error(`LỆCH MÔI TRƯỜNG: thư mục là ${loc.customer}/${loc.env} nhưng .meta.json ghi ${meta.customer}/${meta.env}.`);
  }
  return { dir, fp, meta, content: fs.readFileSync(fp, 'utf8'), customer: loc.customer, env: loc.env };
}

/**
 * Vá bản server bằng nội dung local (+ các field meta khi withMeta). Trả { next, changes }.
 * @param {Spec} spec
 * @param {any} server
 * @param {string} content
 * @param {Record<string, any>} meta
 * @param {string[]} metaFields
 */
function patch(spec, server, content, meta, metaFields) {
  const next = { ...server };
  const changes = [];
  if (String(server[spec.field] ?? '') !== content) { next[spec.field] = content; changes.push(`${spec.field} (${content.length} ký tự)`); }
  for (const k of metaFields) {
    if (k in meta && JSON.stringify(server[k]) !== JSON.stringify(meta[k])) { next[k] = meta[k]; changes.push(k); }
  }
  return { next, changes };
}

/**
 * Chặn push đè thay đổi người khác làm trên server kể từ lần pull. force = bỏ qua.
 * @param {Spec} spec
 * @param {any} server
 * @param {string} content
 * @param {Record<string, any>} meta
 * @param {boolean} force
 */
function guardDrift(spec, server, content, meta, force) {
  if (force || hash(String(server[spec.field] ?? '')) === meta.pulledHash) return;
  if (hash(content) === meta.pulledHash) throw new Error('Server đã đổi sau lần pull (local không sửa gì) → chạy pull để cập nhật, đừng push đè.');
  throw new Error('XUNG ĐỘT: cả server lẫn local đều đổi kể từ lần pull. Pull ra chỗ khác so sánh, hoặc thêm --force nếu chắc chắn ghi đè server.');
}

/** Sau khi push: cập nhật mốc hash để status coi là đã đồng bộ. */
function markSynced(/** @type {string} */ dir, /** @type {Record<string, any>} */ meta, /** @type {string} */ content) {
  writeJson(path.join(dir, META), { ...meta, pulledHash: hash(content), pulledAt: new Date().toISOString() });
}

/**
 * In các tài nguyên đã sửa cục bộ so với lần pull/push gần nhất.
 * @param {Spec} spec
 * @param {string} [customer]
 * @param {string} [env]
 */
function status(spec, customer, env) {
  /** @type {string[]} */ const dirs = [];
  const walk = (/** @type {string} */ d) => {
    if (fs.existsSync(path.join(d, META))) dirs.push(d);
    else subdirs(d).forEach(n => walk(path.join(d, n)));
  };
  paths.moduleRoots(spec.module, customer, env).forEach(walk);

  let clean = 0;
  const changed = [];
  for (const d of dirs) {
    const meta = readJson(path.join(d, META), null);
    const text = readText(path.join(d, spec.file), null);
    if (!meta || text == null) continue;
    if (hash(text) === meta.pulledHash) clean++;
    else changed.push(`  M ${paths.toRepoRel(d)}`);
  }
  if (!changed.length) return console.log(`Sạch — không ${spec.noun} nào lệch. (${clean} khớp)`);
  console.log(`${spec.noun} đã sửa cục bộ:\n${changed.join('\n')}\n\nTổng: ${changed.length} sửa, ${clean} khớp.`);
}

module.exports = { META, save, pull, load, patch, guardDrift, markSynced, status };
