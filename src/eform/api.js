// @ts-check
'use strict';
// API eForm — service eform. Chi tiết endpoint + các bẫy đã gặp: docs/api.md
const fs = require('fs');
const path = require('path');
const http = require('../core/http');
const session = require('../core/session');
const { STATE } = require('../core/paths');
const { writeJson } = require('../core/fsx');

const BASE = '/services/eform/api';
const enc = encodeURIComponent;

/** @typedef {import('../core/session').Session} Session */

const open = (/** @type {string} */ customer, /** @type {string} */ env) => session.open(customer, env, 'eform');

/** Kiểm tra/khoá quyền sửa form (best-effort trước khi push). */
const checkEdit = (/** @type {Session} */ s, /** @type {string} */ id) => http.request(s, 'GET', `${BASE}/common/check-edit?formId=${enc(id)}`);

/**
 * Code động của form, chuẩn hoá về { key: { code, order } }.
 * @returns {Promise<Record<string, { code: string, order: number }>>}
 */
async function getCode(/** @type {Session} */ s, /** @type {string} */ id) {
  const r = (await http.request(s, 'GET', `${BASE}/forms/${enc(id)}/code`)) || {};
  /** @type {Record<string, { code: string, order: number }>} */ const out = {};
  for (const [k, v] of Object.entries(r)) {
    out[k] = { code: typeof v?.code === 'string' ? v.code : typeof v === 'string' ? v : '', order: v?.order ?? 0 };
  }
  return out;
}

/** Lưu code động — FULL-REPLACE: key không gửi kèm sẽ bị xoá trên server. Body JSON nhưng Content-Type text/plain. */
const putCode = (/** @type {Session} */ s, /** @type {string} */ id, /** @type {Record<string, { code: string, order: number }>} */ files) =>
  http.request(s, 'PUT', `${BASE}/forms/${enc(id)}/code`, { text: JSON.stringify(files) });

/** Định nghĩa form đầy đủ (jsonForm chứa custom UI). 403 = form đang mở ở modeler. */
const getForm = async (/** @type {Session} */ s, /** @type {string} */ id) =>
  http.unwrap(await http.request(s, 'GET', `${BASE}/owner/form?formId=${enc(id)}`), 'jsonForm');

const BACKUP_DIR = path.join(STATE, 'backups', 'eform');
const BACKUP_KEEP = 30;

/**
 * Chụp bản server hiện tại trước khi ghi đè (PUT /owner/form không hoàn tác được). Giữ BACKUP_KEEP bản mới nhất/form.
 * @returns {Promise<string>} đường dẫn file backup
 */
async function backupForm(/** @type {Session} */ s, /** @type {string} */ id) {
  const form = await getForm(s, id);
  const dir = path.join(BACKUP_DIR, s.customer, s.env, id);
  const fp = path.join(dir, new Date().toISOString().replace(/[:.]/g, '-') + '.json');
  writeJson(fp, form);
  const old = fs.readdirSync(dir).filter(f => f.endsWith('.json')).sort();
  for (const f of old.slice(0, Math.max(0, old.length - BACKUP_KEEP))) fs.unlinkSync(path.join(dir, f));
  return fp;
}

/**
 * Lưu định nghĩa form — body phải dựng bằng formDef.buildOwnerFormPayload (đúng 9 field).
 * Luôn backup bản server trước; backup lỗi thì KHÔNG ghi.
 */
async function putForm(/** @type {Session} */ s, /** @type {any} */ payload) {
  if (!payload?.formId) throw new Error('putForm: payload thiếu formId.');
  let fp;
  try { fp = await backupForm(s, payload.formId); }
  catch (e) { throw new Error(`Không backup được form ${payload.formId} trước khi ghi (${e.message}) — dừng.`); }
  console.log(`  ↺ backup: ${path.relative(process.cwd(), fp)}`);
  return http.request(s, 'PUT', `${BASE}/owner/form`, { json: payload });
}

/** Kiểm tra mã form đã dùng chưa. 404 = chưa dùng (được phép), 200 = đã tồn tại. */
async function checkIdAvailable(/** @type {Session} */ s, /** @type {string} */ formCode) {
  try { await http.request(s, 'GET', `${BASE}/common/checkId?formId=${enc(formCode)}`); return false; }
  catch (e) { if (/HTTP 404/.test(e.message)) return true; throw e; }
}

/**
 * Tạo form mới. POST /owner/form (KHÔNG gửi formId — server tự sinh). Ngày dạng yyyy/MM/dd.
 * @returns {Promise<any>} form vừa tạo (có formId)
 */
async function createForm(/** @type {Session} */ s, /** @type {{ formName: string, formCode: string, describeForm?: string, beginTime?: string, endTime?: string, tag?: string }} */ info) {
  const body = {
    formName: info.formName, formCode: info.formCode, describeForm: info.describeForm ?? '',
    beginTime: info.beginTime || '2026/01/01', endTime: info.endTime || '2030/12/31',
    formId: null, tag: info.tag ?? '', jsonForm: '[]', variableArr: [],
  };
  return http.unwrap(await http.request(s, 'POST', `${BASE}/owner/form`, { json: body }), 'jsonForm');
}

/** Xoá hẳn 1 form. DELETE /forms/{id}. */
const deleteForm = (/** @type {Session} */ s, /** @type {string} */ id) => http.request(s, 'DELETE', `${BASE}/forms/${enc(id)}`);

/** Form sở hữu. Phải gửi đủ khung filter (gửi {} thì bản demo trả rỗng); vài gateway chỉ nhận GET. */
async function findOwned(/** @type {Session} */ s) {
  const p = `${BASE}/owner/find-form?page=0&size=5000`;
  const filter = {
    beginTime: '', endTime: '', beginDate: '', endDate: '',
    statusForm: [''], formId: null, formName: null, listProcedure: null, tag: null, createdByList: [],
  };
  try { return http.toList(await http.request(s, 'POST', p, { json: filter })); }
  catch (e) {
    if (!/HTTP 405/.test(e.message)) throw e;
    return http.toList(await http.request(s, 'GET', p));
  }
}

module.exports = { open, checkEdit, getCode, putCode, getForm, putForm, backupForm, BACKUP_DIR, findOwned, checkIdAvailable, createForm, deleteForm };
