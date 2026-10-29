// @ts-check
'use strict';
const api = require('../api');
const input = require('../input');
const { usage } = require('../../core/args');

const USAGE = [
  'kyta eworkspace users <customer> <env> resolve <email...> [--emails-file <file>]',
  '  Tra cứu đồng thời tối đa 6 email; file chứa một email mỗi dòng.',
].join('\n');

async function run(/** @type {string[]} */ argv) {
  const [customer, env, action, ...rest] = argv;
  if (!customer || !env || action !== 'resolve') usage(USAGE);
  const { emails } = input.collectUsers(rest);
  if (!emails.length) usage(USAGE);

  const sess = await api.open(customer, env);
  const results = await input.mapLimit(emails, async email => {
    try { return { email, user: await api.userByEmail(sess, email) }; }
    catch (e) { return { email, error: e.message }; }
  });
  let missing = 0;
  for (const result of results) {
    if (result.user) console.log('  ' + result.email + '\t' + result.user.id + (result.user.fullName ? '\t' + result.user.fullName : ''));
    else if (result.error) { console.log('  ✗ ' + result.email + '\t' + result.error); missing++; }
    else { console.log('  - ' + result.email + '\tkhông tìm thấy'); missing++; }
  }
  console.log('\nTra xong ' + emails.length + ' email: ' + (emails.length - missing) + ' có user, ' + missing + ' chưa tra được.');
  if (missing) process.exitCode = 1;
}

module.exports = { run, usage: USAGE };
