// @ts-check
'use strict';
// "Cái này được dùng ở đâu?" — tra đồ thị workspace (offline) cho form / field / catalog / luồng.
//   kyta where <thư mục | formId | formId_key | hashid | id catalog | tên>  [--customer c --env e] [--json]
const path = require('path');
const fs = require('fs');
const graph = require('../graph');
const paths = require('../core/paths');
const tree = require('../eform/tree');
const specs = require('../core/specs');
const { parseArgs, usage } = require('../core/args');

const USAGE = [
  'kyta where <thư mục | formId | formId_key | hashid | id catalog | id luồng | tên | mã spec> [--customer c --env e] [--json]',
  '',
  '  spec    → workspace/<customer>/specs/{forms,flows,selectors}/ khớp theo mã (tên file) hoặc id trong nội dung',
  '  form    → thư mục, form con nhúng / form cha nhúng nó, form khác dùng token của nó, luồng, eWriter, catalog',
  '  field   → nơi định nghĩa, bản nhúng ở form cha (cờ hashid riêng), code/ui/luồng/eWriter tham chiếu',
  '  catalog → form có dropdown dùng nó + chỗ khác nhắc id',
  '  luồng   → form start + các form xuất hiện trong flow.json',
  '  Không truyền --customer/--env: lấy theo thư mục hiện tại nếu đang ở trong workspace, không thì quét tất cả.',
].join('\n');

const FIELD_ID_RE = /^(0000[0-9A-Za-z]+)_(.+)$/;
const FORM_ID_RE = /^0000[0-9A-Za-z]+$/;
const CATALOG_ID_RE = /^[0-9a-f]{24}$/;
const HASHID_RE = /^[0-9A-Za-z]{9}$/;

/** customer/env cần quét. */
function scopesFor(/** @type {Record<string, string>} */ opts, /** @type {string|null} */ hintPath) {
  const loc = hintPath ? paths.parseWorkspacePath(hintPath) : paths.parseWorkspacePath(process.cwd());
  const customer = opts['--customer'] || loc?.customer;
  const env = opts['--env'] || loc?.env;
  return graph.scopes().filter(s => (!customer || s.customer === customer) && (!env || s.env === env));
}

/**
 * Tra 1 truy vấn trên 1 đồ thị. Trả kết quả có cấu trúc (in hoặc --json).
 * @param {graph.Graph} g
 * @param {string} q
 * @param {string|null} absPath truy vấn là thư mục
 */
function resolve(g, q, absPath) {
  if (absPath) {
    const loc = paths.parseWorkspacePath(absPath);
    if (loc?.module === 'eform' && tree.isForm(absPath)) {
      const id = tree.metaIds(absPath)[0];
      return id ? formReport(g, id) : null;
    }
    const top = loc?.rest?.[0] ? path.join(paths.moduleDir(g.customer, g.env, /** @type {any} */ (loc.module)), loc.rest[0]) : null;
    if (loc?.module === 'eflow') { const f = g.flows.find(x => x.dir === top); return f ? flowReport(g, f) : null; }
    if (loc?.module === 'ecatalog') { const c = g.catalogs.find(x => x.dir === top); return c?.id ? catalogReport(g, c.id) : null; }
    return null;
  }
  const fm = q.match(FIELD_ID_RE);
  if (fm) return fieldReport(g, { id: q });
  if (FORM_ID_RE.test(q)) {
    if (g.byId.has(q)) return formReport(g, q);
    const flow = g.flows.find(f => f.id === q);
    if (flow) return flowReport(g, flow);
    return g.search(q, { prefix: true }).length ? formReport(g, q) : null;
  }
  if (CATALOG_ID_RE.test(q)) return catalogReport(g, q);
  if (HASHID_RE.test(q) && g.forms.some(f => f.doc?.fields.some(x => x.hashid === q))) return fieldReport(g, { hashid: q });
  return nameReport(g, q);
}

/** @param {graph.Graph} g @param {string} id */
function formReport(g, id) {
  const homes = g.byId.get(id) || [];
  const self = homes[0] || null;
  const text = g.search(id, { prefix: true, exclude: fp => homes.some(h => fp.startsWith(h.dir + path.sep)) });
  const notCode = text.filter(t => t.kind !== 'eform');
  return {
    type: 'form', id, scope: `${g.customer}/${g.env}`,
    name: self?.name || null,
    folders: homes.map(h => h.rel),
    embeds: (self?.childIds || []).map(c => ({ id: c, folder: g.form(c)?.rel || null })),
    embeddedIn: g.parentsOf(id).map(f => f.rel),
    codeUsers: g.codeUsersOf(id).map(f => ({ folder: f.rel, count: f.codeRefs[id] })),
    catalogs: (self?.catalogIds || []).map(c => ({ id: c, name: g.catalogs.find(x => x.id === c)?.name || null })),
    flows: dedupe([...g.flows.filter(f => f.startFormId === id).map(f => f.rel + ' (form start)'), ...notCode.filter(t => t.kind === 'eflow').map(t => t.owner)]),
    writers: dedupe(notCode.filter(t => t.kind === 'ewriter').map(t => t.owner)),
    mails: dedupe(notCode.filter(t => t.kind === 'email').map(t => t.owner)),
  };
}

/** @param {graph.Graph} g @param {{ id?: string, hashid?: string }} ref */
function fieldReport(g, ref) {
  /** @typedef {{ folder: string, key: string|null, hashid: string|null, label: string, own: boolean }} Def */
  /** @type {Def[]} */ const defs = [];
  const seen = new Set();
  const add = (/** @type {graph.FormNode} */ f, /** @type {import('../eform/fields').FieldEntry} */ e, /** @type {boolean} */ own) => {
    const k = f.rel + '|' + (e.hashid || e.key);
    if (seen.has(k)) return;
    seen.add(k);
    defs.push({ folder: f.rel, key: e.key, hashid: e.hashid, label: e.label, own });
  };
  let id = ref.id || null;
  // 1) Khớp chính xác theo id (fields.json mới) hoặc hashid.
  for (const f of g.forms) {
    for (const e of f.doc?.fields || []) {
      if (!((ref.id && e.id === ref.id) || (ref.hashid && e.hashid === ref.hashid))) continue;
      id = id || e.id || null;
      const owner = (e.id || '').match(FIELD_ID_RE)?.[1];
      add(f, e, !!owner && f.ids.includes(owner));
    }
  }
  const [, ownerId = null, key = null] = id?.match(FIELD_ID_RE) || [];
  // 2) fields.json cũ chưa có id: tìm theo key trong chính form gốc (duy nhất), rồi bản nhúng theo cùng hashid.
  let legacy = false;
  if (ownerId && key && !defs.some(d => d.own)) {
    const home = g.form(ownerId);
    const hits = (home?.doc?.fields || []).filter(e => e.key === key && (!e.id || e.id === id));
    if (home && hits.length === 1) {
      legacy = true;
      add(home, hits[0], true);
      for (const f of g.forms) if (f !== home) for (const e of f.doc?.fields || []) if (hits[0].hashid && e.hashid === hits[0].hashid) add(f, e, false);
    }
  }
  const home = defs.find(d => d.own) || null;
  const hashids = dedupe(/** @type {string[]} */ (defs.map(d => d.hashid).filter(Boolean)));
  const isDefFile = (/** @type {string} */ fp) => fp.endsWith(path.sep + 'fields.json');
  const byToken = [...(id ? g.search(id, { exclude: isDefFile }) : []), ...hashids.flatMap(h => g.search(h, { exclude: isDefFile }))];
  if (!defs.length && !byToken.length && !(ownerId && g.form(ownerId))) return null;
  return {
    type: 'field', id, hashid: ref.hashid || home?.hashid || hashids[0] || null, scope: `${g.customer}/${g.env}`,
    form: ownerId ? { id: ownerId, folder: g.form(ownerId)?.rel || null } : null,
    label: home?.label ?? defs[0]?.label ?? null,
    copies: defs.filter(d => !d.own).map(d => ({ folder: d.folder, hashid: d.hashid, ownHashid: !!home?.hashid && d.hashid !== home.hashid })),
    legacy,
    refs: mergeRefs(byToken),
  };
}

/** @param {graph.Graph} g @param {string} id */
function catalogReport(g, id) {
  const cat = g.catalogs.find(c => c.id === id);
  return {
    type: 'catalog', id, name: cat?.name || null, folder: cat?.rel || null, scope: `${g.customer}/${g.env}`,
    dropdownUsers: g.catalogUsersOf(id).map(f => f.rel),
    refs: mergeRefs(g.search(id, { exclude: fp => !!cat && fp.startsWith(cat.dir + path.sep) })),
  };
}

/** @param {graph.Graph} g @param {graph.SimpleNode} flow */
function flowReport(g, flow) {
  /** @type {Set<string>} */ const ids = new Set();
  for (const fp of ['flow.json', '.meta.json']) {
    try { for (const m of fs.readFileSync(path.join(flow.dir, fp), 'utf8').matchAll(/0000[0-9A-Za-z]{15,}/g)) ids.add(m[0]); } catch (_) {}
  }
  const forms = [...ids].map(i => ({ id: i, folder: g.form(i)?.rel || null })).filter(x => x.folder || x.id === flow.startFormId);
  return { type: 'flow', id: flow.id, name: flow.name, folder: flow.rel, scope: `${g.customer}/${g.env}`, startForm: flow.startFormId, forms };
}

/** @param {graph.Graph} g @param {string} q */
function nameReport(g, q) {
  const low = q.toLowerCase();
  const has = (/** @type {string} */ s) => String(s || '').toLowerCase().includes(low);
  const forms = g.forms.filter(f => has(f.name) || has(path.basename(f.dir)));
  const flows = g.flows.filter(f => has(f.name));
  const catalogs = g.catalogs.filter(c => has(c.name));
  const writers = g.writers.filter(w => has(w.name));
  // Đúng 1 kết quả → báo cáo đầy đủ luôn.
  if (forms.length + flows.length + catalogs.length + writers.length === 1) {
    if (forms[0]?.ids[0]) return formReport(g, forms[0].ids[0]);
    if (flows[0]) return flowReport(g, flows[0]);
    if (catalogs[0]?.id) return catalogReport(g, catalogs[0].id);
  }
  const res = {
    type: 'name', query: q, scope: `${g.customer}/${g.env}`,
    forms: forms.map(f => ({ id: f.ids[0] || null, folder: f.rel })),
    flows: flows.map(f => ({ id: f.id, folder: f.rel })),
    catalogs: catalogs.map(c => ({ id: c.id, folder: c.rel })),
    writers: writers.map(w => ({ id: w.id, folder: w.rel })),
  };
  return res.forms.length + res.flows.length + res.catalogs.length + res.writers.length ? res : null;
}

const dedupe = (/** @type {string[]} */ a) => [...new Set(a)];

/** Gộp kết quả search theo chủ: { owner: [file (n×)] }. */
function mergeRefs(/** @type {{ kind: string, owner: string, file: string, count: number }[]} */ rows) {
  /** @type {Map<string, { kind: string, owner: string, files: string[] }>} */ const m = new Map();
  for (const r of rows) {
    const k = r.owner;
    const e = m.get(k) || { kind: r.kind, owner: r.owner, files: [] };
    const label = `${path.posix.relative(r.owner, r.file) || path.basename(r.file)} (${r.count}×)`;
    if (!e.files.includes(label)) e.files.push(label);
    m.set(k, e);
  }
  return [...m.values()];
}

/** In báo cáo dạng đọc được. */
function print(/** @type {any} */ r) {
  const ws = (/** @type {string} */ p) => p.replace(/^workspace\//, '');
  const list = (/** @type {string} */ title, /** @type {string[]} */ items) => {
    if (!items.length) return;
    console.log(`  ${title} (${items.length}):`);
    for (const i of items) console.log('    - ' + i);
  };
  if (r.type === 'form') {
    console.log(`FORM ${r.id}  ${r.name || ''}  [${r.scope}]`);
    if (!r.folders.length) console.log('  (chưa có thư mục nào khai formId này trong workspace)');
    if (r.folders.length > 1) console.log(`  ⚠ ${r.folders.length} thư mục cùng khai formId — pull sẽ yêu cầu --into.`);
    list('thư mục', r.folders.map(ws));
    list('nhúng form con', r.embeds.map((/** @type {any} */ e) => `${e.id}  ${e.folder ? ws(e.folder) : '(chưa pull)'}`));
    list('được nhúng ở (child_form)', r.embeddedIn.map(ws));
    list('form khác dùng token', r.codeUsers.map((/** @type {any} */ u) => `${ws(u.folder)} (${u.count}×)`));
    list('catalog dropdown dùng', r.catalogs.map((/** @type {any} */ c) => `${c.id}  ${c.name || ''}`));
    list('luồng eFlow', r.flows.map(ws));
    list('tài liệu eWriter', r.writers.map(ws));
    list('mẫu mail', r.mails.map(ws));
  } else if (r.type === 'field') {
    console.log(`FIELD ${r.id || '?'}  hashid ${r.hashid || '?'}  "${r.label ?? ''}"  [${r.scope}]`);
    if (r.form) console.log(`  form: ${r.form.id}  ${r.form.folder ? ws(r.form.folder) : '(chưa pull)'}`);
    if (r.legacy) console.log('  ℹ fields.json chưa có id (bản pull cũ) — bản nhúng có hashid RIÊNG sẽ không thấy; pull lại để đủ.');
    list('bản nhúng ở form khác', r.copies.map((/** @type {any} */ c) => `${ws(c.folder)}  hashid ${c.hashid}${c.ownHashid ? '  ⚠ HASHID RIÊNG (kế thừa/eWriter trỏ vào đây — refresh phải giữ)' : ''}`));
    list('tham chiếu', r.refs.map((/** @type {any} */ x) => `[${x.kind}] ${ws(x.owner)}: ${x.files.join(', ')}`));
  } else if (r.type === 'catalog') {
    console.log(`CATALOG ${r.id}  ${r.name || ''}  [${r.scope}]${r.folder ? '  ' + ws(r.folder) : ''}`);
    list('form có dropdown dùng', r.dropdownUsers.map(ws));
    list('nhắc id ở', r.refs.map((/** @type {any} */ x) => `[${x.kind}] ${ws(x.owner)}: ${x.files.join(', ')}`));
  } else if (r.type === 'flow') {
    console.log(`LUỒNG ${r.id}  ${r.name}  [${r.scope}]  ${ws(r.folder)}`);
    console.log(`  form start: ${r.startForm || '—'}`);
    list('form xuất hiện trong luồng', r.forms.map((/** @type {any} */ f) => `${f.id}  ${f.folder ? ws(f.folder) : '(chưa pull)'}`));
  } else if (r.type === 'spec') {
    console.log(`SPEC ${r.code}  [${r.customer}/${r.kind}]  ${ws(r.rel)}`);
  } else if (r.type === 'name') {
    console.log(`TÌM "${r.query}"  [${r.scope}]`);
    list('form', r.forms.map((/** @type {any} */ f) => `${f.id || '—'}  ${ws(f.folder)}`));
    list('luồng', r.flows.map((/** @type {any} */ f) => `${f.id}  ${ws(f.folder)}`));
    list('catalog', r.catalogs.map((/** @type {any} */ f) => `${f.id}  ${ws(f.folder)}`));
    list('eWriter', r.writers.map((/** @type {any} */ f) => `${f.id || '—'}  ${ws(f.folder)}`));
  }
}

function run(/** @type {string[]} */ argv) {
  const { _, flags, opts } = parseArgs(argv, { value: ['--customer', '--env'] });
  const q = _[0];
  if (!q) usage(USAGE);
  const abs = fs.existsSync(q) ? path.resolve(q) : null;
  const results = [];
  for (const s of scopesFor(opts, abs)) {
    const r = resolve(graph.load(s.customer, s.env), q, abs);
    if (r) results.push(r);
  }
  if (!abs) {
    const customer = opts['--customer'] || paths.parseWorkspacePath(process.cwd())?.customer;
    for (const s of specs.find(q, customer)) results.push({ type: 'spec', ...s });
  }
  if (flags.has('--json')) return console.log(JSON.stringify(results, null, 2));
  if (!results.length) return console.log(`Không tìm thấy "${q}" trong workspace.`);
  results.forEach((r, i) => { if (i) console.log(''); print(r); });
}

module.exports = { run, usage: USAGE, resolve };
