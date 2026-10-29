// @ts-check
'use strict';
const api = require('../api');
const store = require('../store');
const coreStore = require('../../core/store');
const paths = require('../../core/paths');
const { parseArgs, usage } = require('../../core/args');

const USAGE = 'kyta ecatalog pull <customer> <env> <id...> | --all   [--grep "chuỗi"] [--no-data]';

async function run(/** @type {string[]} */ argv) {
  const { _, flags, opts } = parseArgs(argv, { value: ['--grep'] });
  const [customer, env, ...ids] = _;
  const all = flags.has('--all');
  const withData = !flags.has('--no-data');
  if (!customer || !env || (!all && !ids.length)) usage(USAGE);

  const sess = await api.open(customer, env);
  const list = await api.listCategories(sess);
  const byId = new Map(list.map((/** @type {any} */ c) => [String(c.id), c]));
  console.log(`Kéo danh mục từ ${sess.host}  (${customer}/${env})`);

  let targets = all ? list.map((/** @type {any} */ c) => String(c.id)) : ids;
  if (all && opts['--grep']) {
    const low = opts['--grep'].toLowerCase();
    targets = list.filter((/** @type {any} */ c) =>
      String(c.name || '').toLowerCase().includes(low) || String(c.code || '').toLowerCase().includes(low)
    ).map((/** @type {any} */ c) => String(c.id));
    console.log(`--all --grep "${opts['--grep']}": ${targets.length} danh mục.`);
  } else if (all) console.log(`--all: ${targets.length} danh mục.`);

  let ok = 0, fail = 0;
  for (const id of targets) {
    try {
      if (!byId.has(String(id))) throw new Error('không có trong danh sách server');
      const cat = await api.category(sess, id);
      const data = withData ? await api.listData(sess, id).catch(() => []) : undefined;
      const { dir, fields, records } = store.save(customer, env, cat, data);
      coreStore.audit({ op: 'ecatalog-pull', id, customer, env });
      const dataTxt = records == null ? 'không kéo data' : `${records} bản ghi`;
      console.log(`  ✓ ${id}  "${cat.name || ''}"  (${fields} field, ${dataTxt}) → ${paths.toRepoRel(dir)}`);
      ok++;
    } catch (e) { console.log(`  ✗ ${id}: ${e.message}`); fail++; }
  }
  console.log(`\nXong: ${ok} danh mục OK, ${fail} lỗi.`);
  if (fail) process.exitCode = 1;
}

module.exports = { run, usage: USAGE };
