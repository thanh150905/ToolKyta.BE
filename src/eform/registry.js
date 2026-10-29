// @ts-check
'use strict';
// workspace/registry.json: bảng tra formId → customer/env/path, dựng offline từ cây file (có commit).
// Dùng để chặn lệch môi trường: vân tay của form thuộc env nào.
const tree = require('./tree');
const { REGISTRY_FILE } = require('../core/paths');
const { readJson, writeJson } = require('../core/fsx');

/**
 * @typedef {{ formId: string|null, customer: string, env: string, group: string, form: string, path: string, referencedFormIds: string[] }} Entry
 */

/** Chỉ mục registry theo formId (thiếu file → rỗng). */
function load() {
  const reg = readJson(REGISTRY_FILE, null);
  if (reg && !Array.isArray(reg.forms)) throw new Error('registry.json sai cấu trúc — chạy lại: kyta eform registry');
  /** @type {Entry[]} */ const forms = reg ? reg.forms : [];
  /** @type {Record<string, Entry>} */ const byId = {};
  for (const f of forms) if (f.formId) byId[f.formId] = f;
  return { forms, byId };
}

/** Dựng lại registry từ cây file. Trả { count, warnings }. */
function build() {
  const warnings = [];
  /** @type {Entry[]} */ const forms = [];
  for (const dir of tree.listForms()) {
    const loc = tree.locate(dir);
    const fp = tree.fingerprint(dir);
    if (!fp.id) warnings.push('không có formId trong code: ' + loc.repoPath);
    forms.push({
      formId: fp.id, customer: loc.customer, env: loc.env, group: loc.group, form: loc.form, path: loc.repoPath,
      referencedFormIds: Object.keys(fp.all).filter(id => id !== fp.id).sort(),   // id form khác được tham chiếu
    });
  }
  forms.sort((a, b) => a.path.localeCompare(b.path));
  writeJson(REGISTRY_FILE, { note: 'Sinh tự động bởi kyta eform registry — không sửa tay.', count: forms.length, forms });
  return { count: forms.length, warnings };
}

module.exports = { load, build };
