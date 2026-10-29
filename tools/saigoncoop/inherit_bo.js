// Kế thừa cho bộ ký eForm luồng 2 theo mẫu luồng 1:
//   Duyệt  ← node soạn: mọi field dữ liệu cùng key form S↔D (+ GS bảng ký → GD bảng ký, GS DS người thực hiện → GD DS email đã ký)
//   Update ← node Duyệt: B (họ tên/email/lý do YCCS) → A ; ← node soạn: field S lồng + GS bảng ký
//   node inherit_bo.js bo2/<bộ>.js [--write]     (spec.INH = { soan, duyet, update } sid luồng 2)
const R = require('path').resolve(__dirname, '../..');
const api = require(R + '/src/eflow/api'), eformApi = require(R + '/src/eform/api'), fd = require(R + '/src/eform/formDef');
const { buildSource, INHERIT_TYPES } = require(R + '/src/eflow/inherit');
const path = require('path');
const WRITE = process.argv.includes('--write');
const SPEC = require(path.resolve(process.argv[2])); const { L2, INH } = SPEC;
const M = (SPEC.EFLOW && SPEC.EFLOW.M2) || '0000763IlxTv820RKK5';
const GS = '0000714XIkQtdLArKXAdcPPOP', GD = '000071gbIlXigNQmyqJmHooxo', A = '0000710eIRqU2vxQM2EVH44n4', B = '000071w9IROCEaVw1d4ktzzpz';
const fieldsOf = def => { const m = new Map(); (function w(n) { if (n.id && n.hashid && INHERIT_TYPES.has(n.type) && n.type !== 'textField_ticketName') m.set(n.id, n); (n.components || []).forEach(w); })({ components: def }); return m; };

(async () => {
  const ef = await eformApi.open('saigoncoop', 'sandbox'), fl = await api.open('saigoncoop', 'sandbox');
  const F = {}; for (const t of ['S', 'D', 'U']) F[t] = fieldsOf(fd.parseFormDef(await eformApi.getForm(ef, L2[t])).def);
  const key = (id, fid) => id.startsWith(fid + '_') ? id.slice(fid.length + 1) : null;
  const plan = [];
  // Duyệt
  {
    const rows = [], log = [];
    for (const [id, t] of F.D) {
      const k = key(id, L2.D); if (!k) continue;
      const s = F.S.get(`${L2.S}_${k}`) || [...F.S.values()].find(x => key(x.id, L2.S) && x.type === t.type && x.label === t.label);
      if (s) { rows.push(buildSource(M, INH.soan, s, t)); log.push(k); }
    }
    for (const [tk, sk] of [['table_advance-1', 'table_advance-1'], ['dropdown-1', 'dropdown-1']]) {
      const t = F.D.get(`${GD}_${tk}`), s = F.S.get(`${GS}_${sk}`); if (t && s) { rows.push(buildSource(M, INH.soan, s, t)); log.push(`GD.${tk}←GS.${sk}`); }
    }
    plan.push({ node: INH.duyet, form: L2.D, rows, log });
  }
  // Update
  {
    const rows = [], log = [];
    for (const k of ['textField-1', 'textField-2', 'textArea-1']) { const t = F.U.get(`${A}_${k}`), s = F.D.get(`${B}_${k}`); if (t && s) { rows.push(buildSource(M, INH.duyet, s, t)); log.push(`A.${k}←B`); } }
    for (const [id, t] of F.U) { if (!key(id, L2.S)) continue; const s = F.S.get(id); if (s) { rows.push(buildSource(M, INH.soan, s, t)); log.push(key(id, L2.S)); } }
    const t = F.U.get(`${GS}_table_advance-1`), s = F.S.get(`${GS}_table_advance-1`); if (t && s) { rows.push(buildSource(M, INH.soan, s, t)); log.push('GS.table'); }
    plan.push({ node: INH.update, form: L2.U, rows, log });
  }
  for (const p of plan) {
    const ext = (await api.externalForms(fl, M, p.node))[0];
    const old = await api.inheritOf(fl, M, p.node);
    console.log(`${p.node.slice(0, 12)} form ${ext ? (ext.formId === p.form ? '✓' : '✗ ' + ext.formId) : 'CHƯA GẮN'} · ${p.rows.length} dòng · ${old ? 'thay ' + old.id + ' (' + old.sources.length + ')' : 'mới'}\n   ${p.log.join(' ')}`);
    if (!WRITE || !ext || ext.formId !== p.form) continue;
    await api.saveInherit(fl, { ...(old ? { id: old.id } : {}), sources: p.rows, userTaskId: p.node, versionId: ext.versionId, modelerId: M, formId: p.form });
    const chk = await api.inheritOf(fl, M, p.node); console.log(`   ✓ ghi → ${chk.id} ${chk.sources.length} dòng`);
  }
  if (!WRITE) console.log('[DRY-RUN]');
})().catch(e => { console.error('✗', e.stack); process.exit(1); });
