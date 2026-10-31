'use strict';
// Test logic eForm: vân tay formId, jsonForm, id đích push, so snapshot. Không gọi mạng.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const ids = require('../src/eform/formId');
const formDef = require('../src/eform/formDef');
const tree = require('../src/eform/tree');
const inspect = require('../src/eform/inspect');

test('extractIds / dominant: đếm {{0000xxx_...}} và chọn id nhiều nhất', () => {
  const c = ids.extractIds('{{0000abc_a-1}} {{0000abc_a-2}} {{0000xyz_b}}');
  assert.deepEqual(c, { '0000abc': 2, '0000xyz': 1 });
  assert.equal(ids.dominant(c).id, '0000abc');
  assert.equal(ids.dominant({}).id, null);
});

test('elementKeyOf: ưu tiên id "0000..._key", fallback tên đúng dạng', () => {
  assert.equal(ids.elementKeyOf({ id: '0000abc_input-2' }, 'input'), 'input-2');
  assert.equal(ids.elementKeyOf({ name: 'select-3' }, 'select'), 'select-3');
  assert.equal(ids.elementKeyOf({}, 'table'), null);
});

test('buildOwnerFormPayload: đúng 9 field, đúng kiểu', () => {
  const p = formDef.buildOwnerFormPayload({
    beginTime: '2024-01-15 00:00:00', endTime: '2024-12-31 10:00:00',
    formCode: 'FC', formName: 'FN', formId: '0000abc',
    tag: ['a', 'b'], variableArr: '[{"x":1}]', describeForm: null, thua: 'bị loại',
  }, { foo: 1 }, false);
  assert.deepEqual(Object.keys(p).sort(), ['beginTime', 'describeForm', 'endTime', 'formCode', 'formId', 'formName', 'jsonForm', 'tag', 'variableArr']);
  assert.equal(p.tag, 'a,b');
  assert.equal(p.variableArr[0].x, 1);
  assert.equal(p.beginTime, '2024/01/15');
  assert.equal(p.describeForm, '');
  const q = formDef.buildOwnerFormPayload({ formId: 'x' }, { a: 1 }, true);
  assert.equal(q.jsonForm, '{"a":1}');
  assert.equal(q.tag, '');
  assert.deepEqual(q.variableArr, []);
});

test('collectCustomFields + fieldLocator: tìm field theo hashid trong meta, fallback tên thư mục', () => {
  const def = { components: [
    { type: 'table', renderMode: 'custom_code', hashid: 'H1', id: '0000abc_table_advance-6', customRenderCode: { html: 'h' } },
    { type: 'table', renderMode: 'custom_code', hashid: 'H2', customRenderCode: { html: 'x' } },
    { type: 'input', renderMode: 'normal' },
  ] };
  const fields = formDef.collectCustomFields(def);
  assert.deepEqual(fields.map(f => f.dir), ['table_advance-6', 'table-2']);
  const find = formDef.fieldLocator(fields, { customUI: [{ dir: 'doi-ten', hashid: 'H1' }] });
  assert.equal(find('doi-ten')?.hashid, 'H1');       // thư mục đổi tên vẫn tìm được qua hashid
  assert.equal(find('table-2')?.hashid, 'H2');
  assert.equal(find('khong-co'), null);
});

test('collectCustomFields: field vỏ và field nhúng trùng key → thư mục riêng (hậu tố hashid)', () => {
  const def = { components: [
    { type: 'table_advance', renderMode: 'custom_code', hashid: 'A1', id: '0000own_table_advance-2' },
    { type: 'table_advance', renderMode: 'custom_code', hashid: 'B2', id: '0000sub_table_advance-2' },
    { type: 'table_advance', renderMode: 'custom_code', hashid: 'B2', id: '0000sub_table_advance-2' },
  ] };
  const fields = formDef.collectCustomFields(def);
  assert.deepEqual(fields.map(f => f.dir), ['table_advance-2', 'table_advance-2__B2', 'table_advance-2__B2~2']);
  const find = formDef.fieldLocator(fields, { customUI: fields.map(f => ({ dir: f.dir, hashid: f.hashid })) });
  assert.equal(find('table_advance-2__B2'), fields[1]);
  assert.equal(find('table_advance-2__B2~2'), fields[2]);    // cùng hashid → phân biệt theo thư mục
});

test('inspect.compare: changed / added / removed', () => {
  const r = inspect.compare({ 'a.js': '1', 'b.js': '2' }, { 'a.js': '9', 'c.js': '3' });
  assert.deepEqual(r, { changed: ['a.js'], added: ['c.js'], removed: ['b.js'] });
  assert.equal(inspect.isEmpty(inspect.compare({ x: '1' }, { x: '1' })), true);
});

/** Form tạm ngoài repo (tree.ids chỉ đọc code/ + .meta.json). */
function tmpForm(/** @type {Record<string, string>} */ files, /** @type {any} */ meta) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'kyta-test-'));
  for (const [f, c] of Object.entries(files)) { fs.mkdirSync(tree.codeDir(dir), { recursive: true }); fs.writeFileSync(path.join(tree.codeDir(dir), f), c); }
  if (meta) tree.writeMeta(dir, meta);
  return dir;
}

test('tree.ids: đích push (targetFormId > vân tay > meta) vs id thư mục (targetFormId > meta > vân tay)', () => {
  const code = { 'main.js': '"{{0000DOM_a-1}}" "{{0000DOM_a-2}}"' };
  const a = tmpForm(code, { formId: '0000META' });
  assert.deepEqual([tree.ids(a).target, tree.ids(a).identity], ['0000DOM', '0000META']);
  const b = tmpForm(code, { formId: '0000META', targetFormId: '0000T' });
  assert.deepEqual([tree.ids(b).target, tree.ids(b).identity], ['0000T', '0000T']);
  const c = tmpForm({ 'main.js': '// không có token' }, { formId: '0000META' });
  assert.equal(tree.ids(c).target, '0000META');
  const d = tmpForm(code, null);
  fs.writeFileSync(tree.metaPath(d), '{ hỏng');
  assert.equal(tree.metaBroken(d), true);
  [a, b, c, d].forEach(x => fs.rmSync(x, { recursive: true, force: true }));
});

test('inspect.LEVEL: sai env chặn commit, sai đích chỉ chặn push', () => {
  assert.equal(inspect.LEVEL.mismatch, 'error');
  assert.equal(inspect.LEVEL['meta-conflict'], 'block');
  assert.equal(inspect.LEVEL.ambiguous, 'warn');
  assert.equal(inspect.LEVEL.override, 'ok');
});
