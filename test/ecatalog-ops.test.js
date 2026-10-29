'use strict';
// Test các thao tác nhiều bước của eCatalog với API giả, không gọi mạng.
const test = require('node:test');
const assert = require('node:assert/strict');

const api = require('../src/ecatalog/api');
const ops = require('../src/ecatalog/ops');

const CAT = {
  id: 'cat-1', name: 'Nguồn', code: 'nguon',
  tableConfig: [{ key: 'a', active: true }, { key: 'b', active: false }],
  searchConfig: [{ key: 'a', active: false }, { key: 'b', active: true }],
  filterConfig: [{ key: 'a', active: true }, { key: 'b', active: true }],
};

/** @param {import('node:test').TestContext} t @param {Record<string, (...args: any[]) => any>} overrides */
function stubApi(t, overrides) {
  /** @type {Record<string, any>} */ const originals = {};
  for (const [key, fn] of Object.entries(overrides)) {
    originals[key] = /** @type {any} */ (api)[key];
    /** @type {any} */ (api)[key] = fn;
  }
  t.after(() => { for (const [key, fn] of Object.entries(originals)) /** @type {any} */ (api)[key] = fn; });
}

test('saveStruct: ghi struct đúng định dạng, khôi phục active còn tồn tại, bỏ field đã xóa', async t => {
  /** @type {any[]} */ const calls = [];
  /** @type {any} */ let current = null;
  let reads = 0;
  stubApi(t, {
    updateFields: async (_s, body) => { calls.push(['fields', body]); },
    category: async () => {
      reads++;
      if (reads === 1) return {
        id: CAT.id,
        tableConfig: [{ key: 'a', active: false }, { key: 'b', active: false }, { key: 'c', active: false }],
        searchConfig: [{ key: 'a', active: false }, { key: 'b', active: false }, { key: 'c', active: false }],
        filterConfig: [{ key: 'a', active: false }, { key: 'b', active: false }, { key: 'c', active: false }],
      };
      return current;
    },
    updateConfig: async (_s, body) => { calls.push(['config', body]); current = body; },
  });

  const newStruct = [{ id: 'a' }, { id: 'c' }];
  const result = await ops.saveStruct(/** @type {any} */ ({}), CAT, newStruct);
  assert.equal(calls[0][0], 'fields');
  assert.equal(calls[0][1].struct, JSON.stringify(newStruct));
  assert.deepEqual(calls[0][1].structTree, newStruct);
  assert.equal(calls[1][0], 'config');
  assert.deepEqual(calls[1][1].tableConfig.map((/** @type {any} */ x) => [x.key, x.active]), [['a', true], ['b', false], ['c', false]]);
  assert.deepEqual(calls[1][1].searchConfig.map((/** @type {any} */ x) => [x.key, x.active]), [['a', false], ['b', true], ['c', false]]);
  assert.deepEqual(calls[1][1].filterConfig.map((/** @type {any} */ x) => [x.key, x.active]), [['a', true], ['b', true], ['c', false]]);
  assert.equal(result, current);
});

test('saveStruct: không gọi updateConfig khi không có active cần khôi phục', async t => {
  let configWrites = 0;
  stubApi(t, {
    updateFields: async () => {},
    category: async () => ({ id: CAT.id, tableConfig: [{ key: 'a', active: false }], searchConfig: [], filterConfig: [] }),
    updateConfig: async () => { configWrites++; },
  });
  const result = await ops.saveStruct(/** @type {any} */ ({}), { ...CAT, tableConfig: [{ key: 'a', active: false }], searchConfig: [], filterConfig: [] }, []);
  assert.equal(result.id, CAT.id);
  assert.equal(configWrites, 0);
});

test('setConfigActive: chỉ nhóm chỉ định thay đổi active và đọc lại category', async t => {
  let sent = /** @type {any} */ (null);
  let reread = false;
  stubApi(t, {
    updateConfig: async (_s, body) => { sent = body; },
    category: async () => { reread = true; return { id: CAT.id }; },
  });
  const result = await ops.setConfigActive(/** @type {any} */ ({}), CAT, 'tableConfig', new Set(['b']));
  assert.deepEqual(sent.tableConfig.map((/** @type {any} */ x) => x.active), [false, true]);
  assert.deepEqual(sent.searchConfig, CAT.searchConfig);
  assert.equal(reread, true);
  assert.equal(result.id, CAT.id);
});

test('createCategory: mặc định description rỗng và status hoạt động', async t => {
  let sent = /** @type {any} */ (null);
  stubApi(t, {
    createCategory: async (_s, body) => { sent = body; return { id: 'new-id' }; },
    category: async (_s, id) => ({ id }),
  });
  const result = await ops.createCategory(/** @type {any} */ ({}), { name: 'Mới', code: 'moi' });
  assert.deepEqual(sent, { name: 'Mới', code: 'moi', description: '', status: 1 });
  assert.deepEqual(result, { id: 'new-id' });
});

test('cloneCategory: bỏ metadata server, giữ cấu hình và thay tên/mã', async t => {
  let sent = /** @type {any} */ (null);
  stubApi(t, {
    createCategory: async (_s, body) => { sent = body; return { id: 'copy-id' }; },
    category: async (_s, id) => ({ id }),
  });
  const src = { ...CAT, createdBy: 'u', createdDate: 'd', lastModifiedBy: 'v', lastModifiedDate: 'm', struct: '[]' };
  const result = await ops.cloneCategory(/** @type {any} */ ({}), src, { name: 'Bản sao', code: 'ban-sao' });
  assert.equal(sent.name, 'Bản sao');
  assert.equal(sent.code, 'ban-sao');
  assert.equal(sent.struct, '[]');
  for (const key of ['id', 'createdBy', 'createdDate', 'lastModifiedBy', 'lastModifiedDate']) assert.equal(key in sent, false);
  assert.deepEqual(result, { id: 'copy-id' });
});
