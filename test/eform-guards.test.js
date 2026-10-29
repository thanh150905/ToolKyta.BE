'use strict';
// Rào chắn eForm rút từ các lỗi đã gặp: variableArr, key trùng form con, push fields 3 chiều,
// refresh child_form giữ chỉnh riêng, pull không đè thư mục form khác, quét tham chiếu trước khi xoá.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const formDef = require('../src/eform/formDef');
const fields = require('../src/eform/fields');
const { hash } = require('../src/core/fsx');
const { planFieldPush } = require('../src/eform/commands/push');
const { planRefresh } = require('../src/eform/commands/childform');
const { assertOwnDir } = require('../src/eform/commands/pull');
const { findEntry, refHits } = require('../src/eform/commands/field');

/** Form cha 0000P nhúng form con 0000C (cả hai có dropdown-1). */
const parentDef = () => [{
  type: 'page', id: '0000P_page-1', components: [
    { type: 'dropdown', id: '0000P_dropdown-1', hashid: 'pD1', label: 'Của cha' },
    { type: 'columns', id: '0000P_columns-1', components: [
      { type: 'textField', id: '0000P_textField-1', hashid: 'pT1', label: '' },
    ] },
    { type: 'child_form', id: '0000P_child_form-1', hashid: 'pCF', label: 'Con',
      childFormConfig: { childFormId: '0000C' }, components: [
        { type: 'dropdown', id: '0000C_dropdown-1', hashid: 'cD1', label: 'Của con' },
      ] },
  ],
}];

test('genVariableArr: mọi node id+type trừ page, gồm container bố cục + field nhúng form con', () => {
  const va = formDef.genVariableArr(parentDef());
  assert.deepEqual(va.map(v => v.code), ['0000P_dropdown-1', '0000P_columns-1', '0000P_textField-1', '0000P_child_form-1', '0000C_dropdown-1']);
  assert.equal(va.find(v => v.code === '0000P_textField-1')?.variableName, '');   // label rỗng giữ nguyên (??)
  assert.equal(va.find(v => v.code === '0000P_columns-1')?.variableType, 'columns');
});

test('syncVariableArr: thêm biến thiếu, giữ biến form con, bỏ biến của chính form đã xoá node', () => {
  const existing = [
    { code: '0000P_dropdown-1', variableName: 'tên cũ', variableType: 'dropdown' },
    { code: '0000P_textField-9', variableName: 'đã xoá', variableType: 'textField' },
    { code: '0000X_lồng-sâu', variableName: 'biến form con lồng', variableType: 'textField' },
    { code: '0000P_dropdown-1', variableName: 'trùng', variableType: 'dropdown' },
  ];
  const out = formDef.syncVariableArr(existing, parentDef(), '0000P');
  const codes = out.map(v => v.code);
  assert.ok(!codes.includes('0000P_textField-9'));
  assert.ok(codes.includes('0000X_lồng-sâu'));
  assert.equal(codes.filter(c => c === '0000P_dropdown-1').length, 1);
  assert.equal(out[0].variableName, 'tên cũ');                       // entry cũ không bị sửa
  assert.ok(codes.includes('0000C_dropdown-1') && codes.includes('0000P_columns-1'));
});

test('buildOwnerFormPayload: tự đồng bộ variableArr (API không tự sinh như designer)', () => {
  const p = formDef.buildOwnerFormPayload({ formId: '0000P', variableArr: '[]' }, parentDef(), true);
  assert.equal(p.variableArr.length, 5);
});

test('findUniqueNode: key trùng cha/con → lỗi kèm hashid; hashid hoặc id đầy đủ → đúng node', () => {
  const def = parentDef();
  assert.throws(() => formDef.findUniqueNode(def, 'dropdown-1'), /khớp 2 node[\s\S]*pD1[\s\S]*cD1/);
  assert.equal(formDef.findUniqueNode(def, 'cD1').label, 'Của con');
  assert.equal(formDef.findUniqueNode(def, '0000P_dropdown-1').hashid, 'pD1');
  assert.equal(formDef.findUniqueNode(def, 'textField-1').hashid, 'pT1');
  assert.equal(formDef.findUniqueNode(def, 'khong-co'), null);
});

test('field findEntry: key trùng trong fields.json → bắt dùng hashid', () => {
  const doc = fields.buildDoc(parentDef(), '0000P');
  assert.throws(() => findEntry(doc, 'dropdown-1'), /pD1[\s\S]*cD1/);
  assert.equal(findEntry(doc, 'cD1')?.label, 'Của con');
});

/** fields.json + bản server + snapshot cho planFieldPush. */
function pushCase() {
  const server = parentDef();
  const doc = fields.buildDoc(parentDef(), '0000P');
  const base = fields.docHashes(doc);
  return { server, doc, base, find: formDef.fieldFinder(formDef.collectAllFields(server)) };
}

test('planFieldPush: chỉ đẩy field local đã sửa, giữ field server đổi mà local không đụng', () => {
  const { server, doc, base, find } = pushCase();
  /** @type {any} */ (doc.fields.find(f => f.hashid === 'pT1')).config.label = 'Sửa local';
  formDef.findNode(server, { hashid: 'pD1' }).label = 'Người khác sửa trên UI';
  const plan = planFieldPush(doc, find, base);
  assert.deepEqual(plan.changes.map(c => c.ref), ['textField-1']);
  assert.deepEqual(plan.serverOnly, ['dropdown-1']);
  assert.equal(formDef.findNode(server, { hashid: 'pD1' }).label, 'Người khác sửa trên UI');   // không bị ghi đè
  assert.equal(formDef.findNode(server, { hashid: 'pT1' }).label, 'Sửa local');
});

test('planFieldPush: cả local và server cùng sửa 1 field → xung đột', () => {
  const { server, doc, base, find } = pushCase();
  /** @type {any} */ (doc.fields.find(f => f.hashid === 'pT1')).config.label = 'local';
  formDef.findNode(server, { hashid: 'pT1' }).label = 'server';
  assert.deepEqual(planFieldPush(doc, find, base).conflicts, ['textField-1']);
});

test('planFieldPush: không có snapshot (--force) → đẩy toàn bộ khác biệt như cũ', () => {
  const { server, doc, find } = pushCase();
  formDef.findNode(server, { hashid: 'pD1' }).label = 'server';
  const plan = planFieldPush(doc, find, null);
  assert.deepEqual(plan.changes.map(c => c.ref), ['dropdown-1']);
  assert.equal(formDef.findNode(server, { hashid: 'pD1' }).label, 'Của cha');
});

test('planRefresh: giữ hashid + readonly bản nhúng, báo field sẽ mất + thuộc tính đổi', () => {
  const cur = [
    { type: 'textField', id: '0000C_textField-1', hashid: 'riengCha', readonly: true, value: 'OK' },
    { type: 'dropdown', id: '0000C_dropdown-6', hashid: 'd6', label: 'Chỉ còn ở cha' },
  ];
  const latest = [
    { type: 'textField', id: '0000C_textField-1', hashid: 'goc', readonly: false, value: '' },
    { type: 'textField', id: '0000C_textField-2', hashid: 'moi' },
  ];
  const plan = planRefresh(cur, latest);
  const t1 = plan.next.find((/** @type {any} */ n) => n.id === '0000C_textField-1');
  assert.equal(t1.hashid, 'riengCha');
  assert.equal(t1.readonly, true);
  assert.equal(t1.value, '');                                   // không --keep → theo form start, có báo
  assert.deepEqual(plan.removed, ['dropdown-6']);
  assert.ok(plan.diffs.includes('textField-1.value'));
  assert.equal(latest[0].hashid, 'goc');                        // không sửa bản gốc
  assert.equal(planRefresh(cur, latest, ['value']).next[0].value, 'OK');
});

test('pull assertOwnDir: không ghi đè thư mục đang khai formId khác / chưa rõ danh tính', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'kyta-pull-'));
  const dir = path.join(tmp, 'form');
  fs.mkdirSync(path.join(dir, 'code'), { recursive: true });
  assert.throws(() => assertOwnDir(dir, '0000NEW', false), /không khai formId/);
  fs.writeFileSync(path.join(dir, '.meta.json'), JSON.stringify({ formId: '0000CHA', targetFormId: '0000T' }));
  assert.throws(() => assertOwnDir(dir, '0000CON', false), /đang là form 0000T\/0000CHA/);
  assert.doesNotThrow(() => assertOwnDir(dir, '0000CHA', false));
  assert.doesNotThrow(() => assertOwnDir(dir, '0000T', false));
  assert.doesNotThrow(() => assertOwnDir(dir, '0000CON', true));
  assert.doesNotThrow(() => assertOwnDir(path.join(tmp, 'moi'), '0000CON', false));   // thư mục mới
  fs.rmSync(tmp, { recursive: true, force: true });
});

test('refHits: bắt key ngắn ref("type-N"), điều kiện, code form khác; không trúng "-10"', () => {
  const def = parentDef();
  const node = formDef.findNode(def, { hashid: 'pT1' });
  const hits = refHits(def, {
    own: { 'code/main.js': 'ref("textField-1"); ref("textField-10")', 'điều kiện': '{"fieldId":"pT1"}' },
    others: { 'luồng/form khác': 'getFieldValue("{{0000P_textField-1}}")', 'luồng/sạch': '{{0000P_textField-10}}' },
  }, node);
  assert.equal(hits.length, 3);
  assert.ok(hits.some(h => /key ngắn "textField-1"/.test(h)));
  assert.ok(hits.some(h => /^điều kiện .*pT1/.test(h)));
  assert.ok(hits.some(h => /form khác luồng\/form khác/.test(h)));
});

test('hash fields dùng chung: snapshot pull == hash config local (nền của push 3 chiều)', () => {
  const doc = fields.buildDoc(parentDef(), '0000P');
  const f = doc.fields[0];
  assert.equal(fields.docHashes(doc)[/** @type {string} */ (f.hashid)], hash(JSON.stringify(f.config)));
});

test('tree.metaIndex: formId phụ (cạnh targetFormId) không tranh chỗ với thư mục nhận id đó làm danh tính chính', () => {
  const tree = require('../src/eform/tree');
  const paths = require('../src/core/paths');
  const root = paths.moduleDir('__test_kyta__', 'sandbox', 'eform');
  const mk = (/** @type {string} */ name, /** @type {any} */ meta) => {
    fs.mkdirSync(path.join(root, name, 'code'), { recursive: true });
    fs.writeFileSync(path.join(root, name, '.meta.json'), JSON.stringify(meta));
  };
  try {
    mk('subform', { formId: '0000SUB' });
    mk('copy', { formId: '0000SUB', targetFormId: '0000COPY' });     // formId cũ = id subform
    mk('only-secondary', { formId: '0000OLD', targetFormId: '0000NEW' });
    const idx = tree.metaIndex('__test_kyta__', 'sandbox');
    assert.deepEqual(idx.get('0000SUB')?.map(d => path.basename(d)), ['subform']);
    assert.deepEqual(idx.get('0000COPY')?.map(d => path.basename(d)), ['copy']);
    assert.deepEqual(idx.get('0000OLD')?.map(d => path.basename(d)), ['only-secondary']);   // không ai nhận → vẫn tra được
  } finally { fs.rmSync(path.join(paths.WORKSPACE, '__test_kyta__'), { recursive: true, force: true }); }
});
