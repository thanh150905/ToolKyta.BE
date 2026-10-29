// Tạo 3 form con A (YCCS Update), B (Xác nhận phê duyệt), F (Hồ sơ đính kèm) cho saigoncoop sandbox.
// Node copy từ bộ Biên bản thanh lý (U/D/S), đổi id → <newFormId>_<key>, hashid mới. In ra formId mới.
//   node build_subforms.js [--dry-run]
const R = require('path').resolve(__dirname, '../..');
const api = require(R + '/src/eform/api');
const fd = require(R + '/src/eform/formDef');
const { extractVariables } = require(R + '/tools/regen_variable_arr');
const fs = require('fs');
const SP = __dirname;
const OUT = require('path').resolve(__dirname, '../../.kyta/archive/saigoncoop-out'); require('fs').mkdirSync(OUT, { recursive: true });
const DRY = process.argv.includes('--dry-run');

const L = id => JSON.parse(fs.readFileSync(`${OUT}/defs/${id}.json`, 'utf8'));
const all = d => { const a = []; const w = n => { a.push(n); (n.components || []).forEach(w); }; d.def.forEach(w); return a; };
const pick = (d, key) => { const n = all(d).find(x => x.id.endsWith('_' + key)); if (!n) throw new Error('thiếu ' + key); return JSON.parse(JSON.stringify(n)); };
const S = L('000071gbI5UgmnL2vkBIooxo'), D = L('000071bBIoqcQ5adneWlt88a8'), U = L('000071dMId0tzdLX6wDxunnan');

const H = () => Array.from({ length: 9 }, () => 'abcdefghijklmnopqrstuvwxyz0123456789'[Math.floor(Math.random() * 36)]).join('');
const field = (src, key, patch) => ({ ...src, ...patch, key: undefined, _key: key, hashid: H() });
const columns = (key, kids) => ({ type: 'columns', label: 'columns', _key: key, hashid: H(), display: true, components: kids });
const noFormula = { formula: { expression_value: [] } };

const splitter = (key, kids) => ({ type: 'splitter', label: 'Splitter', _key: key, hashid: H(), display: false, components: kids });
const ONLY = (process.argv.find(a => a.startsWith('--only=')) || '').slice(7).split(',').filter(Boolean);
const SPECS_ALL = [
  {
    tag: 'A', formCode: 'SGC_SUBF_YCCS_UPDATE', formName: 'subF_YeuCauChinhSua_Update',
    describe: 'Form con: khối thông tin yêu cầu chỉnh sửa ở form Update (kế thừa từ form Duyệt).',
    build: () => [
      columns('columns-1', [
        field(pick(U, 'textField-18'), 'textField-1', { label: 'Họ và tên người yêu cầu chỉnh sửa', readonly: true, ...noFormula }),
        field(pick(U, 'textField-19'), 'textField-2', { label: 'Email người yêu cầu chỉnh sửa', readonly: true, ...noFormula }),
      ]),
      field(pick(U, 'textArea-2'), 'textArea-1', { label: 'Lý do yêu cầu chỉnh sửa', readonly: true }),
    ],
    cond: () => [],
  },
  {
    tag: 'B', formCode: 'SGC_SUBF_XACNHAN_DUYET', formName: 'subF_XacNhanPheDuyet',
    describe: 'Form con: khối xác nhận phê duyệt / yêu cầu chỉnh sửa ở form Duyệt.',
    build: () => [
      field(pick(D, 'dropdown-10'), 'dropdown-1', { label: 'Xác nhận phê duyệt' }),
      columns('columns-1', [
        field(pick(D, 'textField-22'), 'textField-1', { label: 'Họ và tên người duyệt', readonly: true, ...noFormula }),
        field(pick(D, 'textField-23'), 'textField-2', { label: 'Email người duyệt', readonly: true, ...noFormula }),
      ]),
      field(pick(D, 'textArea-2'), 'textArea-1', { label: 'Lý do yêu cầu chỉnh sửa' }),
    ],
    // Chọn "Phê duyệt" → ẩn khối người duyệt + lý do (giống luật w9aAPzev cũ của form Duyệt).
    cond: id => [{ value: 'Phê duyệt', action: [{ type: 'hide_multiple', fieldIds: [`${id}_textField-1`, `${id}_textField-2`, `${id}_textArea-1`] }],
      enable: true, fieldId: `${id}_dropdown-1`, operator: 'equal', typeValue: '1', conditionId: H().slice(0, 8) }],
  },
  {
    tag: 'F', formCode: 'SGC_SUBF_HOSO_DINHKEM', formName: 'subF_HoSoDinhKem',
    describe: 'Form con: bảng hồ sơ đính kèm chuẩn (Loại hồ sơ / Mô tả / Thời gian thực hiện / Hồ sơ tải lên).',
    build: () => [field(pick(S, 'table_advance-1'), 'table_advance-1', { label: 'Bảng hồ sơ đính kèm' })],
    cond: () => [],
  },
  {
    tag: 'GS', formCode: 'SGC_SUBF_KY_START', formName: 'subF_ThietLapNguoiKy_Start',
    describe: 'Form con: bảng thiết lập người ký (form Start/Update) + field ẩn đi kèm cho mail/cổng submit.',
    build: () => [
      field(pick(S, 'table_advance-2'), 'table_advance-1', {}),
      splitter('splitter-1', [
        field(pick(S, 'dropdown-2'), 'dropdown-1', { label: '[HT] DS người thực hiện (phòng ban + email người ký)' }),
        field(pick(S, 'textField-8'), 'textField-1', { label: '[MAIL] Họ tên người ký đầu tiên' }),
        field(pick(S, 'textField-9'), 'textField-2', { label: '[MAIL] Email người ký đầu tiên' }),
        field(pick(S, 'textField-10'), 'textField-3', { label: '[HT] Cờ chặn submit (chưa có người ký)' }),
      ]),
    ],
    cond: id => [{ value: 'Chọn', action: [{ type: 'hide_multiple', fieldIds: [`${id}_textField-1`] }],
      enable: true, fieldId: `${id}_dropdown-1`, operator: 'equal', typeValue: '1', conditionId: H().slice(0, 8) }],
  },
  {
    tag: 'GD', formCode: 'SGC_SUBF_KY_DUYET', formName: 'subF_KyDuyet',
    describe: 'Form con: bảng ký ở form Duyệt + field ẩn đi kèm (người đăng nhập, cổng submit, DS người đã ký).',
    build: () => [
      field(pick(D, 'table_advance-2'), 'table_advance-1', {}),
      splitter('splitter-1', [
        field(pick(D, 'textField-18'), 'textField-1', { label: '[HT] Email người đăng nhập' }),
        field(pick(D, 'textField-19'), 'textField-2', { label: '[HT] Cờ chặn submit (OK/YCCS)' }),
        field(pick(D, 'dropdown-11'), 'dropdown-1', { label: '[MAIL] DS email người đã ký (báo YCCS)' }),
        field(pick(D, 'textField-20'), 'textField-3', { label: '[HT] Họ người đăng nhập' }),
        field(pick(D, 'textField-21'), 'textField-4', { label: '[HT] Tên người đăng nhập' }),
      ]),
    ],
    cond: () => [],
  },
];
const SPECS = ONLY.length ? SPECS_ALL.filter(x => ONLY.includes(x.tag)) : SPECS_ALL;

// Gán id thật cho cây vừa dựng (sau khi có formId).
function stamp(nodes, formId) {
  const w = n => { n.id = `${formId}_${n._key}`; delete n._key; delete n.key; (n.components || []).forEach(w); };
  nodes.forEach(w);
  return nodes;
}

(async () => {
  const s = await api.open('saigoncoop', 'sandbox');
  const out = {};
  for (const sp of SPECS) {
    if (DRY) { console.log(sp.tag, sp.formCode, JSON.stringify(stamp(sp.build(), 'NEWID'), null, 1).slice(0, 600)); continue; }
    if (!(await api.checkIdAvailable(s, sp.formCode))) throw new Error('trùng mã ' + sp.formCode);
    const created = await api.createForm(s, { formName: sp.formName, formCode: sp.formCode, describeForm: sp.describe, beginTime: '2026/01/01', endTime: '2030/12/31' });
    const id = created.formId;
    const def = [{ id: `${id}_page-1`, type: 'page', label: 'Home', components: stamp(sp.build(), id) }];
    const form = await api.getForm(s, id);
    const payload = fd.buildOwnerFormPayload(form, def, true);
    payload.variableArr = extractVariables(def);
    const cond = sp.cond(id);
    if (cond.length) payload.jsonFormCondition = JSON.stringify(cond);
    await api.putForm(s, payload);
    out[sp.tag] = id;
    console.log(`✓ ${sp.tag} ${sp.formName} → ${id} (${payload.variableArr.length} biến, ${cond.length} điều kiện)`);
  }
  if (!DRY) { const prev = fs.existsSync(`${SP}/subforms.json`) ? require(`${SP}/subforms.json`) : {}; fs.writeFileSync(`${SP}/subforms.json`, JSON.stringify({ ...prev, ...out }, null, 1)); }
})().catch(e => { console.error('✗', e.message); process.exit(1); });
