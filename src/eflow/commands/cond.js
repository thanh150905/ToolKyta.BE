// @ts-check
'use strict';
// Điều kiện trên dây (SequenceFlow): list | fields | set. Cấu trúc + cú pháp: src/eflow/condition.js, docs/eflow-schema.md mục 3.5.
// set chỉ sửa flow.json LOCAL (thư mục đã pull) — đẩy lên bằng `kyta eflow push` sau khi xem lại.
const fs = require('fs');
const path = require('path');
const api = require('../api');
const modeler = require('../modeler');
const cond = require('../condition');
const store = require('../../core/store');
const sync = require('../../core/sync');
const paths = require('../../core/paths');
const { readJson, subdirs } = require('../../core/fsx');
const { scopeIndex, varLabel } = require('../lookup');
const { parseArgs, usage } = require('../../core/args');
const { pickOne, grep } = require('../../core/pick');

const USAGE = [
  'kyta eflow cond list   <customer> <env> <quy trình> [--node <tên|sid>] [--all] [--raw] [--local]',
  'kyta eflow cond list   <thư mục flow đã pull>        [--node ..] [--all] [--raw]',
  'kyta eflow cond fields <customer> <env> <quy trình> [--node <tên|sid|start>] [--grep "x"]',
  'kyta eflow cond set    <customer> <env> <quy trình> <sid dây | "Nguồn->Đích"> --when \'<biểu thức>\' | --clear [--dry-run]',
  '    biểu thức: <field> <op> <giá trị> nối and/or, not, ( )   op: == > < >= <= (!= → not ==)',
  '    field    : "Nhãn" (tìm ở form node trước dây) | "Node::Nhãn" | "start::Nhãn" | id field (dropdown-4)',
  '    vd: --when \'"Xem xét và phê duyệt" == "Đồng ý duyệt" and "start::Loại HĐ" == "Theo mẫu"\'',
].join('\n');

const GATEWAYS = new Set(['ExclusiveGateway', 'ParallelGateway', 'InclusiveGateway']);

/** Thư mục local đã pull của modeler (khớp .meta.json id). */
function localDir(/** @type {string} */ customer, /** @type {string} */ env, /** @type {string} */ id) {
  const hits = [];
  for (const root of paths.moduleRoots('eflow', customer, env)) {
    for (const name of subdirs(root)) {
      const dir = path.join(root, name);
      if (readJson(path.join(dir, sync.META), null)?.id === id) hits.push(dir);
    }
  }
  if (!hits.length) throw new Error(`Chưa pull quy trình ${id} — chạy: kyta eflow pull ${customer} ${env} ${id}`);
  if (hits.length > 1) throw new Error(`Có ${hits.length} thư mục cùng id ${id}:\n${hits.map(h => '   ' + paths.toRepoRel(h)).join('\n')}`);
  return hits[0];
}

/** Ghi model ra flow.json, giữ kiểu định dạng (gọn 1 dòng | thụt lề) của file cũ. */
function writeModel(/** @type {string} */ fp, /** @type {any} */ model, /** @type {string} */ old) {
  const indent = /^\{\r?\n(\s+)/.exec(old)?.[1];
  fs.writeFileSync(fp, indent ? JSON.stringify(model, null, indent) + (old.endsWith('\n') ? '\n' : '') : JSON.stringify(model));
}

/**
 * Nạp quy trình: từ thư mục local (đối số là thư mục) hoặc server; kèm chỉ mục field theo scope.
 * @param {string[]} pos  positional
 * @param {boolean} local  ép đọc flow.json local
 */
async function open(pos, local) {
  /** @type {any} */ let sess, model, sum, dir = null, raw = '';
  if (pos[0] && fs.existsSync(pos[0]) && fs.statSync(pos[0]).isDirectory()) {
    const ld = sync.load(modeler.SPEC, pos[0]);
    sess = await api.open(ld.customer, ld.env);
    dir = ld.dir; raw = ld.content; model = modeler.parseJsonXml(raw);
    sum = { id: ld.meta.id, name: ld.meta.name, keyValue: ld.meta.keyValue, custId: ld.meta.custId, orgIn: ld.meta.orgIn };
    return { sess, model, m: modeler.graph(sum, model), dir, raw, rest: pos.slice(1), customer: ld.customer, env: ld.env, ...await index(sess, ld.meta.id, model, sum) };
  }
  const [customer, env, ref, ...rest] = pos;
  if (!customer || !env || !ref) usage(USAGE);
  sess = await api.open(customer, env);
  sum = await modeler.findModeler(sess, ref);
  if (local) {
    dir = localDir(customer, env, sum.id);
    raw = fs.readFileSync(path.join(dir, modeler.SPEC.file), 'utf8');
  } else {
    const full = await api.getOne(sess, sum.id);
    raw = String(full.jsonXml || '');
    if (/^https?:\/\//.test(raw)) raw = await (await fetch(raw)).text();   // jsonXml lưu trên S3 (xem memory eflow-jsonxml-double-encode)
  }
  model = modeler.parseJsonXml(raw);
  return { sess, model, m: modeler.graph(sum, model), dir, raw, rest, customer, env, ...await index(sess, sum.id, model, sum) };
}

async function index(/** @type {any} */ sess, /** @type {string} */ id, /** @type {any} */ model, /** @type {any} */ sum) {
  const forms = await api.eforms(sess, id);
  return { idx: scopeIndex(forms, modeler.graph(sum, model)) };
}

/** Các node tác vụ đứng ngay trước rid, đi ngược xuyên qua cổng. */
function upstreamTasks(/** @type {import('../modeler').Loaded} */ m, /** @type {string} */ rid) {
  const kind = (/** @type {string} */ r) => m.nodes.find(n => n.rid === r)?.stencil || '';
  /** @type {string[]} */ const out = [];
  const seen = new Set([rid]);
  let frontier = [rid];
  for (let d = 0; d < 6 && frontier.length; d++) {
    frontier = Object.entries(m.succ).filter(([from, tos]) => frontier.some(f => tos.includes(f)) && !seen.has(from)).map(([from]) => from);
    frontier.forEach(f => seen.add(f));
    out.push(...frontier.filter(f => !GATEWAYS.has(kind(f))));
    frontier = frontier.filter(f => GATEWAYS.has(kind(f)));
  }
  return out;
}

/** Tên ngắn của node theo sid; cổng không tên thì ghi theo node tác vụ đứng trước. */
const nodeName = (/** @type {import('../modeler').Loaded} */ m, /** @type {string} */ rid) => {
  const n = m.nodes.find(x => x.rid === rid);
  if (!n) return rid;
  if (n.name || !GATEWAYS.has(n.stencil)) return n.name || `[${n.stencil}]`;
  const before = upstreamTasks(m, rid).map(r => m.nodes.find(x => x.rid === r)?.name).filter(Boolean);
  return before.length ? `[cổng sau "${before.join('", "')}"]` : `[${n.stencil}]`;
};

/** Nhãn biến điều kiện: [node] nhãn field; field ngoài eForm (vd node eContract) → [node] id field. */
const labelOf = (/** @type {import('../modeler').Loaded} */ m, /** @type {any} */ idx) => (/** @type {string} */ id) => {
  if (idx.vars.has(id)) return varLabel(idx, id);
  const dot = id.indexOf('.');
  const scope = id.slice(0, dot);
  return dot > 0 ? `[${scope === m.id ? 'Start' : nodeName(m, scope)}] ${id.slice(dot + 1)}` : id;
};

/** Dây theo sid hoặc "Nguồn->Đích" (Nguồn có thể là node đứng trước chuỗi cổng). */
function findEdge(/** @type {any} */ model, /** @type {import('../modeler').Loaded} */ m, /** @type {string} */ ref) {
  const all = modeler.edges(model);
  const bySid = all.find(e => e.rid === ref);
  if (bySid) return bySid;
  const parts = ref.split(/\s*(?:->|→)\s*/);
  if (parts.length !== 2) throw new Error(`Không thấy dây "${ref}" — dùng sid dây hoặc "Nguồn->Đích". Xem: kyta eflow cond list ... --all`);
  const a = modeler.findNode(m, parts[0]), b = modeler.findNode(m, parts[1]);
  const kind = (/** @type {string} */ rid) => m.nodes.find(n => n.rid === rid)?.stencil || '';
  let hit = all.filter(e => e.src === a.rid && e.dst === b.rid);
  if (!hit.length) hit = all.filter(e => e.dst === b.rid && GATEWAYS.has(kind(e.src)) && upstreamTasks(m, e.src).includes(a.rid));
  if (hit.length === 1) return hit[0];
  if (!hit.length) throw new Error(`Không có dây "${a.name}" → "${b.name}" (trực tiếp hoặc qua cổng).`);
  throw new Error(`Có ${hit.length} dây "${a.name}" → "${b.name}" — dùng sid:\n${hit.map(e => '   ' + e.rid).join('\n')}`);
}

/** Scope mặc định cho field không ghi node: form gần nhất NGƯỢC dòng từ nguồn dây (xuyên cổng).
 *  Nhiều form ngang hàng (nhánh song song) → null: bắt người dùng ghi "Node::Nhãn". Không có form nào → Start. */
function defaultScope(/** @type {import('../modeler').Loaded} */ m, /** @type {any} */ idx, /** @type {string} */ src) {
  /** @type {Record<string, string[]>} */ const pred = {};
  for (const [from, tos] of Object.entries(m.succ)) for (const t of tos) (pred[t] ||= []).push(from);
  let frontier = [src];
  const seen = new Set(frontier);
  for (let d = 0; d < 6 && frontier.length; d++) {
    const withForm = frontier.filter(r => idx.scopes.has(r));
    if (withForm.length === 1) return withForm[0];
    if (withForm.length > 1) return null;
    frontier = frontier.flatMap(r => pred[r] || []).filter(r => !seen.has(r) && seen.add(r));
  }
  return m.id;
}

/** Bộ phân giải tên field → id biến "<scope>.<fieldId>". */
function fieldResolver(/** @type {import('../modeler').Loaded} */ m, /** @type {any} */ idx, /** @type {string|null} */ defScope) {
  /** @param {any} sc @param {string} ref */
  const inScope = (sc, ref) => {
    const f = pickOne(sc.fields, ref, {
      what: `field trong form "${sc.form.formName}" [${sc.node}]`, id: (/** @type {any} */ x) => x.id,
      names: (/** @type {any} */ x) => [x.label, x.hashid, x.id.split('_').pop()],
      show: (/** @type {any} */ x) => `[${x.type}] ${x.label}  (${x.id})`,
    });
    return `${sc.scope}.${f.id}`;
  };
  return (/** @type {string} */ ref) => {
    if (idx.vars.has(ref)) return ref;
    const sep = ref.indexOf('::');
    if (sep >= 0) {
      const nodeRef = ref.slice(0, sep).trim(), fieldRef = ref.slice(sep + 2).trim();
      const scope = /^start$/i.test(nodeRef) ? m.id : modeler.findNode(m, nodeRef).rid;
      const sc = idx.scopes.get(scope);
      if (!sc) throw new Error(`Node "${nodeRef}" không gắn form.`);
      return inScope(sc, fieldRef);
    }
    const def = defScope ? idx.scopes.get(defScope) : null;
    if (def) { try { return inScope(def, ref); } catch (_) { /* thử các form khác */ } }
    /** @type {string[]} */ const hits = [];
    for (const sc of idx.scopes.values()) { try { hits.push(inScope(sc, ref)); } catch (_) {} }
    if (hits.length === 1) return hits[0];
    if (!hits.length) throw new Error(`Không thấy field "${ref}" trong form nào của quy trình. Xem: kyta eflow cond fields ...`);
    throw new Error(`Field "${ref}" có ở ${hits.length} form — ghi rõ "Node::${ref}":\n${hits.map(h => '   ' + varLabel(idx, h)).join('\n')}`);
  };
}

async function run(/** @type {string[]} */ argv) {
  const [action, ...rest] = argv;
  const { _, flags, opts } = parseArgs(rest, { value: ['--node', '--when', '--grep'] });
  if (!['list', 'fields', 'set'].includes(action)) usage(USAGE);
  const ctx = await open(_, action === 'set' || flags.has('--local'));
  const { m, model, idx } = ctx;

  if (action === 'fields') {
    const one = opts['--node'] ? idx.scopes.get(/^start$/i.test(opts['--node']) ? m.id : modeler.findNode(m, opts['--node']).rid) : null;
    if (opts['--node'] && !one) throw new Error(`Node "${opts['--node']}" không gắn form.`);
    const scopes = one ? [one] : [...idx.scopes.values()];
    for (const sc of scopes) {
      const rows = grep(sc.fields.filter((/** @type {any} */ f) => !['page', 'columns', 'child_form', 'splitter', 'h1', 'h2', 'h3', 'text'].includes(f.type)), opts['--grep'], ['label', 'id']);
      if (!rows.length) continue;
      console.log(`● [${sc.node}] ${sc.form.formCode || sc.form.formName}  (scope ${sc.scope})`);
      rows.forEach((/** @type {any} */ f) => console.log(`    [${String(f.type).padEnd(14)}] ${String(f.label).padEnd(40)} ${sc.scope}.${f.id}`));
    }
    return;
  }

  if (action === 'list') {
    const only = opts['--node'] ? modeler.findNode(m, opts['--node']).rid : null;
    const rows = modeler.edges(model).filter(e => !only || e.src === only || e.dst === only || upstreamTasks(m, e.src).includes(only));
    let n = 0;
    console.log(`Điều kiện dây của "${m.name}" (${m.id})${ctx.dir ? '  [local ' + paths.toRepoRel(ctx.dir) + ']' : ''}:\n`);
    for (const e of rows) {
      const ex = e.shape.properties?.conditionsequenceflow?.expression;
      if (!ex && !flags.has('--all')) continue;
      n++;
      let text = '(không điều kiện)';
      if (ex) {
        try { text = cond.describe(cond.parseBlockly(ex.xml).tree, labelOf(m, idx)); } catch (err) { text = `[không đọc được xml: ${err.message}] ${ex.staticValue}`; }
      }
      console.log(`  ${e.rid}\n    ${nodeName(m, e.src)} → ${nodeName(m, e.dst)}\n    ${text}${flags.has('--raw') && ex ? '\n    ' + ex.staticValue : ''}`);
    }
    return console.log(`\n${n} dây${flags.has('--all') ? '' : ' có điều kiện'}.`);
  }

  // set
  const [edgeRef] = ctx.rest;
  if (!edgeRef || (!opts['--when'] && !flags.has('--clear'))) usage(USAGE);
  const dryRun = flags.has('--dry-run');
  const edge = findEdge(model, m, edgeRef);
  const old = edge.shape.properties?.conditionsequenceflow?.expression;
  const label = labelOf(m, idx);
  console.log(`Dây ${edge.rid}: ${nodeName(m, edge.src)} → ${nodeName(m, edge.dst)}${dryRun ? '   [DRY-RUN]' : ''}`);
  console.log(`  cũ : ${old ? cond.describe(cond.parseBlockly(old.xml).tree, label) : '(không điều kiện)'}`);

  /** @type {any} */ let value = '';
  if (!flags.has('--clear')) {
    const tree = cond.parseWhen(opts['--when'], fieldResolver(m, idx, defaultScope(m, idx, edge.src)));
    value = cond.toProperty(tree);
    console.log(`  mới: ${cond.describe(tree, label)}\n  JUEL: ${value.expression.staticValue}`);
  } else console.log('  mới: (không điều kiện)');
  if (dryRun) return console.log('\n[DRY-RUN] Không ghi file.');

  if (!ctx.dir) throw new Error('Không xác định được thư mục local của quy trình.');
  edge.shape.properties.conditionsequenceflow = value;
  const fp = path.join(ctx.dir, modeler.SPEC.file);
  writeModel(fp, model, ctx.raw);
  store.audit({ op: 'eflow-cond-set', modelerId: m.id, edge: edge.rid, customer: ctx.customer, env: ctx.env, clear: flags.has('--clear') });
  console.log(`  ✓ đã ghi ${paths.toRepoRel(fp)}`);
  console.log(`\nChưa đẩy lên server. Xem lại rồi: kyta eflow push "${paths.toRepoRel(ctx.dir)}" --dry-run`);
  console.log('⚠ Lưu ý: jsonXml một số luồng BMW đang bị nền tảng lưu S3/mã hoá 2 lần — kiểm tra luồng mở được trong editor sau khi push.');
}

module.exports = { run, usage: USAGE, findEdge, defaultScope, fieldResolver };
