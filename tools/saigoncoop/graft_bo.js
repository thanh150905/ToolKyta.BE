// Ghép "khung ký" luồng 1 vào bộ hồ sơ luồng 2 có NỘI DUNG RIÊNG: giữ field nội dung L2 (hashid L2), bỏ phần ký cũ,
// ghép form con + field ẩn từ bộ L1 tương ứng (giữ hashid L1 → mẫu mail L1 dùng lại được), code L1 đổi id theo ánh xạ.
//   node graft_bo.js bo2/<bộ>.js [--write] [--only=S,D,U]
// LAYOUT[tag] phần tử: 'keyL2' | ['cols', a, b] (a/b là keyL2 hoặc ['L1', key]) | ['L1', keyL1, {readonly}] (ghép field L1)
//   | ['child', 'L1:<key child_form L1>', {readonly, hide:[keys]}] | ['own', 'S', {reuse:'child_form-1'}] (nhúng form S mới của bộ)
//   | ['splitter', 'splitter-1'|null, [items]] (null = tạo mới)
const R = require('path').resolve(__dirname, '../..');
const api = require(R + '/src/eform/api');
const fd = require(R + '/src/eform/formDef');
const { extractVariables } = require(R + '/tools/regen_variable_arr');
const fs = require('fs'), path = require('path');
const SP = __dirname;
const OUT = require('path').resolve(__dirname, '../../.kyta/archive/saigoncoop-out'); require('fs').mkdirSync(OUT, { recursive: true });
const WRITE = process.argv.includes('--write');
const ONLY = ((process.argv.find(a => a.startsWith('--only=')) || '').slice(7) || 'S,D,U').split(',');
const SPEC = require(path.resolve(process.argv[2]));
const TAG = path.basename(process.argv[2], '.js');
const { L1, L2 } = SPEC;
const EW = R + '/workspace/saigoncoop/sandbox/ewriter';
const DOCX = fs.readdirSync(EW).filter(d => fs.existsSync(`${EW}/${d}/document.xml`)).map(d => fs.readFileSync(`${EW}/${d}/document.xml`, 'utf8')).join('\n');

const clone = o => JSON.parse(JSON.stringify(o));
const H = () => Array.from({ length: 9 }, () => 'abcdefghijklmnopqrstuvwxyz0123456789'[Math.floor(Math.random() * 36)]).join('');
const keyOf = (n, fid) => n.id && n.id.startsWith(fid + '_') ? n.id.slice(fid.length + 1) : null;
const own = (def, fid) => { const a = []; const w = n => { if (keyOf(n, fid)) a.push(n); if (n.type !== 'child_form') (n.components || []).forEach(w); }; def.forEach(w); return a; };
const flat = def => { const a = []; const w = n => { a.push(n); (n.components || []).forEach(w); }; def.forEach(w); return a; };
const parseCond = c => { if (!c) return []; try { const v = JSON.parse(c); return Array.isArray(v) ? v : JSON.parse(v); } catch (_) { return []; } };
const sources = r => r.fieldId ? [r.fieldId] : (r.conditions || []).map(c => c.fieldId);
const LAYOUT_T = new Set(['columns', 'row', 'page', 'splitter', 'child_form']);
const setRO = nodes => flat(nodes).forEach(n => { if (!['columns', 'row', 'splitter', 'page', 'child_form'].includes(n.type)) n.readonly = true; });

// Bản Start lồng trong form Update KHÔNG mang Logo (form Update đã có Logo riêng) — như luồng 1.
const dropLogo = comps => comps.filter(c => !(c.type === 'child_form' && c.childFormConfig && c.childFormConfig.childFormId === '000071JlI0Df4KBJ05JPsQQ1Q'));
const IDMAP = {};   // id L1 (field ghép) → id L2 — dùng đổi code/điều kiện
const NEWDEF = {};

function build(tag, f1, f2) {
  const id1 = L1[tag], id2 = L2[tag];
  const d1 = fd.parseFormDef(f1).def, d2 = fd.parseFormDef(f2).def;
  const pool1 = new Map(own(d1, id1).map(n => [keyOf(n, id1), n]));
  const pool2 = new Map(own(d2, id2).map(n => [keyOf(n, id2), n]));
  const usedKeys = new Set(), used2 = new Set();
  const maxIdx = {}; for (const k of pool2.keys()) { const m = k.match(/^(.*)-(\d+)$/); if (m) maxIdx[m[1]] = Math.max(maxIdx[m[1]] || 0, +m[2]); }
  const fresh = type => { maxIdx[type] = (maxIdx[type] || 0) + 1; return `${type}-${maxIdx[type]}`; };
  const rep = { kept: [], graft: [], dropped: [] };
  const take2 = k => { const n = pool2.get(k); if (!n) throw new Error(`${tag}: L2 thiếu ${k}`); if (used2.has(k)) throw new Error(`${tag}: ${k} dùng 2 lần`);
    used2.add(k); usedKeys.add(k); const c = clone(n); if (!LAYOUT_T.has(c.type)) delete c.components; rep.kept.push(k); return c; };
  const graft = (k1, opt = {}) => { const n = pool1.get(k1); if (!n) throw new Error(`${tag}: L1 thiếu ${k1}`);
    const k2 = pool2.has(k1) || usedKeys.has(k1) ? fresh(n.type) : k1; usedKeys.add(k2);
    const c = clone(n); delete c.components; c.id = `${id2}_${k2}`; if (opt.readonly !== undefined) c.readonly = opt.readonly;
    IDMAP[`${id1}_${k1}`] = c.id; rep.graft.push(k1 === k2 ? k1 : `${k1}→${k2}`); return c; };
  const item = it => {
    if (typeof it === 'string') return take2(it);
    const [kind, a, b] = it;
    if (kind === 'L1') return graft(a, b);
    if (kind === 'cols') return { id: `${id2}_${fresh('columns')}`, type: 'columns', label: 'columns', hashid: H(), display: true, components: it.slice(1).map(item) };
    if (kind === 'child') {
      const k1 = a.replace(/^L1:/, ''); const n = clone(pool1.get(k1)); if (!n || n.type !== 'child_form') throw new Error(`${tag}: L1 không có child ${k1}`);
      const k2 = pool2.has(k1) && !(b && b.reuse) ? fresh('child_form') : (b && b.reuse) || k1;
      if (b && b.reuse) used2.add(b.reuse);
      usedKeys.add(k2); n.id = `${id2}_${k2}`;
      if (b && b.readonly) setRO(n.components || []);
      rep.graft.push(`CON(${n.childFormConfig.childFormId.slice(-6)})`); return n;
    }
    if (kind === 'own') {
      const t = a, nd = NEWDEF[t]; if (!nd) throw new Error(`${tag}: cần def mới ${t}`);
      const opt = b || {}; const reuse = opt.reuse && pool2.get(opt.reuse);
      if (reuse) used2.add(opt.reuse);
      const k2 = reuse ? opt.reuse : fresh('child_form'); usedKeys.add(k2);
      const comps = dropLogo(clone(fd.contentComponents(nd)));
      if (opt.hide) flat(comps).forEach(n => { if (opt.hide.includes(keyOf(n, L2[t]))) n.display = false; });
      return { id: `${id2}_${k2}`, type: 'child_form', label: '', hashid: reuse ? reuse.hashid : H(), display: true, tooltip: '', description: '',
        childFormConfig: { childFormId: L2[t], tempComponent_value: [], childFormCondition_value: JSON.stringify(parseCond(NEWDEF[t + '_cond'])) }, components: comps };
    }
    if (kind === 'splitter') {
      const sp = a ? take2(a) : { id: `${id2}_${fresh('splitter')}`, type: 'splitter', label: 'Splitter', hashid: H() };
      sp.components = b.map(item); sp.display = false; return sp;
    }
    throw new Error('layout lạ ' + kind);
  };
  const page = clone(d2[0]);
  page.components = SPEC.LAYOUT[tag].map(item);
  // nhãn / cột bảng
  for (const [k, v] of Object.entries((SPEC.LABELS || {})[tag] || {})) {
    const n = flat([page]).find(x => keyOf(x, id2) === k); if (!n) throw new Error(`${tag}: LABELS thiếu ${k}`);
    if (typeof v === 'string') { if (DOCX.includes('(' + n.hashid + ')')) { rep.kept.push(`(giữ nhãn docx ${k})`); continue; } n.label = v; if ('value' in n && /^(h\d|text)$/.test(n.type)) n.value = v; }
    else if (v.cols) { const cv = n.tableAdvanceConfig?.column_value; if (!cv) throw new Error(`${tag}: ${k} không phải bảng`); v.cols.forEach(([i, t]) => { cv[i].title = t; }); if (v.label) n.label = v.label; }
  }
  for (const [k, n] of pool2) if (!used2.has(k) && !LAYOUT_T.has(n.type)) rep.dropped.push(`${k}«${String(n.label ?? '').slice(0, 26)}»${DOCX.includes('(' + n.hashid + ')') ? '⚠DOCX' : ''}`);
  return { page, rep };
}

function substCode(str) {
  for (const [a, b] of Object.entries({ ...IDMAP, ...(SPEC.CODEMAP || {}) }).sort((x, y) => y[0].length - x[0].length)) str = str.split(a).join(b);
  for (const [a, b] of Object.entries(SPEC.SID || {})) str = str.split(a).join(b);
  for (const [a, b] of SPEC.TEXT || []) str = str.split(a).join(b);
  return str;
}

(async () => {
  const s = await api.open('saigoncoop', 'sandbox');
  for (const tag of ['S', 'D', 'U']) {
    if (!L1[tag] || !L2[tag] || !SPEC.LAYOUT[tag]) continue;
    const f1 = await api.getForm(s, L1[tag]), f2 = await api.getForm(s, L2[tag]);
    const { page, rep } = build(tag, f1, f2);
    const nd = [page];
    const ids = new Set(flat(nd).map(n => n.id));
    // điều kiện: L2 còn đủ field + L1 (đổi id) còn đủ field + luật của form con
    const c1 = parseCond(substCode(JSON.stringify(parseCond(f1.jsonFormCondition))));
    const all = [...parseCond(f2.jsonFormCondition), ...c1];
    for (const cf of flat(nd).filter(n => n.type === 'child_form')) all.push(...parseCond(cf.childFormConfig.childFormCondition_value));
    const conds = [], seen = new Set(), cdrop = [];
    for (const r of all) {
      if (seen.has(r.conditionId)) continue; seen.add(r.conditionId);
      const miss = sources(r).filter(f => !ids.has(f));
      if (!sources(r).length || miss.length) { cdrop.push(r.conditionId); continue; }
      const action = (r.action || []).map(a => ({ ...a, fieldIds: (a.fieldIds || []).filter(f => ids.has(f)) })).filter(a => a.fieldIds.length);
      if (!action.length) { cdrop.push(r.conditionId + '(hết đích)'); continue; }
      conds.push({ ...r, action });
    }
    NEWDEF[tag] = nd; NEWDEF[tag + '_cond'] = JSON.stringify(conds);
    // code L1 đổi id
    const code1 = await api.getCode(s, L1[tag]);
    const code = {}; if (!SPEC.NO_CODE) for (const [k, v] of Object.entries(code1)) code[k] = { code: substCode(v.code), order: v.order };
    for (const [k, v] of Object.entries((SPEC.EXTRA_CODE || {})[tag] || {})) code[k] = { code: v, order: Math.max(0, ...Object.values(code).map(x => x.order)) + 1 };
    const blob = Object.values(code).map(v => v.code).join('\n');
    const leftL1 = [...new Set((blob.match(/\{\{0000[0-9A-Za-z]+_[A-Za-z_]+-\d+\}\}/g) || []).filter(t => Object.values(L1).some(x => t.includes(x))))];
    const missL2 = [...new Set((blob.match(/\{\{0000[0-9A-Za-z]+_[A-Za-z_]+-\d+\}\}/g) || []).filter(t => Object.values(L2).some(x => t.includes(x))).map(t => t.slice(2, -2)).filter(t => !ids.has(t) && !(SPEC.OTHER_IDS || []).includes(t)))];
    const sids = [...new Set(blob.match(/sid-[0-9A-F]{8}-[0-9A-F-]{27}/g) || [])].filter(x => !Object.values(SPEC.SID || {}).includes(x));
    console.log(`\n== ${tag} ${f2.formName}  (khung từ ${f1.formName})`);
    console.log(`  giữ L2 ${rep.kept.length}: ${rep.kept.join(' ')}`);
    console.log(`  ghép L1 ${rep.graft.length}: ${rep.graft.join(' ')}`);
    console.log(`  bỏ L2 ${rep.dropped.length}: ${rep.dropped.join(' ')}`);
    console.log(`  điều kiện giữ ${conds.length}, bỏ ${cdrop.length}`);
    console.log(`  code ${Object.keys(code).join(',')} · còn id L1: ${leftL1.join(' ') || '-'} · id L2 không có trên form: ${missL2.join(' ') || '-'} · SID lạ: ${sids.join(' ') || '-'}`);
    fs.writeFileSync(`${OUT}/graft_${TAG}_${tag}.json`, JSON.stringify({ nd, conds, code }, null, 1));
    if (!WRITE || !ONLY.includes(tag)) continue;
    if (leftL1.length || missL2.length || sids.length) { console.log('  ✗ KHÔNG GHI: còn tham chiếu sai trong code'); continue; }
    fs.writeFileSync(`${OUT}/backup_graft_${TAG}_${tag}_${L2[tag]}.json`, JSON.stringify({ form: f2, code: await api.getCode(s, L2[tag]) }, null, 1));
    const payload = fd.buildOwnerFormPayload(f2, nd, fd.parseFormDef(f2).wasString);
    payload.variableArr = extractVariables(nd);
    payload.jsonFormCondition = JSON.stringify(conds);
    await api.putForm(s, payload);
    await api.putCode(s, L2[tag], code);
    console.log(`  ✓ đã PUT form (${payload.variableArr.length} biến) + code`);
  }
  fs.writeFileSync(`${OUT}/graft_${TAG}_idmap.json`, JSON.stringify(IDMAP, null, 1));
})().catch(e => { console.error('✗', e.stack); process.exit(1); });
