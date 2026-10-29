// @ts-check
'use strict';
// API eWorkspace — host/base path cấu hình theo môi trường trong config/kyta.json.
// Hợp đồng được giữ theo ews-importer: lookup dùng Cookie access_token; dashboard dùng Bearer.
const http = require('../core/http');
const session = require('../core/session');

const enc = encodeURIComponent;
/** @typedef {import('../core/session').Session} Session */

const open = (/** @type {string} */ customer, /** @type {string} */ env, opts = {}) =>
  session.open(customer, env, 'eworkspace', opts);

/** Tra user theo email. HTTP 404 hoặc response không có id trả null. */
async function userByEmail(/** @type {Session} */ sess, /** @type {string} */ email) {
  let result;
  try {
    result = await http.request(sess, 'GET', '/uaa/api/users/login?login=' + enc(email));
  } catch (e) {
    if (/→ HTTP 404\b/.test(e.message)) return null;
    throw e;
  }
  const user = result?.data && typeof result.data === 'object' ? result.data : result;
  return user && user.id ? user : null;
}

/** Thêm một dashboard cho một user (hợp đồng API nhận mảng một user). */
const createDashboard = (/** @type {Session} */ sess, /** @type {string} */ dashboardId, /** @type {{id:number, email:string}} */ user) =>
  http.request(sess, 'POST', '/workspace/api/dashboards/create?dashboardId=' + enc(dashboardId) + '&t=' + Date.now(), { json: [user] });

/** Gỡ tất cả dashboard của danh sách user. */
const deleteDashboards = (/** @type {Session} */ sess, /** @type {{id:number, email:string}[]} */ users) =>
  http.request(sess, 'POST', '/workspace/api/dashboards/delete?t=' + Date.now(), { json: users });

module.exports = { open, userByEmail, createDashboard, deleteDashboards };
