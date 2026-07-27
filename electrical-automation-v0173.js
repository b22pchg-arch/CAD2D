'use strict';
/* DWG Sketch PWA V0.17.3 - Topology editor, learned diagram templates and A4 automatic generation.
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
    label:gridText(raw,'label','name','ten','tên')||''
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
    schema:'dwg-sketch-electrical-topology',schemaVersion:2,
    name:gridText(data||{},'name','title','ten','tên')||'Sơ đồ lưới điện',
    nodes,connections:validConnections,
    layout:{orientation:gridText(data?.layout||{},'orientation')||'vertical',spacingX:num(data?.layout?.spacingX,90),spacingY:num(data?.layout?.spacingY,85)}
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
  const outgoing=new Map(nodes.map(n=>[n.id,[]])),incoming=new Map(nodes.map(n=>[n.id,[]])),undirected=new Map(nodes.map(n=>[n.id,[]]));
  for(const c of connections){if(!map.has(c.fromNodeId)||!map.has(c.toNodeId))continue;outgoing.get(c.fromNodeId).push(c.toNodeId);incoming.get(c.toNodeId).push(c.fromNodeId);undirected.get(c.fromNodeId).push(c.toNodeId);undirected.get(c.toNodeId).push(c.fromNodeId)}
  const rank=new Map(),queue=[];
  const roots=nodes.filter(n=>n.type==='BUSBAR'&&!incoming.get(n.id).length).sort((a,b)=>a.order-b.order||a.label.localeCompare(b.label,'vi'));
  for(const n of nodes.filter(n=>!incoming.get(n.id).length&&!roots.includes(n)))roots.push(n);
  if(!roots.length&&nodes[0])roots.push(nodes[0]);
  for(const r of roots){if(rank.has(r.id))continue;rank.set(r.id,0);queue.push(r.id)}
  while(queue.length){const id=queue.shift(),base=rank.get(id);for(const child of outgoing.get(id)||[]){const next=base+1;if(!rank.has(child)||next<rank.get(child)){rank.set(child,next);queue.push(child)}}}
  // Resolve disconnected/cyclic components using undirected breadth-first traversal.
  let componentOffset=Math.max(0,...rank.values())+1;
  for(const start of nodes){if(rank.has(start.id))continue;rank.set(start.id,componentOffset);queue.push(start.id);while(queue.length){const id=queue.shift(),base=rank.get(id);for(const next of undirected.get(id)||[])if(!rank.has(next)){rank.set(next,base+1);queue.push(next)}}componentOffset=Math.max(...rank.values())+1}
  const levels=new Map();for(const n of nodes){const r=rank.get(n.id)||0;if(!levels.has(r))levels.set(r,[]);levels.get(r).push(n)}
  const sortedRanks=[...levels.keys()].sort((a,b)=>a-b),positionIndex=new Map();
  for(const r of sortedRanks){const list=levels.get(r);list.sort((a,b)=>{
    const pa=(incoming.get(a.id)||[]).map(x=>positionIndex.get(x)).filter(Number.isFinite),pb=(incoming.get(b.id)||[]).map(x=>positionIndex.get(x)).filter(Number.isFinite);
    const ba=pa.length?pa.reduce((s,x)=>s+x,0)/pa.length:Infinity,bb=pb.length?pb.reduce((s,x)=>s+x,0)/pb.length:Infinity;
    return ba-bb||a.order-b.order||gridTypePriority(a.type)-gridTypePriority(b.type)||a.label.localeCompare(b.label,'vi');
  });list.forEach((n,i)=>positionIndex.set(n.id,i))}
  const orientation=options.orientation==='horizontal'?'horizontal':'vertical',spacingX=Math.max(35,num(options.spacingX,90)),spacingY=Math.max(35,num(options.spacingY,85)),origin=options.origin||{x:0,y:0},baseScale=Math.max(.2,num(options.scale,1));
  for(const r of sortedRanks){const list=levels.get(r);for(let i=0;i<list.length;i++){
    const n=list[i],cross=(i-(list.length-1)/2);
    n.position=orientation==='vertical'?{x:origin.x+cross*spacingX,y:origin.y-r*spacingY}:{x:origin.x+r*spacingX,y:origin.y-cross*spacingY};
    if(Number.isFinite(n.x)&&Number.isFinite(n.y)&&options.keepCoordinates)n.position={x:n.x,y:n.y};
    const degree=(undirected.get(n.id)||[]).length;
    n.symbolScale=Math.max(.2,num(n.scale,baseScale));
    if(n.type==='BUSBAR')n.symbolScale=Math.max(n.symbolScale,Math.min(12,Math.max(1,degree*.72*spacingX/60)));
    n.rotationDeg=Number.isFinite(n.rotationDeg)?n.rotationDeg:(orientation==='horizontal'?90:0);
    n.labelRotationDeg=0;n.rank=r;
  }}
  return{...model,nodes,connections,layout:{orientation,spacingX,spacingY,origin,keepCoordinates:!!options.keepCoordinates}};
}
function electricalGridNodeEntity(node,options){
  return{type:'SYMBOL',symbolType:node.type,label:node.label||node.id,position:point(node.position),symbolScale:Math.max(.2,num(node.symbolScale,1)),rotationDeg:num(node.rotationDeg,0),labelRotationDeg:num(node.labelRotationDeg,0),automationId:node.id,autoGeneratedElectrical:true,electricalStation:node.station||'',electricalVoltageLevel:node.voltageLevel||'',color:hexToArgb(options.color||'#ffffff'),stroke:Math.max(.2,num(options.stroke,2))};
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
    const a=electricalGridAttachPoint(from,point(to.position),c.fromPort),b=electricalGridAttachPoint(to,point(from.position),c.toPort),orientation=layoutResult.layout.orientation;
    const points=orientation==='vertical'?compactPolyline([a,{x:a.x,y:(a.y+b.y)/2},{x:b.x,y:(a.y+b.y)/2},b]):compactPolyline([a,{x:(a.x+b.x)/2,y:a.y},{x:(a.x+b.x)/2,y:b.y},b]);
    wires.push({type:'POLYLINE',points,closed:false,autoGeneratedElectrical:true,automationRole:'CONNECTION',automationConnectionId:c.id||`edge-${i+1}`,automationFromNodeId:c.fromNodeId,automationToNodeId:c.toNodeId,color:hexToArgb(options.connectionColor||options.color||'#ffffff'),stroke:Math.max(.2,num(options.connectionStroke,options.stroke||2))});
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
  const options={orientation:$('gridOrientation')?.value||'vertical',spacingX:num($('gridSpacingX')?.value,90),spacingY:num($('gridSpacingY')?.value,85),scale:num($('gridSymbolScale')?.value,1),origin:electricalGridRootPoint(),keepCoordinates:$('gridKeepCoordinates')?.checked===true};
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
    const model=ensureAutomationModel(),symbolById=new Map(generated.symbols.map(e=>[e.automationId,e]));model.schemaVersion=2;model.name=layoutResult.name;model.nodes=layoutResult.nodes.map(n=>{const symbol=symbolById.get(n.id);return{id:n.id,type:n.type,label:n.label,station:n.station,voltageLevel:n.voltageLevel,position:point(n.position),scale:n.symbolScale,rotationDeg:n.rotationDeg,ports:symbol?symbolPorts(symbol).map(p=>({name:p.name,x:p.point.x,y:p.point.y})):[]}});model.connections=layoutResult.connections.map(c=>({id:c.id,fromNodeId:c.fromNodeId,toNodeId:c.toNodeId,fromPort:c.fromPort||'',toPort:c.toPort||'',status:c.status||'',label:c.label||''}));model.layout=clone(layoutResult.layout);
  });
  fitView();updateElectricalGridStatus(`Đã tạo ${generated.symbols.length} ký hiệu và ${generated.wires.length} tuyến nối. Có thể chọn, MOVE, SCALE, sửa nhãn, lưu JSON và xuất DXF.`, 'success');
}
async function loadElectricalGridFile(file){
  if(!file)return;const text=await file.text();electricalGridImportModel=parseElectricalGridText(text,file.name);electricalGridSourceName=file.name;electricalGridLayoutResult=null;renderElectricalGridPreview(null);updateElectricalGridStatus(`Đã đọc ${file.name}: ${electricalGridImportModel.nodes.length} thiết bị, ${electricalGridImportModel.connections.length} liên kết. Bấm “Xem trước bố trí”.`,'success');
}
function gridAutomationOpenFile(){$('gridTopologyInput')?.click()}
function gridAutomationPreview(){return prepareElectricalGridLayout()}
function gridAutomationGenerate(){return generateElectricalGridDrawing()}
function gridAutomationLoadSample(){
  const csv=`id,type,label,parent,voltageLevel,station,order\nBUS110,BUSBAR,Thanh cái 110 kV,,110,Trạm mẫu,1\nDCL131,DISCONNECTOR,DCL 131-1,BUS110,110,Trạm mẫu,2\nMC131,CIRCUIT_BREAKER,MC 131,DCL131,110,Trạm mẫu,3\nMBA_T1,TRANSFORMER_2W,MBA T1,MC131,110/35,Trạm mẫu,4\nBUS35,BUSBAR,Thanh cái 35 kV,MBA_T1,35,Trạm mẫu,5\nMC371,CIRCUIT_BREAKER,MC 371,BUS35,35,Trạm mẫu,6\nLOAD371,LOAD,ĐZ 371,MC371,35,Trạm mẫu,7\nMC372,CIRCUIT_BREAKER,MC 372,BUS35,35,Trạm mẫu,8\nLOAD372,LOAD,ĐZ 372,MC372,35,Trạm mẫu,9`;
  electricalGridImportModel=parseElectricalGridText(csv,'sample_electrical_grid.csv');electricalGridSourceName='Dữ liệu mẫu';electricalGridLayoutResult=null;updateElectricalGridStatus(`Đã nạp dữ liệu mẫu: ${electricalGridImportModel.nodes.length} thiết bị, ${electricalGridImportModel.connections.length} liên kết.`,'success');prepareElectricalGridLayout();
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
  if(model?.nodes?.length)return normalizeElectricalGridData({name:model.name||'Sơ đồ hiện tại',nodes:model.nodes.map((n,i)=>({id:n.id,type:n.type,label:n.label,station:n.station||'',voltageLevel:n.voltageLevel||'',x:n.position?.x,y:n.position?.y,scale:n.scale,rotationDeg:n.rotationDeg,order:i})),connections:model.connections||[]});
  return normalizeElectricalGridData({name:'Topology mới',nodes:[{id:'BUS1',type:'BUSBAR',label:'Thanh cái 1'}],connections:[]});
}
function topologyNodeOptions(selected){return Object.keys(ELECTRICAL_SYMBOL_DEFS||{}).map(id=>`<option value="${safeIdText(id)}" ${id===selected?'selected':''}>${safeIdText(ELECTRICAL_SYMBOL_DEFS[id]?.name||id)}</option>`).join('')}
function renderTopologyEditor(){
  const nodeBody=$('topologyNodeBody'),edgeBody=$('topologyEdgeBody');if(!nodeBody||!edgeBody||!topologyEditorModel)return;
  nodeBody.innerHTML=topologyEditorModel.nodes.map((n,i)=>`<tr data-row="${i}"><td><input data-field="id" value="${safeIdText(n.id)}"></td><td><select data-field="type">${topologyNodeOptions(n.type)}</select></td><td><input data-field="label" value="${safeIdText(n.label)}"></td><td><input data-field="station" value="${safeIdText(n.station||'')}"></td><td><input data-field="voltageLevel" value="${safeIdText(n.voltageLevel||'')}"></td><td><input data-field="order" type="number" value="${num(n.order,i)}"></td><td><button data-node-delete="${i}" class="danger">Xóa</button></td></tr>`).join('');
  const opts=topologyEditorModel.nodes.map(n=>`<option value="${safeIdText(n.id)}">${safeIdText(n.label||n.id)}</option>`).join('');
  edgeBody.innerHTML=topologyEditorModel.connections.map((c,i)=>`<tr data-row="${i}"><td><input data-field="id" value="${safeIdText(c.id||('edge-'+(i+1)))}"></td><td><select data-field="fromNodeId">${opts}</select></td><td><input data-field="fromPort" value="${safeIdText(c.fromPort||'')}"></td><td><select data-field="toNodeId">${opts}</select></td><td><input data-field="toPort" value="${safeIdText(c.toPort||'')}"></td><td><input data-field="label" value="${safeIdText(c.label||'')}"></td><td><button data-edge-delete="${i}" class="danger">Xóa</button></td></tr>`).join('');
  topologyEditorModel.connections.forEach((c,i)=>{const row=edgeBody.querySelector(`tr[data-row="${i}"]`);if(row){row.querySelector('[data-field="fromNodeId"]').value=c.fromNodeId;row.querySelector('[data-field="toNodeId"]').value=c.toNodeId}});
  $('topologyEditorSummary').textContent=`${topologyEditorModel.nodes.length} thiết bị · ${topologyEditorModel.connections.length} liên kết`;
}
function collectTopologyEditor(){
  const nodes=[...$('topologyNodeBody').querySelectorAll('tr')].map((row,i)=>{const val=f=>row.querySelector(`[data-field="${f}"]`)?.value||'';return{id:val('id').trim()||`node-${i+1}`,type:val('type'),label:val('label').trim()||val('id').trim()||`Thiết bị ${i+1}`,station:val('station').trim(),voltageLevel:val('voltageLevel').trim(),order:num(val('order'),i),scale:1}});
  const connections=[...$('topologyEdgeBody').querySelectorAll('tr')].map((row,i)=>{const val=f=>row.querySelector(`[data-field="${f}"]`)?.value||'';return{id:val('id').trim()||`edge-${i+1}`,fromNodeId:val('fromNodeId'),fromPort:val('fromPort').trim(),toNodeId:val('toNodeId'),toPort:val('toPort').trim(),label:val('label').trim(),status:''}});
  return normalizeElectricalGridData({name:$('topologyName')?.value||topologyEditorModel?.name||'Sơ đồ điện',nodes,connections,layout:topologyEditorModel?.layout});
}
function openTopologyEditor(model=null){
  delete $('topologyEditorApply').dataset.templateId;
  topologyEditorModel=deepGridClone(model||currentTopologyForEditor());$('topologyName').value=topologyEditorModel.name||'Sơ đồ điện';renderTopologyEditor();$('topologyEditorModal').classList.add('show');
}
function closeTopologyEditor(){$('topologyEditorModal').classList.remove('show')}
function topologyAddNode(){topologyEditorModel=collectTopologyEditor();const used=new Set(topologyEditorModel.nodes.map(n=>n.id));const id=gridUniqueId('NODE',used);topologyEditorModel.nodes.push({id,sourceId:id,type:'CIRCUIT_BREAKER',label:'Thiết bị mới',station:'',voltageLevel:'',order:topologyEditorModel.nodes.length,scale:1});renderTopologyEditor()}
function topologyAddEdge(){topologyEditorModel=collectTopologyEditor();if(topologyEditorModel.nodes.length<2){alert('Cần ít nhất hai thiết bị để thêm liên kết.');return}topologyEditorModel.connections.push({id:`edge-${topologyEditorModel.connections.length+1}`,fromNodeId:topologyEditorModel.nodes[0].id,toNodeId:topologyEditorModel.nodes[1].id,fromPort:'',toPort:'',label:'',status:''});renderTopologyEditor()}
function topologyApply(){try{topologyEditorModel=collectTopologyEditor();electricalGridImportModel=topologyEditorModel;electricalGridSourceName=topologyEditorModel.name||'topology_editor';electricalGridLayoutResult=null;closeTopologyEditor();prepareElectricalGridLayout();updateElectricalGridStatus(`Đã áp dụng topology hiệu chỉnh: ${topologyEditorModel.nodes.length} thiết bị, ${topologyEditorModel.connections.length} liên kết.`,'success');return true}catch(err){alert('Topology chưa hợp lệ: '+err.message);return false}}

function loadLearnedTemplates(){try{const v=JSON.parse(localStorage.getItem(ELECTRICAL_DIAGRAM_TEMPLATE_KEY)||'[]');learnedElectricalTemplates=Array.isArray(v)?v:[]}catch{learnedElectricalTemplates=[]}refreshLearnedTemplateSelect()}
function saveLearnedTemplates(){try{localStorage.setItem(ELECTRICAL_DIAGRAM_TEMPLATE_KEY,JSON.stringify(learnedElectricalTemplates))}catch(err){console.warn('Không lưu bền được thư viện mẫu sơ đồ:',err);updateElectricalGridStatus('Thư viện mẫu chỉ còn trong phiên hiện tại vì trình duyệt chặn localStorage.','error')}refreshLearnedTemplateSelect()}
function refreshLearnedTemplateSelect(){const select=$('gridLearnedTemplateSelect');if(!select)return;const current=select.value;select.innerHTML='<option value="">— Chọn mẫu đã học —</option>'+learnedElectricalTemplates.map(t=>`<option value="${safeIdText(t.id)}">${safeIdText(t.name)} · ${t.kind==='topology'?'topology':'hình học'}</option>`).join('');if([...select.options].some(o=>o.value===current))select.value=current}
function selectedBoundsForLearning(refs){let b={minX:Infinity,minY:Infinity,maxX:-Infinity,maxY:-Infinity};for(const r of refs)itemBounds(r.item,b);return Number.isFinite(b.minX)?b:null}
function inferTopologyFromSelected(refs){
  const symbols=refs.filter(r=>r.kind==='overlay'&&String(r.item?.type||'').toUpperCase()==='SYMBOL').map(r=>r.item);if(!symbols.length)return null;
  symbols.forEach((s,i)=>s.automationId=s.automationId||`node-${i+1}`);
  const ids=new Set(symbols.map(s=>s.automationId));const nodes=symbols.map((s,i)=>({id:s.automationId,type:s.symbolType||'CIRCUIT_BREAKER',label:s.label||s.automationId||`Thiết bị ${i+1}`,station:s.electricalStation||'',voltageLevel:s.electricalVoltageLevel||'',x:s.position.x,y:s.position.y,scale:num(s.symbolScale,1),rotationDeg:num(s.rotationDeg,0),order:i}));
  const projectConnections=ensureAutomationModel?.()?.connections||[];const selectedWires=refs.map(r=>r.item).filter(e=>e?.automationRole==='CONNECTION');const candidates=[...projectConnections,...selectedWires.map(e=>({id:e.automationConnectionId,fromNodeId:e.automationFromNodeId,toNodeId:e.automationToNodeId,fromPort:'',toPort:''}))];
  const connections=candidates.filter(c=>ids.has(c.fromNodeId)&&ids.has(c.toNodeId));return normalizeElectricalGridData({name:'Mẫu topology đã học',nodes,connections,layout:{orientation:$('gridOrientation')?.value||'vertical'}});
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
  electricalGridImportModel=deepGridClone(t.model);electricalGridSourceName=t.name;
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
  $('topologyNodeBody')?.addEventListener('click',e=>{const i=e.target?.dataset?.nodeDelete;if(i===undefined)return;topologyEditorModel=collectTopologyEditor();const removed=topologyEditorModel.nodes[Number(i)];topologyEditorModel.nodes.splice(Number(i),1);topologyEditorModel.connections=topologyEditorModel.connections.filter(c=>c.fromNodeId!==removed.id&&c.toNodeId!==removed.id);renderTopologyEditor()});
  $('topologyEdgeBody')?.addEventListener('click',e=>{const i=e.target?.dataset?.edgeDelete;if(i===undefined)return;topologyEditorModel=collectTopologyEditor();topologyEditorModel.connections.splice(Number(i),1);renderTopologyEditor()});
  ['gridOrientation','gridSpacingX','gridSpacingY','gridSymbolScale','gridOriginMode','gridOriginX','gridOriginY','gridKeepCoordinates','gridFitA4','gridA4Orientation','gridA4Width','gridA4Margin'].forEach(id=>$(id)?.addEventListener('change',()=>{electricalGridLayoutResult=null;renderElectricalGridPreview(null);if(electricalGridImportModel)updateElectricalGridStatus('Thiết lập đã thay đổi. Bấm “Xem trước bố trí” để tính lại.')}));
}

loadLearnedTemplates();
initializeElectricalGridAutomation();
