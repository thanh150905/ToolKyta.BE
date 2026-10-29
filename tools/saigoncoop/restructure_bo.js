// Tái cấu trúc 1 bộ hồ sơ (Start/Duyệt/Update) theo mẫu BBTL: form con, 2 field/hàng,
// 1 splitter ẩn phẳng cuối form, label [HT]/[MAIL]/[KÝ], dọn điều kiện mồ côi, chép luật form con lên cha.
//   node restructure_bo.js bo/<tên>.js [--dry-run]
// Spec: { IDS:{S,D,U}, LAYOUT:{S,D,U}, LABELS:{S,D,U} } — LAYOUT là hàm (SUB, IDS) → mảng layout.
// Phần tử layout: 'key' | ['cols',k1,k2] | ['child',subId,{readonly,reuse}] | ['splitter',key,[keys]] | ['head',_,type,value] (tiêu đề mới)
// KHÔNG đổi label field đang là placeholder docx eWriter (khớp cả label lẫn hashid) — tự bỏ qua + báo.
const R = require('path').resolve(__dirname, '../..');
const api = require(R + '/src/eform/api');
const fd = require(R + '/src/eform/formDef');
const { extractVariables } = require(R + '/tools/regen_variable_arr');
const fs = require('fs');
const path = require('path');
const SP = __dirname;
const OUT = require('path').resolve(__dirname, '../../.kyta/archive/saigoncoop-out'); require('fs').mkdirSync(OUT, { recursive: true });
const DRY = process.argv.includes('--dry-run');
const SPEC = require(path.resolve(process.argv[2]));
const SUB = require(SP + '/subforms.json');
const { IDS } = SPEC;
const TAG = path.basename(process.argv[2], '.js');
const EW = R + '/workspace/saigoncoop/sandbox/ewriter';
const DOCX = fs.readdirSync(EW).map(d => fs.readFileSync(`${EW}/${d}/document.xml`, 'utf8'));

const clone = o => JSON.parse(JSON.stringify(o));
const H = () => Array.from({ length: 9 }, () => 'abcdefghijklmnopqrstuvwxyz0123456789'[Math.floor(Math.random() * 36)]).join('');
const flat = def => { const a = []; const w = n => { a.push(n); (n.components || []).forEach(w); }; def.forEach(w); return a; };
const parseCond = c => { if (!c) return []; try { const v = JSON.parse(c); return Array.isArray(v) ? v : JSON.parse(v); } catch (_) { return []; } };
const setReadonly = nodes => flat(nodes).forEach(n => { if (!['columns', 'row', 'splitter', 'page', 'child_form'].includes(n.type)) n.readonly = true; });

function rebuild(formId, def, layout, children) {
  const page = def[0];
  const own = []; (function w(n) { own.push(n); if (n.type !== 'child_form') (n.components || []).forEach(w); })({ components: def });
  const pool = new Map(own.filter(n => n.id && n.id.startsWith(formId + '_')).map(n => [n.id.slice(formId.length + 1), n]));
  const used = new Set();
  const take = k => { const n = pool.get(k); if (!n || !n.id) throw new Error(`${formId}: thiếu ${k}`); if (used.has(k)) throw new Error(`${formId}: ${k} dùng 2 lần`); used.add(k);
    const c = clone(n); if (!['splitter', 'child_form', 'columns', 'row'].includes(c.type)) delete c.components; return c; };
  const nextIdx = type => { const re = new RegExp('^' + type + '-(\\d+)$'); const v = Math.max(0, ...[...pool.keys()].map(k => +(k.match(re) || [0, 0])[1])) + 1; pool.set(`${type}-${v}`, {}); return v; };
  const out = layout.map(item => {
    if (typeof item === 'string') return take(item);
    const [kind, ...rest] = item;
    if (kind === 'cols') return { id: `${formId}_columns-${nextIdx('columns')}`, type: 'columns', label: 'columns', hashid: H(), display: true, components: rest.map(take) };
    if (kind === 'head') { const [, type, value] = rest; return { id: `${formId}_${type}-${nextIdx(type)}`, type, value, hashid: H(), display: true, tooltip: '', spellCheck: false, textPosition: 'left' }; }
    if (kind === 'splitter') { const sp = take(rest[0]); sp.components = rest[1].map(take); sp.display = false; return sp; }
    if (kind === 'child') {
      const [subId, opt = {}] = rest; const sub = children[subId];
      const comps = clone(sub.content);
      if (opt.readonly) setReadonly(comps);
      if (opt.hide) flat(comps).forEach(n => { if (opt.hide.includes(n.id.slice(subId.length + 1))) n.display = false; });   // vd ẩn tiêu đề Start khi nhúng vào Update
      const existing = opt.reuse ? pool.get(opt.reuse) : null;
      if (existing) used.add(opt.reuse);
      return { id: existing ? existing.id : `${formId}_child_form-${nextIdx('child_form')}`, type: 'child_form', label: existing ? existing.label : '',
        hashid: existing ? existing.hashid : H(), display: true, tooltip: '', description: '',
        childFormConfig: { childFormId: subId, tempComponent_value: [], childFormCondition_value: JSON.stringify(sub.cond) }, components: comps };
    }
    throw new Error('layout lạ ' + kind);
  });
  page.components = out;
  return [page];
}

function relabel(def, formId, map) {
  const done = [];
  for (const n of flat(def)) {
    const k = n.id && n.id.startsWith(formId + '_') ? n.id.slice(formId.length + 1) : null;
    if (!k || !map[k] || n.label === map[k]) continue;
    if (n.hashid && DOCX.some(x => x.includes('(' + n.hashid + ')'))) { done.push(`${k} «${n.label}» GIỮ (placeholder docx)`); continue; }
    done.push(`${k} «${n.label}» → «${map[k]}»`); n.label = map[k];
  }
  return done;
}

// Đổi id field đã chuyển sang form con (theo MV của spec) trong luật điều kiện — nguồn lẫn đích.
const MAP = SPEC.MV ? require('./bo/_common').buildMap(IDS, SPEC.MV) : {};
const remapCond = cond => cond.map(r => JSON.parse(JSON.stringify(r), (k, v) => typeof v === 'string' && MAP[v] && MAP[v] !== 'DROP' ? MAP[v] : v));
// Nguồn của luật: dạng cũ r.fieldId, dạng mới r.conditions[].fieldId (matchType all/any).
const sources = r => r.fieldId ? [r.fieldId] : (r.conditions || []).map(c => c.fieldId);
function cleanCond(cond, def) {
  const ids = new Set(flat(def).map(n => n.id));
  const kept = [], dropped = [];
  for (const r of cond) {
    const miss = sources(r).filter(f => !ids.has(f));
    if (!sources(r).length || miss.length) { dropped.push(`${r.conditionId}(nguồn ${miss.map(f => f.split('_').slice(1).join('_')).join(',') || '?'} không còn)`); continue; }
    const action = (r.action || []).map(a => ({ ...a, fieldIds: (a.fieldIds || []).filter(f => ids.has(f)) })).filter(a => a.fieldIds.length);
    if (!action.length) { dropped.push(`${r.conditionId}(hết đích)`); continue; }
    kept.push({ ...r, action });
  }
  return { kept, dropped };
}

(async () => {
  const s = await api.open('saigoncoop', 'sandbox');
  const children = {};
  const loadChild = async id => { const f = await api.getForm(s, id); const { def } = fd.parseFormDef(f); children[id] = { content: fd.contentComponents(def), cond: parseCond(f.jsonFormCondition) }; };
  for (const id of Object.values(SUB)) await loadChild(id);

  for (const tag of ['S', 'D', 'U']) {
    const id = IDS[tag]; if (!id || (IDS._onlyU && tag !== 'U')) continue;
    if (tag === 'U') await loadChild(IDS.S);            // U nhúng bản S MỚI (dry-run: bản S hiện tại)
    const form = await api.getForm(s, id);
    const { def, wasString } = fd.parseFormDef(form);
    if (!DRY) fs.writeFileSync(`${OUT}/backup_${TAG}_${tag}_${id}.json`, JSON.stringify({ form }, null, 1));
    const before = flat(def).filter(n => n.id && n.id.startsWith(id + '_') && !['columns', 'page', 'row'].includes(n.type)).map(n => n.id);
    const nd = rebuild(id, def, SPEC.LAYOUT[tag](SUB, IDS), children);
    const rl = relabel(nd, id, (SPEC.LABELS || {})[tag] || {});
    const { kept, dropped } = cleanCond(remapCond(parseCond(form.jsonFormCondition)), nd);
    for (const cf of flat(nd).filter(n => n.type === 'child_form'))
      for (const r of parseCond(cf.childFormConfig.childFormCondition_value))
        if (!kept.some(k => k.conditionId === r.conditionId)) kept.push(r);
    const after = new Set(flat(nd).map(n => n.id));
    const gone = before.filter(x => !after.has(x));
    console.log(`\n${tag} ${form.formName}`);
    console.log(`  field bị gỡ: ${gone.map(x => x.slice(id.length + 1)).join(', ') || '(không)'}`);
    rl.forEach(x => console.log('  label: ' + x));
    console.log(`  điều kiện: giữ ${kept.length}, bỏ ${dropped.length} ${dropped.join(' ')}`);
    kept.forEach(r => console.log('    giữ', r.conditionId, sources(r).map(f => f.split('_').slice(1).join('_')).join('&'), r.operator || '', JSON.stringify(r.value !== undefined ? r.value : (r.conditions || []).map(c => c.value)), '→', r.action.map(a => a.type + ':' + a.fieldIds.map(f => f.split('_').slice(1).join('_')).join('|')).join(' ')));
    console.log('  bố cục: ' + nd[0].components.map(n => n.type === 'columns' ? '[' + n.components.map(c => c.id.split('_').slice(1).join('_')).join('+') + ']'
      : n.type === 'child_form' ? 'CON(' + (Object.entries(SUB).find(([, v]) => v === n.childFormConfig.childFormId) || [n.childFormConfig.childFormId.slice(-6)])[0] + ')'
      : n.type === 'splitter' ? 'SPLITTER{' + n.components.map(c => c.id.split('_').slice(1).join('_')).join(',') + '}'
      : n.id.split('_').slice(1).join('_') + (n.value && /^h\d$/.test(n.type) ? `"${String(n.value).slice(0, 25)}"` : '')).join(' · '));
    if (DRY) { fs.writeFileSync(`${OUT}/new_${TAG}_${tag}.json`, JSON.stringify(nd, null, 1)); continue; }
    const payload = fd.buildOwnerFormPayload(form, nd, wasString);
    payload.variableArr = extractVariables(nd);
    payload.jsonFormCondition = JSON.stringify(kept);
    await api.putForm(s, payload);
    console.log(`  ✓ đã PUT (${payload.variableArr.length} biến)`);
  }
})().catch(e => { console.error('✗', e.stack); process.exit(1); });
