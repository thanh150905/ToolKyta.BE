// eFlow bộ eContract luồng 2 theo mẫu HĐMB luồng 1:
//   node eContract: File econtract ← (cờ TC "Có" ở node sửa ? Tài liệu ký kết node sửa : Tài liệu ký kết node soạn)
//   node sửa      : TC trạng thái/lý do ← eContract ; mọi field Start lồng ← node soạn
//   node ec_eflow.js [--write] [--only=TMCG,...]
const R = require('path').resolve(__dirname, '../..');
const api = require(R + '/src/eflow/api'), eformApi = require(R + '/src/eform/api'), fd = require(R + '/src/eform/formDef');
const { buildSource, INHERIT_TYPES } = require(R + '/src/eflow/inherit');
const WRITE = process.argv.includes('--write');
const ONLY = (process.argv.find(a => a.startsWith('--only=')) || '').slice(7).split(',').filter(Boolean);
const M1 = '00007mzImMIW2zVlrGe', M2 = '0000763IlxTv820RKK5';
const T1 = { soan: 'sid-23A1AE61-4F86-4793-B306-DADFE91870AC', ec: 'sid-7163E4A5-D65E-4315-8E90-BA4A51DC6CD8', upd: 'sid-D32CCB23-22ED-4FE6-BEDE-2C2A769B70F4', S: '000071ENIpKTrXAawmKRtJJ4J', ECF: '000071PnI8EgiQg0w4vEWSDDPD' };
const ECF2 = '000071owIE3ioe3qVPRDf44b4', TC = '00007123ImKho9AXnXAGtppJp';
const THTL = '000071GyIkbTkvAwWoxaS99P9';
const AGG = { TMCG: 'sid-8AB9BF89-0594-412B-A5DC-E63504680104', TBKQCG: 'sid-9A6E8E24-983C-4F26-8341-DD6E1F3C7F10', HDMB: 'sid-A727DD56-468C-46A8-9BE8-ACA9733E52B0', DNTT: 'sid-9605DBC9-1172-4F3C-AE91-93F184C7A897', BBNT: 'sid-0F937E3B-6049-41FD-8F86-6C242E7112C9', BBTL: 'sid-E5685D24-9856-4F79-9FF5-E5D980E6D0E2' };
const BO = {
  TMCG: { soan: 'sid-08ED666B-C40F-4FA6-8DB7-2D69844559E7', ec: 'sid-D5B2AB26-1261-4B6A-87BB-45EDC3A73E3E', upd: 'sid-BED74426-157F-48F6-B527-85E657ACE845', S: '000071MgINKClgM8gvn4Szzwz', U: '000071VoIxKTwgJLDx9LI99V9' },
  TBKQCG: { soan: 'sid-8B09B8C3-BBB2-4E5C-B69A-F5D3DA2B26DB', ec: 'sid-3F8BDC30-6C04-483C-B3E0-8B70B617FA22', upd: 'sid-8CED9048-F72F-4B91-BFB8-F5F96CD96F83', S: '000071ENIVyHrQoPPJ80iJJ4J', U: '000071pyIO6IE2dq8GmPIQQKQ' },
  HDMB: { soan: 'sid-202B8FA3-DDF9-4357-81BA-CD3E59208FA5', ec: 'sid-2E81A15A-3AC1-49E2-9122-54406559F357', upd: 'sid-25A4DD29-FF7A-49F3-9826-74EF88473A7A', S: '000071KnI6VsNvMQXoLdFKK3K', U: '000071RmIepH1VmX669wizzxz' },
  DNTT: { soan: 'sid-A1CA4D71-F510-40C3-900F-31286506595B', ec: 'sid-0F24CB35-7A14-4445-ACE8-E296C7AE1BD2', upd: 'sid-E9FB3BFD-453D-4939-B92E-71ACCE361370', S: '000071xnI63sEJ3Vp96pHEEME', U: '000071mzIoqIW4B35pqncMMvM' },
  BBNT: { soan: 'sid-038E140F-81AC-4A5A-9A6F-C2833EDD1896', ec: 'sid-31CB7740-64C6-49E3-B530-26B74CF6F010', upd: 'sid-6E168AE0-BE0B-4371-A500-965BB9A1625F', S: '000071mzIe2UW4Bwe6eyFMMvM', U: '000071gbIlxsgyD35l3GTooxo' },
  BBTL: { soan: 'sid-C4CF1290-FA98-478C-BD21-F1E8AFBF5BE8', ec: 'sid-60E096D0-00B1-4557-A4CD-EFD6A914BFBD', upd: 'sid-8F3D1251-3759-4B58-8794-FF8DB198F448', S: '0000718DIP1h18x5D1yMtLLKL', U: '000071JlIGJc4Abk16q0iQQ1Q' },
};
const fieldsOf = def => { const m = new Map(); (function w(n) { if (n.id && n.hashid && INHERIT_TYPES.has(n.type) && n.type !== 'textField_ticketName') m.set(n.id, n); (n.components || []).forEach(w); })({ components: def }); return m; };

(async () => {
  const ef = await eformApi.open('saigoncoop', 'sandbox'), fl = await api.open('saigoncoop', 'sandbox');
  const tpl = await api.inheritOf(fl, M1, T1.ec);
  const ECFIELDS = fieldsOf(fd.parseFormDef(await eformApi.getForm(ef, ECF2)).def);
  const save = async (node, form, rows, tag) => {
    const ext = (await api.externalForms(fl, M2, node))[0];
    const old = await api.inheritOf(fl, M2, node);
    const st = !ext ? 'CHƯA GẮN FORM — bỏ qua' : ext.formId !== form ? `✗ node gắn form khác ${ext.formId}` : `${rows.length} dòng · ${old ? 'thay ' + old.id + ' (' + old.sources.length + ')' : 'mới'}`;
    console.log(`  ${tag} ${node.slice(0, 12)}: ${st}`);
    if (!WRITE || !ext || ext.formId !== form) return;
    await api.saveInherit(fl, { ...(old ? { id: old.id } : {}), sources: rows, userTaskId: node, versionId: ext.versionId, modelerId: M2, formId: form });
    const chk = await api.inheritOf(fl, M2, node); console.log(`     ✓ ghi → ${chk.id} ${chk.sources.length} dòng`);
  };
  for (const [name, b] of Object.entries(BO)) {
    if (ONLY.length && !ONLY.includes(name)) continue;
    console.log(`== ${name}`);
    // 1) node eContract: chép công thức có điều kiện của L1, đổi sid/form/modeler
    let str = JSON.stringify(tpl.sources);
    for (const [a, c] of [[M1, M2], [T1.upd, b.upd], [T1.soan, b.soan], [T1.S, b.S], [T1.ECF, ECF2]]) str = str.split(a).join(c);
    const left = [M1, T1.upd, T1.soan, T1.S, T1.ECF, T1.ec].filter(x => str.includes(x));
    if (left.length) { console.log('  ✗ còn sót', left); continue; }
    await save(b.ec, ECF2, JSON.parse(str), 'eContract');
    // 2) node sửa
    const U = fieldsOf(fd.parseFormDef(await eformApi.getForm(ef, b.U)).def);
    const S = fieldsOf(fd.parseFormDef(await eformApi.getForm(ef, b.S)).def);
    const rows = [];
    for (const [tk, ek] of [['dropdown-1', 'dropdown-1'], ['textField-1', 'textField-4']]) rows.push(buildSource(M2, b.ec, ECFIELDS.get(`${ECF2}_${ek}`), U.get(`${TC}_${tk}`)));
    let n = 0; for (const [id, t] of U) { const s = S.get(id); if (s && !id.startsWith(TC)) { rows.push(buildSource(M2, b.soan, s, t)); n++; } }
    console.log(`  sửa: TC 2 dòng ← eContract + ${n} field Start ← node soạn`);
    await save(b.upd, b.U, rows, 'sửa');
    // 3) node Tổng hợp sau eContract: Upload file ← File econtract (như L1)
    if (AGG[name]) {
      const TH = fieldsOf(fd.parseFormDef(await eformApi.getForm(ef, THTL)).def);
      await save(AGG[name], THTL, [buildSource(M2, b.ec, ECFIELDS.get(`${ECF2}_upload_file-1`), TH.get(`${THTL}_upload_file-1`))], 'Tổng hợp');
    }
  }
  if (!WRITE) console.log('[DRY-RUN]');
})().catch(e => { console.error('✗', e.stack); process.exit(1); });
