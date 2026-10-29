// @ts-check
'use strict';
// Kéo code động + custom UI về workspace/<customer>/<env>/eform/, chụp snapshot, dựng lại registry.
//   Định vị thư mục theo .meta.json (formId/targetFormId) — KHÔNG theo vân tay code (form cha nhúng token
//   form con sẽ bị nhận nhầm). Form mới → eform/[<--group>/]<tên form>/
//   Rào chắn: không ghi đè thư mục đang thuộc form khác; --all mặc định chỉ làm mới form đã có trong workspace.
const fs = require('fs');
const path = require('path');
const api = require('../api');
const tree = require('../tree');
const registry = require('../registry');
const formDef = require('../formDef');
const fields = require('../fields');
const paths = require('../../core/paths');
const store = require('../../core/store');
const { hash, safeName, writeText } = require('../../core/fsx');
const { parseArgs, usage } = require('../../core/args');

const USAGE = [
  'kyta eform pull <customer> <env> <formId...> | --all  [--group "Tên luồng"] [--into "<form-folder>"] [--include-new] [--force]',
  '',
  '  Thư mục đích = thư mục có .meta.json khai formId đó; chưa có → tạo mới theo tên form (--group để đặt vào nhóm).',
  '  --all          chỉ làm mới form đã có trong workspace; thêm --include-new để kéo cả form server chưa track.',
  '  --force        cho ghi đè thư mục đang thuộc form khác / chưa rõ danh tính.',
].join('\n');

async function run(/** @type {string[]} */ argv) {
  const { _, flags, opts } = parseArgs(argv, { value: ['--group', '--into'] });
  const [customer, env, ...ids] = _;
  const all = flags.has('--all');
  if (!customer || !env || (!all && !ids.length)) usage(USAGE);

  // --into: ép ghi vào đúng 1 thư mục (form copy dùng chung vân tay → tra registry sẽ ra nhầm chỗ).
  const into = opts['--into'] ? path.resolve(opts['--into']) : null;
  if (into) {
    if (all || ids.length !== 1) throw new Error('--into chỉ dùng khi kéo đúng 1 formId.');
    const loc = tree.locate(into);
    if (loc.customer !== customer || loc.env !== env) throw new Error(`--into thuộc ${loc.customer}/${loc.env}, không khớp ${customer}/${env}.`);
  }

  const sess = await api.open(customer, env);
  console.log(`Kéo từ ${sess.host}  (${customer}/${env})`);
  const formIds = all ? (await api.findOwned(sess)).map(f => f.formId) : ids;
  if (all) console.log(`--all: ${formIds.length} form sở hữu.`);

  const local = tree.metaIndex(customer, env);
  const force = flags.has('--force');
  /** @type {string[]} */ const skipped = [];
  let ok = 0, fail = 0;
  for (const formId of formIds) {
    try {
      let dest = into;
      if (!dest) {
        const hits = local.get(formId) || [];
        if (hits.length > 1) throw new Error(`${hits.length} thư mục cùng khai formId này — chỉ định --into:\n` + hits.map(h => '      ' + paths.toRepoRel(h)).join('\n'));
        dest = hits[0] || null;
        if (!dest && all && !flags.has('--include-new')) { skipped.push(formId); continue; }
      }
      await pullOne(sess, formId, dest, opts['--group'] || '', force);
      store.audit({ op: 'pull', formId, customer, env });
      ok++;
    } catch (e) { console.log(`  ✗ ${formId}: ${e.message}`); fail++; }
  }
  if (skipped.length) console.log(`\n  ℹ bỏ qua ${skipped.length} form server chưa có trong workspace (thêm --include-new để kéo về).`);
  console.log(`\nXong: ${ok} form OK, ${fail} lỗi.`);
  if (fail) process.exitCode = 1;
  const r = registry.build();
  console.log(`registry.json: ${r.count} form.`);
}

/**
 * @param {import('../api').Session} sess
 * @param {string} formId
 * @param {string|null} knownDir thư mục đã biết (.meta.json / --into); null = form mới
 * @param {string} group
 * @param {boolean} force
 */
async function pullOne(sess, formId, knownDir, group, force) {
  const code = await api.getCode(sess, formId);

  // Full form (custom UI) chỉ lấy được khi form không bị khoá ở modeler — lỗi thì vẫn kéo code.
  let form = null;
  try { form = await api.getForm(sess, formId); }
  catch (e) { console.log(`  ⚠ ${formId}: không lấy được custom UI (${e.message}) — vẫn kéo code động.`); }

  const dir = knownDir || path.join(paths.moduleDir(sess.customer, sess.env, 'eform'),
    ...(group ? [safeName(group)] : []), safeName(form?.formName || form?.formCode || formId));
  const prev = tree.readMeta(dir) || {};
  assertOwnDir(dir, formId, force);

  // code/: xoá file cũ rồi ghi đúng bộ file server có.
  fs.mkdirSync(tree.codeDir(dir), { recursive: true });
  for (const f of tree.codeFiles(dir)) fs.unlinkSync(path.join(tree.codeDir(dir), f));
  const codeMeta = Object.entries(code)
    .map(([key, v]) => ({ file: safeName(key) + '.js', key, order: v.order, code: v.code }))
    .sort((a, b) => a.order - b.order);
  for (const c of codeMeta) writeText(path.join(tree.codeDir(dir), c.file), c.code);

  // ui/ + fields.json: chỉ ghi lại khi có bản server (form khoá thì giữ nguyên bản cũ).
  let customUI = prev.customUI || [];
  let fieldHashes;
  if (form) {
    const { def } = formDef.parseFormDef(form);
    const uiFields = def ? formDef.collectCustomFields(def) : [];
    fs.rmSync(tree.uiDir(dir), { recursive: true, force: true });
    for (const f of uiFields) {
      for (const [file, key] of Object.entries(formDef.UI_PARTS)) {
        const v = f.node.customRenderCode[key];
        writeText(path.join(tree.uiDir(dir), f.dir, file), v == null ? '' : String(v));
      }
    }
    customUI = uiFields.map(f => ({ dir: f.dir, hashid: f.hashid, type: f.type }));

    // fields.json: toàn bộ cấu hình field (label, required, readonly, datasource...).
    const doc = def ? fields.buildDoc(def, formId) : { formId, fields: [] };
    fields.writeDoc(dir, doc);
    fieldHashes = fields.docHashes(doc);
  }

  // Snapshot = bản server lúc này → status phát hiện sửa cục bộ không cần gọi mạng.
  const files = Object.fromEntries(codeMeta.map(c => [c.file, hash(c.code)]));
  store.saveSnapshot(formId, files,
    form ? Object.fromEntries(Object.entries(tree.readUi(dir)).map(([k, v]) => [k, hash(v)])) : undefined,
    fieldHashes);

  // Giữ các khoá người dùng tự khai (đặc biệt targetFormId) — mất nó thì lần push sau đẩy nhầm form.
  tree.writeMeta(dir, {
    ...prev, formId, customer: sess.customer, env: sess.env,
    formCode: form?.formCode || prev.formCode || null,
    formName: form?.formName || prev.formName || null,
    pulledAt: new Date().toISOString(),
    code: codeMeta.map(({ file, key, order }) => ({ file, key, order })),
    customUI,
  });
  const nFields = fieldHashes ? Object.keys(fieldHashes).length : null;
  console.log(`  ✓ ${formId}  code:${codeMeta.length} file, ui:${form ? customUI.length + ' field' : 'giữ nguyên (form khoá)'}, fields:${nFields == null ? 'giữ nguyên' : nFields}  → ${paths.toRepoRel(dir)}`);
}

/** Chặn ghi đè thư mục đang là form khác (từng đè form cha bằng nội dung subform, đè nhầm form cùng nhóm). */
function assertOwnDir(/** @type {string} */ dir, /** @type {string} */ formId, /** @type {boolean} */ force) {
  if (force || !tree.isForm(dir)) return;
  const owned = tree.metaIds(dir);
  const rel = paths.toRepoRel(dir);
  if (!owned.length) throw new Error(`${rel} đã có form nhưng .meta.json không khai formId — không rõ của form nào. Kiểm tra rồi thêm --force.`);
  if (!owned.includes(formId)) throw new Error(`${rel} đang là form ${owned.join('/')} — không ghi đè bằng ${formId}. Dùng --into thư mục khác (hoặc --force nếu chắc chắn).`);
}

module.exports = { run, usage: USAGE, assertOwnDir };
