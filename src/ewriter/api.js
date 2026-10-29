// @ts-check
'use strict';
// API eWriter — kho tài liệu bản in (.docx). Host ewriter.* (suy từ eform.x → ewriter.x).
// Chi tiết endpoint + cấu trúc: docs/ewriter-schema.md
const http = require('../core/http');
const session = require('../core/session');

const SVC = '/services/ewriter/api';
const EFORM = '/services/eform/api';
const enc = encodeURIComponent;

/** @typedef {import('../core/session').Session} Session */

const open = (/** @type {string} */ customer, /** @type {string} */ env) => session.open(customer, env, 'ewriter');
const get = (/** @type {Session} */ s, /** @type {string} */ p) => http.request(s, 'GET', p);
const post = (/** @type {Session} */ s, /** @type {string} */ p, /** @type {any} */ json) => http.request(s, 'POST', p, { json });

// ---- Tài liệu ----
/** Danh sách tài liệu bản in. Trả {pageOffset,pageSize,totalElement,data[]}; lọc/phân trang phía client. */
async function list(/** @type {Session} */ s, { size = 1000 } = {}) {
  const r = await get(s, `${SVC}/documents/listDocumentSuggest?page=0&size=${size}&sort=lastModifiedDate,DESC`);
  return Array.isArray(r?.data) ? r.data : http.toList(r);
}
/** Tài liệu đầy đủ (48 field). BẮT BUỘC cả id + resourceId. */
const details = (/** @type {Session} */ s, /** @type {string} */ id, /** @type {string} */ resourceId) =>
  get(s, `${SVC}/documents/details?id=${enc(id)}&resourceId=${enc(resourceId)}`);
/** Lưu tài liệu — gửi FULL object (đổi status/name/eformId... đều qua đây). */
const updateResource = (/** @type {Session} */ s, /** @type {any} */ obj) =>
  http.request(s, 'PUT', `${SVC}/documents/updateResource`, { json: obj });
/** Nhân bản: id nguồn + tên mới + thư mục đích (mặc định theo tài liệu nguồn).
 *  Server đọc tham số từ QUERY STRING (body JSON → 400 "Required String parameter 'id'") — xác minh live 2026-10-21. */
const duplicate = (/** @type {Session} */ s, /** @type {{id: string, name: string, resourceParentId: string}} */ body) =>
  post(s, `${SVC}/documents/duplicate?id=${enc(body.id)}&name=${enc(body.name)}&resourceParentId=${enc(body.resourceParentId || '')}`, {});
/** Xoá (vào thùng rác). */
const remove = (/** @type {Session} */ s, /** @type {any} */ body) => post(s, `${SVC}/documents/delete`, body);

// ---- File .docx của tài liệu (xác minh live 2026-10-02) ----
/** Tải file .docx — server trả chuỗi base64 (có thể bọc trong ngoặc kép JSON). */
async function viewFile(/** @type {Session} */ s, /** @type {string} */ id) {
  const r = await get(s, `${SVC}/documents/viewFile?Id=${enc(id)}`);
  return Buffer.from(String(r ?? '').replace(/^"|"$/g, ''), 'base64');
}
/** Ghi đè file .docx: multipart { file, dto = JSON(details) }. Field `size` trong phản hồi chỉ là echo dto. */
function uploadFile(/** @type {Session} */ s, /** @type {any} */ details, /** @type {Buffer} */ buf) {
  const form = new FormData();
  form.append('file', new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' }),
    /\.docx$/i.test(details.name || '') ? details.name : `${details.name || details.id}.docx`);
  form.append('dto', JSON.stringify(details));
  return http.request(s, 'POST', `${SVC}/documents/uploadFile`, { form });
}
/** Render bản in với dữ liệu: body = mảng {label, hashid, type, value}. Trả Buffer .pdf | .docx. */
const preview = (/** @type {Session} */ s, /** @type {string} */ id, /** @type {any[]} */ payload, pdf = true) =>
  http.request(s, 'POST', `${SVC}/documents/preview/${enc(id)}?filePdf=${pdf}`, { json: payload, binary: true });

// ---- Biến (gán biến từ form) ----
/** Biến đã đặt trong tài liệu (ánh xạ field eForm → placeholder). */
const variablesOf = (/** @type {Session} */ s, /** @type {string} */ documentId) =>
  get(s, `${SVC}/variables?documentId=${enc(documentId)}`);
/** Dữ liệu biến của tài liệu. */
const variableData = (/** @type {Session} */ s, /** @type {string} */ documentId) =>
  get(s, `${SVC}/variable-data?documentId=${enc(documentId)}`);
/**
 * Lưu biến hàng loạt. delete=true đồng bộ (biến không nằm trong addVariables sẽ bị gỡ).
 * body: { addVariables: Variable[], deleteVariables: [], dataAdd: [] }
 */
const saveVariables = (/** @type {Session} */ s, /** @type {string} */ documentId, /** @type {any} */ body, { del = true } = {}) =>
  post(s, `${SVC}/variable-data/save-all?documentId=${enc(documentId)}&delete=${del}`, body);

// ---- Form nguồn (để kéo biến) — service eform qua host ewriter ----
/** Danh sách eForm nguồn. Trả {total, content[]} (mỗi form có formId, jsonForm, formCode, formName...). */
async function sourceForms(/** @type {Session} */ s, { size = 1000, textSearch = '' } = {}) {
  const r = await post(s, `${EFORM}/share/form-eflow?page=0&size=${size}`, { createdDate: null, textSearch });
  return Array.isArray(r?.content) ? r.content : http.toList(r);
}

module.exports = {
  open, list, details, updateResource, duplicate, remove,
  viewFile, uploadFile, preview,
  variablesOf, variableData, saveVariables, sourceForms,
};
