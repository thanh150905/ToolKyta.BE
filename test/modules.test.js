'use strict';
// Test logic eFlow + Email không gọi mạng: đồ thị node, tra field, đổi link portal.
const test = require('node:test');
const assert = require('node:assert/strict');

const modeler = require('../src/eflow/modeler');
const { formFields, findField } = require('../src/eflow/lookup');
const { rewritePortal } = require('../src/email/template');

/** @returns {import('../src/eflow/modeler').Loaded} */
const loaded = () => ({
  id: 'M', name: 'QT', keyValue: 'qt', custId: 1, orgIn: null, processId: 'P',
  nodes: [
    { rid: 'n1', name: 'Soạn thảo', stencil: 'CallActivity' },
    { rid: 'f1', name: '', stencil: 'SequenceFlow' },
    { rid: 'g1', name: 'Soạn thảo', stencil: 'ExclusiveGateway' },
    { rid: 'e1', name: 'Gửi mail', stencil: 'eNotify' },
  ],
  succ: { n1: ['g1'], g1: ['e1'], e1: [] },
});

test('findNode: trùng tên thì ưu tiên node tác vụ; không thấy thì lỗi', () => {
  assert.equal(modeler.findNode(loaded(), 'soạn thảo').rid, 'n1');
  assert.equal(modeler.findNode(loaded(), 'e1').rid, 'e1');
  assert.throws(() => modeler.findNode(loaded(), 'không có'), /Không thấy node/);
});

test('findAfter: lần theo dây tới eNotify gần nhất', () => {
  assert.equal(modeler.findAfter(loaded(), 'Soạn thảo').rid, 'e1');
  assert.throws(() => modeler.findAfter(loaded(), 'Gửi mail'), /Không thấy node eNotify/);
});

test('formFields / findField: duyệt cột + hàng lồng nhau', () => {
  const form = { formName: 'F', formCode: 'FC', jsonForm: JSON.stringify([{ components: [
    { id: 'a', type: 'text', label: 'Họ tên', hashid: 'h1' },
    { type: 'columns', columns: [{ components: [{ id: 'b', type: 'email', label: 'Email người ký', hashid: 'h2' }] }] },
  ] }]) };
  assert.deepEqual(formFields(form).map(f => f.id), ['a', 'b']);
  assert.equal(findField(form, 'email').hashid, 'h2');
});

test('rewritePortal: đổi mọi domain erequest + IP hardcode, giữ path/biến', () => {
  const src = 'https://erequest.kyta.fpt.com/ticket/${ticketId} http://10.14.121.10/x http://erequest-uat.abc.vn/y';
  const r = rewritePortal(src, 'https://erequest.sandbox.kytaplatform.com');
  assert.equal(r.n, 3);
  assert.equal(r.content, 'https://erequest.sandbox.kytaplatform.com/ticket/${ticketId} https://erequest.sandbox.kytaplatform.com/x https://erequest.sandbox.kytaplatform.com/y');
  assert.equal(rewritePortal(src, null).n, 0);
});
