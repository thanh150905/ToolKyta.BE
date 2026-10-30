'use strict';
// Test phần dùng chung (core/) — không gọi mạng. Chạy: npm test
const test = require('node:test');
const assert = require('node:assert/strict');

const { parseArgs, splitList, usage, UsageError } = require('../src/core/args');
const { safeName, hash, metaDirs, metaDirOf } = require('../src/core/fsx');
const { pickOne, grep } = require('../src/core/pick');
const { toList, unwrap, idOf } = require('../src/core/http');
const config = require('../src/core/config');
const sync = require('../src/core/sync');

test('parseArgs: positional / cờ / option có giá trị (kể cả giá trị bắt đầu bằng --)', () => {
  const r = parseArgs(['saigoncoop', 'sandbox', '--all', '--group', 'Trên 500tr', '--limit', '--50'], { value: ['--group', '--limit'] });
  assert.deepEqual(r._, ['saigoncoop', 'sandbox']);
  assert.ok(r.flags.has('--all'));
  assert.equal(r.opts['--group'], 'Trên 500tr');
  assert.equal(r.opts['--limit'], '--50');
  assert.deepEqual(splitList(' a, b,,c '), ['a', 'b', 'c']);
  assert.throws(() => usage('x'), UsageError);
});

test('safeName / hash', () => {
  assert.equal(safeName('Trên 500tr/Đấu thầu'), 'Trên 500tr_Đấu thầu');
  assert.equal(safeName('a\\b'), 'a_b');
  assert.equal(hash('x'), hash('x'));
  assert.notEqual(hash('x'), hash('y'));
  assert.equal(hash(null), hash(''));
});

test('pickOne: id → tên chính xác → chứa chuỗi; mơ hồ / không thấy thì lỗi', () => {
  const items = [{ id: '1', name: 'Tờ trình' }, { id: '2', name: 'Tờ trình Update' }, { id: '3', name: 'Biên bản' }];
  const o = { what: 'form', id: (/** @type {any} */ x) => x.id, names: (/** @type {any} */ x) => [x.name], show: (/** @type {any} */ x) => x.name };
  assert.equal(pickOne(items, '3', o).id, '3');
  assert.equal(pickOne(items, 'tờ trình', o).id, '1');          // chính xác thắng "chứa"
  assert.equal(pickOne(items, 'update', o).id, '2');
  assert.throws(() => pickOne(items, 'không có', o), /Không thấy/);
  assert.throws(() => pickOne([{ id: 'a', name: 'X 1' }, { id: 'b', name: 'X 2' }], 'x', o), /khớp 2/);
  assert.deepEqual(grep(items, 'BIÊN', ['name']).map(x => x.id), ['3']);
});

test('toList / unwrap / idOf: chịu được mọi kiểu bọc response', () => {
  assert.deepEqual(toList([1]), [1]);
  assert.deepEqual(toList({ content: [1] }), [1]);
  assert.deepEqual(toList({ status: 1, data: { content: [2] } }), [2]);
  assert.deepEqual(toList({ result: [3] }), [3]);
  assert.deepEqual(toList(null), []);
  assert.deepEqual(unwrap({ data: { jsonForm: 'x' } }, 'jsonForm'), { jsonForm: 'x' });
  assert.deepEqual(unwrap({ jsonXml: null, id: 1 }, 'jsonXml'), { jsonXml: null, id: 1 });   // có key (dù null) thì giữ nguyên
  assert.equal(idOf({ data: { id: 'n' } }), 'n');
});

test('config.serviceHost: khai riêng customer > env > suy từ eform', () => {
  assert.equal(config.serviceHost('x', 'sandbox', 'eform'), 'https://eform.sandbox.kytaplatform.com');
  assert.equal(config.serviceHost('x', 'sandbox', 'eflow'), 'https://eflow.sandbox.kytaplatform.com');
  assert.equal(config.serviceHost('x', 'sandbox', 'account'), 'https://eaccount.sandbox.kytaplatform.com');
  assert.equal(config.serviceHost('sabeco', 'prod', 'eform'), 'https://eform.sabeco-app.vn');
  assert.equal(config.serviceHost('x', 'uat', 'eform'), null);
  assert.ok(config.envs().includes('prod'));
});

test('sync.patch + guardDrift: chỉ vá field đổi; chặn push đè thay đổi trên server', () => {
  /** @type {import('../src/core/sync').Spec} */
  const spec = { module: 'email', file: 'content.html', field: 'content', noun: 'mẫu' };
  const meta = { name: 'A', pulledHash: hash('v1') };
  const { next, changes } = sync.patch(spec, { content: 'v1', name: 'A', x: 1 }, 'v2', meta, ['name']);
  assert.equal(next.content, 'v2');
  assert.equal(next.x, 1);
  assert.equal(changes.length, 1);

  assert.doesNotThrow(() => sync.guardDrift(spec, { content: 'v1' }, 'v2', meta, false));        // chỉ local đổi → OK
  assert.throws(() => sync.guardDrift(spec, { content: 'v9' }, 'v1', meta, false), /pull/);      // chỉ server đổi
  assert.throws(() => sync.guardDrift(spec, { content: 'v9' }, 'v2', meta, false), /XUNG ĐỘT/);  // cả hai đổi
  assert.doesNotThrow(() => sync.guardDrift(spec, { content: 'v9' }, 'v2', meta, true));         // --force
});

test('metaDirs / metaDirOf: tìm tài nguyên trong thư mục nhóm, không đi sâu vào trong tài nguyên', () => {
  const fs = require('fs'), os = require('os'), path = require('path');
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'kyta-meta-'));
  const mk = (/** @type {string} */ rel) => { fs.mkdirSync(path.join(root, rel), { recursive: true }); fs.writeFileSync(path.join(root, rel, '.meta.json'), '{}'); };
  mk('flat'); mk('02-mua-sam/PO'); mk('02-mua-sam/PO/sub'); fs.mkdirSync(path.join(root, 'empty-group'));
  assert.deepEqual(metaDirs(root).map(d => path.relative(root, d)).sort(), ['02-mua-sam/PO', 'flat']);
  assert.equal(metaDirOf(path.join(root, '02-mua-sam/PO/flow.json'), root), path.join(root, '02-mua-sam/PO'));
  assert.equal(metaDirOf(path.join(root, 'empty-group/x.json'), root), null);
  fs.rmSync(root, { recursive: true, force: true });
});
