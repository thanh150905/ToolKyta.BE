// Sửa eFlow 1 bộ hồ sơ sau khi tách form con: eNotify (người nhận theo field) + dòng kế thừa.
// Chỉ đổi field cũ → field form con theo MAP; dòng kế thừa có đích không còn thì bỏ. Dây điều kiện: user tự kéo.
//   node eflow_fix_bo.js bo/<tên>.map.json            (dry-run)
//   node eflow_fix_bo.js bo/<tên>.map.json --write    (ghi thật, backup notify_/inherit_backup_*.json)
const R = require('path').resolve(__dirname, '../..');
const api = require(R + '/src/eflow/api');
const eformApi = require(R + '/src/eform/api');
const fd = require(R + '/src/eform/formDef');
const { buildSource } = require(R + '/src/eflow/inherit');
const fs = require('fs');
const SP = __dirname;
const OUT = require('path').resolve(__dirname, '../../.kyta/archive/saigoncoop-out'); require('fs').mkdirSync(OUT, { recursive: true });
const WRITE = process.argv.includes('--write');
const M = '00007mzImMIW2zVlrGe';
const { S, D, U, MAP } = require(require('path').resolve(process.argv[2]));
const GONE = Object.keys(MAP);
const strip = id => id.replace(/-(Target|Root)-.*$/, '');
const sh = id => ({ [S]: 'S', [D]: 'D', [U]: 'U' }[id.split('_')[0]] || id.split('_')[0].slice(-6)) + '.' + id.split('_').slice(1).join('_');

(async () => {
  const ef = await eformApi.open('saigoncoop', 'sandbox');
  const fl = await api.open('saigoncoop', 'sandbox');
  const FIELDS = {}, NAME = {};
  for (const id of [S, D, U].filter(Boolean)) {
    const form = await eformApi.getForm(ef, id); NAME[id] = form.formName;
    const { def } = fd.parseFormDef(form);
    const m = new Map(); (function w(n) { if (n.id && n.type) m.set(n.id, { id: n.id, type: n.type, label: n.label, hashid: n.hashid }); (n.components || []).forEach(w); })({ components: def });
    FIELDS[id] = m;
  }
  const field = (formId, id) => FIELDS[formId] && FIELDS[formId].get(id);
  const log = [];
  const all = await api.inheritAll(fl, M);
  const formOfSid = Object.fromEntries(all.map(c => [c.userTaskId, c.formId]));

  // ---- 1. eNotify ----
  const m = await require(R + '/src/eflow/modeler').load(fl, M);
  for (const n of m.nodes.filter(x => x.stencil === 'eNotify')) {
    for (const c of await api.notifyConfigs(fl, M, n.rid)) {
      const fields = (c.infoReceiver && c.infoReceiver.fields) || [];
      if (!fields.some(f => MAP[f.fieldId])) continue;
      if (WRITE) fs.writeFileSync(`${OUT}/notify_backup_${c.id}.json`, JSON.stringify(c, null, 1));
      const obj = api.cleanNotifyConfig(c);
      obj.infoReceiver = { ...c.infoReceiver, fields: fields.map(f => {
        const nid = MAP[f.fieldId]; if (!nid) return f;
        const nf = field(f.formId, nid); if (!nf) throw new Error(`eNotify ${c.id}: không thấy ${nid} trong form ${f.formId}`);
        log.push(`eNotify ${c.id} «${c.templateName}»\n    người nhận [form ${sh(f.formId + '_')}]: ${sh(f.fieldId)} (${f.hashid}) → ${sh(nid)} (${nf.hashid}) «${nf.label}»`);
        return { ...f, name: `Form: ${NAME[f.formId]}- Field: ${nf.label}`, type: nf.type, hashid: nf.hashid, fieldId: nf.id };
      }) };
      if (WRITE) { await api.saveNotifyConfig(fl, obj, 'PUT'); log.push('    ✓ đã ghi'); }
    }
  }

  // ---- 2. Kế thừa ----
  const hit = s => GONE.some(g => new RegExp(g.replace(/-/g, '\\-') + '(?![0-9])').test(s));
  for (const cfg of all.filter(c => (c.sources || []).some(x => hit(JSON.stringify(x))))) {
    if (!m.nodes.some(x => x.rid === cfg.userTaskId)) { log.push(`(bỏ qua config mồ côi ${cfg.id}: node ${cfg.userTaskId} không còn trong flow)`); continue; }
    const tForm = cfg.formId;
    if (![S, D, U].includes(tForm)) { log.push(`!! config ${cfg.id} thuộc form ngoài bộ (${tForm}) — bỏ qua, xem tay`); continue; }
    if (WRITE) fs.writeFileSync(`${OUT}/inherit_backup_${cfg.userTaskId}.json`, JSON.stringify(cfg, null, 1));
    const nodeName = (m.nodes.find(x => x.rid === cfg.userTaskId) || {}).name || cfg.userTaskId;
    log.push(`\nKế thừa [${nodeName}] (config ${cfg.id}, ${cfg.sources.length} dòng)`);
    const out = [];
    for (const row of cfg.sources) {
      if (!hit(JSON.stringify(row))) { out.push(row); continue; }
      const tOld = strip(row.fieldId); const srcs = row.listElementSource || [];
      const tNew = field(tForm, MAP[tOld] || tOld);
      if (!tNew) { log.push(`  − BỎ  đích ${sh(tOld)} (không còn trong form) ← ${srcs.map(x => x.label).join(', ')}`); continue; }
      if (srcs.length !== 1) throw new Error('dòng nhiều nguồn chưa hỗ trợ: ' + tOld);
      const sx = srcs[0]; const sOld = strip(sx.fieldId);
      if (sx.userTaskId && !formOfSid[sx.userTaskId]) {                  // node không có config kế thừa → tra form gắn vào node
        const ext = await api.externalForms(fl, M, sx.userTaskId); formOfSid[sx.userTaskId] = (ext.find(e => [S, D, U].includes(e.formId)) || ext[0] || {}).formId;
      }
      const srcForm = sx.userTaskId ? formOfSid[sx.userTaskId] : S;     // userTaskId null = form Start của luồng
      const sNew = srcForm && field(srcForm, MAP[sOld] || sOld);
      if (!sNew) { log.push(`  − BỎ  đích ${sh(tNew.id)} ← nguồn ${sh(sOld)} không tìm thấy`); continue; }
      const nr = buildSource(M, sx.userTaskId, sNew, tNew);
      if (!sx.userTaskId) nr.formula.expressionValue[0].item = `${M}.null.${sNew.hashid}`;   // khớp dạng server lưu cho nguồn Start
      out.push(nr);
      log.push(`  ~ SỬA đích ${sh(tOld)} → ${sh(tNew.id)} «${tNew.label}»  ←  ${sh(sOld)} → ${sh(sNew.id)} «${sNew.label}»`);
    }
    log.push(`  → còn ${out.length} dòng`);
    if (WRITE) { await api.saveInherit(fl, { id: cfg.id, sources: out, userTaskId: cfg.userTaskId, versionId: cfg.versionId, modelerId: cfg.modelerId, formId: cfg.formId }); log.push('  ✓ đã ghi'); }
  }
  console.log((WRITE ? '' : '[DRY-RUN] Không ghi gì.\n\n') + log.join('\n'));
})().catch(e => { console.error('✗', e.message); process.exit(1); });
