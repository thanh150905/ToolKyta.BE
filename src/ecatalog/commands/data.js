// @ts-check
'use strict';
// CRUD bản ghi dữ liệu của 1 danh mục: list/add/edit/rm/clone/clear.
const api = require('../api');
const coreStore = require('../../core/store');
const { inputFields, labelOf } = require('../fields');
const { parseArgs, usage } = require('../../core/args');
const { pickOne } = require('../../core/pick');

const USAGE = [
  'kyta ecatalog data <customer> <env> <danh mục> list',
  'kyta ecatalog data <customer> <env> <danh mục> add   "<field>=<giá trị>" ...',
  'kyta ecatalog data <customer> <env> <danh mục> edit  <bản ghi> "<field>=<giá trị>" ...',
  'kyta ecatalog data <customer> <env> <danh mục> clone <bản ghi>',
  'kyta ecatalog data <customer> <env> <danh mục> rm    <bản ghi>',
  'kyta ecatalog data <customer> <env> <danh mục> clear --yes        (xoá TẤT CẢ bản ghi)',
  '  <field>/<bản ghi> nhận id hoặc nhãn/giá trị. Thêm --dry-run để xem trước.',
].join('\n');

/** "Nhãn=giá trị" → { fieldId, value } (tách ở dấu = đầu tiên). */
function parsePairs(/** @type {string[]} */ tokens, /** @type {any[]} */ fields) {
  return tokens.map(t => {
    const i = t.indexOf('=');
    if (i < 0) throw new Error(`Sai cú pháp "${t}" — cần dạng "field=giá trị".`);
    const ref = t.slice(0, i).trim(), value = t.slice(i + 1);
    const f = pickOne(fields, ref, { what: 'field', id: x => x.id, names: x => [x.label, x.id], show: x => `${x.id} "${labelOf(x)}"` });
    return { fieldId: f.id, value };
  });
}

/** Giá trị các field nhập liệu của 1 record → chuỗi gọn để hiển thị. */
const recLine = (/** @type {any} */ r, /** @type {any[]} */ fields) =>
  fields.map(f => `${labelOf(f)}=${r[f.id] ?? ''}`).join('  ');

async function run(/** @type {string[]} */ argv) {
  const { _, flags } = parseArgs(argv);
  const [customer, env, catRef, action, ...rest] = _;
  if (!customer || !env || !catRef || !action) usage(USAGE);
  const dry = flags.has('--dry-run');

  const sess = await api.open(customer, env);
  const list = await api.listCategories(sess);
  const brief = pickOne(list, catRef, { what: 'danh mục', id: x => x.id, names: x => [x.name, x.code], show: x => `${x.id}  ${x.name}` });
  const cat = await api.category(sess, brief.id);
  const fields = inputFields(cat);
  const records = await api.listData(sess, brief.id);

  const pickRec = (/** @type {string} */ ref) => pickOne(records, ref, {
    what: 'bản ghi', id: x => x.id, names: x => fields.map(f => x[f.id]),
    show: x => `${x.id}  ${recLine(x, fields).slice(0, 60)}`,
  });

  if (action === 'list') {
    console.log(`Bản ghi của "${cat.name}" (${records.length}):\n`);
    for (const r of records) console.log(`  ${String(r.id).padEnd(26)} ${recLine(r, fields)}`);
    return;
  }

  if (action === 'add') {
    if (!rest.length) usage(USAGE);
    const pairs = parsePairs(rest, fields);
    /** @type {Record<string, any>} */ const record = { categoryId: brief.id };
    for (const p of pairs) record[p.fieldId] = p.value;
    console.log(`Thêm bản ghi vào "${cat.name}": ${pairs.map(p => p.fieldId + '=' + p.value).join(', ')}${dry ? '   [DRY-RUN]' : ''}`);
    if (dry) return;
    const r = await api.createRecord(sess, record);
    coreStore.audit({ op: 'ecatalog-data-add', id: brief.id, customer, env, record: r.id });
    console.log(`  ✓ đã thêm — id ${r.id}`);
    return;
  }

  if (action === 'edit') {
    const [ref, ...pairsRaw] = rest;
    if (!ref || !pairsRaw.length) usage(USAGE);
    const rec = pickRec(ref);
    const pairs = parsePairs(pairsRaw, fields);
    const next = { ...rec };
    for (const p of pairs) next[p.fieldId] = p.value;
    console.log(`Sửa bản ghi ${rec.id}: ${pairs.map(p => p.fieldId + '=' + p.value).join(', ')}${dry ? '   [DRY-RUN]' : ''}`);
    if (dry) return;
    await api.updateRecord(sess, next);
    coreStore.audit({ op: 'ecatalog-data-edit', id: brief.id, customer, env, record: rec.id });
    console.log('  ✓ đã sửa.');
    return;
  }

  if (action === 'clone') {
    const ref = rest.join(' ').trim();
    if (!ref) usage(USAGE);
    const rec = pickRec(ref);
    /** @type {Record<string, any>} */ const copy = { categoryId: brief.id };
    for (const f of fields) if (rec[f.id] !== undefined) copy[f.id] = rec[f.id];
    console.log(`Nhân bản bản ghi ${rec.id} trong "${cat.name}"${dry ? '   [DRY-RUN]' : ''}`);
    if (dry) return;
    const r = await api.createRecord(sess, copy);
    coreStore.audit({ op: 'ecatalog-data-clone', id: brief.id, from: rec.id, customer, env, record: r.id });
    console.log(`  ✓ đã nhân bản — id ${r.id}`);
    return;
  }

  if (action === 'rm') {
    const ref = rest.join(' ').trim();
    if (!ref) usage(USAGE);
    const rec = pickRec(ref);
    console.log(`Xoá bản ghi ${rec.id} (${recLine(rec, fields).slice(0, 60)})${dry ? '   [DRY-RUN]' : ''}`);
    if (dry) return;
    await api.deleteRecord(sess, rec.id);
    coreStore.audit({ op: 'ecatalog-data-rm', id: brief.id, customer, env, record: rec.id });
    console.log('  ✓ đã xoá.');
    return;
  }

  if (action === 'clear') {
    console.log(`Xoá TẤT CẢ ${records.length} bản ghi của "${cat.name}"${dry ? '   [DRY-RUN]' : ''}`);
    if (dry) return;
    if (!records.length) return console.log('  (không có bản ghi nào.)');
    if (!flags.has('--yes')) { console.log('  ✗ Xoá toàn bộ. Thêm --yes để xác nhận.'); process.exitCode = 2; return; }
    await api.deleteRecords(sess, records.map(r => r.id));
    coreStore.audit({ op: 'ecatalog-data-clear', id: brief.id, customer, env, count: records.length });
    console.log(`  ✓ đã xoá ${records.length} bản ghi.`);
    return;
  }

  usage(USAGE);
}

module.exports = { run, usage: USAGE };
