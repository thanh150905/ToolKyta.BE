// @ts-check
'use strict';
// Tra cứu theo tên cho các lệnh eFlow: role, mẫu mail, eForm của quy trình, field trong form.
const { pickOne } = require('../core/pick');

const findRole = (/** @type {any[]} */ roles, /** @type {string} */ ref) => pickOne(roles, ref, {
  what: 'role', id: r => r.id, names: r => [r.code, r.name],
  show: r => `${String(r.id).padEnd(8)} ${String(r.code || '').padEnd(20)} ${r.name}`,
  hint: 'Xem: kyta eflow roles <customer> <env> --grep "..."',
});

const findTemplate = (/** @type {any[]} */ tpls, /** @type {string} */ ref) => pickOne(tpls, ref, {
  what: 'mẫu mail', id: t => t.id, names: t => [t.name],
  show: t => `${t.id}  ${t.name}`,
  hint: 'Xem: kyta eflow notify templates <customer> <env> --grep "..."',
});

const findEForm = (/** @type {any[]} */ forms, /** @type {string} */ ref) => pickOne(forms, ref, {
  what: 'form', id: f => f.formId, names: f => [f.formCode, f.formName],
  show: f => `${f.formId}  ${f.formCode || ''}  ${f.formName}`,
});

/** Mọi field (có id + type) trong jsonForm, duyệt cả cột/hàng lồng nhau. */
function formFields(/** @type {any} */ form) {
  /** @type {{ id: string, type: string, label: string, hashid: string }[]} */ const out = [];
  const walk = (/** @type {any[]} */ comps) => {
    for (const c of comps || []) {
      if (!c) continue;
      if (c.id && c.type && c.type !== 'page') out.push({ id: c.id, type: c.type, label: c.label || '', hashid: c.hashid });
      walk(c.components);
      for (const col of c.columns || []) walk(col.components || col.rows || []);
      for (const row of c.rows || []) walk(row.components || []);
    }
  };
  let pages = [];
  try { pages = JSON.parse(form.jsonForm || '[]'); } catch (_) {}
  for (const p of pages) walk(p.components);
  return out;
}

const findField = (/** @type {any} */ form, /** @type {string} */ ref) => pickOne(formFields(form), ref, {
  what: `trường trong "${form.formName}"`, id: x => x.id, names: x => [x.label],
  show: x => `[${x.type}] ${x.label}  (${x.id})`,
  hint: `Xem: kyta eflow notify fields <customer> <env> <quy trình> --form "${form.formCode || form.formName}"`,
});

/**
 * Chỉ mục field của mọi form trong quy trình theo "scope": id modeler (form Start, userTaskId rỗng) | sid node.
 * Đây cũng là tiền tố biến trong điều kiện dây: execution.getVariable("<scope>.<field.id>").
 * @param {any[]} forms   kết quả api.eforms(modelerId) (có jsonForm + userTaskId)
 * @param {import('./modeler').Loaded} m
 */
function scopeIndex(forms, m) {
  /** @type {Record<string, string>} */ const nameOf = {};
  m.nodes.forEach(n => { nameOf[n.rid] = n.name || n.rid; });
  /** @type {Map<string, { scope: string, node: string, form: any, fields: ReturnType<typeof formFields> }>} */
  const scopes = new Map();
  for (const f of forms) {
    const scope = f.userTaskId || m.id;
    if (!scopes.has(scope)) scopes.set(scope, { scope, node: f.userTaskId ? nameOf[f.userTaskId] || f.userTaskId : 'Start', form: f, fields: formFields(f) });
  }
  /** @type {Map<string, { scope: string, node: string, field: { id: string, type: string, label: string, hashid: string } }>} */
  const vars = new Map();
  for (const sc of scopes.values()) for (const field of sc.fields) vars.set(`${sc.scope}.${field.id}`, { scope: sc.scope, node: sc.node, field });
  return { scopes, vars };
}

/** Nhãn đọc được cho id biến "<scope>.<fieldId>": [node] nhãn. */
function varLabel(/** @type {ReturnType<typeof scopeIndex>} */ idx, /** @type {string} */ id) {
  const v = idx.vars.get(id);
  return v ? `[${v.node}] ${v.field.label || v.field.id}` : id;
}

module.exports = { findRole, findTemplate, findEForm, formFields, findField, scopeIndex, varLabel };
