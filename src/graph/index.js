// @ts-check
'use strict';
// Đồ thị phụ thuộc của 1 customer/env, dựng offline từ workspace (không gọi mạng):
//   - form: thư mục ↔ formId (.meta.json), form con nhúng qua child_form, catalog mà dropdown dùng
//   - tham chiếu dạng văn bản: token/id/hashid xuất hiện ở code/ui/fields của form, flow.json + .meta.json
//     của eFlow, variable-data/document.xml của eWriter, mẫu mail — tìm theo biên để "-1" không trúng "-10".
// Dùng chung cho `kyta where` và các rào chắn (xoá field, push form con...).
const fs = require('fs');
const path = require('path');
const paths = require('../core/paths');
const tree = require('../eform/tree');
const fields = require('../eform/fields');
const { extractIds } = require('../eform/formId');
const { readJson, subdirs } = require('../core/fsx');

/**
 * @typedef {{ dir: string, rel: string, ids: string[], name: string,
 *   childIds: string[], catalogIds: string[], codeRefs: Record<string, number>,
 *   doc: import('../eform/fields').FieldsDoc|null }} FormNode
 * @typedef {{ kind: 'eform'|'eflow'|'ewriter'|'email'|'ecatalog', rel: string, owner: string, file: string }} TextFile
 * @typedef {{ dir: string, rel: string, id: string|null, name: string, startFormId: string|null }} SimpleNode
 */

const TEXT_EXT = new Set(['.js', '.json', '.html', '.css', '.xml', '.txt']);
// File dữ liệu lớn không chứa tham chiếu cấu hình (bản ghi catalog).
const SKIP_FILES = new Set(['data.json']);

/** Liệt kê file văn bản dưới 1 thư mục (đệ quy). */
function listTextFiles(/** @type {string} */ root) {
  /** @type {string[]} */ const out = [];
  const walk = (/** @type {string} */ d) => {
    let ents = [];
    try { ents = fs.readdirSync(d, { withFileTypes: true }); } catch (_) { return; }
    for (const e of ents) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) walk(p);
      else if (TEXT_EXT.has(path.extname(e.name)) && !SKIP_FILES.has(e.name)) out.push(p);
    }
  };
  walk(root);
  return out;
}

/** Thư mục cấp 1 có .meta.json của 1 phân hệ (eflow/ewriter/ecatalog/email). */
function simpleNodes(/** @type {string} */ customer, /** @type {string} */ env, /** @type {import('../core/paths').Module} */ mod) {
  const root = paths.moduleDir(customer, env, mod);
  return subdirs(root).map(name => {
    const dir = path.join(root, name);
    const meta = readJson(path.join(dir, '.meta.json'), {}) || {};
    return { dir, rel: paths.toRepoRel(dir), id: meta.id || meta.modelId || null, name: meta.name || name, startFormId: meta.formId || null };
  });
}

const esc = (/** @type {string} */ t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
/**
 * Token có biên hai phía (ký tự id = [0-9A-Za-z_]; key có "-" nên biên phải không cho số/chữ/_ đi tiếp).
 * prefix: formId còn xuất hiện dạng "<formId>_<key>" → chỉ cấm số/chữ đi tiếp, cho phép "_".
 */
const tokenRx = (/** @type {string} */ t, prefix = false) =>
  new RegExp('(?<![0-9A-Za-z_])' + esc(t) + (prefix ? '(?![0-9A-Za-z])' : '(?![0-9A-Za-z_])'), 'g');

class Graph {
  /**
   * @param {string} customer
   * @param {string} env
   */
  constructor(customer, env) {
    this.customer = customer;
    this.env = env;
    /** @type {FormNode[]} */ this.forms = tree.listForms(paths.moduleDir(customer, env, 'eform')).map(dir => formNode(dir));
    /** @type {Map<string, FormNode[]>} */ this.byId = new Map();
    for (const f of this.forms) for (const id of f.ids) { const a = this.byId.get(id) || []; a.push(f); this.byId.set(id, a); }
    this.flows = simpleNodes(customer, env, 'eflow');
    this.writers = simpleNodes(customer, env, 'ewriter');
    this.catalogs = simpleNodes(customer, env, 'ecatalog');
    this.mails = simpleNodes(customer, env, 'email');
    /** @type {Map<string, string>|null} */ this._text = null;
  }

  /** Form có formId này (theo .meta.json). */
  form(/** @type {string} */ id) { return (this.byId.get(id) || [])[0] || null; }

  /** Form nhúng formId qua child_form (trừ chính nó). */
  parentsOf(/** @type {string} */ id) { return this.forms.filter(f => f.childIds.includes(id) && !f.ids.includes(id)); }

  /** Form có code/ui dùng token {{<id>_...}} (trừ chính nó). */
  codeUsersOf(/** @type {string} */ id) { return this.forms.filter(f => f.codeRefs[id] && !f.ids.includes(id)); }

  /** Form có dropdown lấy dữ liệu từ catalog id. */
  catalogUsersOf(/** @type {string} */ id) { return this.forms.filter(f => f.catalogIds.includes(id)); }

  /**
   * Mọi file văn bản của customer/env (lazy, đọc 1 lần).
   * @returns {Map<string, string>} đường dẫn tuyệt đối → nội dung
   */
  text() {
    if (this._text) return this._text;
    this._text = new Map();
    for (const mod of /** @type {const} */ (['eform', 'eflow', 'ewriter', 'email', 'ecatalog'])) {
      for (const fp of listTextFiles(paths.moduleDir(this.customer, this.env, mod))) {
        try { this._text.set(fp, fs.readFileSync(fp, 'utf8')); } catch (_) {}
      }
    }
    return this._text;
  }

  /**
   * Tìm token (id, id đầy đủ, hashid) theo biên trong mọi file. Gom theo "chủ" (thư mục form/luồng/tài liệu).
   * @param {string} token
   * @param {{ exclude?: (fp: string) => boolean, prefix?: boolean }} [opt]
   * @returns {{ kind: string, owner: string, file: string, count: number }[]}
   */
  search(token, opt = {}) {
    if (!token) return [];
    const rx = tokenRx(token, !!opt.prefix);
    const out = [];
    for (const [fp, text] of this.text()) {
      if (opt.exclude && opt.exclude(fp)) continue;
      if (!text.includes(token)) continue;
      const m = text.match(rx);
      if (!m) continue;
      const { kind, owner } = this.ownerOf(fp);
      out.push({ kind, owner, file: paths.toRepoRel(fp), count: m.length });
    }
    return out.sort((a, b) => a.owner.localeCompare(b.owner, 'vi') || a.file.localeCompare(b.file));
  }

  /** File → phân hệ + thư mục chủ (form folder / luồng / tài liệu eWriter...). */
  ownerOf(/** @type {string} */ fp) {
    const loc = paths.parseWorkspacePath(fp);
    const kind = loc?.module || '?';
    if (kind === 'eform') {
      let d = path.dirname(fp);
      while (d.length > paths.WORKSPACE.length && !tree.isForm(d)) d = path.dirname(d);
      return { kind, owner: paths.toRepoRel(d) };
    }
    const rest = loc?.rest || [];
    return { kind, owner: paths.toRepoRel(path.join(paths.moduleDir(this.customer, this.env, /** @type {any} */ (kind)), rest[0] || '')) };
  }
}

/** Dựng nút form từ thư mục: danh tính + form con + catalog + token trong code/ui. */
function formNode(/** @type {string} */ dir) {
  const meta = tree.readMeta(dir) || {};
  const doc = fields.readDoc(dir);
  /** @type {string[]} */ const childIds = [], catalogIds = [];
  for (const f of doc?.fields || []) {
    const c = f.config || {};
    if (f.type === 'child_form' && c.childFormConfig?.childFormId) childIds.push(c.childFormConfig.childFormId);
    const dc = c.dropdownConfig;
    if (dc && Number(dc.typeGetData_value?.value) === 4 && typeof dc.data?.url === 'string' && dc.data.url) catalogIds.push(dc.data.url);
  }
  /** @type {Record<string, number>} */ const codeRefs = {};
  for (const t of [...Object.values(tree.readCode(dir)), ...Object.values(tree.readUi(dir))]) {
    const c = extractIds(t);
    for (const id in c) codeRefs[id] = (codeRefs[id] || 0) + c[id];
  }
  return {
    // Danh tính = targetFormId nếu có (formId cạnh nó có thể là id cũ/gốc copy), không thì formId.
    dir, rel: paths.toRepoRel(dir), ids: tree.metaIds(dir).slice(0, 1), name: meta.formName || path.basename(dir),
    childIds: [...new Set(childIds)], catalogIds: [...new Set(catalogIds)], codeRefs, doc,
  };
}

/** @type {Map<string, Graph>} */ const cache = new Map();

/** Đồ thị của customer/env (cache trong 1 tiến trình). */
function load(/** @type {string} */ customer, /** @type {string} */ env) {
  const k = customer + '/' + env;
  let g = cache.get(k);
  if (!g) { g = new Graph(customer, env); cache.set(k, g); }
  return g;
}

/** Bỏ cache (sau khi lệnh ghi đổi workspace). */
const invalidate = () => cache.clear();

/** Mọi cặp customer/env có trong workspace. */
function scopes() {
  /** @type {{ customer: string, env: string }[]} */ const out = [];
  for (const c of subdirs(paths.WORKSPACE)) for (const e of paths.envDirs(c)) out.push({ customer: c, env: e });
  return out;
}

module.exports = { Graph, load, invalidate, scopes, tokenRx, formNode };
