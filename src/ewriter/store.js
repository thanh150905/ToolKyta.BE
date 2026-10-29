// @ts-check
'use strict';
// Layout local của eWriter: workspace/<customer>/<env>/ewriter/<tên>/
//   .meta.json        — object document đầy đủ + { customer, env, pulledAt, pulledHash }
//   variables.json    — mảng biến (ánh xạ field eForm → placeholder)
//   variable-data.json— dữ liệu biến (đọc để tham khảo)
//   template.docx     — file .docx tải từ server (giữ styles/ảnh/rels…)
//   document.xml      — word/document.xml dàn "mỗi đoạn/bảng/dòng/ô 1 dòng" — SỬA Ở ĐÂY; push đóng gói lại vào template.docx
const fs = require('fs');
const path = require('path');
const paths = require('../core/paths');
const docx = require('./docx');
const { readJson, writeJson, writeText, hash, safeName, subdirs } = require('../core/fsx');

const META = '.meta.json';
const VARS = 'variables.json';
const VDATA = 'variable-data.json';
const DOCX = 'template.docx';
const XML = 'document.xml';
const DOC_PART = 'word/document.xml';

// Field push được (dùng để tính drift + patch updateResource).
const PUSH_FIELDS = ['name', 'status', 'description', 'eformId', 'jsonData', 'resourceParentId', 'alias'];

/** Hash mốc đồng bộ = các field push được + danh sách biến (theo fieldId+code). */
function syncHash(/** @type {any} */ doc, /** @type {any[]} */ variables) {
  /** @type {Record<string, any>} */ const m = {};
  for (const k of PUSH_FIELDS) m[k] = doc?.[k] ?? null;
  const v = (variables || []).map(x => `${x.fieldId}:${x.code}:${x.variableType}`).sort();
  return hash(JSON.stringify({ m, v }));
}

/** Thư mục cho 1 tài liệu: theo tên; trùng tên khác id → hậu tố __<id>. */
function dirFor(/** @type {string} */ customer, /** @type {string} */ env, /** @type {any} */ doc) {
  const root = paths.moduleDir(customer, env, 'ewriter');
  const base = safeName(doc.name || doc.id) || String(doc.id);
  const dir = path.join(root, base);
  const meta = readJson(path.join(dir, META), null);
  return !meta || meta.id === doc.id ? dir : path.join(root, `${base}__${doc.id}`);
}

/** Ghi bản server xuống đĩa (kèm file .docx nếu có). */
function save(/** @type {string} */ customer, /** @type {string} */ env, /** @type {any} */ doc, /** @type {any[]} */ variables,
  /** @type {any} */ variableData, /** @type {Buffer|null} */ file = null) {
  const dir = dirFor(customer, env, doc);
  const docxHashNow = file ? saveDocx(dir, file) : readJson(path.join(dir, META), null)?.docxHash ?? null;
  const meta = { ...doc, customer, env, pulledAt: new Date().toISOString(), pulledHash: syncHash(doc, variables), docxHash: docxHashNow };
  writeJson(path.join(dir, META), meta);
  writeJson(path.join(dir, VARS), variables || []);
  if (variableData !== undefined) writeJson(path.join(dir, VDATA), variableData);
  return { dir, count: (variables || []).length };
}

/** Đọc 1 thư mục tài liệu để push; chặn khi customer/env lệch meta (copy nhầm env). */
function load(/** @type {string} */ target) {
  const dir = path.resolve(target);
  const meta = readJson(path.join(dir, META), null);
  if (!meta || !meta.id) throw new Error(`Không thấy ${META} hợp lệ (thiếu id) ở: ${target}`);
  const loc = paths.parseWorkspacePath(dir);
  if (!loc || loc.module !== 'ewriter') throw new Error('Thư mục phải nằm trong workspace/<customer>/<env>/ewriter/');
  if (meta.customer !== loc.customer || meta.env !== loc.env) {
    throw new Error(`LỆCH MÔI TRƯỜNG: thư mục là ${loc.customer}/${loc.env} nhưng .meta.json ghi ${meta.customer}/${meta.env}.`);
  }
  const variables = readJson(path.join(dir, VARS), []);
  return { dir, meta, variables, customer: loc.customer, env: loc.env };
}

/** Ghi file .docx server xuống: template.docx + document.xml dàn dòng. Trả hash file. */
function saveDocx(/** @type {string} */ dir, /** @type {Buffer} */ buf) {
  const xmlBuf = docx.readZipEntry(buf, DOC_PART);
  if (!xmlBuf) throw new Error('file từ server không có word/document.xml');
  const xml = xmlBuf.toString('utf8');
  const nice = docx.pretty(xml);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, DOCX), buf);
  writeText(path.join(dir, XML), docx.compact(nice) === xml ? nice : xml);   // không gộp lại y nguyên → giữ 1 dòng
  return docxHash(dir);
}

/** Có file bản in cục bộ không. */
const hasDocx = (/** @type {string} */ dir) => fs.existsSync(path.join(dir, DOCX)) && fs.existsSync(path.join(dir, XML));

/** Đóng gói .docx từ template.docx + document.xml (đã gộp dòng). */
function buildDocx(/** @type {string} */ dir) {
  const entries = docx.readZip(fs.readFileSync(path.join(dir, DOCX)));
  const xml = docx.compact(fs.readFileSync(path.join(dir, XML), 'utf8'));
  return docx.writeZip(docx.setEntry(entries, DOC_PART, Buffer.from(xml, 'utf8')));
}

/** Mốc "file bản in đã sửa chưa" = hash gói đóng lại (deflate tất định). null nếu chưa kéo file. */
const docxHash = (/** @type {string} */ dir) => (hasDocx(dir) ? hash(buildDocx(dir).toString('base64')) : null);

/** Cập nhật mốc hash sau khi push. */
function markSynced(/** @type {string} */ dir, /** @type {any} */ meta, /** @type {any[]} */ variables) {
  writeJson(path.join(dir, META), {
    ...meta, pulledHash: syncHash(meta, variables), docxHash: docxHash(dir) ?? meta.docxHash ?? null, pulledAt: new Date().toISOString(),
  });
}

/** In các tài liệu đã sửa cục bộ so với lần pull/push gần nhất. */
function status(/** @type {string} */ customer, /** @type {string} */ env) {
  /** @type {string[]} */ const dirs = [];
  const walk = (/** @type {string} */ d) => {
    if (fs.existsSync(path.join(d, META))) dirs.push(d);
    else subdirs(d).forEach(n => walk(path.join(d, n)));
  };
  paths.moduleRoots('ewriter', customer, env).forEach(walk);

  let clean = 0;
  const changed = [];
  for (const d of dirs) {
    const meta = readJson(path.join(d, META), null);
    if (!meta) continue;
    const variables = readJson(path.join(d, VARS), []);
    const metaDirty = syncHash(meta, variables) !== meta.pulledHash;
    const fileDirty = !!meta.docxHash && docxHash(d) !== meta.docxHash;
    if (!metaDirty && !fileDirty) clean++;
    else changed.push(`  M ${paths.toRepoRel(d)}${fileDirty ? '  [file .docx]' : ''}${metaDirty ? '  [metadata/biến]' : ''}`);
  }
  if (!changed.length) return console.log(`Sạch — không tài liệu nào lệch. (${clean} khớp)`);
  console.log(`Tài liệu bản in đã sửa cục bộ:\n${changed.join('\n')}\n\nTổng: ${changed.length} sửa, ${clean} khớp.`);
}

module.exports = {
  META, VARS, VDATA, DOCX, XML, PUSH_FIELDS, syncHash, save, load, markSynced, status,
  saveDocx, hasDocx, buildDocx, docxHash,
};
