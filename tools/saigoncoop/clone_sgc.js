// Clone form saigoncoop/sandbox + chuyển trạng thái 1→2→3→4. node clone_sgc.js <src> <code> <name>
const R=require('path').resolve(__dirname, '../..');
const api=require(R+'/src/eform/api'), fd=require(R+'/src/eform/formDef'), http=require(R+'/src/core/http');
(async()=>{
  const [src,code,name]=process.argv.slice(2);
  const s=await api.open('saigoncoop','sandbox');
  const f=await api.getForm(s,src); const {def}=fd.parseFormDef(f); const srcCode=await api.getCode(s,src);
  if(!(await api.checkIdAvailable(s,code))) throw new Error('trùng mã '+code);
  const c=await api.createForm(s,{formName:name,formCode:code,describeForm:f.describeForm??'',beginTime:'2026/01/01',endTime:'2030/12/31'});
  const id=c.formId; console.log('tạo',id);
  let va=f.variableArr; if(typeof va==='string') va=JSON.parse(va);
  const nf=await api.getForm(s,id); nf.variableArr=va;
  const nd=JSON.parse(JSON.stringify(def).split(src).join(id)); const p=fd.buildOwnerFormPayload(nf,nd,true); p.variableArr=require(R+'/tools/regen_variable_arr').extractVariables(nd); p.jsonFormCondition=String(f.jsonFormCondition||'[]').split(src).join(id); await api.putForm(s,p);
  if(Object.keys(srcCode).length){for(const v of Object.values(srcCode)) v.code=v.code.split(src).join(id); await api.putCode(s,id,srcCode);}
  const B='/services/eform/api/owner/form';
  await http.request(s,'GET',`${B}/change-status?formId=${id}`);
  await http.request(s,'DELETE',`${B}/change-status?formId=${id}`);
  await http.request(s,'GET',`${B}/change-status-edit?formId=${id}`);
  const g=await api.getForm(s,id); console.log('xong',id,'status',g.statusForm, g.formName);
})().catch(e=>{console.error('✗',e.message);process.exit(1)});
