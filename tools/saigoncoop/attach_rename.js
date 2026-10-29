// Chuẩn hoá tên phần đính kèm về "tài liệu": tiêu đề, label bảng, tên cột — kể cả bản nhúng form con trong form cha.
//   node attach_rename.js [--write]
const fs = require('fs'); const R = require('path').resolve(__dirname, '../..');
const api = require(R + '/src/eform/api'), fd = require(R + '/src/eform/formDef'), { extractVariables } = require(R + '/tools/regen_variable_arr');
const WRITE = process.argv.includes('--write');
const RE = /(hồ sơ|tài liệu)\s+đính\s+kèm/i;
const HEAD = 'TÀI LIỆU ĐÍNH KÈM', LABEL = 'Bảng tài liệu đính kèm';
const COL = { 'Loại hồ sơ': 'Loại tài liệu', 'Hồ sơ tải lên': 'Tài liệu tải lên' };
const SUB = require('./subforms.json');
function fix(node, log) {
  if ((node.type === 'h2' || node.type === 'h3') && typeof node.value === 'string' && RE.test(node.value) && node.value !== HEAD) { log.push(`${node.id.split('_').slice(1).join('_')} tiêu đề «${node.value}» → «${HEAD}»`); node.value = HEAD; }
  if (node.type === 'table_advance' && RE.test(node.label || '') && node.label !== LABEL) { log.push(`${node.id.split('_').slice(1).join('_')} label «${node.label}» → «${LABEL}»`); node.label = LABEL; }
  if (node.type === 'table_advance') (function deep(o) { for (const k of Object.keys(o)) { const v = o[k];
    if (k === 'title' && typeof v === 'string' && COL[v]) { log.push(`${node.id.split('_').slice(1).join('_')} cột «${v}» → «${COL[v]}»`); o[k] = COL[v]; }
    else if (v && typeof v === 'object' && k !== 'components') deep(v); } })(node);
  (node.components || []).forEach(c => fix(c, log));
}
(async () => {
  const s = await api.open('saigoncoop', 'sandbox');
  const ids = [SUB.F, ...require('./bound.json').map(b => b.id)];
  let n = 0;
  for (const id of ids) {
    const form = await api.getForm(s, id); const { def, wasString } = fd.parseFormDef(form);
    const log = []; def.forEach(p => fix(p, log));
    if (id === SUB.F && form.formName !== 'subF_TaiLieuDinhKem') log.push(`formName «${form.formName}» → «subF_TaiLieuDinhKem»`);
    if (!log.length) continue; n++;
    console.log(`\n${form.formName} (${log.length})`); log.forEach(x => console.log('   ' + x));
    if (!WRITE) continue;
    fs.writeFileSync(`${__dirname}/backup_attach_${id}.json`, JSON.stringify({ form }, null, 1));
    const payload = fd.buildOwnerFormPayload(form, def, wasString);
    if (id === SUB.F) { payload.formName = 'subF_TaiLieuDinhKem'; payload.describeForm = 'Form con: bảng tài liệu đính kèm chuẩn (Loại tài liệu / Mô tả / Thời gian thực hiện / Tài liệu tải lên).'; }
    payload.variableArr = extractVariables(def);
    await api.putForm(s, payload); console.log('   ✓ PUT');
  }
  console.log(`\n${n} form có thay đổi` + (WRITE ? '' : ' [DRY-RUN]'));
})().catch(e => { console.error(e); process.exit(1); });
