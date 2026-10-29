// @ts-check
'use strict';
const fs = require('fs');
const api = require('../api');
const sync = require('../../core/sync');
const store = require('../../core/store');
const config = require('../../core/config');
const { SPEC, META_FIELDS, rewritePortal } = require('../template');
const { parseArgs, usage } = require('../../core/args');

const USAGE = 'kyta email push <folder> [--dry-run] [--with-meta] [--force]';

async function run(/** @type {string[]} */ argv) {
  const { _, flags } = parseArgs(argv);
  if (!_[0]) usage(USAGE);
  const dryRun = flags.has('--dry-run');
  const res = sync.load(SPEC, _[0]);
  const { customer, env, meta } = res;
  let content = res.content;

  // Link portal trong mail phải trỏ đúng env đích (sandbox ↔ prod).
  const portal = config.serviceHost(customer, env, 'portal');
  if (!portal) console.log(`  ⚠ chưa khai "portal" cho env ${env} trong config/kyta.json — bỏ qua chuẩn hoá link.`);
  const rw = rewritePortal(content, portal);
  const rewritten = rw.content !== content;
  if (rewritten) {
    content = rw.content;
    console.log(`  ⓘ chuẩn hoá domain link → ${portal} (${rw.n} chỗ)`);
  }

  const sess = await api.open(customer, env);
  console.log(`Push mẫu mail ${meta.id}  (${customer}/${env}) → ${sess.host}${dryRun ? '   [DRY-RUN]' : ''}`);

  // Lấy bản mới nhất rồi chỉ vá field cần → không ghi đè thay đổi khác trên server.
  const server = await api.getOne(sess, meta.id);
  const { next, changes } = sync.patch(SPEC, server, content, meta, flags.has('--with-meta') ? META_FIELDS : []);
  if (!changes.length) return console.log('  (không có thay đổi để đẩy.)');
  sync.guardDrift(SPEC, server, content, meta, flags.has('--force'));
  console.log('  Sẽ cập nhật: ' + changes.join(', '));
  if (dryRun) return console.log('\n[DRY-RUN] Không gửi gì lên server.');

  await api.update(sess, next);
  if (rewritten) fs.writeFileSync(res.fp, content, 'utf8');   // local = bản vừa đẩy
  sync.markSynced(res.dir, meta, content);
  store.audit({ op: 'email-push', id: meta.id, customer, env });
  console.log('  ✓ đã lưu.');
}

module.exports = { run, usage: USAGE };
