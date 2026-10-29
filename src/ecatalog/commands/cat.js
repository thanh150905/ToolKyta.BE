// @ts-check
'use strict';
// CRUD danh mục (category): create/edit/clone/apply/unapply/rm.
const api = require('../api');
const ops = require('../ops');
const coreStore = require('../../core/store');
const { statusLabel, applicableLabel } = require('../status');
const { slugify } = require('../fields');
const { parseArgs, usage } = require('../../core/args');
const { pickOne } = require('../../core/pick');

const USAGE = [
  'kyta ecatalog cat <customer> <env> create <tên> [--code X] [--desc "..."] [--status 0|1]',
  'kyta ecatalog cat <customer> <env> edit  <danh mục> [--name X] [--code X] [--desc X] [--status 0|1]',
  'kyta ecatalog cat <customer> <env> clone <danh mục> [--name X] [--code X]',
  'kyta ecatalog cat <customer> <env> apply|unapply <danh mục>',
  'kyta ecatalog cat <customer> <env> rm    <danh mục> --yes',
  '  (thêm --dry-run để xem trước)',
].join('\n');

async function pickCat(/** @type {any} */ sess, /** @type {string} */ ref) {
  const list = await api.listCategories(sess);
  return pickOne(list, ref, { what: 'danh mục', id: x => x.id, names: x => [x.name, x.code], show: x => `${x.id}  ${x.name}` });
}
const parseStatus = (/** @type {string|undefined} */ v) => v === undefined ? undefined : (['0', 'ngừng', 'ngung', 'inactive'].includes(String(v).toLowerCase()) ? 0 : 1);

async function run(/** @type {string[]} */ argv) {
  const { _, flags, opts } = parseArgs(argv, { value: ['--code', '--desc', '--status', '--name'] });
  const [customer, env, action, ...rest] = _;
  if (!customer || !env || !action) usage(USAGE);
  const dry = flags.has('--dry-run');
  const sess = await api.open(customer, env);

  if (action === 'create') {
    const name = rest.join(' ').trim();
    if (!name) usage(USAGE);
    const code = opts['--code'] || slugify(name);
    const status = parseStatus(opts['--status']) ?? 1;
    console.log(`Tạo danh mục "${name}" (mã ${code}, ${statusLabel(status)})${dry ? '   [DRY-RUN]' : ''}`);
    if (dry) return;
    const cat = await ops.createCategory(sess, { name, code, description: opts['--desc'] || '', status });
    coreStore.audit({ op: 'ecatalog-cat-create', id: cat.id, customer, env });
    console.log(`  ✓ đã tạo — id ${cat.id}`);
    return;
  }

  const ref = rest.join(' ').trim();
  if (!ref) usage(USAGE);
  const brief = await pickCat(sess, ref);

  if (action === 'edit') {
    const cat = await api.category(sess, brief.id);
    const next = { ...cat };
    const ch = [];
    if (opts['--name'] !== undefined) { next.name = opts['--name']; ch.push(`name="${opts['--name']}"`); }
    if (opts['--code'] !== undefined) { next.code = opts['--code']; ch.push(`code=${opts['--code']}`); }
    if (opts['--desc'] !== undefined) { next.description = opts['--desc']; ch.push('desc'); }
    if (opts['--status'] !== undefined) { next.status = parseStatus(opts['--status']); ch.push(`status=${statusLabel(next.status)}`); }
    if (!ch.length) usage(USAGE + '\n  (chưa nêu thay đổi)');
    console.log(`Sửa "${cat.name}": ${ch.join(', ')}${dry ? '   [DRY-RUN]' : ''}`);
    if (dry) return;
    await api.updateConfig(sess, next);   // PUT /categories: lưu info nghiệp vụ
    coreStore.audit({ op: 'ecatalog-cat-edit', id: cat.id, customer, env });
    console.log('  ✓ đã sửa.');
    return;
  }

  if (action === 'clone') {
    const cat = await api.category(sess, brief.id);
    const name = opts['--name'] || `${cat.name} - Copy`;
    const code = opts['--code'] || `${cat.code}copy`;
    console.log(`Nhân bản "${cat.name}" → "${name}" (mã ${code})${dry ? '   [DRY-RUN]' : ''}`);
    if (dry) return;
    const c = await ops.cloneCategory(sess, cat, { name, code });
    coreStore.audit({ op: 'ecatalog-cat-clone', id: c.id, from: cat.id, customer, env });
    console.log(`  ✓ đã nhân bản — id ${c.id}`);
    return;
  }

  if (action === 'apply' || action === 'unapply') {
    const cat = await api.category(sess, brief.id);
    const want = action === 'apply' ? 1 : 0;
    if (cat.applicableStatus === want) return console.log(`  (đã "${applicableLabel(want)}" rồi.)`);
    console.log(`${action === 'apply' ? 'Áp dụng' : 'Ngừng áp dụng'} "${cat.name}"${dry ? '   [DRY-RUN]' : ''}`);
    if (dry) return;
    await api.updateConfig(sess, { ...cat, applicableStatus: want });
    coreStore.audit({ op: 'ecatalog-cat-' + action, id: cat.id, customer, env });
    console.log('  ✓ xong.');
    return;
  }

  if (action === 'rm') {
    const data = await api.listData(sess, brief.id).catch(() => []);
    console.log(`Xoá danh mục "${brief.name}" (${brief.id}) — KÉO THEO ${data.length} bản ghi dữ liệu${dry ? '   [DRY-RUN]' : ''}`);
    if (dry) return;
    if (!flags.has('--yes')) { console.log('  ✗ Thao tác xoá cứng. Thêm --yes để xác nhận.'); process.exitCode = 2; return; }
    await api.deleteCategory(sess, brief.id);
    coreStore.audit({ op: 'ecatalog-cat-rm', id: brief.id, customer, env });
    console.log('  ✓ đã xoá.');
    return;
  }

  usage(USAGE);
}

module.exports = { run, usage: USAGE };
