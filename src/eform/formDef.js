// @ts-check
'use strict';
// Logic thuần trên định nghĩa form (jsonForm): parse, thu field custom UI, dựng payload PUT /owner/form.
const { elementKeyOf } = require('./formId');
const { safeName } = require('../core/fsx');

// File custom UI local ↔ khoá trong customRenderCode.
const UI_PARTS = { 'index.html': 'html', 'style.css': 'css', 'script.js': 'js' };

/** jsonForm có thể là chuỗi JSON (double-encoded) hoặc object → trả object + nhớ dạng gốc. */
function parseFormDef(/** @type {any} */ form) {
  let def = form?.jsonForm;
  const wasString = typeof def === 'string';
  if (wasString) def = JSON.parse(def);
  return { def: def || null, wasString };
}

/** "yyyy-MM-dd HH:mm:ss" → "yyyy/MM/dd" (định dạng modeler gửi khi PUT). */
function toModelerDate(/** @type {any} */ s) {
  if (typeof s !== 'string') return s;
  const m = s.match(/^(\d{4})[-/](\d{2})[-/](\d{2})/);
  return m ? `${m[1]}/${m[2]}/${m[3]}` : s;
}

/**
 * Payload PUT /owner/form GIỐNG modeler: đúng 9 field, đúng kiểu (tag = string, variableArr = array).
 * Gửi nguyên object GET → HTTP 400 "Unable to convert http message".
 * @param {any} form bản GET mới nhất
 * @param {any} def jsonForm đã vá
 * @param {boolean} wasString dạng gốc của jsonForm
 */
function buildOwnerFormPayload(form, def, wasString) {
  let variableArr = form.variableArr;
  if (typeof variableArr === 'string') { try { variableArr = JSON.parse(variableArr); } catch (_) { variableArr = []; } }
  // API không tự sinh variableArr như designer → thiếu biến thì child_form không render. Luôn đồng bộ theo def.
  variableArr = syncVariableArr(Array.isArray(variableArr) ? variableArr : [], def, form.formId);
  const tag = Array.isArray(form.tag) ? form.tag.join(',') : form.tag == null ? '' : String(form.tag);
  return {
    beginTime: toModelerDate(form.beginTime),
    describeForm: form.describeForm ?? '',
    endTime: toModelerDate(form.endTime),
    formCode: form.formCode,
    formName: form.formName,
    formId: form.formId,
    tag,
    jsonForm: wasString ? JSON.stringify(def) : def,
    variableArr,
  };
}

/**
 * variableArr như designer sinh: mọi node có id + type (trừ page), kể cả container bố cục và field nhúng
 * trong child_form. Đã đối chiếu 17/17 với form lưu bằng designer.
 * @returns {{ code: string, variableName: any, variableType: string }[]}
 */
function genVariableArr(/** @type {any} */ def) {
  /** @type {{ code: string, variableName: any, variableType: string }[]} */ const out = [];
  const seen = new Set();
  (function walk(/** @type {any} */ n) {
    if (!n || typeof n !== 'object') return;
    if (Array.isArray(n)) return n.forEach(walk);
    if (typeof n.id === 'string' && n.id && typeof n.type === 'string' && n.type !== 'page' && !seen.has(n.id)) {
      seen.add(n.id);
      out.push({ code: n.id, variableName: n.label ?? n.type, variableType: n.type });
    }
    for (const k in n) walk(n[k]);
  })(def);
  return out;
}

/**
 * Gộp variableArr hiện có với biến sinh từ def: giữ nguyên entry cũ (kể cả biến form con không còn node),
 * thêm biến còn thiếu, bỏ biến CỦA CHÍNH form này mà node đã bị xoá.
 * @param {any[]} existing
 * @param {any} def
 * @param {string|null|undefined} formId
 */
function syncVariableArr(existing, def, formId) {
  const gen = def && typeof def === 'object' ? genVariableArr(def) : [];
  const genCodes = new Set(gen.map(v => v.code));
  const own = formId ? formId + '_' : null;
  const seen = new Set();
  const out = [];
  for (const v of existing) {
    const code = v && typeof v.code === 'string' ? v.code : null;
    if (code && own && code.startsWith(own) && !genCodes.has(code)) continue;
    if (code) { if (seen.has(code)) continue; seen.add(code); }
    out.push(v);
  }
  for (const v of gen) if (!seen.has(v.code)) { seen.add(v.code); out.push(v); }
  return out;
}

/**
 * @typedef {{ hashid: string|null, type: string, index: number, key: string|null, dir: string, node: any }} CustomField
 */

/**
 * Thu các field custom UI (renderMode = custom_code). `node` trỏ thẳng vào cây def → sửa được để push.
 * Tên thư mục = element key thật (khớp code động), không đọc được thì "<type>-<thứ tự>".
 * @returns {CustomField[]}
 */
function collectCustomFields(/** @type {any} */ def) {
  /** @type {CustomField[]} */ const acc = [];
  /** @type {Record<string, number>} */ const typeCount = {};
  const usedDirs = new Set();
  (function walk(/** @type {any} */ node) {
    if (Array.isArray(node)) return node.forEach(walk);
    if (!node || typeof node !== 'object') return;
    if (node.renderMode === 'custom_code') {
      if (!node.customRenderCode) node.customRenderCode = {};
      const type = node.type || 'field';
      const index = (typeCount[type] = (typeCount[type] || 0) + 1);
      const key = elementKeyOf(node, type);
      // Field form vỏ và field nhúng từ form con có thể trùng key (vd table_advance-2) → thư mục thêm hậu tố hashid
      let dir = safeName(key || `${type}-${index}`);
      if (usedDirs.has(dir)) dir = safeName(`${dir}__${node.hashid || index}`);
      for (let i = 2; usedDirs.has(dir); i++) dir = safeName(`${dir.replace(/~\d+$/, '')}~${i}`);   // 2 bản nhúng cùng hashid
      usedDirs.add(dir);
      acc.push({ hashid: node.hashid || null, type, index, key, dir, node });
    }
    for (const k in node) walk(node[k]);
  })(def);
  return acc;
}

/**
 * Hàm tìm field server cho 1 thư mục ui/<folder>: ưu tiên hashid lưu trong meta, fallback theo tên thư mục.
 * @param {CustomField[]} fields
 * @param {any} meta .meta.json của form
 * @returns {(folder: string) => CustomField|null}
 */
function fieldLocator(fields, meta) {
  const byHash = new Map(fields.filter(f => f.hashid).map(f => [f.hashid, f]));
  const byDir = new Map(fields.map(f => [f.dir, f]));
  const hashOf = new Map((meta?.customUI || []).map((/** @type {any} */ u) => [u.dir, u.hashid]));
  /** @type {Record<string, number>} */ const hashCount = {};
  for (const f of fields) if (f.hashid) hashCount[f.hashid] = (hashCount[f.hashid] || 0) + 1;
  // hashid trùng (2 bản nhúng cùng form con) → chỉ tên thư mục phân biệt được
  return folder => {
    const h = hashOf.get(folder);
    if (h && hashCount[h] > 1) return byDir.get(folder) || null;
    return byHash.get(h) || byDir.get(folder) || null;
  };
}

// Container thuần bố cục — không mang cấu hình field đáng sửa (chỉ ôm components).
const LAYOUT_TYPES = new Set(['page', 'columns', 'row']);

/**
 * @typedef {{ hashid: string|null, type: string, index: number, key: string|null, label: string, node: any }} FormField
 */

/**
 * Thu MỌI field có thể cấu hình (khác collectCustomFields chỉ lấy custom_code).
 * Bỏ qua container bố cục (page/columns/row) và node không có hashid (variable/func/static).
 * `node` trỏ thẳng vào cây def → sửa được rồi push.
 * @returns {FormField[]}
 */
function collectAllFields(/** @type {any} */ def) {
  /** @type {FormField[]} */ const acc = [];
  /** @type {Record<string, number>} */ const typeCount = {};
  (function walk(/** @type {any} */ node) {
    if (Array.isArray(node)) return node.forEach(walk);
    if (!node || typeof node !== 'object') return;
    const type = typeof node.type === 'string' ? node.type : null;
    if (type && node.hashid && !LAYOUT_TYPES.has(type)) {
      const index = (typeCount[type] = (typeCount[type] || 0) + 1);
      const key = elementKeyOf(node, type) || `${type}-${index}`;
      const label = typeof node.label === 'string' && node.label ? node.label
        : typeof node.value === 'string' ? node.value : '';
      acc.push({ hashid: node.hashid || null, type, index, key, label, node });
    }
    for (const k in node) walk(node[k]);
  })(def);
  return acc;
}

/**
 * Định vị field trên server theo (hashid ưu tiên) rồi (key). Dùng khi push cấu hình field.
 * @param {FormField[]} fields
 * @returns {(ref: { hashid?: string|null, key?: string|null }) => FormField|null}
 */
function fieldFinder(fields) {
  const byHash = new Map(fields.filter(f => f.hashid).map(f => [f.hashid, f]));
  const byKey = new Map(fields.filter(f => f.key).map(f => [f.key, f]));
  return ref => (ref.hashid && byHash.get(ref.hashid)) || (ref.key && byKey.get(ref.key)) || null;
}

/**
 * Gỡ MỘT node field khỏi cây def (splice khỏi mảng cha). Khớp theo hashid (ưu tiên) rồi key.
 * @param {any} def
 * @param {{ hashid?: string|null, key?: string|null }} ref
 * @returns {any|null} node đã gỡ, hoặc null nếu không thấy
 */
function removeField(def, ref) {
  const match = (/** @type {any} */ el) => el && typeof el === 'object' && el.type
    && ((ref.hashid && el.hashid === ref.hashid)
      || (!ref.hashid && ref.key && (elementKeyOf(el, el.type) || '') === ref.key));
  let removed = null;
  (function walk(/** @type {any} */ node) {
    if (removed || !node || typeof node !== 'object') return;
    if (Array.isArray(node)) {
      const i = node.findIndex(match);
      if (i >= 0) { removed = node[i]; node.splice(i, 1); return; }
      node.forEach(walk);
    } else {
      for (const k in node) { if (removed) return; walk(node[k]); }
    }
  })(def);
  return removed;
}

/** Chỉ số kế tiếp cho 1 type ("textField" → 3 nếu đã có textField-1,-2). */
function nextTypeIndex(/** @type {any} */ def, /** @type {string} */ type) {
  let max = 0;
  for (const f of collectAllFields(def)) {
    const m = f.key && f.key.match(new RegExp('^' + type.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '-(\\d+)$'));
    if (m) max = Math.max(max, Number(m[1]));
  }
  return max + 1;
}

/** hashid mới, 9 ký tự base62, chắc chắn không trùng trong def. */
function newHashid(/** @type {any} */ def) {
  const used = new Set(collectAllFields(def).map(f => f.hashid).filter(Boolean));
  const gen = () => Array.from({ length: 9 }, () => 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'[Math.floor(Math.random() * 62)]).join('');
  let h = gen();
  while (used.has(h)) h = gen();
  return h;
}

/**
 * Chèn node field vào cây def. `after` = chèn ngay sau field có key/hashid đó (cùng mảng cha);
 * không có → nối vào cuối components của page cuối (hoặc mảng gốc).
 * @returns {boolean} chèn được không
 */
function insertField(/** @type {any} */ def, /** @type {any} */ node, /** @type {{ after?: string|null, before?: string|null }} */ opt = {}) {
  if (opt.before) {
    let done = false;
    (function walk(/** @type {any} */ n) {
      if (done || !n || typeof n !== 'object') return;
      if (Array.isArray(n)) {
        const i = n.findIndex(el => el && typeof el === 'object' && el.type
          && (el.hashid === opt.before || (elementKeyOf(el, el.type) || '') === opt.before));
        if (i >= 0) { n.splice(i, 0, node); done = true; return; }
        n.forEach(walk);
      } else for (const k in n) { if (done) return; walk(n[k]); }
    })(def);
    return done;
  }
  if (opt.after) {
    let done = false;
    (function walk(/** @type {any} */ n) {
      if (done || !n || typeof n !== 'object') return;
      if (Array.isArray(n)) {
        const i = n.findIndex(el => el && typeof el === 'object' && el.type
          && (el.hashid === opt.after || (elementKeyOf(el, el.type) || '') === opt.after));
        if (i >= 0) { n.splice(i + 1, 0, node); done = true; return; }
        n.forEach(walk);
      } else for (const k in n) { if (done) return; walk(n[k]); }
    })(def);
    return done;
  }
  // nối vào page cuối
  /** @type {any[]} */ const pages = [];
  (function walk(/** @type {any} */ n) {
    if (!n || typeof n !== 'object') return;
    if (Array.isArray(n)) return n.forEach(walk);
    if (n.type === 'page' && Array.isArray(n.components)) pages.push(n);
    for (const k in n) walk(n[k]);
  })(def);
  if (pages.length) { pages[pages.length - 1].components.push(node); return true; }
  if (Array.isArray(def)) { def.push(node); return true; }
  if (Array.isArray(def.components)) { def.components.push(node); return true; }
  return false;
}

/** Loại là container (ôm components). */
const CONTAINER_TYPES = new Set(['page', 'columns', 'row', 'splitter', 'step', 'tab']);
const isContainer = (/** @type {any} */ node) => !!node && Array.isArray(node.components);

/**
 * Vị trí (mảng cha + chỉ số) của 1 field/container trong cây. Dùng để chèn lại đúng chỗ.
 * @param {any} def
 * @param {{ hashid?: string|null, key?: string|null }} ref
 * @returns {{ array: any[], index: number }|null}
 */
function locateInParent(def, ref) {
  /** @type {{ array: any[], index: number }|null} */ let hit = null;
  (function walk(/** @type {any} */ n) {
    if (hit || !n || typeof n !== 'object') return;
    if (Array.isArray(n)) {
      const i = n.findIndex(el => el && typeof el === 'object' && el.type
        && ((ref.hashid && el.hashid === ref.hashid) || (!ref.hashid && ref.key && (elementKeyOf(el, el.type) || '') === ref.key)));
      if (i >= 0) { hit = { array: n, index: i }; return; }
      n.forEach(walk);
    } else for (const k in n) { if (hit) return; walk(n[k]); }
  })(def);
  return hit;
}

/**
 * Tìm node BẤT KỲ (kể cả container columns/row) theo hashid → key. Khác fieldFinder (bỏ container bố cục).
 * @param {any} def
 * @param {{ hashid?: string|null, key?: string|null }} ref
 * @returns {any|null}
 */
function findNode(def, ref) {
  let hit = null;
  (function walk(/** @type {any} */ n) {
    if (hit || !n || typeof n !== 'object') return;
    if (Array.isArray(n)) return n.forEach(walk);
    if (n.type && ((ref.hashid && n.hashid === ref.hashid) || (!ref.hashid && ref.key && (elementKeyOf(n, n.type) || '') === ref.key))) { hit = n; return; }
    for (const k in n) { if (hit) return; walk(n[k]); }
  })(def);
  return hit;
}

/**
 * Mọi node khớp 1 tham chiếu: hashid, id đầy đủ "<formId>_<key>" hoặc key ngắn.
 * @param {any} def
 * @param {string} ref
 * @returns {any[]}
 */
function findNodes(def, ref) {
  /** @type {any[]} */ const out = [];
  (function walk(/** @type {any} */ n) {
    if (!n || typeof n !== 'object') return;
    if (Array.isArray(n)) return n.forEach(walk);
    if (n.type && (n.hashid === ref || n.id === ref || (elementKeyOf(n, n.type) || '') === ref)) out.push(n);
    for (const k in n) walk(n[k]);
  })(def);
  return out;
}

/**
 * Như findNodes nhưng bắt buộc DUY NHẤT. Form cha nhúng form con thường trùng key ngắn (dropdown-1 của cha
 * và của form con) → báo lỗi kèm hashid để chỉ định lại, thay vì sửa nhầm node đầu tiên gặp.
 * @param {any} def
 * @param {string} ref
 * @returns {any|null}
 */
function findUniqueNode(def, ref) {
  const hits = findNodes(def, ref);
  if (hits.length > 1) {
    const list = hits.map(n => `    ${n.hashid || '—'}  ${n.id || n.type}  "${n.label || ''}"`).join('\n');
    throw new Error(`"${ref}" khớp ${hits.length} node (key trùng giữa form và form con nhúng) — chỉ định bằng hashid:\n${list}`);
  }
  return hits[0] || null;
}

/**
 * Nội dung field của 1 form def, đã bóc lớp `page` (child_form nhúng dạng phẳng như vậy).
 * @param {any} def
 * @returns {any[]}
 */
function contentComponents(def) {
  const top = Array.isArray(def) ? def : [def];
  /** @type {any[]} */ const out = [];
  for (const n of top) {
    if (n && n.type === 'page' && Array.isArray(n.components)) out.push(...n.components);
    else if (n) out.push(n);
  }
  return out;
}

/** Thu mọi node theo type (không đệ quy vào chính nó khi trùng). */
function collectByType(/** @type {any} */ def, /** @type {string} */ type) {
  /** @type {any[]} */ const out = [];
  (function walk(/** @type {any} */ n) {
    if (!n || typeof n !== 'object') return;
    if (Array.isArray(n)) return n.forEach(walk);
    if (n.type === type) out.push(n);
    for (const k in n) walk(n[k]);
  })(def);
  return out;
}

module.exports = {
  UI_PARTS, parseFormDef, toModelerDate, buildOwnerFormPayload, genVariableArr, syncVariableArr,
  collectCustomFields, fieldLocator, collectAllFields, fieldFinder, removeField,
  nextTypeIndex, newHashid, insertField, locateInParent, findNode, findNodes, findUniqueNode, CONTAINER_TYPES, isContainer,
  contentComponents, collectByType,
};
