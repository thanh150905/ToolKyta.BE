// @ts-check
'use strict';
// Tiện ích đĩa dùng chung: JSON (ghi atomic), text, hash, tên thư mục an toàn.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

/**
 * Đọc JSON; thiếu file hoặc hỏng thì trả dflt.
 * @param {string} fp
 * @param {any} dflt
 * @returns {any}
 */
function readJson(fp, dflt) {
  try { return JSON.parse(fs.readFileSync(fp, 'utf8')); } catch (_) { return dflt; }
}

/** Ghi JSON qua file tạm + rename → không để lại file hỏng nếu tiến trình chết giữa chừng. */
function writeJson(/** @type {string} */ fp, /** @type {any} */ obj) {
  fs.mkdirSync(path.dirname(fp), { recursive: true });
  const tmp = `${fp}.tmp-${process.pid}`;
  fs.writeFileSync(tmp, JSON.stringify(obj, null, 2) + '\n', 'utf8');
  fs.renameSync(tmp, fp);
}

function writeText(/** @type {string} */ fp, /** @type {string} */ text) {
  fs.mkdirSync(path.dirname(fp), { recursive: true });
  fs.writeFileSync(fp, text, 'utf8');
}

/**
 * @template T
 * @param {string} fp
 * @param {T} dflt
 * @returns {string|T}
 */
function readText(fp, dflt) {
  try { return fs.readFileSync(fp, 'utf8'); } catch (_) { return dflt; }
}

/** Hash ngắn của nội dung — dùng làm mốc "đã sửa cục bộ chưa". */
function hash(/** @type {unknown} */ s) {
  return crypto.createHash('sha1').update(s == null ? '' : String(s), 'utf8').digest('hex').slice(0, 16);
}

/** Tên thư mục hợp lệ: "/" và "\" → "_" (tên luồng Kyta có thể chứa "/"). */
const safeName = (/** @type {unknown} */ s) => String(s).replace(/[/\\]/g, '_').trim();

const isDir = (/** @type {string} */ p) => { try { return fs.statSync(p).isDirectory(); } catch (_) { return false; } };

/** Tên các thư mục con (đã sort). */
function subdirs(/** @type {string} */ dir) {
  try { return fs.readdirSync(dir, { withFileTypes: true }).filter(e => e.isDirectory()).map(e => e.name).sort(); }
  catch (_) { return []; }
}

/**
 * Thư mục tài nguyên (có .meta.json) dưới root, đệ quy qua thư mục nhóm; gặp .meta.json thì không đi sâu thêm.
 * @param {string} root
 * @param {string} [meta]
 */
function metaDirs(root, meta = '.meta.json') {
  /** @type {string[]} */ const out = [];
  const walk = (/** @type {string} */ d) => {
    if (fs.existsSync(path.join(d, meta))) out.push(d);
    else subdirs(d).forEach(n => walk(path.join(d, n)));
  };
  subdirs(root).forEach(n => walk(path.join(root, n)));
  return out;
}

/** Thư mục tài nguyên (có .meta.json) chứa file/thư mục p, đi ngược lên tới root; không thấy → null. */
function metaDirOf(/** @type {string} */ p, /** @type {string} */ root, meta = '.meta.json') {
  for (let d = path.resolve(p); d.length > root.length && d.startsWith(root); d = path.dirname(d)) {
    if (fs.existsSync(path.join(d, meta))) return d;
  }
  return null;
}

module.exports = { readJson, writeJson, writeText, readText, hash, safeName, isDir, subdirs, metaDirs, metaDirOf };
