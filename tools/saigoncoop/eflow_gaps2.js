// Liệt kê cấu hình eFlow còn trỏ field đã chuyển sang form con (kế thừa, eNotify, người thực hiện, dây điều kiện).
//   node eflow_gaps2.js bo/<tên>.map.json
const api=require(require('path').resolve(__dirname, '../..') + '/src/eflow/api'),modeler=require(require('path').resolve(__dirname, '../..') + '/src/eflow/modeler'),fs=require('fs');
const {S,D,U,MAP}=require(require('path').resolve(process.argv[2]));const GONE=Object.keys(MAP);const IDS3=[S,D,U].filter(Boolean);
const sh=id=>({[S]:'S',[D]:'D',[U]:'U'}[id.split('_')[0]]||id.split('_')[0].slice(-6))+'.'+id.split('_').slice(1).join('_');
const hit=s=>GONE.filter(g=>new RegExp(g.replace(/-/g,'\\-')+'(?![0-9])').test(s));
(async()=>{const s=await api.open('saigoncoop','sandbox');const m=await modeler.load(s,'00007mzImMIW2zVlrGe');const nm=id=>(m.nodes.find(n=>n.rid===id)||{}).name||id;
 for(const n of m.nodes)if(n.formId&&[S,D,U].includes(n.formId))console.log('NODE',n.rid,'«'+n.name+'»',sh(n.formId+'_'));
 console.log('== KẾ THỪA');for(const c of await api.inheritAll(s,m.id)){const rows=(c.sources||[]).filter(x=>hit(JSON.stringify(x)).length);if(rows.length){console.log(' ['+nm(c.userTaskId)+'] config '+c.id+' ('+c.sources.length+' dòng)');rows.forEach(x=>console.log('    đích '+sh(x.fieldId.replace(/-Target.*/,''))+' ← '+(x.listElementSource||[]).map(y=>'['+nm(y.userTaskId)+'] '+sh(y.fieldId.replace(/-Root.*/,''))+' «'+y.label+'»').join(', ')));}}
 console.log('== eNOTIFY');for(const n of m.nodes.filter(n=>n.stencil==='eNotify'))for(const x of await api.notifyConfigs(s,m.id,n.rid)){const h=hit(JSON.stringify(x));if(h.length)console.log(' '+x.id+' «'+x.templateName+'» người nhận = '+h.map(sh).join(','));}
 console.log('== NGƯỜI THỰC HIỆN');for(const n of m.nodes.filter(n=>n.stencil==='CallActivity'||n.stencil==='UserTask')){let r=[];try{r=await api.implementers(s,n.rid,m.id)}catch(e){}const h=hit(JSON.stringify(r));if(h.length)console.log(' ['+n.name+'] dùng field '+h.map(sh).join(','));}
 console.log('== DÂY ĐIỀU KIỆN');const f=JSON.parse(fs.readFileSync(require('path').resolve(__dirname, '../..') + '/workspace/saigoncoop/sandbox/eflow/Trên 500tr_Đấu thầu rộng rãi, hạn chế/flow.json','utf8'));const x=typeof f.jsonXml==='string'?JSON.parse(f.jsonXml):(f.jsonXml||f);
 for(const shp of x.childShapes||[]){const h=hit(JSON.stringify(shp));if(h.length){const ce=JSON.stringify(shp.properties.conditionsequenceflow||'');console.log(' '+shp.stencil.id+' «'+(shp.properties.name||'')+'» đọc '+h.map(sh).join(',')+'  '+(ce.match(/getVariable[^)]*\)[^&|]{0,40}/g)||[]).join(' ; '));}}
})().catch(e=>{console.error(e);process.exit(1)});
