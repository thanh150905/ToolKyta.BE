// @ts-check
'use strict';
// API eCatalog — service **ecategory** (host ecatalog.*, suy eform.x → ecatalog.x).
// ⚠️ Tên host (ecatalog) khác tên service (ecategory). Chi tiết: docs/ecatalog-schema.md
// Hai endpoint ghi tách bạch: PUT /categories/edit = CHỈ struct/field (reset active);
// PUT /categories = CHỈ config nghiệp vụ (name/status/applicableStatus + active của *Config), bỏ qua struct.
const http = require('../core/http');
const session = require('../core/session');

const SVC = '/services/ecategory/api';
const enc = encodeURIComponent;

/** @typedef {import('../core/session').Session} Session */

const open = (/** @type {string} */ customer, /** @type {string} */ env) => session.open(customer, env, 'ecatalog');
const get = (/** @type {Session} */ s, /** @type {string} */ p) => http.request(s, 'GET', p);
const put = (/** @type {Session} */ s, /** @type {string} */ p, /** @type {any} */ json) => http.request(s, 'PUT', p, { json });
const post = (/** @type {Session} */ s, /** @type {string} */ p, /** @type {any} */ json) => http.request(s, 'POST', p, { json });
const del = (/** @type {Session} */ s, /** @type {string} */ p) => http.request(s, 'DELETE', p);

/** Danh sách category (danh mục) — server trả **mảng thẳng**. Lọc/phân trang phía client. */
async function listCategories(/** @type {Session} */ s, { size = 1000 } = {}) {
  const r = await get(s, `${SVC}/categories?page=0&size=${size}&search=&sort=status,desc&sort=created_date,desc`);
  return Array.isArray(r) ? r : http.toList(r);
}

/** 1 category đầy đủ: info + `struct`(chuỗi JSON field) + `structTree` + table/search/filter/actionConfig. */
const category = (/** @type {Session} */ s, /** @type {string} */ id) => get(s, `${SVC}/categories/${enc(id)}`);

/** Bản ghi dữ liệu của 1 category — server trả **mảng thẳng** (bản ghi phẳng {fieldId: value} + meta). */
async function listData(/** @type {Session} */ s, /** @type {string} */ categoryId, { size = 1000 } = {}) {
  const r = await get(s, `${SVC}/data/${enc(categoryId)}?page=0&size=${size}&search=&sort=created_date,desc`);
  return Array.isArray(r) ? r : http.toList(r);
}

// ---- Ghi ----
/**
 * Lưu FIELD (struct) — PUT /categories/edit. Gửi FULL object.
 * ⚠️ `struct` phải là CHUỖI JSON, `structTree` phải là ARRAY thật. Server re-derive *Config từ struct (active=false).
 */
const updateFields = (/** @type {Session} */ s, /** @type {any} */ cat) => put(s, `${SVC}/categories/edit`, cat);

/**
 * Lưu CONFIG nghiệp vụ — PUT /categories. Gửi FULL object.
 * Tôn trọng `active` của tableConfig/searchConfig/filterConfig + applicableStatus. Bỏ qua thay đổi struct.
 */
const updateConfig = (/** @type {Session} */ s, /** @type {any} */ cat) => put(s, `${SVC}/categories`, cat);

/** Tạo category — POST /categories → 201 + object đầy đủ. Body tối thiểu {name,code,description,status}. */
const createCategory = (/** @type {Session} */ s, /** @type {any} */ body) => post(s, `${SVC}/categories`, body);

/** Xoá category (xoá cứng, kéo theo bản ghi) — DELETE /categories/{id} → 204. */
const deleteCategory = (/** @type {Session} */ s, /** @type {string} */ id) => del(s, `${SVC}/categories/${enc(id)}`);

// ---- Bản ghi dữ liệu ----
/** Tạo bản ghi — POST /data/field-data, body phẳng {categoryId, fieldId:value}. */
const createRecord = (/** @type {Session} */ s, /** @type {any} */ record) => post(s, `${SVC}/data/field-data`, record);

/** Sửa bản ghi — PUT /data/field-data, body full record (có id). */
const updateRecord = (/** @type {Session} */ s, /** @type {any} */ record) => put(s, `${SVC}/data/field-data`, record);

/** Xoá 1 bản ghi — DELETE /data/field-data/{recordId} → 204. */
const deleteRecord = (/** @type {Session} */ s, /** @type {string} */ recordId) => del(s, `${SVC}/data/field-data/${enc(recordId)}`);

/** Xoá nhiều/tất cả bản ghi — DELETE /data/field-data/list?ids=..&ids=.. → 204. */
function deleteRecords(/** @type {Session} */ s, /** @type {string[]} */ ids) {
  const qs = ids.map(id => `ids=${enc(id)}`).join('&');
  return del(s, `${SVC}/data/field-data/list?${qs}`);
}

module.exports = {
  open, listCategories, category, listData,
  updateFields, updateConfig, createCategory, deleteCategory,
  createRecord, updateRecord, deleteRecord, deleteRecords,
};
