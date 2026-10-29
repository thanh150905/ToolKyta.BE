// @ts-check
'use strict';
// Kiểm tra đăng nhập customer@env + in host từng service.
const session = require('../core/session');
const config = require('../core/config');
const { parseArgs, usage } = require('../core/args');

const USAGE = 'kyta login <customer> <env> [--force]';

async function run(/** @type {string[]} */ argv) {
  const { _, flags } = parseArgs(argv);
  const [customer, env] = _;
  if (!customer || !env) usage(USAGE);
  const { headers, diag } = await session.authenticate(customer, env, { force: flags.has('--force') });
  console.log(`✓ Đăng nhập OK ${customer}/${env}  (${headers.Authorization ? 'Bearer token' : 'cookie'})`);
  for (const s of /** @type {const} */ (['account', 'eform', 'eflow', 'eworkspace', 'portal'])) {
    console.log(`  ${s.padEnd(8)}: ${config.serviceHost(customer, env, s) || '(chưa cấu hình)'}`);
  }
  if (diag?.bodyKeys?.length) console.log(`  body keys: ${diag.bodyKeys.join(', ')}`);
}

module.exports = { run, usage: USAGE };
