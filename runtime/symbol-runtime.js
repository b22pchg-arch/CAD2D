/* ===== BEGIN CONSOLIDATED SOURCE: symbol-template-v0169.js ===== */
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
  const version=String(readTemplateField(raw,'version','Version')||'1.0.0').trim()||'1.0.0',revision=Math.max(1,Math.trunc(num(readTemplateField(raw,'revision','Revision'),1))),category=String(readTemplateField(raw,'category','Category')||'Custom').trim()||'Custom',rawTags=readTemplateField(raw,'tags','Tags'),tags=(Array.isArray(rawTags)?rawTags:[]).map(x=>String(x||'').trim()).filter(Boolean);
  return{id,name,ports,p:primitives,custom:true,updatedAt:readTemplateField(raw,'updatedAt','UpdatedAt')||new Date().toISOString(),version,revision,category,tags};
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
  if(template){e.symbolTemplateSnapshot=clone(template);window.DwgSketchSymbolInstanceLinkV0226?.stamp?.(e,template)}
  simpleAction('Đã chèn ký hiệu điện',()=>{overlays.push(e);selected=[refFor(e,'overlay')];syncElectricalAutomationFromSymbols()});setTool('select');
};
const originalElectricalGridNodeEntity=electricalGridNodeEntity;
electricalGridNodeEntity=function(node,options){const e=originalElectricalGridNodeEntity(node,options),t=customElectricalSymbolTemplates[node.type];if(t){e.symbolTemplateSnapshot=clone(t);window.DwgSketchSymbolInstanceLinkV0226?.stamp?.(e,t);ensureProjectElectricalTemplate(node.type)}return e};

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
  if(window.DwgSketchSymbolCatalogV0226?.isReadOnly?.()){status('Catalog hiện tại là read-only; hãy chuyển sang catalog người dùng để lưu mẫu.');return}
  const items=templateSelectionItems(),b=templateBounds(items);if(!b)return;
  const origin={x:(b.minX+b.maxX)/2,y:(b.minY+b.maxY)/2},id=normalizeTemplateKey($('symbolTemplateKey').value),name=String($('symbolTemplateName').value||id).trim()||id;
  const primitives=items.filter(x=>!x.symbolTemplatePortMarker).map(x=>itemToTemplatePrimitive(x,origin)).filter(Boolean);
  if(!primitives.length){alert('Mẫu không có primitive hợp lệ.');return}
  const requested=String($('symbolTemplatePorts').value||'').split(/[,;\n]+/).map(x=>x.trim()).filter(Boolean);
  const markers=items.filter(x=>x.symbolTemplatePortMarker),ports=markers.map((m,i)=>{const c=point(m.center);return[c.x-origin.x,c.y-origin.y,requested[i]||m.symbolTemplatePortName||('P'+(i+1))]});
  const previous=customElectricalSymbolTemplates[id];customElectricalSymbolTemplates[id]={id,name,ports,p:primitives,custom:true,updatedAt:new Date().toISOString(),version:previous?.version||'1.0.0',revision:Math.max(1,(Number(previous?.revision)||0)+1),category:previous?.category||'Custom',tags:Array.isArray(previous?.tags)?clone(previous.tags):[]};saveElectricalTemplateLibrary();ensureProjectElectricalTemplate(id);
  $('electricalSymbolType').value=id;$('symbolTemplateModal').classList.remove('show');symbolTemplateEditSource={id,name};
  status(`Đã lưu mẫu “${name}” (${primitives.length} primitive, ${ports.length} cổng). Mẫu sẽ còn dùng được ở các phiên sau.`);
}
function deleteSelectedElectricalTemplate(){
  if(window.DwgSketchSymbolCatalogV0226?.isReadOnly?.()){status('Catalog hiện tại là read-only; không thể xóa mẫu.');return}
  const id=$('electricalSymbolType')?.value||'';const t=customElectricalSymbolTemplates[id];if(!t)return;
  if(!confirm(`Xóa mẫu người dùng “${t.name}”? Các ký hiệu đã chèn trong bản vẽ vẫn giữ snapshot mẫu trong dự án.`))return;
  delete customElectricalSymbolTemplates[id];delete ELECTRICAL_SYMBOL_DEFS[id];saveElectricalTemplateLibrary();if(project?.electricalSymbolTemplates)project.electricalSymbolTemplates=project.electricalSymbolTemplates.filter(x=>normalizeTemplateKey(x.id||x.name)!==id);status('Đã xóa mẫu '+t.name);
}
function exportElectricalTemplateLibrary(){
  const payload={schema:'dwg-sketch-electrical-symbol-library',schemaVersion:2,libraryVersion:'1.0.0',appVersion:'0.22.19',exportedAt:new Date().toISOString(),templates:Object.values(customElectricalSymbolTemplates)};
  downloadTextFile('DWG_Sketch_Electrical_Symbol_Library.json',JSON.stringify(payload,null,2),'application/json;charset=utf-8');
}
async function importElectricalTemplateLibrary(file){
  if(window.DwgSketchSymbolCatalogV0226?.isReadOnly?.()){status('Catalog hiện tại là read-only; hãy chuyển catalog trước khi nhập mẫu.');return}
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
;
/* ===== END CONSOLIDATED SOURCE: symbol-template-v0169.js ===== */

/* ===== BEGIN CONSOLIDATED SOURCE: cad-interaction-architecture-v0225.js ===== */
'use strict';
(()=>{
  const API_VERSION='0.22.5',DELTA_KIND='selection-delta-v0225',STRUCTURAL_KIND='structural-delta-v0225',CURVE_KIND='curve-edit-delta-v0225';
  const state={
    commandRequests:0,commandHandled:0,renderRequests:0,geometryInvalidations:0,
    selectionRevision:0,selectionOwnedMutations:0,entityRevision:0,historyUndo:0,historyRedo:0,
    historySnapshots:0,deltaEntries:0,deltaBytes:0,deltaKinds:{},transactionsStarted:0,
    transactionsCommitted:0,transactionsCanceled:0,activeTransaction:null,lastCommandMs:0,lastSelectionKey:''
  };
  const commands=new Map(),aliases=new Map();
  const norm=v=>String(v??'').trim().toUpperCase();
  const deepClone=v=>{try{return structuredClone(v)}catch{try{return JSON.parse(JSON.stringify(v))}catch{return null}}};

  function registerCommand(canonical,handler,...names){
    canonical=norm(canonical);if(!canonical||typeof handler!=='function')return false;
    commands.set(canonical,handler);aliases.set(canonical,canonical);
    for(const n of names.flat())if(norm(n))aliases.set(norm(n),canonical);
    return true;
  }
  function selectionKey(){
    try{return `${selected?.length||0}|${(selected||[]).map(x=>String(x?.kind||'')+':'+String(x?.item?.sourceHandle||x?.item?.handle||x?.item?.blockInstanceId||x?.item?.a4TemplateInstanceId||((x?.kind||'')==='overlay'?overlays?.indexOf(x.item):entities?.indexOf(x.item)))).join(';')}`}
    catch{return '0|'}
  }
  function syncSelection(force=false){const k=selectionKey();if(force||k!==state.lastSelectionKey){state.lastSelectionKey=k;state.selectionRevision++}}
  function noteOwnedSelection(){state.selectionOwnedMutations++;syncSelection(true)}
  function clearSelection(){if(!Array.isArray(selected))return false;if(!selected.length)return true;selected=[];noteOwnedSelection();return true}
  function replaceSelection(refs){selected=Array.isArray(refs)?refs.filter(Boolean):[];noteOwnedSelection();return selected.length}
  function selectSingle(ref){selected=ref?[ref]:[];noteOwnedSelection();return selected.length}
  function toggleSelection(ref){if(!ref)return false;if(!Array.isArray(selected))selected=[];const i=selected.findIndex(x=>x?.item===ref.item);if(i>=0)selected.splice(i,1);else selected.push(ref);noteOwnedSelection();return i<0}

  function beginTransaction(name='EDIT'){state.transactionsStarted++;state.activeTransaction=String(name||'EDIT')}
  function commitTransaction(){if(!state.activeTransaction)return;state.transactionsCommitted++;state.activeTransaction=null}
  function cancelTransaction(){if(!state.activeTransaction)return;state.transactionsCanceled++;state.activeTransaction=null}
  function noteDelta(kind,entry){state.deltaEntries++;const bytes=JSON.stringify(entry||{}).length*2;state.deltaBytes+=bytes;kind=norm(kind)||'EDIT';state.deltaKinds[kind]=(state.deltaKinds[kind]||0)+1}

  function refDescriptor(ref){
    if(!ref?.item)return null;const kind=String(ref.kind||'').toLowerCase();
    const arr=kind==='overlay'?overlays:entities,index=Array.isArray(arr)?arr.indexOf(ref.item):-1;
    if(index<0)return null;return{kind,index,before:deepClone(ref.item)};
  }
  function selectionDescriptors(refs=(selected||[])){return(refs||[]).map(refDescriptor).filter(Boolean).map(d=>({kind:d.kind,index:d.index}))}
  function refsFromDescriptors(items){const refs=[];for(const d of items||[]){const arr=d.kind==='overlay'?overlays:entities;if(!Array.isArray(arr)||d.index<0||d.index>=arr.length)continue;const item=arr[d.index];try{refs.push(refFor(item,d.kind))}catch{refs.push({kind:d.kind,item})}}return refs}
  function captureSelectionDelta(name){
    const refs=(selected||[]).map(refDescriptor).filter(Boolean);if(!refs.length)return null;
    beginTransaction(name);return{name:norm(name)||'EDIT',refs};
  }
  function finalizeSelectionDelta(tx,label){
    if(!tx?.refs?.length){cancelTransaction();return false}
    for(const d of tx.refs){const arr=d.kind==='overlay'?overlays:entities;if(!Array.isArray(arr)||d.index<0||d.index>=arr.length){cancelTransaction();return false}d.after=deepClone(arr[d.index])}
    const changed=tx.refs.some(d=>JSON.stringify(d.before)!==JSON.stringify(d.after));
    if(!changed){cancelTransaction();return false}
    const entry={kind:DELTA_KIND,name:tx.name,refs:tx.refs};
    if(!Array.isArray(undoStack))undoStack=[];undoStack.push(entry);if(typeof trimAdaptiveHistory==='function')trimAdaptiveHistory(undoStack);redoStack=[];
    noteDelta(tx.name,entry);commitTransaction();try{setDirty(true);status(label||`Đã ${tx.name} bằng transaction delta.`);updateHistoryButtons()}catch{}
    return true;
  }
  function applyDelta(entry,useAfter){
    if(!entry||entry.kind!==DELTA_KIND||!Array.isArray(entry.refs))return false;
    const next=[];
    for(const d of entry.refs){const arr=d.kind==='overlay'?overlays:entities,snap=useAfter?d.after:d.before;if(!Array.isArray(arr)||d.index<0||d.index>=arr.length||!snap)return false;const clone=deepClone(snap);arr[d.index]=clone;try{next.push(refFor(clone,d.kind))}catch{next.push({kind:d.kind,item:clone})}}
    replaceSelection(next);try{recalcBounds();invalidateGeometryCaches();updateSelectionPanel();updateHistoryButtons();setDirty(true);draw()}catch{}
    return true;
  }
  let pendingStructural=null;
  function pushDeltaEntry(entry,kind){
    if(!entry)return false;
    if(!Array.isArray(undoStack))undoStack=[];
    undoStack.push(entry);if(typeof trimAdaptiveHistory==='function')trimAdaptiveHistory(undoStack);redoStack=[];
    noteDelta(kind||entry.name||'STRUCTURAL',entry);commitTransaction();try{setDirty(true);updateHistoryButtons()}catch{}
    return true;
  }
  function beginStructuralAdd(name='ADD'){
    if(pendingStructural)return false;
    beginTransaction(name);
    pendingStructural={mode:'add',name:norm(name)||'ADD',entityStart:Array.isArray(entities)?entities.length:0,overlayStart:Array.isArray(overlays)?overlays.length:0,previousSelection:selectionDescriptors()};
    return true;
  }
  function commitStructuralAdd(label){
    const p=pendingStructural;if(!p||p.mode!=='add')return false;
    const items=[];
    for(let i=p.overlayStart;i<(overlays?.length||0);i++)items.push({kind:'overlay',index:i,snapshot:deepClone(overlays[i])});
    for(let i=p.entityStart;i<(entities?.length||0);i++)items.push({kind:'entity',index:i,snapshot:deepClone(entities[i])});
    pendingStructural=null;
    if(!items.length){cancelTransaction();return false}
    const entry={kind:STRUCTURAL_KIND,name:p.name,mode:'add',items,beforeSelection:p.previousSelection||[]};
    const ok=pushDeltaEntry(entry,p.name);try{if(ok)status(label||`Đã ${p.name} bằng structural delta.`)}catch{}return ok;
  }
  function cancelStructuralAdd(restoreSelection=true){
    const p=pendingStructural;if(!p||p.mode!=='add')return false;
    if(Array.isArray(overlays)&&overlays.length>=p.overlayStart)overlays.splice(p.overlayStart);
    if(Array.isArray(entities)&&entities.length>=p.entityStart)entities.splice(p.entityStart);
    const previous=p.previousSelection||[];pendingStructural=null;cancelTransaction();
    if(restoreSelection)replaceSelection(refsFromDescriptors(previous));else clearSelection();
    try{recalcBounds();invalidateGeometryCaches();updateSelectionPanel();updateHistoryButtons();draw()}catch{}
    return true;
  }
  function beginStructuralRemove(name='DELETE',refs=(selected||[])){
    if(pendingStructural)return false;
    const items=(refs||[]).map(refDescriptor).filter(Boolean).map(d=>({kind:d.kind,index:d.index,snapshot:d.before}));
    if(!items.length)return false;
    beginTransaction(name);pendingStructural={mode:'remove',name:norm(name)||'DELETE',items};return true;
  }
  function commitStructuralRemove(label){
    const p=pendingStructural;if(!p||p.mode!=='remove')return false;pendingStructural=null;
    const entry={kind:STRUCTURAL_KIND,name:p.name,mode:'remove',items:p.items};
    const ok=pushDeltaEntry(entry,p.name);try{if(ok)status(label||`Đã ${p.name} bằng structural delta.`)}catch{}return ok;
  }
  function cancelStructural(){if(!pendingStructural)return false;pendingStructural=null;cancelTransaction();return true}
  function applyStructural(entry,targetAfter){
    if(!entry||entry.kind!==STRUCTURAL_KIND||!Array.isArray(entry.items))return false;
    const shouldContain=entry.mode==='add'?targetAfter:!targetAfter,next=[];
    const overlaysItems=entry.items.filter(x=>x.kind==='overlay'),entityItems=entry.items.filter(x=>x.kind==='entity');
    if(shouldContain){
      for(const d of overlaysItems.slice().sort((a,b)=>a.index-b.index)){if(d.index<0||d.index>overlays.length||!d.snapshot)return false;const c=deepClone(d.snapshot);overlays.splice(d.index,0,c);try{next.push(refFor(c,'overlay'))}catch{next.push({kind:'overlay',item:c})}}
      for(const d of entityItems.slice().sort((a,b)=>a.index-b.index)){if(d.index<0||d.index>entities.length||!d.snapshot)return false;const c=deepClone(d.snapshot);entities.splice(d.index,0,c);try{next.push(refFor(c,'entity'))}catch{next.push({kind:'entity',item:c})}}
    }else{
      for(const d of overlaysItems.slice().sort((a,b)=>b.index-a.index)){if(d.index<0||d.index>=overlays.length)return false;overlays.splice(d.index,1)}
      for(const d of entityItems.slice().sort((a,b)=>b.index-a.index)){if(d.index<0||d.index>=entities.length)return false;entities.splice(d.index,1)}
    }
    const selection=shouldContain?next:(entry.mode==='add'?refsFromDescriptors(entry.beforeSelection):[]);
    replaceSelection(selection);try{recalcBounds();invalidateGeometryCaches();updateSelectionPanel();updateHistoryButtons();setDirty(true);draw()}catch{}return true;
  }
  let pendingCurve=null;
  function beginCurveEdit(name='CURVE_EDIT',ref){
    if(pendingCurve||pendingStructural)return false;
    const d=refDescriptor(ref);if(!d)return false;
    beginTransaction(name);pendingCurve={name:norm(name)||'CURVE_EDIT',kind:d.kind,index:d.index,before:[d.before]};return true;
  }
  function commitCurveEdit(afterCount=1,label){
    const p=pendingCurve;if(!p)return false;pendingCurve=null;
    const arr=p.kind==='overlay'?overlays:entities,count=Math.max(0,Math.trunc(Number(afterCount)||0));
    if(!Array.isArray(arr)||count<=0||p.index<0||p.index+count>arr.length){cancelTransaction();return false}
    const after=[];for(let i=0;i<count;i++)after.push(deepClone(arr[p.index+i]));
    const entry={kind:CURVE_KIND,name:p.name,container:p.kind,index:p.index,before:p.before,after};
    const changed=JSON.stringify(entry.before)!==JSON.stringify(entry.after);
    if(!changed){cancelTransaction();return false}
    const ok=pushDeltaEntry(entry,p.name);try{if(ok)status(label||`Đã ${p.name} bằng curve edit delta.`)}catch{}return ok;
  }
  function cancelCurveEdit(){if(!pendingCurve)return false;pendingCurve=null;cancelTransaction();return true}
  function applyCurveEdit(entry,targetAfter){
    if(!entry||entry.kind!==CURVE_KIND||!Array.isArray(entry.before)||!Array.isArray(entry.after))return false;
    const arr=entry.container==='overlay'?overlays:entities;if(!Array.isArray(arr))return false;
    const removeCount=targetAfter?entry.before.length:entry.after.length,replacement=targetAfter?entry.after:entry.before;
    if(entry.index<0||removeCount<=0||entry.index+removeCount>arr.length||!replacement.length)return false;
    arr.splice(entry.index,removeCount,...replacement.map(deepClone));
    try{recalcBounds();invalidateGeometryCaches();updateSelectionPanel();updateHistoryButtons();setDirty(true);draw()}catch{}return true;
  }
  function undoArchitectureDelta(){
    if(!Array.isArray(undoStack)||!undoStack.length)return false;const e=undoStack[undoStack.length-1];
    if(e?.kind!==DELTA_KIND&&e?.kind!==STRUCTURAL_KIND&&e?.kind!==CURVE_KIND)return false;undoStack.pop();
    const ok=e.kind===CURVE_KIND?applyCurveEdit(e,false):(e.kind===STRUCTURAL_KIND?applyStructural(e,false):applyDelta(e,false));if(!ok){undoStack.push(e);return true}
    if(!Array.isArray(redoStack))redoStack=[];redoStack.push(e);if(typeof trimAdaptiveHistory==='function')trimAdaptiveHistory(redoStack);state.historyUndo++;try{status(`Đã Undo ${e.name} bằng ${e.kind===CURVE_KIND?'curve edit':(e.kind===STRUCTURAL_KIND?'structural':'transaction')} delta.`)}catch{}return true;
  }
  function redoArchitectureDelta(){
    if(!Array.isArray(redoStack)||!redoStack.length)return false;const e=redoStack[redoStack.length-1];
    if(e?.kind!==DELTA_KIND&&e?.kind!==STRUCTURAL_KIND&&e?.kind!==CURVE_KIND)return false;redoStack.pop();
    const ok=e.kind===CURVE_KIND?applyCurveEdit(e,true):(e.kind===STRUCTURAL_KIND?applyStructural(e,true):applyDelta(e,true));if(!ok){redoStack.push(e);return true}
    if(!Array.isArray(undoStack))undoStack=[];undoStack.push(e);if(typeof trimAdaptiveHistory==='function')trimAdaptiveHistory(undoStack);state.historyRedo++;try{status(`Đã Redo ${e.name} bằng ${e.kind===CURVE_KIND?'curve edit':(e.kind===STRUCTURAL_KIND?'structural':'transaction')} delta.`)}catch{}return true;
  }
  function undoDelta(){return undoArchitectureDelta()}
  function redoDelta(){return redoArchitectureDelta()}

  function snapshot(){
    syncSelection();let entityCount=0,overlayCount=0,selectedCount=0;
    try{entityCount=entities?.length||0}catch{}try{overlayCount=overlays?.length||0}catch{}try{selectedCount=selected?.length||0}catch{}
    return{apiVersion:API_VERSION,entityRevision:state.entityRevision,selectionRevision:state.selectionRevision,selectionOwnedMutations:state.selectionOwnedMutations,
      entityCount,overlayCount,selectedCount,renderRequests:state.renderRequests,geometryInvalidations:state.geometryInvalidations,
      commandRequests:state.commandRequests,commandHandled:state.commandHandled,historyUndo:state.historyUndo,historyRedo:state.historyRedo,
      historySnapshots:state.historySnapshots,deltaEntries:state.deltaEntries,deltaBytes:state.deltaBytes,deltaKinds:{...state.deltaKinds},
      transactionsStarted:state.transactionsStarted,transactionsCommitted:state.transactionsCommitted,transactionsCanceled:state.transactionsCanceled,
      activeTransaction:state.activeTransaction,lastCommandMs:+state.lastCommandMs.toFixed(3)};
  }
  function health(){const s=snapshot();let projectEntities=s.entityCount,projectOverlays=s.overlayCount;try{projectEntities=project?.entities?.length??s.entityCount;projectOverlays=project?.overlays?.length??s.overlayCount}catch{}const ok=projectEntities===s.entityCount&&projectOverlays===s.overlayCount;return{ok,snapshot:s,checks:{entityArray:projectEntities===s.entityCount,overlayArray:projectOverlays===s.overlayCount,selectionService:true,deltaHistory:true,commandFallback:typeof originalCommand==='function',renderPipeline:typeof originalDraw==='function'}}}
  function report(check=false){const h=health(),s=h.snapshot,text=`CAD_ARCH_V0225 | Entity rev=${s.entityRevision} | Selection rev=${s.selectionRevision} | Owned selection=${s.selectionOwnedMutations} | Selected=${s.selectedCount} | Render req=${s.renderRequests} | Geometry invalidations=${s.geometryInvalidations} | Commands=${s.commandHandled}/${s.commandRequests} | Snapshot=${s.historySnapshots} | Delta=${s.deltaEntries} | Tx=${s.transactionsCommitted}/${s.transactionsStarted} | Health=${h.ok?'OK':'CHECK'}`;try{status((check?'ARCHCHECK: ':'')+text)}catch{console.info(text)}return h}
  function reportTransactions(){const s=snapshot(),kinds=Object.entries(s.deltaKinds).map(([k,v])=>`${k}:${v}`).join(',');const text=`TX_V0225 | Delta=${s.deltaEntries} (${(s.deltaBytes/1024).toFixed(1)} KiB) | Snapshot=${s.historySnapshots} | Tx=${s.transactionsCommitted}/${s.transactionsStarted} | Kinds=${kinds}`;try{status(text)}catch{console.info(text)}return s}

  const originalCommand=typeof command==='function'?command:null;
  if(originalCommand){const wrapped=function(cmd){const key=norm(cmd);state.commandRequests++;syncSelection();const canonical=aliases.get(key);if(canonical&&commands.has(canonical)){const t=performance.now();let result;try{result=commands.get(canonical)()}finally{state.lastCommandMs=performance.now()-t}state.commandHandled++;try{if(key&&typeof addCommandHistory==='function')addCommandHistory(key);if(typeof $==='function'&&$('commandInput'))$('commandInput').value=''}catch{}return result}const t=performance.now();try{return originalCommand(cmd)}finally{state.lastCommandMs=performance.now()-t;syncSelection()}};try{command=wrapped}catch{window.command=wrapped}}
  const originalDraw=typeof draw==='function'?draw:null;if(originalDraw){const wrapped=function(...args){state.renderRequests++;syncSelection();return originalDraw.apply(this,args)};try{draw=wrapped}catch{window.draw=wrapped}}
  const originalInvalidate=typeof invalidateGeometryCaches==='function'?invalidateGeometryCaches:null;if(originalInvalidate){const wrapped=function(...args){state.geometryInvalidations++;state.entityRevision++;return originalInvalidate.apply(this,args)};try{invalidateGeometryCaches=wrapped}catch{window.invalidateGeometryCaches=wrapped}}
  const previousUndo=typeof undo==='function'?undo:null;if(previousUndo){const wrapped=function(...args){if(undoDelta())return;state.historyUndo++;return previousUndo.apply(this,args)};try{undo=wrapped}catch{window.undo=wrapped}}
  const previousRedo=typeof redo==='function'?redo:null;if(previousRedo){const wrapped=function(...args){if(redoDelta())return;state.historyRedo++;return previousRedo.apply(this,args)};try{redo=wrapped}catch{window.redo=wrapped}}

  const originalSelectHit=typeof selectHit==='function'?selectHit:null;
  if(originalSelectHit){const wrapped=function(hit,add){if(!hit){if(!add)clearSelection()}else if(add)toggleSelection(hit);else selectSingle(hit);try{updateSelectionPanel();updateHistoryButtons();draw()}catch{};return hit};try{selectHit=wrapped}catch{window.selectHit=wrapped}}
  const clearBtn=document.getElementById('clearSelectionBtn');if(clearBtn)clearBtn.onclick=()=>{clearSelection();try{updateSelectionPanel();updateHistoryButtons();draw();status('Đã bỏ chọn toàn bộ đối tượng qua Selection Service V0.22.5.')}catch{}};

  const previousRotateSelected=typeof rotateSelected==='function'?rotateSelected:null;
  if(previousRotateSelected){const wrapped=function(deg){if(!(selected||[]).length)return;const ref=selectionCenter(),referenceBounds=window.DwgSketchMacroEngineV02210?.captureReferenceBounds?.(),tx=captureSelectionDelta('ROTATE');try{const c=selectionCenter();selected.forEach(s=>rotateItem(s.item,c,deg));recalcBounds();finalizeSelectionDelta(tx,`Đã xoay ${deg}° bằng transaction delta.`);window.DwgSketchMacroEngineV02210?.recordRelativeTransform?.('RROTATE',{pivotOffsetX:c.x-ref.x,pivotOffsetY:c.y-ref.y,angleDeg:deg,referenceBounds});updateSelectionPanel();draw()}catch(err){cancelTransaction();throw err}};try{rotateSelected=wrapped}catch{window.rotateSelected=wrapped}}
  const scaleApply=document.getElementById('scaleApply');if(scaleApply)scaleApply.onclick=()=>{const f=num(document.getElementById('scaleFactorInput')?.value,NaN);if(!(f>0&&Number.isFinite(f))){alert('Hệ số SCALE phải là số dương.');return}const ref=selectionCenter(),referenceBounds=window.DwgSketchMacroEngineV02210?.captureReferenceBounds?.(),base=scaleBasePoint||ref,tx=captureSelectionDelta('SCALE');try{selected.forEach(s=>scaleItem(s.item,base,f));recalcBounds();finalizeSelectionDelta(tx,`Đã SCALE ${selected.length} đối tượng × ${f} bằng transaction delta.`);window.DwgSketchMacroEngineV02210?.recordRelativeTransform?.('RSCALE',{pivotOffsetX:base.x-ref.x,pivotOffsetY:base.y-ref.y,factor:f,referenceBounds});scaleBasePoint=null;document.getElementById('scaleModal')?.classList.remove('show');setTool('select');updateSelectionPanel();draw()}catch(err){cancelTransaction();throw err}};
  const rotateApply=document.getElementById('rotateApply');if(rotateApply)rotateApply.addEventListener('click',e=>{e.preventDefault();e.stopImmediatePropagation();const angle=num(document.getElementById('rotateAngleInput')?.value,NaN),base={x:num(document.getElementById('rotateBaseX')?.value,NaN),y:num(document.getElementById('rotateBaseY')?.value,NaN)};if(!Number.isFinite(angle)||!Number.isFinite(base.x)||!Number.isFinite(base.y)){alert('Góc quay và tọa độ điểm gốc phải là số hợp lệ.');return}const ref=selectionCenter(),referenceBounds=window.DwgSketchMacroEngineV02210?.captureReferenceBounds?.(),tx=captureSelectionDelta('ROTATE');try{selected.forEach(s=>rotateItem(s.item,base,angle));try{syncElectricalAutomationFromSymbols()}catch{}recalcBounds();finalizeSelectionDelta(tx,`Đã ROTATE ${selected.length} đối tượng ${angle}° bằng transaction delta.`);window.DwgSketchMacroEngineV02210?.recordRelativeTransform?.('RROTATE',{pivotOffsetX:base.x-ref.x,pivotOffsetY:base.y-ref.y,angleDeg:angle,referenceBounds});document.getElementById('rotateModal')?.classList.remove('show');updateSelectionPanel();draw()}catch(err){cancelTransaction();throw err}},true);

  const previousMirrorSelected=typeof mirrorSelected==='function'?mirrorSelected:null;
  if(previousMirrorSelected){const wrapped=function(a,b){if(!(selected||[]).length){try{status('Hãy chọn đối tượng trước khi dùng Đối xứng.');setTool('select')}catch{}return}if(typeof dist==='function'&&dist(a,b)<1e-9){try{status('Trục đối xứng không hợp lệ.')}catch{}return}const ref=selectionCenter(),referenceBounds=window.DwgSketchMacroEngineV02210?.captureReferenceBounds?.(),sourceMode=window.DwgSketchMirrorOptionsV02221?.getMode?.()==='DELETE'?'DELETE':'KEEP',count=selected.length;if(sourceMode==='KEEP'){const structural=window.DwgSketchCadArchitectureV0225?.transaction;if(structural?.beginStructuralAdd?.('MIRROR')){try{const copied=duplicateSelectedForCopy();selected.forEach(s=>mirrorItem(s.item,a,b));recalcBounds();invalidateGeometryCaches?.();structural.commitStructuralAdd(`Đã MIRROR ${copied} đối tượng · giữ đối tượng gốc.`);window.DwgSketchMacroEngineV02210?.recordRelativeTransform?.('RMIRROR',{axisAOffsetX:a.x-ref.x,axisAOffsetY:a.y-ref.y,axisBOffsetX:b.x-ref.x,axisBOffsetY:b.y-ref.y,sourceMode:'KEEP',referenceBounds});try{syncElectricalAutomationFromSymbols()}catch{}setTool('select');updateSelectionPanel();draw();return}catch(err){structural.cancelStructuralAdd?.();throw err}}return previousMirrorSelected(a,b)}const tx=captureSelectionDelta('MIRROR');try{selected.forEach(s=>mirrorItem(s.item,a,b));recalcBounds();finalizeSelectionDelta(tx,`Đã MIRROR ${count} đối tượng · xóa đối tượng gốc.`);window.DwgSketchMacroEngineV02210?.recordRelativeTransform?.('RMIRROR',{axisAOffsetX:a.x-ref.x,axisAOffsetY:a.y-ref.y,axisBOffsetX:b.x-ref.x,axisBOffsetY:b.y-ref.y,sourceMode:'DELETE',referenceBounds});try{syncElectricalAutomationFromSymbols()}catch{}setTool('select');updateSelectionPanel();draw()}catch(err){cancelTransaction();throw err}};try{mirrorSelected=wrapped}catch{window.mirrorSelected=wrapped}}

  const previousApplyProperties=typeof applyProperties==='function'?applyProperties:null,applyBtn=document.getElementById('applyBtn');
  if(previousApplyProperties&&applyBtn)applyBtn.onclick=()=>{if(!(selected||[]).length)return previousApplyProperties();const tx=captureSelectionDelta('PROPERTIES'),previousSimpleAction=typeof simpleAction==='function'?simpleAction:null;try{if(previousSimpleAction){simpleAction=function(_label,fn){fn();recalcBounds();updateSelectionPanel();draw()}}previousApplyProperties();finalizeSelectionDelta(tx,'Đã áp dụng thuộc tính bằng transaction delta.');updateSelectionPanel();draw()}catch(err){cancelTransaction();throw err}finally{if(previousSimpleAction)try{simpleAction=previousSimpleAction}catch{window.simpleAction=previousSimpleAction}}};

  registerCommand('ARCHINFO',()=>report(false),'ARCH','COREINFO');registerCommand('ARCHCHECK',()=>report(true),'CORECHECK');registerCommand('TXINFO',()=>reportTransactions(),'HISTORYINFO','DELTAINFO');

  window.DwgSketchCadArchitectureV0225={version:API_VERSION,registerCommand,snapshot,health,report,reportTransactions,beginTransaction,commitTransaction,cancelTransaction,
    selection:{clear:clearSelection,replace:replaceSelection,single:selectSingle,toggle:toggleSelection,sync:syncSelection},
    transaction:{captureSelectionDelta,finalizeSelectionDelta,noteDelta,beginStructuralAdd,commitStructuralAdd,cancelStructuralAdd,beginStructuralRemove,commitStructuralRemove,cancelStructural,applyStructural,beginCurveEdit,commitCurveEdit,cancelCurveEdit,applyCurveEdit},noteSelection:syncSelection,noteGeometry(){state.geometryInvalidations++;state.entityRevision++},noteRender(){state.renderRequests++}};
  console.info(`[DWG Sketch] CAD Interaction Architecture ${API_VERSION} ready.`);
})();
;
/* ===== END CONSOLIDATED SOURCE: cad-interaction-architecture-v0225.js ===== */

/* ===== BEGIN CONSOLIDATED SOURCE: symbol-library-catalog-v0226.js ===== */
'use strict';
(()=>{
  const VERSION='0.22.6',KEY='DwgSketchPwa.ElectricalSymbolLibraryCatalog.V1';
  let catalog={schema:'dwg-sketch-electrical-symbol-catalog',schemaVersion:1,catalogVersion:'1.0.0',activeLibraryId:'user.local',libraries:[]};
  const ns=v=>String(v||'').trim().toLowerCase().replace(/[^a-z0-9._-]+/g,'-').replace(/^[-._]+|[-._]+$/g,'')||'user.local';
  const makeLib=(name='Thư viện người dùng',namespace='user.local',version='1.0.0')=>({id:ns(namespace),namespace:ns(namespace),name:String(name||namespace).trim()||namespace,version:/^\d+\.\d+\.\d+$/.test(String(version||''))?String(version):'1.0.0',revision:1,readOnly:false,sourceKind:'User',updatedAt:new Date().toISOString(),templates:[]});
  function current(){return catalog.libraries.find(x=>x.id===catalog.activeLibraryId)||catalog.libraries[0]}
  function normalize(){catalog.libraries=(catalog.libraries||[]).map(x=>({...x,id:ns(x.id||x.namespace),namespace:ns(x.namespace||x.id),name:String(x.name||x.namespace||x.id||'Library'),version:/^\d+\.\d+\.\d+$/.test(String(x.version||''))?x.version:'1.0.0',revision:Math.max(1,Math.trunc(Number(x.revision)||1)),templates:(x.templates||[]).map(t=>sanitizeElectricalTemplate(t)).filter(Boolean)}));if(!catalog.libraries.length)catalog.libraries=[makeLib()];if(!catalog.libraries.some(x=>x.id===catalog.activeLibraryId))catalog.activeLibraryId=catalog.libraries[0].id}
  function load(){try{const p=JSON.parse(localStorage.getItem(KEY)||'null');if(p&&Array.isArray(p.libraries))catalog=p}catch{}if(!catalog.libraries?.length){const lib=makeLib();lib.templates=Object.values(customElectricalSymbolTemplates||{}).map(clone);catalog.libraries=[lib];catalog.activeLibraryId=lib.id;save(false)}normalize();activate(catalog.activeLibraryId,false);refresh()}
  function save(sync=true){if(sync)syncCurrent(false);normalize();localStorage.setItem(KEY,JSON.stringify(catalog,null,2));refresh()}
  function syncCurrent(bumpRevision=false){const lib=current();if(!lib)return;lib.templates=Object.values(customElectricalSymbolTemplates||{}).map(clone);if(bumpRevision){lib.revision=Math.max(1,(Number(lib.revision)||1)+1);lib.updatedAt=new Date().toISOString()}}
  function activate(id,persist=true){const lib=catalog.libraries.find(x=>x.id===id);if(!lib)return;catalog.activeLibraryId=lib.id;customElectricalSymbolTemplates={};for(const t of lib.templates||[]){const q=sanitizeElectricalTemplate(t);if(q)customElectricalSymbolTemplates[q.id]=q}installCustomDefs();refreshElectricalSymbolTypeSelect();if(persist){localStorage.setItem(KEY,JSON.stringify(catalog,null,2));try{legacySave()}catch{}}refresh()}
  function refresh(){const sel=$('electricalCatalogSelect');if(sel){const cur=catalog.activeLibraryId;sel.innerHTML='';for(const l of catalog.libraries){const o=document.createElement('option');o.value=l.id;o.textContent=`${l.name} [${l.namespace}] v${l.version} r${l.revision}`;sel.appendChild(o)}sel.value=cur}const s=$('electricalCatalogStatus');const l=current();if(s&&l)s.textContent=`Active: ${l.namespace} · v${l.version} r${l.revision} · ${(l.templates||[]).length} mẫu · ${catalog.libraries.length} collection`}
  const legacySave=saveElectricalTemplateLibrary;saveElectricalTemplateLibrary=function(){const lib=current();if(lib?.readOnly){status(`Catalog “${lib.name}” [${lib.namespace}] là read-only; hãy chuyển sang catalog người dùng để sửa.`);return}legacySave();if(lib){lib.templates=Object.values(customElectricalSymbolTemplates).map(clone);lib.revision=Math.max(1,(Number(lib.revision)||1)+1);lib.updatedAt=new Date().toISOString();localStorage.setItem(KEY,JSON.stringify(catalog,null,2));refresh()}};
  const legacyExportLibrary=exportElectricalTemplateLibrary;exportElectricalTemplateLibrary=function(){const lib=current();if(!lib){legacyExportLibrary();return}const payload={schema:'dwg-sketch-electrical-symbol-library',schemaVersion:3,libraryId:lib.id,namespace:lib.namespace,name:lib.name,libraryVersion:lib.version,revision:Math.max(1,Number(lib.revision)||1),readOnly:!!lib.readOnly,sourceKind:lib.sourceKind||'User',appVersion:VERSION,exportedAt:new Date().toISOString(),templates:Object.values(customElectricalSymbolTemplates||{}).map(clone)};downloadTextFile('DWG_Sketch_Electrical_Symbol_Library.symbol-library.json',JSON.stringify(payload,null,2),'application/json;charset=utf-8')};
  function uniqueImportedId(value){const first=ns(value);if(!catalog.libraries.some(x=>x.id===first))return first;const base=ns(first+'.imported.'+Date.now());let candidate=base,n=2;while(catalog.libraries.some(x=>x.id===candidate))candidate=ns(base+'.'+n++);return candidate}
  function create(){const name=prompt('Tên catalog mới','Thư viện người dùng');if(name===null)return;const namespace=prompt('Namespace ổn định','user.local.2');if(namespace===null)return;const id=ns(namespace);if(catalog.libraries.some(x=>x.id===id)){alert('Namespace đã tồn tại.');return}syncCurrent();const lib=makeLib(name,id,'1.0.0');catalog.libraries.push(lib);activate(id,true);status(`Đã tạo catalog ${lib.name} [${lib.namespace}].`)}
  function remove(){if(catalog.libraries.length<=1){status('Phải giữ lại ít nhất một catalog.');return}const l=current();if(!l||!confirm(`Xóa catalog “${l.name}” và ${(l.templates||[]).length} mẫu?`))return;catalog.libraries=catalog.libraries.filter(x=>x.id!==l.id);catalog.activeLibraryId=catalog.libraries[0].id;activate(catalog.activeLibraryId,true);status('Đã xóa catalog '+l.name)}
  function exportCatalog(){syncCurrent();downloadTextFile('DWG_Sketch_Symbol_Catalog.symbol-catalog.json',JSON.stringify({...catalog,appVersion:VERSION,exportedAt:new Date().toISOString()},null,2),'application/json;charset=utf-8')}
  async function importCatalog(file){if(!file)return;try{const p=JSON.parse(await file.text());let libs=[];if(Array.isArray(p.libraries))libs=p.libraries;else{const list=Array.isArray(p)?p:(p.templates||[]),baseName=file.name.replace(/\.json$/i,''),base=makeLib(p?.name||baseName,p?.namespace||p?.libraryId||ns(baseName),p?.libraryVersion||p?.version||'1.0.0');base.revision=Math.max(1,Number(p?.revision)||1);base.readOnly=!!p?.readOnly;base.sourceKind=p?.sourceKind||'Imported';base.templates=list;libs=[base]}syncCurrent();let n=0;for(const raw of libs){const l=makeLib(raw.name,raw.namespace||raw.id,raw.version);l.revision=Math.max(1,Number(raw.revision)||1);l.readOnly=!!raw.readOnly;l.sourceKind=raw.sourceKind||'Imported';l.templates=(raw.templates||[]).map(t=>sanitizeElectricalTemplate(t)).filter(Boolean);const id=uniqueImportedId(l.id);l.id=l.namespace=id;catalog.libraries.push(l);catalog.activeLibraryId=id;n++}normalize();activate(catalog.activeLibraryId,true);status(`Đã nhập ${n} catalog/thư viện.`)}catch(err){alert('Không nhập được catalog: '+err.message)}finally{if($('electricalCatalogImportInput'))$('electricalCatalogImportInput').value=''}}
  function init(){load();$('electricalCatalogSelect')?.addEventListener('change',e=>{syncCurrent();activate(e.target.value,true)});$('newElectricalCatalogBtn')?.addEventListener('click',create);$('deleteElectricalCatalogBtn')?.addEventListener('click',remove);$('exportElectricalCatalogBtn')?.addEventListener('click',exportCatalog);$('importElectricalCatalogBtn')?.addEventListener('click',()=>$('electricalCatalogImportInput')?.click());$('electricalCatalogImportInput')?.addEventListener('change',e=>importCatalog(e.target.files?.[0]));}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
  window.DwgSketchSymbolCatalogV0226={version:VERSION,snapshot:()=>({activeLibraryId:catalog.activeLibraryId,namespace:current()?.namespace||'',version:current()?.version||'1.0.0',revision:Math.max(1,Number(current()?.revision)||1),readOnly:!!current()?.readOnly,libraryCount:catalog.libraries.length,templateCount:(current()?.templates||[]).length}),isReadOnly:()=>!!current()?.readOnly,activate,activeLibrary:()=>clone(current()),libraryById:id=>clone(catalog.libraries.find(x=>x.id===id||x.namespace===id)||null),findTemplate:(libraryId,templateId)=>{const l=catalog.libraries.find(x=>x.id===libraryId||x.namespace===libraryId);return clone(l?.templates?.find(t=>String(t.id||'').toUpperCase()===String(templateId||'').toUpperCase())||null)},findTemplateAny:templateId=>{for(const l of catalog.libraries){const t=l.templates?.find(q=>String(q.id||'').toUpperCase()===String(templateId||'').toUpperCase());if(t)return{library:clone(l),template:clone(t)}}return null}};
})();
;
/* ===== END CONSOLIDATED SOURCE: symbol-library-catalog-v0226.js ===== */

/* ===== BEGIN CONSOLIDATED SOURCE: symbol-instance-link-v0226.js ===== */
'use strict';
(()=>{
  const VERSION='0.22.6';
  const api=()=>window.DwgSketchSymbolCatalogV0226;
  const isSymbol=e=>String(e?.type||'').toUpperCase()==='SYMBOL';
  function stamp(e,template){if(!e||!template)return e;const lib=api()?.activeLibrary?.();if(!lib)return e;e.symbolInstanceId=e.symbolInstanceId||e.automationId||('sym-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,8));e.symbolLibraryId=lib.id||'';e.symbolLibraryNamespace=lib.namespace||lib.id||'';e.symbolLibraryVersion=lib.version||'1.0.0';e.symbolLibraryRevision=Math.max(1,Number(lib.revision)||1);e.symbolTemplateId=template.id||e.symbolType||'';e.symbolTemplateVersion=template.version||'1.0.0';e.symbolTemplateRevision=Math.max(1,Number(template.revision)||1);return e}
  function resolve(e){if(!e?.symbolTemplateId)return null;const libId=e.symbolLibraryId||e.symbolLibraryNamespace;const t=api()?.findTemplate?.(libId,e.symbolTemplateId);const l=api()?.libraryById?.(libId);return t&&l?{library:l,template:t}:null}
  function current(e,r=resolve(e)){return!!r&&String(e.symbolLibraryVersion||'')===String(r.library.version||'')&&String(e.symbolTemplateVersion||'')===String(r.template.version||'')&&Number(e.symbolTemplateRevision||0)>=Number(r.template.revision||1)}
  function adopt(e){if(!isSymbol(e)||e.symbolTemplateId||!e.symbolTemplateSnapshot)return false;const hit=api()?.findTemplateAny?.(e.symbolType);if(!hit)return false;const snap=sanitizeElectricalTemplate(e.symbolTemplateSnapshot,e.symbolType);if(!snap)return false;e.symbolInstanceId=e.automationId||e.symbolInstanceId||('sym-'+Math.random().toString(36).slice(2,10));e.symbolLibraryId=hit.library.id;e.symbolLibraryNamespace=hit.library.namespace;e.symbolLibraryVersion=hit.library.version||'1.0.0';e.symbolLibraryRevision=Math.max(1,Number(hit.library.revision)||1);e.symbolTemplateId=hit.template.id;e.symbolTemplateVersion=snap.version||hit.template.version||'1.0.0';e.symbolTemplateRevision=Math.max(1,Number(snap.revision)||1);return true}
  function adoptAll(){let n=0;for(const e of overlays||[])if(adopt(e))n++;refresh();return n}
  function selectedSymbols(){return(selected||[]).filter(r=>r.kind==='overlay'&&isSymbol(r.item)).map(r=>r.item)}
  function refresh(){const all=(overlays||[]).filter(isSymbol).filter(e=>e.symbolTemplateId),updates=all.filter(e=>{const r=resolve(e);return r&&!current(e,r)}).length,missing=all.filter(e=>!resolve(e)).length;const el=$('symbolInstanceLinkStatus');if(el)el.textContent=`Linked instances: ${all.length} · có cập nhật: ${updates} · thiếu nguồn: ${missing}.`}
  function check(){const list=selectedSymbols();if(!list.length){status('SYMCHECK: hãy chọn một ký hiệu người dùng đã liên kết.');refresh();return}let up=0,ok=0,miss=0;for(const e of list){const r=resolve(e);if(!r)miss++;else if(current(e,r))ok++;else up++}status(`SYMCHECK: ${list.length} instance · mới nhất ${ok} · có cập nhật ${up} · thiếu nguồn ${miss}.`);refresh()}
  function update(){const list=selectedSymbols();if(!list.length){status('SYMUPDATE: hãy chọn ký hiệu cần cập nhật.');return}const candidates=list.map(e=>({e,r:resolve(e)})).filter(x=>x.r&&!current(x.e,x.r));if(!candidates.length){status('SYMUPDATE: các instance đã mới nhất hoặc không còn nguồn.');return}if(!confirm(`Cập nhật ${candidates.length} instance? Vị trí, góc, tỷ lệ, nhãn và màu đối tượng được giữ nguyên.`))return;simpleAction(`Đã cập nhật ${candidates.length} symbol instance`,()=>{for(const {e,r} of candidates){const keep={position:clone(e.position),symbolScale:e.symbolScale,rotationDeg:e.rotationDeg,label:e.label,color:e.color,stroke:e.stroke,automationId:e.automationId,symbolInstanceId:e.symbolInstanceId};e.symbolTemplateSnapshot=clone(r.template);stamp(e,r.template);e.symbolLibraryId=r.library.id;e.symbolLibraryNamespace=r.library.namespace;e.symbolLibraryVersion=r.library.version;e.symbolLibraryRevision=Math.max(1,Number(r.library.revision)||1);Object.assign(e,keep);ensureProjectElectricalTemplate?.(e.symbolType)}});syncElectricalAutomationFromSymbols?.();refresh();status(`SYMUPDATE: đã cập nhật ${candidates.length} instance và giữ nguyên transform/nhãn.`)}
  const oldLoad=typeof loadProjectObject==='function'?loadProjectObject:null;if(oldLoad){loadProjectObject=function(...args){const r=oldLoad(...args);queueMicrotask(()=>{adoptAll();refresh()});return r}}
  const originalCommand=typeof command==='function'?command:null;if(originalCommand){const wrapped=function(cmd){const key=String(cmd||'').trim().toUpperCase();if(key==='SYMCHECK'||key==='SYMLINKCHECK'){check();if($('commandInput'))$('commandInput').value='';return}if(key==='SYMUPDATE'||key==='SYMUP'){update();if($('commandInput'))$('commandInput').value='';return}return originalCommand(cmd)};try{command=wrapped}catch{window.command=wrapped}}
  function init(){adoptAll();refresh();$('checkSymbolInstanceBtn')?.addEventListener('click',check);$('updateSymbolInstanceBtn')?.addEventListener('click',update)}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
  const checkSelected=check,updateSelected=update;
  window.DwgSketchSymbolInstanceLinkV0226={version:VERSION,stamp,check,update,checkSelected,updateSelected,refresh,adoptAll,snapshot:()=>{const all=(overlays||[]).filter(isSymbol).filter(e=>e.symbolTemplateId);return{linked:all.length,updates:all.filter(e=>resolve(e)&&!current(e)).length,missing:all.filter(e=>!resolve(e)).length}}};
})();
;
/* ===== END CONSOLIDATED SOURCE: symbol-instance-link-v0226.js ===== */

