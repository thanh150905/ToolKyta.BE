'use strict';
// Test logic cấu hình field: thu field, tách/áp config, băm, định vị. Không gọi mạng.
const test = require('node:test');
const assert = require('node:assert/strict');

const formDef = require('../src/eform/formDef');
const fields = require('../src/eform/fields');

/** jsonForm def rút gọn giống server: page → columns → field. */
function sampleDef() {
  return {
    type: 'page', label: 'p', components: [
      { id: '0000abc_columns-1', type: 'columns', hashid: 'COL1', label: 'columns', display: true, components: [
        { id: '0000abc_textField-1', type: 'textField', hashid: 'TF1', label: 'Tên', display: true, readonly: false,
          validate: { required: true, maxLength: '' }, components: undefined },
        { id: '0000abc_dropdown-1', type: 'dropdown', hashid: 'DD1', label: 'Đơn vị', display: true, readonly: false,
          validate: { required: false }, dropdownConfig: { data: [], typeGetData_value: { value: 1 } } },
      ] },
      { id: '0000abc_h2-1', type: 'h2', hashid: 'H21', value: 'Tiêu đề', display: true },
      { type: 'variable', value: 'x' }, // không hashid → bỏ
    ],
  };
}

test('collectAllFields: bỏ container bố cục + node không hashid, giữ field + heading', () => {
  const got = formDef.collectAllFields(sampleDef());
  const keys = got.map(f => f.key);
  assert.deepEqual(keys, ['textField-1', 'dropdown-1', 'h2-1']); // columns/page/variable bị loại
  const h2 = /** @type {any} */ (got.find(f => f.type === 'h2'));
  assert.equal(h2.label, 'Tiêu đề'); // heading lấy label từ value
});

test('collectAllFields: node trỏ thẳng cây def → sửa được', () => {
  const def = sampleDef();
  const f = /** @type {any} */ (formDef.collectAllFields(def).find(x => x.key === 'textField-1'));
  f.node.label = 'Đổi';
  assert.equal(/** @type {any} */ (def.components[0]).components[0].label, 'Đổi');
});

test('toConfig: loại id/hashid/type/components/customRenderCode', () => {
  const c = fields.toConfig({ id: 'x', hashid: 'h', type: 'textField', label: 'L', components: [1], customRenderCode: {}, readonly: true });
  assert.deepEqual(Object.keys(c).sort(), ['label', 'readonly']);
});

test('applyConfig: chỉ ghi property có trong config, trả danh sách đã đổi', () => {
  const node = { id: 'x', hashid: 'h', type: 'textField', label: 'Cũ', readonly: false, validate: { required: false } };
  const changed = fields.applyConfig(node, { label: 'Mới', validate: { required: true }, readonly: false });
  assert.deepEqual(changed.sort(), ['label', 'validate']); // readonly không đổi → không kể
  assert.equal(node.label, 'Mới');
  assert.equal(node.validate.required, true);
  assert.equal(node.id, 'x'); // danh tính giữ nguyên
});

test('applyConfig: không đụng property STRUCTURAL kể cả khi lỡ có trong config', () => {
  const node = { hashid: 'h', type: 'textField', label: 'L' };
  const changed = fields.applyConfig(node, { hashid: 'HACK', type: 'number', label: 'L' });
  assert.deepEqual(changed, []);
  assert.equal(node.hashid, 'h');
  assert.equal(node.type, 'textField');
});

test('buildDoc + docHashes: khoá theo hashid, đổi config thì hash đổi', () => {
  const doc = fields.buildDoc(sampleDef(), '0000abc');
  assert.equal(doc.formId, '0000abc');
  assert.equal(doc.fields.length, 3);
  const h1 = fields.docHashes(doc);
  assert.ok(h1.TF1 && h1.DD1 && h1.H21);
  /** @type {any} */ (doc.fields.find(f => f.hashid === 'TF1')).config.label = 'khác';
  const h2 = fields.docHashes(doc);
  assert.notEqual(h1.TF1, h2.TF1);
  assert.equal(h1.DD1, h2.DD1); // field khác không ảnh hưởng
});

test('fieldFinder: định vị theo hashid trước, fallback key', () => {
  const all = formDef.collectAllFields(sampleDef());
  const find = formDef.fieldFinder(all);
  assert.equal(/** @type {any} */ (find({ hashid: 'DD1' })).type, 'dropdown');
  assert.equal(/** @type {any} */ (find({ hashid: null, key: 'h2-1' })).type, 'h2');
  assert.equal(find({ hashid: 'NOPE', key: 'nope' }), null);
});

test('removeField: gỡ đúng node theo hashid, giữ anh em, trả node đã gỡ', () => {
  const def = sampleDef();
  const removed = formDef.removeField(def, { hashid: 'DD1' });
  assert.equal(removed.type, 'dropdown');
  const left = formDef.collectAllFields(def).map(f => f.hashid);
  assert.deepEqual(left, ['TF1', 'H21']); // DD1 biến mất, còn lại nguyên
});

test('removeField: fallback theo key khi không có hashid; không thấy → null, cây nguyên', () => {
  const def = sampleDef();
  assert.equal(formDef.removeField(def, { hashid: null, key: 'h2-1' }).type, 'h2');
  assert.equal(formDef.removeField(def, { hashid: 'NOPE' }), null);
  assert.equal(formDef.collectAllFields(def).length, 2); // chỉ mất h2
});

test('nextTypeIndex: index kế tiếp theo type', () => {
  const def = sampleDef(); // có textField-1, dropdown-1, h2-1
  assert.equal(formDef.nextTypeIndex(def, 'textField'), 2);
  assert.equal(formDef.nextTypeIndex(def, 'number'), 1); // chưa có → 1
});

test('newHashid: 9 ký tự, không trùng hashid sẵn có', () => {
  const def = sampleDef();
  const h = formDef.newHashid(def);
  assert.match(h, /^[0-9A-Za-z]{9}$/);
  const used = new Set(formDef.collectAllFields(def).map(f => f.hashid));
  assert.ok(!used.has(h));
});

test('insertField: --after chèn ngay sau field trong cùng mảng cha', () => {
  const def = sampleDef();
  const node = { id: 'x', type: 'number', hashid: 'NEW', label: 'N' };
  assert.equal(formDef.insertField(def, node, { after: 'textField-1' }), true);
  const cols = /** @type {any} */ (def.components[0]).components;
  assert.equal(cols[0].hashid, 'TF1');
  assert.equal(cols[1].hashid, 'NEW'); // ngay sau textField-1
});

test('insertField: mặc định nối vào components của page', () => {
  const def = sampleDef();
  const node = { type: 'number', hashid: 'NEW2', label: 'N' };
  assert.equal(formDef.insertField(def, node, {}), true);
  assert.equal(def.components[def.components.length - 1].hashid, 'NEW2');
});

test('findNode: tìm được cả field lẫn container (columns)', () => {
  const def = sampleDef();
  assert.equal(formDef.findNode(def, { key: 'dropdown-1' }).hashid, 'DD1');
  assert.equal(formDef.findNode(def, { hashid: 'COL1' }).type, 'columns'); // container, fieldFinder không thấy
  assert.equal(formDef.findNode(def, { key: 'khong-co' }), null);
});

test('locateInParent: trả đúng mảng cha + chỉ số', () => {
  const def = sampleDef();
  const loc = /** @type {any} */ (formDef.locateInParent(def, { hashid: 'DD1' }));
  assert.equal(loc.array[loc.index].hashid, 'DD1');
  assert.equal(loc.index, 1); // sau textField-1 trong columns
});

test('isContainer: chỉ node có components là container', () => {
  assert.equal(formDef.isContainer({ type: 'columns', components: [] }), true);
  assert.equal(formDef.isContainer({ type: 'textField' }), false);
});

test('group logic: gỡ field rồi nhét vào container mới, chèn lại đúng vị trí', () => {
  const def = sampleDef();
  const refs = [{ hashid: 'TF1' }, { hashid: 'DD1' }];
  const anchor = /** @type {any} */ (formDef.locateInParent(def, refs[0]));
  const nodes = refs.map(r => formDef.removeField(def, r));
  const container = { type: 'columns', hashid: 'NEWC', components: nodes };
  anchor.array.splice(Math.min(anchor.index, anchor.array.length), 0, container);
  // columns cũ giờ chỉ còn container mới (2 field đã bị gỡ, thay bằng container)
  const col = /** @type {any} */ (def.components[0]);
  assert.equal(col.components.length, 1);
  assert.equal(col.components[0].hashid, 'NEWC');
  assert.deepEqual(col.components[0].components.map((/** @type {any} */ n) => n.hashid), ['TF1', 'DD1']);
});

test('contentComponents: bóc lớp page, giữ field phẳng', () => {
  const def = { type: 'page', components: [{ type: 'upload_file', hashid: 'U1' }, { type: 'textField', hashid: 'T1' }] };
  const cc = formDef.contentComponents(def);
  assert.deepEqual(cc.map(n => n.hashid), ['U1', 'T1']);
  // nhiều page → gộp
  const multi = [{ type: 'page', components: [{ type: 'h2', hashid: 'H' }] }, { type: 'page', components: [{ type: 'number', hashid: 'N' }] }];
  assert.deepEqual(formDef.contentComponents(multi).map(n => n.hashid), ['H', 'N']);
});

test('collectByType: thu đúng node theo type', () => {
  const def = { type: 'page', components: [{ type: 'child_form', hashid: 'C1', components: [] }, { type: 'textField', hashid: 'T' }, { type: 'child_form', hashid: 'C2', components: [] }] };
  assert.deepEqual(formDef.collectByType(def, 'child_form').map(n => n.hashid), ['C1', 'C2']);
});

test('summarize: gom cờ required/readonly/hidden', () => {
  const s = fields.summarize({ key: 'a', hashid: 'H', type: 'textField', label: 'L',
    config: { readonly: true, display: false, validate: { required: true } } });
  assert.deepEqual(s.flags.sort(), ['hidden', 'readonly', 'required']);
});
