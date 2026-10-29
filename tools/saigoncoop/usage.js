// Field của form nào đang được docx eWriter (placeholder "Label (hashid)") hoặc mẫu mail (${label_hashid}) dùng.
//   node usage.js <formId>[,<formId>...]
const fs=require('fs'),p=require('path');const W=require('path').resolve(__dirname, '../..') + '/workspace/saigoncoop/sandbox';
const docs=fs.readdirSync(W+'/ewriter').map(d=>[d,fs.readFileSync(p.join(W,'ewriter',d,'document.xml'),'utf8')]);
const mails=[];(function w(d){for(const e of fs.readdirSync(d,{withFileTypes:true})){const f=p.join(d,e.name);if(e.isDirectory())w(f);else if(e.name==='content.html')mails.push([p.basename(d),fs.readFileSync(f,'utf8')]);}})(W+'/email');
for(const id of process.argv[2].split(',')){const j=require(require('path').resolve(__dirname, '../../.kyta/archive/saigoncoop-out/defs') + '/'+id+'.json');console.log('### '+j.name);
 const w=n=>{if(n.hashid&&n.id&&n.id.startsWith(id+'_')){const k=n.id.slice(id.length+1);
   const d=docs.filter(([,x])=>x.includes('('+n.hashid+')')).map(([nm,x])=>nm.replace('.docx','')+(x.includes(n.label+' ('+n.hashid+')')?'':' [LABEL LỆCH]'));
   const m=mails.filter(([,x])=>x.includes('_'+n.hashid+'}')).map(([nm])=>nm);
   if(d.length||m.length)console.log('  '+k.padEnd(24)+'«'+n.label+'» '+n.hashid+(d.length?'  DOCX: '+d.join(' | '):'')+(m.length?'  MAIL: '+m.join(' | '):''));}
  if(n.type!=='child_form')(n.components||[]).forEach(w)};j.def.forEach(w);}
