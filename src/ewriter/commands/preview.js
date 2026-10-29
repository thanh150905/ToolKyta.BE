// @ts-check
'use strict';
// Render thử bản in trên server với dữ liệu mẫu rồi tự kiểm placeholder nào KHÔNG được điền.
// Giá trị mẫu = "[hashid]" (bảng: 2 dòng "[hashid.dòng.cột]") → tìm lại trong file render để biết merge được chưa.
// Payload preview {label, hashid, type, value} — Aspose khớp thẳng placeholder "Nhãn (hashid)", không cần biến đăng ký.
const fs = require('fs');
const path = require('path');
const api = require('../api');
const docx = require('../docx');
const store = require('../store');
const paths = require('../../core/paths');
const { loadForms } = require('../forms');
const { readJson, isDir } = require('../../core/fsx');
const { parseArgs, usage } = require('../../core/args');
const { pickOne } = require('../../core/pick');

const USAGE = [
  'kyta ewriter preview <customer> <env> <id|tên tài liệu> [--form <formId|tên>[,..]] [--values v.json] [--out x.pdf|x.docx]',
  'kyta ewriter preview <thư mục tài liệu>                 [cùng tuỳ chọn]',
  '    --values: {"<hashid|nhãn>": giá trị} ghi đè giá trị mẫu (bảng = mảng các dòng)',
  '    preview dùng file TRÊN SERVER — sửa cục bộ thì push trước',
].join('\n');

/** Giá trị mẫu dò được cho 1 field. */
function mockValue(/** @type {import('../fields').PrintField} */ f) {
  if (f.type === 'table_advance') {
    const n = Math.max(f.columns.length, 1);
    return [1, 2].map(r => Array.from({ length: n }, (_, c) => `[${f.hashid}.${r}.${c + 1}]`));
  }
  return f.type === 'signature' ? '' : `[${f.hashid}]`;
}

/**
 * Dựng payload + bảng "dấu hiệu đã merge" theo hashid.
 * @param {import('../fields').PrintField[]} fields
 * @param {Record<string, any>} values
 */
function buildPayload(fields, values) {
  /** @type {Map<string, string|null>} */ const marks = new Map();   // hashid → chuỗi cần thấy trong bản render (null = không kiểm)
  const payload = fields.map(f => {
    const given = values[f.hashid] ?? values[f.label];
    const value = given !== undefined ? given : mockValue(f);
    marks.set(f.hashid, given !== undefined || f.type === 'signature' ? null
      : f.type === 'table_advance' ? `[${f.hashid}.1.` : `[${f.hashid}]`);
    return { label: f.label, hashid: f.hashid, type: f.type, value };
  });
  return { payload, marks };
}

async function run(/** @type {string[]} */ argv) {
  const { _, opts } = parseArgs(argv, { value: ['--form', '--values', '--out'] });
  let customer, env, doc;
  if (_.length === 1 && isDir(_[0])) {
    const meta = readJson(path.join(path.resolve(_[0]), store.META), null);
    const loc = paths.parseWorkspacePath(_[0]);
    if (!meta?.id || !loc) usage(USAGE);
    ({ customer, env } = loc);
    doc = meta;
  } else {
    [customer, env] = _;
    if (!customer || !env || !_[2]) usage(USAGE);
    doc = pickOne(await api.list(await api.open(customer, env)), _[2], {
      what: 'tài liệu', id: x => x.id, names: x => [x.name], show: x => `${x.id}  ${x.name}`,
    });
  }
  const formRef = opts['--form'] || doc.eformId;
  if (!formRef) throw new Error('Tài liệu chưa gắn form (eformId) — thêm --form <formId|tên>[,..].');

  const sess = await api.open(customer, env);
  const { forms, fields } = await loadForms(customer, env, formRef);
  const values = opts['--values'] ? readJson(path.resolve(opts['--values']), null) : {};
  if (!values) throw new Error(`Không đọc được ${opts['--values']}.`);
  const { payload, marks } = buildPayload(fields, values);

  const template = docx.analyzeXml((docx.readZipEntry(await api.viewFile(sess, doc.id), 'word/document.xml') || '').toString('utf8'));
  console.log(`Preview "${doc.name}" (${doc.id}) · dữ liệu mẫu từ ${forms.map(f => `"${f.formName}"`).join(', ')} (${payload.length} field)\n`);

  const rendered = await api.preview(sess, doc.id, payload, false);
  const outXml = (docx.readZipEntry(rendered, 'word/document.xml') || '').toString('utf8');
  const text = docx.textOf(outXml);

  let ok = 0;
  /** @type {string[]} */ const bad = [];
  /** @type {string[]} */ const skipped = [];
  for (const p of template.placeholders) {
    if (!p.hashid) continue;
    const mark = marks.get(p.hashid);
    if (mark === undefined) bad.push(`✗ "${p.name}" — hashid không có trong form${p.kind === 'DOCVARIABLE' ? ' (chữ ký? thêm form duyệt vào --form)' : ''}`);
    else if (mark === null) skipped.push(p.name);
    else if (text.includes(mark)) ok++;
    else bad.push(`✗ "${p.name}" — không được điền (kiểm nhãn: kyta ewriter docx check)`);
  }
  console.log(`  ✓ điền được: ${ok} placeholder`);
  bad.forEach(x => console.log('  ' + x));
  if (skipped.length) console.log(`  · không kiểm ${skipped.length} (chữ ký / giá trị tự nhập)`);
  const left = docx.analyzeXml(outXml).placeholders.length;
  if (left) console.log(`  ⚠ bản render còn ${left} field code chưa merge`);

  if (opts['--out']) {
    const out = path.resolve(opts['--out']);
    const buf = /\.pdf$/i.test(out) ? await api.preview(sess, doc.id, payload, true) : rendered;
    fs.writeFileSync(out, buf);
    console.log(`\n→ ${out} (${Math.round(buf.length / 1024)}KB)`);
  }
  if (bad.length) process.exitCode = 1;
}

module.exports = { run, usage: USAGE, buildPayload };
