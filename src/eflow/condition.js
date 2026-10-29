// @ts-check
'use strict';
// Điều kiện trên dây (SequenceFlow): properties.conditionsequenceflow =
//   { expression: { type: 'static', staticValue: '${JUEL}', xml: '<xml>Blockly</xml>' } }   (không điều kiện: "")
// Editor sinh CẢ 2 từ cây block Blockly; tool làm y hệt: chuỗi --when → cây → xml + JUEL.
// Generator khớp bundle eflow (test_block/and_or_block/not_block/compare_block/…_input_block/field_<scope>.<fieldId>).
// scope = id modeler (field form Start) | sid node (field form gắn vào user-task). Xem docs/eflow-schema.md mục 3.5.
const crypto = require('crypto');

const NS = 'https://developers.google.com/blockly/xml';
const root = (x = '30', y = '0') => `<block type="test_block" id="rootBlockId" deletable="false" movable="false" editable="false" x="${x}" y="${y}">`;
const OPS = ['==', '>=', '<=', '>', '<'];   // dropdown compare_block của editor (không có !=)

/**
 * @typedef {{ t: 'field', id: string, bid?: string }
 *   | { t: 'str', v: string, bid?: string }
 *   | { t: 'num', v: string, bid?: string }
 *   | { t: 'bool', v: string, bid?: string }
 *   | { t: 'cmp', op: string, l: Node, r: Node, bid?: string }
 *   | { t: 'not', x: Node, bid?: string }
 *   | { t: 'andor', ops: string[], xs: Node[], bid?: string }} Node
 */

// ---- id block kiểu Blockly.utils.idGenerator.genUid (20 ký tự) ----
const SOUP = '!#$%()*+,-./:;=?@[]^_`{|}~ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
const genUid = () => Array.from(crypto.randomBytes(20), b => SOUP[b % SOUP.length]).join('');

const escText = (/** @type {string} */ s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const escAttr = (/** @type {string} */ s) => escText(s).replace(/"/g, '&quot;');
const unesc = (/** @type {string} */ s) => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&');

// ---- Sinh xml + JUEL ----
/** @param {Node} n @returns {string} */
function blockXml(n) {
  const id = n.bid || (n.bid = genUid());
  const open = (/** @type {string} */ type) => `<block type="${escAttr(type)}" id="${escAttr(id)}">`;
  const val = (/** @type {string} */ name, /** @type {Node} */ x) => /** @type {string} */ (`<value name="${name}">${blockXml(x)}</value>`);
  switch (n.t) {
    case 'field': return `${open('field_' + n.id)}</block>`;
    case 'str': return `${open('string_input_block')}<field name="INPUT">${escText(n.v)}</field></block>`;
    case 'num': return `${open('number_input_block')}<field name="INPUT">${escText(n.v)}</field></block>`;
    case 'bool': return `${open('boolean_input_block')}<field name="INPUT">${escText(n.v)}</field></block>`;
    case 'cmp': return `${open('compare_block')}<field name="OP">${escText(n.op)}</field>${val('LEFT', n.l)}${val('RIGHT', n.r)}</block>`;
    case 'not': return `${open('not_block')}${val('INPUT', n.x)}</block>`;
    case 'andor':
      return `${open('and_or_block')}<mutation ops="${n.ops.length}"></mutation>`
        + n.ops.map((o, i) => `<field name="OPR${i + 1}">${o}</field>`).join('')
        + n.xs.map((x, i) => val('OPD' + i, x)).join('') + '</block>';
  }
}

/** @param {Node} n @returns {string} */
function juel(n) {
  switch (n.t) {
    case 'field': return `execution.getVariable("${n.id}")`;
    case 'str': return `"${n.v}"`;            // editor không escape chuỗi
    case 'num': return n.v || '0';
    case 'bool': return n.v || 'false';
    case 'cmp': return `(${juel(n.l)} ${n.op} ${juel(n.r)})`;
    case 'not': return `(! ${juel(n.x)})`;
    case 'andor': return '(' + n.xs.map((/** @type {Node} */ x, /** @type {number} */ i) => (i ? (n.ops[i - 1] === 'AND' ? ' && ' : ' || ') : '') + juel(x)).join('') + ')';
  }
}

/** Cây → giá trị property conditionsequenceflow. pos = toạ độ block gốc (editor mới 30,0; bản cũ có 0,0). */
function toProperty(/** @type {Node} */ tree, /** @type {{ x?: string, y?: string }} */ pos = {}) {
  const xml = `<xml xmlns="${NS}">${root(pos.x, pos.y)}<value name="VALUE">${blockXml(tree)}</value></block></xml>`;
  return { expression: { type: 'static', staticValue: '${' + juel(tree) + '}', xml } };
}

// ---- Đọc xml Blockly → cây ----
/** @typedef {{ tag: string, attrs: Record<string, string>, kids: El[], text: string }} El */

/** Parser XML tối giản cho đúng dạng xml editor sinh (không comment/CDATA). */
function parseXml(/** @type {string} */ s) {
  /** @type {El} */ const doc = { tag: '#doc', attrs: {}, kids: [], text: '' };
  const stack = [doc];
  const re = /<(\/?)([\w:-]+)((?:\s+[\w:-]+="[^"]*")*)\s*(\/?)>|([^<]+)/g;
  let m;
  while ((m = re.exec(s))) {
    const top = stack[stack.length - 1];
    if (m[5] !== undefined) { top.text += unesc(m[5]); continue; }
    if (m[1]) { stack.pop(); continue; }
    /** @type {Record<string, string>} */ const attrs = {};
    for (const a of m[3].matchAll(/([\w:-]+)="([^"]*)"/g)) attrs[a[1]] = unesc(a[2]);
    /** @type {El} */ const el = { tag: m[2], attrs, kids: [], text: '' };
    top.kids.push(el);
    if (!m[4]) stack.push(el);
  }
  return doc;
}

/** @returns {Node} */
function fromBlock(/** @type {El} */ b) {
  const type = b.attrs.type, bid = b.attrs.id;
  const field = (/** @type {string} */ name) => b.kids.find(k => k.tag === 'field' && k.attrs.name === name)?.text ?? '';
  const value = (/** @type {string} */ name) => {
    const v = b.kids.find(k => k.tag === 'value' && k.attrs.name === name)?.kids.find(k => k.tag === 'block');
    if (!v) throw new Error(`block ${type} thiếu input ${name}`);
    return fromBlock(v);
  };
  if (type.startsWith('field_')) return { t: 'field', id: type.slice(6), bid };
  if (type === 'string_input_block') return { t: 'str', v: field('INPUT'), bid };
  if (type === 'number_input_block') return { t: 'num', v: field('INPUT'), bid };
  if (type === 'boolean_input_block') return { t: 'bool', v: field('INPUT'), bid };
  if (type === 'compare_block') return { t: 'cmp', op: field('OP'), l: value('LEFT'), r: value('RIGHT'), bid };
  if (type === 'not_block') return { t: 'not', x: value('INPUT'), bid };
  if (type === 'and_or_block') {
    const n = Number(b.kids.find(k => k.tag === 'mutation')?.attrs.ops || 0);
    return { t: 'andor', ops: Array.from({ length: n }, (_, i) => field('OPR' + (i + 1))), xs: Array.from({ length: n + 1 }, (_, i) => value('OPD' + i)), bid };
  }
  throw new Error(`block chưa hỗ trợ: ${type}`);
}

/** xml editor → { tree, pos } (pos = toạ độ test_block gốc, để tái tạo y hệt). */
function parseBlockly(/** @type {string} */ xml) {
  const rootEl = parseXml(xml).kids[0]?.kids.find(k => k.attrs.type === 'test_block');
  const top = rootEl?.kids.find(k => k.tag === 'value')?.kids[0];
  if (!rootEl || !top) throw new Error('xml điều kiện không có test_block/VALUE');
  return { tree: fromBlock(top), pos: { x: rootEl.attrs.x, y: rootEl.attrs.y } };
}

// ---- Chuỗi --when → cây ----
/**
 * Cú pháp:  <field> <op> <giá trị>  nối bằng and/or (&&/||), phủ định not/!, nhóm ( ).
 *   field  : "Nhãn" | 'Node::Nhãn' | start::Nhãn | id field (vd textField-25)  — quote khi có dấu cách
 *   op     : == > < >= <=      ( != x  → not (x == ...) )
 *   giá trị: "chuỗi" | số | true | false
 * resolveField(ref) trả id biến "<scope>.<fieldId>".
 * @param {string} text
 * @param {(ref: string) => string} resolveField
 * @returns {Node}
 */
function parseWhen(text, resolveField) {
  /** @type {{ k: 'q'|'op'|'w'|'f', v: string }[]} */ const toks = [];
  const re = /\s*(?:("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')|(==|!=|>=|<=|>|<|&&|\|\||!|\(|\))|([^\s()=!<>&|"']+))/y;
  for (let pos = 0; !/^\s*$/.test(text.slice(pos));) {
    re.lastIndex = pos;
    const m = re.exec(text);
    if (!m) throw new Error(`--when: không đọc được từ vị trí ${pos}: "${text.slice(pos)}"`);
    pos = re.lastIndex;
    if (m[1] !== undefined) toks.push({ k: 'q', v: m[1].slice(1, -1).replace(/\\(.)/g, '$1') });
    else if (m[2] !== undefined) toks.push({ k: 'op', v: m[2] });
    else toks.push({ k: 'w', v: m[3] });
    // Node::"Nhãn có dấu cách" → 1 token field
    const last = toks[toks.length - 1], prev = toks[toks.length - 2];
    if (last.k === 'q' && prev?.k === 'w' && prev.v.endsWith('::')) { toks.pop(); prev.v += last.v; prev.k = 'f'; }
  }
  let i = 0;
  const peek = () => toks[i];
  const isKw = (/** @type {any} */ t, /** @type {string[]} */ ws) => t && ((t.k === 'w' && ws.includes(t.v.toLowerCase())) || (t.k === 'op' && ws.includes(t.v)));
  const fail = (/** @type {string} */ msg) => { throw new Error(`--when: ${msg} (gần token ${i + 1}: ${peek() ? JSON.stringify(peek().v) : 'hết chuỗi'})`); };

  /** @returns {Node} */
  const chain = (/** @type {string[]} */ ws, /** @type {string} */ name, /** @type {() => Node} */ next) => {
    const xs = [next()];
    while (isKw(peek(), ws)) { i++; xs.push(next()); }
    return xs.length === 1 ? xs[0] : { t: 'andor', ops: xs.slice(1).map(() => name), xs };
  };
  /** @returns {Node} */
  const or = () => chain(['or', '||'], 'OR', and);
  /** @returns {Node} */
  const and = () => chain(['and', '&&'], 'AND', unary);
  /** @returns {Node} */
  const unary = () => {
    const t = peek();
    if (isKw(t, ['not', '!'])) { i++; return { t: 'not', x: unary() }; }
    if (t?.k === 'op' && t.v === '(') {
      i++; const x = or();
      if (peek()?.v !== ')') fail('thiếu ")"');
      i++; return x;
    }
    return cmp();
  };
  /** @returns {Node} */
  const cmp = () => {
    const f = peek();
    if (!f || f.k === 'op') fail('cần tên field');   // f.k: w | q | f (Node::"Nhãn")
    i++;
    const o = peek();
    if (!o || o.k !== 'op' || ![...OPS, '!='].includes(o.v)) fail(`cần toán tử ${OPS.join(' ')} (hoặc !=)`);
    i++;
    const v = peek();
    if (!v || v.k === 'op') fail('cần giá trị');
    i++;
    /** @type {Node} */ let r;
    if (v.k === 'q') r = { t: 'str', v: v.v };
    else if (/^-?\d+(\.\d+)?$/.test(v.v)) r = { t: 'num', v: v.v };
    else if (/^(true|false)$/i.test(v.v)) r = { t: 'bool', v: v.v.toLowerCase() };
    else r = { t: 'str', v: v.v };
    /** @type {Node} */ const node = { t: 'cmp', op: o.v === '!=' ? '==' : o.v, l: { t: 'field', id: resolveField(f.v) }, r };
    return o.v === '!=' ? { t: 'not', x: node } : node;
  };
  const root = or();
  if (i < toks.length) fail('thừa token');
  return root;
}

/** Cây → chuỗi đọc được, field dịch qua labelOf(id). @returns {string} */
function describe(/** @type {Node} */ n, /** @type {(id: string) => string} */ labelOf = id => id, top = true) {
  /** @type {string} */ let s;
  switch (n.t) {
    case 'field': return labelOf(n.id);
    case 'str': return JSON.stringify(n.v);
    case 'num': case 'bool': return n.v;
    case 'cmp': return `${describe(n.l, labelOf, false)} ${n.op} ${describe(n.r, labelOf, false)}`;
    case 'not': return `not (${describe(n.x, labelOf, true)})`;
    case 'andor':
      s = n.xs.map((x, k) => (k ? ` ${n.ops[k - 1].toLowerCase()} ` : '') + describe(x, labelOf, false)).join('');
      return top ? s : `(${s})`;
  }
}

/** Mọi id biến field trong cây. */
function fieldIds(/** @type {Node} */ n) {
  /** @type {string[]} */ const out = [];
  const walk = (/** @type {Node} */ x) => {
    if (x.t === 'field') out.push(x.id);
    else if (x.t === 'cmp') { walk(x.l); walk(x.r); }
    else if (x.t === 'not') walk(x.x);
    else if (x.t === 'andor') x.xs.forEach(walk);
  };
  walk(n);
  return out;
}

module.exports = { OPS, toProperty, parseBlockly, parseWhen, describe, fieldIds, juel };
