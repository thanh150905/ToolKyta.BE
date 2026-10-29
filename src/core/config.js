// @ts-check
'use strict';
// Cấu hình chung config/kyta.json: host từng service theo env / customer@env + cấu hình đăng nhập.
const path = require('path');
const { CONFIG } = require('./paths');
const { readJson } = require('./fsx');

const FILE = path.join(CONFIG, 'kyta.json');
// Service không khai host riêng thì suy từ host eform: eform.x → eflow.x / eaccount.x / ewriter.x / eworkspace.x
const DERIVED_PREFIX = { eflow: 'eflow', account: 'eaccount', ewriter: 'ewriter', ecatalog: 'ecatalog', eworkspace: 'eworkspace' };

/** @typedef {'eform'|'eflow'|'ewriter'|'ecatalog'|'eworkspace'|'account'|'portal'} Service */

/** @type {any} */
let cached = null;
function load() {
  if (!cached) cached = readJson(FILE, null);
  if (!cached) throw new Error('Thiếu hoặc hỏng config/kyta.json.');
  return cached;
}

/** Các env hợp lệ = khoá của "envs". */
const envs = () => Object.keys(load().envs || {});

/** Cấu hình API đăng nhập (loginPath, bodyTemplate...). */
const auth = () => load().auth || {};

/**
 * Host của 1 service. Ưu tiên customer@env → env → suy từ host eform.
 * @param {string} customer
 * @param {string} env
 * @param {Service} service
 * @returns {string|null}
 */
function serviceHost(customer, env, service) {
  const c = load();
  const hosts = { ...(c.envs?.[env] || {}), ...(c.customers?.[`${customer}@${env}`] || {}) };
  if (hosts[service]) return trimSlash(hosts[service]);
  const prefix = /** @type {Record<string, string>} */ (DERIVED_PREFIX)[service];
  const eform = hosts.eform ? trimSlash(hosts.eform) : '';
  return prefix && eform.includes('eform') ? eform.replace('eform', prefix) : null;
}

const trimSlash = (/** @type {string} */ s) => String(s).replace(/\/+$/, '');

module.exports = { FILE, envs, auth, serviceHost };
