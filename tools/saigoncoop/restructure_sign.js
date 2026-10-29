// Thí điểm Biên bản thanh lý: dựng lại bố cục Start/Duyệt/Update theo chuẩn
//   2 field/hàng · 1 splitter ẩn phẳng cuối form · form con A/B/F · label [HT]/[MAIL]/[KÝ] · dọn điều kiện mồ côi.
// Field cũ giữ nguyên id/hashid (chỉ đổi vị trí/label). node restructure_bbtl.js [--dry-run]
const R = require('path').resolve(__dirname, '../..');
const api = require(R + '/src/eform/api');
const fd = require(R + '/src/eform/formDef');
const { extractVariables } = require(R + '/tools/regen_variable_arr');
const fs = require('fs');
const SP = __dirname;
const OUT = require('path').resolve(__dirname, '../../.kyta/archive/saigoncoop-out'); require('fs').mkdirSync(OUT, { recursive: true });
const DRY = process.argv.includes('--dry-run');
const SUB = require(SP + '/subforms.json');           // { A, B, F }
const IDS = { S: '000071gbI5UgmnL2vkBIooxo', D: '000071bBIoqcQ5adneWlt88a8', U: '000071dMId0tzdLX6wDxunnan' };

const clone = o => JSON.parse(JSON.stringify(o));
const H = () => Array.from({ length: 9 }, () => 'abcdefghijklmnopqrstuvwxyz0123456789'[Math.floor(Math.random() * 36)]).join('');
const flat = def => { const a = []; const w = n => { a.push(n); (n.components || []).forEach(w); }; def.forEach(w); return a; };
const parseCond = c => { if (!c) return []; try { const v = JSON.parse(c); return Array.isArray(v) ? v : JSON.parse(v); } catch (_) { return []; } };
const setReadonly = nodes => flat(nodes).forEach(n => { if (!['columns', 'row', 'splitter', 'page', 'child_form'].includes(n.type)) n.readonly = true; });

/**
 * Dựng page mới từ layout. Phần tử layout:
 *   'key'                     → node cũ (lấy ra khỏi cây, giữ nguyên)
 *   ['cols', k1, k2]          → columns mới 2 field
 *   ['child', formId, opts]   → child_form trỏ form con (components = bản sao nội dung form con)
 *   ['splitter', key, [keys]] → splitter ẩn cũ, ruột phẳng
 */
function rebuild(formId, def, layout, children) {
  const page = def[0];
  // Chỉ field CỦA form này (không đi vào child_form — key con có thể trùng key cha).
  const own = []; (function w(n) { own.push(n); if (n.type !== 'child_form') (n.components || []).forEach(w); })({ components: def });
  const pool = new Map(own.filter(n => n.id && n.id.startsWith(formId + '_')).map(n => [n.id.slice(formId.length + 1), n]));
  const take = k => { const n = pool.get(k); if (!n) throw new Error(`${formId}: thiếu ${k}`); const c = clone(n); if (c.type !== 'splitter' && c.type !== 'child_form' && c.type !== 'columns') delete c.components; return c; };
  let colIdx = Math.max(0, ...[...pool.keys()].map(k => +(k.match(/^columns-(\d+)$/) || [0, 0])[1])) + 1;
  let cfIdx = Math.max(0, ...[...pool.keys()].map(k => +(k.match(/^child_form-(\d+)$/) || [0, 0])[1])) + 1;
  const out = layout.map(item => {
    if (typeof item === 'string') return take(item);
    const [kind, ...rest] = item;
    if (kind === 'cols') return { id: `${formId}_columns-${colIdx++}`, type: 'columns', label: 'columns', hashid: H(), display: true, components: rest.map(take) };
    if (kind === 'splitter') { const sp = take(rest[0]); sp.components = rest[1].map(take); sp.display = false; return sp; }
    if (kind === 'child') {
      const [subId, opt = {}] = rest; const sub = children[subId];
      const comps = clone(sub.content);
      if (opt.readonly) setReadonly(comps);
      const existing = opt.reuse ? pool.get(opt.reuse) : null;
      return { id: existing ? existing.id : `${formId}_child_form-${cfIdx++}`, type: 'child_form', label: existing ? existing.label : '',
        hashid: existing ? existing.hashid : H(), display: true, tooltip: '', description: '',
        childFormConfig: { childFormId: subId, tempComponent_value: [], childFormCondition_value: JSON.stringify(sub.cond) }, components: comps };
    }
    throw new Error('layout lạ ' + kind);
  });
  page.components = out;
  return [page];
}

function relabel(def, formId, map) {
  for (const n of flat(def)) { const k = n.id && n.id.startsWith(formId + '_') ? n.id.slice(formId.length + 1) : null; if (k && map[k]) n.label = map[k]; }
}

// Giữ luật điều kiện còn nguồn + còn đích (kể cả field trong form con); bỏ luật mồ côi.
function cleanCond(cond, def) {
  const ids = new Set(flat(def).map(n => n.id));
  const kept = [], dropped = [];
  for (const r of cond) {
    if (!ids.has(r.fieldId)) { dropped.push(r.conditionId); continue; }
    const action = (r.action || []).map(a => ({ ...a, fieldIds: (a.fieldIds || []).filter(f => ids.has(f)) })).filter(a => a.fieldIds.length);
    if (!action.length) { dropped.push(r.conditionId); continue; }
    kept.push({ ...r, action });
  }
  return { kept, dropped };
}

// Pha 2: thay bảng ký + field ẩn đi kèm bằng form con GS (Start) / GD (Duyệt). Layout suy từ cây hiện tại.
const topKeys = def => def[0].components.map(n => n.id.slice(n.id.indexOf('_') + 1));
const LAYOUT = {
  S: def => topKeys(def).filter(k => !['table_advance-2', 'splitter-1'].includes(k))
    .flatMap(k => k === 'child_form-1' ? [k, ['child', SUB.GS]] : [k]),
  D: def => topKeys(def).flatMap(k => k === 'table_advance-2' ? [['child', SUB.GD]]
    : k === 'splitter-1' ? [['splitter', 'splitter-1', ['textField_ticketName-1', 'rich_text_advance-1', 'rich_text_advance-2']]] : [k]),
  U: () => ['child_form-2', ['child', IDS.S, { reuse: 'child_form-1' }]],
};
const LABELS = { S: {}, D: {}, U: {} };

(async () => {
  const s = await api.open('saigoncoop', 'sandbox');
  const children = {};
  const loadChild = async id => { const f = await api.getForm(s, id); const { def } = fd.parseFormDef(f); children[id] = { content: fd.contentComponents(def), cond: parseCond(f.jsonFormCondition) }; };
  for (const id of Object.values(SUB)) await loadChild(id);

  for (const tag of ['S', 'D', 'U']) {
    const id = IDS[tag];
    if (tag === 'U') await loadChild(IDS.S);            // U nhúng bản S MỚI (đã có form con F)
    const form = await api.getForm(s, id);
    const { def, wasString } = fd.parseFormDef(form);
    fs.writeFileSync(`${OUT}/backup2_${tag}_${id}.json`, JSON.stringify({ form }, null, 1));   // bản lưu để hoàn tác
    const before = flat(def).filter(n => n.id && n.id.startsWith(id + '_') && !['columns', 'page'].includes(n.type)).map(n => n.id);
    const nd = rebuild(id, def, LAYOUT[tag](def), children);
    relabel(nd, id, LABELS[tag]);
    const { kept, dropped } = cleanCond(parseCond(form.jsonFormCondition), nd);
    // Chép luật của form con lên form cha (field id con đã có trong cây cha) — đề phòng runtime chỉ đọc điều kiện cấp form cha.
    for (const cf of flat(nd).filter(n => n.type === 'child_form'))
      for (const r of parseCond(cf.childFormConfig.childFormCondition_value))
        if (!kept.some(k => k.conditionId === r.conditionId)) kept.push(r);
    const after = new Set(flat(nd).map(n => n.id));
    const gone = before.filter(x => !after.has(x));
    console.log(`\n${tag} ${form.formName}: điều kiện giữ ${kept.length}, bỏ ${dropped.length}; field bị gỡ: ${gone.map(x => x.split('_').slice(1).join('_')).join(', ') || '(không)'}`);
    kept.forEach(r => console.log('  giữ luật', r.conditionId, r.fieldId.split('_').pop(), r.operator, JSON.stringify(r.value), '→', r.action.map(a => a.type + ':' + a.fieldIds.map(f => f.split('_').pop()).join('|')).join(' ')));
    if (DRY) { fs.writeFileSync(`${OUT}/new_${tag}.json`, JSON.stringify(nd, null, 1)); continue; }
    const payload = fd.buildOwnerFormPayload(form, nd, wasString);
    payload.variableArr = extractVariables(nd);
    payload.jsonFormCondition = JSON.stringify(kept);
    await api.putForm(s, payload);
    console.log(`  ✓ đã PUT (${payload.variableArr.length} biến)`);
  }
})().catch(e => { console.error('✗', e.stack); process.exit(1); });
