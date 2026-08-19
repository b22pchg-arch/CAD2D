/* ===== BEGIN CONSOLIDATED SOURCE: network-diagram-core-v0210.js ===== */
'use strict';
(() => {
  const SCHEMA='dwg-sketch-network-workspace', SCHEMA_VERSION=2;
  const id=(prefix='id')=>`${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,9)}`;
  const normType=v=>String(v||'UNKNOWN').trim().toUpperCase()||'UNKNOWN';
  const point=v=>({x:Number(v?.x??v?.X??0)||0,y:Number(v?.y??v?.Y??0)||0});
  const deep=v=>JSON.parse(JSON.stringify(v));
  const builtInContracts=()=>['BUSBAR','CIRCUIT_BREAKER','DISCONNECTOR','EARTH_SWITCH','TRANSFORMER_2W','TRANSFORMER_3W','GENERATOR','CAPACITOR','REACTOR','LOAD','CT','VT','GROUND'].map(type=>({id:`builtin:${type.toLowerCase()}`,version:1,family:'ELECTRICAL',deviceType:type,displayName:type,isBuiltIn:true,readOnly:true,requiredAttributes:[],ports:defaultPorts(type)}));
  function defaultPorts(type){
    const two=['CIRCUIT_BREAKER','DISCONNECTOR','CT'];
    if(two.includes(type))return[{name:'IN',kind:'electrical',direction:'bidirectional',required:true,localX:0,localY:1},{name:'OUT',kind:'electrical',direction:'bidirectional',required:true,localX:0,localY:-1}];
    if(type==='TRANSFORMER_2W')return[{name:'HV',kind:'electrical',direction:'bidirectional',required:true,localX:0,localY:1},{name:'LV',kind:'electrical',direction:'bidirectional',required:true,localX:0,localY:-1}];
    if(type==='TRANSFORMER_3W')return[{name:'HV',kind:'electrical',direction:'bidirectional',required:true,localX:0,localY:1},{name:'MV',kind:'electrical',direction:'bidirectional',required:true,localX:-1,localY:-1},{name:'LV',kind:'electrical',direction:'bidirectional',required:true,localX:1,localY:-1}];
    if(type==='BUSBAR')return[{name:'P',kind:'electrical',direction:'bidirectional',required:false,localX:0,localY:0}];
    return[{name:type==='GROUND'?'IN':'P',kind:'electrical',direction:'bidirectional',required:type!=='BUSBAR',localX:0,localY:1}];
  }
  function emptyWorkspace(name='Mô hình mạng'){
    const diagram={id:id('diagram'),name:'Sơ đồ chính',kind:'single-line',placements:[],routes:[],attributes:{}};
    return{schema:SCHEMA,schemaVersion:SCHEMA_VERSION,name,updatedAt:new Date().toISOString(),learningCatalog:{schema:'dwg-sketch-network-learning-catalog',schemaVersion:1,updatedAt:new Date().toISOString(),symbols:[],topologies:[],audit:[]},network:{id:'network-main',name:'Mạng điện',devices:[],connections:[],attributes:{}},diagrams:[diagram],activeDiagramId:diagram.id,symbolContracts:builtInContracts()};
  }
  function normalize(w){
    if(!w||typeof w!=='object')w=emptyWorkspace();
    w.schema=SCHEMA;w.schemaVersion=SCHEMA_VERSION;w.name=String(w.name||'Mô hình mạng');w.learningCatalog=w.learningCatalog&&typeof w.learningCatalog==='object'?w.learningCatalog:{schema:'dwg-sketch-network-learning-catalog',schemaVersion:1,updatedAt:new Date().toISOString(),symbols:[],topologies:[],audit:[]};w.learningCatalog.schema='dwg-sketch-network-learning-catalog';w.learningCatalog.schemaVersion=1;w.learningCatalog.symbols=Array.isArray(w.learningCatalog.symbols)?w.learningCatalog.symbols:[];w.learningCatalog.topologies=Array.isArray(w.learningCatalog.topologies)?w.learningCatalog.topologies:[];w.learningCatalog.audit=Array.isArray(w.learningCatalog.audit)?w.learningCatalog.audit:[];
    w.network=w.network&&typeof w.network==='object'?w.network:{id:'network-main',name:'Mạng điện',devices:[],connections:[],attributes:{}};
    w.network.devices=Array.isArray(w.network.devices)?w.network.devices:[];w.network.connections=Array.isArray(w.network.connections)?w.network.connections:[];w.network.attributes=w.network.attributes||{};
    w.network.devices.forEach(d=>{d.id=String(d.id||id('device'));d.type=normType(d.type);d.family=String(d.family||'ELECTRICAL');d.label=String(d.label||d.id);d.attributes=d.attributes||{};d.ports=Array.isArray(d.ports)?d.ports:defaultPorts(d.type)});
    w.network.connections.forEach(c=>{c.id=String(c.id||id('connection'));c.fromDeviceId=String(c.fromDeviceId||'');c.toDeviceId=String(c.toDeviceId||'');c.fromPort=String(c.fromPort||'');c.toPort=String(c.toPort||'');c.status=String(c.status||'in-service');c.label=String(c.label||'');c.attributes=c.attributes||{}});
    w.diagrams=Array.isArray(w.diagrams)?w.diagrams:[];if(!w.diagrams.length)w.diagrams=emptyWorkspace(w.name).diagrams;
    w.diagrams.forEach(d=>{d.id=String(d.id||id('diagram'));d.name=String(d.name||'Sơ đồ');d.kind=String(d.kind||'single-line');d.placements=Array.isArray(d.placements)?d.placements:[];d.routes=Array.isArray(d.routes)?d.routes:[];d.attributes=d.attributes||{};d.placements.forEach(p=>{p.deviceId=String(p.deviceId||'');p.x=Number(p.x)||0;p.y=Number(p.y)||0;p.rotationDeg=Number(p.rotationDeg)||0;p.scale=Math.max(.0001,Number(p.scale)||1);p.symbolContractId=String(p.symbolContractId||'')});d.routes.forEach(r=>{r.connectionId=String(r.connectionId||'');r.routingMode=String(r.routingMode||'orthogonal');r.locked=!!r.locked;r.points=(Array.isArray(r.points)?r.points:[]).map(point)})});
    if(!w.diagrams.some(d=>d.id===w.activeDiagramId))w.activeDiagramId=w.diagrams[0].id;
    w.symbolContracts=Array.isArray(w.symbolContracts)&&w.symbolContracts.length?w.symbolContracts:builtInContracts();w.updatedAt=new Date().toISOString();return w;
  }
  const active=w=>normalize(w).diagrams.find(d=>d.id===w.activeDiagramId)||w.diagrams[0];
  function symbolId(e){return String(e?.automationId||e?.automationGroupId||e?.id||'').replace(/^auto:/i,'')}
  function symbolPosition(e){return point(e?.position||e?.center||e?.a||{x:0,y:0})}
  function buildFromCurrent(){
    const auto=(typeof project!=='undefined'&&project?.electricalAutomation)||{nodes:[],connections:[]};
    const ws=emptyWorkspace(project?.sourceFile||'Mô hình mạng');const d=active(ws);const seen=new Set();
    const symbolOverlays=(typeof overlays!=='undefined'?overlays:[]).filter(e=>String(e?.type||'').toUpperCase()==='SYMBOL'||e?.automationId||e?.automationGroupId);
    const nodes=Array.isArray(auto.nodes)?auto.nodes:[];
    for(const n of nodes){const did=String(n.id||n.automationId||id('device')).replace(/^auto:/i,'');if(seen.has(did))continue;seen.add(did);const type=normType(n.type||n.symbolType);const ov=symbolOverlays.find(e=>symbolId(e)===did);const pos=ov?symbolPosition(ov):point(n.position||n);ws.network.devices.push({id:did,type,family:'ELECTRICAL',label:String(n.label||did),attributes:{legacyAutomationId:String(n.id||did)},ports:defaultPorts(type)});d.placements.push({deviceId:did,x:pos.x,y:pos.y,rotationDeg:Number(ov?.rotationDeg??n.rotationDeg??0)||0,scale:Number(ov?.symbolScale??n.scale??1)||1,symbolContractId:`builtin:${type.toLowerCase()}`,labelOffsetX:0,labelOffsetY:0})}
    for(const ov of symbolOverlays){const did=symbolId(ov);if(!did||seen.has(did))continue;seen.add(did);const type=normType(ov.symbolType||ov.automationSymbolType);const pos=symbolPosition(ov);ws.network.devices.push({id:did,type,family:'ELECTRICAL',label:String(ov.label||ov.automationLabel||did),attributes:{legacyAutomationId:String(ov.automationId||ov.automationGroupId||did)},ports:defaultPorts(type)});d.placements.push({deviceId:did,x:pos.x,y:pos.y,rotationDeg:Number(ov.rotationDeg)||0,scale:Number(ov.symbolScale)||1,symbolContractId:`builtin:${type.toLowerCase()}`,labelOffsetX:0,labelOffsetY:0})}
    const conns=Array.isArray(auto.connections)?auto.connections:[];
    for(const c of conns){const cid=String(c.id||id('connection')),from=String(c.fromNodeId||c.fromDeviceId||'').replace(/^auto:/i,''),to=String(c.toNodeId||c.toDeviceId||'').replace(/^auto:/i,'');if(!from||!to)continue;ws.network.connections.push({id:cid,fromDeviceId:from,fromPort:String(c.fromPort||''),toDeviceId:to,toPort:String(c.toPort||''),status:String(c.status||'in-service'),label:String(c.label||''),attributes:{legacyConnectionId:cid}});const wire=(typeof overlays!=='undefined'?overlays:[]).find(e=>String(e?.automationConnectionId||'')===cid);let pts=Array.isArray(wire?.points)?wire.points.map(point):[];if(pts.length<2){const a=d.placements.find(p=>p.deviceId===from),b=d.placements.find(p=>p.deviceId===to);if(a&&b){const mx=(a.x+b.x)/2;pts=[{x:a.x,y:a.y},{x:mx,y:a.y},{x:mx,y:b.y},{x:b.x,y:b.y}]}}d.routes.push({connectionId:cid,routingMode:'orthogonal',locked:false,points:pts})}
    project.networkWorkspace=normalize(ws);project.version=Math.max(Number(project.version)||0,10);setDirty?.(true);renderUi();status?.('Đã tách LogicalModel và PlacementModel từ sơ đồ hiện tại.');return project.networkWorkspace;
  }
  function syncFromDrawing(){const ws=ensure(),d=active(ws),by=new Map(d.placements.map(p=>[p.deviceId,p]));for(const e of (typeof overlays!=='undefined'?overlays:[])){const did=symbolId(e);if(!did||!by.has(did))continue;const p=by.get(did),v=symbolPosition(e);p.x=v.x;p.y=v.y;p.rotationDeg=Number(e.rotationDeg)||0;p.scale=Number(e.symbolScale)||1}for(const r of d.routes){const w=(typeof overlays!=='undefined'?overlays:[]).find(e=>String(e?.automationConnectionId||'')===r.connectionId&&Array.isArray(e.points));if(w)r.points=w.points.map(point)}ws.updatedAt=new Date().toISOString();setDirty?.(true);renderUi();status?.('Đã đồng bộ view từ hình vẽ.');return ws}
  function applyActive(){const ws=ensure(),d=active(ws),by=new Map(d.placements.map(p=>[p.deviceId,p]));let moved=0,routed=0;simpleAction?.('Áp dụng view mô hình mạng',()=>{for(const e of (typeof overlays!=='undefined'?overlays:[])){const did=symbolId(e),p=by.get(did);if(!p)continue;if(e.position){e.position={x:p.x,y:p.y};e.rotationDeg=p.rotationDeg;e.symbolScale=p.scale;moved++}else if(e.center){e.center={x:p.x,y:p.y};moved++}}for(const r of d.routes){const w=(typeof overlays!=='undefined'?overlays:[]).find(e=>String(e?.automationConnectionId||'')===r.connectionId&&Array.isArray(e.points));if(w&&r.points.length>1){w.points=r.points.map(point);routed++}}});draw?.();status?.(`Đã áp dụng view: ${moved} thiết bị, ${routed} tuyến.`)}
  function validate(w=ensure()){const issues=[],ids=new Set(),did=new Set();for(const d of w.network.devices){if(ids.has(d.id))issues.push({severity:'error',code:'DUPLICATE_DEVICE',objectId:d.id,message:'Trùng ID thiết bị'});ids.add(d.id);did.add(d.id);if(d.type==='UNKNOWN')issues.push({severity:'warning',code:'UNKNOWN_TYPE',objectId:d.id,message:'Thiết bị chưa có loại chuẩn'})}const cids=new Set();for(const c of w.network.connections){if(cids.has(c.id))issues.push({severity:'error',code:'DUPLICATE_CONNECTION',objectId:c.id,message:'Trùng ID liên kết'});cids.add(c.id);if(!did.has(c.fromDeviceId))issues.push({severity:'error',code:'MISSING_FROM',objectId:c.id,message:'Thiếu thiết bị đầu'});if(!did.has(c.toDeviceId))issues.push({severity:'error',code:'MISSING_TO',objectId:c.id,message:'Thiếu thiết bị cuối'});if(c.fromDeviceId===c.toDeviceId)issues.push({severity:'error',code:'SELF_CONNECTION',objectId:c.id,message:'Tự nối vào chính thiết bị'})}for(const dg of w.diagrams){for(const p of dg.placements)if(!did.has(p.deviceId))issues.push({severity:'error',code:'ORPHAN_PLACEMENT',objectId:p.deviceId,message:`Placement mồ côi trong ${dg.name}`});for(const r of dg.routes)if(!cids.has(r.connectionId))issues.push({severity:'error',code:'ORPHAN_ROUTE',objectId:r.connectionId,message:`Route mồ côi trong ${dg.name}`})}return{issues,errorCount:issues.filter(x=>x.severity==='error').length,warningCount:issues.filter(x=>x.severity==='warning').length,isValid:!issues.some(x=>x.severity==='error')}}
  function ensure(){if(typeof project==='undefined'||!project)return emptyWorkspace();project.networkWorkspace=normalize(project.networkWorkspace);project.version=Math.max(Number(project.version)||0,10);return project.networkWorkspace}
  function cloneDiagram(){const w=ensure(),src=active(w),copy=deep(src);copy.id=id('diagram');copy.name=`${src.name} - View ${w.diagrams.length+1}`;w.diagrams.push(copy);w.activeDiagramId=copy.id;setDirty?.(true);renderUi();status?.('Đã tạo view mới dùng chung một LogicalModel.')}
  function exportWorkspace(){const w=ensure();downloadTextFile?.(`${(project?.sourceFile||'drawing').replace(/\.[^.]+$/,'')}.network.json`,JSON.stringify(w,null,2),'application/json;charset=utf-8')}
  function importWorkspace(file){const r=new FileReader();r.onload=()=>{try{const w=normalize(JSON.parse(String(r.result||'')));if(w.schema!==SCHEMA)throw new Error('Không phải Network Workspace');project.networkWorkspace=w;project.version=Math.max(Number(project.version)||0,10);setDirty?.(true);renderUi();status?.('Đã nhập mô hình mạng độc lập.')}catch(e){alert('Không nhập được mô hình mạng: '+e.message)}};r.readAsText(file)}
  function renderUi(){const w=ensure(),sel=document.getElementById('networkDiagramSelectV0210'),text=document.getElementById('networkStatusV0210');if(sel){sel.innerHTML='';for(const d of w.diagrams){const o=document.createElement('option');o.value=d.id;o.textContent=d.name;sel.appendChild(o)}sel.value=w.activeDiagramId}if(text){const v=validate(w);text.textContent=`${w.network.devices.length} thiết bị · ${w.network.connections.length} liên kết · ${w.diagrams.length} view · ${v.errorCount} lỗi/${v.warningCount} cảnh báo`}}
  function installUi(){if(document.getElementById('networkWorkspacePanelV0210')){renderUi();return}const sections=[...document.querySelectorAll('aside.panel.right .section')],before=sections.find(x=>x.querySelector('h3')?.textContent.includes('Tự động tạo sơ đồ lưới'));if(!before)return;const box=document.createElement('div');box.id='networkWorkspacePanelV0210';box.className='section';box.dataset.mobileGroup='create';box.innerHTML=`<h3>Mô hình mạng và nhiều view — V0.17</h3><div class="muted">LogicalModel lưu thiết bị/cổng/liên kết; PlacementModel chỉ lưu vị trí và tuyến của từng view.</div><label class="full" style="display:block;margin-top:7px">View đang hoạt động<select id="networkDiagramSelectV0210"></select></label><div id="networkStatusV0210" class="muted" style="margin-top:6px"></div><div class="button-row" style="margin-top:7px"><button id="networkBuildV0210" class="primary">Tạo từ sơ đồ</button><button id="networkSyncV0210">Đồng bộ view</button><button id="networkCloneV0210">Nhân bản view</button><button id="networkApplyV0210">Áp dụng view</button><button id="networkValidateV0210">Kiểm tra</button><button id="networkImportV0210">Nhập</button><button id="networkExportV0210">Xuất</button></div><input id="networkImportInputV0210" type="file" accept=".json,.network.json,application/json" class="hidden"><div class="muted" style="margin-top:6px">Dự án JSON phiên bản 9 giữ mô hình mạng cùng bản vẽ; bản cũ được nâng cấp tự động.</div>`;before.parentNode.insertBefore(box,before);document.getElementById('networkBuildV0210').onclick=buildFromCurrent;document.getElementById('networkSyncV0210').onclick=syncFromDrawing;document.getElementById('networkCloneV0210').onclick=cloneDiagram;document.getElementById('networkApplyV0210').onclick=applyActive;document.getElementById('networkExportV0210').onclick=exportWorkspace;document.getElementById('networkImportV0210').onclick=()=>document.getElementById('networkImportInputV0210').click();document.getElementById('networkImportInputV0210').onchange=e=>{const f=e.target.files?.[0];if(f)importWorkspace(f);e.target.value=''};document.getElementById('networkValidateV0210').onclick=()=>{const v=validate();alert(v.issues.length?v.issues.slice(0,60).map(x=>`[${x.severity.toUpperCase()}] ${x.code} · ${x.objectId}: ${x.message}`).join('\n'):'Mô hình mạng hợp lệ.')};document.getElementById('networkDiagramSelectV0210').onchange=e=>{const w=ensure();w.activeDiagramId=e.target.value;setDirty?.(true);renderUi()};renderUi()}
  const api={version:'0.21.4',schema:SCHEMA,emptyWorkspace,normalize,ensure,active,buildFromCurrent,syncFromDrawing,applyActive,cloneDiagram,validate,exportWorkspace};
  window.DwgSketchNetworkDiagramCoreV0210=api;
  // Đồng bộ networkWorkspace trước mọi lần lưu dự án.
  if(typeof syncProject==='function'){const original=syncProject;syncProject=function(){ensure();return original.apply(this,arguments)}}
  if(typeof loadProjectObject==='function'){const originalLoad=loadProjectObject;loadProjectObject=function(){const result=originalLoad.apply(this,arguments);ensure();queueMicrotask(renderUi);return result}}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',installUi,{once:true});else installUi();
  setTimeout(()=>{try{ensure();renderUi()}catch{}},1500);
})();
;
/* ===== END CONSOLIDATED SOURCE: network-diagram-core-v0210.js ===== */

/* ===== BEGIN CONSOLIDATED SOURCE: network-learning-core-v0214.js ===== */
'use strict';
(() => {
  const API_VERSION='0.21.4', PROJECT_VERSION=9;
  const CATALOG_SCHEMA='dwg-sketch-network-learning-catalog';
  const now=()=>new Date().toISOString();
  const deep=v=>JSON.parse(JSON.stringify(v));
  const uid=(p='id')=>`${p}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,9)}`;
  const normType=v=>String(v||'UNKNOWN').trim().toUpperCase()||'UNKNOWN';
  const n=v=>Number(v)||0;
  const pt=v=>({x:n(v?.x??v?.X),y:n(v?.y??v?.Y)});
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

  function emptyCatalog(){return{schema:CATALOG_SCHEMA,schemaVersion:1,updatedAt:now(),symbols:[],topologies:[],audit:[]}}
  function catalog(){
    const core=window.DwgSketchNetworkDiagramCoreV0210;
    const ws=core?.ensure?.()||(project.networkWorkspace??={});
    ws.learningCatalog=ws.learningCatalog&&typeof ws.learningCatalog==='object'?ws.learningCatalog:emptyCatalog();
    const c=ws.learningCatalog;c.schema=CATALOG_SCHEMA;c.schemaVersion=1;c.symbols=Array.isArray(c.symbols)?c.symbols:[];c.topologies=Array.isArray(c.topologies)?c.topologies:[];c.audit=Array.isArray(c.audit)?c.audit:[];c.updatedAt=now();project.version=PROJECT_VERSION;return c;
  }
  function audit(action,id,count=0,message=''){const c=catalog();c.audit.push({at:now(),action,templateId:id||'',source:project?.sourceFile||'',count,message});if(c.audit.length>300)c.audit=c.audit.slice(-300)}
  function boundsOfRefs(refs){let b={minX:Infinity,minY:Infinity,maxX:-Infinity,maxY:-Infinity};for(const r of refs){try{itemBounds(r.item,b)}catch{}}return Number.isFinite(b.minX)?b:null}
  function localPoint(p,c){p=pt(p);return{x:p.x-c.x,y:p.y-c.y}}
  function primitive(ref,center){
    const e=ref?.item||{}, t=String(e.type||'').toUpperCase(), base={type:t,color:Number(e.color??e.trueColorArgb??0xffffffff)>>>0,stroke:Number(e.stroke)||1.5,layer:String(e.layer||'DWG_SKETCH'),automationRole:String(e.automationRole||''),automationPortName:String(e.automationPortName||'')};
    if(t==='LINE')return{...base,a:localPoint(e.a,center),b:localPoint(e.b,center),center:{x:0,y:0},points:[],closed:false,radius:0,radiusY:0,startDeg:0,endDeg:0,text:'',textSlot:'',height:2.5,rotationDeg:0,widthFactor:1,obliqueDeg:0,fontName:'Segoe UI'};
    if(['POLYLINE','TRIANGLE','FILL'].includes(t))return{...base,type:t==='TRIANGLE'?'POLYLINE':t,a:{x:0,y:0},b:{x:0,y:0},center:{x:0,y:0},points:(e.points||[]).map(p=>localPoint(p,center)),closed:e.closed!==false,radius:0,radiusY:0,startDeg:0,endDeg:0,text:'',textSlot:'',height:2.5,rotationDeg:0,widthFactor:1,obliqueDeg:0,fontName:'Segoe UI'};
    if(['RECTANGLE','SQUARE'].includes(t))return{...base,type:'RECTANGLE',a:localPoint(e.a,center),b:localPoint(e.b,center),center:{x:0,y:0},points:[],closed:true,radius:0,radiusY:0,startDeg:0,endDeg:0,text:'',textSlot:'',height:2.5,rotationDeg:0,widthFactor:1,obliqueDeg:0,fontName:'Segoe UI'};
    if(t==='CIRCLE')return{...base,a:{x:0,y:0},b:{x:0,y:0},center:localPoint(e.center,center),points:[],closed:true,radius:Math.abs(n(e.radius)),radiusY:0,startDeg:0,endDeg:0,text:'',textSlot:'',height:2.5,rotationDeg:0,widthFactor:1,obliqueDeg:0,fontName:'Segoe UI'};
    if(t==='ELLIPSE')return{...base,a:{x:0,y:0},b:{x:0,y:0},center:localPoint(e.center,center),points:[],closed:true,radius:Math.abs(n(e.radius??e.radiusX)),radiusY:Math.abs(n(e.radiusY)),startDeg:0,endDeg:0,text:'',textSlot:'',height:2.5,rotationDeg:0,widthFactor:1,obliqueDeg:0,fontName:'Segoe UI'};
    if(t==='ARC')return{...base,a:{x:0,y:0},b:{x:0,y:0},center:localPoint(e.center,center),points:[],closed:false,radius:Math.abs(n(e.radius)),radiusY:0,startDeg:n(e.startDeg),endDeg:n(e.endDeg),text:'',textSlot:'',height:2.5,rotationDeg:0,widthFactor:1,obliqueDeg:0,fontName:'Segoe UI'};
    if(['TEXT','MTEXT'].includes(t))return{...base,type:'TEXT',a:{x:0,y:0},b:{x:0,y:0},center:localPoint(e.position||e.center,center),points:[],closed:false,radius:0,radiusY:0,startDeg:0,endDeg:0,text:String(e.text||''),textSlot:/^[A-ZĐ][A-ZĐ0-9_.\-/ ]{0,20}$/i.test(String(e.text||'').trim())?'LABEL':'',height:Math.max(.01,n(e.height||e.textHeight)||2.5),rotationDeg:n(e.rotationDeg),widthFactor:n(e.widthFactor)||1,obliqueDeg:n(e.obliqueDeg),fontName:String(e.fontName||'Segoe UI')};
    return null;
  }
  function geometryHash(g){return g.map(x=>`${x.type}:${Math.round(n(x.a?.x)*1000)}:${Math.round(n(x.a?.y)*1000)}:${Math.round(n(x.b?.x)*1000)}:${Math.round(n(x.b?.y)*1000)}:${Math.round(n(x.center?.x)*1000)}:${Math.round(n(x.center?.y)*1000)}:${Math.round(n(x.radius)*1000)}:${x.points?.length||0}:${x.textSlot||''}`).sort().join('|')}
  function inferPorts(g,w,h){const pts=[];for(const x of g){if(String(x.automationRole).toUpperCase()==='PORT'){pts.push(x.center);continue}if(x.type==='LINE')pts.push(x.a,x.b);else if(x.type==='POLYLINE'&&x.points.length)pts.push(x.points[0],x.points[x.points.length-1])}if(!pts.length)return[];const hw=w/2,hh=h/2,margin=Math.max(1e-6,Math.max(w,h)*.14),cands=pts.filter(p=>Math.abs(Math.abs(p.x)-hw)<=margin||Math.abs(Math.abs(p.y)-hh)<=margin);const source=cands.length?cands:pts, tol=Math.max(1e-6,Math.max(w,h)*.05), clusters=[];for(const p of source){let c=clusters.find(q=>Math.hypot(q.x-p.x,q.y-p.y)<=tol);if(!c)clusters.push(c={x:p.x,y:p.y,count:1});else{c.x=(c.x*c.count+p.x)/(c.count+1);c.y=(c.y*c.count+p.y)/(c.count+1);c.count++}}const used=new Set();return clusters.slice(0,8).map((p,i)=>{const d=[['TOP',Math.abs(p.y-hh)],['BOTTOM',Math.abs(p.y+hh)],['LEFT',Math.abs(p.x+hw)],['RIGHT',Math.abs(p.x-hw)]].sort((a,b)=>a[1]-b[1]);let name=d[0][0],k=2;while(used.has(name))name=d[0][0]+k++;used.add(name);return{name,kind:'electrical',direction:'bidirectional',required:true,localX:p.x,localY:p.y}})}
  function addSymbol(t){const c=catalog(),hash=t.attributes.geometryHash,old=c.symbols.find(x=>x.attributes?.geometryHash===hash);if(old){old.observationCount=(old.observationCount||1)+1;old.confidenceScore=Math.min(.99,Math.max(old.confidenceScore||.6,.65)+.03);old.updatedAt=now();return old}c.symbols.push(t);return t}
  function learnSymbol(){
    if(!Array.isArray(selected)||!selected.length){alert('Hãy chọn toàn bộ đường, hình và chữ của một ký hiệu trước khi học.');return}
    const b=boundsOfRefs(selected);if(!b){alert('Không xác định được phạm vi ký hiệu.');return}
    const name=prompt('Tên mẫu ký hiệu:',`Ký hiệu đã học ${catalog().symbols.length+1}`)?.trim();if(!name)return;const deviceType=normType(prompt('Loại thiết bị chuẩn:',selected.map(r=>r.item?.symbolType||r.item?.automationSymbolType).find(Boolean)||'UNKNOWN'));
    const center={x:(b.minX+b.maxX)/2,y:(b.minY+b.maxY)/2},geometry=selected.map(r=>primitive(r,center)).filter(Boolean);if(!geometry.length){alert('Vùng chọn chưa có loại hình học được hỗ trợ.');return}
    const width=Math.max(1e-6,b.maxX-b.minX),height=Math.max(1e-6,b.maxY-b.minY),hash=geometryHash(geometry),t={id:uid('symbol'),name,deviceType,family:'ELECTRICAL',version:1,createdAt:now(),updatedAt:now(),sourceMethod:'SYMLEARN_SELECTION',sourceFile:project?.sourceFile||'',confidenceScore:.68,observationCount:1,width,height,basePoint:{x:0,y:0},geometry,ports:inferPorts(geometry,width,height),attributes:{geometryHash:hash}};
    const saved=addSymbol(t);audit('symbol-learn',saved.id,geometry.length,`${name}: ${saved.ports.length} ports`);setDirty?.(true);render();status?.(`Đã học ký hiệu “${name}”: ${geometry.length} primitive, ${saved.ports.length} cổng.`)
  }
  function toNetworkTopology(old){
    const m=old?.model;if(!m||!Array.isArray(m.nodes))return null;const devices=m.nodes.map((x,i)=>({id:String(x.id||`device-${i+1}`).replace(/^auto:/i,''),type:normType(x.type||x.symbolType),family:'ELECTRICAL',label:String(x.label||x.id||`Thiết bị ${i+1}`),ports:[],attributes:{legacySourceId:String(x.sourceId||x.id||'')}}));
    const ids=new Set(devices.map(x=>x.id)),connections=(m.connections||[]).map((x,i)=>({id:String(x.id||`connection-${i+1}`),fromDeviceId:String(x.fromNodeId||x.fromDeviceId||'').replace(/^auto:/i,''),fromPort:String(x.fromPort||''),toDeviceId:String(x.toNodeId||x.toDeviceId||'').replace(/^auto:/i,''),toPort:String(x.toPort||''),status:String(x.status||'in-service'),label:String(x.label||''),attributes:{directionMode:String(x.directionMode||'inherit'),angleDeg:Number.isFinite(x.angleDeg)?String(x.angleDeg):''}})).filter(x=>ids.has(x.fromDeviceId)&&ids.has(x.toDeviceId));
    const placements=m.nodes.map((x,i)=>({deviceId:devices[i].id,x:n(x.x??x.position?.x??i*90),y:n(x.y??x.position?.y),rotationDeg:n(x.rotationDeg),scale:Math.max(.0001,n(x.scale)||1),symbolContractId:`builtin:${devices[i].type.toLowerCase()}`,labelOffsetX:0,labelOffsetY:0}));
    const pmap=new Map(placements.map(x=>[x.deviceId,x])),routes=connections.map(x=>{const a=pmap.get(x.fromDeviceId),b=pmap.get(x.toDeviceId),mx=(a.x+b.x)/2;return{connectionId:x.id,routingMode:'orthogonal',locked:false,points:[{x:a.x,y:a.y},{x:mx,y:a.y},{x:mx,y:b.y},{x:b.x,y:b.y}]}});
    const network={id:'network-'+uid('learn'),name:String(old.name||m.name||'Topology đã học'),devices,connections,attributes:{}},diagram={id:uid('diagram'),name:String(old.name||'Bố trí mẫu'),kind:'single-line',placements,routes,attributes:{}},sig=devices.map(d=>`${d.type}:${connections.filter(c=>c.fromDeviceId===d.id||c.toDeviceId===d.id).length}`).sort().join('|')+'#'+connections.map(c=>{const a=devices.find(d=>d.id===c.fromDeviceId)?.type||'UNKNOWN',b=devices.find(d=>d.id===c.toDeviceId)?.type||'UNKNOWN';return[a,b].sort().join('>')}).sort().join('|');
    return{id:'legacy-'+String(old.id||uid('topology')),name:String(old.name||'Topology đã học'),version:1,createdAt:String(old.createdAt||now()),updatedAt:now(),sourceMethod:String(old.sourceMethod||old.autoLearn?.version||'LEGACY_PWA'),sourceFile:String(old.sourceFile||project?.sourceFile||''),reviewState:String(old.reviewState||'suggested'),confidenceScore:Number(old.confidenceScore)||.65,observationCount:Math.max(1,Number(old.observationCount||old.occurrenceCount)||1),signature:sig,layoutDirection:String(m.layout?.directionMode||m.directionMode||'down'),layoutAngleDeg:n(m.layout?.layoutAngleDeg??-90),symbolOrientation:String(m.layout?.symbolOrientation||'follow'),symbolAngleOffsetDeg:n(m.layout?.symbolAngleOffsetDeg),spacingX:Math.max(1,n(m.layout?.spacingX)||90),spacingY:Math.max(1,n(m.layout?.spacingY)||85),network,diagram,attributes:{legacyTemplateId:String(old.id||'')}}
  }
  function migrateLegacy(silent=false){const c=catalog(),list=Array.isArray(window.learnedElectricalTemplates)?window.learnedElectricalTemplates:(typeof learnedElectricalTemplates!=='undefined'?learnedElectricalTemplates:[]);let added=0,merged=0;for(const old of list||[]){if(old?.kind!=='topology')continue;const t=toNetworkTopology(old);if(!t)continue;const legacyId=String(old.id||''),bySource=legacyId?c.topologies.find(x=>String(x.attributes?.legacyTemplateId||'')===legacyId):null,exact=bySource||c.topologies.find(x=>x.signature===t.signature);if(exact){const nextObs=Math.max(Number(exact.observationCount)||1,Number(t.observationCount)||1),changed=nextObs!==(Number(exact.observationCount)||1)||(Number(t.confidenceScore)||0)>(Number(exact.confidenceScore)||0);if(changed){exact.observationCount=nextObs;exact.confidenceScore=Math.min(.99,Math.max(exact.confidenceScore||.5,t.confidenceScore||.5));exact.updatedAt=now();if(!exact.attributes)exact.attributes={};if(legacyId&&!exact.attributes.legacyTemplateId)exact.attributes.legacyTemplateId=legacyId;merged++}}else{c.topologies.push(t);added++}}if(added||merged){audit('legacy-migrate','',added+merged,`${added} new, ${merged} updated`);setDirty?.(true)}render();if(!silent)status?.(`Đồng bộ lõi học: ${added} topology mới, ${merged} mẫu được cập nhật.`);return{added,merged}}
  function waitMigrate(before,label){let tries=0;const timer=setInterval(()=>{tries++;const list=typeof learnedElectricalTemplates!=='undefined'?learnedElectricalTemplates:[];if(list.length>before||tries>=30){clearInterval(timer);const r=migrateLegacy(true);status?.(`${label}: ${r.added} topology mới, ${r.merged} mẫu được củng cố.`)}},150)}
  function learnTopology(){if(typeof learnSelectedElectricalDiagram!=='function'){alert('Chưa nạp lõi học topology cũ.');return}const before=(typeof learnedElectricalTemplates!=='undefined'?learnedElectricalTemplates.length:0);learnSelectedElectricalDiagram();waitMigrate(before,'TOPLEARN hoàn tất')}
  function learnDrawing(){if(typeof autoLearnDwgScope!=='function'){alert('Chưa nạp lõi tự học DWG.');return}const before=(typeof learnedElectricalTemplates!=='undefined'?learnedElectricalTemplates.length:0);autoLearnDwgScope('drawing');waitMigrate(before,'NETLEARN hoàn tất')}
  function topologyModel(t){return{name:t.name,nodes:(t.network?.devices||[]).map((d,i)=>{const p=(t.diagram?.placements||[]).find(x=>x.deviceId===d.id)||{};return{id:d.id,sourceId:d.id,type:d.type,label:d.label||d.id,x:n(p.x),y:n(p.y),scale:Math.max(.0001,n(p.scale)||1),rotationDeg:n(p.rotationDeg),order:i}}),connections:(t.network?.connections||[]).map(c=>({id:c.id,fromNodeId:c.fromDeviceId,toNodeId:c.toDeviceId,fromPort:c.fromPort||'',toPort:c.toPort||'',label:c.label||'',status:c.status||'in-service',directionMode:c.attributes?.directionMode||'inherit',angleDeg:Number(c.attributes?.angleDeg)})),layout:{orientation:'vertical',directionMode:t.layoutDirection||'down',layoutAngleDeg:n(t.layoutAngleDeg),symbolOrientation:t.symbolOrientation||'follow',symbolAngleOffsetDeg:n(t.symbolAngleOffsetDeg),spacingX:n(t.spacingX)||90,spacingY:n(t.spacingY)||85}}}
  function selectedTopology(){return catalog().topologies.find(x=>x.id===document.getElementById('networkLearnTopologyV0214')?.value)}
  function generate(){const t=selectedTopology();if(!t){alert('Hãy chọn một mẫu topology đã học.');return}if(typeof generateElectricalGridDrawing!=='function'){alert('Chưa nạp bộ sinh sơ đồ.');return}electricalGridImportModel=topologyModel(t);electricalGridSourceName=t.name;electricalGridLayoutResult=null;try{applyElectricalGridLayoutSettings?.(electricalGridImportModel)}catch{}generateElectricalGridDrawing();setTimeout(()=>{try{window.DwgSketchNetworkDiagramCoreV0210?.buildFromCurrent?.();const c=catalog();const same=c.topologies.find(x=>x.id===t.id);if(!same)c.topologies.push(t);setDirty?.(true);render();status?.(`Đã sinh sơ đồ từ topology “${t.name}” và tạo NetworkWorkspace.`)}catch(e){console.error(e)}},50)}
  function selectedSymbol(){return catalog().symbols.find(x=>x.id===document.getElementById('networkLearnSymbolV0214')?.value)}
  function transform(p,scale,deg,origin){const r=deg*Math.PI/180,x=p.x*scale,y=p.y*scale;return{x:origin.x+x*Math.cos(r)-y*Math.sin(r),y:origin.y+x*Math.sin(r)+y*Math.cos(r)}}
  function overlayFromPrimitive(g,origin,scale,rotation,label){const base={color:Number(g.color)>>>0,stroke:Number(g.stroke)||1.5,layer:g.layer||'DWG_SKETCH',autoGeneratedElectrical:true};if(g.type==='LINE')return{type:'LINE',a:transform(g.a,scale,rotation,origin),b:transform(g.b,scale,rotation,origin),...base};if(g.type==='POLYLINE'||g.type==='FILL')return{type:g.type,points:(g.points||[]).map(p=>transform(p,scale,rotation,origin)),closed:g.closed!==false,...base};if(g.type==='RECTANGLE')return{type:'RECTANGLE',a:transform(g.a,scale,rotation,origin),b:transform(g.b,scale,rotation,origin),...base};if(g.type==='CIRCLE')return{type:'CIRCLE',center:transform(g.center,scale,rotation,origin),radius:Math.abs(n(g.radius)*scale),...base};if(g.type==='ELLIPSE')return{type:'ELLIPSE',center:transform(g.center,scale,rotation,origin),radius:Math.abs(n(g.radius)*scale),radiusY:Math.abs(n(g.radiusY)*scale),rotationDeg:rotation,...base};if(g.type==='ARC')return{type:'ARC',center:transform(g.center,scale,rotation,origin),radius:Math.abs(n(g.radius)*scale),startDeg:n(g.startDeg)+rotation,endDeg:n(g.endDeg)+rotation,...base};if(g.type==='TEXT')return{type:'TEXT',position:transform(g.center,scale,rotation,origin),text:g.textSlot==='LABEL'&&label?label:String(g.text||''),height:Math.max(.01,n(g.height)*scale),rotationDeg:n(g.rotationDeg)+rotation,widthFactor:n(g.widthFactor)||1,obliqueDeg:n(g.obliqueDeg),fontName:g.fontName||'Segoe UI',...base};return null}
  function insertSymbol(){const t=selectedSymbol();if(!t){alert('Hãy chọn một ký hiệu đã học.');return}const label=prompt('Nhãn thiết bị:',t.name)??t.name,scale=Math.max(.001,Number(prompt('Tỷ lệ:', '1'))||1),rotation=Number(prompt('Góc xoay:', '0'))||0,b=project?.drawingBounds||{minX:0,minY:0,maxX:1000,maxY:700},origin={x:(b.minX+b.maxX)/2,y:(b.minY+b.maxY)/2},gid=uid('learned'),created=(t.geometry||[]).filter(g=>String(g.automationRole||'').toUpperCase()!=='PORT').map(g=>overlayFromPrimitive(g,origin,scale,rotation,label)).filter(Boolean);if(!created.length)return;simpleAction?.(`Chèn ký hiệu học “${t.name}”`,()=>{for(const e of created){e.automationGroupId=gid;e.automationId=gid;e.automationSymbolType=t.deviceType;e.automationLabel=label}overlays.push(...created);selected=created.map(e=>refFor(e,'overlay'))});fitView?.();status?.(`Đã chèn ký hiệu “${t.name}”.`)}
  function exportCatalog(){const c=catalog(),blob=new Blob([JSON.stringify(c,null,2)],{type:'application/json;charset=utf-8'}),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=(project?.sourceFile||'drawing').replace(/\.[^.]+$/,'')+'.learning.json';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000)}
  function importCatalog(file){const r=new FileReader();r.onload=()=>{try{const x=JSON.parse(String(r.result||''));if(x.schema!==CATALOG_SCHEMA)throw new Error('Không phải Network Learning Catalog');const c=catalog();for(const s of x.symbols||[])if(!c.symbols.some(y=>y.id===s.id))c.symbols.push(s);for(const t of x.topologies||[])if(!c.topologies.some(y=>y.id===t.id))c.topologies.push(t);c.audit.push(...(x.audit||[]).slice(-100));audit('catalog-import','',(x.symbols?.length||0)+(x.topologies?.length||0),file.name);setDirty?.(true);render();status?.('Đã nhập thư viện học: '+file.name)}catch(e){alert('Không nhập được thư viện học: '+e.message)}};r.readAsText(file)}
  function render(){const c=catalog(),ss=document.getElementById('networkLearnSymbolV0214'),ts=document.getElementById('networkLearnTopologyV0214'),st=document.getElementById('networkLearnStatusV0214');if(ss){const old=ss.value;ss.innerHTML='<option value="">— Chọn ký hiệu đã học —</option>'+c.symbols.map(x=>`<option value="${esc(x.id)}">${esc(x.name)} · ${esc(x.deviceType)} · ${Math.round((x.confidenceScore||0)*100)}%</option>`).join('');if([...ss.options].some(o=>o.value===old))ss.value=old}if(ts){const old=ts.value;ts.innerHTML='<option value="">— Chọn topology đã học —</option>'+c.topologies.map(x=>`<option value="${esc(x.id)}">${esc(x.name)} · ${x.network?.devices?.length||0} TB/${x.network?.connections?.length||0} LK</option>`).join('');if([...ts.options].some(o=>o.value===old))ts.value=old}if(st)st.textContent=`${c.symbols.length} mẫu ký hiệu · ${c.topologies.length} mẫu topology · ${c.audit.length} bản ghi học`}
  function install(){const host=document.getElementById('networkWorkspacePanelV0210');if(!host||document.getElementById('networkLearningPanelV0214')){render();return}const box=document.createElement('div');box.id='networkLearningPanelV0214';box.style.cssText='margin-top:9px;padding-top:9px;border-top:1px solid var(--line,#445)';box.innerHTML=`<div style="font-weight:700">Học và sinh sơ đồ nhanh — V0.17.4</div><div class="muted">SYMLEARN → TOPLEARN → NETLEARN → NETGENERATE. Kết quả được lưu cùng NetworkWorkspace.</div><label class="full" style="display:block;margin-top:7px">Ký hiệu đã học<select id="networkLearnSymbolV0214"></select></label><div class="button-row"><button id="networkSymbolLearnV0214">Học ký hiệu</button><button id="networkSymbolInsertV0214">Chèn ký hiệu</button></div><label class="full" style="display:block;margin-top:7px">Topology đã học<select id="networkLearnTopologyV0214"></select></label><div class="button-row"><button id="networkTopologyLearnV0214">Học vùng chọn</button><button id="networkDrawingLearnV0214">Học toàn bản vẽ</button><button id="networkGenerateV0214" class="primary">Sinh sơ đồ</button><button id="networkMigrateV0214">Đồng bộ lõi cũ</button><button id="networkLearningImportV0214">Nhập</button><button id="networkLearningExportV0214">Xuất</button></div><input id="networkLearningInputV0214" type="file" accept=".json,.learning.json,application/json" class="hidden"><div id="networkLearnStatusV0214" class="muted" style="margin-top:6px"></div><div class="muted">Project JSON v9 · NetworkWorkspace schema 2 · cần xác nhận lại mẫu tự suy luận trước khi dùng vận hành.</div>`;host.appendChild(box);document.getElementById('networkSymbolLearnV0214').onclick=learnSymbol;document.getElementById('networkSymbolInsertV0214').onclick=insertSymbol;document.getElementById('networkTopologyLearnV0214').onclick=learnTopology;document.getElementById('networkDrawingLearnV0214').onclick=learnDrawing;document.getElementById('networkGenerateV0214').onclick=generate;document.getElementById('networkMigrateV0214').onclick=()=>migrateLegacy(false);document.getElementById('networkLearningExportV0214').onclick=exportCatalog;document.getElementById('networkLearningImportV0214').onclick=()=>document.getElementById('networkLearningInputV0214').click();document.getElementById('networkLearningInputV0214').onchange=e=>{const f=e.target.files?.[0];if(f)importCatalog(f);e.target.value=''};migrateLegacy(true);render()}
  const api={version:API_VERSION,emptyCatalog,catalog,learnSymbol,learnTopology,learnDrawing,migrateLegacy,generate,insertSymbol,exportCatalog,render};window.DwgSketchNetworkLearningCoreV0214=api;
  if(typeof syncProject==='function'){const original=syncProject;syncProject=function(){catalog();return original.apply(this,arguments)}}
  if(typeof loadProjectObject==='function'){const original=loadProjectObject;loadProjectObject=function(){const r=original.apply(this,arguments);catalog();queueMicrotask(()=>{install();render()});return r}}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(install,0),{once:true});else setTimeout(install,0);setTimeout(install,1600);
})();
;
/* ===== END CONSOLIDATED SOURCE: network-learning-core-v0214.js ===== */

/* ===== BEGIN CONSOLIDATED SOURCE: a4-diagram-template-core-v02114.js ===== */
'use strict';
(() => {
  const API_VERSION='0.21.14';
  const SCHEMA='dwg-sketch-editable-a4-diagram-templates';
  const STORAGE_KEY='DwgSketch.A4EditableDiagramTemplates.V1';
  const MAX_TEMPLATES=500;
  const deep=v=>typeof structuredClone==='function'?structuredClone(v):JSON.parse(JSON.stringify(v));
  const uid=(prefix='id')=>`${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,10)}`;
  const now=()=>new Date().toISOString();
  const n=(v,f=0)=>Number.isFinite(Number(v))?Number(v):f;
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const q=id=>document.getElementById(id);
  let catalog=loadCatalog();
  let pendingInsert=null;
  let lastSearch='';
  let interactionHooksInstalled=false;
  let selectionPassThroughHooksInstalled=false;
  let clipboardHooksInstalled=false;
  let sessionHooksInstalled=false;
  let altFrameSelection=false;
  let searchTimer=0;
  let saveTimer=0;
  let lastInsertedInstanceId='';

  function isA4Frame(item){return !!item&&(String(item.automationRole||'').toUpperCase()==='A4_TEMPLATE_FRAME'||String(item.layer||'').toUpperCase()==='A4_TEMPLATE_FRAME'||item.editableA4Frame===true)}
  function frameSelectionEnabled(){return q('a4TemplateSelectFrameV0217')?.checked===true||altFrameSelection}
  function frameBorderHit(item,screen,tol=10){if(!isA4Frame(item))return false;const a=screenPoint(point(item.a)),b=screenPoint(point(item.b)),x1=Math.min(a.x,b.x),x2=Math.max(a.x,b.x),y1=Math.min(a.y,b.y),y2=Math.max(a.y,b.y);return pointSegmentDistance(screen,{x:x1,y:y1},{x:x2,y:y1})<=tol||pointSegmentDistance(screen,{x:x2,y:y1},{x:x2,y:y2})<=tol||pointSegmentDistance(screen,{x:x2,y:y2},{x:x1,y:y2})<=tol||pointSegmentDistance(screen,{x:x1,y:y2},{x:x1,y:y1})<=tol}
  function removePassThroughFramesFromSelection(){if(frameSelectionEnabled()||!Array.isArray(selected))return;const before=selected.length;selected=selected.filter(r=>!isA4Frame(r?.item));if(selected.length!==before){updateSelectionPanel?.();updateHistoryButtons?.();draw?.()}}
  function emptyCatalog(){return{schema:SCHEMA,schemaVersion:1,updatedAt:now(),templates:[]}}
  function normalizeItem(item){
    item=item&&typeof item==='object'?item:{};
    item.type=String(item.type||'').toUpperCase();
    item.layer=String(item.layer||'DWG_SKETCH');
    item.stroke=Math.max(.1,n(item.stroke,1.5));
    item.color=Number(item.color??item.trueColorArgb??0xffffffff)>>>0;
    if(Array.isArray(item.points))item.points=item.points.map(p=>({x:n(p?.x??p?.X),y:n(p?.y??p?.Y)}));
    for(const key of ['a','b','center','position'])if(item[key])item[key]={x:n(item[key]?.x??item[key]?.X),y:n(item[key]?.y??item[key]?.Y)};
    return item;
  }
  function normalizeTemplate(t){
    t=t&&typeof t==='object'?t:{};
    t.id=String(t.id||uid('a4-template'));
    t.name=String(t.name||'Mẫu sơ đồ A4').trim()||'Mẫu sơ đồ A4';
    t.keywords=String(t.keywords||'');
    t.category=String(t.category||'').trim();
    t.folder=String(t.folder||'').trim();
    t.tags=String(t.tags||'').trim();
    t.linkedBlockDefinitionId=String(t.linkedBlockDefinitionId||'').trim();
    t.linkedAutomationSymbolType=String(t.linkedAutomationSymbolType||'').trim();
    t.orientation=String(t.orientation).toLowerCase()==='portrait'?'portrait':'landscape';
    t.pageWidth=Math.max(1,n(t.pageWidth,t.orientation==='portrait'?210:297));
    t.pageHeight=Math.max(1,n(t.pageHeight,t.orientation==='portrait'?297:210));
    t.margin=Math.max(0,Math.min(n(t.margin,12),Math.min(t.pageWidth,t.pageHeight)/2-.1));
    t.anchorMode=['center','top-left'].includes(t.anchorMode)?t.anchorMode:'bottom-left';
    t.insertionAnchor=t.insertionAnchor?{x:n(t.insertionAnchor.x),y:n(t.insertionAnchor.y)}:anchorPoint(t.anchorMode,t.pageWidth,t.pageHeight);
    t.sourceScope=t.sourceScope==='drawing'?'drawing':'selection';
    t.sourceFile=String(t.sourceFile||'');
    t.includesFrame=t.includesFrame!==false;
    t.createdAt=String(t.createdAt||now());
    t.updatedAt=String(t.updatedAt||t.createdAt);
    t.useCount=Math.max(0,Math.floor(n(t.useCount)));
    t.items=Array.isArray(t.items)?t.items.map(normalizeItem).filter(x=>x.type):[];
    t.items.sort((a,b)=>(isA4Frame(a)?0:1)-(isA4Frame(b)?0:1));
    return t;
  }
  function normalizeCatalog(c){
    c=c&&typeof c==='object'?c:emptyCatalog();
    c.schema=SCHEMA;c.schemaVersion=1;c.updatedAt=now();
    const by=new Map();
    for(const raw of Array.isArray(c.templates)?c.templates:[]){const t=normalizeTemplate(raw),old=by.get(t.id);if(!old||String(t.updatedAt)>=String(old.updatedAt))by.set(t.id,t)}
    c.templates=[...by.values()].sort((a,b)=>a.name.localeCompare(b.name,'vi',{sensitivity:'base'})).slice(0,MAX_TEMPLATES);
    return c;
  }
  function loadCatalog(){try{const raw=localStorage.getItem(STORAGE_KEY);return normalizeCatalog(raw?JSON.parse(raw):emptyCatalog())}catch{return emptyCatalog()}}
  function persistCatalog(){catalog=normalizeCatalog(catalog);localStorage.setItem(STORAGE_KEY,JSON.stringify(catalog));}
  function saveCatalog(immediate=false){
    clearTimeout(saveTimer);
    if(immediate){persistCatalog();return}
    saveTimer=setTimeout(()=>{saveTimer=0;try{persistCatalog()}catch(err){console.warn('A4 template save failed',err)}},260);
  }
  function anchorPoint(mode,w,h){return mode==='center'?{x:w/2,y:h/2}:mode==='top-left'?{x:0,y:h}:{x:0,y:0}}
  function finiteBounds(b){return b&&Number.isFinite(b.minX)&&Number.isFinite(b.minY)&&Number.isFinite(b.maxX)&&Number.isFinite(b.maxY)}
  function boundsOfItems(items){const b={minX:Infinity,minY:Infinity,maxX:-Infinity,maxY:-Infinity};for(const item of items){try{itemBounds(item,b)}catch{}}return finiteBounds(b)?b:null}
  function isVisible(item){const layer=String(item?.layer||'0');return !(visibleLayers instanceof Set)||visibleLayers.size===0||visibleLayers.has(layer)}
  function sourceItems(scope){
    if(scope==='selection')return (Array.isArray(selected)?selected:[]).map(r=>deep(r.item)).filter(x=>x&&!isA4Frame(x));
    return [...(Array.isArray(entities)?entities:[]),...(Array.isArray(overlays)?overlays:[])].filter(x=>isVisible(x)&&!isA4Frame(x)).map(deep);
  }
  function addFrame(items,w,h){items.unshift({type:'RECTANGLE',a:{x:0,y:0},b:{x:w,y:h},color:0xff8a9aa8,stroke:1,layer:'A4_TEMPLATE_FRAME',automationRole:'A4_TEMPLATE_FRAME',editableA4Frame:true})}
  function normalizeToA4(items,orientation,margin,includeFrame){
    const w=orientation==='portrait'?210:297,h=orientation==='portrait'?297:210,b=boundsOfItems(items);
    if(!b)throw new Error('Không xác định được khung bao hữu hạn của mẫu.');
    const sw=Math.max(1e-6,b.maxX-b.minX),sh=Math.max(1e-6,b.maxY-b.minY),iw=Math.max(1e-6,w-2*margin),ih=Math.max(1e-6,h-2*margin),factor=Math.min(iw/sw,ih/sh);
    const sourceCenter={x:(b.minX+b.maxX)/2,y:(b.minY+b.maxY)/2},pageCenter={x:w/2,y:h/2};
    const output=items.map(deep);
    for(const item of output){scaleItem(item,sourceCenter,factor);translateItem(item,{x:pageCenter.x-sourceCenter.x,y:pageCenter.y-sourceCenter.y})}
    if(includeFrame)addFrame(output,w,h);
    return{items:output,pageWidth:w,pageHeight:h,factor};
  }
  function currentSourceName(){return String(project?.sourceFile||project?.name||'Bản vẽ hiện tại')}
  function saveTemplate(scope){
    const items=sourceItems(scope);
    if(!items.length){alert(scope==='selection'?'Hãy chọn các phần tử cần lưu thành mẫu trước.':'Bản vẽ hiện không có phần tử hiển thị để lưu.');return}
    const defaultName=scope==='selection'?`Mẫu A4 vùng chọn ${catalog.templates.length+1}`:`${currentSourceName().replace(/\.[^.]+$/,'')} · A4`;
    const name=prompt('Tên mẫu sơ đồ A4:',defaultName)?.trim();if(!name)return;
    const orientation=q('a4TemplateOrientationV0217')?.value==='portrait'?'portrait':'landscape';
    const margin=Math.max(0,Math.min(n(q('a4TemplateMarginV0217')?.value,12),80));
    const anchorMode=q('a4TemplateAnchorV0217')?.value||'bottom-left';
    const includesFrame=q('a4TemplateFrameV0217')?.checked!==false;
    let normalized;try{normalized=normalizeToA4(items,orientation,margin,includesFrame)}catch(err){alert(err.message);return}
    const t=normalizeTemplate({id:uid('a4-template'),name,keywords:currentSourceName(),category:String(q('a4TemplateCategoryV02114')?.value||'').trim(),folder:String(q('a4TemplateFolderV02114')?.value||'').trim(),tags:String(q('a4TemplateTagsV02114')?.value||'').trim(),orientation,pageWidth:normalized.pageWidth,pageHeight:normalized.pageHeight,margin,anchorMode,insertionAnchor:anchorPoint(anchorMode,normalized.pageWidth,normalized.pageHeight),sourceScope:scope,sourceFile:currentSourceName(),includesFrame,createdAt:now(),updatedAt:now(),useCount:0,items:normalized.items});
    catalog.templates.push(t);saveCatalog();q('a4TemplateSearchV0217').value='';renderList(t.id);setStatus(`Đã lưu “${t.name}”: ${items.length} phần tử độc lập, chuẩn hóa A4 với hệ số ${normalized.factor.toFixed(3)}.`)
  }
  function normalizeSearch(value){return String(value||'').trim().toLocaleLowerCase('vi').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/đ/g,'d').replace(/\s+/g,' ')}
  function searchScore(t,query){
    query=normalizeSearch(query);if(!query)return 10;
    const name=normalizeSearch(t.name),keywords=normalizeSearch(t.keywords),source=normalizeSearch(t.sourceFile),category=normalizeSearch(t.category),folder=normalizeSearch(t.folder),tags=normalizeSearch(t.tags),symbol=normalizeSearch(t.linkedAutomationSymbolType),all=`${name} ${keywords} ${source} ${category} ${folder} ${tags} ${symbol}`,tokens=query.split(' ').filter(Boolean);
    if(tokens.some(token=>!all.includes(token)))return-1;
    let score=0;
    for(const token of tokens)score+=name===token?120:name.startsWith(token)?70:name.includes(token)?45:keywords.includes(token)?25:tags.includes(token)?24:category.includes(token)?22:folder.includes(token)?20:12;
    if(name.startsWith(query))score+=100;else if(name.includes(query))score+=50;
    return score;
  }
  function selectedTemplate(){return catalog.templates.find(x=>x.id===q('a4TemplateSelectV0217')?.value)||null}
  function renderList(selectId){
    const sel=q('a4TemplateSelectV0217');if(!sel)return;
    const query=q('a4TemplateSearchV0217')?.value||'';lastSearch=query;
    const list=catalog.templates.map(t=>({t,score:searchScore(t,query)})).filter(x=>x.score>=0)
      .sort((a,b)=>b.score-a.score||b.t.useCount-a.t.useCount||String(b.t.updatedAt).localeCompare(String(a.t.updatedAt))||a.t.name.localeCompare(b.t.name,'vi',{sensitivity:'base'})).map(x=>x.t);
    sel.innerHTML='';
    for(const t of list){const o=document.createElement('option');o.value=t.id;o.textContent=`${t.name} · A4 ${t.orientation==='portrait'?'dọc':'ngang'} · ${t.items.length} phần tử`;sel.appendChild(o)}
    if(selectId&&list.some(x=>x.id===selectId))sel.value=selectId;
    else if(list.length)sel.selectedIndex=0;
    renderStatusForSelection();
  }
  function scheduleRenderList(selectId){clearTimeout(searchTimer);searchTimer=setTimeout(()=>{searchTimer=0;renderList(selectId)},150)}
  function setStatus(text){const e=q('a4TemplateStatusV0217');if(e)e.textContent=text;status?.(text)}
  function renderStatusForSelection(){const t=selectedTemplate();if(!t){setStatus(lastSearch?'Không tìm thấy mẫu phù hợp.':'Chưa có mẫu sơ đồ A4.');renderWorkflowMeta(null);drawThumbnail(null);return}setStatus(`${t.name}: A4 ${t.orientation==='portrait'?'dọc':'ngang'}, ${t.items.length} phần tử độc lập, đã chèn ${t.useCount} lần${t.category?`, nhóm ${t.category}`:''}.`);renderWorkflowMeta(t);drawThumbnail(t)}
  function remapInstanceMetadata(items){
    const instanceId=uid('a4-instance'),groupMap=new Map(),nodeMap=new Map(),connectionMap=new Map(),blockMap=new Map();
    const mapped=(map,value,prefix)=>{value=String(value||'');if(!value)return'';if(!map.has(value))map.set(value,`${prefix}-${instanceId}-${map.size+1}`);return map.get(value)};
    for(const item of items){item.a4TemplateInstanceId=instanceId;item.automationGroupId=mapped(groupMap,item.automationGroupId,'group');item.automationId=mapped(nodeMap,item.automationId,'node');item.nodeId=mapped(nodeMap,item.nodeId,'node');item.automationConnectionId=mapped(connectionMap,item.automationConnectionId,'connection');item.connectionId=mapped(connectionMap,item.connectionId,'connection');item.automationFromNodeId=mapped(nodeMap,item.automationFromNodeId,'node');item.automationToNodeId=mapped(nodeMap,item.automationToNodeId,'node');if(String(item.blockInstanceId||'')){if(!blockMap.has(item.blockInstanceId))blockMap.set(item.blockInstanceId,uid('block-instance'));item.blockInstanceId=blockMap.get(item.blockInstanceId)}}
    return items;
  }
  function stampInstanceTransform(items,t,insertPoint,scaleFactor,rotationDeg){for(const item of items){item.a4TemplateDefinitionId=t.id;item.a4TemplateName=t.name;item.a4TemplateInsertX=insertPoint.x;item.a4TemplateInsertY=insertPoint.y;item.a4TemplateScale=scaleFactor;item.a4TemplateRotationDeg=rotationDeg}}
  function transformTemplateItems(t,scaleFactor,rotationDeg){
    const anchor=deep(t.insertionAnchor),items=t.items.map(deep);
    for(const item of items){if(Math.abs(scaleFactor-1)>1e-12)scaleItem(item,anchor,scaleFactor);if(Math.abs(rotationDeg)>1e-12)rotateItem(item,anchor,rotationDeg)}
    return items;
  }
  function transformedPageCorners(t,scaleFactor,rotationDeg){
    const anchor=deep(t.insertionAnchor),corners=[{x:0,y:0},{x:t.pageWidth,y:0},{x:t.pageWidth,y:t.pageHeight},{x:0,y:t.pageHeight}];
    return corners.map(p=>{let x={x:p.x,y:p.y};if(Math.abs(scaleFactor-1)>1e-12)x={x:anchor.x+(x.x-anchor.x)*scaleFactor,y:anchor.y+(x.y-anchor.y)*scaleFactor};if(Math.abs(rotationDeg)>1e-12)x=rotateWorld(x,anchor,rotationDeg);return x})
  }
  function pendingDelta(pointValue){return pendingInsert?{x:pointValue.x-pendingInsert.anchor.x,y:pointValue.y-pendingInsert.anchor.y}:{x:0,y:0}}
  function materializePending(pointValue){
    if(!pendingInsert)return[];
    const d=pendingDelta(pointValue),created=pendingInsert.items.map(deep);
    for(const item of created)translateItem(item,d);
    remapInstanceMetadata(created);
    const t=catalog.templates.find(x=>x.id===pendingInsert.templateId);if(t)stampInstanceTransform(created,t,pointValue,pendingInsert.scaleFactor,pendingInsert.rotationDeg);
    lastInsertedInstanceId=created.find(x=>x.a4TemplateInstanceId)?.a4TemplateInstanceId||'';
    return created.sort((a,b)=>(isA4Frame(a)?0:1)-(isA4Frame(b)?0:1));
  }
  function startInsert(){
    const t=selectedTemplate();if(!t){alert('Hãy tìm và chọn một mẫu A4 trước khi chèn.');return}
    cancelPending(false);
    const screen=lastPointer&&Number.isFinite(lastPointer.x)?lastPointer:{x:(viewportWidth||canvas.clientWidth||1)/2,y:(viewportHeight||canvas.clientHeight||1)/2};
    const scaleFactor=Math.max(.01,Math.min(100,n(q('a4TemplateInsertScaleV0217')?.value,1))),rotationDeg=((n(q('a4TemplateInsertRotationV0217')?.value,0)%360)+360)%360;
    const items=transformTemplateItems(t,scaleFactor,rotationDeg),pageCorners=transformedPageCorners(t,scaleFactor,rotationDeg);
    pendingInsert={templateId:t.id,templateName:t.name,anchor:deep(t.insertionAnchor),items,bounds:boundsOfItems(items),pageCorners,current:world(screen.x,screen.y),scaleFactor,rotationDeg};
    canvas.style.cursor='crosshair';draw();setStatus(`Đang chèn “${t.name}” ×${scaleFactor.toFixed(3)}, góc ${rotationDeg.toFixed(3)}°. Preview nhẹ; phần tử chỉ được tạo khi bấm xác nhận.`)
  }
  function commitPending(worldPoint){
    if(!pendingInsert)return;
    const t=catalog.templates.find(x=>x.id===pendingInsert.templateId),created=materializePending(worldPoint),frames=created.filter(isA4Frame),content=created.filter(x=>!isA4Frame(x)),selectAfter=q('a4TemplateSelectAfterInsertV0217')?.checked===true;
    simpleAction(`Chèn mẫu A4: ${pendingInsert.templateName}`,()=>{
      if(frames.length)overlays.unshift(...frames);
      if(content.length)overlays.push(...content);
      selected=selectAfter?content.map(item=>refFor(item,'overlay')):[];
    });
    if(t){t.useCount++;t.updatedAt=now();saveCatalog()}
    const name=pendingInsert.templateName,count=created.length;pendingInsert=null;canvas.style.cursor='';updateSelectionPanel?.();draw();renderList(t?.id);
    setStatus(selectAfter?`Đã chèn “${name}” và chọn ${content.length} phần tử nội dung.`:`Đã chèn “${name}”: ${count} phần tử có thể sửa riêng. Chọn một phần tử rồi dùng A4INSTSEL để chọn cả lần chèn.`)
  }
  function cancelPending(notify=true){if(!pendingInsert)return;const name=pendingInsert.templateName;pendingInsert=null;canvas.style.cursor='';draw();if(notify)setStatus(`Đã hủy chèn mẫu “${name}”.`)}
  function selectInsertedInstance(){
    let instanceId='';
    if(Array.isArray(selected))for(let i=selected.length-1;i>=0;i--){instanceId=String(selected[i]?.item?.a4TemplateInstanceId||'');if(instanceId)break}
    if(!instanceId)instanceId=lastInsertedInstanceId;
    if(!instanceId){setStatus('Hãy chọn một phần tử thuộc mẫu đã chèn, sau đó dùng Chọn cùng lần chèn.');return}
    selected=overlays.filter(item=>String(item.a4TemplateInstanceId||'')===instanceId&&(!isA4Frame(item)||frameSelectionEnabled())).map(item=>refFor(item,'overlay'));
    updateSelectionPanel?.();draw();setStatus(`Đã chọn ${selected.length} phần tử của cùng một lần chèn; từng phần tử vẫn có thể sửa riêng.`)
  }
  function renameTemplate(){const t=selectedTemplate();if(!t)return;const name=prompt('Đổi tên mẫu sơ đồ A4:',t.name)?.trim();if(!name)return;t.name=name;t.updatedAt=now();saveCatalog();renderList(t.id)}
  function deleteTemplate(){const t=selectedTemplate();if(!t)return;if(!confirm(`Xóa mẫu “${t.name}” khỏi thư viện dùng chung?`))return;catalog.templates=catalog.templates.filter(x=>x.id!==t.id);saveCatalog();renderList()}
  function downloadCatalog(){const blob=new Blob([JSON.stringify(normalizeCatalog(catalog),null,2)],{type:'application/json;charset=utf-8'}),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='DWG_Sketch_A4_Editable_Templates.a4templates.json';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);setStatus('Đã xuất thư viện mẫu sơ đồ A4.')}
  function importCatalog(file){const r=new FileReader();r.onload=()=>{try{const parsed=JSON.parse(String(r.result||''));if(parsed?.schema!==SCHEMA)throw new Error('Không phải thư viện mẫu sơ đồ A4 của DWG Sketch.');const incoming=normalizeCatalog(parsed);const by=new Map(catalog.templates.map(x=>[x.id,x]));for(const t of incoming.templates){const old=by.get(t.id);if(!old||String(t.updatedAt)>=String(old.updatedAt))by.set(t.id,t)}catalog.templates=[...by.values()];saveCatalog();renderList();setStatus(`Đã nhập ${incoming.templates.length} mẫu.`)}catch(err){alert('Không nhập được thư viện: '+err.message)}};r.readAsText(file)}

  function renderWorkflowMeta(t){
    const c=q('a4TemplateCategoryV02114'),f=q('a4TemplateFolderV02114'),g=q('a4TemplateTagsV02114'),l=q('a4TemplateLinkV02114');
    if(c)c.value=t?.category||'';if(f)f.value=t?.folder||'';if(g)g.value=t?.tags||'';
    if(l)l.textContent=!t?'Chưa chọn mẫu.':(!t.linkedBlockDefinitionId&&!t.linkedAutomationSymbolType?'Chưa liên kết Block/Symbol.':`Block=${String(t.linkedBlockDefinitionId||'-').slice(0,10)}; Symbol=${t.linkedAutomationSymbolType||'-'}`);
  }
  function drawThumbnail(t){
    const cv=q('a4TemplateThumbV02114');if(!cv)return;const c=cv.getContext('2d');c.clearRect(0,0,cv.width,cv.height);c.fillStyle='#17232d';c.fillRect(0,0,cv.width,cv.height);if(!t)return;
    const pad=8,s=Math.min((cv.width-2*pad)/Math.max(1,t.pageWidth),(cv.height-2*pad)/Math.max(1,t.pageHeight)),ox=(cv.width-t.pageWidth*s)/2,oy=(cv.height-t.pageHeight*s)/2,P=p=>({x:ox+n(p?.x)*s,y:oy+(t.pageHeight-n(p?.y))*s});
    const css=argb=>{const v=Number(argb??0xffffffff)>>>0,r=(v>>>16)&255,g=(v>>>8)&255,b=v&255;return `rgb(${r},${g},${b})`};
    c.lineCap='butt';c.lineJoin='miter';
    for(const it of (t.items||[]).slice(0,700)){c.strokeStyle=isA4Frame(it)?'#78909c':css(it.color);c.fillStyle=c.strokeStyle;c.lineWidth=Math.max(.6,Math.min(2.2,n(it.stroke,1)*.45));const ty=String(it.type||'').toUpperCase();
      if(ty==='LINE'){const a=P(it.a),b=P(it.b);c.beginPath();c.moveTo(a.x,a.y);c.lineTo(b.x,b.y);c.stroke()}
      else if(ty==='POLYLINE'&&Array.isArray(it.points)&&it.points.length>1){c.beginPath();it.points.forEach((p,i)=>{p=P(p);i?c.lineTo(p.x,p.y):c.moveTo(p.x,p.y)});if(it.closed)c.closePath();if(it.closed&&String(it.fillMode).toLowerCase()==='solid'){c.save();c.globalAlpha=.14;c.fill();c.restore()}c.stroke()}
      else if(ty==='RECTANGLE'){const a=P(it.a),b=P(it.b);c.strokeRect(Math.min(a.x,b.x),Math.min(a.y,b.y),Math.abs(b.x-a.x),Math.abs(b.y-a.y))}
      else if(ty==='CIRCLE'||ty==='ELLIPSE'){const p=P(it.center),rx=Math.abs(n(it.radius)*s),ry=Math.abs(n(ty==='ELLIPSE'?it.radiusY:it.radius)*s);c.beginPath();c.ellipse(p.x,p.y,rx,ry,0,0,Math.PI*2);c.stroke()}
      else if(ty==='TEXT'){const p=P(it.center||it.position);c.font=`${Math.max(5,Math.min(12,n(it.height,2.5)*s))}px Segoe UI`;c.fillText(String(it.text||'').slice(0,22),p.x,p.y)}
      else if(ty==='ARC'){const p=P(it.center),r=Math.abs(n(it.radius)*s);c.save();c.globalAlpha=.45;c.beginPath();c.arc(p.x,p.y,r,0,Math.PI*2);c.stroke();c.restore()}
      else if(ty==='DIMENSION'){const a=P(it.a),b=P(it.b);c.beginPath();c.moveTo(a.x,a.y);c.lineTo(b.x,b.y);c.stroke()}
    }
  }
  function saveWorkflowMeta(){const t=selectedTemplate();if(!t){setStatus('Hãy chọn mẫu A4 trước.');return}t.category=String(q('a4TemplateCategoryV02114')?.value||'').trim();t.folder=String(q('a4TemplateFolderV02114')?.value||'').trim();t.tags=String(q('a4TemplateTagsV02114')?.value||'').trim();t.updatedAt=now();saveCatalog(true);renderList(t.id);setStatus(`Đã cập nhật tag/phân loại cho “${t.name}”.`)}
  function selectedA4Instance(){let seed=null;if(Array.isArray(selected))for(let i=selected.length-1;i>=0;i--){const x=selected[i]?.item;if(String(x?.a4TemplateInstanceId||'')){seed=x;break}}if(!seed)return null;const id=String(seed.a4TemplateInstanceId),members=overlays.filter(x=>String(x.a4TemplateInstanceId||'')===id);return members.length?{id,seed,members}:null}
  function resolveTemplateForInstance(inst){const id=String(inst?.seed?.a4TemplateDefinitionId||'');return catalog.templates.find(x=>x.id===id)||selectedTemplate()}
  function clearA4InstanceMeta(item){item.a4TemplateInstanceId='';item.a4TemplateDefinitionId='';item.a4TemplateName='';item.a4TemplateInsertX=0;item.a4TemplateInsertY=0;item.a4TemplateScale=1;item.a4TemplateRotationDeg=0}
  function updateTemplateFromSelectedInstance(){
    const inst=selectedA4Instance();if(!inst){setStatus('Hãy chọn một phần tử thuộc mẫu A4 đã chèn.');return}const t=resolveTemplateForInstance(inst);if(!t){setStatus('Không xác định được definition của instance.');return}if(!String(inst.seed.a4TemplateDefinitionId||'')){setStatus('Instance phiên bản cũ chưa có transform metadata V0.17.14; không cập nhật tự động.');return}if(!confirm(`Cập nhật mẫu “${t.name}” từ ${inst.members.length} phần tử đang sửa?`))return;
    const anchor=deep(t.insertionAnchor),sc=Math.max(1e-9,n(inst.seed.a4TemplateScale,1)),rot=n(inst.seed.a4TemplateRotationDeg),delta={x:n(inst.seed.a4TemplateInsertX)-anchor.x,y:n(inst.seed.a4TemplateInsertY)-anchor.y},items=inst.members.map(deep);
    for(const item of items){translateItem(item,{x:-delta.x,y:-delta.y});if(Math.abs(rot)>1e-12)rotateItem(item,anchor,-rot);if(Math.abs(sc-1)>1e-12)scaleItem(item,anchor,1/sc);clearA4InstanceMeta(item)}
    t.items=items.map(normalizeItem).sort((a,b)=>(isA4Frame(a)?0:1)-(isA4Frame(b)?0:1));t.includesFrame=t.items.some(isA4Frame);t.updatedAt=now();saveCatalog(true);renderList(t.id);setStatus(`Đã cập nhật definition “${t.name}” từ instance đang sửa; instance khác chưa thay đổi.`)
  }
  function replaceSelectedInstance(){
    const inst=selectedA4Instance(),t=selectedTemplate();if(!t){setStatus('Hãy chọn mẫu dùng để thay instance.');return}if(!inst){setStatus('Hãy chọn instance A4 cần thay.');return}if(!String(inst.seed.a4TemplateDefinitionId||'')){setStatus('Instance cũ chưa có transform metadata V0.17.14; không thể giữ vị trí an toàn.');return}
    const target={x:n(inst.seed.a4TemplateInsertX),y:n(inst.seed.a4TemplateInsertY)},sc=Math.max(.01,n(inst.seed.a4TemplateScale,1)),rot=n(inst.seed.a4TemplateRotationDeg),items=transformTemplateItems(t,sc,rot),d={x:target.x-t.insertionAnchor.x,y:target.y-t.insertionAnchor.y};for(const item of items)translateItem(item,d);remapInstanceMetadata(items);stampInstanceTransform(items,t,target,sc,rot);const frames=items.filter(isA4Frame),content=items.filter(x=>!isA4Frame(x));
    simpleAction(`Thay instance A4: ${t.name}`,()=>{for(let i=overlays.length-1;i>=0;i--)if(String(overlays[i].a4TemplateInstanceId||'')===inst.id)overlays.splice(i,1);if(frames.length)overlays.unshift(...frames);if(content.length)overlays.push(...content);selected=content.map(x=>refFor(x,'overlay'))});lastInsertedInstanceId=items.find(x=>x.a4TemplateInstanceId)?.a4TemplateInstanceId||'';t.useCount++;t.updatedAt=now();saveCatalog();updateSelectionPanel?.();draw();setStatus(`Đã thay instance bằng “${t.name}”, giữ X/Y, tỷ lệ và góc chèn.`)
  }
  function linkTemplateToSelectedBlock(){const t=selectedTemplate();if(!t){setStatus('Hãy chọn mẫu A4 cần liên kết.');return}let seed=null;if(Array.isArray(selected))for(let i=selected.length-1;i>=0;i--){const x=selected[i]?.item;if(String(x?.blockInstanceId||'')){seed=x;break}}if(!seed){setStatus('Hãy chọn một phần tử thuộc Block instance trước.');return}t.linkedBlockDefinitionId=String(seed.blockDefinitionId||'');t.linkedAutomationSymbolType=String(seed.automationSymbolType||seed.blockName||'');t.updatedAt=now();saveCatalog(true);renderList(t.id);setStatus(`Đã liên kết “${t.name}” với Block/Symbol metadata.`)}
  function installUi(){
    if(q('a4TemplatePanelV0217')){renderList();return}
    const network=q('networkWorkspacePanelV0210');
    const before=network?.nextSibling||[...document.querySelectorAll('aside.panel.right .section')].find(x=>x.querySelector('h3')?.textContent.includes('Tự động tạo sơ đồ lưới'));
    if(!before?.parentNode)return;
    const box=document.createElement('div');
    box.id='a4TemplatePanelV0217';box.className='section';box.dataset.mobileGroup='create';
    box.innerHTML=`<h3>Thư viện mẫu sơ đồ A4 có thể chỉnh sửa — V0.17.14</h3>
      <div class="muted">Thumbnail vector, tag/phân loại/thư mục, cập nhật definition từ instance và thay instance giữ đúng vị trí/tỷ lệ/góc.</div>
      <label class="full" style="display:block;margin-top:7px">Tìm theo tên mẫu
        <input id="a4TemplateSearchV0217" placeholder="Tên, từ khóa hoặc bản vẽ nguồn">
      </label>
      <label class="full" style="display:block;margin-top:6px">Mẫu đã lưu
        <select id="a4TemplateSelectV0217"></select>
      </label>
      <canvas id="a4TemplateThumbV02114" width="300" height="150" style="display:block;width:100%;max-width:300px;height:150px;margin:7px auto 0;background:#17232d;border:1px solid #607d8b;border-radius:4px"></canvas>
      <div class="form-grid" style="margin-top:6px">
        <label>Nhóm / loại<input id="a4TemplateCategoryV02114" placeholder="Sơ đồ nhất thứ"></label>
        <label>Thư mục<input id="a4TemplateFolderV02114" placeholder="110kV/Đường dây"></label>
      </div>
      <label class="full" style="display:block;margin-top:6px">Tag tìm kiếm<input id="a4TemplateTagsV02114" placeholder="110kV, ngăn lộ, máy cắt"></label>
      <div id="a4TemplateLinkV02114" class="muted" style="margin-top:4px">Chưa liên kết Block/Symbol.</div>
      <div class="form-grid" style="margin-top:6px">
        <label>Khổ
          <select id="a4TemplateOrientationV0217"><option value="landscape">A4 ngang</option><option value="portrait">A4 dọc</option></select>
        </label>
        <label>Lề (mm)<input id="a4TemplateMarginV0217" type="number" value="12" min="0" max="80" step="1"></label>
        <label>Điểm neo
          <select id="a4TemplateAnchorV0217"><option value="bottom-left">Góc trái dưới</option><option value="center">Tâm khung</option><option value="top-left">Góc trái trên</option></select>
        </label>
        <label style="display:flex;align-items:center;gap:6px"><input id="a4TemplateFrameV0217" type="checkbox" checked> Kèm khung A4</label>
        <label>Tỷ lệ chèn<input id="a4TemplateInsertScaleV0217" type="number" value="1" min=".01" max="100" step=".1"></label>
        <label>Góc chèn (°)<input id="a4TemplateInsertRotationV0217" type="number" value="0" step="5"></label>
      </div>
      <label style="display:flex;align-items:center;gap:7px;margin-top:7px"><input id="a4TemplateSelectAfterInsertV0217" type="checkbox"> Chọn toàn bộ nội dung sau khi chèn</label>
      <label style="display:flex;align-items:center;gap:7px;margin-top:7px"><input id="a4TemplateSelectFrameV0217" type="checkbox"> Cho phép chọn khung A4 (chỉ tại đường viền)</label>
      <div class="muted" style="margin-top:3px">Khung mặc định nằm dưới nội dung và xuyên chọn. Mẫu lớn chỉ vẽ khung preview, không tạo hàng nghìn phần tử khi rê chuột.</div>
      <div class="button-row" style="margin-top:7px">
        <button id="a4TemplateSaveSelectionV0217" class="primary">Lưu vùng chọn</button>
        <button id="a4TemplateSaveDrawingV0217">Lưu toàn bản vẽ</button>
        <button id="a4TemplateInsertV0217" class="primary">Chèn tại vị trí</button>
        <button id="a4TemplateSelectInstanceV0217">Chọn cùng lần chèn</button>
        <button id="a4TemplateSaveMetaV02114">Lưu tag/phân loại</button>
        <button id="a4TemplateUpdateV02114">Cập nhật mẫu từ instance</button>
        <button id="a4TemplateReplaceV02114">Thay instance</button>
        <button id="a4TemplateLinkBlockV02114">Liên kết Block/Symbol</button>
        <button id="a4TemplateRenameV0217">Đổi tên</button>
        <button id="a4TemplateDeleteV0217" class="danger">Xóa</button>
        <button id="a4TemplateImportV0217">Nhập</button>
        <button id="a4TemplateExportV0217">Xuất</button>
      </div>
      <input id="a4TemplateImportInputV0217" type="file" accept=".json,.a4templates.json,application/json" class="hidden">
      <div id="a4TemplateStatusV0217" class="muted" style="margin-top:6px"></div>`;
    before.parentNode.insertBefore(box,before);
    q('a4TemplateSearchV0217').addEventListener('input',()=>scheduleRenderList((selectedTemplate()||{}).id));
    q('a4TemplateSelectV0217').addEventListener('change',renderStatusForSelection);
    q('a4TemplateSaveSelectionV0217').onclick=()=>saveTemplate('selection');
    q('a4TemplateSaveDrawingV0217').onclick=()=>saveTemplate('drawing');
    q('a4TemplateInsertV0217').onclick=startInsert;
    q('a4TemplateSelectInstanceV0217').onclick=selectInsertedInstance;
    q('a4TemplateSaveMetaV02114').onclick=saveWorkflowMeta;
    q('a4TemplateUpdateV02114').onclick=updateTemplateFromSelectedInstance;
    q('a4TemplateReplaceV02114').onclick=replaceSelectedInstance;
    q('a4TemplateLinkBlockV02114').onclick=linkTemplateToSelectedBlock;
    q('a4TemplateRenameV0217').onclick=renameTemplate;
    q('a4TemplateDeleteV0217').onclick=deleteTemplate;
    q('a4TemplateExportV0217').onclick=downloadCatalog;
    q('a4TemplateImportV0217').onclick=()=>q('a4TemplateImportInputV0217').click();
    q('a4TemplateImportInputV0217').onchange=e=>{const f=e.target.files?.[0];if(f)importCatalog(f);e.target.value=''};
    q('a4TemplateSelectFrameV0217').addEventListener('change',()=>{removePassThroughFramesFromSelection();setStatus(frameSelectionEnabled()?'Đã bật chọn khung A4: bấm đúng đường viền; nội dung vẫn được ưu tiên.':'Khung A4 đang là lớp nền xuyên chọn.')});
    renderList();
  }
  function buildPointerHitList(){const list=[];if(q('overlayCheck')?.checked)for(let i=overlays.length-1;i>=0;i--)list.push(refFor(overlays[i],'overlay'));for(let i=entities.length-1;i>=0;i--)if(visibleLayers.has(String(entities[i].layer||'0')))list.push(refFor(entities[i],'entity'));return list}
  function hitTestWithA4PassThrough(screen,applyFilter){const list=buildPointerHitList();for(const r of list){if(isA4Frame(r.item))continue;if((!applyFilter||selectionFilterMatches(r.item))&&hitItem(r.item,screen))return r}if(frameSelectionEnabled())for(const r of list)if(isA4Frame(r.item)&&(!applyFilter||selectionFilterMatches(r.item))&&frameBorderHit(r.item,screen))return r;return null}
  function installSelectionPassThroughHooks(){
    if(selectionPassThroughHooksInstalled)return;selectionPassThroughHooksInstalled=true;
    if(typeof hitTest==='function')hitTest=function(screen){return hitTestWithA4PassThrough(screen,true)};
    if(typeof hitTestAny==='function')hitTestAny=function(screen){return hitTestWithA4PassThrough(screen,false)};
    if(typeof selectByRegion==='function'&&!selectByRegion.__a4FrameWrapped){const base=selectByRegion;const wrapped=function(){const result=base.apply(this,arguments);removePassThroughFramesFromSelection();return result};wrapped.__a4FrameWrapped=true;selectByRegion=wrapped}
    if(typeof selectAllMatchingFilter==='function'&&!selectAllMatchingFilter.__a4FrameWrapped){const base=selectAllMatchingFilter;const wrapped=function(){const result=base.apply(this,arguments);removePassThroughFramesFromSelection();return result};wrapped.__a4FrameWrapped=true;selectAllMatchingFilter=wrapped}
    if(typeof refsInRegion==='function'&&!refsInRegion.__a4FrameWrapped){const base=refsInRegion;const wrapped=function(){const result=base.apply(this,arguments);if(result?.refs&&!frameSelectionEnabled())result.refs=result.refs.filter(r=>!isA4Frame(r.item));return result};wrapped.__a4FrameWrapped=true;refsInRegion=wrapped}
    if(typeof expandLinkedSelection==='function'&&!expandLinkedSelection.__a4FrameWrapped){const base=expandLinkedSelection;const wrapped=function(){const result=base.apply(this,arguments);removePassThroughFramesFromSelection();return result};wrapped.__a4FrameWrapped=true;expandLinkedSelection=wrapped}
    window.addEventListener('keydown',e=>{if(e.key==='Alt'){altFrameSelection=true}},{capture:true});
    window.addEventListener('keyup',e=>{if(e.key==='Alt'){altFrameSelection=false}},{capture:true});
    window.addEventListener('blur',()=>{altFrameSelection=false});
  }
  function installSessionHooks(){
    if(sessionHooksInstalled)return;sessionHooksInstalled=true;
    if(typeof switchDrawingSession==='function'&&!switchDrawingSession.__a4PendingWrapped){const base=switchDrawingSession;const wrapped=function(){cancelPending(false);return base.apply(this,arguments)};wrapped.__a4PendingWrapped=true;switchDrawingSession=wrapped}
    if(typeof closeDrawingSession==='function'&&!closeDrawingSession.__a4PendingWrapped){const base=closeDrawingSession;const wrapped=function(){cancelPending(false);return base.apply(this,arguments)};wrapped.__a4PendingWrapped=true;closeDrawingSession=wrapped}
    if(typeof newProject==='function'&&!newProject.__a4PendingWrapped){const base=newProject;const wrapped=function(){cancelPending(false);return base.apply(this,arguments)};wrapped.__a4PendingWrapped=true;newProject=wrapped}
    if(typeof openFile==='function'&&!openFile.__a4PendingWrapped){const base=openFile;const wrapped=async function(){cancelPending(false);return await base.apply(this,arguments)};wrapped.__a4PendingWrapped=true;openFile=wrapped}
  }
  function installClipboardHooks(){
    if(clipboardHooksInstalled)return;clipboardHooksInstalled=true;
    if(typeof pasteSelection==='function'&&!pasteSelection.__a4InstanceWrapped){
      const base=pasteSelection;
      const wrapped=function(){
        const before=new Set(Array.isArray(overlays)?overlays:[]);
        const result=base.apply(this,arguments);
        const created=(Array.isArray(overlays)?overlays:[]).filter(item=>!before.has(item)&&String(item?.a4TemplateInstanceId||''));
        const map=new Map();
        for(const item of created){
          const oldId=String(item.a4TemplateInstanceId||'');
          if(!map.has(oldId))map.set(oldId,uid('a4-instance'));
          item.a4TemplateInstanceId=map.get(oldId);
        }
        return result;
      };
      wrapped.__a4InstanceWrapped=true;
      pasteSelection=wrapped;
    }
  }
  function installInteractionHooks(){
    if(interactionHooksInstalled)return;interactionHooksInstalled=true;
    if(typeof renderCanvasNow==='function'&&!renderCanvasNow.__a4TemplateWrapped){
      const base=renderCanvasNow;
      const wrapped=function(){
        base.apply(this,arguments);
        if(!pendingInsert)return;
        const d=pendingDelta(pendingInsert.current);
        ctx.save();
        ctx.globalAlpha=.72;
        ctx.translate(d.x*scale,-d.y*scale);
        if(pendingInsert.items.length<=140){
          for(const item of pendingInsert.items)drawItem(item,true,'#31d7ff');
        }else if(Array.isArray(pendingInsert.pageCorners)&&pendingInsert.pageCorners.length===4){
          drawItem({type:'POLYLINE',points:pendingInsert.pageCorners,closed:true,stroke:1.5,color:0xff31d7ff,layer:'A4_TEMPLATE_PREVIEW'},true,'#31d7ff');
        }
        ctx.restore();
        const b=pendingInsert.bounds;
        if(b){
          ctx.save();
          ctx.fillStyle='#31d7ff';
          ctx.font='13px Segoe UI';
          ctx.fillText(`${pendingInsert.templateName} · ${pendingInsert.items.length} phần tử`,sx(b.minX+d.x)+8,sy(b.maxY+d.y)+18);
          ctx.restore();
        }
      };
      wrapped.__a4TemplateWrapped=true;
      renderCanvasNow=wrapped;
    }
    canvas?.addEventListener('pointermove',e=>{if(!pendingInsert)return;const s=eventPos(e);pendingInsert.current=world(s.x,s.y);draw();e.preventDefault();e.stopImmediatePropagation()},{capture:true});
    canvas?.addEventListener('pointerdown',e=>{if(!pendingInsert||e.button!==0)return;const s=eventPos(e);commitPending(world(s.x,s.y));e.preventDefault();e.stopImmediatePropagation()},{capture:true});
    window.addEventListener('keydown',e=>{if(pendingInsert&&e.key==='Escape'){cancelPending(true);e.preventDefault();e.stopImmediatePropagation()}},{capture:true});
  }
  function installCommandHook(){
    if(typeof command!=='function'||command.__a4TemplateWrapped)return;
    const base=command;
    const wrapped=function(cmd){
      const c=String(cmd||'').trim().toUpperCase();
      if(c==='A4TPLSAVE'||c==='A4TS'){saveTemplate('selection');return}
      if(c==='A4TPLALL'||c==='A4TA'){saveTemplate('drawing');return}
      if(c==='A4TPLINSERT'||c==='A4TI'){startInsert();return}
      if(c==='A4FRAMESEL'||c==='A4FS'){const el=q('a4TemplateSelectFrameV0217');if(el){el.checked=!el.checked;el.dispatchEvent(new Event('change'))}return}
      if(c==='A4INSTSEL'||c==='A4IS'){selectInsertedInstance();return}
      if(c==='A4UPDATE'||c==='A4UP'){updateTemplateFromSelectedInstance();return}
      if(c==='A4REPLACE'||c==='A4RP'){replaceSelectedInstance();return}
      if(c==='A4LINKBLOCK'||c==='A4LB'){linkTemplateToSelectedBlock();return}
      return base.apply(this,arguments)
    };
    wrapped.__a4TemplateWrapped=true;
    command=wrapped;
  }
  const api={version:API_VERSION,schema:SCHEMA,getCatalog:()=>normalizeCatalog(deep(catalog)),saveSelection:()=>saveTemplate('selection'),saveDrawing:()=>saveTemplate('drawing'),insert:startInsert,cancel:cancelPending,refresh:renderList,toggleFrameSelection:()=>command('A4FRAMESEL'),selectInstance:selectInsertedInstance,updateFromInstance:updateTemplateFromSelectedInstance,replaceInstance:replaceSelectedInstance,linkBlock:linkTemplateToSelectedBlock};
  window.DwgSketchA4DiagramTemplateCoreV02114=api;
  const boot=()=>{installUi();installSelectionPassThroughHooks();installSessionHooks();installClipboardHooks();installInteractionHooks();installCommandHook()};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
  setTimeout(boot,1600);
})();
;
/* ===== END CONSOLIDATED SOURCE: a4-diagram-template-core-v02114.js ===== */

/* ===== BEGIN CONSOLIDATED SOURCE: electrical-automation-v0179.js ===== */
'use strict';
/* DWG Sketch PWA V0.17.9 - Direction-aware topology editor, learned templates and A4 automatic generation.
   Classic script loaded after index.html core so it can reuse the project model,
   vector symbol library, undo/redo, snapping and JSON/DXF pipelines. */

let electricalGridImportModel=null;
let electricalGridLayoutResult=null;
let electricalGridSourceName='';

const GRID_TYPE_ALIASES={
  BUSBAR:['BUSBAR','BUS','THANHCAI','THANH_CAI','TC','BUS_BAR'],
  CIRCUIT_BREAKER:['CIRCUIT_BREAKER','BREAKER','CB','MC','MAYCAT','MAY_CAT'],
  DISCONNECTOR:['DISCONNECTOR','DS','DCL','DAOCACHLY','DAO_CACH_LY'],
  EARTH_SWITCH:['EARTH_SWITCH','ES','DTĐ','DTD','DAOTIEPDIA','DAO_TIEP_DIA'],
  TRANSFORMER_2W:['TRANSFORMER_2W','TRANSFORMER','MBA','MBA2','TR2','MAYBIENAP','MAY_BIEN_AP'],
  TRANSFORMER_3W:['TRANSFORMER_3W','MBA3','TR3'],
  GENERATOR:['GENERATOR','GEN','MF','MAYPHAT','MAY_PHAT'],
  CAPACITOR:['CAPACITOR','CAP','TUBU','TU_BU'],
  REACTOR:['REACTOR','REACT','KHANG','KHANGDIEN','KHANG_DIEN'],
  LOAD:['LOAD','PHUTAI','PHU_TAI','TAI'],
  CT:['CT','BI','CURRENT_TRANSFORMER'],
  VT:['VT','BU','VOLTAGE_TRANSFORMER','PT'],
  GROUND:['GROUND','EARTH','GND','NOIDAT','NOI_DAT'],
  LINE:['LINE','DUONGDAY','DUONG_DAY','FEEDER','CABLE','CAP']
};

function gridFold(value){
  return String(value??'').trim().normalize('NFD').replace(/[\u0300-\u036f]/g,'')
    .replace(/đ/gi,'d').toUpperCase().replace(/[^A-Z0-9]+/g,'_').replace(/^_+|_+$/g,'');
}
function gridSymbolType(value){
  const key=gridFold(value||'CIRCUIT_BREAKER');
  for(const [type,names] of Object.entries(GRID_TYPE_ALIASES))if(names.some(x=>gridFold(x)===key))return type==='LINE'?'LOAD':type;
  return ELECTRICAL_SYMBOL_DEFS?.[key]?key:'CIRCUIT_BREAKER';
}
function gridText(row,...keys){
  for(const key of keys){
    if(row==null)continue;
    if(Object.prototype.hasOwnProperty.call(row,key)&&row[key]!=null&&String(row[key]).trim()!=='')return String(row[key]).trim();
    const wanted=gridFold(key);
    const found=Object.keys(row).find(k=>gridFold(k)===wanted);
    if(found&&row[found]!=null&&String(row[found]).trim()!=='')return String(row[found]).trim();
  }
  return '';
}
function gridNumber(row,keys,fallback=0){
  const value=gridText(row,...keys);if(value==='')return fallback;
  const parsed=Number(String(value).replace(',','.'));return Number.isFinite(parsed)?parsed:fallback;
}
function gridUniqueId(base,used){
  base=gridFold(base||'NODE').toLowerCase()||'node';let id=base,n=2;while(used.has(id))id=base+'-'+n++;used.add(id);return id;
}
function parseDelimitedLine(line,delimiter){
  const result=[];let value='',quoted=false;
  for(let i=0;i<line.length;i++){
    const c=line[i];
    if(c==='"'){
      if(quoted&&line[i+1]==='"'){value+='"';i++}else quoted=!quoted;
    }else if(c===delimiter&&!quoted){result.push(value.trim());value=''}else value+=c;
  }
  result.push(value.trim());return result;
}
function detectGridDelimiter(firstLine){
  const candidates=[',',';','\t','|'];let best=',',count=-1;
  for(const d of candidates){const n=parseDelimitedLine(firstLine,d).length;if(n>count){count=n;best=d}}
  return best;
}
function parseGridCsv(text){
  const lines=String(text||'').replace(/^\uFEFF/,'').split(/\r?\n/).filter(x=>x.trim()&&!x.trim().startsWith('#'));
  if(lines.length<2)throw new Error('CSV cần có dòng tiêu đề và ít nhất một dòng dữ liệu.');
  const delimiter=detectGridDelimiter(lines[0]),headers=parseDelimitedLine(lines[0],delimiter).map(x=>x.trim());
  return lines.slice(1).map(line=>{const values=parseDelimitedLine(line,delimiter),row={};headers.forEach((h,i)=>row[h]=values[i]??'');return row});
}
function gridDirection(value,fallback='down'){
  const key=gridFold(value);
  if(['DOWN','XUONG','VERTICAL_DOWN','DOC_XUONG'].includes(key))return'down';
  if(['UP','LEN','VERTICAL_UP','DOC_LEN'].includes(key))return'up';
  if(['RIGHT','PHAI','HORIZONTAL_RIGHT','NGANG_PHAI'].includes(key))return'right';
  if(['LEFT','TRAI','HORIZONTAL_LEFT','NGANG_TRAI'].includes(key))return'left';
  if(['ANGLE','CUSTOM','GOC','GOC_TUY_CHON'].includes(key))return'angle';
  if(['INHERIT','AUTO','THEO_CHUNG',''].includes(key))return fallback;
  return fallback;
}
function gridSymbolOrientation(value,fallback='follow'){
  const key=gridFold(value);
  if(['FOLLOW','THEO_HUONG','THEO_NHANH','AUTO'].includes(key))return'follow';
  if(['VERTICAL','DOC'].includes(key))return'vertical';
  if(['HORIZONTAL','NGANG'].includes(key))return'horizontal';
  if(['ANGLE','CUSTOM','GOC'].includes(key))return'angle';
  if(['INHERIT','THEO_CHUNG',''].includes(key))return fallback;
  return fallback;
}
function gridDirectionAngle(direction,customAngle=-90,legacyOrientation='vertical'){
  const d=gridDirection(direction,legacyOrientation==='horizontal'?'right':'down');
  return d==='up'?90:d==='right'?0:d==='left'?180:d==='angle'?num(customAngle,-90):-90;
}
function gridDirectionVector(angleDeg){const a=num(angleDeg)*Math.PI/180;return{x:Math.cos(a),y:Math.sin(a)}}
function gridPerpendicularVector(angleDeg){const a=num(angleDeg)*Math.PI/180;return{x:-Math.sin(a),y:Math.cos(a)}}
function gridDirectionalSpacing(angleDeg,spacingX,spacingY){const a=num(angleDeg)*Math.PI/180;return Math.abs(Math.cos(a))>=Math.abs(Math.sin(a))?{along:spacingX,across:spacingY}:{along:spacingY,across:spacingX}}
function gridLegacyOrientation(direction){return['right','left'].includes(direction)?'horizontal':direction==='angle'?'angle':'vertical'}
function gridSymbolRotation(node,globalMode,globalOffset,flowAngle){
  if(Number.isFinite(node.rotationDeg))return((node.rotationDeg%360)+360)%360;
  const mode=gridSymbolOrientation(node.symbolOrientation,gridSymbolOrientation(globalMode,'follow'));
  const base=mode==='vertical'?0:mode==='horizontal'?90:mode==='angle'?0:flowAngle+90;
  return((base+num(globalOffset)+num(node.symbolAngleOffsetDeg))%360+360)%360;
}
function gridConnectionRoute(a,b,flowAngle){
  const f=gridDirectionVector(flowAngle),c=gridPerpendicularVector(flowAngle),dx=b.x-a.x,dy=b.y-a.y,along=dx*f.x+dy*f.y,cross=dx*c.x+dy*c.y,half=along/2;
  return compactPolyline([a,{x:a.x+f.x*half,y:a.y+f.y*half},{x:a.x+f.x*half+c.x*cross,y:a.y+f.y*half+c.y*cross},b]);
}
function normalizeGridConnection(raw,index=0){
  const from=gridText(raw,'fromNodeId','fromNode','from','source','tu','đầu nối 1','dau noi 1');
  const to=gridText(raw,'toNodeId','toNode','to','target','den','đầu nối 2','dau noi 2');
  if(!from||!to||from===to)return null;
  return{
    id:gridText(raw,'id','connectionId','ma')||`edge-${index+1}`,
    fromNodeId:from,toNodeId:to,
    fromPort:gridText(raw,'fromPort','sourcePort','cong tu','cổng từ')||'',
    toPort:gridText(raw,'toPort','targetPort','cong den','cổng đến')||'',
    status:gridText(raw,'status','trang thai','trạng thái')||'',
    label:gridText(raw,'label','name','ten','tên')||'',
    directionMode:gridDirection(gridText(raw,'directionMode','layoutDirection','direction','huong','hướng'),'inherit'),
    angleDeg:gridNumber(raw,['angleDeg','layoutAngleDeg','directionAngleDeg','goc huong','góc hướng'],NaN)
  };
}
function normalizeGridNode(raw,index,used){
  let id=gridText(raw,'id','nodeId','deviceId','ma','mã','ky hieu','ký hiệu');
  const label=gridText(raw,'label','name','deviceName','ten','tên','thiet bi','thiết bị')||id||`Thiết bị ${index+1}`;
  if(!id)id=label;
  const stable=gridUniqueId(id,used);
  return{
    id:stable,
    sourceId:id,
    type:gridSymbolType(gridText(raw,'type','symbolType','deviceType','loai','loại')),
    label,
    station:gridText(raw,'station','substation','tram','trạm'),
    voltageLevel:gridText(raw,'voltageLevel','voltage','kv','cap dien ap','cấp điện áp'),
    bus:gridText(raw,'bus','busId','thanh cai','thanh cái'),
    parent:gridText(raw,'parent','parentId','upstream','cap tren','cấp trên'),
    order:gridNumber(raw,['order','sequence','thu tu','thứ tự'],index),
    x:gridNumber(raw,['x'],NaN),y:gridNumber(raw,['y'],NaN),
    scale:gridNumber(raw,['scale','ty le','tỷ lệ'],1),
    rotationDeg:gridNumber(raw,['rotationDeg','rotation','goc','góc'],NaN),
    layoutDirection:gridDirection(gridText(raw,'layoutDirection','direction','branchDirection','huong nhanh','hướng nhánh','hướng bố trí'),'inherit'),
    layoutAngleDeg:gridNumber(raw,['layoutAngleDeg','directionAngleDeg','goc huong','góc hướng'],NaN),
    symbolOrientation:gridSymbolOrientation(gridText(raw,'symbolOrientation','orientationMode','tu the ky hieu','tư thế ký hiệu'),'inherit'),
    symbolAngleOffsetDeg:gridNumber(raw,['symbolAngleOffsetDeg','rotationOffsetDeg','goc lech ky hieu','góc lệch ký hiệu'],0),
    raw
  };
}
function normalizeElectricalGridData(data){
  const rawNodes=Array.isArray(data)?data:(Array.isArray(data?.nodes)?data.nodes:Array.isArray(data?.devices)?data.devices:Array.isArray(data?.equipment)?data.equipment:[]);
  const rawConnections=Array.isArray(data?.connections)?data.connections:Array.isArray(data?.links)?data.links:Array.isArray(data?.edges)?data.edges:[];
  const used=new Set(),nodes=[],idLookup=new Map();
  rawNodes.forEach((raw,index)=>{
    const node=normalizeGridNode(raw,index,used);nodes.push(node);
    for(const key of [node.id,node.sourceId,node.label].filter(Boolean))if(!idLookup.has(gridFold(key)))idLookup.set(gridFold(key),node.id);
  });
  if(!nodes.length)throw new Error('Không tìm thấy danh sách thiết bị/nút trong dữ liệu.');
  const resolveId=value=>idLookup.get(gridFold(value))||String(value||'').trim();
  const connections=[];
  rawConnections.forEach((raw,index)=>{const c=normalizeGridConnection(raw,index);if(c){c.fromNodeId=resolveId(c.fromNodeId);c.toNodeId=resolveId(c.toNodeId);connections.push(c)}});
  // CSV can keep edge columns on the same device row.
  rawNodes.forEach((raw,index)=>{
    const direct=normalizeGridConnection(raw,rawConnections.length+index);
    if(direct){direct.fromNodeId=resolveId(direct.fromNodeId);direct.toNodeId=resolveId(direct.toNodeId);connections.push(direct)}
  });
  // Parent/bus fields are convenient for feeder-style tables.
  for(const node of nodes){
    const upstream=node.parent||node.bus;if(!upstream)continue;
    const from=resolveId(upstream);if(from&&from!==node.id&&nodes.some(n=>n.id===from))connections.push({id:`auto-${from}-${node.id}`,fromNodeId:from,toNodeId:node.id,fromPort:'',toPort:'',status:'',label:'',inferredFromTable:true});
  }
  const nodeIds=new Set(nodes.map(n=>n.id)),seen=new Set(),validConnections=[];
  for(const c of connections){
    if(!nodeIds.has(c.fromNodeId)||!nodeIds.has(c.toNodeId)||c.fromNodeId===c.toNodeId)continue;
    const key=[c.fromNodeId,c.fromPort,c.toNodeId,c.toPort].join('|');
    const reverse=[c.toNodeId,c.toPort,c.fromNodeId,c.fromPort].join('|');
    if(seen.has(key)||seen.has(reverse))continue;seen.add(key);validConnections.push(c);
  }
  return{
    schema:'dwg-sketch-electrical-topology',schemaVersion:3,
    name:gridText(data||{},'name','title','ten','tên')||'Sơ đồ lưới điện',
    nodes,connections:validConnections,
    layout:{orientation:gridText(data?.layout||{},'orientation')||'vertical',directionMode:gridDirection(gridText(data?.layout||{},'directionMode','direction','flowDirection','huong','hướng'),gridText(data?.layout||{},'orientation')==='horizontal'?'right':'down'),layoutAngleDeg:num(data?.layout?.layoutAngleDeg??data?.layout?.angleDeg,-90),symbolOrientation:gridSymbolOrientation(gridText(data?.layout||{},'symbolOrientation','symbolAxis','tu the ky hieu','tư thế ký hiệu'),'follow'),symbolAngleOffsetDeg:num(data?.layout?.symbolAngleOffsetDeg??data?.layout?.rotationOffsetDeg,0),spacingX:num(data?.layout?.spacingX,90),spacingY:num(data?.layout?.spacingY,85)}
  };
}
function parseElectricalGridText(text,fileName=''){
  const trimmed=String(text||'').trim();if(!trimmed)throw new Error('Dữ liệu trống.');
  if(/\.json$/i.test(fileName)||trimmed.startsWith('{')||trimmed.startsWith('['))return normalizeElectricalGridData(JSON.parse(trimmed));
  return normalizeElectricalGridData(parseGridCsv(trimmed));
}
function electricalGridRootPoint(){
  const mode=$('gridOriginMode')?.value||'view';
  if(mode==='frame'&&validBounds(project?.exportRegion)){const b=normalizeBounds(project.exportRegion);return{x:(b.minX+b.maxX)/2,y:b.maxY-Math.max(20,num($('gridSpacingY')?.value,85)*.4)}}
  if(mode==='custom')return{x:num($('gridOriginX')?.value,0),y:num($('gridOriginY')?.value,0)};
  // Bản vẽ trắng chưa có hình học có thể chưa có phép biến đổi màn hình ổn định.
  if((entities?.length||0)+(overlays?.length||0)===0&&validBounds(project?.drawingBounds)){
    const b=normalizeBounds(project.drawingBounds);return{x:(b.minX+b.maxX)/2,y:(b.minY+b.maxY)/2};
  }
  const p=world(canvas.width/(2*dpr),canvas.height/(2*dpr));
  if(Number.isFinite(p.x)&&Number.isFinite(p.y))return p;
  if(validBounds(project?.drawingBounds)){const b=normalizeBounds(project.drawingBounds);return{x:(b.minX+b.maxX)/2,y:(b.minY+b.maxY)/2}}
  return{x:0,y:0};
}
function gridTypePriority(type){return({BUSBAR:0,DISCONNECTOR:1,CIRCUIT_BREAKER:2,CT:3,VT:3,TRANSFORMER_2W:4,TRANSFORMER_3W:4,GENERATOR:5,CAPACITOR:5,REACTOR:5,LOAD:6,GROUND:7}[type]??5)}
function layoutElectricalGrid(model,options={}){
  const nodes=model.nodes.map(n=>({...n})),connections=model.connections.map(c=>({...c})),map=new Map(nodes.map(n=>[n.id,n]));
  const outgoing=new Map(nodes.map(n=>[n.id,[]])),incoming=new Map(nodes.map(n=>[n.id,[]])),outgoingEdges=new Map(nodes.map(n=>[n.id,[]])),incomingEdges=new Map(nodes.map(n=>[n.id,[]])),undirected=new Map(nodes.map(n=>[n.id,[]]));
  for(const c of connections){if(!map.has(c.fromNodeId)||!map.has(c.toNodeId))continue;outgoing.get(c.fromNodeId).push(c.toNodeId);incoming.get(c.toNodeId).push(c.fromNodeId);outgoingEdges.get(c.fromNodeId).push(c);incomingEdges.get(c.toNodeId).push(c);undirected.get(c.fromNodeId).push(c.toNodeId);undirected.get(c.toNodeId).push(c.fromNodeId)}
  const rank=new Map(),queue=[];
  const roots=nodes.filter(n=>n.type==='BUSBAR'&&!incoming.get(n.id).length).sort((a,b)=>a.order-b.order||a.label.localeCompare(b.label,'vi'));
  for(const n of nodes.filter(n=>!incoming.get(n.id).length&&!roots.includes(n)))roots.push(n);
  if(!roots.length&&nodes[0])roots.push(nodes[0]);
  for(const r of roots){if(rank.has(r.id))continue;rank.set(r.id,0);queue.push(r.id)}
  while(queue.length){const id=queue.shift(),base=rank.get(id);for(const child of outgoing.get(id)||[]){const next=base+1;if(!rank.has(child)||next<rank.get(child)){rank.set(child,next);queue.push(child)}}}
  let componentOffset=Math.max(0,...rank.values())+1;
  for(const start of nodes){if(rank.has(start.id))continue;rank.set(start.id,componentOffset);queue.push(start.id);while(queue.length){const id=queue.shift(),base=rank.get(id);for(const next of undirected.get(id)||[])if(!rank.has(next)){rank.set(next,base+1);queue.push(next)}}componentOffset=Math.max(...rank.values())+1}
  const levels=new Map();for(const n of nodes){const r=rank.get(n.id)||0;if(!levels.has(r))levels.set(r,[]);levels.get(r).push(n)}
  const sortedRanks=[...levels.keys()].sort((a,b)=>a-b),positionIndex=new Map();
  for(const r of sortedRanks){const list=levels.get(r);list.sort((a,b)=>{
    const pa=(incoming.get(a.id)||[]).map(x=>positionIndex.get(x)).filter(Number.isFinite),pb=(incoming.get(b.id)||[]).map(x=>positionIndex.get(x)).filter(Number.isFinite);
    const ba=pa.length?pa.reduce((s,x)=>s+x,0)/pa.length:Infinity,bb=pb.length?pb.reduce((s,x)=>s+x,0)/pb.length:Infinity;
    return ba-bb||a.order-b.order||gridTypePriority(a.type)-gridTypePriority(b.type)||a.label.localeCompare(b.label,'vi');
  });list.forEach((n,i)=>positionIndex.set(n.id,i))}
  const modelLayout=model.layout||{},directionMode=gridDirection(options.directionMode||options.orientation||modelLayout.directionMode,modelLayout.orientation==='horizontal'?'right':'down'),layoutAngleDeg=num(options.layoutAngleDeg,modelLayout.layoutAngleDeg??-90),flowAngle=gridDirectionAngle(directionMode,layoutAngleDeg,modelLayout.orientation),spacingX=Math.max(35,num(options.spacingX,modelLayout.spacingX??90)),spacingY=Math.max(35,num(options.spacingY,modelLayout.spacingY??85)),spacing=gridDirectionalSpacing(flowAngle,spacingX,spacingY),origin=options.origin||{x:0,y:0},baseScale=Math.max(.2,num(options.scale,1)),forward=gridDirectionVector(flowAngle),across=gridPerpendicularVector(flowAngle),globalSymbolOrientation=gridSymbolOrientation(options.symbolOrientation||modelLayout.symbolOrientation,'follow'),globalSymbolAngleOffsetDeg=num(options.symbolAngleOffsetDeg,modelLayout.symbolAngleOffsetDeg??0),nodeFlowAngles=new Map(nodes.map(n=>[n.id,flowAngle]));
  for(const r of sortedRanks){const list=levels.get(r);for(let i=0;i<list.length;i++){
    const n=list[i],cross=i-(list.length-1)/2;
    n.position={x:origin.x+forward.x*r*spacing.along+across.x*cross*spacing.across,y:origin.y+forward.y*r*spacing.along+across.y*cross*spacing.across};
    if(Number.isFinite(n.x)&&Number.isFinite(n.y)&&options.keepCoordinates)n.position={x:n.x,y:n.y};
    const degree=(undirected.get(n.id)||[]).length;n.symbolScale=Math.max(.2,num(n.scale,baseScale));
    if(n.type==='BUSBAR')n.symbolScale=Math.max(n.symbolScale,Math.min(12,Math.max(1,degree*.72*spacing.across/60)));
    n.labelRotationDeg=0;n.rank=r;
  }}
  // V0.17.8: hướng cục bộ truyền theo cây chính. Ưu tiên: liên kết > phần tử > nhánh cha > toàn sơ đồ.
  const primaryIncoming=new Map();
  for(const child of nodes){const primary=[...(incomingEdges.get(child.id)||[])].sort((a,b)=>(map.get(a.fromNodeId)?.rank??1e9)-(map.get(b.fromNodeId)?.rank??1e9)||(map.get(a.fromNodeId)?.order??1e9)-(map.get(b.fromNodeId)?.order??1e9)||String(a.id).localeCompare(String(b.id)))[0];if(primary)primaryIncoming.set(child.id,primary)}
  // Nút gốc có thể đặt hướng riêng; hướng đó được truyền cho các phần tử inherit phía sau.
  for(const rootNode of nodes.filter(n=>!primaryIncoming.has(n.id))){const rootRule=gridDirection(rootNode.layoutDirection,'inherit');if(rootRule!=='inherit')nodeFlowAngles.set(rootNode.id,gridDirectionAngle(rootRule,Number.isFinite(rootNode.layoutAngleDeg)?rootNode.layoutAngleDeg:layoutAngleDeg,modelLayout.orientation))}
  for(const parent of [...nodes].sort((a,b)=>a.rank-b.rank||a.order-b.order)){
    const groups=new Map(),parentAngle=nodeFlowAngles.get(parent.id)??flowAngle;
    for(const edge of outgoingEdges.get(parent.id)||[]){const child=map.get(edge.toNodeId);if(!child||primaryIncoming.get(child.id)!==edge||options.keepCoordinates&&Number.isFinite(child.x)&&Number.isFinite(child.y))continue;const edgeRule=gridDirection(edge.directionMode,'inherit'),nodeRule=gridDirection(child.layoutDirection,'inherit'),rule=edgeRule!=='inherit'?edgeRule:nodeRule,custom=Number.isFinite(edge.angleDeg)?edge.angleDeg:Number.isFinite(child.layoutAngleDeg)?child.layoutAngleDeg:layoutAngleDeg,angle=rule==='inherit'?parentAngle:gridDirectionAngle(rule,custom,modelLayout.orientation),mustReposition=rule!=='inherit'||Math.abs((((angle-flowAngle)%360)+540)%360-180)>1e-8;if(!mustReposition)continue;const key=(((angle%360)+360)%360).toFixed(6);if(!groups.has(key))groups.set(key,[]);groups.get(key).push({edge,child,angle})}
    for(const items0 of groups.values()){const items=items0.sort((a,b)=>a.child.order-b.child.order||a.child.label.localeCompare(b.child.label,'vi')),angle=items[0].angle,f=gridDirectionVector(angle),c=gridPerpendicularVector(angle),step=gridDirectionalSpacing(angle,spacingX,spacingY);items.forEach((it,i)=>{const cross=i-(items.length-1)/2;it.child.position={x:parent.position.x+f.x*step.along+c.x*cross*step.across,y:parent.position.y+f.y*step.along+c.y*cross*step.across};nodeFlowAngles.set(it.child.id,angle)})}
  }
  for(const n of nodes){n.flowAngleDeg=nodeFlowAngles.get(n.id)??flowAngle;n.rotationDeg=gridSymbolRotation(n,globalSymbolOrientation,globalSymbolAngleOffsetDeg,n.flowAngleDeg)}
  return{...model,nodes,connections,layout:{orientation:gridLegacyOrientation(directionMode),directionMode,layoutAngleDeg,symbolOrientation:globalSymbolOrientation,symbolAngleOffsetDeg:globalSymbolAngleOffsetDeg,spacingX,spacingY,origin,keepCoordinates:!!options.keepCoordinates}};
}
function electricalGridNodeEntity(node,options){
  return{type:'SYMBOL',symbolType:node.type,label:node.label||node.id,position:point(node.position),symbolScale:Math.max(.2,num(node.symbolScale,1)),rotationDeg:num(node.rotationDeg,0),labelRotationDeg:num(node.labelRotationDeg,0),automationId:node.id,autoGeneratedElectrical:true,electricalStation:node.station||'',electricalVoltageLevel:node.voltageLevel||'',layoutDirection:gridDirection(node.layoutDirection,'inherit'),layoutAngleDeg:Number.isFinite(node.layoutAngleDeg)?node.layoutAngleDeg:null,symbolOrientation:gridSymbolOrientation(node.symbolOrientation,'inherit'),symbolAngleOffsetDeg:num(node.symbolAngleOffsetDeg,0),flowAngleDeg:num(node.flowAngleDeg,-90),color:hexToArgb(options.color||'#ffffff'),stroke:Math.max(.2,num(options.stroke,2))};
}
function electricalGridAttachPoint(entity,target,preferredPort=''){
  const ports=symbolPorts(entity);if(preferredPort){const exact=ports.find(p=>gridFold(p.name)===gridFold(preferredPort));if(exact)return exact.point}
  if(entity.symbolType==='BUSBAR'){
    const c=point(entity.position),half=30*num(entity.symbolScale,1),a=num(entity.rotationDeg)*Math.PI/180,dx=Math.cos(a),dy=Math.sin(a),vx=target.x-c.x,vy=target.y-c.y,t=Math.max(-half,Math.min(half,vx*dx+vy*dy));return{x:c.x+dx*t,y:c.y+dy*t};
  }
  return ports.reduce((best,p)=>!best||dist(p.point,target)<dist(best.point,target)?p:best,null)?.point||point(entity.position);
}
function compactPolyline(points){const out=[];for(const p of points){if(!out.length||dist(out.at(-1),p)>1e-8)out.push(point(p))}for(let i=1;i<out.length-1;){const a=out[i-1],b=out[i],c=out[i+1],cross=Math.abs((b.x-a.x)*(c.y-b.y)-(b.y-a.y)*(c.x-b.x));if(cross<1e-8){out.splice(i,1)}else i++}return out}
function buildElectricalGridOverlays(layoutResult,options){
  const symbols=layoutResult.nodes.map(n=>electricalGridNodeEntity(n,options)),byId=new Map(symbols.map(e=>[e.automationId,e])),wires=[];
  for(let i=0;i<layoutResult.connections.length;i++){
    const c=layoutResult.connections[i],from=byId.get(c.fromNodeId),to=byId.get(c.toNodeId);if(!from||!to)continue;
    const a=electricalGridAttachPoint(from,point(to.position),c.fromPort),b=electricalGridAttachPoint(to,point(from.position),c.toPort),targetNode=layoutResult.nodes.find(n=>n.id===c.toNodeId),rule=gridDirection(c.directionMode,'inherit'),angle=rule==='inherit'?num(targetNode?.flowAngleDeg,layoutResult.layout.layoutAngleDeg):gridDirectionAngle(rule,Number.isFinite(c.angleDeg)?c.angleDeg:Number.isFinite(targetNode?.layoutAngleDeg)?targetNode.layoutAngleDeg:layoutResult.layout.layoutAngleDeg,layoutResult.layout.orientation),points=gridConnectionRoute(a,b,angle);
    wires.push({type:'POLYLINE',points,closed:false,autoGeneratedElectrical:true,automationRole:'CONNECTION',automationConnectionId:c.id||`edge-${i+1}`,automationFromNodeId:c.fromNodeId,automationToNodeId:c.toNodeId,directionMode:gridDirection(c.directionMode,'inherit'),angleDeg:Number.isFinite(c.angleDeg)?c.angleDeg:null,color:hexToArgb(options.connectionColor||options.color||'#ffffff'),stroke:Math.max(.2,num(options.connectionStroke,options.stroke||2))});
  }
  return{symbols,wires,all:[...wires,...symbols]};
}
function renderElectricalGridPreview(result){
  const host=$('gridAutomationPreview');if(!host)return;
  if(!result?.nodes?.length){host.innerHTML='<div class="muted">Chưa có bố trí xem trước.</div>';return}
  const xs=result.nodes.map(n=>n.position.x),ys=result.nodes.map(n=>n.position.y),minX=Math.min(...xs),maxX=Math.max(...xs),minY=Math.min(...ys),maxY=Math.max(...ys),pad=50,w=Math.max(260,maxX-minX+pad*2),h=Math.max(180,maxY-minY+pad*2),sx0=x=>x-minX+pad,sy0=y=>maxY-y+pad,nodeMap=new Map(result.nodes.map(n=>[n.id,n]));
  const edges=result.connections.map(c=>{const a=nodeMap.get(c.fromNodeId),b=nodeMap.get(c.toNodeId);if(!a||!b)return'';return`<path d="M ${sx0(a.position.x)} ${sy0(a.position.y)} L ${sx0(b.position.x)} ${sy0(b.position.y)}"/>`}).join('');
  const nodes=result.nodes.map(n=>{const x=sx0(n.position.x),y=sy0(n.position.y),shape=n.type==='BUSBAR'?`<line x1="${x-25}" y1="${y}" x2="${x+25}" y2="${y}" class="bus"/>`:`<rect x="${x-8}" y="${y-8}" width="16" height="16" rx="3"/>`;return`<g>${shape}<text x="${x}" y="${y-13}">${escapeHtml(n.label||n.id)}</text></g>`}).join('');
  host.innerHTML=`<svg viewBox="0 0 ${w} ${h}" role="img" aria-label="Xem trước sơ đồ lưới điện"><g class="edges">${edges}</g><g class="nodes">${nodes}</g></svg>`;
}
function updateElectricalGridStatus(message,kind=''){
  const box=$('gridAutomationStatus');if(!box)return;box.textContent=message;box.className='muted grid-automation-status'+(kind?' '+kind:'');
}
function prepareElectricalGridLayout(){
  if(!electricalGridImportModel){updateElectricalGridStatus('Chưa nạp dữ liệu topology/CSV.','error');return null}
  const options={directionMode:$('gridOrientation')?.value||electricalGridImportModel?.layout?.directionMode||'down',layoutAngleDeg:num($('gridLayoutAngle')?.value,electricalGridImportModel?.layout?.layoutAngleDeg??-90),symbolOrientation:$('gridSymbolOrientation')?.value||electricalGridImportModel?.layout?.symbolOrientation||'follow',symbolAngleOffsetDeg:num($('gridSymbolAngleOffset')?.value,electricalGridImportModel?.layout?.symbolAngleOffsetDeg??0),spacingX:num($('gridSpacingX')?.value,90),spacingY:num($('gridSpacingY')?.value,85),scale:num($('gridSymbolScale')?.value,1),origin:electricalGridRootPoint(),keepCoordinates:$('gridKeepCoordinates')?.checked===true};
  electricalGridLayoutResult=layoutElectricalGrid(electricalGridImportModel,options);
  if($('gridFitA4')?.checked===true) electricalGridLayoutResult=fitElectricalLayoutToA4(electricalGridLayoutResult,true);
  renderElectricalGridPreview(electricalGridLayoutResult);
  const components=countElectricalGridComponents(electricalGridLayoutResult);
  updateElectricalGridStatus(`Đã bố trí xem trước ${electricalGridLayoutResult.nodes.length} thiết bị, ${electricalGridLayoutResult.connections.length} liên kết, ${components} thành phần mạng.`, 'success');
  return electricalGridLayoutResult;
}
function countElectricalGridComponents(model){
  const adj=new Map(model.nodes.map(n=>[n.id,[]]));for(const c of model.connections){adj.get(c.fromNodeId)?.push(c.toNodeId);adj.get(c.toNodeId)?.push(c.fromNodeId)}let count=0;const seen=new Set();for(const n of model.nodes){if(seen.has(n.id))continue;count++;const q=[n.id];seen.add(n.id);while(q.length)for(const x of adj.get(q.shift())||[])if(!seen.has(x)){seen.add(x);q.push(x)}}return count;
}
function generateElectricalGridDrawing(){
  if(!project){alert('Hãy mở hoặc tạo một bản vẽ trước.');return}
  const layoutResult=prepareElectricalGridLayout();if(!layoutResult)return;
  if(layoutResult.nodes.length>1500&&!confirm(`Dữ liệu có ${layoutResult.nodes.length} thiết bị và ${layoutResult.connections.length} liên kết. Tiếp tục tạo sơ đồ lớn?`))return;
  const options={color:$('gridObjectColor')?.value||'#ffffff',connectionColor:$('gridConnectionColor')?.value||'#ffb74d',stroke:num($('newStroke')?.value,2),connectionStroke:num($('gridConnectionStroke')?.value,1.5)};
  const generated=buildElectricalGridOverlays(layoutResult,options),clearOld=$('gridClearPrevious')?.checked!==false;
  simpleAction('Đã tự động tạo sơ đồ lưới điện',()=>{
    if(clearOld)overlays=overlays.filter(e=>!e.autoGeneratedElectrical);
    overlays.push(...generated.all);
    selected=generated.symbols.map(e=>refFor(e,'overlay'));
    const model=ensureAutomationModel(),symbolById=new Map(generated.symbols.map(e=>[e.automationId,e]));model.schemaVersion=3;model.name=layoutResult.name;model.nodes=layoutResult.nodes.map(n=>{const symbol=symbolById.get(n.id);return{id:n.id,type:n.type,label:n.label,station:n.station,voltageLevel:n.voltageLevel,position:point(n.position),scale:n.symbolScale,rotationDeg:n.rotationDeg,layoutDirection:gridDirection(n.layoutDirection,'inherit'),layoutAngleDeg:Number.isFinite(n.layoutAngleDeg)?n.layoutAngleDeg:null,flowAngleDeg:num(n.flowAngleDeg,-90),symbolOrientation:gridSymbolOrientation(n.symbolOrientation,'inherit'),symbolAngleOffsetDeg:num(n.symbolAngleOffsetDeg,0),ports:symbol?symbolPorts(symbol).map(p=>({name:p.name,x:p.point.x,y:p.point.y})):[]}});model.connections=layoutResult.connections.map(c=>({id:c.id,fromNodeId:c.fromNodeId,toNodeId:c.toNodeId,fromPort:c.fromPort||'',toPort:c.toPort||'',status:c.status||'',label:c.label||'',directionMode:gridDirection(c.directionMode,'inherit'),angleDeg:Number.isFinite(c.angleDeg)?c.angleDeg:null}));model.layout=clone(layoutResult.layout);
  });
  fitView();updateElectricalGridStatus(`Đã tạo ${generated.symbols.length} ký hiệu và ${generated.wires.length} tuyến nối. Có thể chọn, MOVE, SCALE, sửa nhãn, lưu JSON và xuất DXF.`, 'success');
}
function applyElectricalGridLayoutSettings(model){const l=model?.layout||{};if($('gridOrientation'))$('gridOrientation').value=gridDirection(l.directionMode,l.orientation==='horizontal'?'right':'down');if($('gridLayoutAngle'))$('gridLayoutAngle').value=num(l.layoutAngleDeg,-90);if($('gridSymbolOrientation'))$('gridSymbolOrientation').value=gridSymbolOrientation(l.symbolOrientation,'follow');if($('gridSymbolAngleOffset'))$('gridSymbolAngleOffset').value=num(l.symbolAngleOffsetDeg,0);if($('gridSpacingX'))$('gridSpacingX').value=num(l.spacingX,90);if($('gridSpacingY'))$('gridSpacingY').value=num(l.spacingY,85)}
async function loadElectricalGridFile(file){
  if(!file)return;const text=await file.text();electricalGridImportModel=parseElectricalGridText(text,file.name);electricalGridSourceName=file.name;applyElectricalGridLayoutSettings(electricalGridImportModel);electricalGridLayoutResult=null;renderElectricalGridPreview(null);updateElectricalGridStatus(`Đã đọc ${file.name}: ${electricalGridImportModel.nodes.length} thiết bị, ${electricalGridImportModel.connections.length} liên kết. Bấm “Xem trước bố trí”.`,'success');
}
function gridAutomationOpenFile(){$('gridTopologyInput')?.click()}
function gridAutomationPreview(){return prepareElectricalGridLayout()}
function gridAutomationGenerate(){return generateElectricalGridDrawing()}
function gridAutomationLoadSample(){
  electricalGridImportModel=normalizeElectricalGridData({schema:'dwg-sketch-electrical-topology',schemaVersion:3,name:'Mẫu định hướng nhiều nhánh',layout:{directionMode:'down',layoutAngleDeg:-90,symbolOrientation:'follow',spacingX:100,spacingY:82},nodes:[
    {id:'BUS110',type:'BUSBAR',label:'Thanh cái 110 kV',order:1},
    {id:'DCL131',type:'DISCONNECTOR',label:'DCL 131-1',order:2},
    {id:'MC131',type:'CIRCUIT_BREAKER',label:'MC 131',order:3},
    {id:'MBA_T1',type:'TRANSFORMER_2W',label:'MBA T1',order:4},
    {id:'BUS35',type:'BUSBAR',label:'Thanh cái 35 kV',order:5},
    {id:'MC371',type:'CIRCUIT_BREAKER',label:'MC 371',order:6,layoutDirection:'right'},
    {id:'LOAD371',type:'LOAD',label:'ĐZ 371',order:7},
    {id:'MC372',type:'CIRCUIT_BREAKER',label:'MC 372',order:8,layoutDirection:'left'},
    {id:'LOAD372',type:'LOAD',label:'ĐZ 372',order:9},
    {id:'DIESEL',type:'GENERATOR',label:'Diesel dự phòng',order:10,layoutDirection:'angle',layoutAngleDeg:35,symbolOrientation:'horizontal',symbolAngleOffsetDeg:10}
  ],connections:[
    {id:'E1',fromNodeId:'BUS110',toNodeId:'DCL131'},
    {id:'E2',fromNodeId:'DCL131',toNodeId:'MC131'},
    {id:'E3',fromNodeId:'MC131',toNodeId:'MBA_T1'},
    {id:'E4',fromNodeId:'MBA_T1',toNodeId:'BUS35'},
    {id:'E5',fromNodeId:'BUS35',toNodeId:'MC371'},
    {id:'E6',fromNodeId:'MC371',toNodeId:'LOAD371'},
    {id:'E7',fromNodeId:'BUS35',toNodeId:'MC372'},
    {id:'E8',fromNodeId:'MC372',toNodeId:'LOAD372'},
    {id:'E9',fromNodeId:'BUS35',toNodeId:'DIESEL',directionMode:'angle',angleDeg:35}
  ]});
  electricalGridSourceName='Dữ liệu mẫu định hướng';applyElectricalGridLayoutSettings(electricalGridImportModel);electricalGridLayoutResult=null;updateElectricalGridStatus(`Đã nạp mẫu định hướng: ${electricalGridImportModel.nodes.length} thiết bị, ${electricalGridImportModel.connections.length} liên kết.`,'success');prepareElectricalGridLayout();
}

function exportNormalizedElectricalGrid(){
  if(!electricalGridImportModel){updateElectricalGridStatus('Chưa có dữ liệu để xuất.','error');return}
  const payload=electricalGridLayoutResult||electricalGridImportModel,blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json;charset=utf-8'}),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=(electricalGridSourceName||'electrical_grid').replace(/\.[^.]+$/,'')+'_normalized.topology.json';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);
}

const ELECTRICAL_DIAGRAM_TEMPLATE_KEY='DwgSketchPwa.ElectricalDiagramTemplates.V1';
let topologyEditorModel=null;
let learnedElectricalTemplates=[];

function deepGridClone(value){return JSON.parse(JSON.stringify(value))}
function safeIdText(value){return String(value??'').replace(/[<>"'&]/g,c=>({'<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;','&':'&amp;'}[c]))}
function gridViewCenter(){
  const itemCount=(entities?.length||0)+(overlays?.length||0);
  if(itemCount===0){
    if(validBounds(project?.drawingBounds)){const b=normalizeBounds(project.drawingBounds);return{x:(b.minX+b.maxX)/2,y:(b.minY+b.maxY)/2}}
    return{x:0,y:0};
  }
  const p=world(canvas.width/(2*dpr),canvas.height/(2*dpr));
  return Number.isFinite(p.x)&&Number.isFinite(p.y)?p:{x:0,y:0};
}
function electricalA4Frame(create=false){
  if(validBounds(project?.exportRegion)&&$('gridReuseFrame')?.checked!==false)return normalizeBounds(project.exportRegion);
  const landscape=$('gridA4Orientation')?.value==='landscape',paperW=landscape?297:210,paperH=landscape?210:297;
  const drawingWidth=Math.max(20,num($('gridA4Width')?.value,paperW));
  const drawingHeight=drawingWidth*paperH/paperW;
  const center=gridViewCenter();
  const bounds={minX:center.x-drawingWidth/2,maxX:center.x+drawingWidth/2,minY:center.y-drawingHeight/2,maxY:center.y+drawingHeight/2};
  if(create&&project){project.exportRegion={...bounds};if($('frameCheck'))$('frameCheck').checked=true;recalcBounds();scheduleWorkspaceSave?.(250);draw()}
  return bounds;
}
function electricalA4InnerBounds(create=false){
  const frame=electricalA4Frame(create),landscape=$('gridA4Orientation')?.value==='landscape',paperW=landscape?297:210;
  const marginMm=Math.max(0,Math.min(80,num($('gridA4Margin')?.value,12))),margin=(frame.maxX-frame.minX)*marginMm/paperW;
  return{minX:frame.minX+margin,maxX:frame.maxX-margin,minY:frame.minY+margin,maxY:frame.maxY-margin};
}
function fitElectricalLayoutToA4(result,createFrame=false){
  if(!result?.nodes?.length)return result;
  const inner=electricalA4InnerBounds(createFrame&&$('gridCreateFrame')?.checked!==false),xs=result.nodes.map(n=>n.position.x),ys=result.nodes.map(n=>n.position.y);
  const minX=Math.min(...xs),maxX=Math.max(...xs),minY=Math.min(...ys),maxY=Math.max(...ys),sourceW=Math.max(1e-6,maxX-minX),sourceH=Math.max(1e-6,maxY-minY),targetW=Math.max(1e-6,inner.maxX-inner.minX),targetH=Math.max(1e-6,inner.maxY-inner.minY);
  const factor=Math.min(targetW/sourceW,targetH/sourceH),srcCenter={x:(minX+maxX)/2,y:(minY+maxY)/2},dstCenter={x:(inner.minX+inner.maxX)/2,y:(inner.minY+inner.maxY)/2};
  for(const n of result.nodes){n.position={x:dstCenter.x+(n.position.x-srcCenter.x)*factor,y:dstCenter.y+(n.position.y-srcCenter.y)*factor};n.symbolScale=Math.max(.08,num(n.symbolScale,1)*Math.min(1.5,factor))}
  result.layout={...(result.layout||{}),fitPaper:'A4',paperOrientation:$('gridA4Orientation')?.value||'portrait',paperFrame:electricalA4Frame(false),paperMarginMm:num($('gridA4Margin')?.value,12),fitScale:factor};
  return result;
}
function currentTopologyForEditor(){
  if(electricalGridImportModel)return deepGridClone(electricalGridImportModel);
  const model=ensureAutomationModel?.();
  if(model?.nodes?.length)return normalizeElectricalGridData({name:model.name||'Sơ đồ hiện tại',nodes:model.nodes.map((n,i)=>({id:n.id,type:n.type,label:n.label,station:n.station||'',voltageLevel:n.voltageLevel||'',x:n.position?.x,y:n.position?.y,scale:n.scale,rotationDeg:n.rotationDeg,layoutDirection:n.layoutDirection||'inherit',layoutAngleDeg:n.layoutAngleDeg,symbolOrientation:n.symbolOrientation||'inherit',symbolAngleOffsetDeg:n.symbolAngleOffsetDeg,order:i})),connections:model.connections||[],layout:model.layout||{directionMode:$('gridOrientation')?.value||'down',layoutAngleDeg:num($('gridLayoutAngle')?.value,-90),symbolOrientation:$('gridSymbolOrientation')?.value||'follow',symbolAngleOffsetDeg:num($('gridSymbolAngleOffset')?.value,0),spacingX:num($('gridSpacingX')?.value,90),spacingY:num($('gridSpacingY')?.value,85)}});
  return normalizeElectricalGridData({name:'Topology mới',nodes:[{id:'BUS1',type:'BUSBAR',label:'Thanh cái 1'}],connections:[]});
}
function topologyNodeOptions(selected){return Object.keys(ELECTRICAL_SYMBOL_DEFS||{}).map(id=>`<option value="${safeIdText(id)}" ${id===selected?'selected':''}>${safeIdText(ELECTRICAL_SYMBOL_DEFS[id]?.name||id)}</option>`).join('')}
function topologyDirectionOptions(selected='inherit'){return[['inherit','Kế thừa thiết lập chung'],['down','Hướng xuống'],['up','Hướng lên'],['right','Sang phải'],['left','Sang trái'],['angle','Theo góc tùy chọn']].map(([v,t])=>`<option value="${v}" ${v===selected?'selected':''}>${t}</option>`).join('')}
function topologySymbolOrientationOptions(selected='inherit'){return[['inherit','Kế thừa thiết lập chung'],['follow','Theo hướng nhánh'],['vertical','Nằm dọc'],['horizontal','Nằm ngang'],['angle','Theo góc lệch']].map(([v,t])=>`<option value="${v}" ${v===selected?'selected':''}>${t}</option>`).join('')}
function renderTopologyEditor(){
  const nodeBody=$('topologyNodeBody'),edgeBody=$('topologyEdgeBody');if(!nodeBody||!edgeBody||!topologyEditorModel)return;
  nodeBody.innerHTML=topologyEditorModel.nodes.map((n,i)=>`<tr data-row="${i}"><td><input data-field="id" value="${safeIdText(n.id)}"></td><td><select data-field="type">${topologyNodeOptions(n.type)}</select></td><td><input data-field="label" value="${safeIdText(n.label)}"></td><td><input data-field="station" value="${safeIdText(n.station||'')}"></td><td><input data-field="voltageLevel" value="${safeIdText(n.voltageLevel||'')}"></td><td><input data-field="order" type="number" value="${num(n.order,i)}"></td><td><select data-field="layoutDirection">${topologyDirectionOptions(gridDirection(n.layoutDirection,'inherit'))}</select></td><td><input data-field="layoutAngleDeg" type="number" step="1" value="${Number.isFinite(n.layoutAngleDeg)?n.layoutAngleDeg:''}"></td><td><select data-field="symbolOrientation">${topologySymbolOrientationOptions(gridSymbolOrientation(n.symbolOrientation,'inherit'))}</select></td><td><input data-field="symbolAngleOffsetDeg" type="number" step="1" value="${num(n.symbolAngleOffsetDeg,0)}"></td><td><button data-node-apply-type="${i}" title="Sao chép hướng và tư thế cho tất cả thiết bị cùng loại">Áp dụng cùng loại</button> <button data-node-delete="${i}" class="danger">Xóa</button></td></tr>`).join('');
  const opts=topologyEditorModel.nodes.map(n=>`<option value="${safeIdText(n.id)}">${safeIdText(n.label||n.id)}</option>`).join('');
  edgeBody.innerHTML=topologyEditorModel.connections.map((c,i)=>`<tr data-row="${i}"><td><input data-field="id" value="${safeIdText(c.id||('edge-'+(i+1)))}"></td><td><select data-field="fromNodeId">${opts}</select></td><td><input data-field="fromPort" value="${safeIdText(c.fromPort||'')}"></td><td><select data-field="toNodeId">${opts}</select></td><td><input data-field="toPort" value="${safeIdText(c.toPort||'')}"></td><td><input data-field="label" value="${safeIdText(c.label||'')}"></td><td><select data-field="directionMode">${topologyDirectionOptions(gridDirection(c.directionMode,'inherit'))}</select></td><td><input data-field="angleDeg" type="number" step="1" value="${Number.isFinite(c.angleDeg)?c.angleDeg:''}"></td><td><button data-edge-delete="${i}" class="danger">Xóa</button></td></tr>`).join('');
  topologyEditorModel.connections.forEach((c,i)=>{const row=edgeBody.querySelector(`tr[data-row="${i}"]`);if(row){row.querySelector('[data-field="fromNodeId"]').value=c.fromNodeId;row.querySelector('[data-field="toNodeId"]').value=c.toNodeId}});
  $('topologyEditorSummary').textContent=`${topologyEditorModel.nodes.length} thiết bị · ${topologyEditorModel.connections.length} liên kết`;
}
function collectTopologyEditor(){
  const nodes=[...$('topologyNodeBody').querySelectorAll('tr')].map((row,i)=>{const val=f=>row.querySelector(`[data-field="${f}"]`)?.value||'';return{id:val('id').trim()||`node-${i+1}`,type:val('type'),label:val('label').trim()||val('id').trim()||`Thiết bị ${i+1}`,station:val('station').trim(),voltageLevel:val('voltageLevel').trim(),order:num(val('order'),i),scale:1,layoutDirection:gridDirection(val('layoutDirection'),'inherit'),layoutAngleDeg:val('layoutAngleDeg')===''?NaN:num(val('layoutAngleDeg')),symbolOrientation:gridSymbolOrientation(val('symbolOrientation'),'inherit'),symbolAngleOffsetDeg:num(val('symbolAngleOffsetDeg'),0)}});
  const connections=[...$('topologyEdgeBody').querySelectorAll('tr')].map((row,i)=>{const val=f=>row.querySelector(`[data-field="${f}"]`)?.value||'';return{id:val('id').trim()||`edge-${i+1}`,fromNodeId:val('fromNodeId'),fromPort:val('fromPort').trim(),toNodeId:val('toNodeId'),toPort:val('toPort').trim(),label:val('label').trim(),status:'',directionMode:gridDirection(val('directionMode'),'inherit'),angleDeg:val('angleDeg')===''?NaN:num(val('angleDeg'))}});
  return normalizeElectricalGridData({name:$('topologyName')?.value||topologyEditorModel?.name||'Sơ đồ điện',nodes,connections,layout:topologyEditorModel?.layout});
}
function openTopologyEditor(model=null){
  delete $('topologyEditorApply').dataset.templateId;
  topologyEditorModel=deepGridClone(model||currentTopologyForEditor());$('topologyName').value=topologyEditorModel.name||'Sơ đồ điện';renderTopologyEditor();$('topologyEditorModal').classList.add('show');
}
function closeTopologyEditor(){$('topologyEditorModal').classList.remove('show')}
function topologyApplySameType(index){
  topologyEditorModel=collectTopologyEditor();
  const source=topologyEditorModel.nodes[index];if(!source){alert('Không xác định được thiết bị làm mẫu.');return}
  const sourceType=gridSymbolType(source.type),targets=topologyEditorModel.nodes.filter(n=>gridSymbolType(n.type)===sourceType);
  if(targets.length<=1){alert('Không tìm thấy thiết bị khác cùng loại trong topology hiện tại.');return}
  if(!confirm(`Sao chép quy định hướng và tư thế từ “${source.label||source.id}” cho ${targets.length} thiết bị cùng loại?\n\nCác trường được áp dụng: Hướng nhánh, Góc hướng, Tư thế ký hiệu và Góc lệch.`))return;
  for(const target of targets){target.layoutDirection=source.layoutDirection;target.layoutAngleDeg=source.layoutAngleDeg;target.symbolOrientation=source.symbolOrientation;target.symbolAngleOffsetDeg=source.symbolAngleOffsetDeg}
  renderTopologyEditor();
  updateElectricalGridStatus(`Đã áp dụng hướng/tư thế cho ${targets.length} thiết bị loại ${source.type}.`,'success');
}
function topologyAddNode(){topologyEditorModel=collectTopologyEditor();const used=new Set(topologyEditorModel.nodes.map(n=>n.id));const id=gridUniqueId('NODE',used);topologyEditorModel.nodes.push({id,sourceId:id,type:'CIRCUIT_BREAKER',label:'Thiết bị mới',station:'',voltageLevel:'',order:topologyEditorModel.nodes.length,scale:1,layoutDirection:'inherit',layoutAngleDeg:NaN,symbolOrientation:'inherit',symbolAngleOffsetDeg:0});renderTopologyEditor()}
function topologyAddEdge(){topologyEditorModel=collectTopologyEditor();if(topologyEditorModel.nodes.length<2){alert('Cần ít nhất hai thiết bị để thêm liên kết.');return}topologyEditorModel.connections.push({id:`edge-${topologyEditorModel.connections.length+1}`,fromNodeId:topologyEditorModel.nodes[0].id,toNodeId:topologyEditorModel.nodes[1].id,fromPort:'',toPort:'',label:'',status:'',directionMode:'inherit',angleDeg:NaN});renderTopologyEditor()}
function topologyApply(){try{topologyEditorModel=collectTopologyEditor();electricalGridImportModel=topologyEditorModel;electricalGridSourceName=topologyEditorModel.name||'topology_editor';electricalGridLayoutResult=null;closeTopologyEditor();prepareElectricalGridLayout();updateElectricalGridStatus(`Đã áp dụng topology hiệu chỉnh: ${topologyEditorModel.nodes.length} thiết bị, ${topologyEditorModel.connections.length} liên kết.`,'success');return true}catch(err){alert('Topology chưa hợp lệ: '+err.message);return false}}

function loadLearnedTemplates(){try{const v=JSON.parse(localStorage.getItem(ELECTRICAL_DIAGRAM_TEMPLATE_KEY)||'[]');learnedElectricalTemplates=Array.isArray(v)?v:[]}catch{learnedElectricalTemplates=[]}refreshLearnedTemplateSelect()}
function saveLearnedTemplates(){try{localStorage.setItem(ELECTRICAL_DIAGRAM_TEMPLATE_KEY,JSON.stringify(learnedElectricalTemplates))}catch(err){console.warn('Không lưu bền được thư viện mẫu sơ đồ:',err);updateElectricalGridStatus('Thư viện mẫu chỉ còn trong phiên hiện tại vì trình duyệt chặn localStorage.','error')}refreshLearnedTemplateSelect()}
function refreshLearnedTemplateSelect(){const select=$('gridLearnedTemplateSelect');if(!select)return;const current=select.value;select.innerHTML='<option value="">— Chọn mẫu đã học —</option>'+learnedElectricalTemplates.map(t=>`<option value="${safeIdText(t.id)}">${safeIdText(t.name)} · ${t.kind==='topology'?'topology':'hình học'}</option>`).join('');if([...select.options].some(o=>o.value===current))select.value=current}
function selectedBoundsForLearning(refs){let b={minX:Infinity,minY:Infinity,maxX:-Infinity,maxY:-Infinity};for(const r of refs)itemBounds(r.item,b);return Number.isFinite(b.minX)?b:null}
function inferTopologyFromSelected(refs){
  const symbols=refs.filter(r=>r.kind==='overlay'&&String(r.item?.type||'').toUpperCase()==='SYMBOL').map(r=>r.item);if(!symbols.length)return null;
  symbols.forEach((s,i)=>s.automationId=s.automationId||`node-${i+1}`);
  const ids=new Set(symbols.map(s=>s.automationId));const nodes=symbols.map((s,i)=>({id:s.automationId,type:s.symbolType||'CIRCUIT_BREAKER',label:s.label||s.automationId||`Thiết bị ${i+1}`,station:s.electricalStation||'',voltageLevel:s.electricalVoltageLevel||'',x:s.position.x,y:s.position.y,scale:num(s.symbolScale,1),rotationDeg:num(s.rotationDeg,0),layoutDirection:gridDirection(s.layoutDirection,'inherit'),layoutAngleDeg:Number.isFinite(s.layoutAngleDeg)?s.layoutAngleDeg:NaN,symbolOrientation:gridSymbolOrientation(s.symbolOrientation,'inherit'),symbolAngleOffsetDeg:num(s.symbolAngleOffsetDeg,0),order:i}));
  const projectConnections=ensureAutomationModel?.()?.connections||[];const selectedWires=refs.map(r=>r.item).filter(e=>e?.automationRole==='CONNECTION');const candidates=[...projectConnections,...selectedWires.map(e=>({id:e.automationConnectionId,fromNodeId:e.automationFromNodeId,toNodeId:e.automationToNodeId,fromPort:'',toPort:'',directionMode:e.directionMode||'inherit',angleDeg:e.angleDeg}))];
  const connections=candidates.filter(c=>ids.has(c.fromNodeId)&&ids.has(c.toNodeId)).map(c=>({...c,directionMode:gridDirection(c.directionMode,'inherit'),angleDeg:Number.isFinite(c.angleDeg)?c.angleDeg:NaN}));const directionMode=$('gridOrientation')?.value||'down';return normalizeElectricalGridData({name:'Mẫu topology đã học',nodes,connections,layout:{orientation:gridLegacyOrientation(directionMode),directionMode,layoutAngleDeg:num($('gridLayoutAngle')?.value,-90),symbolOrientation:$('gridSymbolOrientation')?.value||'follow',symbolAngleOffsetDeg:num($('gridSymbolAngleOffset')?.value,0),spacingX:num($('gridSpacingX')?.value,90),spacingY:num($('gridSpacingY')?.value,85)}});
}
function learnSelectedElectricalDiagram(){
  if(!selected?.length){alert('Hãy dùng “Chọn liên kết” hoặc kéo vùng để chọn sơ đồ cần học trước.');return}
  if(typeof autoLearnDwgScope==='function'&&selected.some(r=>r.kind==='entity'))return autoLearnDwgScope('selection');
  const refs=[...selected],bounds=selectedBoundsForLearning(refs);if(!bounds){alert('Không xác định được vùng hình học đã chọn.');return}
  const name=prompt('Tên mẫu sơ đồ:',`Mẫu sơ đồ ${learnedElectricalTemplates.length+1}`)?.trim();if(!name)return;
  const topology=inferTopologyFromSelected(refs),id='diagram-'+Date.now().toString(36);
  let template;
  if(topology){template={id,name,kind:'topology',createdAt:new Date().toISOString(),model:topology,sourceBounds:bounds}}
  else{template={id,name,kind:'geometry',createdAt:new Date().toISOString(),sourceBounds:bounds,items:refs.map(r=>({kind:r.kind,item:clone(r.item)}))}}
  learnedElectricalTemplates.push(template);saveLearnedTemplates();$('gridLearnedTemplateSelect').value=id;updateElectricalGridStatus(`Đã học “${name}” dưới dạng ${template.kind==='topology'?'topology có thể hiệu chỉnh':'mẫu hình học co giãn theo A4'}.`,'success');
}
function selectedLearnedTemplate(){return learnedElectricalTemplates.find(t=>t.id===$('gridLearnedTemplateSelect')?.value)}
function editLearnedTemplate(){const t=selectedLearnedTemplate();if(!t){alert('Hãy chọn một mẫu đã học.');return}if(t.kind!=='topology'){alert('Mẫu hình học giữ nguyên hình dạng; chỉ mẫu topology mới sửa được bảng thiết bị–liên kết.');return}openTopologyEditor(t.model);$('topologyEditorApply').dataset.templateId=t.id}
function deleteLearnedTemplate(){const t=selectedLearnedTemplate();if(!t)return;if(!confirm(`Xóa mẫu “${t.name}”?`))return;learnedElectricalTemplates=learnedElectricalTemplates.filter(x=>x.id!==t.id);saveLearnedTemplates()}
function generateGeometryLearnedTemplate(t){
  if(!project)return;const inner=electricalA4InnerBounds($('gridCreateFrame')?.checked!==false),src=t.sourceBounds,srcW=Math.max(1e-6,src.maxX-src.minX),srcH=Math.max(1e-6,src.maxY-src.minY),factor=Math.min((inner.maxX-inner.minX)/srcW,(inner.maxY-inner.minY)/srcH),srcC={x:(src.minX+src.maxX)/2,y:(src.minY+src.maxY)/2},dstC={x:(inner.minX+inner.maxX)/2,y:(inner.minY+inner.maxY)/2};
  const created=t.items.map(x=>{const e=clone(x.item);scaleItem(e,srcC,factor);translateItem(e,{x:dstC.x-srcC.x,y:dstC.y-srcC.y});e.autoGeneratedElectrical=true;e.learnedDiagramTemplateId=t.id;return e});
  simpleAction(`Đã sinh mẫu hình học “${t.name}”`,()=>{if($('gridClearPrevious')?.checked!==false)overlays=overlays.filter(e=>!e.autoGeneratedElectrical);overlays.push(...created);selected=created.map(e=>refFor(e,'overlay'))});fitView();
}
function generateLearnedTemplate(){
  const t=selectedLearnedTemplate();if(!t){alert('Hãy chọn một mẫu đã học.');return}
  if(t.kind==='geometry'){generateGeometryLearnedTemplate(t);return}
  electricalGridImportModel=deepGridClone(t.model);electricalGridSourceName=t.name;applyElectricalGridLayoutSettings(electricalGridImportModel);
  const mode=$('gridLearnGenerateMode')?.value||'similar';
  if(mode==='exact'){electricalGridImportModel.nodes.forEach(n=>{if(n.x===undefined&&n.position){n.x=n.position.x;n.y=n.position.y}});$('gridKeepCoordinates').checked=true}else $('gridKeepCoordinates').checked=false;
  generateElectricalGridDrawing();
}
function createA4FrameOnly(){electricalA4Frame(true);status('Đã tạo khung xuất A4 theo hướng và kích thước đã chọn.')}
function initializeElectricalGridAutomation(){
  const input=$('gridTopologyInput');if(input)input.onchange=async e=>{try{await loadElectricalGridFile(e.target.files?.[0])}catch(err){console.error(err);updateElectricalGridStatus('Không đọc được dữ liệu: '+err.message,'error');alert('Không đọc được dữ liệu topology: '+err.message)}finally{e.target.value=''}};
  $('gridOpenDataBtn')?.addEventListener('click',gridAutomationOpenFile);
  $('gridLoadSampleBtn')?.addEventListener('click',gridAutomationLoadSample);
  $('gridPreviewBtn')?.addEventListener('click',gridAutomationPreview);
  $('gridGenerateBtn')?.addEventListener('click',gridAutomationGenerate);
  $('gridExportNormalizedBtn')?.addEventListener('click',exportNormalizedElectricalGrid);
  $('gridEditTopologyBtn')?.addEventListener('click',()=>openTopologyEditor());
  $('gridLearnSelectionBtn')?.addEventListener('click',learnSelectedElectricalDiagram);
  $('gridGenerateLearnedBtn')?.addEventListener('click',generateLearnedTemplate);
  $('gridEditLearnedBtn')?.addEventListener('click',editLearnedTemplate);
  $('gridDeleteLearnedBtn')?.addEventListener('click',deleteLearnedTemplate);
  $('gridCreateA4FrameBtn')?.addEventListener('click',createA4FrameOnly);
  $('topologyEditorClose')?.addEventListener('click',closeTopologyEditor);
  $('topologyEditorCancel')?.addEventListener('click',closeTopologyEditor);
  $('topologyAddNode')?.addEventListener('click',topologyAddNode);
  $('topologyAddEdge')?.addEventListener('click',topologyAddEdge);
  $('topologyEditorApply')?.addEventListener('click',()=>{const templateId=$('topologyEditorApply').dataset.templateId;if(!topologyApply())return;if(templateId){const t=learnedElectricalTemplates.find(x=>x.id===templateId);if(t){t.model=deepGridClone(electricalGridImportModel);t.updatedAt=new Date().toISOString();saveLearnedTemplates()}delete $('topologyEditorApply').dataset.templateId}});
  $('topologyNodeBody')?.addEventListener('click',e=>{const applyIndex=e.target?.dataset?.nodeApplyType;if(applyIndex!==undefined){topologyApplySameType(Number(applyIndex));return}const i=e.target?.dataset?.nodeDelete;if(i===undefined)return;topologyEditorModel=collectTopologyEditor();const removed=topologyEditorModel.nodes[Number(i)];topologyEditorModel.nodes.splice(Number(i),1);topologyEditorModel.connections=topologyEditorModel.connections.filter(c=>c.fromNodeId!==removed.id&&c.toNodeId!==removed.id);renderTopologyEditor()});
  $('topologyEdgeBody')?.addEventListener('click',e=>{const i=e.target?.dataset?.edgeDelete;if(i===undefined)return;topologyEditorModel=collectTopologyEditor();topologyEditorModel.connections.splice(Number(i),1);renderTopologyEditor()});
  ['gridOrientation','gridLayoutAngle','gridSymbolOrientation','gridSymbolAngleOffset','gridSpacingX','gridSpacingY','gridSymbolScale','gridOriginMode','gridOriginX','gridOriginY','gridKeepCoordinates','gridFitA4','gridA4Orientation','gridA4Width','gridA4Margin'].forEach(id=>$(id)?.addEventListener('change',()=>{electricalGridLayoutResult=null;renderElectricalGridPreview(null);if(electricalGridImportModel)updateElectricalGridStatus('Thiết lập đã thay đổi. Bấm “Xem trước bố trí” để tính lại.')}));
}

loadLearnedTemplates();
initializeElectricalGridAutomation();
;
/* ===== END CONSOLIDATED SOURCE: electrical-automation-v0179.js ===== */

