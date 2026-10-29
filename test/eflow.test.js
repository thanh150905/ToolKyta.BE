'use strict';
// Test eFlow không gọi mạng: điều kiện dây (Blockly ↔ JUEL), kế thừa dữ liệu, đồ thị dây.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const cond = require('../src/eflow/condition');
const inh = require('../src/eflow/inherit');
const modeler = require('../src/eflow/modeler');
const paths = require('../src/core/paths');
const { scopeIndex } = require('../src/eflow/lookup');
const { defaultScope, fieldResolver, findEdge } = require('../src/eflow/commands/cond');

/** Mọi flow.json đã pull trong workspace (mẫu thật do editor sinh). */
function realFlows() {
  const out = [];
  for (const root of paths.moduleRoots('eflow')) {
    for (const d of fs.readdirSync(root)) {
      const fp = path.join(root, d, 'flow.json');
      if (fs.existsSync(fp)) out.push(fp);
    }
  }
  return out;
}

test('condition: parse xml editor → sinh lại khớp từng byte (xml + staticValue) trên mẫu thật', (t) => {
  const files = realFlows();
  if (!files.length) return t.skip('chưa pull quy trình nào');
  let n = 0;
  for (const fp of files) {
    const model = modeler.parseJsonXml(fs.readFileSync(fp, 'utf8'));
    for (const s of model.childShapes || []) {
      const ex = s.properties?.conditionsequenceflow?.expression;
      if (!ex) continue;
      const { tree, pos } = cond.parseBlockly(ex.xml);
      assert.deepEqual(cond.toProperty(tree, pos).expression, ex, `${fp} ${s.resourceId}`);
      n++;
    }
  }
  assert.ok(n > 0);
});

test('condition: --when → JUEL đúng dạng editor (and trong or, !=, Node::"nhãn", số)', () => {
  const ids = { 'Xem xét': 'S1.F_dropdown-4', 'A::Duyệt': 'S2.F_dropdown-4', 'start::Mã dự án': 'M.F_dropdown-1', 'Số tiền': 'M.F_number-1' };
  const tree = cond.parseWhen(`"Xem xét" == "Trả về" or (A::"Duyệt" == "OK" and start::"Mã dự án" != "X") || "Số tiền" >= 100`,
    (/** @type {string} */ r) => { if (!(r in ids)) throw new Error('?' + r); return /** @type {any} */ (ids)[r]; });
  const p = cond.toProperty(tree).expression;
  assert.equal(p.staticValue,
    '${((execution.getVariable("S1.F_dropdown-4") == "Trả về") || ((execution.getVariable("S2.F_dropdown-4") == "OK") && (! (execution.getVariable("M.F_dropdown-1") == "X"))) || (execution.getVariable("M.F_number-1") >= 100))}');
  assert.match(p.xml, /^<xml xmlns="https:\/\/developers.google.com\/blockly\/xml"><block type="test_block" id="rootBlockId" deletable="false" movable="false" editable="false" x="30" y="0">/);
  assert.match(p.xml, /<mutation ops="2"><\/mutation><field name="OPR1">OR<\/field><field name="OPR2">OR<\/field>/);
  // sinh xong đọc lại được và ra cùng JUEL
  const back = cond.parseBlockly(p.xml);
  assert.equal(cond.toProperty(back.tree).expression.staticValue, p.staticValue);
  assert.deepEqual(cond.fieldIds(tree), ['S1.F_dropdown-4', 'S2.F_dropdown-4', 'M.F_dropdown-1', 'M.F_number-1']);
  assert.throws(() => cond.parseWhen('"a" ~ 1', r => r), /toán tử/);
  assert.throws(() => cond.parseWhen('("a" == 1', r => r), /thiếu "\)"/);
});

test('condition: escape xml cho giá trị chứa & < >', () => {
  const p = cond.toProperty(cond.parseWhen('"x" == "A & B <1>"', () => 'S.F_textField-1')).expression;
  assert.match(p.xml, /<field name="INPUT">A &amp; B &lt;1&gt;<\/field>/);
  assert.equal(cond.parseBlockly(p.xml).tree.t, 'cmp');
  assert.ok(p.staticValue.includes('"A & B <1>"'));
});

// Quy trình nhỏ: Start → T1 → G(excl) → T2 | T3 ; T2,T3 có form; Start form ở scope modeler.
const model = {
  modelId: 'P', childShapes: [
    { resourceId: 'start', stencil: { id: 'StartNoneEvent' }, properties: { name: '' }, outgoing: [{ resourceId: 'f0' }] },
    { resourceId: 'f0', stencil: { id: 'SequenceFlow' }, properties: {}, target: { resourceId: 'T1' }, outgoing: [{ resourceId: 'T1' }] },
    { resourceId: 'T1', stencil: { id: 'CallActivity' }, properties: { name: 'Duyệt 1' }, outgoing: [{ resourceId: 'f1' }] },
    { resourceId: 'f1', stencil: { id: 'SequenceFlow' }, properties: {}, target: { resourceId: 'G' }, outgoing: [{ resourceId: 'G' }] },
    { resourceId: 'G', stencil: { id: 'ExclusiveGateway' }, properties: { name: '' }, outgoing: [{ resourceId: 'f2' }, { resourceId: 'f3' }] },
    { resourceId: 'f2', stencil: { id: 'SequenceFlow' }, properties: { conditionsequenceflow: '' }, target: { resourceId: 'T2' }, outgoing: [{ resourceId: 'T2' }] },
    { resourceId: 'f3', stencil: { id: 'SequenceFlow' }, properties: { conditionsequenceflow: '' }, target: { resourceId: 'T3' }, outgoing: [{ resourceId: 'T3' }] },
    { resourceId: 'T2', stencil: { id: 'CallActivity' }, properties: { name: 'Sửa' }, outgoing: [] },
    { resourceId: 'T3', stencil: { id: 'CallActivity' }, properties: { name: 'Kết thúc' }, outgoing: [] },
  ],
};
const form = (/** @type {string} */ id, /** @type {any[]} */ comps) => JSON.stringify([{ id: id + '_page-1', type: 'page', components: comps }]);
const forms = [
  { formId: 'FS', formCode: 'Start', userTaskId: '', versionId: 'vS', jsonForm: form('FS', [{ id: 'SUB_dropdown-1', type: 'dropdown', label: 'Mã dự án', hashid: 'hMa' }, { id: 'SUB_textField-2', type: 'textField', label: 'Ghi chú', hashid: 'hGc' }]) },
  { formId: 'F1', formCode: 'D1', userTaskId: 'T1', versionId: 'v1', jsonForm: form('F1', [{ id: 'SUB_dropdown-1', type: 'dropdown', label: 'Mã dự án', hashid: 'hMa' }, { id: 'F1_dropdown-4', type: 'dropdown', label: 'Xem xét', hashid: 'hXx' }, { id: 'F1_textField-9', type: 'textField', label: 'Ghi chú', hashid: 'hKhac' }, { id: 'F1_splitter-1', type: 'splitter', label: '', hashid: 'hSp' }]) },
];
const m = modeler.graph({ id: 'M', name: 'QT', keyValue: 'qt' }, model);

test('modeler.edges + cond.findEdge: theo sid hoặc "Nguồn->Đích" xuyên cổng', () => {
  assert.deepEqual(modeler.edges(model).map(e => `${e.src}>${e.dst}`), ['start>T1', 'T1>G', 'G>T2', 'G>T3']);
  assert.equal(findEdge(model, m, 'f3').rid, 'f3');
  assert.equal(findEdge(model, m, 'Duyệt 1->Sửa').rid, 'f2');
  assert.equal(findEdge(model, m, 'Duyệt 1→Kết thúc').rid, 'f3');
  assert.throws(() => findEdge(model, m, 'Sửa->Kết thúc'), /Không có dây/);
});

test('cond: scope mặc định = form ngược dòng gần nhất; Node::/start:: chọn scope rõ', () => {
  const idx = scopeIndex(forms, m);
  assert.equal(defaultScope(m, idx, 'G'), 'T1');
  const resolve = fieldResolver(m, idx, defaultScope(m, idx, 'G'));
  assert.equal(resolve('Xem xét'), 'T1.F1_dropdown-4');
  assert.equal(resolve('Mã dự án'), 'T1.SUB_dropdown-1');          // ưu tiên form node trước dây
  assert.equal(resolve('start::Mã dự án'), 'M.SUB_dropdown-1');
  assert.equal(resolve('Duyệt 1::dropdown-4'), 'T1.F1_dropdown-4');
  assert.equal(resolve('M.SUB_textField-2'), 'M.SUB_textField-2');
  assert.throws(() => resolve('Không có'), /Không thấy field/);
});

test('inherit.buildSource: đúng định dạng editor mới (Start và user-task)', () => {
  const tgt = { id: 'SUB_dropdown-1', type: 'dropdown', label: 'Mã dự án', hashid: 'hMa' };
  assert.deepEqual(inh.buildSource('M', null, tgt, tgt), {
    elementTarget: 'hMa', fieldId: 'SUB_dropdown-1-Target-null-null',
    listElementSource: [{ hashId: 'hMa', fieldId: 'SUB_dropdown-1-Root-null-M', userTaskId: null, modelerId: 'M', label: 'Mã dự án', type: 'dropdown' }],
    formula: { expressionValue: [{ type: 'variable', value: 'Mã dự án', item: 'M.hMa' }], context: "getValueForm('M.hMa')", type: null },
  });
  const s = inh.buildSource('M', 'sid-1', { id: 'F_signature-3', type: 'signature', label: 'Ký', hashid: 'hK' }, { id: 'G_signature-3', type: 'signature', label: 'Ký', hashid: 'hK2' });
  assert.equal(s.listElementSource[0].fieldId, 'F_signature-3-Root-sid-1-M');
  assert.equal(s.formula.context, "getValueForm('M.sid-1.hK')");
  assert.equal(inh.describeFormula(s, sid => (sid ? 'Node ' + sid : 'Start')), '«[Node sid-1] Ký»');
});

test('inherit.matchFields: hashid trước, rồi nhãn+kiểu; bỏ field layout', () => {
  const idx = scopeIndex(forms, m);
  const res = inh.matchFields(/** @type {any} */ (idx.scopes.get('T1')).fields, /** @type {any} */ (idx.scopes.get('M')).fields);
  assert.deepEqual(res.map(r => [r.tgt.label, r.src?.hashid || null, r.by]), [
    ['Mã dự án', 'hMa', 'hashid'], ['Xem xét', null, null], ['Ghi chú', 'hGc', 'label'],
  ]);
});

test('inherit.retarget: đổi đích sang form khác theo hashid/nhãn, bỏ dòng không khớp', () => {
  const a = [{ id: 'A_dropdown-1', type: 'dropdown', label: 'Mã', hashid: 'h1' }, { id: 'A_textField-1', type: 'textField', label: 'Ghi chú', hashid: 'h2' }, { id: 'A_number-1', type: 'number', label: 'Tiền', hashid: 'h3' }];
  const b = [{ id: 'B_dropdown-1', type: 'dropdown', label: 'Mã', hashid: 'h1' }, { id: 'B_textField-7', type: 'textField', label: 'Ghi chú', hashid: 'x9' }];
  const src = a.map(f => inh.buildSource('M', null, f, f));
  const { kept, dropped } = inh.retarget(src, a, b);
  assert.deepEqual(kept.map(k => [k.elementTarget, k.fieldId]), [['h1', 'B_dropdown-1-Target-null-null'], ['x9', 'B_textField-7-Target-null-null']]);
  assert.equal(dropped.length, 1);
  assert.equal(kept[1].formula.context, "getValueForm('M.h2')");   // nguồn giữ nguyên
});

test('modeler.parseJsonXml: giải chuỗi mã hoá 2 lần', () => {
  assert.equal(modeler.parseJsonXml(JSON.stringify(JSON.stringify({ modelId: 'X' }))).modelId, 'X');
  assert.equal(modeler.parseJsonXml('{"modelId":"Y"}').modelId, 'Y');
});
