// @ts-check
'use strict';
const api = require('../api');
const sync = require('../../core/sync');
const store = require('../../core/store');
const { SPEC, META_FIELDS } = require('../modeler');
const { parseArgs, usage } = require('../../core/args');

const USAGE = 'kyta eflow push <folder> [--dry-run] [--with-meta] [--force] [--status active|unpublic]';

async function run(/** @type {string[]} */ argv) {
  const { _, flags, opts } = parseArgs(argv, { value: ['--status'] });
  const status = opts['--status'] || 'active';
  if (!_[0] || !['active', 'unpublic'].includes(status)) usage(USAGE);
  const dryRun = flags.has('--dry-run');
  const { dir, meta, content, customer, env } = sync.load(SPEC, _[0]);

  const sess = await api.open(customer, env);
  console.log(`Push quy trình ${meta.id}  (${customer}/${env}) → ${sess.host}${dryRun ? '   [DRY-RUN]' : ''}`);

  // Lấy bản mới nhất (kèm version cho optimistic-lock) rồi chỉ vá field cần.
  const server = await api.getOne(sess, meta.id);
  const { next, changes } = sync.patch(SPEC, server, content, meta, flags.has('--with-meta') ? META_FIELDS : []);
  if (!changes.length) return console.log('  (không có thay đổi để đẩy.)');
  sync.guardDrift(SPEC, server, content, meta, flags.has('--force'));
  // Editor luôn gửi attributeStr = JSON(attribute); thiếu thì mất cấu hình clone/mail/đính kèm.
  if (next.attribute != null) next.attributeStr = JSON.stringify(next.attribute);

  console.log(`  Sẽ cập nhật: ${changes.join(', ')}   [status=${status}, version=${server.version}]`);
  if (dryRun) return console.log('\n[DRY-RUN] Không gửi gì lên server.');

  await api.save(sess, next, status);
  sync.markSynced(dir, meta, content);
  store.audit({ op: 'eflow-push', id: meta.id, customer, env, status });
  console.log('  ✓ đã lưu.');
}

module.exports = { run, usage: USAGE };
