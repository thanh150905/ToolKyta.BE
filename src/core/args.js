// @ts-check
'use strict';
// Tách tham số CLI + báo sai cú pháp.

class UsageError extends Error {}

/**
 * Tách argv thành positional / cờ boolean / option có giá trị.
 * @param {string[]} argv
 * @param {{ value?: string[] }} [spec] các option cần giá trị đi kèm (vd --group)
 * @returns {{ _: string[], flags: Set<string>, opts: Record<string, string> }}
 */
function parseArgs(argv, { value = [] } = {}) {
  const valued = new Set(value);
  /** @type {string[]} */ const _ = [];
  const flags = new Set();
  /** @type {Record<string, string>} */ const opts = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith('--')) _.push(a);
    else if (valued.has(a)) opts[a] = argv[++i];   // nuốt giá trị kế tiếp, kể cả khi bắt đầu bằng --
    else flags.add(a);
  }
  return { _, flags, opts };
}

/**
 * Dừng lệnh vì sai cú pháp — cli in hướng dẫn và thoát mã 2.
 * @param {string} text
 * @returns {never}
 */
function usage(text) { throw new UsageError(text); }

/** "a, b,c" → ['a', 'b', 'c'] */
const splitList = (/** @type {string|undefined} */ s) => String(s || '').split(',').map(x => x.trim()).filter(Boolean);

module.exports = { UsageError, parseArgs, usage, splitList };
