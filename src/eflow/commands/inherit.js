// @ts-check
'use strict';
// Kế thừa dữ liệu của node (variables-configs): list | auto | copy. Logic khớp field: src/eflow/inherit.js.
const api = require('../api');
const modeler = require('../modeler');
const inh = require('../inherit');
const store = require('../../core/store');
const { idOf } = require('../../core/http');
const { formFields } = require('../lookup');
const { parseArgs, usage } = require('../../core/args');

const USAGE = [
  'kyta eflow inherit list <customer> <env> <quy trình> [<node>]',
  'kyta eflow inherit auto <customer> <env> <quy trình> <node đích> [--from <node nguồn|start>] [--replace] [--dry-run]',
  '    khớp field form đích ↔ nguồn theo hashid rồi nhãn+kiểu; mặc định chỉ THÊM field chưa kế thừa, --replace = thay toàn bộ',
  'kyta eflow inherit copy <customer> <env> <quy trình> <node mẫu> <node đích> [--dry-run]',
  '    chép nguyên cấu hình (nguồn + công thức) của node mẫu sang form node đích',
].join('\n');

/**
 * Form gắn vào node (hoặc Start) + field.
 * @param {any[]} forms  api.eforms
 * @param {import('../modeler').Loaded} m
 * @param {string} ref  tên/sid node | start
 */
function nodeForm(forms, m, ref) {
  const isStart = /^start$/i.test(ref);
  const node = isStart ? { rid: '', name: 'Start' } : modeler.findNode(m, ref);
  const form = forms.find(f => (f.userTaskId || '') === node.rid);
  if (!form) throw new Error(`Node "${node.name || node.rid}" chưa gắn form. Xem: kyta eflow form list ...`);
  return { sid: node.rid || null, name: node.name || node.rid, form, fields: formFields(form) };
}

/** Body ghi: giữ id/custId/orgIn bản cũ (nếu có), form đích theo phiên bản đang gắn. */
const body = (/** @type {any} */ m, /** @type {any} */ t, /** @type {any} */ cur, /** @type {any[]} */ sources) => ({
  ...(cur ? { id: cur.id, type: cur.type ?? null, custId: cur.custId, orgIn: cur.orgIn } : {}),
  sources, userTaskId: t.sid, versionId: t.form.versionId, modelerId: m.id, formId: t.form.formId,
});

async function save(/** @type {any} */ sess, /** @type {any} */ obj, /** @type {Record<string, any>} */ log) {
  const r = await api.saveInherit(sess, obj);
  store.audit({ op: 'eflow-inherit', ...log, id: obj.id || idOf(r) });
  console.log(`  ✓ đã ${obj.id ? 'cập nhật' : 'tạo'} config kế thừa${obj.id ? ' ' + obj.id : ''} (${obj.sources.length} dòng).`);
}

async function run(/** @type {string[]} */ argv) {
  const [action, ...rest] = argv;
  const { _, flags, opts } = parseArgs(rest, { value: ['--from'] });
  const [customer, env, ref, nodeA, nodeB] = _;
  if (!['list', 'auto', 'copy'].includes(action) || !customer || !env || !ref) usage(USAGE);
  const dryRun = flags.has('--dry-run');
  const sess = await api.open(customer, env);
  const m = await modeler.load(sess, ref);
  const forms = await api.eforms(sess, m.id);
  const nameOf = (/** @type {string|null} */ sid) => (sid ? m.nodes.find(n => n.rid === sid)?.name || sid : 'Start');

  if (action === 'list') {
    if (!nodeA) {
      const all = await api.inheritAll(sess, m.id);
      console.log(`Kế thừa dữ liệu của "${m.name}": ${all.length} node có cấu hình\n`);
      for (const c of all) console.log(`  ${String(c.sources?.length || 0).padStart(3)} dòng  ${nameOf(c.userTaskId)}  (${c.userTaskId})`);
      return;
    }
    const t = nodeForm(forms, m, nodeA);
    const cur = await api.inheritOf(sess, m.id, /** @type {string} */ (t.sid));
    console.log(`Kế thừa của "${t.name}" — form ${t.form.formCode || t.form.formName}: ${cur?.sources?.length || 0} dòng${cur ? '  (config ' + cur.id + ')' : ''}\n`);
    for (const s of cur?.sources || []) {
      const f = t.fields.find(x => x.hashid === s.elementTarget);
      console.log(`  ${(f ? f.label || f.id : s.elementTarget).padEnd(40)} ← ${inh.describeFormula(s, nameOf)}`);
    }
    return;
  }

  if (!nodeA) usage(USAGE);

  if (action === 'auto') {
    const t = nodeForm(forms, m, nodeA);
    const s = nodeForm(forms, m, opts['--from'] || 'start');
    const cur = await api.inheritOf(sess, m.id, /** @type {string} */ (t.sid));
    const matches = inh.matchFields(t.fields, s.fields);
    const have = new Set((cur?.sources || []).map((/** @type {any} */ x) => x.elementTarget));
    const replace = flags.has('--replace');
    const fresh = matches.filter(x => x.src && (replace || !have.has(x.tgt.hashid)));
    const built = fresh.map(x => inh.buildSource(m.id, s.sid, /** @type {any} */ (x.src), x.tgt));
    const sources = replace ? built : [...(cur?.sources || []), ...built];

    console.log(`Kế thừa tự động "${t.name}" ← "${s.name}"${dryRun ? '   [DRY-RUN]' : ''}`);
    console.log(`  form đích ${t.form.formCode} · nguồn ${s.form.formCode} · đã có ${have.size} dòng · ${replace ? 'THAY TOÀN BỘ' : 'thêm mới'} ${built.length}\n`);
    for (const x of matches) {
      const mark = !x.src ? '  ✗' : have.has(x.tgt.hashid) && !replace ? '  =' : '  +';
      console.log(`${mark} ${String(x.tgt.label || x.tgt.id).padEnd(40)} [${x.tgt.type}]${x.src ? `  ← ${x.src.label || x.src.id}  (${x.by})` : '  (không có field nguồn khớp)'}`);
    }
    console.log('\n  + thêm   = đã kế thừa (giữ nguyên)   ✗ không khớp');
    if (!built.length && !replace) return console.log('  (không có gì để thêm.)');
    if (dryRun) return console.log('\n[DRY-RUN] Không gửi. Mẫu 1 dòng:\n' + JSON.stringify(built[0] || null, null, 1));
    return save(sess, body(m, t, cur, sources), { action, modelerId: m.id, userTaskId: t.sid, from: s.sid, customer, env });
  }

  // copy
  if (!nodeB) usage(USAGE);
  const a = nodeForm(forms, m, nodeA), b = nodeForm(forms, m, nodeB);
  const src = await api.inheritOf(sess, m.id, /** @type {string} */ (a.sid));
  if (!src?.sources?.length) throw new Error(`Node mẫu "${a.name}" chưa có cấu hình kế thừa.`);
  const cur = await api.inheritOf(sess, m.id, /** @type {string} */ (b.sid));
  const { kept, dropped } = inh.retarget(src.sources, a.fields, b.fields);
  console.log(`Chép kế thừa "${a.name}" → "${b.name}"${dryRun ? '   [DRY-RUN]' : ''}`);
  console.log(`  ${kept.length}/${src.sources.length} dòng khớp field form đích${cur ? ` · GHI ĐÈ config hiện có (${cur.sources?.length || 0} dòng)` : ''}`);
  for (const s of kept) console.log(`  + ${String(b.fields.find(f => f.hashid === s.elementTarget)?.label || s.elementTarget).padEnd(40)} ← ${inh.describeFormula(s, nameOf)}`);
  for (const s of dropped) console.log(`  ✗ ${String(a.fields.find(f => f.hashid === s.elementTarget)?.label || s.elementTarget).padEnd(40)} (form đích không có field tương ứng)`);
  if (!kept.length) return console.log('  (không có dòng nào chép được.)');
  if (dryRun) return console.log('\n[DRY-RUN] Không gửi.');
  return save(sess, body(m, b, cur, kept), { action, modelerId: m.id, userTaskId: b.sid, from: a.sid, customer, env });
}

module.exports = { run, usage: USAGE };
