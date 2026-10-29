// @ts-check
'use strict';
// Spec theo khách (không theo env): workspace/<customer>/specs/{forms,flows,selectors}/<mã>.yaml|.yml|.md
//   _raw/ = file gốc BA gửi (xlsx/pdf...) — không tra.
// Tra offline theo mã (tên file) hoặc id xuất hiện trong nội dung (vd formId ở khối instances).
const fs = require('fs');
const path = require('path');
const paths = require('./paths');
const { subdirs } = require('./fsx');

const KINDS = ['forms', 'flows', 'selectors'];
const EXT = new Set(['.yaml', '.yml', '.md']);

/** @typedef {{ customer: string, kind: string, code: string, file: string, rel: string }} Spec */

/** Mọi file spec, lọc theo customer nếu có. */
function list(/** @type {string} */ customer = '') {
  /** @type {Spec[]} */ const out = [];
  for (const c of customer ? [customer] : subdirs(paths.WORKSPACE)) {
    for (const kind of KINDS) {
      const dir = path.join(paths.specsDir(c), kind);
      let names = [];
      try { names = fs.readdirSync(dir); } catch (_) { continue; }
      for (const n of names) {
        if (!EXT.has(path.extname(n))) continue;
        const file = path.join(dir, n);
        out.push({ customer: c, kind, code: path.basename(n, path.extname(n)).replace(/\.define$/, ''), file, rel: paths.toRepoRel(file) });
      }
    }
  }
  return out;
}

/**
 * Spec khớp truy vấn: mã chứa q (không phân biệt hoa thường), hoặc q xuất hiện nguyên văn trong nội dung.
 * @param {string} q
 * @param {string} [customer]
 */
function find(q, customer) {
  const low = q.toLowerCase();
  return list(customer).filter(s => {
    if (s.code.toLowerCase().includes(low)) return true;
    try { return fs.readFileSync(s.file, 'utf8').includes(q); } catch (_) { return false; }
  });
}

module.exports = { KINDS, list, find };
