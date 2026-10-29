// Xoá label của mọi element child_form (để trống) — cả node child_form lồng trong bản sao form con. --write để ghi.
const R=require('path').resolve(__dirname, '../..');
const api=require(R+'/src/eform/api'),fd=require(R+'/src/eform/formDef'),{extractVariables}=require(R+'/tools/regen_variable_arr'),fs=require('fs');
const WRITE=process.argv.includes('--write');
(async()=>{const s=await api.open('saigoncoop','sandbox');let tot=0,forms=0;
for(const id of fs.readFileSync(process.argv[2],'utf8').trim().split(/\s+/)){
  const f=await api.getForm(s,id);const {def,wasString}=fd.parseFormDef(f);if(!def){console.log('?? bỏ qua',id);continue;}
  const hit=[];(function w(n){if(n.type==='child_form'&&String(n.label||'').trim()){hit.push(n.label);n.label='';}(n.components||[]).forEach(w)})({components:def});
  if(!hit.length)continue; forms++;tot+=hit.length;
  console.log(`${f.formName.padEnd(52)} ${hit.length}: ${[...new Set(hit)].join(' | ').slice(0,90)}`);
  if(!WRITE)continue;
  fs.mkdirSync(R+'/.kyta/archive/saigoncoop-out',{recursive:true});fs.writeFileSync(`${R}/.kyta/archive/saigoncoop-out/backup_cflabel_${id}.json`,JSON.stringify({form:f}));
  const p=fd.buildOwnerFormPayload(f,def,wasString);p.variableArr=extractVariables(def);await api.putForm(s,p);
}
console.log(`tổng ${tot} label ở ${forms} form`+(WRITE?' — ĐÃ GHI':' [DRY-RUN]'));})().catch(e=>{console.error('✗',e.message);process.exit(1)});
