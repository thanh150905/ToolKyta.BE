// @ts-check
'use strict';
// Sửa nhanh cấu hình 1 field ngay trên fields.json (không cần mở file tay).
//   field list <form>            — liệt kê field (key · type · label · cờ)
//   field get  <form> <key>      — in JSON cấu hình 1 field
//   field set  <form> <key> ...  — sửa & ghi fields.json (--push để đẩy luôn)
const fs = require('fs');
const path = require('path');
const api = require('../api');
const tree = require('../tree');
const fields = require('../fields');
const formDef = require('../formDef');
const inspect = require('../inspect');
const { elementKeyOf } = require('../formId');
const paths = require('../../core/paths');
const store = require('../../core/store');
const { safeName, readJson, hash } = require('../../core/fsx');
const { parseArgs, usage } = require('../../core/args');

const TPL_DIR = path.join(paths.REPO, 'docs', 'eform-node-templates');

const USAGE = [
  'kyta eform field list   <form-folder>',
  'kyta eform field get    <form-folder> <key|hashid>',
  'kyta eform field set    <form-folder> <key|hashid> [options]',
  'kyta eform field add    <form-folder> <type> [--label ...] [--required ...] [--readonly ...] [--hidden] [--after <key>] [--set path=value] [--dry-run] [--yes-prod]',
  'kyta eform field group  <form-folder> <key1,key2,...> [--as columns|row|splitter] [--hidden] [--dry-run] [--yes-prod]',
  'kyta eform field move   <form-folder> <key> --into <container-key|hashid> [--after <key>] [--dry-run] [--yes-prod]',
  'kyta eform field delete <form-folder> <key|hashid> [--dry-run] [--force] [--yes-prod]',
  '',
  'add: tạo field mới từ node mẫu (docs/eform-node-templates/<type>.json), chèn vào form trên server.',
  '     --after đặt ngay sau field đó; mặc định nối cuối trang cuối. --hidden để ẩn. --dry-run xem trước.',
  'group: gom nhiều field vào 1 container — columns (nằm ngang), splitter --hidden (nhóm ẩn end-user).',
  'move: chuyển field vào trong container (columns/row/splitter/page) khác.',
  '',
  'set options:',
  '  --label <str>              đổi nhãn',
  '  --required true|false      validate.required',
  '  --readonly true|false      chỉ đọc',
  '  --display  true|false      hiện/ẩn field',
  '  --placeholder <str> --tooltip <str> --description <str> --value <str>',
  '  --set <path>=<value>       sửa sâu bất kỳ (lặp nhiều lần); value là JSON, lỗi thì coi là chuỗi',
  '                             vd: --set validate.maxLength=200  --set dropdownConfig.data.url=6a80...',
  '  --push                     push cấu hình field lên server ngay sau khi ghi',
  '',
  'delete: xoá field khỏi form trên server (khó hoàn tác). Chặn nếu field còn bị tham chiếu ở jsonForm,',
  '        code/ui (id đầy đủ, hashid, key ngắn ref("type-N")), điều kiện ẩn/hiện, hoặc code form khác — --force để bỏ qua.',
  '',
  'Rào chắn chung: key trùng (form cha + form con nhúng) → phải dùng hashid; add/delete/group/move dựng lại',
  'fields.json từ server nên bị chặn khi fields.json còn sửa chưa push (--force để bỏ). Mọi lần ghi đều backup',
  'bản server vào .kyta/backups/ và tự đồng bộ variableArr.',
].join('\n');

const VALUE_OPTS = ['--label', '--required', '--readonly', '--display', '--placeholder', '--tooltip', '--description', '--value'];

/** "true/1/yes" → true, "false/0/no" → false; khác → lỗi. */
function toBool(/** @type {string} */ v, /** @type {string} */ name) {
  const s = String(v).toLowerCase();
  if (['true', '1', 'yes', 'y'].includes(s)) return true;
  if (['false', '0', 'no', 'n'].includes(s)) return false;
  throw new Error(`--${name} cần true/false, nhận "${v}".`);
}

/** Ép kiểu value của --set: thử JSON, lỗi thì giữ nguyên chuỗi. */
function coerce(/** @type {string} */ v) {
  try { return JSON.parse(v); } catch (_) { return v; }
}

/** Set sâu theo path "a.b.c" (tạo object trung gian nếu thiếu). */
function deepSet(/** @type {any} */ obj, /** @type {string} */ dotPath, /** @type {any} */ value) {
  const keys = dotPath.split('.');
  let cur = obj;
  for (let i = 0; i < keys.length - 1; i++) {
    const k = keys[i];
    if (cur[k] == null || typeof cur[k] !== 'object') cur[k] = {};
    cur = cur[k];
  }
  cur[keys[keys.length - 1]] = value;
}

/** Tìm entry field theo key hoặc hashid. Key trùng (form cha + form con nhúng) → lỗi, bắt dùng hashid. */
function findEntry(/** @type {import('../fields').FieldsDoc} */ doc, /** @type {string} */ ref) {
  const byKey = doc.fields.filter(f => f.key === ref);
  if (byKey.length > 1) {
    throw new Error(`"${ref}" khớp ${byKey.length} field (key trùng giữa form và form con nhúng) — chỉ định bằng hashid:\n`
      + byKey.map(f => `    ${f.hashid || '—'}  "${f.label || ''}"`).join('\n'));
  }
  return byKey[0] || doc.fields.find(f => f.hashid === ref) || null;
}

function loadDoc(/** @type {string} */ target) {
  const dir = path.resolve(target);
  if (!tree.isForm(dir)) throw new Error('Không phải form folder: ' + target);
  const doc = fields.readDoc(dir);
  if (!doc) throw new Error(`Chưa có ${fields.FIELDS_FILE} ở ${target} — chạy: kyta eform pull ... trước.`);
  return { dir, doc };
}

const escRx = (/** @type {string} */ t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
/** Khớp token có biên phải để "-1" không trúng "-10". */
const tokenRx = (/** @type {string} */ t) => new RegExp(escRx(t) + '(?![0-9A-Za-z_])', 'g');
/** Key ngắn trong nháy, vd ref("textField_ticketName-1") — code BMW gọi field kiểu này, không dùng id đầy đủ. */
const quotedKeyRx = (/** @type {string} */ k) => new RegExp('([\'"`])' + escRx(k) + '\\1', 'g');

/**
 * Nguồn văn bản của chính form có thể tham chiếu field: code/ui, điều kiện ẩn/hiện.
 * Tham chiếu NGOÀI form (form khác, eFlow, eWriter, mail) tra qua đồ thị workspace — xem externalHits.
 * @param {string} dir
 * @param {any} form bản GET server (có jsonFormCondition)
 */
function refSources(dir, form) {
  /** @type {Record<string, string>} */ const own = {};
  for (const [f, t] of Object.entries(tree.readCode(dir))) own['code/' + f] = t;
  for (const [f, t] of Object.entries(tree.readUi(dir))) own['ui/' + f] = t;
  if (form && form.jsonFormCondition) own['điều kiện ẩn/hiện (jsonFormCondition)'] = typeof form.jsonFormCondition === 'string' ? form.jsonFormCondition : JSON.stringify(form.jsonFormCondition);
  return { own, others: {} };
}

/**
 * Tham chiếu ngoài form qua đồ thị: id đầy đủ ở code/ui form khác, eFlow (điều kiện, kế thừa), eWriter
 * (biến bản in), mail; hashid ở eFlow/eWriter/mail. Bản nhúng (fields.json form cha) chỉ để báo, không chặn.
 * @param {import('../../graph').Graph} g
 * @param {string} dir thư mục form đang xoá field
 * @param {any} node
 * @returns {{ hits: string[], copies: string[] }}
 */
function externalHits(g, dir, node) {
  const inOwn = (/** @type {string} */ fp) => fp.startsWith(dir + path.sep);
  const isFields = (/** @type {string} */ fp) => fp.endsWith(path.sep + fields.FIELDS_FILE);
  /** @type {string[]} */ const hits = [];
  /** @type {string[]} */ const copies = [];
  const scan = (/** @type {string} */ token, /** @type {boolean} */ eformToo) => {
    for (const r of g.search(token, { exclude: inOwn })) {
      if (r.kind === 'eform' && isFields(path.join(paths.REPO, r.file))) { copies.push(`${r.owner} (bản nhúng, "${token}")`); continue; }
      if (r.kind === 'eform' && !eformToo) continue;
      hits.push(`[${r.kind}] ${r.file} (${r.count}× "${token}")`);
    }
  };
  if (node.id) scan(node.id, true);
  if (node.hashid) scan(node.hashid, false);
  return { hits: [...new Set(hits)], copies: [...new Set(copies)] };
}

/**
 * Chỗ nào còn tham chiếu tới node: field khác trong jsonForm, code/ui/điều kiện của form (id đầy đủ, hashid,
 * key ngắn trong nháy), code/ui form khác (id đầy đủ).
 * @param {any} def jsonForm def
 * @param {{ own: Record<string, string>, others: Record<string, string> }} src
 * @param {any} node node sắp xoá
 * @returns {string[]}
 */
function refHits(def, src, node) {
  /** @type {string[]} */ const hits = [];
  const tokens = [node.id, node.hashid].filter(Boolean);
  const key = elementKeyOf(node, node.type);
  // jsonForm: bỏ node ra khỏi bản sao rồi soi phần còn lại (bắt formula/feedData/binding... của field khác).
  const clone = JSON.parse(JSON.stringify(def));
  formDef.removeField(clone, { hashid: node.hashid, key: null });
  const rest = JSON.stringify(clone);
  for (const t of tokens) if (tokenRx(t).test(rest)) hits.push(`field khác trong jsonForm tham chiếu "${t}"`);
  for (const [label, text] of Object.entries(src.own)) {
    for (const t of tokens) { const m = String(text).match(tokenRx(t)); if (m) hits.push(`${label} (${m.length}× "${t}")`); }
    if (key) { const m = String(text).match(quotedKeyRx(key)); if (m) hits.push(`${label} (${m.length}× key ngắn "${key}" — có thể là field khác cùng key, kiểm tra lại)`); }
  }
  if (node.id) {
    for (const [label, text] of Object.entries(src.others)) { const m = text.match(tokenRx(node.id)); if (m) hits.push(`form khác ${label} (${m.length}× "${node.id}")`); }
  }
  return hits;
}

/** Xoá 1 field HOẶC container khỏi form trên server + đồng bộ local. */
async function del(/** @type {string} */ target, /** @type {string} */ ref, /** @type {Set<string>} */ flags) {
  const { dir, st, sess, form, def, wasString, dryRun } = await openForm(target, flags);

  // Định vị trên server def → xử lý được cả field lẫn container (columns/row/splitter).
  const node = formDef.findUniqueNode(def, ref);
  if (!node) throw new Error(`Không thấy "${ref}" trên form. Xem: kyta eform field list <form>`);
  const key = elementKeyOf(node, node.type) || ref;

  console.log(`Xoá "${key}" [${node.type}] khỏi ${st.formId}  (${st.customer}/${st.env})${dryRun ? '   [DRY-RUN]' : ''}`);

  // Container có con → xoá kèm toàn bộ con.
  const kids = formDef.isContainer(node) ? formDef.collectAllFields(node).filter(f => f.node !== node) : [];
  if (kids.length) {
    console.log(`  ⚠ container chứa ${kids.length} field con — sẽ xoá KÈM: ${kids.map(k => k.key).join(', ')}`);
    if (!dryRun && !flags.has('--force')) throw new Error('Xoá container sẽ xoá cả field con. Thêm --force nếu chắc chắn.');
  }

  // Rào chắn tham chiếu (chính node + con).
  const src = refSources(dir, form);
  const g = require('../../graph').load(st.customer, st.env);
  /** @type {string[]} */ const hits = [];
  /** @type {string[]} */ const copies = [];
  for (const n of [node, ...kids.map(k => k.node)]) {
    hits.push(...refHits(def, src, n));
    const ext = externalHits(g, dir, n);
    hits.push(...ext.hits); copies.push(...ext.copies);
  }
  if (copies.length) {
    console.log('  ℹ field còn ở bản nhúng của form khác (cần propagate sau khi xoá):');
    for (const c of [...new Set(copies)]) console.log('    - ' + c);
  }
  if (hits.length) {
    console.log('  ⚠ đang bị tham chiếu:');
    for (const h of [...new Set(hits)]) console.log('    - ' + h);
    if (dryRun) console.log('  → sẽ bị CHẶN nếu không có --force.');
    else if (!flags.has('--force')) throw new Error('Xoá sẽ làm hỏng các chỗ trên. Thêm --force nếu chắc chắn.');
    else console.log('  (--force) vẫn xoá.');
  }
  const uiFolder = path.join(tree.uiDir(dir), safeName(key));
  if (fs.existsSync(uiFolder)) console.log(`  ℹ có custom UI (ui/${safeName(key)}) — sẽ xoá kèm.`);

  if (dryRun) return console.log('\n[DRY-RUN] Không gửi gì lên server.');
  formDef.removeField(def, { hashid: node.hashid, key });
  await api.putForm(sess, formDef.buildOwnerFormPayload(form, def, wasString));
  console.log('  ✓ đã xoá trên server.');

  if (fs.existsSync(uiFolder)) { fs.rmSync(uiFolder, { recursive: true, force: true }); console.log('  ✓ đã xoá ui/' + safeName(key)); }
  await resyncLocal(dir, st, sess);
  require('./push').warnEmbedders(st);
  store.audit({ op: 'field-delete', formId: st.formId, customer: st.customer, env: st.env, field: key, type: node.type });
  console.log('\n✓ Xoá xong.');
}

/** Danh sách template (tên type + biến thể). */
function templateTypes() {
  try { return fs.readdirSync(TPL_DIR).filter(f => f.endsWith('.json')).map(f => f.replace(/\.json$/, '')); }
  catch (_) { return []; }
}

/** Thêm 1 field mới từ node mẫu vào form trên server + đồng bộ local. */
async function add(/** @type {string} */ target, /** @type {string} */ type, /** @type {Set<string>} */ flags, /** @type {Record<string,string>} */ opts, /** @type {string[]} */ argv) {
  const dir = path.resolve(target);
  if (!tree.isForm(dir)) throw new Error('Không phải form folder: ' + target);
  const tpl = readJson(path.join(TPL_DIR, safeName(type) + '.json'), null);
  if (!tpl) throw new Error(`Không có node mẫu cho "${type}". Có sẵn: ${templateTypes().join(', ')}`);

  const st = inspect.listStates(dir).find(s => s.dir === dir) || inspect.formState(dir);
  const level = inspect.LEVEL[st.guard];
  if (level === 'error' || level === 'block') throw new Error(st.why + ' Dừng.');
  if (!st.formId) throw new Error('Không xác định được formId đích.');
  const dryRun = flags.has('--dry-run');
  if (st.env === 'prod' && !flags.has('--yes-prod')) throw new Error('Đích là PROD — thêm --yes-prod để xác nhận.');

  const sess = await api.open(st.customer, st.env);
  const form = await api.getForm(sess, st.formId);
  const { def, wasString } = formDef.parseFormDef(form);
  if (!def) throw new Error('Form trên server không có jsonForm — không thêm được field.');

  // Dựng node mới từ mẫu: danh tính mới, cấu hình reset tối thiểu.
  const realType = tpl.type || type;   // template biến thể (dropdown.datasource) vẫn có type="dropdown"
  const idx = formDef.nextTypeIndex(def, realType);
  const key = `${realType}-${idx}`;
  const node = JSON.parse(JSON.stringify(tpl));
  delete node._hasCustomUI;
  node.type = realType;
  node.hashid = formDef.newHashid(def);
  node.id = `${st.formId}_${key}`;
  node.label = opts['--label'] || `${type} mới`;
  if (['h1', 'h2', 'h3', 'text'].includes(realType) && opts['--label']) {
    node.value = opts['--label'];
  } else if (realType === 'upload_img') {
    // giữ nguyên url ảnh logo từ template
    node.readonly = true;
  } else if (typeof node.value === 'string') {
    node.value = '';
  }
  if ('code' in node) node.code = '';
  // Reset trạng thái "vô tình" của node mẫu về mặc định hợp lý cho field mới.
  if ('readonly' in node && realType !== 'upload_img') node.readonly = false;
  if ('display' in node) node.display = true;
  if (flags.has('--hidden')) node.display = false;
  if (node.validate && 'required' in node.validate) node.validate.required = false;
  if ('--required' in opts) { node.validate = node.validate || {}; node.validate.required = toBool(opts['--required'], 'required'); }
  if ('--readonly' in opts) node.readonly = toBool(opts['--readonly'], 'readonly');
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] !== '--set') continue;
    const kv = argv[++i] || ''; const eq = kv.indexOf('=');
    if (eq < 0) throw new Error(`--set cần path=value, nhận "${kv}".`);
    deepSet(node, kv.slice(0, eq), coerce(kv.slice(eq + 1)));
  }

  const after = opts['--after'] || null;
  const before = opts['--before'] || null;
  for (const a of [after, before]) if (a) formDef.findUniqueNode(def, a);   // mốc chèn trùng key → báo lỗi
  console.log(`Thêm field "${key}" [${realType}] hashid ${node.hashid} vào ${st.formId}  (${st.customer}/${st.env})${dryRun ? '   [DRY-RUN]' : ''}`);
  console.log(`  label: "${node.label}"${after ? `  · chèn sau: ${after}` : before ? `  · chèn trước: ${before}` : '  · nối cuối trang cuối'}`);
  if (!formDef.insertField(def, node, { after, before })) {
    throw new Error(after ? `Không tìm thấy field "${after}" để chèn sau.` : before ? `Không tìm thấy field "${before}" để chèn trước.` : 'Không tìm thấy trang (page) nào để chèn.');
  }
  if (dryRun) return console.log('\n[DRY-RUN] Không gửi gì lên server.');

  await api.putForm(sess, formDef.buildOwnerFormPayload(form, def, wasString));
  console.log('  ✓ đã thêm trên server.');

  // Server có thể THAY hashid tự đặt khi lưu → đọc lại bản server để lấy hashid/cấu hình thật.
  const saved = formDef.findNodes(formDef.parseFormDef(await api.getForm(sess, st.formId)).def, node.id)[0];
  if (!saved) throw new Error(`Đã PUT nhưng không thấy ${node.id} trên server — kiểm tra lại form (backup ở .kyta/backups).`);
  if (saved.hashid !== node.hashid) console.log(`  ℹ server đổi hashid ${node.hashid} → ${saved.hashid} (dùng hashid này cho kế thừa eFlow/eWriter).`);
  Object.assign(node, saved);

  // Đồng bộ local: nối entry vào fields.json + snapshot (giữ nguyên lệch của field khác).
  const doc = /** @type {import('../fields').FieldsDoc} */ (fields.readDoc(dir) || { formId: st.formId, fields: [] });
  doc.fields.push({ key, id: node.id, hashid: node.hashid, type: realType, label: node.label, config: fields.toConfig(node) });
  fields.writeDoc(dir, doc);
  const snapId = st.identityId || st.formId;
  const snap = store.getSnapshot(snapId);
  if (snap) {
    const nf = { ...(snap.fields || {}) };
    nf[node.hashid] = hash(JSON.stringify(fields.toConfig(node)));
    store.saveSnapshot(snapId, snap.files || {}, snap.ui, nf);
  }
  store.audit({ op: 'field-add', formId: st.formId, customer: st.customer, env: st.env, field: key, type: realType });
  require('./push').warnEmbedders(st);
  console.log(`\n✓ Thêm field xong. Key: ${key}  hashid: ${node.hashid}`);
}

/** Mở form để sửa cấu trúc: rào chắn env/đích + lấy jsonForm mới nhất. */
async function openForm(/** @type {string} */ target, /** @type {Set<string>} */ flags) {
  const dir = path.resolve(target);
  if (!tree.isForm(dir)) throw new Error('Không phải form folder: ' + target);
  const st = inspect.listStates(dir).find(s => s.dir === dir) || inspect.formState(dir);
  const level = inspect.LEVEL[st.guard];
  if (level === 'error' || level === 'block') throw new Error(st.why + ' Dừng.');
  if (!st.formId) throw new Error('Không xác định được formId đích.');
  if (st.env === 'prod' && !flags.has('--yes-prod')) throw new Error('Đích là PROD — thêm --yes-prod để xác nhận.');
  assertFieldsClean(st, flags);
  const sess = await api.open(st.customer, st.env);
  const form = await api.getForm(sess, st.formId);
  const { def, wasString } = formDef.parseFormDef(form);
  if (!def) throw new Error('Form trên server không có jsonForm.');
  return { dir, st, sess, form, def, wasString, dryRun: flags.has('--dry-run') };
}

/** Lệnh đổi cấu trúc dựng lại fields.json từ server → sửa cục bộ chưa push sẽ mất. Chặn trừ khi --force. */
function assertFieldsClean(/** @type {import('../inspect').FormState} */ st, /** @type {Set<string>} */ flags) {
  const n = st.fields.changed.length + st.fields.added.length + st.fields.removed.length;
  if (!n || flags.has('--dry-run')) return;
  const msg = `fields.json có ${n} field sửa cục bộ chưa push — lệnh này dựng lại fields.json từ server nên sẽ MẤT chúng. Push trước (kyta eform push <form> --fields-only)`;
  if (!flags.has('--force')) throw new Error(msg + ', hoặc thêm --force.');
  console.log('  ⚠ (--force) ' + msg + '.');
}

/** Sau khi đổi cấu trúc: đọc lại bản server (xác nhận đã ghi + hashid thật), dựng lại fields.json + snapshot. */
async function resyncLocal(/** @type {string} */ dir, /** @type {any} */ st, /** @type {any} */ sess) {
  const { def } = formDef.parseFormDef(await api.getForm(sess, st.formId));
  const doc = fields.buildDoc(def, st.formId);
  fields.writeDoc(dir, doc);
  const snapId = st.identityId || st.formId;
  const snap = store.getSnapshot(snapId);
  if (snap) store.saveSnapshot(snapId, snap.files || {}, snap.ui, fields.docHashes(doc));
}

/** Gom nhiều field vào 1 container (columns = nằm ngang, splitter --hidden = nhóm ẩn). */
async function group(/** @type {string} */ target, /** @type {string} */ keysCsv, /** @type {Set<string>} */ flags, /** @type {Record<string,string>} */ opts) {
  const keys = String(keysCsv || '').split(',').map(s => s.trim()).filter(Boolean);
  if (!keys.length) throw new Error('Cần danh sách key, vd: key1,key2,key3');
  const asType = opts['--as'] || 'columns';
  if (!['columns', 'row', 'splitter'].includes(asType)) throw new Error('--as phải là columns | row | splitter.');
  const { dir, st, sess, form, def, wasString, dryRun } = await openForm(target, flags);

  const refs = keys.map(k => {
    const n = formDef.findUniqueNode(def, k);
    if (!n) throw new Error(`Không thấy field "${k}". Xem: kyta eform field list <form>`);
    return { hashid: n.hashid, key: n.hashid ? null : k };
  });
  const anchor = formDef.locateInParent(def, refs[0]);
  const nodes = refs.map(r => formDef.removeField(def, r)).filter(Boolean);

  const idx = formDef.nextTypeIndex(def, asType);
  const ckey = `${asType}-${idx}`;
  /** @type {any} */ const container = { id: `${st.formId}_${ckey}`, type: asType, label: asType, hashid: formDef.newHashid(def), display: flags.has('--hidden') ? false : true, components: nodes };
  if (asType === 'row') { container.width = '100%'; container.placeholder = 'row'; }
  if (asType === 'splitter') container.tooltip = '';
  if (anchor) anchor.array.splice(Math.min(anchor.index, anchor.array.length), 0, container);
  else formDef.insertField(def, container, {});

  console.log(`Gom ${nodes.length} field vào ${asType} "${ckey}"${flags.has('--hidden') ? ' (ẩn)' : ''} — ${st.formId} (${st.customer}/${st.env})${dryRun ? '   [DRY-RUN]' : ''}`);
  keys.forEach(k => console.log('  - ' + k));
  if (dryRun) return console.log('\n[DRY-RUN] Không gửi gì lên server.');
  await api.putForm(sess, formDef.buildOwnerFormPayload(form, def, wasString));
  await resyncLocal(dir, st, sess);
  require('./push').warnEmbedders(st);
  store.audit({ op: 'field-group', formId: st.formId, customer: st.customer, env: st.env, fields: keys, as: asType });
  console.log(`  ✓ đã lưu.\n\n✓ Gom xong. Container: ${ckey}`);
}

/** Chuyển 1 field vào trong 1 container khác. */
async function move(/** @type {string} */ target, /** @type {string} */ key, /** @type {Set<string>} */ flags, /** @type {Record<string,string>} */ opts) {
  const into = opts['--into'];
  if (!into) throw new Error('Cần --into <container key|hashid>.');
  const { dir, st, sess, form, def, wasString, dryRun } = await openForm(target, flags);

  const src = formDef.findUniqueNode(def, key);
  if (!src) throw new Error(`Không thấy field "${key}".`);
  const dst = formDef.findUniqueNode(def, into);
  if (!dst) throw new Error(`Không thấy container "${into}".`);
  if (!formDef.isContainer(dst)) throw new Error(`"${into}" [${dst.type}] không phải container (không ôm components).`);
  if (src === dst) throw new Error('Không thể chuyển field vào chính nó.');

  const node = formDef.removeField(def, { hashid: src.hashid });
  const after = opts['--after'];
  if (after) {
    const i = dst.components.findIndex((/** @type {any} */ el) => el && el.type && (el.hashid === after || (elementKeyOf(el, el.type) || '') === after));
    dst.components.splice(i < 0 ? dst.components.length : i + 1, 0, node);
  } else dst.components.push(node);

  console.log(`Chuyển "${key}" → ${dst.type} "${into}"${after ? ' (sau ' + after + ')' : ''} — ${st.formId} (${st.customer}/${st.env})${dryRun ? '   [DRY-RUN]' : ''}`);
  if (dryRun) return console.log('\n[DRY-RUN] Không gửi gì lên server.');
  await api.putForm(sess, formDef.buildOwnerFormPayload(form, def, wasString));
  await resyncLocal(dir, st, sess);
  require('./push').warnEmbedders(st);
  store.audit({ op: 'field-move', formId: st.formId, customer: st.customer, env: st.env, field: key, into });
  console.log(`  ✓ đã lưu.\n\n✓ Chuyển xong.`);
}

async function run(/** @type {string[]} */ argv) {
  const sub = argv[0];
  if (!sub || !['list', 'get', 'set', 'add', 'group', 'move', 'delete'].includes(sub)) usage(USAGE);

  if (sub === 'group') {
    const { _, flags, opts } = parseArgs(argv.slice(1), { value: ['--as'] });
    const [target, keys] = _;
    if (!target || !keys) usage(USAGE);
    return group(target, keys, flags, opts);
  }
  if (sub === 'move') {
    const { _, flags, opts } = parseArgs(argv.slice(1), { value: ['--into', '--after'] });
    const [target, key] = _;
    if (!target || !key) usage(USAGE);
    return move(target, key, flags, opts);
  }

  if (sub === 'delete') {
    const { _, flags } = parseArgs(argv.slice(1));
    const [target, ref] = _;
    if (!target || !ref) usage(USAGE);
    return del(target, ref, flags);
  }

  if (sub === 'add') {
    const { _, flags, opts } = parseArgs(argv.slice(1), { value: ['--label', '--required', '--readonly', '--after', '--before'] });
    const [target, type] = _;
    if (!target || !type) usage(USAGE);
    return add(target, type, flags, opts, argv.slice(1));
  }

  if (sub === 'list') {
    const { doc } = loadDoc(argv[1] || usage(USAGE));
    const rows = doc.fields.map(f => fields.summarize(f));
    const w = Math.max(3, ...rows.map(r => r.key.length));
    const t = Math.max(4, ...rows.map(r => r.type.length));
    console.log(`${'KEY'.padEnd(w)}  ${'TYPE'.padEnd(t)}  LABEL / cờ`);
    for (const r of rows) {
      const tail = [r.label, r.flags.length ? `[${r.flags.join(', ')}]` : ''].filter(Boolean).join('  ');
      console.log(`${r.key.padEnd(w)}  ${r.type.padEnd(t)}  ${tail}`);
    }
    console.log(`\nTổng: ${rows.length} field.`);
    return;
  }

  if (sub === 'get') {
    const { doc } = loadDoc(argv[1] || usage(USAGE));
    const entry = findEntry(doc, argv[2] || usage(USAGE));
    if (!entry) throw new Error(`Không thấy field "${argv[2]}". Xem: kyta eform field list <form>`);
    console.log(`# ${entry.key}  (${entry.type}, hashid ${entry.hashid || '—'})`);
    console.log(JSON.stringify(entry.config, null, 2));
    return;
  }

  // set
  const { _, flags, opts } = parseArgs(argv.slice(1), { value: VALUE_OPTS });
  const [target, ref] = _;
  if (!target || !ref) usage(USAGE);
  const { dir, doc } = loadDoc(target);
  const entry = findEntry(doc, ref);
  if (!entry) throw new Error(`Không thấy field "${ref}". Xem: kyta eform field list <form>`);
  const cfg = entry.config || (entry.config = {});

  /** @type {string[]} */ const changes = [];
  const apply = (/** @type {string} */ pathStr, /** @type {any} */ v) => { deepSet(cfg, pathStr, v); changes.push(pathStr); };

  if ('--label' in opts) { apply('label', opts['--label']); entry.label = opts['--label']; }
  if ('--placeholder' in opts) apply('placeholder', opts['--placeholder']);
  if ('--tooltip' in opts) apply('tooltip', opts['--tooltip']);
  if ('--description' in opts) apply('description', opts['--description']);
  if ('--value' in opts) apply('value', opts['--value']);
  if ('--required' in opts) apply('validate.required', toBool(opts['--required'], 'required'));
  if ('--readonly' in opts) apply('readonly', toBool(opts['--readonly'], 'readonly'));
  if ('--display' in opts) apply('display', toBool(opts['--display'], 'display'));

  // --set path=value (lặp): parseArgs không giữ nhiều lần → tự quét argv.
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] !== '--set') continue;
    const kv = argv[++i] || '';
    const eq = kv.indexOf('=');
    if (eq < 0) throw new Error(`--set cần dạng path=value, nhận "${kv}".`);
    apply(kv.slice(0, eq), coerce(kv.slice(eq + 1)));
  }

  if (!changes.length) throw new Error('Không có gì để sửa — nêu ít nhất một option (xem: kyta eform field set).');
  fields.writeDoc(dir, doc);
  console.log(`✓ ${entry.key}: đã sửa ${changes.join(', ')} → ${fields.FIELDS_FILE}`);

  if (flags.has('--push')) {
    console.log('\nĐang push (fields-only)...');
    await require('./push').run([target, '--fields-only']);
  } else {
    console.log('Chạy để đẩy lên: kyta eform push ' + target + ' --fields-only');
  }
}

module.exports = { run, usage: USAGE, findEntry, refHits, externalHits, assertFieldsClean, resyncLocal };
