'use strict';
// Test logic eWriter không gọi mạng: dựng biến từ jsonForm, parse trạng thái,
// đọc field code trong .docx (zip tự dựng), hash đồng bộ.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

const fields = require('../src/ewriter/fields');
const { parseStatus, STATUS_LABEL } = require('../src/ewriter/status');
const docx = require('../src/ewriter/docx');
const store = require('../src/ewriter/store');

test('variablesFromForm: dựng biến từ jsonForm, bỏ node layout, map kiểu', () => {
  const FID = '000071abcDEF';
  const form = { formId: FID, jsonForm: JSON.stringify([{ components: [
    { id: `${FID}_textField-1`, type: 'textField', label: 'Số tiền' },
    { type: 'row', components: [{ id: `${FID}_check_box-2`, type: 'check_box', label: 'Đồng ý' }] },
    { id: `${FID}_table_advance-3`, type: 'table_advance', label: 'Bảng' },
    { id: `${FID}_container-9`, type: 'container', label: 'Khối' },   // layout → bỏ
    { type: 'label', label: 'Tiêu đề' },                             // không phải field → bỏ
  ] }]) };
  const vars = fields.variablesFromForm(form);
  assert.deepEqual(vars.map(v => v.fieldId), [`${FID}_textField-1`, `${FID}_check_box-2`, `${FID}_table_advance-3`]);
  assert.deepEqual(vars.map(v => v.variableType), ['string', 'check_box', 'table']);
  assert.equal(vars[0].resourceId, FID);
  assert.match(vars[0].variableName, /^Số tiền \([a-z0-9]{9}\)$/);
  assert.equal(vars[0].apply, true);
  assert.equal(vars[0].id, null);
});

test('genCode: 9 ký tự [a-z0-9]', () => {
  assert.match(fields.genCode(), /^[a-z0-9]{9}$/);
});

test('parseStatus: tên/số → mã; sai → null', () => {
  assert.equal(parseStatus('nháp'), 0);
  assert.equal(parseStatus('sẵn sàng'), 1);
  assert.equal(parseStatus('final'), 2);
  assert.equal(parseStatus('2'), 2);
  assert.equal(parseStatus('linh tinh'), null);
  assert.equal(STATUS_LABEL[1], 'sẵn sàng');
});

test('docx.analyze: đọc MERGEFIELD/IF/bookmark trong .docx (zip stored)', () => {
  const xml = '<w:document><w:body>'
    + '<w:r><w:instrText> MERGEFIELD "Họ tên (abc123xyz)" </w:instrText></w:r>'
    + '<w:r><w:instrText> IF "{MERGEFIELD "table2"}" = 2 "a" "b" </w:instrText></w:r>'
    + '<w:bookmarkStart w:id="1" w:name="xuong_dong"/>'
    + '<w:bookmarkStart w:id="2" w:name="_GoBack"/>'
    + '</w:body></w:document>';
  const fp = path.join(os.tmpdir(), `ewriter-test-${process.pid}.docx`);
  fs.writeFileSync(fp, buildStoredZip('word/document.xml', xml));
  try {
    const r = docx.analyze(fp);
    assert.ok(r.mergefields.includes('Họ tên (abc123xyz)'));
    assert.ok(r.mergefields.includes('table2'));
    assert.ok(r.ifCount >= 1);
    assert.deepEqual(r.bookmarks, ['xuong_dong']);   // _GoBack bị loại
  } finally { fs.unlinkSync(fp); }
});

test('store.syncHash: đổi status hoặc biến thì hash đổi', () => {
  const doc = { name: 'A', status: 1, jsonData: '[]' };
  const v1 = [{ fieldId: 'F_a-1', code: 'c1', variableType: 'string' }];
  const h0 = store.syncHash(doc, v1);
  assert.equal(store.syncHash(doc, v1), h0);                              // ổn định
  assert.notEqual(store.syncHash({ ...doc, status: 2 }, v1), h0);         // đổi status
  assert.notEqual(store.syncHash(doc, [...v1, { fieldId: 'F_b-2', code: 'c2', variableType: 'string' }]), h0); // thêm biến
});

// ---- docx: zip / layout / field code / chèn / comment ----

const W = (/** @type {string} */ body) => `<w:document><w:body>${body}<w:sectPr><w:pgSz w:w="11906"/><w:pgMar w:left="1000" w:right="906"/></w:sectPr></w:body></w:document>`;
const RPR = '<w:rPr><w:rFonts w:ascii="Times New Roman"/></w:rPr>';

test('docx zip: writeZip → readZip giữ nội dung + thứ tự, [Content_Types].xml đứng đầu', () => {
  const entries = [
    { name: 'word/document.xml', data: Buffer.from(W('<w:p><w:r><w:t>Xin chào ữ</w:t></w:r></w:p>')) },
    { name: '[Content_Types].xml', data: Buffer.from('<Types/>') },
  ];
  const back = docx.readZip(docx.writeZip(entries));
  assert.deepEqual(back.map(e => e.name), ['[Content_Types].xml', 'word/document.xml']);
  assert.equal(back[1].data.toString('utf8'), entries[0].data.toString('utf8'));
  assert.equal(docx.crc32(Buffer.from('123456789')), 0xcbf43926);
});

test('docx pretty/compact: mỗi đoạn/bảng/dòng/ô 1 dòng, gộp lại y nguyên (kể cả thụt lề thêm tay)', () => {
  const xml = W('<w:p><w:pPr/><w:r><w:t> </w:t></w:r></w:p><w:tbl><w:tblPr/><w:tr><w:trPr/><w:tc><w:p/></w:tc></w:tr></w:tbl>');
  const p = docx.pretty(xml);
  assert.ok(p.split('\n').length >= 6);
  assert.equal(docx.compact(p), xml);
  assert.equal(docx.compact(p.replace(/\n/g, '\n    ')), xml);
  assert.equal(docx.pretty(p), p);                                           // idempotent
});

test('docx scanFields: instrText bị cắt nhiều run + IF lồng MERGEFIELD', () => {
  const xml = W('<w:p>'
    + '<w:r><w:fldChar w:fldCharType="begin"/></w:r><w:r><w:instrText>MERGEFIELD "Họ </w:instrText></w:r>'
    + '<w:r><w:instrText>tên (abc123xyz)"</w:instrText></w:r><w:r><w:fldChar w:fldCharType="separate"/></w:r><w:r><w:fldChar w:fldCharType="end"/></w:r>'
    + '<w:r><w:fldChar w:fldCharType="begin"/></w:r><w:r><w:instrText>IF "</w:instrText></w:r>'
    + '<w:r><w:fldChar w:fldCharType="begin"/></w:r><w:r><w:instrText>MERGEFIELD "Loại (q1w2e3r4t)"</w:instrText></w:r><w:r><w:fldChar w:fldCharType="end"/></w:r>'
    + '<w:r><w:instrText>" = "A" "x" "y"</w:instrText></w:r><w:r><w:fldChar w:fldCharType="end"/></w:r>'
    + '</w:p>');
  const a = docx.analyzeXml(xml);
  assert.deepEqual(a.mergefields.sort(), ['Họ tên (abc123xyz)', 'Loại (q1w2e3r4t)']);
  assert.equal(a.ifCount, 1);
  assert.deepEqual(docx.splitName('Trưởng phòng (Ký xác nhận) (zz9)'), { label: 'Trưởng phòng (Ký xác nhận)', hashid: 'zz9' });
  assert.equal(docx.splitName('col_3'), null);

  const r = docx.renamePlaceholders(xml, { 'Họ tên (abc123xyz)': 'Họ và tên (abc123xyz)' });
  assert.equal(r.count, 1);
  assert.deepEqual(docx.analyzeXml(r.xml).mergefields.sort(), ['Họ và tên (abc123xyz)', 'Loại (q1w2e3r4t)']);
});

test('docx insertAfterText: tách run tại cuối chữ neo (neo vắt 2 run), giữ rPr', () => {
  const xml = W(`<w:p><w:r>${RPR}<w:t xml:space="preserve">Ngày </w:t></w:r><w:r>${RPR}<w:t>lập: xx</w:t></w:r></w:p>`);
  const out = docx.insertAfterText(xml, 'Ngày lập: ', rPr => docx.mergefield('Ngày lập (k8nrwgxv7)', rPr));
  assert.equal(docx.textOf(out), 'Ngày lập: xx');
  assert.deepEqual(docx.analyzeXml(out).mergefields, ['Ngày lập (k8nrwgxv7)']);
  assert.ok(out.indexOf('MERGEFIELD') > out.indexOf('lập: ') && out.indexOf('MERGEFIELD') < out.lastIndexOf('xx'));
  assert.ok(out.includes(`<w:r>${RPR}<w:instrText`));
  assert.throws(() => docx.insertAfterText(xml, 'không có', () => ''), /Không thấy chữ neo/);
});

test('docx tableXml + insertAfterParagraph + tableColumns', () => {
  const xml = W(`<w:p><w:r>${RPR}<w:t>Chi tiết:</w:t></w:r></w:p>`);
  const cols = [{ title: 'STT', width: 500 }, { title: 'Tên', width: 3000 }, { title: 'SL', width: 800 }];
  const out = docx.insertAfterParagraph(xml, 'Chi tiết:', rPr => docx.tableXml({ name: 'Bảng (h1)', columns: cols, rPr }));
  assert.ok(/<\/w:tbl><w:p\/><w:sectPr/.test(out));                        // bảng cuối thân → thêm đoạn trống
  assert.equal(docx.tableColumns(out, 'Bảng (h1)'), 3);
  assert.deepEqual(docx.analyzeXml(out).docvariables, ['Bảng (h1)']);
  assert.equal(docx.textWidth(out), 11906 - 1000 - 906);
});

test('docx stripComments: gỡ range/reference/part/rels/override', () => {
  const entries = [
    { name: '[Content_Types].xml', data: Buffer.from('<Types><Override PartName="/word/comments.xml" ContentType="x"/><Override PartName="/word/document.xml" ContentType="y"/></Types>') },
    { name: 'word/document.xml', data: Buffer.from(W('<w:p><w:commentRangeStart w:id="0"/><w:r><w:t>A</w:t></w:r><w:commentRangeEnd w:id="0"/><w:r><w:rPr/><w:commentReference w:id="0"/></w:r></w:p>')) },
    { name: 'word/comments.xml', data: Buffer.from('<w:comments/>') },
    { name: 'word/_rels/document.xml.rels', data: Buffer.from('<Relationships><Relationship Id="r1" Target="comments.xml"/><Relationship Id="r2" Target="styles.xml"/></Relationships>') },
  ];
  const { entries: out, removed } = docx.stripComments(entries);
  assert.equal(removed, 1);
  const get = (/** @type {string} */ n) => out.find(e => e.name === n)?.data.toString('utf8') || '';
  assert.ok(!out.some(e => e.name === 'word/comments.xml'));
  assert.ok(!/comment/i.test(get('word/document.xml')));
  assert.ok(!get('word/_rels/document.xml.rels').includes('comments.xml') && get('word/_rels/document.xml.rels').includes('styles.xml'));
  assert.ok(!get('[Content_Types].xml').includes('comments'));
});

test('docx check (compare): khớp / sai nhãn / sai hashid / không có / bảng lệch cột / chữ ký', () => {
  const { compare } = require('../src/ewriter/commands/docx');
  const f = (/** @type {any} */ o) => ({ key: null, formId: 'F', columns: [], ...o });
  const fields = [
    f({ label: 'Mã dự án', hashid: 'aaa', type: 'dropdown' }),
    f({ label: 'Ngày lập', hashid: 'bbb', type: 'datepicker' }),
    f({ label: 'Ghi chú', hashid: 'ccc', type: 'textArea' }),
    f({ label: 'Bảng', hashid: 'ttt', type: 'table_advance', columns: ['A', 'B', 'C'] }),
    f({ label: 'TP', hashid: 'sss', type: 'signature' }),
  ];
  const fld = (/** @type {string} */ i) => docx.fieldXml(i);
  const xml = W(`<w:p>${fld('MERGEFIELD "Mã dự án (aaa)"')}${fld('MERGEFIELD "Ngày tạo (bbb)"')}${fld('MERGEFIELD "Ghi chú (old)"')}`
    + `${fld('MERGEFIELD "Lạ (zzz)"')}${fld('DOCVARIABLE "TP (Ký xác nhận) (sss)"')}</w:p>`
    + docx.tableXml({ name: 'Bảng (ttt)', columns: [{ title: 'A', width: 1 }, { title: 'B', width: 1 }] }));
  const r = compare(xml, fields);
  assert.deepEqual(r.ok.sort(), ['Bảng (ttt)', 'Mã dự án (aaa)', 'TP (Ký xác nhận) (sss)']);
  assert.deepEqual(r.fixes.map(x => `${x.why}:${x.to}`).sort(), ['sai hashid:Ghi chú (ccc)', 'sai nhãn:Ngày lập (bbb)']);
  assert.deepEqual(r.missing, ['Lạ (zzz)']);
  assert.deepEqual(r.tables, [{ name: 'Bảng (ttt)', docx: 2, form: 3 }]);
});

test('preview buildPayload: giá trị mẫu [hashid], bảng 2 dòng, --values ghi đè, chữ ký không kiểm', () => {
  const { buildPayload } = require('../src/ewriter/commands/preview');
  const f = (/** @type {any} */ o) => ({ key: null, formId: 'F', columns: [], ...o });
  const { payload, marks } = buildPayload([
    f({ label: 'A', hashid: 'h1', type: 'textField' }),
    f({ label: 'B', hashid: 'h2', type: 'table_advance', columns: ['x', 'y'] }),
    f({ label: 'C', hashid: 'h3', type: 'textField' }),
    f({ label: 'K', hashid: 'h4', type: 'signature' }),
  ], { C: 'đặt tay' });
  assert.equal(payload[0].value, '[h1]');
  assert.deepEqual(payload[1].value, [['[h2.1.1]', '[h2.1.2]'], ['[h2.2.1]', '[h2.2.2]']]);
  assert.equal(payload[2].value, 'đặt tay');
  assert.equal(marks.get('h1'), '[h1]');
  assert.equal(marks.get('h2'), '[h2.1.');
  assert.equal(marks.get('h3'), null);
  assert.equal(marks.get('h4'), null);
});

/** Dựng zip 1 entry stored (method 0) — đủ cho readZipEntry qua central directory. */
function buildStoredZip(/** @type {string} */ name, /** @type {string} */ content) {
  const nameBuf = Buffer.from(name, 'utf8');
  const data = Buffer.from(content, 'utf8');
  const local = Buffer.alloc(30);
  local.writeUInt32LE(0x04034b50, 0);
  local.writeUInt16LE(20, 4);
  local.writeUInt16LE(0, 8);              // method 0 = stored
  local.writeUInt32LE(0, 14);             // crc
  local.writeUInt32LE(data.length, 18);   // compSize
  local.writeUInt32LE(data.length, 22);   // uncompSize
  local.writeUInt16LE(nameBuf.length, 26);
  local.writeUInt16LE(0, 28);
  const localPart = Buffer.concat([local, nameBuf, data]);

  const cen = Buffer.alloc(46);
  cen.writeUInt32LE(0x02014b50, 0);
  cen.writeUInt16LE(20, 4); cen.writeUInt16LE(20, 6);
  cen.writeUInt16LE(0, 10);               // method 0
  cen.writeUInt32LE(0, 16);               // crc
  cen.writeUInt32LE(data.length, 20);
  cen.writeUInt32LE(data.length, 24);
  cen.writeUInt16LE(nameBuf.length, 28);
  cen.writeUInt32LE(0, 42);               // local header offset
  const cenPart = Buffer.concat([cen, nameBuf]);

  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(1, 8); eocd.writeUInt16LE(1, 10);
  eocd.writeUInt32LE(cenPart.length, 12);
  eocd.writeUInt32LE(localPart.length, 16);
  return Buffer.concat([localPart, cenPart, eocd]);
}
