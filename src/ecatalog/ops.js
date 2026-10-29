// @ts-check
'use strict';
// Thao tác ghi ghép nhiều bước cho eCatalog.
const api = require('./api');
const { activeMap, applyActive } = require('./fields');

const GROUPS = ['tableConfig', 'searchConfig', 'filterConfig'];

/**
 * Lưu struct field mới, rồi KHÔI PHỤC lại `active` cho các field còn tồn tại.
 * Lý do: PUT /categories/edit re-derive *Config từ struct và reset mọi active=false
 * (xem docs/ecatalog-schema.md) → nếu không khôi phục, mỗi lần sửa field sẽ mất cấu hình hiển thị.
 * @param {import('../core/session').Session} sess
 * @param {any} cat  category đầy đủ hiện tại (nguồn snapshot active)
 * @param {any[]} newStruct  mảng field mới
 * @returns {Promise<any>} category sau cùng
 */
async function saveStruct(sess, cat, newStruct) {
  // 1) Snapshot active hiện có theo từng nhóm.
  /** @type {Record<string, Record<string, boolean>>} */ const snap = {};
  for (const g of GROUPS) snap[g] = activeMap(cat[g]);

  // 2) Lưu struct (server sẽ reset active).
  await api.updateFields(sess, { ...cat, struct: JSON.stringify(newStruct), structTree: newStruct });

  // 3) Đọc lại để lấy *Config server vừa re-derive.
  const fresh = await api.category(sess, cat.id);

  // 4) Bật lại active cho field vẫn còn + trước đó đang bật.
  const hadActive = GROUPS.some(g => Object.values(snap[g]).some(Boolean));
  if (!hadActive) return fresh;

  /** @type {any} */ const restored = { ...fresh };
  for (const g of GROUPS) {
    const keep = new Set((fresh[g] || []).map((/** @type {any} */ x) => x.key).filter((/** @type {string} */ k) => snap[g][k]));
    restored[g] = applyActive(fresh[g], keep);
  }
  await api.updateConfig(sess, restored);
  return api.category(sess, cat.id);
}

/**
 * Đặt `active` cho 1 nhóm config (tableConfig/searchConfig/filterConfig) = đúng tập key cho trước.
 * @param {import('../core/session').Session} sess
 * @param {any} cat
 * @param {'tableConfig'|'searchConfig'|'filterConfig'} group
 * @param {Set<string>} activeKeys
 * @returns {Promise<any>}
 */
async function setConfigActive(sess, cat, group, activeKeys) {
  const body = { ...cat, [group]: applyActive(cat[group], activeKeys) };
  await api.updateConfig(sess, body);
  return api.category(sess, cat.id);
}

/**
 * Tạo category (rỗng). Field thêm sau bằng lệnh `field add` (bước đó tự PUT /edit để khởi tạo).
 * ⚠️ KHÔNG gọi /edit ở đây: /edit với struct rỗng → 500. Bản ghi chỉ thêm được sau khi có field.
 * @param {import('../core/session').Session} sess
 * @param {{name: string, code: string, description?: string, status?: number}} info
 * @returns {Promise<any>} category đầy đủ
 */
async function createCategory(sess, info) {
  const created = await api.createCategory(sess, {
    name: info.name, code: info.code, description: info.description || '', status: info.status == null ? 1 : info.status,
  });
  return api.category(sess, created.id);
}

/**
 * Clone category = POST /categories với FULL object nguồn (đổi name/code). Server copy struct + *Config.
 * @param {import('../core/session').Session} sess
 * @param {any} src category nguồn đầy đủ
 * @param {{name: string, code: string}} as
 * @returns {Promise<any>} category mới
 */
async function cloneCategory(sess, src, as) {
  const { id, createdBy, createdDate, lastModifiedBy, lastModifiedDate, ...rest } = src;
  const created = await api.createCategory(sess, { ...rest, name: as.name, code: as.code });
  return api.category(sess, created.id);
}

module.exports = { GROUPS, saveStruct, setConfigActive, createCategory, cloneCategory };
