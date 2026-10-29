// Dùng chung cho spec: ánh xạ field cũ → form con + sinh file map cho eflow_fix_bo.js / code_remap.js.
const SUB = require('../subforms.json');
// mv: { S: {oldKey: 'GS.key' | 'DROP'} } → { '<formId>_<old>': '<subId>_<key>' | 'DROP' } (DROP = field di sản bị xoá)
function buildMap(IDS, mv) {
  const out = {};
  for (const tag of Object.keys(mv)) for (const [k, v] of Object.entries(mv[tag])) {
    if (v === 'DROP') { out[`${IDS[tag]}_${k}`] = 'DROP'; continue; }
    const [t, key] = v.split('.'); out[`${IDS[tag]}_${k}`] = `${SUB[t]}_${key}`;
  }
  return out;
}
const E_MV = { 'dropdown-1': 'E.dropdown-1', 'textField-1': 'E.textField-1', 'textField-2': 'E.textField-2', 'textField-3': 'E.textField-3' };
const GOM = '[HT] Gom file tài liệu đính kèm';
// Form upload một bước: Thông tin chung (E) + bảng (F hoặc giữ bảng riêng) + 1 upload ẩn gom file.
function uploadForm(id, { table = 'F', extraTop = [], emailKey = 'textField-3' } = {}) {
  const IDS = { S: id };
  const MV = { S: { ...E_MV, [emailKey]: 'E.textField-3', ...(table === 'F' ? { 'table_advance-1': 'F.table_advance-1' } : {}) } };
  if (emailKey !== 'textField-3') delete MV.S['textField-3'];
  return { IDS, MV, LAYOUT: { S: SUB => ['h1-1', 'h2-1', ['child', SUB.E], 'h2-2', 'text-1', ...(table === 'F' ? [['child', SUB.F]] : ['table_advance-1']), ...extraTop,
    ['splitter', 'splitter-1', ['upload_file-1']]] }, LABELS: { S: { 'upload_file-1': GOM } } };
}
module.exports = { buildMap, E_MV, GOM, uploadForm };
