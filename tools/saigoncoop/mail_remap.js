// Đổi biến ${label_hashid} trong mẫu mail theo field đã chuyển sang form con (bo/<bộ>.map.json).
//   node mail_remap.js bo/<bộ>.map.json [--write]   (chỉ sửa file local; push bằng kyta email push)
const fs = require('fs'), p = require('path');
const R = require('path').resolve(__dirname, '../..');
const api = require(R + '/src/eform/api'), fd = require(R + '/src/eform/formDef');
const W = R + '/workspace/saigoncoop/sandbox/email';
const { MAP } = require(p.resolve(process.argv[2])); const WRITE = process.argv.includes('--write');
const node = (def, id) => { let r; (function w(n) { if (n.id === id) r = n; (n.components || []).forEach(w); })({ components: def }); return r; };
(async () => {
  const s = await api.open('saigoncoop', 'sandbox'); const subDefs = {};
  const mails = []; (function w(d) { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const f = p.join(d, e.name); if (e.isDirectory()) w(f); else if (e.name === 'content.html') mails.push(f); } })(W);
  const changed = new Set();
  for (const [oldId, newId] of Object.entries(MAP)) {
    const o = node(require(`./defs/${oldId.split('_')[0]}.json`).def, oldId); if (!o) { console.log('!! không thấy field gốc', oldId); continue; }
    const sid = newId.split('_')[0]; if (!subDefs[sid]) subDefs[sid] = fd.parseFormDef(await api.getForm(s, sid)).def;
    const n = node(subDefs[sid], newId);
    for (const f of mails) {
      let t = fs.readFileSync(f, 'utf8'); const re = new RegExp('\\$\\{[^}]*_' + o.hashid + '\\}', 'g'); const hits = t.match(re); if (!hits) continue;
      const nv = '${' + n.label + '_' + n.hashid + '}';
      console.log(`${p.basename(p.dirname(f))}\n    ${[...new Set(hits)].join(', ')} → ${nv}`);
      if (WRITE) { fs.writeFileSync(f, t.replace(re, nv)); changed.add(p.dirname(f)); }
    }
  }
  if (WRITE) fs.writeFileSync('mail_changed.txt', [...changed].join('\n'));
})().catch(e => { console.error(e); process.exit(1); });
