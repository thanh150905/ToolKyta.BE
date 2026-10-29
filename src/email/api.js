// @ts-check
'use strict';
// API mẫu mail — service email-template trên host eaccount. Chi tiết endpoint: docs/api.md
const http = require('../core/http');
const session = require('../core/session');

const SVC = '/services/email-template/api/templates';

/** @typedef {import('../core/session').Session} Session */

const open = (/** @type {string} */ customer, /** @type {string} */ env) => session.open(customer, env, 'account');
const list = async (/** @type {Session} */ s) => http.toList(await http.request(s, 'GET', `${SVC}?page=0&size=1000`));
const getOne = (/** @type {Session} */ s, /** @type {string} */ id) => http.request(s, 'GET', `${SVC}/${encodeURIComponent(id)}`);
const create = (/** @type {Session} */ s, /** @type {any} */ obj) => http.request(s, 'POST', SVC, { json: obj });
// PUT gửi FULL object (id nằm trong body).
const update = (/** @type {Session} */ s, /** @type {any} */ obj) => http.request(s, 'PUT', SVC, { json: obj });

module.exports = { open, list, getOne, create, update };
