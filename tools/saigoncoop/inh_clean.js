// R02b/R07 luồng 1: bỏ dòng kế thừa có nguồn hoặc đích không còn trên form (node 17, 5, 18.1, 26.1). node inh_clean.js [--write]
const R=require('path').resolve(__dirname, '../..');
const api=require(R+'/src/eflow/api'),eformApi=require(R+'/src/eform/api'),fs=require('fs');
const WRITE=process.argv.includes('--write'), M='00007mzImMIW2zVlrGe';
const NODES={'sid-4E9FBC2B-7633-497C-9D37-10130D7A69D6':'17','sid-520C93D3-43C1-4BE1-AAD1-07E0D6F76997':'5','sid-4B48F1EC-E44B-4B55-A4C1-E73D2BB3A0D8':'18.1','sid-3B3C3B15-1B2D-4B1A-B455-2D3F71318BF8':'26.1'};
(async()=>{const ef=await eformApi.open('saigoncoop','sandbox'),fl=await api.open('saigoncoop','sandbox');const cache={};
const H=async fid=>cache[fid]||(cache[fid]=(()=>{})()||await (async()=>{const f=await eformApi.getForm(ef,fid);const m=new Set();(function w(n){if(n.hashid)m.add(n.hashid);(n.components||[]).forEach(w)})({components:JSON.parse(f.jsonForm)});return m;})());
const bound=await api.eforms(fl,M);const formOf=t=>(bound.find(b=>(b.userTaskId||null)===(t||null))||{}).formId;
for(const [sid,name] of Object.entries(NODES)){
  const cfg=await api.inheritOf(fl,M,sid);const ext=(await api.externalForms(fl,M,sid))[0];const tf=await H(ext.formId);
  const keep=[],drop=[];
  for(const r of cfg.sources){let ok=tf.has(r.elementTarget);for(const e of r.listElementSource||[]){if(!(await H(formOf(e.userTaskId))).has(e.hashId))ok=false;}
    (ok?keep:drop).push(r);}
  console.log(`node ${name}: ${cfg.sources.length} dòng → bỏ ${drop.length}: ${drop.map(r=>(r.listElementSource||[]).map(e=>e.label).join('+')+'→'+r.elementTarget).join(' | ')}`);
  if(!WRITE||!drop.length)continue;
  fs.writeFileSync(`${__dirname}/backup_inhclean_${name}.json`,JSON.stringify(cfg));
  await api.saveInherit(fl,{id:cfg.id,sources:keep,userTaskId:sid,versionId:ext.versionId,modelerId:M,formId:ext.formId});
  const chk=await api.inheritOf(fl,M,sid);console.log(`   ✓ ghi → ${chk.sources.length} dòng`);
}
if(!WRITE)console.log('[DRY-RUN]');})().catch(e=>{console.error('✗',e.stack);process.exit(1)});
