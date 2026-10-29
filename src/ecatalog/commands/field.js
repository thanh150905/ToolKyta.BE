// @ts-check
'use strict';
// Xem/sửa FIELD (thông số) của 1 danh mục. Ghi qua PUT /categories/edit (tự khôi phục active — xem ops.js).
const api = require('../api');
const ops = require('../ops');
const coreStore = require('../../core/store');
const { parseStruct, labelOf, makeField, nextFieldId } = require('../fields');
const { parseArgs, usage } = require('../../core/args');
const { pickOne } = require('../../core/pick');

const USAGE = [
  'kyta ecatalog field <customer> <env> <danh mục> list',
  'kyta ecatalog field <customer> <env> <danh mục> add <nhãn> [--type textField] [--required] [--unique] [--desc "..."] [--after <field>]',
  'kyta ecatalog field <customer> <env> <danh mục> rm  <field>',
  'kyta ecatalog field <customer> <env> <danh mục> set <field> [--label X] [--desc "..."] [--required|--no-required] [--unique|--no-unique]',
  '  (--desc = ghi chú/mô tả field; --after chèn ngay sau field cho trước; thêm --dry-run để xem trước, không ghi)',
].join('\n');

/** Giá trị ghi chú/mô tả từ --description hoặc --desc (không nêu → undefined). */
const descOf = (/** @type {Record<string,string>} */ opts) =>
  opts['--description'] !== undefined ? opts['--description'] : opts['--desc'];

/** Chọn category theo id/tên. */
async function pickCat(/** @type {any} */ sess, /** @type {string} */ ref) {
  const list = await api.listCategories(sess);
  const brief = pickOne(list, ref, { what: 'danh mục', id: x => x.id, names: x => [x.name, x.code], show: x => `${x.id}  ${x.name}` });
  return api.category(sess, brief.id);
}

/** Chọn field trong struct theo id/nhãn. */
function pickField(/** @type {any[]} */ struct, /** @type {string} */ ref) {
  return pickOne(struct, ref, { what: 'field', id: x => x.id, names: x => [x.label, x.id], show: x => `${x.id}  "${labelOf(x)}"` });
}

async function run(/** @type {string[]} */ argv) {
  const { _, flags, opts } = parseArgs(argv, { value: ['--type', '--label', '--description', '--desc', '--after'] });
  const [customer, env, catRef, action, ...rest] = _;
  if (!customer || !env || !catRef || !action) usage(USAGE);
  const dry = flags.has('--dry-run');

  const sess = await api.open(customer, env);
  const cat = await pickCat(sess, catRef);
  const struct = parseStruct(cat);

  if (action === 'list') {
    console.log(`Field của "${cat.name}" (${struct.length}):\n`);
    for (const f of struct) {
      const tags = [f.validate?.required ? 'required' : '', f.validate?.unique ? 'unique' : ''].filter(Boolean).join(',');
      const note = f.description ? `  — ${f.description}` : '';
      console.log(`  ${String(f.id).padEnd(28)} ${String(f.type).padEnd(12)} ${tags.padEnd(16)} ${String(labelOf(f)).padEnd(30)}${note}`);
    }
    return;
  }

  if (action === 'add') {
    const label = rest.join(' ').trim();
    if (!label) usage(USAGE);
    const type = opts['--type'] || 'textField';
    const id = nextFieldId(struct, type, label);
    const field = makeField(label, { type, id, required: flags.has('--required'), unique: flags.has('--unique') });
    const desc = descOf(opts);
    if (desc !== undefined) field.description = desc;
    // Vị trí chèn: mặc định cuối; --after <field> → ngay sau field đó.
    let pos = struct.length;
    if (opts['--after'] !== undefined) pos = struct.indexOf(pickField(struct, opts['--after'])) + 1;
    const next = [...struct.slice(0, pos), field, ...struct.slice(pos)];
    console.log(`Thêm field "${label}" (${type}, id ${id}) vào "${cat.name}" tại vị trí ${pos + 1}/${next.length}${dry ? '   [DRY-RUN]' : ''}`);
    if (dry) return;
    await ops.saveStruct(sess, cat, next);
    coreStore.audit({ op: 'ecatalog-field-add', id: cat.id, customer, env, field: id });
    console.log('  ✓ đã thêm.');
    return;
  }

  if (action === 'rm') {
    const ref = rest.join(' ').trim();
    if (!ref) usage(USAGE);
    const f = pickField(struct, ref);
    console.log(`Xoá field "${labelOf(f)}" (${f.id}) khỏi "${cat.name}"${dry ? '   [DRY-RUN]' : ''}`);
    if (dry) return;
    await ops.saveStruct(sess, cat, struct.filter(x => x.id !== f.id));
    coreStore.audit({ op: 'ecatalog-field-rm', id: cat.id, customer, env, field: f.id });
    console.log('  ✓ đã xoá.');
    return;
  }

  if (action === 'set') {
    const ref = rest.join(' ').trim();
    if (!ref) usage(USAGE);
    const f = pickField(struct, ref);
    const next = { ...f, validate: { ...f.validate } };
    const changes = [];
    if (opts['--label'] !== undefined) { next.label = opts['--label']; changes.push(`label="${opts['--label']}"`); }
    const desc = descOf(opts);
    if (desc !== undefined) { next.description = desc; changes.push(`desc="${desc}"`); }
    if (flags.has('--required')) { next.validate.required = true; changes.push('required=true'); }
    if (flags.has('--no-required')) { next.validate.required = false; changes.push('required=false'); }
    if (flags.has('--unique')) { next.validate.unique = true; changes.push('unique=true'); }
    if (flags.has('--no-unique')) { next.validate.unique = false; changes.push('unique=false'); }
    if (!changes.length) usage(USAGE + '\n  (chưa nêu thay đổi nào)');
    console.log(`Sửa field "${labelOf(f)}" (${f.id}): ${changes.join(', ')}${dry ? '   [DRY-RUN]' : ''}`);
    if (dry) return;
    await ops.saveStruct(sess, cat, struct.map(x => x.id === f.id ? next : x));
    coreStore.audit({ op: 'ecatalog-field-set', id: cat.id, customer, env, field: f.id });
    console.log('  ✓ đã sửa.');
    return;
  }

  usage(USAGE);
}

module.exports = { run, usage: USAGE };
