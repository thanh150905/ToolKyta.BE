// @ts-check
'use strict';
// Reselect subform vào child_form form cha, BẢO TOÀN readonly/disabled cấp field (cho họ form dùng readonly field-level: PR, DHTP, BOQ).
// Capture roMap theo key TRƯỚC khi ghi đè -> overwrite components -> re-apply roMap.
// Dùng: node tools/reselect_ro_preserve.js --sub=<SUBFORM_ID> [--dry] [--skip-name=<regex>]
//   --skip-name: bỏ qua form cha có formName khớp regex (vd form đã bỏ: --skip-name=^bỏ)
//   Field MỚI (chưa có ở bản cũ) không tính vào phép so locked before/after.
//   --only=<regex>: chỉ xử lý form cha có đường dẫn thư mục khớp regex (vd --only="Đơn hàng thành phẩm")
//   --allow-removed: cho qua khi phần lệch locked CHỈ do field readonly đã bị XOÁ khỏi subform (orphan).
const fs=require('fs');
const path=require('path');
const api=require('../src/eform/api');
const formDef=require('../src/eform/formDef');
const fields=require('../src/eform/fields');
const store=require('../src/core/store');
const { extractVariables }=require('./regen_variable_arr');

const argSub=(process.argv.find(a=>a.startsWith('--sub='))||'').split('=')[1];
const DRY=process.argv.includes('--dry');
const ALLOW_REMOVED=process.argv.includes('--allow-removed');
const argOnly=(process.argv.find(a=>a.startsWith('--only='))||'').slice('--only='.length);
const ONLY_RE=argOnly?new RegExp(argOnly):null;
const argSkip=(process.argv.find(a=>a.startsWith('--skip-name='))||'').slice('--skip-name='.length);
const SKIP_RE=argSkip?new RegExp(argSkip):null;
const EFORM_ROOT='workspace/bmw/sandbox/eform';
if(!argSub){console.error('Thiếu --sub=<SUBFORM_ID>');process.exit(1);}
const SUBFORM_ID=argSub;

function discoverParents(){
  const out=[];
  (function walk(dir){
    for(const name of fs.readdirSync(dir)){
      const p=path.join(dir,name); let st; try{st=fs.statSync(p);}catch(e){continue;}
      if(!st.isDirectory())continue;
      const metaP=path.join(p,'.meta.json'), fieldsP=path.join(p,'fields.json');
      if(fs.existsSync(metaP)&&fs.existsSync(fieldsP)){
        if(p.includes('_subforms'))continue;
        if(ONLY_RE&&!ONLY_RE.test(p))continue;
        if(fs.readFileSync(fieldsP,'utf8').includes(SUBFORM_ID))out.push(p);
      } else walk(p);
    }
  })(path.resolve(EFORM_ROOT));
  return out.sort();
}
function walkNodes(cs,fn){for(const c of cs||[]){fn(c);if(c.components)walkNodes(c.components,fn);}}
function captureRO(components){
  const map={};
  walkNodes(components,c=>{
    const id=c.hashid||c.key;
    if(!id)return;
    const rec={};
    if(c.readonly!==undefined)rec.readonly=c.readonly;
    if(c.disabled!==undefined)rec.disabled=c.disabled;
    if(c.config&&c.config.readonly!==undefined)rec.cfgReadonly=c.config.readonly;
    if(c.config&&c.config.disabled!==undefined)rec.cfgDisabled=c.config.disabled;
    if(Object.keys(rec).length)map[id]=rec;
  });
  return map;
}
function applyRO(components,map){
  let applied=0, orphan=[];
  const used={};
  walkNodes(components,c=>{
    const id=c.hashid||c.key;
    if(!id||!map[id])return;
    const rec=map[id]; used[id]=true;
    if(rec.readonly!==undefined)c.readonly=rec.readonly;
    if(rec.disabled!==undefined)c.disabled=rec.disabled;
    if(rec.cfgReadonly!==undefined){c.config=c.config||{};c.config.readonly=rec.cfgReadonly;}
    if(rec.cfgDisabled!==undefined){c.config=c.config||{};c.config.disabled=rec.cfgDisabled;}
    applied++;
  });
  for(const k in map)if(!used[k])orphan.push(k);
  return {applied,orphan};
}
function countLocked(components,onlyIds){
  let n=0;walkNodes(components,c=>{
    if(onlyIds&&!onlyIds[c.hashid||c.key])return;
    if(c.readonly===true||c.disabled===true||(c.config&&(c.config.readonly===true||c.config.disabled===true)))n++;
  });return n;
}
function idSet(components){const s={};walkNodes(components,c=>{const id=c.hashid||c.key;if(id)s[id]=true;});return s;}
async function main(){
  const parents=discoverParents();
  console.log(`Sub ${SUBFORM_ID}: ${parents.length} form cha${DRY?'  [DRY]':''}`);
  const sess=await api.open('bmw','sandbox');
  const subDef=formDef.parseFormDef(await api.getForm(sess,SUBFORM_ID)).def;
  const latest=formDef.contentComponents(subDef);
  console.log(`subform components=${latest.length}`);
  let ok=0,skip=0,err=0;
  for(let i=0;i<parents.length;i++){
    const absDir=parents[i];
    const meta=JSON.parse(fs.readFileSync(path.join(absDir,'.meta.json'),'utf8'));
    const formId=meta.targetFormId||meta.formId;
    const tag=`[${i+1}/${parents.length}] ${formId} (${meta.formName})`;
    try{
      const form=await api.getForm(sess,formId);
      if(SKIP_RE&&SKIP_RE.test(form.formName||meta.formName||'')){console.log(`  - ${tag}: bỏ qua (--skip-name, tên server "${form.formName}")`);skip++;continue;}
      const {def,wasString}=formDef.parseFormDef(form);
      const cf=formDef.collectByType(def,'child_form').find(c=>c.childFormConfig&&c.childFormConfig.childFormId===SUBFORM_ID);
      if(!cf){console.warn(`  ⚠ ${tag}: không thấy child_form`);skip++;continue;}
      const before=countLocked(cf.components);
      const oldIds=idSet(cf.components);
      const roMap=captureRO(cf.components);
      const cfRO={readonly:cf.readonly,disabled:cf.disabled};
      cf.components=JSON.parse(JSON.stringify(latest));
      const {applied,orphan}=applyRO(cf.components,roMap);
      if(cfRO.readonly!==undefined)cf.readonly=cfRO.readonly;
      if(cfRO.disabled!==undefined)cf.disabled=cfRO.disabled;
      const after=countLocked(cf.components,oldIds); // chỉ đếm field đã có trước -> field mới không làm lệch
      // Field readonly bị xoá khỏi subform (orphan) → hợp lệ khi chạy --allow-removed
      const lockedRemoved=orphan.filter(k=>{const r=roMap[k];return r&&(r.readonly||r.disabled||r.cfgReadonly||r.cfgDisabled);}).length;
      const okRemoved=ALLOW_REMOVED&&before-lockedRemoved===after;
      const flag=(before===after)?'OK':(okRemoved?`OK (bỏ ${lockedRemoved} field readonly đã xoá)`:'*** MISMATCH ***');
      console.log(`  ${tag}: locked before=${before} after=${after} applied=${applied} orphan=${orphan.length} ${flag}${orphan.length?' orphans:'+orphan.slice(0,8).join(','):''}`);
      if(before!==after&&!okRemoved){console.error('   -> DỪNG form này (RO không khớp), không push. Nếu lệch do đã xoá field readonly: thêm --allow-removed.');err++;continue;}
      if(DRY){ok++;continue;}
      const payload=formDef.buildOwnerFormPayload(form,def,wasString);
      payload.variableArr=extractVariables(def);
      await api.putForm(sess,payload);
      const doc=fields.buildDoc(def,formId);fields.writeDoc(absDir,doc);
      const snapId=meta.identityId||formId;const snap=store.getSnapshot(snapId);
      if(snap)store.saveSnapshot(snapId,snap.files||{},snap.ui,fields.docHashes(doc));
      store.audit({op:'childform-refresh-ro',formId,customer:'bmw',env:'sandbox',count:1});
      ok++;
    }catch(e){console.error(`  ✗ ${tag}: ${e.message}`);err++;}
  }
  console.log(`\n=== ${DRY?'DRY':'DONE'}: ok=${ok} skip=${skip} err=${err} ===`);
}
main().catch(e=>{console.error(e.stack);process.exit(1);});
