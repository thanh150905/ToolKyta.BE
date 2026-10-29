// Bộ ký eContract luồng 2 theo khung luồng 1 (mẫu HĐMB Trên 500tr):
//   Start : Logo · nội dung L2 (2 field/hàng, bỏ phần ký cũ) · TÀI LIỆU ĐÍNH KÈM (Tài liệu ký kết + ghi chú định dạng + form con F) · preview eWriter cũ · splitter ẩn
//   Update: Logo · tiêu đề · form con TC (từ chối eContract) · Start lồng (ẩn tiêu đề)
//   Code  : main.js L1 (điền giờ upload bảng F) + code nghiệp vụ L2 (EXTRA) — S và U dùng chung.
//   node graft_ec.js bo2/ec_<bộ>.js [--write]
const R = require('path').resolve(__dirname, '../..');
const api = require(R + '/src/eform/api'), fd = require(R + '/src/eform/formDef');
const { extractVariables } = require(R + '/tools/regen_variable_arr');
const fs = require('fs'), path = require('path');
const SP = __dirname, WRITE = process.argv.includes('--write');
const OUT = require('path').resolve(__dirname, '../../.kyta/archive/saigoncoop-out'); require('fs').mkdirSync(OUT, { recursive: true });
const SPEC = require(path.resolve(process.argv[2])), TAG = path.basename(process.argv[2], '.js');
const K1 = { S: '000071ENIpKTrXAawmKRtJJ4J', U: '00007115IDdws65qb8By2t55o5' };   // khung: Trên 500tr_Hợp đồng mua bán
const F_SUB = '000071dMIKAuzRaONEP3unnan', TC = '00007123ImKho9AXnXAGtppJp', LOGO = '000071JlI0Df4KBJ05JPsQQ1Q';
const EW = R + '/workspace/saigoncoop/sandbox/ewriter';
const DOCX = fs.readdirSync(EW).filter(d => fs.existsSync(`${EW}/${d}/document.xml`)).map(d => fs.readFileSync(`${EW}/${d}/document.xml`, 'utf8')).join('\n');

const clone = o => JSON.parse(JSON.stringify(o));
const H = () => Array.from({ length: 9 }, () => 'abcdefghijklmnopqrstuvwxyz0123456789'[Math.floor(Math.random() * 36)]).join('');
const keyOf = (n, fid) => n.id && n.id.startsWith(fid + '_') ? n.id.slice(fid.length + 1) : null;
const flat = def => { const a = []; const w = n => { a.push(n); if (n.type !== 'child_form') (n.components || []).forEach(w); }; def.forEach(w); return a; };
const parseCond = c => { if (!c) return []; try { const v = JSON.parse(c); return Array.isArray(v) ? v : JSON.parse(v); } catch (_) { return []; } };
const sources = r => r.fieldId ? [r.fieldId] : (r.conditions || []).map(c => c.fieldId);
const label = n => String(n.label ?? n.value ?? '').replace(/\s+/g, ' ').trim();
// phần ký kiểu cũ + field phụ trợ của nó
const SIGN = n => n.type === 'signature' || n.type === 'row'
  || /người ký|chọn số lượng|thời hạn thực hiện ký|^ký (nháy|trình|duyệt)$|^chữ ký|email người đang đăng nhập|xác nhận phê duyệt|yêu cầu chỉnh sửa|chặn submit|không phải là người thực hiện|chưa đủ người ký|vui lòng ấn xác nhận/i.test(label(n));
const FULL = new Set(['h1', 'h2', 'h3', 'text', 'table_advance', 'table', 'textArea', 'rich_text', 'rich_text_advance', 'view_ewriter', 'upload_file', 'child_form', 'splitter']);

// Bản Start lồng trong form Update KHÔNG mang Logo (form Update đã có Logo riêng) — như luồng 1.
const dropLogo = comps => comps.filter(c => !(c.type === 'child_form' && c.childFormConfig && c.childFormConfig.childFormId === '000071JlI0Df4KBJ05JPsQQ1Q'));
function layoutS(f2, k1def) {
  const id2 = SPEC.S;
  const d2 = fd.parseFormDef(f2).def;
  const k1 = new Map(flat(k1def).filter(n => n.id).map(n => [keyOf(n, K1.S) || n.id, n]));
  const rep = { dropped: [], hidden: [] };
  const used = new Set(flat(d2).map(n => keyOf(n, id2)).filter(Boolean));
  const fresh = t => { let i = 1; while (used.has(`${t}-${i}`)) i++; used.add(`${t}-${i}`); return `${t}-${i}`; };
  // dàn phẳng nội dung theo thứ tự, gỡ columns, tách field ẩn trong splitter
  const items = [], hidden = [];
  const walk = (n, inSplit) => {
    if (n.type === 'columns' || n.type === 'page') return (n.components || []).forEach(c => walk(c, inSplit));
    if (n.type === 'splitter') return (n.components || []).forEach(c => walk(c, true));
    const k = keyOf(n, id2);
    if (SIGN(n) || (SPEC.DROP || []).includes(k)) { if (n.type !== 'row' || true) rep.dropped.push(`${k}«${label(n).slice(0, 24)}»${DOCX.includes('(' + n.hashid + ')') ? '⚠DOCX' : ''}`); return; }
    const c = clone(n); if (!['row'].includes(c.type)) delete c.components;
    (inSplit ? hidden : items).push(c);
  };
  d2[0].components.forEach(n => walk(n, false));
  // khối tài liệu đính kèm: bỏ bảng cũ + tiêu đề + ghi chú, dựng lại theo khung
  const isAtt = n => [SPEC.ATT, SPEC.ATT_HEAD, SPEC.ATT_NOTE].includes(keyOf(n, id2));
  const pos = items.findIndex(isAtt);
  const att = items.filter(isAtt); att.forEach(n => rep.dropped.push(`${keyOf(n, id2)}«${label(n).slice(0, 24)}» (thay bằng khối khung)${DOCX.includes('(' + n.hashid + ')') ? '⚠DOCX' : ''}`));
  const body = items.filter(n => !isAtt(n));
  const head = items.find(n => keyOf(n, id2) === SPEC.ATT_HEAD);
  const ew = body.filter(n => n.type === 'view_ewriter'); const content = body.filter(n => n.type !== 'view_ewriter');
  const mk = (k1key, t) => { const n = clone(k1.get(k1key)); delete n.components; const k = fresh(t || n.type); n.id = `${id2}_${k}`; return n; };
  const block = [];
  if (head) { head.label = 'TÀI LIỆU ĐÍNH KÈM'; if ('value' in head) head.value = 'TÀI LIỆU ĐÍNH KÈM'; block.push(head); }
  else block.push({ id: `${id2}_${fresh('h2')}`, type: 'h2', label: 'TÀI LIỆU ĐÍNH KÈM', value: 'TÀI LIỆU ĐÍNH KÈM', hashid: H(), display: true, tooltip: '', spellCheck: false, textPosition: 'left' });
  const up = mk('upload_file-1'); block.push(up);
  const note = mk('text-1'); block.push(note);
  const fNode = clone(flat(k1def).find(n => n.type === 'child_form' && n.childFormConfig.childFormId === F_SUB)); fNode.id = `${id2}_${fresh('child_form')}`; fNode.hashid = H(); block.push(fNode);
  const logo = clone(flat(k1def).find(n => n.type === 'child_form' && n.childFormConfig.childFormId === LOGO)); logo.id = `${id2}_${fresh('child_form')}`; logo.hashid = H();
  // 2 field/hàng
  const out = [logo]; let pend = null;
  const flush = () => { if (pend) { out.push(pend); pend = null; } };
  for (const n of [...content.slice(0, pos < 0 ? content.length : pos), ...block, ...content.slice(pos < 0 ? content.length : pos), ...ew]) {
    if (FULL.has(n.type)) { flush(); out.push(n); continue; }
    if (!pend) { pend = n; continue; }
    out.push({ id: `${id2}_${fresh('columns')}`, type: 'columns', label: 'columns', hashid: H(), display: true, components: [pend, n] }); pend = null;
  }
  flush();
  if (hidden.length) { out.push({ id: `${id2}_${fresh('splitter')}`, type: 'splitter', label: 'Splitter', hashid: H(), display: false, components: hidden }); rep.hidden = hidden.map(n => keyOf(n, id2)); }
  const page = clone(d2[0]); page.components = out;
  rep.layout = out.map(n => n.type === 'columns' ? '[' + n.components.map(c => keyOf(c, id2)).join('+') + ']' : n.type === 'child_form' ? `CON(${n.childFormConfig.childFormId.slice(-6)})` : keyOf(n, id2)).join(' ');
  return { def: [page], rep };
}

function layoutU(f2u, k1udef, newS, newScond, titleS) {
  const id2 = SPEC.U;
  const used = new Set(flat(fd.parseFormDef(f2u).def).map(n => keyOf(n, id2)).filter(Boolean));
  const fresh = t => { let i = 1; while (used.has(`${t}-${i}`)) i++; used.add(`${t}-${i}`); return `${t}-${i}`; };
  const pick = cid => { const n = clone(flat(k1udef).find(x => x.type === 'child_form' && x.childFormConfig.childFormId === cid)); n.id = `${id2}_${fresh('child_form')}`; n.hashid = H(); return n; };
  const h1 = clone(flat(k1udef).find(n => n.type === 'h1')); h1.id = `${id2}_${fresh('h1')}`; h1.hashid = H(); h1.label = titleS; if ('value' in h1) h1.value = titleS;
  const old = flat(fd.parseFormDef(f2u).def).find(n => n.type === 'child_form' && n.childFormConfig?.childFormId === SPEC.S);
  const comps = dropLogo(clone(fd.contentComponents(newS)));
  flat(comps).forEach(n => { if (n.type === 'h1' && keyOf(n, SPEC.S)) n.display = false; });
  const own = { id: old ? old.id : `${id2}_${fresh('child_form')}`, type: 'child_form', label: '', hashid: old ? old.hashid : H(), display: true, tooltip: '', description: '',
    childFormConfig: { childFormId: SPEC.S, tempComponent_value: [], childFormCondition_value: newScond }, components: comps };
  const page = clone(fd.parseFormDef(f2u).def[0]); page.components = [pick(LOGO), h1, pick(TC), own];
  return [page];
}

function conds(def, list) {
  const ids = new Set(flat(def).map(n => n.id)); for (const cf of flat(def).filter(n => n.type === 'child_form')) flat(cf.components || []).forEach(n => ids.add(n.id));
  const all = [...list]; for (const cf of flat(def).filter(n => n.type === 'child_form')) all.push(...parseCond(cf.childFormConfig.childFormCondition_value));
  const out = [], seen = new Set(); let drop = 0;
  for (const r of all) {
    if (seen.has(r.conditionId)) continue; seen.add(r.conditionId);
    if (!sources(r).length || sources(r).some(f => !ids.has(f))) { drop++; continue; }
    const action = (r.action || []).map(a => ({ ...a, fieldIds: (a.fieldIds || []).filter(f => ids.has(f)) })).filter(a => a.fieldIds.length);
    if (!action.length) { drop++; continue; }
    out.push({ ...r, action });
  }
  return { out, drop };
}

(async () => {
  const s = await api.open('saigoncoop', 'sandbox');
  const k1S = fd.parseFormDef(await api.getForm(s, K1.S)).def, k1U = fd.parseFormDef(await api.getForm(s, K1.U)).def;
  const fS = await api.getForm(s, SPEC.S), fU = await api.getForm(s, SPEC.U);
  const { def: nS, rep } = layoutS(fS, k1S);
  const cS = conds(nS, parseCond(fS.jsonFormCondition));
  const title = label(flat(nS).find(n => n.type === 'h1' && keyOf(n, SPEC.S)) || { label: '' });
  const nU = layoutU(fU, k1U, nS, JSON.stringify(cS.out), title);
  const cU = conds(nU, []);
  const main = (await api.getCode(s, K1.S)).main;
  const code = { main: { code: main.code, order: 0 } };
  for (const [k, v] of Object.entries(SPEC.EXTRA_CODE || {})) code[k] = { code: v, order: Object.keys(code).length };
  const blob = Object.values(code).map(v => v.code).join('\n');
  const ids = new Set(flat(nS).map(n => n.id)); flat(nS).filter(n => n.type === 'child_form').forEach(cf => flat(cf.components || []).forEach(n => ids.add(n.id)));
  const missing = [...new Set((blob.match(/\{\{(0000[0-9A-Za-z]+_[A-Za-z_]+-\d+)\}\}/g) || []).map(t => t.slice(2, -2)).filter(t => !ids.has(t)))];
  console.log(`== ${fS.formName}\n  bố cục: ${rep.layout}\n  ẩn: ${rep.hidden.join(' ') || '-'}\n  bỏ ${rep.dropped.length}: ${rep.dropped.filter(x => !/Email người ký|Thời hạn|Người ký|Chữ ký/.test(x)).join(' ')} (+ phần ký)\n  điều kiện S giữ ${cS.out.length} bỏ ${cS.drop} · U giữ ${cU.out.length}\n  code ${Object.keys(code).join(',')} · id thiếu trên form: ${missing.join(' ') || '-'}`);
  console.log(`== ${fU.formName}: Logo · h1 «${title}» · TC · Start lồng`);
  fs.writeFileSync(`${OUT}/ec_${TAG}.json`, JSON.stringify({ nS, nU, cS: cS.out, cU: cU.out, code }, null, 1));
  if (!WRITE) return console.log('[DRY-RUN]');
  if (missing.length) return console.log('✗ KHÔNG GHI: code trỏ field không có');
  for (const [f, def, c] of [[fS, nS, cS.out], [fU, nU, cU.out]]) {
    fs.writeFileSync(`${OUT}/backup_ec_${TAG}_${f.formId}.json`, JSON.stringify({ form: f, code: await api.getCode(s, f.formId) }, null, 1));
    const p = fd.buildOwnerFormPayload(f, def, fd.parseFormDef(f).wasString);
    p.variableArr = extractVariables(def); p.jsonFormCondition = JSON.stringify(c);
    await api.putForm(s, p); await api.putCode(s, f.formId, code);
    console.log(`  ✓ PUT ${f.formName} (${p.variableArr.length} biến) + code`);
  }
})().catch(e => { console.error('✗', e.stack); process.exit(1); });
