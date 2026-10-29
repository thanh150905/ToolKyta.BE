// @ts-check
'use strict';
const registry = require('../registry');

const USAGE = 'kyta eform registry';

function run() {
  const { count, warnings } = registry.build();
  console.log(`✓ registry.json: ${count} form`);
  if (warnings.length) console.log(`\n⚠ ${warnings.length} cảnh báo:\n` + warnings.map(w => '  - ' + w).join('\n'));
}

module.exports = { run, usage: USAGE };
