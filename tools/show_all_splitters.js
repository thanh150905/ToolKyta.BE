// @ts-check
'use strict';
// Task 3: set display:true cho MỌI splitter trong tất cả form (kể cả splitter lồng trong child_form).
// Dùng: node scratch/show_all_splitters.js [--dry]
const fs=require('fs');
const path=require('path');
const api=require('../src/eform/api');
const formDef=require('../src/eform/formDef');
const fields=require('../src/eform/fields');
const store=require('../src/core/store');
const { extractVariables }=require('./regen_variable_arr');

const DRY=process.argv.includes('--dry');
const EFORM_ROOT='workspace/bmw/sandbox/eform';

function listForms(){
  const out=[];
  (function walk(dir){
    for(const name of fs.readdirSync(dir)){
      const p=path.join(dir,name); let st; try{st=fs.statSync(p);}catch(e){continue;}
      if(!st.isDirectory())continue;
      if(fs.existsSync(path.join(p,'.meta.json'))&&fs.existsSync(path.join(p,'fields.json'))) out.push(p);
      else walk(p);
    }
  })(path.resolve(EFORM_ROOT));
  return out.sort();
}
function flipSplitters(node,counter){
  if(!node||typeof node!=='object')return;
  if(Array.isArray(node)){node.forEach(n=>flipSplitters(n,counter));return;}
  if(node.type==='splitter'){
    if(node.display!==true){node.display=true;counter.n++;}
    if(node.config&&node.config.display!==undefined&&node.config.display!==true){node.config.display=true;}
  }
  if(node.components)flipSplitters(node.components,counter);
}
async function main(){
  const forms=listForms();
  console.log(`${forms.length} form${DRY?'  [DRY]':''}`);
  const sess=await api.open('bmw','sandbox');
  let touched=0,changedSplit=0,skip=0,err=0,noChange=0;
  for(let i=0;i<forms.length;i++){
    const absDir=forms[i];
    const meta=JSON.parse(fs.readFileSync(path.join(absDir,'.meta.json'),'utf8'));
    const formId=meta.targetFormId||meta.formId;
    const tag=`[${i+1}/${forms.length}] ${formId} (${meta.formName})`;
    try{
      const form=await api.getForm(sess,formId);
      const {def,wasString}=formDef.parseFormDef(form);
      if(!def){console.warn(`  ⚠ ${tag}: no def`);skip++;continue;}
      const counter={n:0};
      flipSplitters(formDef.contentComponents(def),counter);
      if(counter.n===0){noChange++;continue;}
      changedSplit+=counter.n;
      console.log(`  ${tag}: +${counter.n} splitter -> true`);
      if(DRY){touched++;continue;}
      const payload=formDef.buildOwnerFormPayload(form,def,wasString);
      payload.variableArr=extractVariables(def);
      await api.putForm(sess,payload);
      const doc=fields.buildDoc(def,formId);fields.writeDoc(absDir,doc);
      const snapId=meta.identityId||formId;const snap=store.getSnapshot(snapId);
      if(snap)store.saveSnapshot(snapId,snap.files||{},snap.ui,fields.docHashes(doc));
      store.audit({op:'show-splitters',formId,customer:'bmw',env:'sandbox',count:counter.n});
      touched++;
    }catch(e){console.error(`  ✗ ${tag}: ${e.message}`);err++;}
  }
  console.log(`\n=== ${DRY?'DRY':'DONE'}: forms_touched=${touched} splitters_flipped=${changedSplit} noChange=${noChange} skip=${skip} err=${err} ===`);
}
main().catch(e=>{console.error(e.stack);process.exit(1);});
