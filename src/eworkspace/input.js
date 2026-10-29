// @ts-check
'use strict';
const fs = require('fs');
const { usage } = require('../core/args');

/** Parse CLI options while retaining repeated values such as --user and --email. */
function parse(/** @type {string[]} */ argv, /** @type {string[]} */ valueOptions = []) {
  const valueSet = new Set(valueOptions);
  const positional = [];
  const flags = new Set();
  /** @type {Record<string, string[]>} */ const options = {};
  for (let i = 0; i < argv.length; i++) {
    const token = argv[i];
    if (!token.startsWith('--')) { positional.push(token); continue; }
    if (valueSet.has(token)) {
      const value = argv[++i];
      if (value === undefined || value.startsWith('--')) usage('Thiếu giá trị sau ' + token + '.');
      (options[token] ||= []).push(value);
    } else flags.add(token);
  }
  return { positional, flags, options };
}

function readLines(/** @type {string} */ filename) {
  try {
    return fs.readFileSync(filename, 'utf8').replace(/^\uFEFF/, '').split(/\r?\n/).map(x => x.trim()).filter(Boolean);
  } catch (e) { throw new Error('Không đọc được file "' + filename + '": ' + e.message); }
}

/** Accept dashboard IDs pasted as a comma/space-separated list or separate arguments. */
function splitIds(/** @type {string[]} */ values) {
  return values.flatMap(value => value.split(/[\s,]+/).map(id => id.trim()).filter(Boolean));
}

/** Small CSV reader supporting quoted fields and doubled quotes. */
function csvRow(/** @type {string} */ line) {
  /** @type {string[]} */ const cells = [];
  let value = '';
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"' && quoted && line[i + 1] === '"') { value += '"'; i++; }
    else if (c === '"') quoted = !quoted;
    else if (c === ',' && !quoted) { cells.push(value.trim()); value = ''; }
    else value += c;
  }
  cells.push(value.trim());
  return cells;
}

/** @param {string[]} argv @param {{positionalsAsEmails?:boolean}} [opts] */
function collectUsers(argv, { positionalsAsEmails = true } = {}) {
  const { positional, flags, options } = parse(argv, ['--user', '--email', '--users-file', '--emails-file']);
  /** @type {{id:number, email:string}[]} */ const users = [];
  /** @type {string[]} */ const emails = [...(options['--email'] || [])];

  for (const raw of options['--user'] || []) {
    const comma = raw.indexOf(',');
    if (comma < 1) usage('User "' + raw + '" cần định dạng id,email.');
    users.push(parseUser(raw.slice(0, comma), raw.slice(comma + 1)));
  }
  for (const filename of options['--users-file'] || []) {
    const rows = readLines(filename);
    for (const [index, line] of rows.entries()) {
      if (index === 0 && /^\s*id\s*,/i.test(line)) continue;
      const [id, email] = csvRow(line);
      users.push(parseUser(id, email));
    }
  }
  for (const filename of options['--emails-file'] || []) emails.push(...readLines(filename));
  return { users: uniqueUsers(users), emails: [...new Set([...(positionalsAsEmails ? positional : []), ...emails].map(s => s.trim()).filter(Boolean))], positional, flags };
}

function parseUser(/** @type {string} */ rawId, /** @type {string} */ email) {
  const idText = rawId.trim();
  const normalizedEmail = email.trim();
  if (!/^\d+$/.test(idText) || !normalizedEmail.includes('@')) usage('User không hợp lệ "' + rawId + ',' + email + '"; cần id số và email.');
  return { id: Number(idText), email: normalizedEmail };
}

function uniqueUsers(/** @type {{id:number, email:string}[]} */ users) {
  const seen = new Set();
  return users.filter(user => {
    if (seen.has(user.id)) return false;
    seen.add(user.id);
    return true;
  });
}

async function mapLimit(/** @type {any[]} */ items, /** @type {(item:any, index:number)=>Promise<any>} */ fn, limit = 6) {
  const results = new Array(items.length);
  let cursor = 0;
  async function worker() {
    while (cursor < items.length) {
      const index = cursor++;
      results[index] = await fn(items[index], index);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, () => worker()));
  return results;
}

module.exports = { parse, readLines, splitIds, csvRow, collectUsers, parseUser, uniqueUsers, mapLimit };
