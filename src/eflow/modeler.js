// @ts-check
'use strict';
// Quy trình eFlow: lưu local + đọc đồ thị node từ jsonXml (BPMN JSON) để tra node theo tên.
// Local: workspace/<customer>/<env>/eflow/<tên>/{flow.json (= jsonXml nguyên văn), .meta.json}
const api = require('./api');
const { pickOne } = require('../core/pick');

/** @type {import('../core/sync').Spec} */
const SPEC = { module: 'eflow', file: 'flow.json', field: 'jsonXml', noun: 'quy trình' };

// Field biên tập được, đồng bộ khi push --with-meta.
const META_FIELDS = ['name', 'keyValue', 'description', 'formId', 'formVersion', 'formName',
  'workDay', 'workTime', 'totalTime', 'remindTime', 'mailTemplate', 'attribute'];

// Shape không phải tác vụ (dây, cổng, start/end) — bỏ qua khi tra node theo tên.
const NON_TASK = new Set(['SequenceFlow', 'ParallelGateway', 'ExclusiveGateway', 'StartNoneEvent', 'EndNoneEvent']);

/**
 * @typedef {{ rid: string, name: string, stencil: string }} Node
 * @typedef {{ id: string, name: string, keyValue: string, custId: any, orgIn: any, processId: string|null,
 *   nodes: Node[], succ: Record<string, string[]> }} Loaded
 */

/** Tìm modeler theo id | keyValue | tên. */
async function findModeler(/** @type {import('./api').Session} */ sess, /** @type {string} */ ref) {
  return pickOne(await api.list(sess), ref, {
    what: 'quy trình', id: m => m.id, names: m => [m.keyValue, m.name],
    show: m => `${m.id}  ${String(m.keyValue || '').padEnd(20)} ${m.name}`,
    hint: 'Xem: kyta eflow list <customer> <env>',
  });
}

/**
 * Đồ thị từ BPMN JSON đã parse: node + node kế tiếp (đi xuyên qua SequenceFlow).
 * @param {{ id: string, name: string, keyValue: string, custId?: any, orgIn?: any }} sum
 * @param {any} model
 * @returns {Loaded}
 */
function graph(sum, model) {
  const shapes = /** @type {any[]} */ (model?.childShapes || []);
  /** @type {Record<string, any>} */ const byId = {};
  shapes.forEach(s => { byId[s.resourceId] = s; });

  /** @type {Record<string, string[]>} */ const succ = {};
  for (const s of shapes) {
    succ[s.resourceId] = (s.outgoing || []).map((/** @type {any} */ o) => {
      const t = byId[o.resourceId];
      if (t?.stencil?.id !== 'SequenceFlow') return o.resourceId;
      return t.target?.resourceId || t.outgoing?.[0]?.resourceId;   // dây → node đích
    }).filter(Boolean);
  }
  return {
    id: sum.id, name: sum.name, keyValue: sum.keyValue, custId: sum.custId, orgIn: sum.orgIn,
    processId: model?.modelId || null,   // processId của implementer = modelId trong jsonXml (khác id modeler)
    nodes: shapes.map(s => ({ rid: s.resourceId, name: s.properties?.name || '', stencil: s.stencil?.id || '' })),
    succ,
  };
}

/** jsonXml (chuỗi) → object; chuỗi bị mã hoá 2 lần thì giải thêm 1 lần. */
function parseJsonXml(/** @type {string|null|undefined} */ text) {
  let v = JSON.parse(text || '{}');
  if (typeof v === 'string') v = JSON.parse(v);
  return v;
}

/**
 * Nạp modeler + danh sách node + bản đồ node kế tiếp.
 * @returns {Promise<Loaded>}
 */
async function load(/** @type {import('./api').Session} */ sess, /** @type {string} */ ref) {
  const sum = await findModeler(sess, ref);
  const m = await api.getOne(sess, sum.id);
  let model = {};
  try { model = parseJsonXml(m.jsonXml); } catch (_) {}
  return graph({ ...sum, name: m.name || sum.name, custId: m.custId, orgIn: m.orgIn }, model);
}

/** Dây SequenceFlow: nguồn → đích (sid). */
function edges(/** @type {any} */ model) {
  const shapes = /** @type {any[]} */ (model?.childShapes || []);
  /** @type {Record<string, string>} */ const from = {};
  for (const s of shapes) for (const o of s.outgoing || []) from[o.resourceId] = s.resourceId;
  return shapes.filter(s => s.stencil?.id === 'SequenceFlow')
    .map(s => ({ shape: s, rid: s.resourceId, src: from[s.resourceId] || '', dst: s.target?.resourceId || s.outgoing?.[0]?.resourceId || '' }));
}

/** Tìm node theo sid | tên; trùng tên thì ưu tiên node tác vụ. */
function findNode(/** @type {Loaded} */ loaded, /** @type {string} */ ref) {
  const low = String(ref).toLowerCase();
  let hit = loaded.nodes.filter(n => n.rid === ref);
  if (hit.length !== 1) hit = loaded.nodes.filter(n => n.name.toLowerCase() === low);
  if (hit.length !== 1) hit = loaded.nodes.filter(n => n.name.toLowerCase().includes(low));
  if (hit.length > 1) {
    const tasks = hit.filter(n => !NON_TASK.has(n.stencil));
    if (tasks.length) hit = tasks;
  }
  if (hit.length === 1) return hit[0];
  if (!hit.length) throw new Error(`Không thấy node "${ref}" trong "${loaded.name}". Xem: kyta eflow nodes <customer> <env> "${loaded.keyValue || loaded.name}"`);
  throw new Error(`"${ref}" khớp ${hit.length} node — nêu rõ hơn hoặc dùng sid:\n` + hit.map(n => `   ${n.rid}  [${n.stencil}] ${n.name}`).join('\n'));
}

/** Tìm node loại `stencil` (mặc định eNotify) đứng sau 1 node, lần theo dây tối đa 5 bước. */
function findAfter(/** @type {Loaded} */ loaded, /** @type {string} */ afterRef, stencil = 'eNotify') {
  const from = findNode(loaded, afterRef);
  /** @type {Record<string, Node>} */ const byRid = {};
  loaded.nodes.forEach(n => { byRid[n.rid] = n; });
  const seen = new Set([from.rid]);
  let frontier = [...(loaded.succ[from.rid] || [])];
  for (let depth = 0; depth < 5 && frontier.length; depth++) {
    const hits = frontier.filter(rid => byRid[rid]?.stencil === stencil);
    if (hits.length === 1) return byRid[hits[0]];
    if (hits.length > 1) throw new Error(`Sau "${from.name || from.rid}" có ${hits.length} node ${stencil} — dùng sid:\n` + hits.map(r => `   ${r}`).join('\n'));
    frontier = frontier.filter(rid => !seen.has(rid) && seen.add(rid)).flatMap(rid => loaded.succ[rid] || []);
  }
  throw new Error(`Không thấy node ${stencil} nào sau "${from.name || from.rid}" (trong 5 bước).`);
}

module.exports = { SPEC, META_FIELDS, NON_TASK, findModeler, graph, parseJsonXml, load, edges, findNode, findAfter };
