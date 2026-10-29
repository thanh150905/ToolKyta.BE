// @ts-check
'use strict';
// Chạy thử code động của 1 form OFFLINE với runtime giả lập (src/eform/runtime.js) — xem code đổi field gì,
// bắn toast gì, lỗi gì — trước khi push.
const fs = require('fs');
const path = require('path');
const tree = require('../tree');
const fields = require('../fields');
const { createRuntime } = require('../runtime');
const { readJson } = require('../../core/fsx');
const { parseArgs, usage } = require('../../core/args');

const USAGE = [
  'kyta eform run <form-folder> [--fixture <file.json>] [--set <field>=<json>]... [--change <field>=<json>]...',
  '               [--time <ms>] [--cascade] [--json]',
  '',
  '  fixture: { "values": { "<field>": giá trị }, "steps": [ {"change":"<field>","value":...}, {"action":"onclick","field":"<field>"},',
  '             {"wait":1500} ], "fetch": { "<chuỗi con URL>": {"status":200,"json":{...}} }, "time": 10000 }',
  '  <field> = id đầy đủ, {{token}} hoặc key ngắn (key trùng cha/con → dùng id đầy đủ). Thiếu giá trị → lấy value trong fields.json.',
  '  --set đặt giá trị ban đầu; --change thêm bước "user đổi field" (sau các bước fixture). --time: chạy timer tới ms (mặc định 10000).',
  '  --cascade: changeFieldValue bằng code cũng bắn bindFieldChangeEvent [Unverified: chưa đối chiếu runtime thật].',
].join('\n');

/** Lặp option nhiều lần (parseArgs chỉ giữ lần cuối). */
function multi(/** @type {string[]} */ argv, /** @type {string} */ name) {
  const out = [];
  for (let i = 0; i < argv.length; i++) if (argv[i] === name) out.push(argv[++i] || '');
  return out.map(kv => {
    const eq = kv.indexOf('=');
    if (eq < 0) throw new Error(`${name} cần dạng <field>=<giá trị>, nhận "${kv}".`);
    const raw = kv.slice(eq + 1);
    let v; try { v = JSON.parse(raw); } catch (_) { v = raw; }
    return [kv.slice(0, eq), v];
  });
}

async function run(/** @type {string[]} */ argv) {
  const { _, flags, opts } = parseArgs(argv, { value: ['--fixture', '--time', '--set', '--change'] });
  if (!_[0]) usage(USAGE);
  const dir = path.resolve(_[0]);
  if (!tree.isForm(dir)) throw new Error('Không phải thư mục form: ' + _[0]);
  /** @type {import('../runtime').Fixture} */
  const fixture = opts['--fixture'] ? readJson(path.resolve(opts['--fixture']), null) : {};
  if (!fixture) throw new Error('Fixture không đọc được (thiếu file / sai JSON): ' + opts['--fixture']);
  fixture.values = { ...(fixture.values || {}), ...Object.fromEntries(multi(argv, '--set')) };
  const steps = [...(fixture.steps || []), ...multi(argv, '--change').map(([field, value]) => ({ change: field, value }))];

  const meta = tree.readMeta(dir) || {};
  const order = new Map((meta.code || []).map((/** @type {any} */ c) => [c.file, c.order ?? 0]));
  const code = tree.codeFiles(dir).sort((a, b) => (order.get(a) ?? 999) - (order.get(b) ?? 999) || a.localeCompare(b))
    .map(f => ({ file: 'code/' + f, text: fs.readFileSync(path.join(tree.codeDir(dir), f), 'utf8') }));
  if (!code.length) throw new Error('Form không có code động (code/*.js).');

  const rt = createRuntime({ formId: tree.metaIds(dir)[0] || null, fields: fields.readDoc(dir)?.fields || [], code, fixture, cascade: flags.has('--cascade') });
  await rt.load();
  for (const s of steps) await rt.step(s);
  await rt.advance(Number(opts['--time'] ?? fixture.time ?? 10000));

  if (flags.has('--json')) return console.log(JSON.stringify({ trace: rt.trace, changed: rt.changed(), props: rt.props(), bindings: rt.bindings() }, null, 2));
  const b = rt.bindings();
  console.log(`Chạy ${code.map(c => c.file).join(', ')} — ${b.change.length} bindFieldChangeEvent, ${b.action.length} bindFieldAction\n`);
  for (const r of rt.trace) {
    const v = r.value === undefined ? '' : ' = ' + JSON.stringify(r.value).slice(0, 160);
    console.log(`  ${String(r.t).padStart(6)}ms  ${r.op.padEnd(20)} ${r.field || ''}${v}${r.detail ? '  (' + r.detail + ')' : ''}`);
  }
  const errs = rt.trace.filter(r => r.op === 'error').length;
  console.log(`\n${errs ? '✗ ' + errs + ' lỗi khi chạy' : '✓ không lỗi'} · field bị đổi: ${Object.keys(rt.changed()).length} · đổi thuộc tính: ${Object.keys(rt.props()).length}`);
  if (errs) process.exitCode = 1;
}

module.exports = { run, usage: USAGE };
