// @ts-check
'use strict';
const api = require('../api');
const store = require('../store');
const input = require('../input');
const coreStore = require('../../core/store');
const { usage } = require('../../core/args');

const USAGE = [
  'kyta eworkspace dashboard <customer> <env> add <dashboard-id...> [--preset] <users> [--dry-run] [--yes] [--yes-prod]',
  'kyta eworkspace dashboard <customer> <env> delete <users> [--dry-run] [--yes] [--yes-prod]',
  '  User nhập bằng --user id,email (lặp lại) / --users-file users.csv hoặc --email email / --emails-file emails.txt.',
  '  add nhận email làm vị trí sau lệnh để tra ID; --preset dùng toàn bộ dashboard đã lưu.',
  '  delete gỡ TẤT CẢ dashboard của user được chọn. Mỗi cặp dashboard-user dùng một request.',
].join('\n');

async function resolveEmails(/** @type {any} */ sess, /** @type {string[]} */ emails) {
  const rows = await input.mapLimit(emails, async email => {
    try { return { email, user: await api.userByEmail(sess, email) }; }
    catch (e) { return { email, error: e.message }; }
  });
  const users = [];
  let missing = 0;
  for (const row of rows) {
    if (row.user?.id && /^\d+$/.test(String(row.user.id))) users.push({ id: Number(row.user.id), email: row.email });
    else {
      missing++;
      if (row.error) console.log('  ✗ ' + row.email + ': ' + row.error);
      else console.log('  - ' + row.email + ': không tìm thấy');
    }
  }
  if (missing) throw new Error('Không tra được ' + missing + '/' + rows.length + ' email; đã hủy thao tác để tránh cập nhật thiếu user.');
  return input.uniqueUsers(users);
}

async function run(/** @type {string[]} */ argv) {
  const knownValueOptions = ['--user', '--email', '--users-file', '--emails-file'];
  const parsed = input.parse(argv, knownValueOptions);
  const [customer, env, action, ...rest] = parsed.positional;
  if (!customer || !env || !action || !['add', 'delete'].includes(action)) usage(USAGE);
  const dry = parsed.flags.has('--dry-run');
  const { users: suppliedUsers, emails } = input.collectUsers(argv.slice(2), { positionalsAsEmails: false });
  let users = suppliedUsers;

  if (action === 'add') {
    let dashboardIds = input.splitIds(rest);
    if (parsed.flags.has('--preset')) {
      if (dashboardIds.length) usage(USAGE + '\n  (--preset không nhận ID dashboard ở vị trí tham số)');
      dashboardIds = store.list(env).map(d => d.id);
    }
    dashboardIds = [...new Set(dashboardIds)];
    if (!dashboardIds.length) usage(USAGE);
    if (users.length === 0 && emails.length === 0) usage(USAGE);

    let sess = null;
    if (emails.length) {
      sess = await api.open(customer, env);
      users = input.uniqueUsers(users.concat(await resolveEmails(sess, emails)));
    }
    if (!users.length) throw new Error('Không có user hợp lệ để thêm dashboard.');

    const total = dashboardIds.length * users.length;
    console.log('Thêm ' + dashboardIds.length + ' dashboard cho ' + users.length + ' user (' + total + ' request)' + (dry ? ' [DRY-RUN]' : '') + ':');
    for (const id of dashboardIds) console.log('  ' + id);
    for (const user of users) console.log('  user ' + user.id + '  ' + user.email);
    if (dry) return;
    if (env === 'prod' && !parsed.flags.has('--yes-prod')) throw new Error('Đích là PROD — thêm --yes-prod để xác nhận.');
    if (!parsed.flags.has('--yes')) { console.log('Chưa ghi lên server. Thêm --yes để xác nhận thao tác.'); process.exitCode = 2; return; }
    sess ||= await api.open(customer, env);

    let success = 0;
    let failed = 0;
    const tasks = dashboardIds.flatMap(dashboardId => users.map(user => ({ dashboardId, user })));
    await input.mapLimit(tasks, async ({ dashboardId, user }) => {
      try {
        await api.createDashboard(sess, dashboardId, user);
        success++;
        console.log('  ✓ ' + dashboardId + ' → ' + user.email);
      } catch (e) {
        failed++;
        console.log('  ✗ ' + dashboardId + ' → ' + user.email + ': ' + e.message);
      }
    });
    coreStore.audit({ op: 'eworkspace-dashboard-add', customer, env, dashboards: dashboardIds.length, users: users.length, success, failed });
    console.log('\nHoàn thành: ' + success + '/' + total + ' thành công, ' + failed + ' lỗi.');
    if (failed) process.exitCode = 1;
    return;
  }

  if (rest.length) usage(USAGE);
  if (users.length === 0 && emails.length === 0) usage(USAGE);
  let sess = null;
  if (emails.length) {
    sess = await api.open(customer, env);
    users = input.uniqueUsers(users.concat(await resolveEmails(sess, emails)));
  }
  if (!users.length) throw new Error('Không có user hợp lệ để gỡ dashboard.');
  console.log('Gỡ TẤT CẢ dashboard của ' + users.length + ' user' + (dry ? ' [DRY-RUN]' : '') + ':');
  for (const user of users) console.log('  ' + user.id + '  ' + user.email);
  if (dry) return;
  if (env === 'prod' && !parsed.flags.has('--yes-prod')) throw new Error('Đích là PROD — thêm --yes-prod để xác nhận.');
  if (!parsed.flags.has('--yes')) { console.log('Chưa ghi lên server. Thêm --yes để xác nhận thao tác.'); process.exitCode = 2; return; }
  sess ||= await api.open(customer, env);
  await api.deleteDashboards(sess, users);
  coreStore.audit({ op: 'eworkspace-dashboard-delete-all', customer, env, users: users.length });
  console.log('  ✓ Đã gỡ dashboard cho ' + users.length + ' user.');
}

module.exports = { run, usage: USAGE };
