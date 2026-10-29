'use strict';
// Đồ thị workspace (where), khối lib, lint token, propagate (planRefresh + overrides), runtime giả lập.
const test = require('node:test');
const assert = require('node:assert/strict');

const graph = require('../src/graph');
const blocks = require('../src/eform/blocks');
const { planRefresh } = require('../src/eform/commands/childform');
const { blockState } = require('../src/eform/commands/lib');
const { createRuntime, norm } = require('../src/eform/runtime');

test('graph.tokenRx: biên hai phía; prefix cho phép "<formId>_key"', () => {
  assert.equal('{{0000A_textField-1}} {{0000A_textField-10}}'.match(graph.tokenRx('0000A_textField-1'))?.length, 1);
  assert.equal('x.0000A_k-1'.match(graph.tokenRx('0000A'))?.length ?? 0, 0);
  assert.equal('x.0000A_k-1'.match(graph.tokenRx('0000A', true))?.length, 1);
  assert.equal('0000AB_k'.match(graph.tokenRx('0000A', true))?.length ?? 0, 0);
});

test('blocks.parse: tách khối, @params, marker thiếu đóng', () => {
  const text = [
    'var a = 1;',
    '// ===== [TICKET] mô tả @params {"P":"CUOIDA","N":2}',
    'var x = "{{@P}}";',
    '// ===== [/TICKET] =====',
    '// ===== [HONG]',
    'var y;',
  ].join('\n');
  const { blocks: bs, broken } = blocks.parse(text);
  assert.equal(bs.length, 1);
  assert.equal(bs[0].name, 'TICKET');
  assert.deepEqual(bs[0].params, { P: 'CUOIDA', N: 2 });
  assert.equal(bs[0].body, 'var x = "{{@P}}";\n');
  assert.deepEqual(broken, ['HONG']);
});

test('blocks.render + replaceBody: thay tham số, thiếu tham số → lỗi, chỉ đổi thân khối', () => {
  const lib = 'var p = "{{@P}}"; var n = {{@N}};\n';
  assert.equal(blocks.render(lib, { P: 'X', N: 3 }), 'var p = "X"; var n = 3;\n');
  assert.throws(() => blocks.render(lib, { P: 'X' }), /thiếu @params: N/);
  const text = 'a\n// ===== [B]\nold\n// ===== [/B]\nz\n';
  const b = blocks.parse(text).blocks[0];
  assert.equal(blocks.replaceBody(text, b, 'new\n'), 'a\n// ===== [B]\nnew\n// ===== [/B]\nz\n');
});

test('lib blockState: ok / drift / error / no-lib', () => {
  const b = blocks.parse('// ===== [B] @params {"P":"1"}\nvar p = "1";\n// ===== [/B]\n').blocks[0];
  assert.equal(blockState('var p = "{{@P}}";\n', b).state, 'ok');
  assert.equal(blockState('var p = "{{@P}}"; // mới\n', b).state, 'drift');
  assert.equal(blockState('{{@Q}}', b).state, 'error');
  assert.equal(blockState(null, b).state, 'no-lib');
});

test('planRefresh + overrides: set ép giá trị theo id, keep giữ thuộc tính, báo set trỏ field mất', () => {
  const cur = [{ type: 'textField', id: '0000C_SAPtrave-1', hashid: 'h', value: 'OK' }];
  const latest = [{ type: 'textField', id: '0000C_SAPtrave-1', hashid: 'h', value: '' }];
  const p = planRefresh(cur, latest, [], { '0000C_SAPtrave-1': { value: 'OK' }, '0000C_mat-1': { value: 1 } });
  assert.equal(p.next[0].value, 'OK');
  assert.ok(p.kept.some(k => /override/.test(k)));
  assert.ok(!p.diffs.includes('SAPtrave-1.value'));      // đã override thì không báo "sẽ đổi"
  assert.deepEqual(p.missingSet, ['0000C_mat-1']);
});

/** Runtime với 2 field và code gán ticket name khi đổi dự án. */
function rtCase(/** @type {string} */ code, /** @type {any} */ fixture = {}, cascade = false) {
  return createRuntime({
    formId: '0000F',
    fields: [
      { key: 'dropdown-1', id: '0000F_dropdown-1', hashid: 'a', type: 'dropdown', label: '', config: { value: 'MD' } },
      { key: 'textField-1', id: '0000F_textField-1', hashid: 'b', type: 'textField', label: '', config: { value: '' } },
    ],
    code: [{ file: 'code/main.js', text: code }],
    fixture, cascade,
  });
}

test('runtime: bindFieldChangeEvent + changeFieldValue + timer ảo + giá trị mặc định từ fields.json', async () => {
  const rt = rtCase(`
    var P = "{{0000F_dropdown-1}}", T = "{{0000F_textField-1}}";
    bindFieldChangeEvent(P, function (v) { setTimeout(function () { changeFieldValue(T, "TK " + getFieldValue(P)); }, 500); });
    setTimeout(function () { changeFieldValue(T, "init " + getFieldValue(P)); }, 100);
  `);
  await rt.load();
  await rt.advance(200);
  await rt.step({ change: 'dropdown-1', value: 'DA1' });
  await rt.advance(1000);
  const sets = rt.trace.filter(r => r.op === 'changeFieldValue');
  assert.deepEqual(sets.map(r => [r.t, r.value]), [[100, 'init MD'], [700, 'TK DA1']]);
  assert.equal(rt.changed()['textField-1'], 'TK DA1');
});

test('runtime: lỗi code và fetch không có fixture được ghi vào trace, không văng', async () => {
  const rt = rtCase(`
    fetch("/api/x").then(function (r) { return r.json(); }).then(function (j) { changeFieldValue("{{0000F_textField-1}}", j.v); });
    fetch("/khong-co").catch(function (e) { showToast(e.message, "error"); });
    undefinedFn();
  `, { fetch: { '/api/x': { json: { v: 42 } } } });
  await rt.load();
  await rt.advance(0);
  assert.ok(rt.trace.some(r => r.op === 'error' && /undefinedFn/.test(String(r.detail))));
  assert.ok(rt.trace.some(r => r.op === 'showToast' && /không có trong fixture/.test(String(r.value))));
  assert.equal(rt.changed()['textField-1'], 42);
});

test('runtime: cascade quyết định changeFieldValue bằng code có bắn change event', async () => {
  const code = `
    bindFieldChangeEvent("{{0000F_textField-1}}", function () { changeFieldValue("{{0000F_dropdown-1}}", "cascaded"); });
    changeFieldValue("{{0000F_textField-1}}", "x");`;
  const off = rtCase(code); await off.load();
  const on = rtCase(code, {}, true); await on.load();
  assert.equal(off.changed()['dropdown-1'], undefined);
  assert.equal(on.changed()['dropdown-1'], 'cascaded');
  assert.equal(norm('{{ 0000F_a-1 }}'), '0000F_a-1');
});

// ---- Điều kiện ẩn/hiện nhúng (childFormConfig.childFormCondition_value) khi refresh / propagate ----
const { planCondition, applyRefresh, startFromForm, parseRules } = require('../src/eform/commands/childform');

const RULE = { conditionId: 'c1', enable: true, fieldId: '0000C_dropdown-1', operator: 'equal', value: 'X', typeValue: '1',
  action: [{ type: 'hide', fieldIds: ['0000C_textField-2'] }] };
/** Bản GET form start: jsonForm có lớp page + jsonFormCondition dạng chuỗi như server trả. */
const startForm = (/** @type {any} */ jfc) => ({
  formId: '0000C',
  jsonForm: JSON.stringify([{ type: 'page', components: [{ type: 'dropdown', id: '0000C_dropdown-1', hashid: 'h1' }] }]),
  ...(jfc === undefined ? {} : { jsonFormCondition: jfc }),
});

test('startFromForm: bóc page, giữ chuỗi điều kiện gốc; thiếu/hỏng jsonFormCondition → rules null', () => {
  const raw = JSON.stringify([RULE]);
  const s = startFromForm(startForm(raw));
  assert.equal(s.components[0].id, '0000C_dropdown-1');
  assert.deepEqual(s.rules, [RULE]);
  assert.equal(s.raw, raw);
  assert.equal(startFromForm(startForm(undefined)).rules, null);
  assert.equal(startFromForm(startForm('{hỏng')).rules, null);
  assert.deepEqual(startFromForm(startForm(null)).rules, []);
  assert.equal(startFromForm(startForm([RULE])).raw, JSON.stringify([RULE]));   // server trả mảng → dựng chuỗi
  assert.deepEqual(parseRules(''), []);
});

test('planCondition: form start đổi điều kiện → ghi chuỗi gốc của form start', () => {
  const cf = { type: 'child_form', childFormConfig: { childFormId: '0000C', childFormCondition_value: '[]' } };
  const s = startFromForm(startForm(JSON.stringify([RULE])));
  const c = planCondition(cf, s);
  assert.equal(c.change, true);
  assert.equal(c.next, s.raw);
  assert.deepEqual([c.before, c.after], [0, 1]);
});

test('planCondition: cùng nội dung khác định dạng chuỗi → không ghi lại', () => {
  const pretty = JSON.stringify([RULE], null, 1);          // bản nhúng lưu kiểu khác (có xuống dòng/khoảng trắng)
  const cf = { childFormConfig: { childFormId: '0000C', childFormCondition_value: pretty } };
  assert.equal(planCondition(cf, startFromForm(startForm(JSON.stringify([RULE])))).change, false);
});

test('planCondition: keepCondition / form start không trả điều kiện → giữ bản nhúng; bản nhúng hỏng → ghi', () => {
  const cf = { childFormConfig: { childFormId: '0000C', childFormCondition_value: '[{"conditionId":"rieng"}]' } };
  const s = startFromForm(startForm(JSON.stringify([RULE])));
  const kept = planCondition(cf, s, true);
  assert.equal(kept.change, false);
  assert.match(String(kept.note), /keepCondition/);
  const unknown = planCondition(cf, startFromForm(startForm(undefined)));
  assert.equal(unknown.change, false);
  assert.match(String(unknown.note), /không trả jsonFormCondition/);
  const broken = planCondition({ childFormConfig: { childFormCondition_value: '{hỏng' } }, s);
  assert.equal(broken.change, true);
  assert.equal(broken.before, null);
});

test('applyRefresh: thay components + điều kiện, giữ các khoá khác của childFormConfig', () => {
  const cf = { components: [{ id: 'cũ' }], childFormConfig: { childFormId: '0000C', tempComponent_value: [], childFormCondition_value: '[]' } };
  applyRefresh(cf, { next: [{ id: 'mới' }] }, { change: true, next: JSON.stringify([RULE]) });
  assert.deepEqual(cf.components, [{ id: 'mới' }]);
  assert.equal(cf.childFormConfig.childFormId, '0000C');
  assert.deepEqual(cf.childFormConfig.tempComponent_value, []);
  assert.deepEqual(JSON.parse(cf.childFormConfig.childFormCondition_value), [RULE]);
  applyRefresh(cf, { next: [] }, { change: false, next: null });
  assert.deepEqual(JSON.parse(cf.childFormConfig.childFormCondition_value), [RULE]);   // không đổi khi change=false
});
