// @ts-check
'use strict';
// Đẩy 1 tài liệu: metadata + biến (updateResource / save-all) và file bản in (template.docx + document.xml → uploadFile).
const fs = require('fs');
const path = require('path');
const api = require('../api');
const store = require('../store');
const docx = require('../docx');
const coreStore = require('../../core/store');
const { parseArgs, usage } = require('../../core/args');

const USAGE = 'kyta ewriter push <folder> [--dry-run] [--force]';
const DOC_PART = 'word/document.xml';

/** word/document.xml của 1 gói .docx (chuỗi) — so nội dung, không so byte zip. */
const docXml = (/** @type {Buffer} */ buf) => docx.readZipEntry(buf, DOC_PART)?.toString('utf8') ?? '';

async function run(/** @type {string[]} */ argv) {
  const { _, flags } = parseArgs(argv);
  if (!_[0]) usage(USAGE);
  const dryRun = flags.has('--dry-run');
  const force = flags.has('--force');
  const { dir, meta, variables, customer, env } = store.load(_[0]);

  const sess = await api.open(customer, env);
  console.log(`Push tài liệu ${meta.id}  (${customer}/${env}) → ${sess.host}${dryRun ? '   [DRY-RUN]' : ''}`);

  // Bản mới nhất trên server.
  const server = await api.details(sess, meta.id, meta.resourceId);
  const serverVars = await api.variablesOf(sess, meta.id).catch(() => []);

  // Chặn ghi đè thay đổi người khác kể từ lần pull.
  if (!force && store.syncHash(server, Array.isArray(serverVars) ? serverVars : []) !== meta.pulledHash
      && store.syncHash(meta, variables) !== meta.pulledHash) {
    throw new Error('XUNG ĐỘT: cả server lẫn local đều đổi kể từ lần pull. Pull ra chỗ khác so sánh, hoặc thêm --force.');
  }

  // Vá field push được vào object server.
  const next = { ...server };
  const changes = [];
  for (const k of store.PUSH_FIELDS) {
    if (k in meta && JSON.stringify(server[k]) !== JSON.stringify(meta[k])) { next[k] = meta[k]; changes.push(k); }
  }

  // So biến (theo fieldId+code).
  const key = (/** @type {any[]} */ vs) => (vs || []).map(v => `${v.fieldId}:${v.code}`).sort().join('|');
  const varsChanged = key(variables) !== key(Array.isArray(serverVars) ? serverVars : []);

  // File bản in: đổi khi gói đóng lại khác mốc lúc pull.
  const fileChanged = store.hasDocx(dir) && !!meta.docxHash && store.docxHash(dir) !== meta.docxHash;
  /** @type {Buffer|null} */ let built = null;
  if (fileChanged) {
    built = store.buildDocx(dir);
    const pulledXml = docXml(fs.readFileSync(path.join(dir, store.DOCX)));
    const serverXml = docXml(await api.viewFile(sess, meta.id));
    if (!force && serverXml !== pulledXml) {
      throw new Error('XUNG ĐỘT FILE: file .docx trên server đã đổi kể từ lần pull. Pull ra chỗ khác so sánh, hoặc thêm --force.');
    }
    const a = docx.analyzeXml(docXml(built));
    console.log(`  File bản in cập nhật: ${Math.round(built.length / 1024)}KB · ${a.placeholders.length} placeholder · ${a.ifCount} IF`);
  }

  if (!changes.length && !varsChanged && !fileChanged) return console.log('  (không có thay đổi để đẩy.)');
  if (changes.length) console.log('  Metadata cập nhật: ' + changes.join(', '));
  if (varsChanged) console.log(`  Biến cập nhật: ${variables.length} biến (đồng bộ toàn bộ).`);
  if (dryRun) return console.log('\n[DRY-RUN] Không gửi gì lên server.');

  if (varsChanged) {
    await api.saveVariables(sess, meta.id, { addVariables: variables, deleteVariables: [], dataAdd: [] }, { del: true });
  }
  if (changes.length || varsChanged) await api.updateResource(sess, next);

  let synced = meta;
  if (built) {
    const fresh = await api.details(sess, meta.id, meta.resourceId);
    await api.uploadFile(sess, fresh, built);
    // Phản hồi upload chỉ echo dto → tải lại để chắc server nhận đúng nội dung.
    const back = await api.viewFile(sess, meta.id);
    if (docXml(back) !== docXml(built)) throw new Error('Upload xong nhưng file tải lại KHÁC bản vừa gửi — kiểm tra trên UI.');
    store.saveDocx(dir, back);
    const brief = (await api.list(sess)).find((/** @type {any} */ d) => d.id === meta.id);
    if (brief?.resourceId && brief.resourceId !== meta.resourceId) synced = { ...meta, resourceId: brief.resourceId };
    console.log('  ✓ file bản in đã upload + tải lại khớp.');
  }

  store.markSynced(dir, synced, variables);
  coreStore.audit({ op: 'ewriter-push', id: meta.id, customer, env, changes, varsChanged, fileChanged });
  console.log('  ✓ đã lưu.');
}

module.exports = { run, usage: USAGE };
