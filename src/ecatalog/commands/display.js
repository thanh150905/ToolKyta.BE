// @ts-check
'use strict';
// Cấu hình HIỂN THỊ: chọn field cho bảng danh sách / tìm kiếm / lọc. Ghi qua PUT /categories (ops.setConfigActive).
const api = require('../api');
const ops = require('../ops');
const coreStore = require('../../core/store');
const { parseArgs, usage } = require('../../core/args');
const { pickOne } = require('../../core/pick');

// Bí danh nhóm người dùng gõ → field config.
/** @type {Record<string, {key: 'tableConfig'|'searchConfig'|'filterConfig', label: string}>} */
const GROUP = {
  table: { key: 'tableConfig', label: 'bảng danh sách' }, 'bang': { key: 'tableConfig', label: 'bảng danh sách' },
  search: { key: 'searchConfig', label: 'tìm kiếm' }, 'tim-kiem': { key: 'searchConfig', label: 'tìm kiếm' },
  filter: { key: 'filterConfig', label: 'lọc' }, 'loc': { key: 'filterConfig', label: 'lọc' },
};

const USAGE = [
  'kyta ecatalog display <customer> <env> <danh mục> <table|search|filter> [field...]',
  '  không nêu field  → xem cấu hình hiện tại',
  '  nêu field        → bật đúng các field đó (field khác tắt); "all" = bật hết, "none" = tắt hết',
  '  (thêm --dry-run để xem trước, không ghi)',
].join('\n');

async function run(/** @type {string[]} */ argv) {
  const { _, flags } = parseArgs(argv);
  const [customer, env, catRef, groupRef, ...fieldRefs] = _;
  if (!customer || !env || !catRef || !groupRef) usage(USAGE);
  const group = GROUP[String(groupRef).toLowerCase()];
  if (!group) usage(USAGE + '\n  nhóm: table (bảng danh sách) | search (tìm kiếm) | filter (lọc)');
  const dry = flags.has('--dry-run');

  const sess = await api.open(customer, env);
  const list = await api.listCategories(sess);
  const brief = pickOne(list, catRef, { what: 'danh mục', id: x => x.id, names: x => [x.name, x.code], show: x => `${x.id}  ${x.name}` });
  const cat = await api.category(sess, brief.id);
  const arr = cat[group.key] || [];

  if (!arr.length) {
    console.log(`"${cat.name}" chưa có field nào cho ${group.label} (thêm field trước bằng: kyta ecatalog field ... add).`);
    return;
  }

  // Xem hiện trạng.
  if (!fieldRefs.length) {
    console.log(`Cấu hình ${group.label} của "${cat.name}":\n`);
    for (const x of arr) console.log(`  [${x.active ? '✓' : ' '}] ${String(x.key).padEnd(26)} ${x.name || ''}`);
    return;
  }

  // Tính tập key cần bật.
  /** @type {Set<string>} */ let keys;
  const lower = fieldRefs.map(s => s.toLowerCase());
  if (lower.includes('all')) keys = new Set(arr.map((/** @type {any} */ x) => x.key));
  else if (lower.includes('none')) keys = new Set();
  else keys = new Set(fieldRefs.map(ref => pickOne(arr, ref, {
    what: 'field', id: x => x.key, names: x => [x.name, x.key], show: x => `${x.key}  "${x.name}"`,
  }).key));

  const shown = arr.filter((/** @type {any} */ x) => keys.has(x.key)).map((/** @type {any} */ x) => x.name || x.key);
  console.log(`Đặt ${group.label} "${cat.name}" → hiện: ${shown.length ? shown.join(', ') : '(không field nào)'}${dry ? '   [DRY-RUN]' : ''}`);
  if (dry) return;

  await ops.setConfigActive(sess, cat, group.key, keys);
  coreStore.audit({ op: 'ecatalog-display', id: cat.id, customer, env, group: group.key, active: [...keys] });
  console.log('  ✓ đã lưu.');
}

module.exports = { run, usage: USAGE };
