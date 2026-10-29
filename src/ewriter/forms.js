// @ts-check
'use strict';
// Nạp định nghĩa form (jsonForm) để đối chiếu/dựng placeholder bản in. Nhận formId (gọi eForm trực tiếp — nhẹ)
// hoặc tên/mã form (tra danh sách form nguồn của eWriter).
const eformApi = require('../eform/api');
const api = require('./api');
const { parseFormDef } = require('../eform/formDef');
const { pickOne } = require('../core/pick');
const { splitList } = require('../core/args');
const { printFields } = require('./fields');

const looksLikeId = (/** @type {string} */ s) => /^0{3,}[A-Za-z0-9]{8,}$/.test(s);

/**
 * @param {string} customer
 * @param {string} env
 * @param {string} refs  "formId|tên[,formId|tên...]"
 * @returns {Promise<{ forms: { formId: string, formName: string, def: any }[], fields: import('./fields').PrintField[] }>}
 */
async function loadForms(customer, env, refs) {
  const list = splitList(refs);
  if (!list.length) throw new Error('Thiếu --form <formId|tên>.');
  /** @type {any[]|null} */ let sources = null;
  const forms = [];
  for (const ref of list) {
    let form;
    if (looksLikeId(ref)) form = await eformApi.getForm(await eformApi.open(customer, env), ref);
    else {
      sources ??= await api.sourceForms(await api.open(customer, env));
      form = pickOne(/** @type {any[]} */ (sources), ref, {
        what: 'eForm', id: x => x.formId, names: x => [x.formName, x.formCode, x.fullName],
        show: x => `${x.formId}  ${x.formName || x.fullName || ''}`,
      });
    }
    const { def } = parseFormDef(form);
    if (!def) throw new Error(`Form ${ref}: jsonForm rỗng.`);
    forms.push({ formId: form.formId || ref, formName: form.formName || form.fullName || ref, def });
  }
  return { forms, fields: printFields(forms) };
}

module.exports = { loadForms, looksLikeId };
