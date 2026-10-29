// @ts-check
'use strict';
// Cấu hình field trong jsonForm (label, required, readonly, display, dropdown datasource...).
// Nguồn sự thật local: <form>/fields.json — danh sách field + toàn bộ property cấu hình,
// GIỮ NGUYÊN VẸN từ server (không lược bớt) để sửa chính xác mọi loại field.
//   - customRenderCode KHÔNG nằm ở đây (đã tách ra ui/<field>/), tránh trùng nguồn.
//   - id/hashid/type là danh tính, không sửa qua config.
const path = require('path');
const { collectAllFields } = require('./formDef');
const { readJson, writeJson, hash } = require('../core/fsx');

const FIELDS_FILE = 'fields.json';
// Property KHÔNG đưa vào config: danh tính + cây con + custom UI (quản lý riêng ở ui/).
const STRUCTURAL = new Set(['id', 'hashid', 'type', 'components', 'customRenderCode']);

/** Node → object config thuần (mọi property trừ STRUCTURAL). */
function toConfig(/** @type {any} */ node) {
  /** @type {Record<string, any>} */ const c = {};
  for (const k in node) if (!STRUCTURAL.has(k)) c[k] = node[k];
  return c;
}

/**
 * Áp config vào node (ghi đè từng property có trong config; không xoá property lạ, không đụng STRUCTURAL).
 * @returns {string[]} các property đã đổi
 */
function applyConfig(/** @type {any} */ node, /** @type {Record<string, any>} */ config) {
  /** @type {string[]} */ const changed = [];
  for (const k in config) {
    if (STRUCTURAL.has(k)) continue;
    if (JSON.stringify(node[k]) !== JSON.stringify(config[k])) { node[k] = config[k]; changed.push(k); }
  }
  return changed;
}

/**
 * id = "<formId>_<key>" của node: cho biết field nhúng thuộc form con nào (key ngắn trùng nhau giữa cha/con).
 * @typedef {{ key: string|null, id?: string|null, hashid: string|null, type: string, label: string, config: Record<string, any> }} FieldEntry
 * @typedef {{ formId: string|null, fields: FieldEntry[] }} FieldsDoc
 */

/** Dựng fields.json từ jsonForm def. @returns {FieldsDoc} */
function buildDoc(/** @type {any} */ def, /** @type {string|null} */ formId) {
  const fields = collectAllFields(def).map(f => ({
    key: f.key, id: typeof f.node.id === 'string' ? f.node.id : null, hashid: f.hashid, type: f.type, label: f.label, config: toConfig(f.node),
  }));
  return { formId: formId || null, fields };
}

/** { <hashid|key>: hash(config) } — khoá theo hashid để sống sót khi đổi key. */
function docHashes(/** @type {FieldsDoc|null} */ doc) {
  /** @type {Record<string, string>} */ const out = {};
  for (const f of doc?.fields || []) out[f.hashid || f.key || ''] = hash(JSON.stringify(f.config));
  return out;
}

const filePath = (/** @type {string} */ dir) => path.join(dir, FIELDS_FILE);
/** @returns {FieldsDoc|null} */
const readDoc = (/** @type {string} */ dir) => readJson(filePath(dir), null);
const writeDoc = (/** @type {string} */ dir, /** @type {FieldsDoc} */ doc) => writeJson(filePath(dir), doc);

/** Dòng tóm tắt 1 field cho `field list`. */
function summarize(/** @type {FieldEntry} */ f) {
  const c = f.config || {};
  const flags = [];
  if (c.validate && c.validate.required) flags.push('required');
  if (c.readonly) flags.push('readonly');
  if (c.display === false) flags.push('hidden');
  return { key: f.key || '?', type: f.type, label: f.label || '', flags };
}

module.exports = { FIELDS_FILE, STRUCTURAL, toConfig, applyConfig, buildDoc, docHashes, readDoc, writeDoc, filePath, summarize };
