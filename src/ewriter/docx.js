// @ts-check
'use strict';
// Thao tác file .docx bản in — chỉ dùng zlib có sẵn, không thêm phụ thuộc.
//   zip      : đọc/ghi toàn bộ entry (giữ thứ tự, [Content_Types].xml đứng đầu)
//   layout   : document.xml "mỗi đoạn/bảng/dòng/ô 1 dòng" để sửa tay được, gộp lại y nguyên khi đóng gói
//   field    : quét field code (MERGEFIELD/DOCVARIABLE/IF) theo cặp fldChar begin…end, đổi tên placeholder
//   chèn     : MERGEFIELD sau 1 đoạn chữ neo, bảng (DOCVARIABLE + col_N) sau đoạn chứa neo
//   comment  : gỡ toàn bộ comment (range, reference, part, rels, content-type)
// Cú pháp placeholder + pattern OOXML đã xác minh: docs/ewriter-schema.md, memory ewriter-docx-roundtrip.
const fs = require('fs');
const zlib = require('zlib');

// ---------------------------------------------------------------- zip

/** @typedef {{ name: string, data: Buffer }} ZipEntry */

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(/** @type {Buffer} */ buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

/** Duyệt central directory; cb(tên entry, hàm giải nén) — trả false để dừng. */
function eachCentral(/** @type {Buffer} */ buf, /** @type {(name: string, data: () => Buffer) => any} */ cb) {
  // EOCD: 0x06054b50, tìm từ cuối.
  let eocd = -1;
  for (let i = buf.length - 22; i >= 0 && i >= buf.length - 22 - 65536; i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error('không phải file zip/docx hợp lệ (thiếu EOCD)');
  let off = buf.readUInt32LE(eocd + 16);           // offset central directory
  const total = buf.readUInt16LE(eocd + 10);
  for (let n = 0; n < total; n++) {
    if (buf.readUInt32LE(off) !== 0x02014b50) break;
    const method = buf.readUInt16LE(off + 10);
    const compSize = buf.readUInt32LE(off + 20);
    const nameLen = buf.readUInt16LE(off + 28);
    const extraLen = buf.readUInt16LE(off + 30);
    const commentLen = buf.readUInt16LE(off + 32);
    const localOff = buf.readUInt32LE(off + 42);
    const name = buf.toString('utf8', off + 46, off + 46 + nameLen);
    const data = () => {
      const start = localOff + 30 + buf.readUInt16LE(localOff + 26) + buf.readUInt16LE(localOff + 28);
      const raw = buf.subarray(start, start + compSize);
      return method === 8 ? zlib.inflateRawSync(raw) : Buffer.from(raw);
    };
    if (cb(name, data) === false) return;
    off += 46 + nameLen + extraLen + commentLen;
  }
}

/**
 * Lấy nội dung 1 entry trong zip.
 * @param {Buffer} buf
 * @param {string} name
 * @returns {Buffer|null}
 */
function readZipEntry(buf, name) {
  /** @type {{ v: Buffer|null }} */ const out = { v: null };
  eachCentral(buf, (n, data) => { if (n === name) { out.v = data(); return false; } });
  return out.v;
}

/** Toàn bộ entry (bỏ thư mục), giữ thứ tự gốc. */
function readZip(/** @type {Buffer} */ buf) {
  /** @type {ZipEntry[]} */ const out = [];
  eachCentral(buf, (name, data) => { if (!name.endsWith('/')) out.push({ name, data: data() }); });
  return out;
}

/** Đóng gói lại (deflate). [Content_Types].xml luôn đứng đầu như Word yêu cầu. */
function writeZip(/** @type {ZipEntry[]} */ entries) {
  const CT = '[Content_Types].xml';
  const ordered = [...entries.filter(e => e.name === CT), ...entries.filter(e => e.name !== CT)];
  /** @type {Buffer[]} */ const locals = [];
  /** @type {Buffer[]} */ const centrals = [];
  let offset = 0;
  for (const e of ordered) {
    const name = Buffer.from(e.name, 'utf8');
    const comp = zlib.deflateRawSync(e.data);
    const crc = crc32(e.data);
    const lh = Buffer.alloc(30);
    lh.writeUInt32LE(0x04034b50, 0); lh.writeUInt16LE(20, 4); lh.writeUInt16LE(0x0800, 6); lh.writeUInt16LE(8, 8);
    lh.writeUInt32LE(crc, 14); lh.writeUInt32LE(comp.length, 18); lh.writeUInt32LE(e.data.length, 22);
    lh.writeUInt16LE(name.length, 26);
    const ch = Buffer.alloc(46);
    ch.writeUInt32LE(0x02014b50, 0); ch.writeUInt16LE(20, 4); ch.writeUInt16LE(20, 6); ch.writeUInt16LE(0x0800, 8);
    ch.writeUInt16LE(8, 10); ch.writeUInt32LE(crc, 16); ch.writeUInt32LE(comp.length, 20); ch.writeUInt32LE(e.data.length, 24);
    ch.writeUInt16LE(name.length, 28); ch.writeUInt32LE(offset, 42);
    locals.push(lh, name, comp);
    centrals.push(ch, name);
    offset += 30 + name.length + comp.length;
  }
  const cen = Buffer.concat(centrals);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(ordered.length, 8); eocd.writeUInt16LE(ordered.length, 10);
  eocd.writeUInt32LE(cen.length, 12); eocd.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, cen, eocd]);
}

/** Thay (hoặc thêm) 1 entry, trả mảng mới. */
function setEntry(/** @type {ZipEntry[]} */ entries, /** @type {string} */ name, /** @type {Buffer} */ data) {
  return entries.some(e => e.name === name)
    ? entries.map(e => (e.name === name ? { name, data } : e))
    : [...entries, { name, data }];
}

// ---------------------------------------------------------------- layout

// Xuống dòng trước mỗi đoạn/bảng/dòng/ô/sectPr. Khoảng trắng giữa 2 phần tử XML bị Word/Aspose bỏ qua.
const BLOCK = '<w:(?:p|tbl|tr|tc|sectPr)[ >]';
const pretty = (/** @type {string} */ xml) => xml.replace(new RegExp(`(?<!\\n)(?=${BLOCK})`, 'g'), '\n');
/** Gộp lại: bỏ xuống dòng (kể cả thụt lề tự thêm) đứng trước thẻ khối. */
const compact = (/** @type {string} */ xml) => xml.replace(new RegExp(`\\r?\\n[ \\t]*(?=${BLOCK})`, 'g'), '');

// ---------------------------------------------------------------- text helpers

const esc = (/** @type {string} */ s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const unesc = (/** @type {string} */ s) => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
  .replace(/&apos;/g, "'").replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
  .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d))).replace(/&amp;/g, '&');

const T_RE = /<w:t(?:\s[^>]*)?>([^<]*)<\/w:t>/g;

/** Chữ hiển thị của 1 đoạn XML (nối mọi w:t). */
const textOf = (/** @type {string} */ xml) => [...xml.matchAll(T_RE)].map(m => unesc(m[1])).join('');

// ---------------------------------------------------------------- field code

/** @typedef {{ instr: string, nested: boolean, parts: { start: number, end: number }[] }} Field */

/**
 * Quét field code theo thứ tự tài liệu (hỗ trợ lồng, instrText bị Word cắt nhiều run).
 * parts = vị trí NỘI DUNG của từng w:instrText (hoặc thuộc tính w:instr của fldSimple).
 * @returns {Field[]}
 */
function scanFields(/** @type {string} */ xml) {
  const re = /<w:fldChar\b[^>]*w:fldCharType="(begin|separate|end)"[^>]*>|<w:instrText\b[^>]*>([\s\S]*?)<\/w:instrText>|<w:fldSimple\b[^>]*w:instr="([^"]*)"/g;
  /** @type {Field[]} */ const done = [];
  /** @type {(Field & { inInstr: boolean })[]} */ const stack = [];
  for (const m of xml.matchAll(re)) {
    const idx = /** @type {number} */ (m.index);
    if (m[1] === 'begin') {
      if (stack.length) stack[stack.length - 1].nested = true;
      stack.push({ instr: '', nested: false, parts: [], inInstr: true });
    } else if (m[1] === 'separate') {
      if (stack.length) stack[stack.length - 1].inInstr = false;
    } else if (m[1] === 'end') {
      const f = stack.pop();
      if (f) done.push({ instr: f.instr, nested: f.nested, parts: f.parts });
    } else if (m[2] !== undefined) {
      const top = stack[stack.length - 1];
      const start = idx + m[0].indexOf('>') + 1;
      if (!top) done.push({ instr: unesc(m[2]), nested: false, parts: [{ start, end: start + m[2].length }] });   // instrText lẻ, không fldChar
      else if (top.inInstr) {
        top.instr += unesc(m[2]);
        top.parts.push({ start, end: start + m[2].length });
      }
    } else if (m[3] !== undefined) {
      const start = idx + m[0].indexOf('w:instr="') + 9;
      done.push({ instr: unesc(m[3]), nested: false, parts: [{ start, end: start + m[3].length }] });
    }
  }
  return done;
}

/**
 * @typedef {{ kind: 'MERGEFIELD'|'DOCVARIABLE', name: string, label: string|null, hashid: string|null }} Placeholder
 */

/** "Nhãn (hashid)" → {label, hashid}; tên khác (col_N, tên trơn) → null. Lấy cặp ngoặc CUỐI (nhãn chữ ký có ngoặc). */
function splitName(/** @type {string} */ name) {
  const m = name.match(/^([\s\S]*\S)\s*\(([A-Za-z0-9_]+)\)$/);
  return m ? { label: m[1], hashid: m[2] } : null;
}

/** Placeholder trong 1 instr (kể cả MERGEFIELD lồng trong IF). */
function placeholdersIn(/** @type {string} */ instr) {
  /** @type {Placeholder[]} */ const out = [];
  for (const m of instr.matchAll(/(MERGEFIELD|DOCVARIABLE)\s+(?:"([^"]+)"|([^\s"\\}]+))/g)) {
    const name = m[2] ?? m[3];
    const sp = splitName(name);
    out.push({ kind: /** @type {any} */ (m[1]), name, label: sp?.label ?? null, hashid: sp?.hashid ?? null });
  }
  return out;
}

/**
 * Toàn bộ placeholder (duy nhất theo kind+name) + số field IF + bookmark.
 */
function analyzeXml(/** @type {string} */ xml) {
  const fields = scanFields(xml);
  /** @type {Map<string, Placeholder>} */ const uniq = new Map();
  let ifCount = 0;
  for (const f of fields) {
    if (/^\s*IF\s/.test(f.instr)) ifCount++;
    for (const p of placeholdersIn(f.instr)) uniq.set(`${p.kind}:${p.name}`, p);
  }
  const placeholders = [...uniq.values()];
  const bookmarks = new Set();
  for (const m of xml.matchAll(/<w:bookmarkStart[^>]*w:name="([^"]+)"/g)) if (m[1] !== '_GoBack') bookmarks.add(m[1]);
  return {
    placeholders,
    mergefields: placeholders.filter(p => p.kind === 'MERGEFIELD').map(p => p.name),
    docvariables: placeholders.filter(p => p.kind === 'DOCVARIABLE').map(p => p.name),
    ifCount,
    bookmarks: [...bookmarks],
  };
}

/** Phân tích 1 file .docx cục bộ. */
function analyze(/** @type {string} */ filePath) {
  const xmlBuf = readZipEntry(fs.readFileSync(filePath), 'word/document.xml');
  if (!xmlBuf) throw new Error('không thấy word/document.xml trong file');
  return analyzeXml(xmlBuf.toString('utf8'));
}

/**
 * Đổi tên placeholder trong mọi field code (MERGEFIELD/DOCVARIABLE "from" → "to").
 * Field có instr bị cắt nhiều run được gộp về run đầu trước khi đổi.
 * @param {string} xml
 * @param {Record<string, string>} renames  tên cũ → tên mới
 * @returns {{ xml: string, count: number }}
 */
function renamePlaceholders(xml, renames) {
  const fields = scanFields(xml).filter(f => !f.nested && f.parts.length);
  /** @type {{ start: number, end: number, text: string }[]} */ const edits = [];
  let count = 0;
  for (const f of fields) {
    let instr = f.instr;
    for (const [from, to] of Object.entries(renames)) {
      const re = new RegExp(`((?:MERGEFIELD|DOCVARIABLE)\\s+)(?:"${reEsc(from)}"|${reEsc(from)}(?=[\\s\\\\}]|$))`, 'g');
      instr = instr.replace(re, (_, kw) => { count++; return `${kw}"${to}"`; });
    }
    if (instr === f.instr) continue;
    f.parts.forEach((p, i) => edits.push({ start: p.start, end: p.end, text: i === 0 ? esc(instr) : '' }));
  }
  edits.sort((a, b) => b.start - a.start);
  for (const e of edits) xml = xml.slice(0, e.start) + e.text + xml.slice(e.end);
  return { xml, count };
}

const reEsc = (/** @type {string} */ s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Số cột (col_N lớn nhất) của dòng bảng chứa DOCVARIABLE `name`; null nếu không thấy. */
function tableColumns(/** @type {string} */ xml, /** @type {string} */ name) {
  const plain = xml.indexOf(`"${esc(name)}"`);
  const at = plain >= 0 ? plain : xml.indexOf(`&quot;${esc(name)}&quot;`);
  if (at < 0) return null;
  let trStart = -1;
  for (const m of xml.slice(0, at).matchAll(/<w:tr[ >]/g)) trStart = /** @type {number} */ (m.index);
  const trEnd = xml.indexOf('</w:tr>', at);
  if (trStart < 0 || trEnd < 0) return null;
  const nums = analyzeXml(xml.slice(trStart, trEnd)).mergefields
    .map(n => Number(n.match(/^col_(\d+)$/)?.[1] || 0));
  return Math.max(0, ...nums);
}

// ---------------------------------------------------------------- sinh OOXML

/** 1 field Word (begin/instr/separate/end, không run kết quả — pattern đã chạy với Aspose MailMerge). */
function fieldXml(/** @type {string} */ instr, rPr = '') {
  const r = (/** @type {string} */ inner) => `<w:r>${rPr}${inner}</w:r>`;
  return r('<w:fldChar w:fldCharType="begin"/>')
    + r(`<w:instrText xml:space="preserve">${esc(instr)}</w:instrText>`)
    + r('<w:fldChar w:fldCharType="separate"/>')
    + r('<w:fldChar w:fldCharType="end"/>');
}

const mergefield = (/** @type {string} */ name, rPr = '') => fieldXml(`MERGEFIELD "${name}"`, rPr);

/**
 * Bảng in cho 1 field table_advance: 1 dòng tiêu đề + 1 dòng mẫu (ô 1 = DOCVARIABLE tên bảng, ô i = col_i).
 * @param {{ name: string, columns: { title: string, width: number, align?: string }[], rPr?: string, headRPr?: string, shade?: string }} o
 */
function tableXml(o) {
  const total = o.columns.reduce((s, c) => s + c.width, 0);
  const border = ['top', 'left', 'bottom', 'right', 'insideH', 'insideV']
    .map(s => `<w:${s} w:val="single" w:sz="4" w:space="0" w:color="000000"/>`).join('');
  const para = (/** @type {string} */ inner, /** @type {string} */ jc, /** @type {string} */ rPr) =>
    `<w:p><w:pPr><w:spacing w:before="20" w:after="20" w:line="240" w:lineRule="auto"/><w:jc w:val="${jc}"/>${rPr}</w:pPr>${inner}</w:p>`;
  const cell = (/** @type {number} */ w, /** @type {string} */ p, /** @type {string} */ shade) =>
    `<w:tc><w:tcPr><w:tcW w:w="${w}" w:type="dxa"/>${shade ? `<w:shd w:val="clear" w:color="auto" w:fill="${shade}"/>` : ''}<w:vAlign w:val="center"/></w:tcPr>${p}</w:tc>`;
  const rPr = o.rPr || '';
  const headRPr = o.headRPr || rPr;
  const text = (/** @type {string} */ s) => s.split('\n')
    .map((line, i) => `${i ? `<w:r>${headRPr}<w:br/></w:r>` : ''}<w:r>${headRPr}<w:t xml:space="preserve">${esc(line)}</w:t></w:r>`).join('');
  const head = o.columns.map(c => cell(c.width, para(text(c.title), 'center', headRPr), o.shade ?? 'D9E2F3')).join('');
  const row = o.columns.map((c, i) => cell(c.width,
    para((i === 0 ? fieldXml(`DOCVARIABLE "${o.name}"`, rPr) : '') + mergefield(`col_${i + 1}`, rPr), c.align || 'left', rPr), '')).join('');
  return `<w:tbl><w:tblPr><w:tblW w:w="${total}" w:type="dxa"/><w:jc w:val="center"/><w:tblBorders>${border}</w:tblBorders>`
    + '<w:tblLayout w:type="fixed"/><w:tblCellMar><w:left w:w="40" w:type="dxa"/><w:right w:w="40" w:type="dxa"/></w:tblCellMar>'
    + `<w:tblLook w:val="04A0"/></w:tblPr><w:tblGrid>${o.columns.map(c => `<w:gridCol w:w="${c.width}"/>`).join('')}</w:tblGrid>`
    + `<w:tr><w:trPr><w:tblHeader/><w:cantSplit/></w:trPr>${head}</w:tr>`
    + `<w:tr><w:trPr><w:cantSplit/></w:trPr>${row}</w:tr></w:tbl>`;
}

/** Bề rộng vùng in (twips) theo sectPr cuối: trang − lề trái − lề phải. */
function textWidth(/** @type {string} */ xml) {
  const sect = xml.slice(xml.lastIndexOf('<w:sectPr'));
  const w = Number(sect.match(/<w:pgSz\b[^>]*w:w="(\d+)"/)?.[1] || 11906);
  const l = Number(sect.match(/<w:pgMar\b[^>]*w:left="(\d+)"/)?.[1] || 1440);
  const r = Number(sect.match(/<w:pgMar\b[^>]*w:right="(\d+)"/)?.[1] || 1440);
  return w - l - r;
}

// ---------------------------------------------------------------- chèn theo chữ neo

/**
 * Tìm vị trí KẾT THÚC của chữ neo (duy nhất) trong chữ hiển thị — neo được phép vắt qua nhiều run.
 * @returns {{ tStart: number, tEnd: number, before: string, after: string }}  w:t chứa ký tự cuối của neo, tách tại đó
 */
function locateAnchor(/** @type {string} */ xml, /** @type {string} */ anchor) {
  const ts = [...xml.matchAll(T_RE)].map(m => ({ start: /** @type {number} */ (m.index), end: /** @type {number} */ (m.index) + m[0].length, text: unesc(m[1]) }));
  const full = ts.map(t => t.text).join('');
  const hits = [];
  for (let i = full.indexOf(anchor); i >= 0; i = full.indexOf(anchor, i + 1)) hits.push(i);
  if (!hits.length) throw new Error(`Không thấy chữ neo "${anchor}" trong tài liệu.`);
  if (hits.length > 1) throw new Error(`Chữ neo "${anchor}" xuất hiện ${hits.length} lần — viết dài hơn cho duy nhất.`);
  const endPos = hits[0] + anchor.length;
  let acc = 0;
  for (const t of ts) {
    if (endPos <= acc + t.text.length && endPos > acc) {
      const k = endPos - acc;
      return { tStart: t.start, tEnd: t.end, before: t.text.slice(0, k), after: t.text.slice(k) };
    }
    acc += t.text.length;
  }
  throw new Error(`Không định vị được chữ neo "${anchor}".`);
}

/** rPr của run chứa vị trí pos. */
function runAround(/** @type {string} */ xml, /** @type {number} */ pos) {
  let runStart = -1;
  for (const m of xml.slice(0, pos).matchAll(/<w:r[ >]/g)) runStart = /** @type {number} */ (m.index);
  const runEnd = xml.indexOf('</w:r>', pos);
  if (runStart < 0 || runEnd < 0) throw new Error('chữ neo không nằm trong run hợp lệ');
  const head = xml.slice(runStart, pos);
  const rPr = head.match(/<w:rPr>[\s\S]*?<\/w:rPr>/)?.[0] || '';
  return { runStart, runEnd, rPr };
}

/**
 * Chèn XML (dựng từ rPr của run neo) NGAY SAU chữ neo: tách run tại điểm cuối neo.
 * @param {string} xml
 * @param {string} anchor
 * @param {(rPr: string) => string} build
 */
function insertAfterText(xml, anchor, build) {
  const a = locateAnchor(xml, anchor);
  const { runStart, runEnd, rPr } = runAround(xml, a.tStart);
  const head = xml.slice(runStart, a.tStart);                  // <w:r> + rPr + phần tử trước w:t
  const tail = xml.slice(a.tEnd, runEnd);                      // phần tử sau w:t trong run
  const t = (/** @type {string} */ s) => (s ? `<w:t xml:space="preserve">${esc(s)}</w:t>` : '');
  const rest = a.after || tail.trim() ? `<w:r>${rPr}${t(a.after)}${tail}</w:r>` : '';
  const replaced = `${head}${t(a.before)}</w:r>${build(rPr)}${rest}`;
  return xml.slice(0, runStart) + replaced + xml.slice(runEnd + '</w:r>'.length);
}

/** Chèn khối (bảng…) SAU đoạn (w:p cấp thân) chứa chữ neo. */
function insertAfterParagraph(/** @type {string} */ xml, /** @type {string} */ anchor, /** @type {(rPr: string) => string} */ build) {
  const a = locateAnchor(xml, anchor);
  const { rPr } = runAround(xml, a.tStart);
  const pEnd = xml.indexOf('</w:p>', a.tEnd);
  if (pEnd < 0) throw new Error('không thấy cuối đoạn chứa chữ neo');
  const at = pEnd + '</w:p>'.length;
  const block = build(rPr);
  // Bảng không được là phần tử cuối thân tài liệu (trước sectPr) — chèn thêm 1 đoạn trống.
  const pad = /^\s*<w:sectPr/.test(xml.slice(at)) ? '<w:p/>' : '';
  return xml.slice(0, at) + block + pad + xml.slice(at);
}

// ---------------------------------------------------------------- comment

/** Gỡ toàn bộ comment khỏi gói docx. Trả { entries, removed } (removed = số comment range). */
function stripComments(/** @type {ZipEntry[]} */ entries) {
  const isCommentPart = (/** @type {string} */ n) => /^word\/(comments[^/]*|people)\.xml$/.test(n);
  const docEntry = entries.find(e => e.name === 'word/document.xml');
  if (!docEntry) throw new Error('không thấy word/document.xml');
  let xml = docEntry.data.toString('utf8');
  const removed = (xml.match(/<w:commentRangeStart\b/g) || []).length;
  xml = xml.replace(/<w:commentRange(?:Start|End)\b[^>]*\/>/g, '')
    .replace(/<w:r\b(?:(?!<\/w:r>)[\s\S])*?<w:commentReference\b[^>]*\/>(?:(?!<\/w:r>)[\s\S])*?<\/w:r>/g, '');
  const rmTargets = new Set(entries.filter(e => isCommentPart(e.name)).map(e => e.name.slice('word/'.length)));
  return {
    removed,
    entries: entries.filter(e => !isCommentPart(e.name)).map(e => {
      if (e.name === 'word/document.xml') return { name: e.name, data: Buffer.from(xml, 'utf8') };
      if (e.name === 'word/_rels/document.xml.rels') {
        const s = e.data.toString('utf8').replace(/<Relationship\b[^>]*Target="([^"]+)"[^>]*\/>/g,
          (m, target) => (rmTargets.has(target) ? '' : m));
        return { name: e.name, data: Buffer.from(s, 'utf8') };
      }
      if (e.name === '[Content_Types].xml') {
        const s = e.data.toString('utf8').replace(/<Override\b[^>]*PartName="\/word\/(?:comments[^"/]*|people)\.xml"[^>]*\/>/g, '');
        return { name: e.name, data: Buffer.from(s, 'utf8') };
      }
      return e;
    }),
  };
}

module.exports = {
  crc32, readZipEntry, readZip, writeZip, setEntry,
  pretty, compact, esc, unesc, textOf,
  scanFields, splitName, analyzeXml, analyze, renamePlaceholders, tableColumns,
  fieldXml, mergefield, tableXml, textWidth,
  locateAnchor, insertAfterText, insertAfterParagraph, stripComments,
};
