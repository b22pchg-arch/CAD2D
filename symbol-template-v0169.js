'use strict';
/* DWG Sketch PWA V0.16.9 - ROTATE command and persistent editable electrical symbol templates. */

const CUSTOM_SYMBOL_STORAGE_KEY='DwgSketchPwa.ElectricalSymbolTemplates.V1';
let customElectricalSymbolTemplates={};
let symbolTemplateEditSource=null;

function normalizeTemplateKey(value){
  let key=gridFold(value||'CUSTOM_SYMBOL');
  if(!key)key='CUSTOM_SYMBOL';
  if(!key.startsWith('CUSTOM_'))key='CUSTOM_'+key;
  return key;
}
function readTemplateField(raw,...names){
  if(!raw||typeof raw!=='object')return undefined;
  for(const name of names){if(Object.prototype.hasOwnProperty.call(raw,name))return raw[name]}
  const wanted=names.map(x=>String(x).toLowerCase());
  const key=Object.keys(raw).find(x=>wanted.includes(String(x).toLowerCase()));
  return key===undefined?undefined:raw[key];
}
function validTemplatePrimitive(p){
  if(Array.isArray(p)&&p.length)return ['line','circle','rect','poly','text'].includes(String(p[0]||'').toLowerCase());
  if(p&&typeof p==='object')return ['LINE','POLYLINE','CIRCLE','RECTANGLE','ELLIPSE','ARC','TEXT'].includes(String(readTemplateField(p,'Type','type')||'').toUpperCase());
  return false;
}
function templatePointValue(raw,fallback=[0,0]){
  if(Array.isArray(raw))return[num(raw[0],fallback[0]),num(raw[1],fallback[1])];
  return[num(readTemplateField(raw,'X','x'),fallback[0]),num(readTemplateField(raw,'Y','y'),fallback[1])];
}
function objectPrimitiveToArray(raw){
  const type=String(readTemplateField(raw,'Type','type')||'').toUpperCase();
  const a=templatePointValue(readTemplateField(raw,'A','a')),b=templatePointValue(readTemplateField(raw,'B','b')),c=templatePointValue(readTemplateField(raw,'Center','center'));
  if(type==='LINE')return['line',a[0],a[1],b[0],b[1]];
  if(type==='CIRCLE')return['circle',c[0],c[1],Math.abs(num(readTemplateField(raw,'Radius','radius')))];
  if(type==='RECTANGLE')return['rect',a[0],a[1],b[0],b[1]];
  if(type==='POLYLINE')return['poly',(readTemplateField(raw,'Points','points')||[]).map(q=>templatePointValue(q)),!!readTemplateField(raw,'Closed','closed')];
  if(type==='TEXT')return['text',c[0],c[1],String(readTemplateField(raw,'Text','text')||''),Math.max(.1,num(readTemplateField(raw,'Height','height'),3))];
  if(type==='ELLIPSE'){
    const rx=Math.abs(num(readTemplateField(raw,'RadiusX','radiusX'))),ry=Math.abs(num(readTemplateField(raw,'RadiusY','radiusY')));
    return['poly',Array.from({length:72},(_,i)=>{const q=Math.PI*2*i/72;return[c[0]+rx*Math.cos(q),c[1]+ry*Math.sin(q)]}),true];
  }
  if(type==='ARC'){
    const r=Math.abs(num(readTemplateField(raw,'Radius','radius'))),st=num(readTemplateField(raw,'StartDeg','startDeg')),en=num(readTemplateField(raw,'EndDeg','endDeg')),span=normalizeAngle(en-st)||360,parts=Math.max(12,Math.ceil(span/5));
    return['poly',Array.from({length:parts+1},(_,i)=>{const q=(st+span*i/parts)*Math.PI/180;return[c[0]+r*Math.cos(q),c[1]+r*Math.sin(q)]}),false];
  }
  return null;
}
function sanitizeElectricalTemplate(raw,keyHint=''){
  if(!raw||typeof raw!=='object')return null;
  const id=normalizeTemplateKey(readTemplateField(raw,'id','Id','key','Key')||keyHint||readTemplateField(raw,'name','Name'));
  const name=String(readTemplateField(raw,'name','Name','label','Label')||id).trim()||id;
  const rawPorts=readTemplateField(raw,'ports','Ports')||[];
  const ports=(Array.isArray(rawPorts)?rawPorts:[]).map((p,i)=>{
    if(Array.isArray(p))return[num(p[0]),num(p[1]),String(p[2]||('P'+(i+1))).trim()||('P'+(i+1))];
    const position=readTemplateField(p,'position','Position');
    const q=position!==undefined?templatePointValue(position):[num(readTemplateField(p,'x','X')),num(readTemplateField(p,'y','Y'))];
    return[q[0],q[1],String(readTemplateField(p,'name','Name')||('P'+(i+1))).trim()||('P'+(i+1))];
  }).filter(p=>Number.isFinite(p[0])&&Number.isFinite(p[1]));
  const rawPrimitives=readTemplateField(raw,'p','P','primitives','Primitives')||[];
  const primitives=(Array.isArray(rawPrimitives)?rawPrimitives:[]).filter(validTemplatePrimitive).map(p=>Array.isArray(p)?clone(p):objectPrimitiveToArray(p)).filter(Boolean);
  if(!primitives.length)return null;
  return{id,name,ports,p:primitives,custom:true,updatedAt:readTemplateField(raw,'updatedAt','UpdatedAt')||new Date().toISOString()};
}
function loadElectricalTemplateLibrary(){
  customElectricalSymbolTemplates={};
  try{
    const parsed=JSON.parse(localStorage.getItem(CUSTOM_SYMBOL_STORAGE_KEY)||'{}');
    const list=Array.isArray(parsed)?parsed:Object.values(parsed||{});
    for(const raw of list){const t=sanitizeElectricalTemplate(raw);if(t)customElectricalSymbolTemplates[t.id]=t}
  }catch(err){console.warn('Không đọc được thư viện mẫu thiết bị:',err)}
  mergeProjectElectricalTemplates();
  installCustomDefs();
  refreshElectricalSymbolTypeSelect();
}
function mergeProjectElectricalTemplates(){
  const list=project?.electricalSymbolTemplates;
  if(!Array.isArray(list))return;
  for(const raw of list){const t=sanitizeElectricalTemplate(raw);if(t&&!customElectricalSymbolTemplates[t.id])customElectricalSymbolTemplates[t.id]=t}
}
function installCustomDefs(){
  for(const [id,t] of Object.entries(customElectricalSymbolTemplates))ELECTRICAL_SYMBOL_DEFS[id]={name:t.name,ports:clone(t.ports),p:clone(t.p),custom:true};
}
function saveElectricalTemplateLibrary(){
  localStorage.setItem(CUSTOM_SYMBOL_STORAGE_KEY,JSON.stringify(Object.values(customElectricalSymbolTemplates),null,2));
  installCustomDefs();
  refreshElectricalSymbolTypeSelect();
}
function ensureProjectElectricalTemplate(id){
  const t=customElectricalSymbolTemplates[id];if(!t||!project)return;
  project.electricalSymbolTemplates=Array.isArray(project.electricalSymbolTemplates)?project.electricalSymbolTemplates:[];
  const index=project.electricalSymbolTemplates.findIndex(x=>normalizeTemplateKey(x.id||x.key||x.name)===id);
  if(index>=0)project.electricalSymbolTemplates[index]=clone(t);else project.electricalSymbolTemplates.push(clone(t));
}
function refreshElectricalSymbolTypeSelect(){
  const select=$('electricalSymbolType');if(!select)return;
  const current=select.value||'CIRCUIT_BREAKER';
  const builtins=Object.entries(ELECTRICAL_SYMBOL_DEFS).filter(([,d])=>!d.custom&&!String(d?.id||'').startsWith('CUSTOM_'));
  select.innerHTML='';
  const groupBuiltin=document.createElement('optgroup');groupBuiltin.label='Mẫu chuẩn';
  for(const [id,d] of builtins){const o=document.createElement('option');o.value=id;o.textContent=d.name||id;groupBuiltin.appendChild(o)}
  select.appendChild(groupBuiltin);
  const customs=Object.values(customElectricalSymbolTemplates).sort((a,b)=>a.name.localeCompare(b.name,'vi'));
  if(customs.length){const g=document.createElement('optgroup');g.label='Mẫu người dùng';for(const t of customs){const o=document.createElement('option');o.value=t.id;o.textContent=t.name;g.appendChild(o)}select.appendChild(g)}
  select.value=[...select.options].some(o=>o.value===current)?current:'CIRCUIT_BREAKER';
  updateSymbolTemplateButtons();
}
function updateSymbolTemplateButtons(){
  const id=$('electricalSymbolType')?.value||'';
  const custom=!!customElectricalSymbolTemplates[id];
  if($('deleteElectricalTemplateBtn'))$('deleteElectricalTemplateBtn').disabled=!custom;
}

// Keep custom type ids intact when topology CSV/JSON uses them.
if(typeof gridSymbolType==='function'){
  const originalGridSymbolType=gridSymbolType;
  gridSymbolType=function(value){const key=gridFold(value||'');if(customElectricalSymbolTemplates[key]||ELECTRICAL_SYMBOL_DEFS[key])return key;return originalGridSymbolType(value)};
}
const originalSymbolDef=symbolDef;
symbolDef=function(e){
  const snapshot=sanitizeElectricalTemplate(e?.symbolTemplateSnapshot||null,e?.symbolType||'');
  if(snapshot)return{name:snapshot.name,ports:snapshot.ports,p:snapshot.p,custom:true};
  const id=String(e?.symbolType||'').toUpperCase();
  return customElectricalSymbolTemplates[id]||ELECTRICAL_SYMBOL_DEFS[id]||originalSymbolDef(e);
};
insertElectricalSymbolAt=function(p){
  const id=$('electricalSymbolType')?.value||'CIRCUIT_BREAKER',template=customElectricalSymbolTemplates[id];
  if(template)ensureProjectElectricalTemplate(id);
  const e={type:'SYMBOL',symbolType:id,label:$('electricalSymbolLabel')?.value||'',position:point(p),symbolScale:Math.max(.1,num($('electricalSymbolScale')?.value,1)),rotationDeg:num($('electricalSymbolRotation')?.value,0),automationId:'node-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,6),color:hexToArgb($('newColor').value),stroke:Math.max(.2,num($('newStroke').value,2))};
  if(template)e.symbolTemplateSnapshot=clone(template);
  simpleAction('Đã chèn ký hiệu điện',()=>{overlays.push(e);selected=[refFor(e,'overlay')];syncElectricalAutomationFromSymbols()});setTool('select');
};
const originalElectricalGridNodeEntity=electricalGridNodeEntity;
electricalGridNodeEntity=function(node,options){const e=originalElectricalGridNodeEntity(node,options),t=customElectricalSymbolTemplates[node.type];if(t){e.symbolTemplateSnapshot=clone(t);ensureProjectElectricalTemplate(node.type)}return e};

function rotateSelectionOpen(){
  if(!selected.length){status('ROTATE: hãy chọn một hoặc nhiều đối tượng trước.');return}
  const base=selectionCenter();
  $('rotateBaseX').value=base.x.toFixed(6);$('rotateBaseY').value=base.y.toFixed(6);$('rotateAngleInput').value='90';
  $('rotateModal').classList.add('show');setTimeout(()=>{$('rotateAngleInput').focus();$('rotateAngleInput').select()},60);
}
function rotateSelectionApply(){
  const angle=num($('rotateAngleInput').value,NaN),base={x:num($('rotateBaseX').value,NaN),y:num($('rotateBaseY').value,NaN)};
  if(!Number.isFinite(angle)||!Number.isFinite(base.x)||!Number.isFinite(base.y)){alert('Góc quay và tọa độ điểm gốc phải là số hợp lệ.');return}
  simpleAction(`Đã ROTATE ${selected.length} đối tượng ${angle}°`,()=>{selected.forEach(s=>rotateItem(s.item,base,angle));syncElectricalAutomationFromSymbols()});
  $('rotateModal').classList.remove('show');status(`Đã quay ${selected.length} đối tượng ${angle}° quanh (${base.x.toFixed(3)}, ${base.y.toFixed(3)}).`);
}

function templateMarkerColor(){return 0xff00e5ff}
function explodeElectricalSymbolForEditing(){
  const refs=selected.filter(s=>s.kind==='overlay'&&String(s.item?.type||'').toUpperCase()==='SYMBOL');
  if(refs.length!==1){alert('Hãy chọn đúng một ký hiệu điện rồi dùng “Bung mẫu để sửa”.');return}
  const ref=refs[0],source=ref.item,session='symedit-'+Date.now().toString(36),created=[];
  for(const p of symbolWorldPrimitives(source)){
    let e=null;
    if(p.type==='line')e={type:'LINE',a:point(p.a),b:point(p.b)};
    else if(p.type==='circle')e={type:'CIRCLE',center:point(p.center),radius:p.radius};
    else if(p.type==='poly')e={type:'POLYLINE',points:p.points.map(point),closed:!!p.closed};
    else if(p.type==='text')e={type:'TEXT',position:point(p.position),text:p.text,height:p.height,rotationDeg:p.rotationDeg,fontName:'Segoe UI'};
    if(e){e.color=source.color;e.stroke=source.stroke;e.symbolTemplateEditId=session;e.symbolTemplatePrimitive=true;created.push(e)}
  }
  for(const port of symbolPorts(source))created.push({type:'CIRCLE',center:point(port.point),radius:Math.max(.7,2*num(source.symbolScale,1)),color:templateMarkerColor(),stroke:1.2,symbolTemplateEditId:session,symbolTemplatePortMarker:true,symbolTemplatePortName:port.name});
  symbolTemplateEditSource={id:String(source.symbolType||''),name:ELECTRICAL_SYMBOL_DEFS[source.symbolType]?.name||source.symbolType||'Mẫu thiết bị'};
  simpleAction('Đã bung ký hiệu thành hình học chỉnh sửa',()=>{overlays=overlays.filter(x=>x!==source);overlays.push(...created);selected=created.map(e=>refFor(e,'overlay'))});
  status('Đã bung mẫu. Chỉnh sửa hình học, di chuyển các vòng tròn cyan để đặt cổng, sau đó bấm “Lưu lựa chọn thành mẫu”.');
}
function templateSelectionItems(){return selected.filter(s=>s.kind==='overlay').map(s=>s.item).filter(e=>String(e.type||'').toUpperCase()!=='SYMBOL')}
function templateBounds(items){let b={minX:Infinity,minY:Infinity,maxX:-Infinity,maxY:-Infinity};for(const e of items.filter(x=>!x.symbolTemplatePortMarker)){const q=getItemBounds(e);if(!q)continue;b.minX=Math.min(b.minX,q.minX);b.minY=Math.min(b.minY,q.minY);b.maxX=Math.max(b.maxX,q.maxX);b.maxY=Math.max(b.maxY,q.maxY)}return Number.isFinite(b.minX)?b:null}
function arcAsPoly(e,parts=36){const c=point(e.center),r=Math.abs(num(e.radius)),start=num(e.startDeg),sweep=normalizeAngle(num(e.endDeg)-start)||360;return Array.from({length:parts+1},(_,i)=>{const a=(start+sweep*i/parts)*Math.PI/180;return{x:c.x+r*Math.cos(a),y:c.y+r*Math.sin(a)}})}
function ellipseAsPoly(e,parts=48){const c=point(e.center),rx=Math.abs(num(e.radius)),ry=Math.abs(num(e.radiusY,e.radius));return Array.from({length:parts},(_,i)=>{const a=2*Math.PI*i/parts;return{x:c.x+rx*Math.cos(a),y:c.y+ry*Math.sin(a)}})}
function itemToTemplatePrimitive(e,origin){const t=String(e.type||'').toUpperCase(),rel=p=>[point(p).x-origin.x,point(p).y-origin.y];
  if(t==='LINE'){const a=rel(e.a),b=rel(e.b);return['line',a[0],a[1],b[0],b[1]]}
  if(t==='CIRCLE'){const c=rel(e.center);return['circle',c[0],c[1],Math.abs(num(e.radius))]}
  if(t==='POLYLINE'||t==='LWPOLYLINE'||t==='TRIANGLE'||t==='FILL')return['poly',(e.points||[]).map(rel),!!e.closed||t==='TRIANGLE'||t==='FILL'];
  if(t==='RECTANGLE'||t==='SQUARE'){const a=point(e.a),b=point(e.b);return['poly',[[a.x-origin.x,a.y-origin.y],[b.x-origin.x,a.y-origin.y],[b.x-origin.x,b.y-origin.y],[a.x-origin.x,b.y-origin.y]],true]}
  if(t==='ARC')return['poly',arcAsPoly(e).map(rel),false];
  if(t==='ELLIPSE')return['poly',ellipseAsPoly(e).map(rel),true];
  if(t==='TEXT'||t==='MTEXT'){const p=rel(e.position);return['text',p[0],p[1],String(e.text||''),Math.max(.1,num(e.height,2.5))]}
  return null;
}
function openSaveElectricalTemplate(){
  const items=templateSelectionItems();if(!items.length){alert('Hãy chọn các hình học tạo thành mẫu thiết bị.');return}
  const b=templateBounds(items);if(!b){alert('Không xác định được hình học mẫu.');return}
  const proposed=symbolTemplateEditSource?.id||'CUSTOM_DEVICE';
  $('symbolTemplateKey').value=normalizeTemplateKey(proposed);$('symbolTemplateName').value=symbolTemplateEditSource?.name||'Mẫu thiết bị tùy chỉnh';
  const portNames=items.filter(x=>x.symbolTemplatePortMarker).map(x=>x.symbolTemplatePortName||'P');$('symbolTemplatePorts').value=portNames.join(', ');
  $('symbolTemplateModal').classList.add('show');setTimeout(()=>$('symbolTemplateName').focus(),60);
}
function saveSelectedAsElectricalTemplate(){
  const items=templateSelectionItems(),b=templateBounds(items);if(!b)return;
  const origin={x:(b.minX+b.maxX)/2,y:(b.minY+b.maxY)/2},id=normalizeTemplateKey($('symbolTemplateKey').value),name=String($('symbolTemplateName').value||id).trim()||id;
  const primitives=items.filter(x=>!x.symbolTemplatePortMarker).map(x=>itemToTemplatePrimitive(x,origin)).filter(Boolean);
  if(!primitives.length){alert('Mẫu không có primitive hợp lệ.');return}
  const requested=String($('symbolTemplatePorts').value||'').split(/[,;\n]+/).map(x=>x.trim()).filter(Boolean);
  const markers=items.filter(x=>x.symbolTemplatePortMarker),ports=markers.map((m,i)=>{const c=point(m.center);return[c.x-origin.x,c.y-origin.y,requested[i]||m.symbolTemplatePortName||('P'+(i+1))]});
  customElectricalSymbolTemplates[id]={id,name,ports,p:primitives,custom:true,updatedAt:new Date().toISOString()};saveElectricalTemplateLibrary();ensureProjectElectricalTemplate(id);
  $('electricalSymbolType').value=id;$('symbolTemplateModal').classList.remove('show');symbolTemplateEditSource={id,name};
  status(`Đã lưu mẫu “${name}” (${primitives.length} primitive, ${ports.length} cổng). Mẫu sẽ còn dùng được ở các phiên sau.`);
}
function deleteSelectedElectricalTemplate(){
  const id=$('electricalSymbolType')?.value||'';const t=customElectricalSymbolTemplates[id];if(!t)return;
  if(!confirm(`Xóa mẫu người dùng “${t.name}”? Các ký hiệu đã chèn trong bản vẽ vẫn giữ snapshot mẫu trong dự án.`))return;
  delete customElectricalSymbolTemplates[id];delete ELECTRICAL_SYMBOL_DEFS[id];saveElectricalTemplateLibrary();if(project?.electricalSymbolTemplates)project.electricalSymbolTemplates=project.electricalSymbolTemplates.filter(x=>normalizeTemplateKey(x.id||x.name)!==id);status('Đã xóa mẫu '+t.name);
}
function exportElectricalTemplateLibrary(){
  const payload={schema:'dwg-sketch-electrical-symbol-library',schemaVersion:1,exportedAt:new Date().toISOString(),templates:Object.values(customElectricalSymbolTemplates)};
  downloadTextFile('DWG_Sketch_Electrical_Symbol_Library.json',JSON.stringify(payload,null,2),'application/json;charset=utf-8');
}
async function importElectricalTemplateLibrary(file){
  if(!file)return;try{const data=JSON.parse(await file.text()),list=Array.isArray(data)?data:(data.templates||[]);let count=0;for(const raw of list){const t=sanitizeElectricalTemplate(raw);if(t){customElectricalSymbolTemplates[t.id]=t;count++}}saveElectricalTemplateLibrary();status(`Đã nhập ${count} mẫu thiết bị.`)}catch(err){alert('Không nhập được thư viện mẫu: '+err.message)}finally{file.value=''}
}

const originalLoadProjectObjectV0169=loadProjectObject;
loadProjectObject=function(...args){
  const result=originalLoadProjectObjectV0169(...args);
  mergeProjectElectricalTemplates();installCustomDefs();refreshElectricalSymbolTypeSelect();
  return result;
};

function initializeV0169Commands(){
  loadElectricalTemplateLibrary();
  $('rotateCommandBtn')?.addEventListener('click',rotateSelectionOpen);$('rotateSelectedBtn')?.addEventListener('click',rotateSelectionOpen);
  $('rotateCancel')?.addEventListener('click',()=>$('rotateModal').classList.remove('show'));$('rotateApply')?.addEventListener('click',rotateSelectionApply);
  $('explodeElectricalTemplateBtn')?.addEventListener('click',explodeElectricalSymbolForEditing);$('saveElectricalTemplateBtn')?.addEventListener('click',openSaveElectricalTemplate);$('deleteElectricalTemplateBtn')?.addEventListener('click',deleteSelectedElectricalTemplate);
  $('exportElectricalTemplateBtn')?.addEventListener('click',exportElectricalTemplateLibrary);$('importElectricalTemplateBtn')?.addEventListener('click',()=>$('electricalTemplateImportInput')?.click());$('electricalTemplateImportInput')?.addEventListener('change',e=>importElectricalTemplateLibrary(e.target.files?.[0]));
  $('symbolTemplateCancel')?.addEventListener('click',()=>$('symbolTemplateModal').classList.remove('show'));$('symbolTemplateSave')?.addEventListener('click',saveSelectedAsElectricalTemplate);$('electricalSymbolType')?.addEventListener('change',updateSymbolTemplateButtons);
  const originalCommand=command;command=function(cmd){const key=String(cmd||'').trim().toUpperCase();if(['RO','ROTATE','XOAY'].includes(key)){if(key)addCommandHistory(key);rotateSelectionOpen();$('commandInput').value='';return}if(key==='SYMEDIT'){explodeElectricalSymbolForEditing();$('commandInput').value='';return}if(key==='SYMSAVE'){openSaveElectricalTemplate();$('commandInput').value='';return}if(key==='SYMDELETE'){deleteSelectedElectricalTemplate();$('commandInput').value='';return}if(key==='SYMEXPORT'){exportElectricalTemplateLibrary();$('commandInput').value='';return}if(key==='SYMIMPORT'){$('electricalTemplateImportInput')?.click();$('commandInput').value='';return}return originalCommand(cmd)};
  // Project/workspace may be restored after this script loads. Re-merge on first user interaction and periodically after file open.
  document.addEventListener('pointerdown',()=>{mergeProjectElectricalTemplates();installCustomDefs();},{once:true});
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',initializeV0169Commands);else initializeV0169Commands();
