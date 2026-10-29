// @ts-check
'use strict';
// Dữ liệu vận hành cục bộ (.kyta/, gitignore): nhật ký thao tác + snapshot hash lúc pull.
const fs = require('fs');
const path = require('path');
const { STATE } = require('./paths');
const { readJson, writeJson } = require('./fsx');

const AUDIT_FILE = path.join(STATE, 'audit.jsonl');
const SNAP_FILE = path.join(STATE, 'snapshots.json');

/** Ghi 1 dòng nhật ký. Lỗi ghi log không được làm hỏng thao tác chính. */
function audit(/** @type {Record<string, any>} */ entry) {
  try {
    fs.mkdirSync(STATE, { recursive: true });
    fs.appendFileSync(AUDIT_FILE, JSON.stringify({ at: new Date().toISOString(), ...entry }) + '\n', 'utf8');
  } catch (_) {}
}

/** Nhật ký, mới nhất trước. */
function readAudit(limit = 200) {
  let lines = [];
  try { lines = fs.readFileSync(AUDIT_FILE, 'utf8').split('\n').filter(Boolean); } catch (_) { return []; }
  const out = [];
  for (let i = lines.length - 1; i >= 0 && out.length < limit; i--) {
    try { out.push(JSON.parse(lines[i])); } catch (_) {}
  }
  return out;
}

/**
 * Lưu hash code + custom UI + cấu hình field của 1 form tại thời điểm đồng bộ với server.
 * @param {string} formId
 * @param {Record<string, string>} files    { 'main.js': hash }
 * @param {Record<string, string>} [ui]     { '<field>/index.html': hash } — bỏ trống để giữ ui cũ (form bị khoá)
 * @param {Record<string, string>} [fields] { '<hashid>': hash(config) } — bỏ trống để giữ fields cũ
 */
function saveSnapshot(formId, files, ui, fields) {
  const all = readJson(SNAP_FILE, {});
  const prev = all[formId] || {};
  all[formId] = {
    pulledAt: new Date().toISOString(),
    files,
    ui: ui ?? prev.ui ?? {},
    fields: fields ?? prev.fields ?? {},
  };
  writeJson(SNAP_FILE, all);
}

/** @returns {{ pulledAt: string, files: Record<string, string>, ui?: Record<string, string>, fields?: Record<string, string> } | null} */
const getSnapshot = (/** @type {string} */ formId) => readJson(SNAP_FILE, {})[formId] || null;

module.exports = { audit, readAudit, saveSnapshot, getSnapshot };
