// Remap id field trong code các form của 1 bộ theo bo/<bộ>.map.json; Duyệt: thêm HOTEN_YCCS + tự điền họ tên người duyệt; khai targetFormId.
//   node code_remap.js bo/<bộ>.map.json
const fs = require('fs'), p = require('path');
const W = require('path').resolve(__dirname, '../..') + '/workspace/saigoncoop/sandbox/eform';
const { S, D, U, MAP } = require(p.resolve(process.argv[2]));
const SUB = require('./subforms.json');
const dirs = {}; (function w(d) { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const f = p.join(d, e.name); if (e.isDirectory()) w(f); else if (e.name === '.meta.json') { const m = JSON.parse(fs.readFileSync(f, 'utf8')); if (m.formId) dirs[m.formId] = d; } } })(W);
for (const id of [S, D, U].filter(Boolean)) {
  const dir = dirs[id]; if (!dir) throw new Error('không thấy thư mục ' + id);
  if (!fs.existsSync(dir + '/code')) { console.log('== ' + p.basename(dir) + ' (không có code)'); continue; }
  const log = [];
  for (const f of fs.readdirSync(dir + '/code')) {
    const fp = `${dir}/code/${f}`; let t = fs.readFileSync(fp, 'utf8'); const o = t;
    for (const [a, b] of Object.entries(MAP)) { if (b === 'DROP') { if (t.includes(a)) log.push(`!! ${f}: còn tham chiếu field bị xoá ${a}`); continue; } const re = new RegExp(a.replace(/-/g, '\\-') + '(?![0-9])', 'g'); const n = (t.match(re) || []).length; if (n) { t = t.replace(re, b); log.push(`${f}: ${a.split('_').slice(1).join('_')} → ${b.slice(-6, b.indexOf('_')) || ''}${b.split('_').slice(1).join('_')} ×${n}`); } }
    if (id === D && f === 'config.js' && !t.includes('HOTEN_YCCS')) {
      const m = t.match(/^(\s*EMAIL_YCCS:\s*"\{\{[^}]+\}\}",)[^\n]*\n/m); if (!m) throw new Error('không thấy EMAIL_YCCS trong ' + fp);
      t = t.replace(m[0], m[1] + '       // form con B subF_XacNhanPheDuyet\n  HOTEN_YCCS:     "{{' + SUB.B + '_textField-1}}",\n'); log.push('config.js: + HOTEN_YCCS');
    }
    if (id === D && f === 'bootstrap.js' && !t.includes('HOTEN_YCCS')) {
      const a = '      if (lastName)  lib.setF(F.LAST_NAME, lastName);\n'; if (!t.includes(a)) throw new Error('không thấy chỗ chèn bootstrap ' + fp);
      t = t.replace(a, a + '      var hoTen = (firstName + " " + lastName).trim();   // thay công thức Họ + Tên cũ (field đã chuyển sang form con B)\n      if (hoTen && F.HOTEN_YCCS) lib.setF(F.HOTEN_YCCS, hoTen);\n'); log.push('bootstrap.js: + tự điền họ tên người duyệt');
    }
    if (t !== o) fs.writeFileSync(fp, t);
  }
  const mp = dir + '/.meta.json'; let m = fs.readFileSync(mp, 'utf8');
  if (!m.includes('"targetFormId"')) { m = m.replace(`"formId": "${id}",\n`, `"formId": "${id}",\n  "targetFormId": "${id}",\n`); fs.writeFileSync(mp, m); log.push('.meta.json: + targetFormId'); }
  console.log('== ' + p.basename(dir)); log.forEach(x => console.log('   ' + x));
  // còn sót id cũ?
  const left = fs.readdirSync(dir + '/code').flatMap(f => Object.keys(MAP).filter(a => MAP[a] !== 'DROP').filter(a => new RegExp(a.replace(/-/g, '\\-') + '(?![0-9])').test(fs.readFileSync(`${dir}/code/${f}`, 'utf8'))).map(a => f + ':' + a));
  if (left.length) console.log('   !! còn id cũ: ' + left.join(', '));
}
