// @ts-check
'use strict';
// Đẩy code động + custom UI của 1 form lên. Chặn trước khi gửi nếu sai môi trường / sai đích push.
const fs = require('fs');
const path = require('path');
const api = require('../api');
const tree = require('../tree');
const inspect = require('../inspect');
const formDef = require('../formDef');
const fields = require('../fields');
const store = require('../../core/store');
const { parseArgs, usage } = require('../../core/args');
const { readText, hash, safeName } = require('../../core/fsx');

const USAGE = 'kyta eform push <form-folder> [--dry-run] [--code-only] [--ui-only] [--fields-only] [--yes-prod] [--force]';

async function run(/** @type {string[]} */ argv) {
  const { _, flags } = parseArgs(argv);
  if (!_[0]) usage(USAGE);
  const dir = path.resolve(_[0]);
  if (!tree.isForm(dir)) throw new Error('Không phải form folder (thiếu code/ và .meta.json): ' + _[0]);
  const dryRun = flags.has('--dry-run');

  // Rào chắn dùng chung với status/guard — quét cả cây để bắt cả vân tay trùng.
  const st = inspect.listStates(dir).find(s => s.dir === dir) || inspect.formState(dir);
  const level = inspect.LEVEL[st.guard];
  if (level === 'error' || level === 'block') throw new Error(st.why + ' Dừng.');
  if (level === 'warn' || st.guard === 'override') console.log('  ⚠ ' + st.why);
  if (!st.formId) throw new Error('Không xác định được formId đích (code/ rỗng, .meta.json không có formId/targetFormId).');
  if (st.env === 'prod' && !flags.has('--yes-prod')) throw new Error('Đích là PROD — thêm --yes-prod để xác nhận.');

  const sess = await api.open(st.customer, st.env);
  console.log(`Push ${st.formId}  (${st.customer}/${st.env}) → ${sess.host}${dryRun ? '   [DRY-RUN]' : ''}`);
  try { await api.checkEdit(sess, st.formId); } catch (e) { console.log('  ⚠ check-edit: ' + e.message + ' (vẫn tiếp tục)'); }

  const meta = tree.readMeta(dir) || {};
  const opt = { dryRun, force: flags.has('--force') };
  // Ba cờ "-only" là bộ chọn loại tài nguyên; không cờ nào → đẩy cả ba.
  const codeOnly = flags.has('--code-only'), uiOnly = flags.has('--ui-only'), fieldsOnly = flags.has('--fields-only');
  const code = (uiOnly || fieldsOnly) ? null : await pushCode(sess, st, dir, meta, opt);
  const ui = (codeOnly || fieldsOnly) ? null : await pushUi(sess, st.formId, dir, meta, dryRun);
  const fld = (codeOnly || uiOnly) ? null : await pushFields(sess, st, dir, opt);
  if (ui === 'sent' || fld === 'sent' || dryRun) warnEmbedders(st);
  lintBeforeSave(dir);
  if (dryRun) return console.log('\n[DRY-RUN] Không gửi gì lên server.');

  // Local đã khớp server (vừa gửi hoặc vốn giống) → chụp lại snapshot để status coi là đồng bộ.
  const snapId = st.identityId || st.formId;
  const prev = store.getSnapshot(snapId);
  if (code === 'sent' || ui === 'sent' || fld === 'sent') {
    const bad = await verifyPush(sess, st, dir, meta, { code: code === 'sent', ui: ui === 'sent', fields: fld === 'sent' }, prev?.fields || null);
    if (bad.length) {
      for (const b of bad) console.log('  ✗ verify: ' + b);
      throw new Error(`Server KHÔNG khớp local sau khi ghi (${bad.length} chỗ) — kiểm tra lại (backup ở .kyta/backups/), chưa cập nhật snapshot.`);
    }
    console.log('  ✓ verify: đọc lại server khớp local.');
  }
  if (code || (ui && prev) || (fld && prev)) {
    store.saveSnapshot(snapId,
      code ? inspect.hashes(tree.readCode(dir)) : /** @type {any} */ (prev).files,
      ui ? inspect.hashes(tree.readUi(dir)) : undefined,
      fld ? fields.docHashes(fields.readDoc(dir)) : undefined);
  }
  if (code === 'sent' || ui === 'sent' || fld === 'sent') store.audit({ op: 'push', formId: st.formId, customer: st.customer, env: st.env, code, ui, fields: fld });
  console.log('\n✓ Push xong.');
}

/**
 * Gửi code/. PUT là full-replace nên gửi đủ mọi file; key lấy từ meta (tên gốc trên server).
 * @param {import('../api').Session} sess
 * @param {import('../inspect').FormState} st
 * @param {string} dir
 * @param {any} meta
 * @param {{ dryRun: boolean, force: boolean }} opt
 * @returns {Promise<'sent'|'same'|null>} 'same' = local vốn khớp server, không cần gửi
 */
async function pushCode(sess, st, dir, meta, { dryRun, force }) {
  const files = tree.codeFiles(dir);
  if (!files.length) { console.log('  (code): không có file .js — bỏ qua.'); return null; }
  const known = new Map((meta.code || []).map((/** @type {any} */ c) => [c.file, c]));
  const order = (/** @type {string} */ f) => known.get(f)?.order ?? 999;
  files.sort((a, b) => order(a) - order(b) || a.localeCompare(b));
  /** @type {Record<string, { code: string, order: number }>} */ const body = {};
  files.forEach((f, i) => {
    body[known.get(f)?.key || f.replace(/\.js$/, '')] = { code: fs.readFileSync(path.join(tree.codeDir(dir), f), 'utf8'), order: known.get(f)?.order ?? i };
  });
  const server = await api.getCode(sess, st.formId);
  const keys = Object.keys(body);
  if (keys.length === Object.keys(server).length && keys.every(k => server[k]?.code === body[k].code && server[k].order === body[k].order)) {
    console.log('  (code): đã khớp server — không cần gửi.');
    return 'same';
  }
  // Server đổi sau lần pull (sửa trên modeler / máy khác) → chặn để không ghi đè mất.
  const snap = st.identityId === st.formId ? store.getSnapshot(st.formId) : null;
  if (snap && !force) {
    const serverHash = Object.fromEntries(Object.entries(server).map(([k, v]) => [safeName(k) + '.js', hash(v.code)]));
    const serverDelta = inspect.compare(snap.files, serverHash);
    if (!inspect.isEmpty(serverDelta)) {
      const localClean = inspect.isEmpty(inspect.compare(snap.files, inspect.hashes(tree.readCode(dir))));
      const which = [...serverDelta.changed, ...serverDelta.added, ...serverDelta.removed].join(', ');
      throw new Error(localClean
        ? `Code trên server đã đổi sau lần pull (${which}), local không sửa gì → chạy pull thay vì push.`
        : `XUNG ĐỘT: server đổi ${which} kể từ lần pull, local cũng sửa. Chạy "kyta eform diff" để xem, thêm --force nếu chắc chắn ghi đè.`);
    }
  }
  console.log(`  (code): ${files.length} file → ${files.join(', ')}`);
  if (dryRun) return null;
  await api.putCode(sess, st.formId, body);
  console.log('  ✓ code đã lưu.');
  return 'sent';
}

/**
 * Vá custom UI vào bản form MỚI NHẤT trên server (chỉ đụng field có trong ui/), rồi PUT.
 * @returns {Promise<'sent'|'same'|null>}
 */
async function pushUi(/** @type {import('../api').Session} */ sess, /** @type {string} */ formId, /** @type {string} */ dir, /** @type {any} */ meta, /** @type {boolean} */ dryRun) {
  const folders = tree.uiFolders(dir);
  if (!folders.length) { console.log('  (ui): không có ui/ — bỏ qua.'); return null; }
  const form = await api.getForm(sess, formId);
  const { def, wasString } = formDef.parseFormDef(form);
  if (!def) throw new Error('(ui): form trên server không có jsonForm — không vá được custom UI.');
  const find = formDef.fieldLocator(formDef.collectCustomFields(def), meta);

  let changed = 0, missing = 0;
  for (const folder of folders) {
    const field = find(folder);
    if (!field) { console.log(`  ⚠ (ui) ${folder}: field không còn trên server — bỏ qua.`); missing++; continue; }
    const cur = field.node.customRenderCode || {};
    /** @type {Record<string, string>} */ const next = {};
    for (const [file, key] of Object.entries(formDef.UI_PARTS)) next[key] = readText(path.join(tree.uiDir(dir), folder, file), '');
    const diff = Object.keys(next).filter(k => (cur[k] || '') !== next[k]);
    if (!diff.length) continue;
    console.log(`  (ui) ${folder} [${field.hashid || field.type}]: đổi ${diff.join('+')}`);
    field.node.customRenderCode = { ...cur, ...next };
    changed++;
  }
  if (!changed) { console.log('  (ui): đã khớp server.'); return missing ? null : 'same'; }
  if (dryRun) return null;
  await api.putForm(sess, formDef.buildOwnerFormPayload(form, def, wasString));
  console.log(`  ✓ custom UI đã lưu (${changed} field).`);
  return 'sent';
}

/**
 * Vá cấu hình field (fields.json) vào bản form MỚI NHẤT trên server rồi PUT.
 * CHỈ đẩy field local đã sửa so với snapshot lúc pull (3 chiều): field local không đụng thì giữ bản server,
 * kể cả khi server đã đổi — tránh ghi đè âm thầm thay đổi của người khác. Cả 2 bên cùng sửa → xung đột.
 * @param {import('../api').Session} sess
 * @param {import('../inspect').FormState} st
 * @param {string} dir
 * @param {{ dryRun: boolean, force: boolean }} opt
 * @returns {Promise<'sent'|'same'|null>}
 */
async function pushFields(sess, st, dir, { dryRun, force }) {
  const doc = fields.readDoc(dir);
  if (!doc || !Array.isArray(doc.fields) || !doc.fields.length) { console.log('  (fields): không có fields.json — bỏ qua.'); return null; }
  const form = await api.getForm(sess, st.formId);
  const { def, wasString } = formDef.parseFormDef(form);
  if (!def) throw new Error('(fields): form trên server không có jsonForm — không vá được cấu hình field.');
  const find = formDef.fieldFinder(formDef.collectAllFields(def));
  const base = st.identityId === st.formId ? store.getSnapshot(st.formId)?.fields : null;
  const hasBase = !!base && Object.keys(base).length > 0;
  if (!hasBase && !force) {
    throw new Error('(fields): chưa có snapshot fields của form này → không biết field nào sửa cục bộ. Pull lại rồi sửa, hoặc --force để đẩy TOÀN BỘ fields.json.');
  }

  const plan = planFieldPush(doc, find, hasBase ? /** @type {Record<string, string>} */ (base) : null);
  for (const m of plan.missing) console.log(`  ⚠ (fields) ${m}: field không còn trên server — bỏ qua.`);
  if (plan.serverOnly.length) console.log(`  ℹ (fields) server đã đổi ${plan.serverOnly.length} field local không sửa (${plan.serverOnly.slice(0, 6).join(', ')}${plan.serverOnly.length > 6 ? '…' : ''}) — giữ bản server; pull để cập nhật local.`);
  if (plan.conflicts.length) {
    const list = plan.conflicts.join(', ');
    if (!force) throw new Error(`(fields) XUNG ĐỘT: ${list} — cả local và server cùng sửa kể từ lần pull. Chạy "kyta eform diff" để xem, --force để ghi đè bằng local.`);
    console.log(`  ⚠ (fields) --force: ghi đè xung đột ${list}`);
  }
  for (const c of plan.changes) console.log(`  (fields) ${c.ref} [${c.type}]: đổi ${c.props.join(', ')}`);
  if (!plan.changes.length) { console.log('  (fields): không có field nào sửa cục bộ cần đẩy.'); return plan.missing.length ? null : 'same'; }
  if (dryRun) return null;
  await api.putForm(sess, formDef.buildOwnerFormPayload(form, def, wasString));
  console.log(`  ✓ cấu hình field đã lưu (${plan.changes.length} field).`);
  return 'sent';
}

/**
 * Lập kế hoạch push fields (thuần, áp thẳng vào node server qua find). base = hash config lúc pull; null = đẩy hết.
 * @param {import('../fields').FieldsDoc} doc
 * @param {(ref: { hashid?: string|null, key?: string|null }) => import('../formDef').FormField|null} find
 * @param {Record<string, string>|null} base
 */
function planFieldPush(doc, find, base) {
  /** @type {{ ref: string, type: string, props: string[] }[]} */ const changes = [];
  /** @type {string[]} */ const missing = [], conflicts = [], serverOnly = [];
  for (const f of doc.fields) {
    const ref = f.key || f.hashid || '?';
    const id = f.hashid || f.key || '';
    const local = hash(JSON.stringify(f.config || {}));
    const field = find({ hashid: f.hashid, key: f.key });
    if (!field) { if (!base || base[id] !== local) missing.push(ref); continue; }
    const server = hash(JSON.stringify(fields.toConfig(field.node)));
    if (base && base[id] === local) { if (server !== local) serverOnly.push(ref); continue; }
    if (base && base[id] && server !== base[id] && server !== local) conflicts.push(ref);
    const props = fields.applyConfig(field.node, f.config || {});
    if (props.length) changes.push({ ref, type: field.type, props });
  }
  return { changes, missing, conflicts, serverOnly };
}

/** Lint tĩnh form trước khi coi là xong (chỉ in, không chặn — lỗi cũ có sẵn không nên khoá push). */
function lintBeforeSave(/** @type {string} */ dir) {
  try {
    const r = require('./lint').lintDirs([dir], { errorsOnly: true, quiet: true });
    if (r.errors) console.log(`  ⚠ lint: ${r.errors} lỗi (token trỏ field không tồn tại / marker hỏng) — xem: kyta eform lint "${tree.locate(dir).relPath}"`);
  } catch (_) {}
}

/**
 * Đọc lại server sau khi ghi và so với local: code (nội dung từng key), custom UI (3 phần), cấu hình các field
 * vừa đẩy (mọi property khai trong config local phải bằng server). Trả danh sách chỗ lệch.
 * @param {import('../api').Session} sess
 * @param {import('../inspect').FormState} st
 * @param {string} dir
 * @param {any} meta
 * @param {{ code: boolean, ui: boolean, fields: boolean }} sent
 * @param {Record<string, string>|null} base hash fields lúc pull (để biết field nào vừa đẩy)
 * @returns {Promise<string[]>}
 */
async function verifyPush(sess, st, dir, meta, sent, base) {
  /** @type {string[]} */ const bad = [];
  if (sent.code) {
    const server = await api.getCode(sess, st.formId);
    const keyOf = new Map((meta.code || []).map((/** @type {any} */ c) => [c.file, c.key]));
    for (const [f, text] of Object.entries(tree.readCode(dir))) {
      const k = keyOf.get(f) || f.replace(/\.js$/, '');
      if (server[k]?.code !== text) bad.push(`code/${f} khác server`);
    }
  }
  if (sent.ui || sent.fields) {
    const { def } = formDef.parseFormDef(await api.getForm(sess, st.formId));
    if (sent.ui) {
      const find = formDef.fieldLocator(formDef.collectCustomFields(def), meta);
      for (const folder of tree.uiFolders(dir)) {
        const f = find(folder);
        if (!f) continue;
        for (const [file, key] of Object.entries(formDef.UI_PARTS)) {
          if ((f.node.customRenderCode?.[key] || '') !== readText(path.join(tree.uiDir(dir), folder, file), '')) bad.push(`ui/${folder}/${file} khác server`);
        }
      }
    }
    if (sent.fields) {
      const find = formDef.fieldFinder(formDef.collectAllFields(def));
      for (const e of fields.readDoc(dir)?.fields || []) {
        if (base && base[e.hashid || e.key || ''] === hash(JSON.stringify(e.config || {}))) continue;   // không đẩy field này
        const f = find({ hashid: e.hashid, key: e.key });
        if (!f) continue;
        const diff = Object.keys(e.config || {}).filter(k => JSON.stringify(f.node[k]) !== JSON.stringify(e.config[k]));
        if (diff.length) bad.push(`field ${e.key || e.hashid}: ${diff.join(', ')} khác server`);
      }
    }
  }
  return bad;
}

/** Form này đang được nhúng (child_form) ở form khác → nhắc refresh, bản nhúng là bản sao không tự cập nhật. */
function warnEmbedders(/** @type {import('../inspect').FormState} */ st) {
  if (!st.formId) return;
  const parents = require('../../graph').load(st.customer, st.env).parentsOf(st.formId);
  if (!parents.length) return;
  console.log(`\n  ⚠ ${parents.length} form nhúng form này qua child_form — bản nhúng KHÔNG tự cập nhật:`);
  for (const p of parents.slice(0, 30)) console.log('    - ' + tree.locate(p.dir).relPath);
  if (parents.length > 30) console.log(`    … và ${parents.length - 30} form khác`);
  console.log('    Đồng bộ: kyta eform propagate <thư mục form con> --dry-run');
}

module.exports = { run, usage: USAGE, planFieldPush, warnEmbedders, verifyPush };
