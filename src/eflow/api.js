// @ts-check
'use strict';
// API eFlow — service idaas-eflow trên host eflow.* (qua gateway gọi được cả uaa + email-template).
// Chi tiết endpoint + cấu trúc jsonXml: docs/eflow-schema.md
const http = require('../core/http');
const session = require('../core/session');

const SVC = '/services/idaas-eflow/api';
const enc = encodeURIComponent;

/** @typedef {import('../core/session').Session} Session */

const open = (/** @type {string} */ customer, /** @type {string} */ env) => session.open(customer, env, 'eflow');
const get = (/** @type {Session} */ s, /** @type {string} */ p) => http.request(s, 'GET', p);
const post = (/** @type {Session} */ s, /** @type {string} */ p, /** @type {any} */ json) => http.request(s, 'POST', p, { json });

// ---- Modeler (quy trình) ----
/** Danh sách modeler. Bản list có jsonXml = null — cần getOne để lấy định nghĩa BPMN. */
const list = async (/** @type {Session} */ s, textSearch = '') => http.toList(await post(s,
  `${SVC}/modeler/search-elastic?page=0&size=5000&sort=status,desc&sort=createdDate,desc`, { textSearch, shared: 'false' }));
/** Modeler đầy đủ (jsonXml + version). */
const getOne = async (/** @type {Session} */ s, /** @type {string} */ id) => http.unwrap(await get(s, `${SVC}/modelers/${enc(id)}`), 'jsonXml');
/** Lưu FULL object. status: active = publish, unpublic = gỡ publish. */
const save = (/** @type {Session} */ s, /** @type {any} */ obj, status = 'active') =>
  http.request(s, 'PUT', `${SVC}/modelers?status=${enc(status)}`, { json: obj });
/** Các eForm gắn với modeler (có jsonForm để tra field). */
const eforms = async (/** @type {Session} */ s, /** @type {string} */ modelerId) =>
  http.toList(await get(s, `${SVC}/forms/list/e-form?modelerId=${enc(modelerId)}&userTaskId=`));

// ---- Biểu mẫu gắn vào user-task (tab "Biểu mẫu") ----
/** Bản ghi form gắn vào node: {id, userTaskId, formId, versionId, formName, formCode, ...} (jsonForm KHÔNG đầy đủ — lấy từ eforms). */
const externalForms = async (/** @type {Session} */ s, /** @type {string} */ modelerId, /** @type {string} */ userTaskId) =>
  http.toList(await get(s, `${SVC}/forms/external/${enc(modelerId)}/${enc(userTaskId)}`));
/** eForm phát hành để chọn gắn vào node (service eform qua gateway eflow). Trả {total, content[]}. */
async function releasedForms(/** @type {Session} */ s, { size = 1000, textSearch = '' } = {}) {
  const r = await post(s, `/services/eform/api/share/form-eflow?page=0&size=${size}`, { createdDate: null, textSearch });
  return Array.isArray(r?.content) ? r.content : http.toList(r);
}
/** Gắn form vào node: body {userTaskId, formId, modelerId, jsonFormStr, formName, formCode, versionId}. */
const selectForm = (/** @type {Session} */ s, /** @type {any} */ body) => post(s, `${SVC}/forms`, body);
/** Gỡ form khỏi node. */
const removeNodeForm = (/** @type {Session} */ s, /** @type {string} */ modelerId, /** @type {string} */ userTaskId) =>
  http.request(s, 'DELETE', `${SVC}/forms/user-task/${enc(modelerId)}/${enc(userTaskId)}`);
/** Bản ghi "form dùng trong quy trình" phía eForm: body {userTaskId, formId, processId (=modelerId), procedureName, stepName, formType}. */
const addFormProcedure = (/** @type {Session} */ s, /** @type {any} */ body) => post(s, '/services/eform/api/common/procedure', body);
const removeFormProcedure = (/** @type {Session} */ s, /** @type {string} */ userTaskId, /** @type {string} */ processId) => {
  if (!userTaskId || !processId) throw new Error('removeFormProcedure: thiếu userTaskId/processId — không xoá theo khoá thiếu.');
  return http.request(s, 'DELETE', `/services/eform/api/common/procedure?userTaskId=${enc(userTaskId)}&processId=${enc(processId)}`);
};

// ---- Kế thừa dữ liệu (variables-configs) — khoá (modelerId, userTaskId) ----
/** Config kế thừa của 1 node; chưa có thì server trả rỗng/null. */
async function inheritOf(/** @type {Session} */ s, /** @type {string} */ modelerId, /** @type {string} */ userTaskId) {
  const r = await get(s, `${SVC}/variables-configs/get-by-userTaskId/${enc(modelerId)}/${enc(userTaskId)}`);
  return r && typeof r === 'object' && r.sources ? r : null;
}
const inheritAll = async (/** @type {Session} */ s, /** @type {string} */ modelerId) =>
  http.toList(await get(s, `${SVC}/variables-configs/get-by-modeler/${enc(modelerId)}`));
/** Lưu config: có id → PUT (sửa), không → POST (tạo). body {id?, sources, userTaskId, versionId, modelerId, formId}. */
const saveInherit = (/** @type {Session} */ s, /** @type {any} */ body) =>
  http.request(s, body.id ? 'PUT' : 'POST', `${SVC}/variables-configs`, { json: body });
const removeInherit = (/** @type {Session} */ s, /** @type {string} */ id) => http.request(s, 'DELETE', `${SVC}/variables-configs/${enc(id)}`);

// ---- Người thực hiện user-task — khoá (userTaskId, processId) ----
const implementers = async (/** @type {Session} */ s, /** @type {string} */ userTaskId, /** @type {string} */ processId) =>
  http.toList(await get(s, `${SVC}/implementer/user-task/${enc(userTaskId)}/${enc(processId)}`));
const addImplementer = (/** @type {Session} */ s, /** @type {any} */ obj) => post(s, `${SVC}/implementer`, obj);
const removeImplementer = (/** @type {Session} */ s, /** @type {string} */ id) => http.request(s, 'DELETE', `${SVC}/implementer/${enc(id)}`);

// ---- Cấu hình thông báo node eNotify (template-config-mails) ----
const notifyConfigs = async (/** @type {Session} */ s, /** @type {string} */ modelerId, /** @type {string} */ userTaskId) =>
  http.toList(await get(s, `${SVC}/template-config-mails/user-task/${enc(modelerId)}/${enc(userTaskId)}`));
/** Ghi bằng multipart: field "templateConfigMail" = chuỗi JSON. method POST = tạo, PUT = sửa. */
function saveNotifyConfig(/** @type {Session} */ s, /** @type {any} */ obj, method = 'PUT') {
  const form = new FormData();
  form.append('templateConfigMail', JSON.stringify(obj));
  return http.request(s, method, `${SVC}/template-config-mails`, { form });
}
const removeNotifyConfig = (/** @type {Session} */ s, /** @type {string} */ id) => http.request(s, 'DELETE', `${SVC}/template-config-mails/${enc(id)}`);

/** Chỉ giữ các field server nhận khi ghi config thông báo. */
const cleanNotifyConfig = (/** @type {any} */ r) => ({
  id: r.id || null, modelerId: r.modelerId, userTaskId: r.userTaskId,
  templateId: r.templateId, templateName: r.templateName, type: r.type || 'email',
  subject: r.subject, mailType: r.mailType || 'system_email',
  brandName: r.brandName || null, accountZalo: r.accountZalo || null, zaloId: r.zaloId || null, phoneNumber: r.phoneNumber || null,
  infoReceiver: r.infoReceiver || null, subsystem: r.subsystem || null,
  conditionText: r.conditionText || null, inheritField: r.inheritField || null,
  configTime: r.configTime || null, document: r.document || [],
});

// ---- Tra cứu (body {} = lấy tất cả, lọc ở client) ----
const roles = async (/** @type {Session} */ s) => http.toList(await post(s, '/services/uaa/api/roles/search?page=0&size=1000', {}));
const users = async (/** @type {Session} */ s) => http.toList(await post(s, '/services/uaa/api/search/userInfoModel?page=0&size=1000&role=true', {}));
const templates = async (/** @type {Session} */ s) => http.toList(await post(s, '/services/email-template/api/search-template?page=0&size=10000', {}));

module.exports = {
  open, list, getOne, save, eforms,
  externalForms, releasedForms, selectForm, removeNodeForm, addFormProcedure, removeFormProcedure,
  inheritOf, inheritAll, saveInherit, removeInherit,
  implementers, addImplementer, removeImplementer,
  notifyConfigs, saveNotifyConfig, removeNotifyConfig, cleanNotifyConfig,
  roles, users, templates,
};
