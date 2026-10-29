// @ts-check
'use strict';
// Clone 1 form eForm BMW sandbox: tạo form mới rồi copy jsonForm (gồm custom UI) + variableArr + code động.
//   node scratch/clone_form.js <srcFormId> <newFormCode> [newFormName]
// In ra formId mới. KHÔNG tự pull — chạy `kyta eform pull` sau.
const api = require('../src/eform/api');
const formDef = require('../src/eform/formDef');

async function clone(srcId, newCode, newName) {
  const sess = await api.open('bmw', 'sandbox');
  console.log(`Nguồn: ${srcId}  →  mã mới: ${newCode}`);

  // 1. Lấy form nguồn (def + variableArr) và code động.
  const src = await api.getForm(sess, srcId);
  const { def, wasString } = formDef.parseFormDef(src);
  if (!def) throw new Error('Form nguồn không có jsonForm.');
  const srcCode = await api.getCode(sess, srcId);

  // 2. Chặn trùng mã.
  const free = await api.checkIdAvailable(sess, newCode);
  if (!free) throw new Error(`Mã form "${newCode}" đã tồn tại trên server.`);

  // 3. Tạo form rỗng.
  const created = await api.createForm(sess, {
    formName: newName || newCode, formCode: newCode,
    describeForm: src.describeForm ?? '',
    beginTime: '2026/01/01', endTime: '2030/12/31',
  });
  const newId = created.formId;
  if (!newId) throw new Error('createForm không trả formId.');
  console.log(`✓ Đã tạo form rỗng: ${newId}`);

  // 4. Copy def + variableArr vào form mới (giữ id node ⇒ custom UI + logic bám nguyên).
  //    Lấy lại form mới bằng getForm để payload có đúng shape beginTime/endTime/tag server mong đợi.
  let variableArr = src.variableArr;
  if (typeof variableArr === 'string') { try { variableArr = JSON.parse(variableArr); } catch (_) { variableArr = []; } }
  const newForm = await api.getForm(sess, newId);
  newForm.variableArr = variableArr;
  const payload = formDef.buildOwnerFormPayload(newForm, def, true);
  await api.putForm(sess, payload);
  console.log(`✓ Đã copy jsonForm + ${Array.isArray(variableArr) ? variableArr.length : 0} biến.`);

  // 5. Copy code động (full-replace).
  if (Object.keys(srcCode).length) {
    await api.putCode(sess, newId, srcCode);
    console.log(`✓ Đã copy code động: ${Object.keys(srcCode).length} file.`);
  } else {
    console.log('  (không có code động để copy)');
  }

  console.log(`\nHOÀN TẤT. formId mới = ${newId}`);
  return newId;
}

if (require.main === module) {
  const [srcId, newCode, newName] = process.argv.slice(2);
  if (!srcId || !newCode) {
    console.log('Cách dùng: node scratch/clone_form.js <srcFormId> <newFormCode> [newFormName]');
    process.exit(1);
  }
  clone(srcId, newCode, newName).catch(e => { console.error('✗ Lỗi:', e.message); process.exit(1); });
}

module.exports = { clone };
