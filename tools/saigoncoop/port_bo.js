// Port 1 bộ hồ sơ luồng 1 (Trên 500tr) → bộ tương ứng luồng 2 (Dưới 500tr), giữ formId luồng 2.
//   node port_bo.js bo2/<bộ>.js [--write] [--only=S,D,U]
// Cấu trúc + cấu hình + điều kiện + code + custom UI lấy từ form luồng 1. Field nội dung khớp (cùng type + nhãn
// bỏ tiền tố [HT]/[MAIL]/[KÝ]) giữ HASHID luồng 2 (bản in eWriter luồng 2 trỏ hashid đó); field mới giữ hashid luồng 1.
// Field luồng 2 không khớp: bỏ (báo) trừ khi khai trong KEEP. Thay id form/SID/hashid/text/doc/mail trong mọi chuỗi.
// SKIP {tag:[key L1]}: không mang field L1 đó sang. ALIAS {tag:{key L1: key L2}}: ghép cặp khác nhãn (giữ hashid L2, lấy nhãn L1).
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
const TAG = path.basename(path.dirname(path.resolve(process.argv[2]))) + '_' + path.basename(process.argv[2], '.js');   // gồm thư mục spec (bo2/bo3/bo4 trùng tên file)
const { SRC, DST } = SPEC;
const SID = SPEC.SID || {}, TEXT = SPEC.TEXT || [], DOC = SPEC.DOC || {}, MAIL = SPEC.MAIL || {}, KEEP = SPEC.KEEP || {};
const SKIP = SPEC.SKIP || {}, ALIAS = SPEC.ALIAS || {};
const EW = R + '/workspace/saigoncoop/sandbox/ewriter';
const DOCX = fs.readdirSync(EW).filter(d => fs.existsSync(`${EW}/${d}/document.xml`)).map(d => fs.readFileSync(`${EW}/${d}/document.xml`, 'utf8')).join('\n');

const clone = o => JSON.parse(JSON.stringify(o));
const keyOf = (n, fid) => n.id && n.id.startsWith(fid + '_') ? n.id.slice(fid.length + 1) : null;
const norm = s => String(s ?? '').replace(/^\s*\[(HT|MAIL|KÝ)\]\s*/i, '').replace(/\s+/g, ' ').trim().toLowerCase();
const LAYOUT = new Set(['columns', 'row', 'page']);
const isLeaf = n => !LAYOUT.has(n.type) && n.type !== 'splitter' && n.type !== 'child_form';
const ownNodes = (def, fid) => { const a = []; const w = n => { if (keyOf(n, fid)) a.push(n); if (n.type !== 'child_form') (n.components || []).forEach(w); }; def.forEach(w); return a; };
const parseCond = c => { if (!c) return []; try { const v = JSON.parse(c); return Array.isArray(v) ? v : JSON.parse(v); } catch (_) { return []; } };
const condSources = r => r.fieldId ? [r.fieldId] : (r.conditions || []).map(c => c.fieldId);

// thay chuỗi: id form, SID, text, doc, mail (+ hashid nếu truyền map)
function subst(str, hmap) {
  for (const t of ['S', 'D', 'U']) if (SRC[t] && DST[t]) str = str.split(SRC[t]).join(DST[t]);
  for (const [a, b] of Object.entries(SID)) str = str.split(a).join(b);
  for (const [a, b] of TEXT) str = str.split(a).join(b);
  for (const [a, b] of Object.entries(DOC)) str = str.split(a).join(b);
  for (const [a, b] of Object.entries(MAIL)) str = str.split(a).join(b);
  if (hmap) for (const [a, b] of Object.entries(hmap)) str = str.split(a).join(b);
  return str;
}

// Bản Start lồng trong form Update KHÔNG mang Logo (form Update đã có Logo riêng) — như luồng 1.
const dropLogo = comps => comps.filter(c => !(c.type === 'child_form' && c.childFormConfig && c.childFormConfig.childFormId === '000071JlI0Df4KBJ05JPsQQ1Q'));
const report = {};
const HMAP = {};          // hashid luồng 1 → luồng 2 (field khớp) — dùng thay trong code
const NEWDEF = {};        // def mới theo tag (U nhúng S mới)

function port(tag, srcForm, dstForm) {
  const sid = SRC[tag], did = DST[tag];
  const { def: sdef } = fd.parseFormDef(srcForm);
  const { def: ddef } = fd.parseFormDef(dstForm);
  const sOwn = ownNodes(sdef, sid), dOwn = ownNodes(ddef, did);
  const dLeaves = dOwn.filter(isLeaf);
  const used = new Set(), match = new Map();   // src key → dst node
  const keepKeys = (KEEP[tag] || []).map(k => k[0]);
  const alias = ALIAS[tag] || {}, skip = new Set(SKIP[tag] || []);
  for (const [k1, k2] of Object.entries(alias)) {
    const n = sOwn.find(x => keyOf(x, sid) === k1), d = dLeaves.find(x => keyOf(x, did) === k2);
    if (!n || !d) throw new Error(`${tag}: ALIAS ${k1}→${k2} không thấy field`);
    used.add(d); match.set(k1, d);
    if (d.hashid !== n.hashid) HMAP[n.hashid] = d.hashid;
  }
  for (const n of sOwn.filter(isLeaf)) {
    const k = keyOf(n, sid);
    if (match.has(k)) continue;
    const c = dLeaves.filter(d => !used.has(d) && !keepKeys.includes(keyOf(d, did)) && d.type === n.type && norm(d.label ?? d.value) === norm(n.label ?? n.value));
    if (!c.length) continue;
    const pick = c.find(d => keyOf(d, did) === k) || c[0];
    used.add(pick); match.set(k, pick);
    if (pick.hashid !== n.hashid) HMAP[n.hashid] = pick.hashid;
  }
  const rep = report[tag] = { matched: [], fresh: [], dropped: [], kept: [], labelKept: [] };
  const conv = (n) => {
    const k = keyOf(n, sid);
    const o = clone(n);
    if (k) o.id = `${did}_${k}`;
    if (n.type === 'child_form') {
      const cid = n.childFormConfig?.childFormId;
      const own = Object.entries(SRC).find(([, v]) => v === cid);
      if (own) {
        const t2 = own[0], nd = NEWDEF[t2];
        if (!nd) throw new Error(`${tag}: cần def mới của ${t2} trước`);
        const flags = new Map(ownNodes(n.components || [], cid).map(x => [keyOf(x, cid), x]));
        const comps = dropLogo(clone(fd.contentComponents(nd)));
        const w = x => { const kk = keyOf(x, DST[t2]); const f = kk && flags.get(kk);
          if (f) { for (const p of ['display', 'readonly']) if (p in f) x[p] = f[p]; else delete x[p]; }
          if (x.type !== 'child_form') (x.components || []).forEach(w); };
        comps.forEach(w);
        o.components = comps;
        o.childFormConfig = { ...o.childFormConfig, childFormId: DST[t2] };
      }
      rep.fresh.push(`${k}(con ${cid.slice(-6)})`);
      return o;
    }
    if (Array.isArray(n.components)) o.components = n.components.filter(c => !skip.has(keyOf(c, sid))).map(conv);
    if (isLeaf(n) && k) {
      const m = match.get(k);
      if (m) {
        o.hashid = m.hashid;
        const lbl = n.label;
        if (alias[k]) rep.labelKept.push(`${k}←${alias[k]} lấy nhãn L1${DOCX.includes('(' + m.hashid + ')') ? ' ⚠DOCX' : ''}`);
        else if (m.label !== lbl && DOCX.includes('(' + m.hashid + ')')) { o.label = m.label; if (o.config) o.config.label = m.label; rep.labelKept.push(`${k} «${m.label}»`); }
        rep.matched.push(k + (keyOf(m, did) !== k ? `←${keyOf(m, did)}` : ''));
      } else rep.fresh.push(k);
    }
    return o;
  };
  const page = clone(sdef[0]);
  page.components = (sdef[0].components || []).filter(c => !skip.has(keyOf(c, sid))).map(conv);
  rep.skipped = [...skip];
  if (sdef.length > 1) throw new Error('nhiều page chưa hỗ trợ');
  // KEEP: field luồng 2 giữ lại, chèn sau key chỉ định (cấp trên cùng)
  for (const [k, opt = {}] of KEEP[tag] || []) {
    if (sOwn.some(x => keyOf(x, sid) === k)) throw new Error(`${tag}: KEEP ${k} trùng key luồng 1`);
    const src = dOwn.find(x => keyOf(x, did) === k); if (!src) throw new Error(`${tag}: không thấy ${k}`);
    const o = clone(src); used.add(src);
    if (opt.readonly !== undefined) o.readonly = opt.readonly;
    const i = page.components.findIndex(x => keyOf(x, did) === opt.after);
    if (i < 0) throw new Error(`${tag}: không thấy vị trí ${opt.after}`);
    page.components.splice(i + 1, 0, o); rep.kept.push(k);
  }
  for (const d of dLeaves) if (!used.has(d)) rep.dropped.push(`${keyOf(d, did)}«${String(d.label ?? '').slice(0, 30)}»${DOCX.includes('(' + d.hashid + ')') ? ' ⚠DOCX' : ''}`);
  let nd = JSON.parse(subst(JSON.stringify([page])));
  // điều kiện
  const ids = new Set(); (function w(a) { a.forEach(x => { if (x.id) ids.add(x.id); (x.components || []).forEach(y => w([y])); }); })(nd);
  const conds = parseCond(subst(JSON.stringify(parseCond(srcForm.jsonFormCondition))));
  const kept = [], cdrop = [];
  for (const r of conds) { const miss = condSources(r).filter(f => !ids.has(f)); if (miss.length) cdrop.push(r.conditionId); else kept.push(r); }
  rep.cond = `giữ ${kept.length}/${conds.length}` + (cdrop.length ? ` bỏ ${cdrop}` : '');
  // soát chuỗi còn sót
  const s = JSON.stringify(nd);
  rep.leftSrc = Object.values(SRC).filter(x => s.includes(x));
  rep.leftText = TEXT.map(t => t[0]).filter(x => s.includes(x));
  NEWDEF[tag] = nd;
  return { nd, conds: kept };
}

function codeLeft(code) {
  const all = Object.values(code).map(v => v.code).join('\n');
  const toks = new Set(all.match(/0000[0-9A-Za-z]{13,24}|sid-[0-9A-F]{8}-[0-9A-F-]{27}/g) || []);
  const known = new Set([...Object.values(DST), ...Object.values(SID), ...Object.values(MAIL), ...Object.values(DOC), ...(SPEC.KNOWN || [])]);
  return [...toks].filter(t => !known.has(t));
}

(async () => {
  const s = await api.open('saigoncoop', 'sandbox');
  for (const tag of ['S', 'D', 'U']) {
    if (!SRC[tag] || !DST[tag]) continue;
    const srcForm = await api.getForm(s, SRC[tag]);
    const dstForm = await api.getForm(s, DST[tag]);
    const { nd, conds } = port(tag, srcForm, dstForm);
    const code = await api.getCode(s, SRC[tag]);
    const newCode = {}; for (const [k, v] of Object.entries(code)) newCode[k] = { code: subst(v.code, HMAP), order: v.order };
    const r = report[tag];
    console.log(`\n== ${tag} ${srcForm.formName} → ${dstForm.formName}`);
    console.log(`  khớp ${r.matched.length}: ${r.matched.join(' ')}`);
    console.log(`  mới  ${r.fresh.length}: ${r.fresh.join(' ')}`);
    console.log(`  giữ (KEEP): ${r.kept.join(' ') || '-'}   nhãn: ${r.labelKept.join(', ') || '-'}   SKIP L1: ${r.skipped.join(' ') || '-'}`);
    console.log(`  bỏ field L2 ${r.dropped.length}: ${r.dropped.join(' ')}`);
    console.log(`  điều kiện ${r.cond}; còn id L1 trong def: ${r.leftSrc.join(',') || '-'}; còn text: ${r.leftText.join(',') || '-'}`);
    console.log(`  code ${Object.keys(newCode).join(',')} ; token lạ: ${codeLeft(newCode).join(' ') || '-'}`);
    fs.writeFileSync(`${OUT}/port_${TAG}_${tag}.json`, JSON.stringify({ nd, conds, code: newCode }, null, 1));
    if (!WRITE || !ONLY.includes(tag)) continue;
    const oldCode = await api.getCode(s, DST[tag]);
    fs.writeFileSync(`${OUT}/backup_port_${TAG}_${tag}_${DST[tag]}.json`, JSON.stringify({ form: dstForm, code: oldCode }, null, 1));
    const { wasString } = fd.parseFormDef(dstForm);
    const payload = fd.buildOwnerFormPayload(dstForm, nd, wasString);
    payload.variableArr = extractVariables(nd);
    payload.jsonFormCondition = JSON.stringify(conds);
    await api.putForm(s, payload);
    await api.putCode(s, DST[tag], newCode);
    console.log(`  ✓ đã PUT form (${payload.variableArr.length} biến) + code`);
  }
  fs.writeFileSync(`${OUT}/port_${TAG}_hmap.json`, JSON.stringify(HMAP, null, 1));
})().catch(e => { console.error('✗', e.stack); process.exit(1); });
