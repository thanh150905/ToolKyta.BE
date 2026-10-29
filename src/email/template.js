// @ts-check
'use strict';
// Mẫu mail lưu local: workspace/<customer>/<env>/email/<tên>/{content.html, .meta.json}

/** @type {import('../core/sync').Spec} */
const SPEC = { module: 'email', file: 'content.html', field: 'content', noun: 'mẫu mail' };

// Field biên tập được, đồng bộ khi push --with-meta.
const META_FIELDS = ['name', 'status', 'typeSend', 'typeCreate', 'isFavourite', 'alias', 'variables', 'dataMailMerge'];

/**
 * Đổi mọi domain portal erequest (bất kỳ env) + IP hardcode → portal của env đích.
 * Chỉ thay scheme://host, giữ nguyên path/query/${biến}. Engine mail không cho bơm base-url động nên xử lý lúc push.
 * @param {string} content
 * @param {string|null} portal
 */
function rewritePortal(content, portal) {
  if (!portal) return { content, n: 0 };
  let n = 0;
  const out = String(content)
    .replace(/https?:\/\/erequest[.\w-]*/g, () => { n++; return portal; })
    .replace(/http:\/\/10\.14\.121\.10/g, () => { n++; return portal; });
  return { content: out, n };
}

module.exports = { SPEC, META_FIELDS, rewritePortal };
