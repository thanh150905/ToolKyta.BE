// @ts-check
'use strict';
// Biểu mẫu gắn vào node (tab "Biểu mẫu"): list | set. Trình tự ghi lấy từ bundle editor eflow (2026-10-23):
//   đổi form   : [DELETE forms/user-task/{M}/{sid} + DELETE eform common/procedure?userTaskId=] → DELETE variables-configs/{id} (UI xoá kế thừa)
//                → POST forms {userTaskId, formId, modelerId, jsonFormStr, formName, formCode, versionId}
//                → POST eform common/procedure {userTaskId, formId, processId: modelerId, procedureName, stepName, formType: null}
//   --latest   : như trên với form hiện tại, bản phát hành mới nhất, GIỮ kế thừa (UI "Cập nhật version form").
const api = require('../api');
const modeler = require('../modeler');
const store = require('../../core/store');
const { parseArgs, usage } = require('../../core/args');
const { pickOne } = require('../../core/pick');

const USAGE = [
  'kyta eflow form list <customer> <env> <quy trình> [<node>]',
  'kyta eflow form set  <customer> <env> <quy trình> <node> --form <formId|mã|tên> [--dry-run]   (KHOÁ GHI — chỉ in trình tự; xoá kế thừa như UI)',
  'kyta eflow form set  <customer> <env> <quy trình> <node> --latest [--dry-run]                 (lên bản phát hành mới nhất, giữ kế thừa)',
].join('\n');

async function run(/** @type {string[]} */ argv) {
  const [action, ...rest] = argv;
  const { _, flags, opts } = parseArgs(rest, { value: ['--form'] });
  const [customer, env, ref, nodeRef] = _;
  if (!['list', 'set'].includes(action) || !customer || !env || !ref) usage(USAGE);
  const sess = await api.open(customer, env);
  const m = await modeler.load(sess, ref);
  const bound = await api.eforms(sess, m.id);
  const released = await api.releasedForms(sess);
  const latestOf = (/** @type {string} */ formId) => released.find((/** @type {any} */ f) => f.formId === formId);
  const verNote = (/** @type {any} */ f) => {
    const l = latestOf(f.formId);
    return !l ? '' : l.versionId === f.versionId ? '' : `  ⚠ có bản mới ${l.versionId}`;
  };

  if (action === 'list') {
    if (nodeRef) {
      const node = modeler.findNode(m, nodeRef);
      const rows = await api.externalForms(sess, m.id, node.rid);
      console.log(`Biểu mẫu của "${node.name}" (${node.rid}): ${rows.length}\n`);
      for (const f of rows) console.log(`  ${f.formCode || ''}  ${f.formName || ''}\n    formId ${f.formId} · version ${f.versionId} · bản ghi ${f.id}${verNote(f)}`);
      return;
    }
    const start = bound.find(f => !f.userTaskId);
    console.log(`Biểu mẫu theo node của "${m.name}":\n`);
    if (start) console.log(`  ${'Start'.padEnd(50)} ${start.formCode}${verNote(start)}`);
    for (const n of m.nodes.filter(x => x.stencil === 'CallActivity')) {
      const f = bound.find(x => x.userTaskId === n.rid);
      console.log(`  ${String(n.name || n.rid).padEnd(50)} ${f ? f.formCode + verNote(f) : '(chưa gắn form)'}`);
    }
    return;
  }

  // set
  if (!nodeRef || (!opts['--form'] && !flags.has('--latest'))) usage(USAGE);
  const dryRun = flags.has('--dry-run');
  const node = modeler.findNode(m, nodeRef);
  const current = (await api.externalForms(sess, m.id, node.rid))[0] || null;
  const latest = flags.has('--latest');
  if (latest && !current) throw new Error(`Node "${node.name}" chưa gắn form — dùng --form.`);
  const target = latest ? latestOf(current.formId) : pickOne(released, opts['--form'], {
    what: 'eForm phát hành', id: f => f.formId, names: f => [f.formCode, f.formName],
    show: f => `${f.formId}  ${f.formCode || ''}  ${f.formName || ''}`,
  });
  if (!target) throw new Error(`Không thấy bản phát hành của form ${current?.formId}.`);
  if (current && current.formId === target.formId && current.versionId === target.versionId) return console.log('  (node đã gắn đúng form + version này.)');

  const inherit = latest || !current ? null : await api.inheritOf(sess, m.id, node.rid);
  console.log(`Gắn form vào "${node.name}"${dryRun ? '   [DRY-RUN]' : ''}`);
  console.log(`  cũ : ${current ? `${current.formCode} (version ${current.versionId})` : '(chưa có)'}`);
  console.log(`  mới: ${target.formCode} (version ${target.versionId})`);
  if (inherit) console.log(`  ⚠ xoá cấu hình kế thừa ${inherit.id} (${inherit.sources?.length || 0} dòng) như UI — dựng lại: kyta eflow inherit auto|copy ...`);
  const body = {
    userTaskId: node.rid, formId: target.formId, modelerId: m.id, jsonFormStr: target.jsonForm,
    formName: target.formName, formCode: target.formCode, versionId: String(target.versionId),
  };
  const proc = { userTaskId: node.rid, formId: target.formId, processId: m.id, procedureName: m.name, stepName: node.name, formType: null };
  const plan = [
    ...(current ? [`DELETE forms/user-task/${m.id}/${node.rid}`, `DELETE eform common/procedure?userTaskId=${node.rid}&processId=${m.id}`] : []),
    ...(inherit ? [`DELETE variables-configs/${inherit.id}`] : []),
    `POST forms ${JSON.stringify({ ...body, jsonFormStr: `<${String(body.jsonFormStr).length} ký tự>` })}`,
    `POST eform common/procedure ${JSON.stringify(proc)}`,
  ];
  console.log('\n  Trình tự sẽ gọi:\n' + plan.map(x => '    ' + x).join('\n'));
  // KHOÁ GHI (2026-10-23): trình tự trên suy từ bundle, CHƯA đủ — UI còn cấu hình khác để form hiện ở chỗ khác
  // (vd danh sách form chọn field điều kiện trên dây sau gateway). Chỉ mở lại khi đã đối chiếu HAR thao tác UI thật (kyta har).
  if (!flags.has('--unlocked-by-har')) {
    return console.log('\n  ⛔ form set đang KHOÁ GHI: trình tự chưa được đối chiếu với thao tác UI thật (thiếu cấu hình phụ).'
      + '\n     Gắn form qua UI; muốn mở lệnh: ghi HAR khi gắn form trên UI → kyta har <file.har> để đối chiếu.');
  }
  if (dryRun) return console.log('\n[DRY-RUN] Không gửi.');

  if (current) {
    await api.removeNodeForm(sess, m.id, node.rid);
    await api.removeFormProcedure(sess, node.rid, m.id);   // processId bắt buộc — rỗng có thể trúng node cùng sid ở luồng clone
  }
  if (inherit) await api.removeInherit(sess, inherit.id);
  await api.selectForm(sess, body);
  await api.addFormProcedure(sess, proc);
  store.audit({ op: 'eflow-form-set', modelerId: m.id, userTaskId: node.rid, formId: target.formId, versionId: target.versionId, customer, env });
  console.log('  ✓ đã gắn.');
}

module.exports = { run, usage: USAGE };
