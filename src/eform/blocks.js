// @ts-check
'use strict';
// Khối code dùng chung trong code động, đánh dấu bằng marker:
//   // ===== [TÊN] mô tả tuỳ ý  @params {"TK_PREFIX":"CUOIDA"}
//   ...thân khối...
//   // ===== [/TÊN] =====
// Nguồn gốc của thân khối: workspace/<customer>/<env>/lib/<TÊN>.js — chỗ {{@tham_số}} thay bằng @params của
// từng form. `kyta eform lib sync` ghi thân khối vào mọi form có marker → sửa 1 nơi, mọi form theo.
const path = require('path');
const paths = require('../core/paths');
const { readText } = require('../core/fsx');

const OPEN_RX = /^([ \t]*)\/\/ =+ \[([A-Z][A-Z0-9_]*)\]([^\n]*)$/gm;
const PARAM_RX = /\{\{@([A-Za-z_][A-Za-z0-9_]*)\}\}/g;

/**
 * @typedef {{ name: string, indent: string, header: string, params: Record<string, any>|null, paramError: string|null,
 *   bodyStart: number, bodyEnd: number, body: string }} Block
 */

/**
 * Tách các khối trong 1 file code. Marker mở không có marker đóng tương ứng → vào `broken`.
 * @param {string} text
 * @returns {{ blocks: Block[], broken: string[] }}
 */
function parse(text) {
  /** @type {Block[]} */ const blocks = [];
  /** @type {string[]} */ const broken = [];
  for (const m of text.matchAll(OPEN_RX)) {
    const [line, indent, name, rest] = m;
    const bodyStart = /** @type {number} */ (m.index) + line.length + 1;
    const close = new RegExp('^[ \\t]*// =+ \\[/' + name + '\\][^\\n]*$', 'm');
    const tail = text.slice(bodyStart);
    const c = tail.match(close);
    if (!c || c.index == null) { broken.push(name); continue; }
    const bodyEnd = bodyStart + c.index;
    let params = null, paramError = null;
    const pm = rest.match(/@params\s+(\{.*\})\s*$/);
    if (pm) { try { params = JSON.parse(pm[1]); } catch (e) { paramError = `@params không phải JSON: ${e.message}`; } }
    blocks.push({ name, indent, header: line, params, paramError, bodyStart, bodyEnd, body: text.slice(bodyStart, bodyEnd) });
  }
  return { blocks, broken };
}

/** Thư mục lib của customer/env. */
const libDir = (/** @type {string} */ customer, /** @type {string} */ env) => path.join(paths.WORKSPACE, customer, env, 'lib');
const libPath = (/** @type {string} */ customer, /** @type {string} */ env, /** @type {string} */ name) => path.join(libDir(customer, env), name + '.js');

/** Nội dung lib (null nếu chưa có). */
function readLib(/** @type {string} */ customer, /** @type {string} */ env, /** @type {string} */ name) {
  const t = readText(libPath(customer, env, name), null);
  return t == null ? null : String(t);
}

/** Tham số lib cần. */
const libParams = (/** @type {string} */ lib) => [...new Set([...lib.matchAll(PARAM_RX)].map(m => m[1]))];

/**
 * Thân khối mong đợi cho 1 form = lib đã thay tham số. Thiếu tham số → lỗi (không sinh code hỏng).
 * Giá trị chuỗi chèn nguyên văn; giá trị khác chèn dạng JSON.
 * @param {string} lib
 * @param {Record<string, any>|null} params
 */
function render(lib, params) {
  const missing = libParams(lib).filter(p => !params || !(p in params));
  if (missing.length) throw new Error(`thiếu @params: ${missing.join(', ')}`);
  const body = lib.replace(PARAM_RX, (_, p) => {
    const v = /** @type {Record<string, any>} */ (params)[p];
    return typeof v === 'string' ? v : JSON.stringify(v);
  });
  return body.endsWith('\n') ? body : body + '\n';
}

/**
 * Thay thân 1 khối trong text (giữ nguyên marker + mọi thứ ngoài khối).
 * @param {string} text
 * @param {Block} block
 * @param {string} body
 */
const replaceBody = (text, block, body) => text.slice(0, block.bodyStart) + body + text.slice(block.bodyEnd);

module.exports = { parse, libDir, libPath, readLib, libParams, render, replaceBody };
