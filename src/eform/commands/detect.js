// @ts-check
'use strict';
// Hỏi 1 file / form folder thuộc customer/env nào — dựa formId nhúng trong code + registry.
const fs = require('fs');
const path = require('path');
const tree = require('../tree');
const registry = require('../registry');
const { extractIds, dominant } = require('../formId');
const { usage } = require('../../core/args');

const USAGE = 'kyta eform detect <file | form-folder>';

function run(/** @type {string[]} */ argv) {
  if (!argv[0]) usage(USAGE);
  const abs = path.resolve(argv[0]);
  if (!fs.existsSync(abs)) throw new Error('Không thấy: ' + argv[0]);
  const texts = fs.statSync(abs).isDirectory() ? Object.values(tree.readCode(abs)) : [fs.readFileSync(abs, 'utf8')];

  /** @type {Record<string, number>} */ const counts = {};
  for (const t of texts) for (const [id, n] of Object.entries(extractIds(t))) counts[id] = (counts[id] || 0) + n;
  const dom = dominant(counts);
  if (!dom.id) return console.log('Không tìm thấy formId nào trong: ' + argv[0]);

  const { byId } = registry.load();
  const info = byId[dom.id];
  console.log(`formId chủ đạo : ${dom.id}  (${dom.count} tham chiếu)`);
  if (info) {
    console.log(`  customer     : ${info.customer}\n  môi trường   : ${info.env}`);
    console.log(`  form         : ${info.group ? info.group + '/' : ''}${info.form}\n  path         : ${info.path}`);
  } else console.log('  ⚠ formId chưa có trong registry.json (chạy kyta eform registry, hoặc code lạ env).');
  const target = fs.statSync(abs).isDirectory() && tree.readMeta(abs)?.targetFormId;
  if (target) console.log(`  ⓘ .meta.json khai targetFormId = ${target} → push nhắm form này, không theo vân tay.`);

  const others = Object.keys(counts).filter(id => id !== dom.id).sort((a, b) => counts[b] - counts[a]);
  if (others.length) {
    console.log('\nformId khác được tham chiếu:');
    for (const id of others) {
      const i = byId[id];
      console.log(`  - ${id} (${counts[id]})` + (i ? `  → ${i.customer}/${i.env}/${i.form}` : '  [ngoài registry]'));
    }
  }
}

module.exports = { run, usage: USAGE };
