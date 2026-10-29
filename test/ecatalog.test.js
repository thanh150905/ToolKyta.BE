'use strict';
// Test logic eCatalog không gọi mạng: parse struct → field, lọc field nhập liệu, nhãn trạng thái, hash đồng bộ.
const test = require('node:test');
const assert = require('node:assert/strict');

const fields = require('../src/ecatalog/fields');
const status = require('../src/ecatalog/status');
const store = require('../src/ecatalog/store');
const http = require('../src/core/http');
const api = require('../src/ecatalog/api');

// Category mẫu: struct là CHUỖI JSON (như server trả), gồm 2 input + 1 block layout.
const CAT = {
  id: '6a218240be1f055f619113d8',
  name: 'Danh sách user',
  code: 'dsuser',
  status: 1,
  applicableStatus: 1,
  struct: JSON.stringify([
    { type: 'textField', id: 'textField_input-1', label: 'Họ và Tên', display: true, validate: { required: true, unique: false } },
    { type: 'textField', id: 'textField_email-7', label: 'Email', display: true, validate: { required: false, unique: true } },
    { type: 'text', id: 'text_text-1', label: 'Ghi chú tĩnh' },  // block layout → không phải field nhập liệu
  ]),
  tableConfig: [{ key: 'textField_input-1', name: 'Họ và Tên', active: true, type: 1 }],
};

test('parseStruct: chuỗi JSON → mảng field', () => {
  const s = fields.parseStruct(CAT);
  assert.equal(s.length, 3);
  assert.equal(s[0].id, 'textField_input-1');
  assert.deepEqual(fields.parseStruct({ struct: null }), []);
  assert.deepEqual(fields.parseStruct({ struct: '{bad json' }), []);
});

test('fieldSummary: tóm tắt id/type/label/required/unique', () => {
  const sum = fields.fieldSummary(CAT);
  assert.deepEqual(sum.map(f => f.id), ['textField_input-1', 'textField_email-7', 'text_text-1']);
  assert.equal(sum[0].required, true);
  assert.equal(sum[1].unique, true);
  assert.equal(sum[0].label, 'Họ và Tên');
});

test('inputFields: loại block layout, giữ field nhập liệu', () => {
  const inp = fields.inputFields(CAT);
  assert.deepEqual(inp.map(f => f.id), ['textField_input-1', 'textField_email-7']);  // 'text' bị loại
});

test('status: nhãn hai trục', () => {
  assert.equal(status.statusLabel(1), 'hoạt động');
  assert.equal(status.applicableLabel(1), 'áp dụng');
  assert.equal(status.applicableLabel(0), 'chưa áp dụng');
  assert.equal(status.statusLabel(9), '9');  // không map → in số
});

test('makeField: dựng field đúng schema, validate theo cờ', () => {
  const f = fields.makeField('Số điện thoại', { id: 'textField_sdt-3', required: true, unique: true });
  assert.equal(f.type, 'textField');
  assert.equal(f.id, 'textField_sdt-3');
  assert.equal(f.label, 'Số điện thoại');
  assert.equal(f.validate.required, true);
  assert.equal(f.validate.unique, true);
  assert.equal(f.renderMode, 'builtin');
  assert.equal(f.customRenderCode.version, 1);
});

test('nextFieldId: id duy nhất, hậu tố tăng, slug bỏ dấu', () => {
  const struct = fields.parseStruct(CAT);  // input-1, email-7, text-1
  const id = fields.nextFieldId(struct, 'textField', 'Phòng Ban');
  assert.match(id, /^textField_phongban-\d+$/);
  assert.equal(id.endsWith('-8'), true);   // max hậu tố = 7 → 8
  assert.equal(struct.some(f => f.id === id), false);
});

test('slugify: bỏ dấu tiếng Việt, chữ thường, [a-z0-9]', () => {
  assert.equal(fields.slugify('Đơn Vị Công Tác'), 'donvicongtac');
  assert.equal(fields.slugify(''), 'input');
});

test('applyActive: bật đúng tập key, còn lại false', () => {
  const arr = [{ key: 'a', active: false }, { key: 'b', active: true }, { key: 'c', active: false }];
  const out = fields.applyActive(arr, new Set(['a', 'c']));
  assert.deepEqual(out.map(x => x.key + ':' + x.active), ['a:true', 'b:false', 'c:true']);
  assert.deepEqual(fields.activeMap(arr), { a: false, b: true, c: false });
});

test('api.deleteRecords: dựng URL xoá nhiều (ids lặp, encode)', () => {
  let cap = { m: '', p: '' };
  const orig = http.request;
  http.request = (_s, m, p) => { cap = { m, p }; return Promise.resolve(null); };
  try {
    api.deleteRecords(/** @type {any} */ ({}), ['a1', 'b2', 'c3']);
    assert.equal(cap.m, 'DELETE');
    assert.equal(cap.p, '/services/ecategory/api/data/field-data/list?ids=a1&ids=b2&ids=c3');
  } finally { http.request = orig; }
});

test('API eCatalog: đúng method/path/body cho đọc và CRUD category/data', async () => {
  /** @type {any[]} */ const calls = [];
  const orig = http.request;
  http.request = (_s, method, path, options) => {
    calls.push({ method, path, options });
    if (path.endsWith('/categories?page=0&size=1000&search=&sort=status,desc&sort=created_date,desc')) return Promise.resolve([{ id: 'c1' }]);
    if (path.endsWith('/data/c%2F1?page=0&size=1000&search=&sort=created_date,desc')) return Promise.resolve([{ id: 'r1' }]);
    return Promise.resolve({ id: 'ok' });
  };
  try {
    const sess = /** @type {any} */ ({});
    assert.deepEqual(await api.listCategories(sess), [{ id: 'c1' }]);
    assert.deepEqual(await api.listData(sess, 'c/1'), [{ id: 'r1' }]);
    await api.category(sess, 'c/1');
    await api.updateFields(sess, { struct: '[]' });
    await api.updateConfig(sess, { name: 'x' });
    await api.createCategory(sess, { name: 'x' });
    await api.deleteCategory(sess, 'c/1');
    await api.createRecord(sess, { categoryId: 'c1' });
    await api.updateRecord(sess, { id: 'r1' });
    await api.deleteRecord(sess, 'r/1');
    assert.deepEqual(calls.map(({ method, path }) => [method, path]), [
      ['GET', '/services/ecategory/api/categories?page=0&size=1000&search=&sort=status,desc&sort=created_date,desc'],
      ['GET', '/services/ecategory/api/data/c%2F1?page=0&size=1000&search=&sort=created_date,desc'],
      ['GET', '/services/ecategory/api/categories/c%2F1'],
      ['PUT', '/services/ecategory/api/categories/edit'],
      ['PUT', '/services/ecategory/api/categories'],
      ['POST', '/services/ecategory/api/categories'],
      ['DELETE', '/services/ecategory/api/categories/c%2F1'],
      ['POST', '/services/ecategory/api/data/field-data'],
      ['PUT', '/services/ecategory/api/data/field-data'],
      ['DELETE', '/services/ecategory/api/data/field-data/r%2F1'],
    ]);
    assert.deepEqual(calls[3].options, { json: { struct: '[]' } });
    assert.deepEqual(calls[7].options, { json: { categoryId: 'c1' } });
  } finally { http.request = orig; }
});

test('API list: response mảng hoặc wrapper đều quy về danh sách', async () => {
  const orig = http.request;
  /** @type {any} */ let response = { content: [{ id: 'wrapped' }] };
  http.request = () => Promise.resolve(response);
  try {
    assert.deepEqual(await api.listCategories(/** @type {any} */ ({})), [{ id: 'wrapped' }]);
    response = [{ id: 'array' }];
    assert.deepEqual(await api.listData(/** @type {any} */ ({}), 'cat'), [{ id: 'array' }]);
  } finally { http.request = orig; }
});

test('store.syncHash: đổi cấu hình thì hash đổi, ổn định khi không đổi', () => {
  const h0 = store.syncHash(CAT);
  assert.equal(store.syncHash({ ...CAT }), h0);                                  // ổn định
  assert.notEqual(store.syncHash({ ...CAT, name: 'Khác' }), h0);                 // đổi name
  assert.notEqual(store.syncHash({ ...CAT, applicableStatus: 0 }), h0);          // đổi áp dụng
  assert.notEqual(store.syncHash({ ...CAT, tableConfig: [] }), h0);             // đổi cấu hình bảng
  assert.equal(store.syncHash({ ...CAT, structTree: [{ x: 1 }] }), h0);          // structTree không tính vào hash
});
