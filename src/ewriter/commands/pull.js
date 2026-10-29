// @ts-check
'use strict';
const api = require('../api');
const store = require('../store');
const coreStore = require('../../core/store');
const paths = require('../../core/paths');
const { parseArgs, usage } = require('../../core/args');
const { pickOne } = require('../../core/pick');

const USAGE = 'kyta ewriter pull <customer> <env> <id|tên...> | --all   [--grep "chuỗi"] [--no-docx]\n'
  + '    kéo kèm file bản in: template.docx + document.xml (sửa document.xml rồi push)';

async function run(/** @type {string[]} */ argv) {
  const { _, flags, opts } = parseArgs(argv, { value: ['--grep'] });
  const [customer, env, ...ids] = _;
  const all = flags.has('--all');
  if (!customer || !env || (!all && !ids.length)) usage(USAGE);

  const sess = await api.open(customer, env);
  const list = await api.list(sess);
  const byId = new Map(list.map((/** @type {any} */ d) => [String(d.id), d]));
  console.log(`Kéo tài liệu bản in từ ${sess.host}  (${customer}/${env})`);

  // Nhận id hoặc tên tài liệu.
  let targets = all ? list.map((/** @type {any} */ d) => String(d.id))
    : ids.map(ref => String(byId.has(ref) ? ref : pickOne(list, ref, { what: 'tài liệu', id: x => x.id, names: x => [x.name], show: x => `${x.id}  ${x.name}` }).id));
  if (all && opts['--grep']) {
    const low = opts['--grep'].toLowerCase();
    targets = list.filter((/** @type {any} */ d) => String(d.name || '').toLowerCase().includes(low)).map((/** @type {any} */ d) => String(d.id));
    console.log(`--all --grep "${opts['--grep']}": ${targets.length} tài liệu.`);
  } else if (all) console.log(`--all: ${targets.length} tài liệu.`);

  let ok = 0, fail = 0;
  for (const id of targets) {
    try {
      const brief = byId.get(String(id));
      if (!brief) throw new Error('không có trong danh sách server');
      const doc = await api.details(sess, id, brief.resourceId);
      const variables = await api.variablesOf(sess, id).catch(() => []);
      const variableData = await api.variableData(sess, id).catch(() => null);
      const file = flags.has('--no-docx') ? null : await api.viewFile(sess, id);
      const { dir, count } = store.save(customer, env, doc, Array.isArray(variables) ? variables : [], variableData, file);
      coreStore.audit({ op: 'ewriter-pull', id, customer, env });
      console.log(`  ✓ ${id}  "${doc.name || ''}"  (${count} biến${file ? `, docx ${Math.round(file.length / 1024)}KB` : ''}) → ${paths.toRepoRel(dir)}`);
      ok++;
    } catch (e) { console.log(`  ✗ ${id}: ${e.message}`); fail++; }
  }
  console.log(`\nXong: ${ok} tài liệu OK, ${fail} lỗi.`);
  if (fail) process.exitCode = 1;
}

module.exports = { run, usage: USAGE };
