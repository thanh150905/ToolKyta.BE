// @ts-check
'use strict';
// Tiện ích regen variableArr từ jsonForm cho form / subform BMW sandbox
const path = require('path');
const api = require('../src/eform/api');
const formDef = require('../src/eform/formDef');

function extractVariables(def) {
  const vars = [];
  const seen = new Set();
  function walk(node) {
    if (!node || typeof node !== 'object') return;
    if (Array.isArray(node)) {
      node.forEach(walk);
      return;
    }
    if (node.id && !seen.has(node.id)) {
      seen.add(node.id);
      const vName = node.label || node.config?.label || node.name || node.type || '';
      vars.push({
        code: node.id,
        variableName: vName,
        variableType: node.type || 'text'
      });
    }
    if (node.type === 'child_form' && Array.isArray(node.components)) {
      node.components.forEach(walk);
    }
    if (Array.isArray(node.components)) {
      node.components.forEach(walk);
    }
    if (Array.isArray(node.columns)) {
      node.columns.forEach(walk);
    }
    if (Array.isArray(node.rows)) {
      node.rows.forEach(walk);
    }
  }
  walk(def);
  return vars;
}

async function regen(formIds) {
  const sess = await api.open('bmw', 'sandbox');
  for (const id of formIds) {
    try {
      const form = await api.getForm(sess, id);
      const { def, wasString } = formDef.parseFormDef(form);
      if (!def) {
        console.warn(`[regenVA] Form ${id} không có jsonForm.`);
        continue;
      }
      const newVars = extractVariables(def);
      const payload = formDef.buildOwnerFormPayload(form, def, wasString);
      payload.variableArr = newVars;
      await api.putForm(sess, payload);
      console.log(`✓ [regenVA] ${id} (${form.formName}): ${newVars.length} biến.`);
    } catch (e) {
      console.error(`✗ [regenVA] ${id}: lỗi -`, e.message);
    }
  }
}

if (require.main === module) {
  const args = process.argv.slice(2);
  if (!args.length) {
    console.log('Cách dùng: node scratch/regen_variable_arr.js <formId1> <formId2> ...');
    process.exit(1);
  }
  regen(args).then(() => console.log('Hoàn thành regen variableArr.'));
}

module.exports = { extractVariables, regen };
