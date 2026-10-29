// Gỡ form con Logo nằm trong bản Start lồng của form Update (giữ Logo cấp trên cùng) — như luồng 1. --write để ghi.
const R=require('path').resolve(__dirname, '../..');
const api=require(R+'/src/eform/api'),fd=require(R+'/src/eform/formDef'),{extractVariables}=require(R+'/tools/regen_variable_arr'),fs=require('fs');
const LOGO='000071JlI0Df4KBJ05JPsQQ1Q', WRITE=process.argv.includes('--write');
const isLogo=n=>n&&n.type==='child_form'&&n.childFormConfig&&n.childFormConfig.childFormId===LOGO;
(async()=>{const s=await api.open('saigoncoop','sandbox');
for(const id of process.argv.slice(2).filter(a=>!a.startsWith('--'))){
  const f=await api.getForm(s,id);const {def,wasString}=fd.parseFormDef(f);if(!def){console.log('?? không đọc được def',id,f&&f.formName,Object.keys(f||{}).slice(0,8));continue;}let gone=0;
  const strip=n=>{if(!Array.isArray(n.components))return;const before=n.components.length;n.components=n.components.filter(c=>!isLogo(c));gone+=before-n.components.length;n.components.forEach(strip);};
  for(const c of def[0].components) if(c.type==='child_form'&&!isLogo(c)) strip(c);
  const top=def[0].components.filter(isLogo).length;
  console.log(`${f.formName.padEnd(50)} logo cấp trên ${top} · gỡ trong bản lồng ${gone}`);
  if(!WRITE||!gone)continue;
  fs.mkdirSync(R+'/.kyta/archive/saigoncoop-out',{recursive:true});fs.writeFileSync(`${R}/.kyta/archive/saigoncoop-out/backup_logo_${id}.json`,JSON.stringify({form:f}));
  const p=fd.buildOwnerFormPayload(f,def,wasString);p.variableArr=extractVariables(def);await api.putForm(s,p);
}})().catch(e=>{console.error('✗',e.message);process.exit(1)});
