// Port cấu hình eFlow 1 bộ từ luồng 1 → luồng 2: kế thừa (variables-configs), eNotify, người thực hiện node Duyệt (theo trường form).
//   node port_eflow.js bo2/<bộ>.js [--write] [--inherit-only]
// Kế thừa: bỏ dòng có nguồn/đích không còn trên form L2; L1 không có config → L2 về 0 dòng.
// Thay: modelerId, SID (SPEC.SID + SPEC.NODES), formId S/D/U, hashid (port_<bộ>_hmap.json), versionId (theo form gắn ở 2 luồng).
const R = require('path').resolve(__dirname, '../..');
const api = require(R + '/src/eflow/api'), modeler = require(R + '/src/eflow/modeler');
const fs = require('fs'), path = require('path');
const SP = __dirname, WRITE = process.argv.includes('--write'), INH_ONLY = process.argv.includes('--inherit-only');
const eformApi = require(R + '/src/eform/api');
const OUT = require('path').resolve(__dirname, '../../.kyta/archive/saigoncoop-out'); require('fs').mkdirSync(OUT, { recursive: true });
const SPEC = require(path.resolve(process.argv[2])), TAG = path.basename(path.dirname(path.resolve(process.argv[2]))) + '_' + path.basename(process.argv[2], '.js');   // gồm thư mục spec (bo2/bo3/bo4 trùng tên file)
const HMAP = JSON.parse(fs.readFileSync(`${OUT}/port_${TAG}_hmap.json`, 'utf8'));
const E = SPEC.EFLOW;
const M1 = '00007mzImMIW2zVlrGe', M2 = E.M2 || '0000763IlxTv820RKK5';

(async () => {
  const s = await api.open('saigoncoop', 'sandbox');
  const m1 = await modeler.load(s, M1), m2 = await modeler.load(s, M2);
  const full = p => (p.startsWith('sid-') ? p : (m1.nodes.find(n => n.rid.startsWith('sid-' + p)) || m2.nodes.find(n => n.rid.startsWith('sid-' + p)) || { rid: p }).rid);
  const SIDS = { ...SPEC.SID }; for (const [a, b] of E.NODES) SIDS[full(a)] = full(b);
  const b1 = await api.eforms(s, M1), b2 = await api.eforms(s, M2);
  const VER = {};   // versionId L1 → L2 theo cặp formId
  for (const t of ['S', 'D', 'U']) { const f1 = b1.find(x => x.formId === SPEC.SRC[t]), f2 = b2.find(x => x.formId === SPEC.DST[t]); if (f1 && f2) VER[f1.versionId] = f2.versionId; }
  // E.START_AS: node L2/L3 thay cho node Start của L1 (form soạn không nằm ở Start) — đổi nguồn userTaskId null → sid đó.
  const sub = str => {
    if (E.START_AS) str = str.split(`-Root-null-${M1}`).join(`-Root-${E.START_AS}-${M1}`).split(`${M1}.null.`).join(`${M1}.${E.START_AS}.`).split('"userTaskId":null').join(`"userTaskId":"${E.START_AS}"`);
    str = str.split(M1).join(M2);
    for (const [a, b] of Object.entries(SIDS)) str = str.split(a).join(b);
    for (const t of ['S', 'D', 'U']) str = str.split(SPEC.SRC[t]).join(SPEC.DST[t]);
    for (const [a, b] of Object.entries(VER)) str = str.split(a).join(b);
    for (const [a, b] of Object.entries(HMAP)) str = str.split(a).join(b);
    for (const [a, b] of [...(SPEC.TEXT || []), ...(E.TEXT || [])]) str = str.split(a).join(b);
    return str;
  };
  // còn id L1: modelerId/SID/formId/versionId đã khai, hoặc sid không phải node L2 (node L1 chưa khai cặp trong NODES)
  const left = str => [M1, ...Object.keys(SIDS), ...Object.values(SPEC.SRC), ...Object.keys(VER)].filter(x => str.includes(x))
    .concat([...new Set(str.match(/sid-[0-9A-F]{8}-[0-9A-F-]{27}/g) || [])].filter(x => !m2.nodes.some(n => n.rid === x)));
  const nm = rid => (m2.nodes.find(n => n.rid === rid) || {}).name || rid;

  // 1) kế thừa
  const ef = await eformApi.open('saigoncoop', 'sandbox'), HC = {};
  const hashes = async fid => { if (!fid) return null; if (HC[fid]) return HC[fid]; const f = await eformApi.getForm(ef, fid); const m = new Set();
    (function w(n) { if (n.hashid) m.add(n.hashid); (n.components || []).forEach(w); })({ components: JSON.parse(f.jsonForm) }); return (HC[fid] = m); };
  const formOf2 = t => (b2.find(x => (x.userTaskId || null) === (t || null)) || {}).formId;
  for (const [a, b] of E.INHERIT) {
    const src = full(a), dst = full(b);
    const c1 = await api.inheritOf(s, M1, src);
    const ext = (await api.externalForms(s, M2, dst))[0];
    if (!ext) { console.log(`kế thừa: L2 ${nm(dst)} CHƯA GẮN FORM — bỏ qua`); continue; }
    const c2old = await api.inheritOf(s, M2, dst);
    if (!c1) {
      console.log(`kế thừa ${nm(dst)}: L1 không có config → ${c2old ? `đặt về 0 dòng (đang ${c2old.sources.length})` : 'L2 cũng chưa có — bỏ qua'}`);
      if (WRITE && c2old && c2old.sources.length) { await api.saveInherit(s, { id: c2old.id, sources: [], userTaskId: dst, versionId: ext.versionId, modelerId: M2, formId: ext.formId }); console.log('   ✓ ghi → 0 dòng'); }
      continue;
    }
    const tf = await hashes(ext.formId), drop = [], sources = [];
    for (const r of JSON.parse(sub(JSON.stringify(c1.sources)))) {
      const why = [];
      if (!tf.has(r.elementTarget)) why.push('đích');
      for (const e of r.listElementSource || []) { const sf = await hashes(formOf2(e.userTaskId)); if (sf && !sf.has(e.hashId)) why.push('nguồn ' + e.label); }
      if (why.length) drop.push(`${(r.listElementSource || []).map(e => e.label).join('+') || r.elementTarget} (${why.join(', ')})`); else sources.push(r);
    }
    if (drop.length) console.log(`   bỏ ${drop.length} dòng L1 không áp được: ${drop.join(' | ')}`);
    // giữ dòng L2 riêng (field L2 giữ lại qua KEEP…): còn hợp lệ trên form và L1 không có dòng cho cùng đích
    const kept = [];
    for (const r of (c2old && c2old.sources) || []) {
      if (sources.some(x => x.elementTarget === r.elementTarget) || !tf.has(r.elementTarget)) continue;
      let ok = true; for (const e of r.listElementSource || []) { const sf = await hashes(formOf2(e.userTaskId)); if (sf && !sf.has(e.hashId)) ok = false; }
      if (ok) { sources.push(r); kept.push((r.listElementSource || []).map(e => e.label).join('+') || r.elementTarget); }
    }
    if (kept.length) console.log(`   giữ ${kept.length} dòng L2 riêng: ${kept.join(' | ')}`);
    const body = { ...(c2old ? { id: c2old.id } : {}), sources, userTaskId: dst, versionId: ext.versionId, modelerId: M2, formId: ext.formId };
    const lf = left(JSON.stringify(sources));
    console.log(`kế thừa ${nm(dst)}: ${sources.length} dòng (L1 ${c1.sources.length}) · form ${ext.formId === sub(c1.formId) ? '✓' : '✗ ' + ext.formId + ' ≠ ' + sub(c1.formId)} · ${c2old ? 'PUT ' + c2old.id : 'POST mới'}${lf.length ? ' · CÒN SÓT ' + lf : ''}`);
    if (WRITE && !lf.length) { await api.saveInherit(s, body); const chk = await api.inheritOf(s, M2, dst); console.log(`   ✓ ghi → ${chk.id} ${chk.sources.length} dòng`); }
  }
  // 2) eNotify
  for (const [a, b] of INH_ONLY ? [] : E.NOTIFY) {
    const src = full(a), dst = full(b);
    const rows = await api.notifyConfigs(s, M1, src), cur = await api.notifyConfigs(s, M2, dst);
    if (cur.length) { console.log(`eNotify ${dst.slice(4, 12)}: đã có ${cur.length} dòng — bỏ qua`); continue; }
    for (const r of rows) {
      const o = JSON.parse(sub(JSON.stringify(api.cleanNotifyConfig(r)))); o.id = null; o.userTaskId = dst; o.modelerId = M2;
      const lf = left(JSON.stringify(o));
      const who = o.infoReceiver?.type === 'form' ? (o.infoReceiver.fields || []).map(f => f.name.replace(/^Form: /, '')).join(',') : (o.infoReceiver?.infoPerson || []).map(p => p.fullName).join(',') || o.infoReceiver?.type;
      console.log(`eNotify ${dst.slice(4, 12)} ← ${src.slice(4, 12)}: «${o.templateName}» → ${who}${lf.length ? ' · CÒN SÓT ' + lf : ''}`);
      if (WRITE && !lf.length) { await api.saveNotifyConfig(s, o, 'POST'); console.log('   ✓ ghi'); }
    }
  }
  // 3) người thực hiện node Duyệt: theo trường form (field DS người thực hiện trong form con GS ở form Start)
  for (const [b, f] of INH_ONLY ? [] : E.IMPL_FORM || []) {
    const dst = full(b);
    const cur = await api.implementers(s, dst, m2.processId);
    if (cur.length) { console.log(`người thực hiện ${nm(dst)}: đã có ${cur.length} — bỏ qua`); continue; }
    const startForm = b2.find(x => x.formId === f.formId);
    const field = { name: `${startForm.formName} - ${startForm.formCode}_${f.label}`, type: 'dropdown', formId: f.formId, hashid: f.hashid, fieldId: f.fieldId, modelerId: M2, versionId: startForm.versionId, userTaskId: f.userTaskId || null };
    const obj = { id: null, executorType: 'form', type: 'internal', role: null, roleId: null, position: null, roleScope: null, implementationDepartment: null, fieldFormDepartment: null,
      executorId: null, email: null, phoneNumber: null, managerType: null, stepExecute: null, level: null, fieldForm: [field], fieldFormStr: JSON.stringify([field]), formUserTask: null,
      externalUser: '', emailExternal: [], notificationMethod: '["email"]', authorizationType: '["internal"]', delegationOfAuthority: true, condition: false, conditionText: 'null',
      eventMail: [{ key: 'start', value: null }, { key: 'reminder', value: null }, { key: 'completed ', value: null }], taskRole: null,
      attributeStr: JSON.stringify({ eventMail: null, taskRole: null, executor: null, fieldFormDepartment: null }),
      processId: m2.processId, modelerId: M2, modelerName: m2.name, userTaskId: dst, custId: m2.custId };
    console.log(`người thực hiện ${nm(dst)} ← trường form «${f.label}» (${f.fieldId}, form ${startForm.formName} v${startForm.versionId})`);
    if (WRITE) { await api.addImplementer(s, obj); const chk = await api.implementers(s, dst, m2.processId); console.log(`   ✓ ghi → ${chk.map(x => x.executorType + ':' + JSON.stringify(x.fieldForm?.map(z => z.fieldId))).join(' ')}`); }
  }
  if (!WRITE) console.log('[DRY-RUN]');
})().catch(e => { console.error('✗', e.stack); process.exit(1); });
