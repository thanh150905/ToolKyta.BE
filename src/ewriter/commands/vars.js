// @ts-check
'use strict';
// Quản lý biến của tài liệu bản in — kéo biến từ eForm vào cấu hình eWriter.
//   forms  : liệt kê eForm nguồn (để lấy formId)
//   list   : biến hiện có trong 1 tài liệu
//   apply  : kéo biến của 1 form vào tài liệu (mặc định gộp; --replace đồng bộ toàn bộ)
const api = require('../api');
const coreStore = require('../../core/store');
const { variablesFromForm } = require('../fields');
const { parseArgs, usage } = require('../../core/args');
const { pickOne, grep } = require('../../core/pick');

const USAGE = [
  'kyta ewriter vars forms  <customer> <env> [--grep "chuỗi"]',
  'kyta ewriter vars list   <customer> <env> <id|tên tài liệu>',
  'kyta ewriter vars apply  <customer> <env> <id|tên tài liệu> --form <formId|tên form> [--replace] [--dry-run]',
].join('\n');

/** Chọn tài liệu theo id/tên. */
async function pickDoc(/** @type {any} */ sess, /** @type {string} */ ref) {
  const list = await api.list(sess);
  return pickOne(list, ref, { what: 'tài liệu', id: x => x.id, names: x => [x.name], show: x => `${x.id}  ${x.name}` });
}

async function cmdForms(/** @type {any} */ sess, /** @type {string} */ customer, /** @type {string} */ env, /** @type {any} */ opts) {
  const forms = await api.sourceForms(sess);
  const rows = grep(forms, opts['--grep'], ['formName', 'formCode', 'fullName']);
  console.log(`${rows.length}/${forms.length} eForm nguồn ở ${customer}/${env}:\n`);
  for (const f of rows) console.log(`  ${String(f.formId).padEnd(26)} ${String(f.formCode || '').padEnd(16)} ${f.formName || f.fullName || ''}`);
}

async function cmdList(/** @type {any} */ sess, /** @type {string} */ ref) {
  const doc = await pickDoc(sess, ref);
  const vars = await api.variablesOf(sess, doc.id);
  const arr = Array.isArray(vars) ? vars : [];
  console.log(`${arr.length} biến trong "${doc.name}" (${doc.id})${doc.eformId ? '  · form: ' + doc.eformId : ''}:\n`);
  for (const v of arr) console.log(`  ${String(v.code).padEnd(12)} ${String(v.variableType).padEnd(10)} ${v.fieldId || ''}   ${v.variableName || ''}`);
}

async function cmdApply(/** @type {any} */ sess, /** @type {string} */ customer, /** @type {string} */ env, /** @type {string} */ ref, /** @type {any} */ opts, /** @type {Set<string>} */ flags) {
  const formRef = opts['--form'];
  if (!formRef) usage(USAGE);
  const doc = await pickDoc(sess, ref);
  const forms = await api.sourceForms(sess);
  const form = pickOne(forms, formRef, {
    what: 'eForm', id: x => x.formId, names: x => [x.formName, x.formCode, x.fullName],
    show: x => `${x.formId}  ${x.formName || x.fullName || ''}`,
  });

  const candidates = variablesFromForm(form);
  if (!candidates.length) throw new Error(`Không rút được field nào từ form "${form.formName || form.formId}" (jsonForm rỗng?).`);

  const existing = await api.variablesOf(sess, doc.id).catch(() => []);
  const existingFieldIds = new Set((Array.isArray(existing) ? existing : []).map(v => v.fieldId));
  const replace = flags.has('--replace');

  let addVariables, del;
  if (replace) { addVariables = candidates; del = true; }               // đồng bộ toàn bộ (sinh code mới)
  else { addVariables = candidates.filter(v => !existingFieldIds.has(v.fieldId)); del = false; }  // chỉ thêm field mới

  console.log(`Gán biến form "${form.formName || form.formId}" → "${doc.name}" (${customer}/${env})`);
  console.log(`  form có ${candidates.length} field · đã có ${existingFieldIds.size} biến · ${replace ? 'ĐỒNG BỘ TOÀN BỘ' : 'thêm mới'} ${addVariables.length} biến${flags.has('--dry-run') ? '   [DRY-RUN]' : ''}`);
  if (!addVariables.length && !replace) return console.log('  (không có field mới để thêm.)');
  if (flags.has('--dry-run')) {
    for (const v of addVariables.slice(0, 30)) console.log(`    + ${v.code}  ${v.variableType.padEnd(10)} ${v.fieldId}`);
    return;
  }

  await api.saveVariables(sess, doc.id, { addVariables, deleteVariables: [], dataAdd: [] }, { del });
  // Gắn form nguồn vào tài liệu (eformId) nếu chưa có.
  if (doc.eformId !== form.formId) {
    const full = await api.details(sess, doc.id, doc.resourceId);
    await api.updateResource(sess, { ...full, eformId: form.formId });
  }
  coreStore.audit({ op: 'ewriter-vars-apply', id: doc.id, formId: form.formId, added: addVariables.length, replace, customer, env });
  console.log(`  ✓ đã gán ${addVariables.length} biến${doc.eformId !== form.formId ? ' + gắn form nguồn' : ''}.`);
}

async function run(/** @type {string[]} */ argv) {
  const { _, flags, opts } = parseArgs(argv, { value: ['--grep', '--form'] });
  const [sub, customer, env, ref] = _;
  if (!sub || !customer || !env) usage(USAGE);
  const sess = await api.open(customer, env);
  if (sub === 'forms') return cmdForms(sess, customer, env, opts);
  if (sub === 'list') { if (!ref) usage(USAGE); return cmdList(sess, ref); }
  if (sub === 'apply') { if (!ref) usage(USAGE); return cmdApply(sess, customer, env, ref, opts, flags); }
  usage(USAGE);
}

module.exports = { run, usage: USAGE };
