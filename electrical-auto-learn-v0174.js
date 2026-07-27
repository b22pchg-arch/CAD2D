/* DWG Sketch PWA V0.17.5 - Học topology trực tiếp từ toàn DWG hoặc vùng chọn.
 * Đây là bộ suy luận có kiểm soát: nhận tuyến dẫn dài, nhãn lân cận, tách thành phần mạng,
 * nhóm topology lặp và tạo đồng thời topology mẫu + mẫu hình học để người dùng duyệt lại.
 */
const DWG_AUTO_LEARN_VERSION='0.17.5';
const DWG_AUTO_LEARN_MAX_TOPOLOGIES=20;
const DWG_AUTO_LEARN_MAX_GEOMETRY_ITEMS=1200;

function alNum(v,f=0){const n=Number(v);return Number.isFinite(n)?n:f}
function alClamp(v,a,b){return Math.max(a,Math.min(b,v))}
function alFold(value){return String(value??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[đĐ]/g,'D').toUpperCase().replace(/[^A-Z0-9]+/g,' ').trim()}
function alCleanText(value){return String(value??'').replace(/\\P/gi,' ').replace(/\r?\n/g,' ').replace(/\s+/g,' ').trim()}
function alSafeId(value,fallback='NODE'){const s=alFold(value).replace(/\s+/g,'_').replace(/^_+|_+$/g,'');return s||fallback}
function alPowerLayer(layer){return /(^| )(DZ|TC|CAP|NET|SO|MANH|TIEP DAT|0 4)/.test(alFold(layer))}
function alPoint(x=0,y=0){return{x:alNum(x),y:alNum(y)}}
function alBoundsEmpty(){return{minX:Infinity,minY:Infinity,maxX:-Infinity,maxY:-Infinity}}
function alIncludePoint(b,p){if(!p)return b;b.minX=Math.min(b.minX,alNum(p.x));b.minY=Math.min(b.minY,alNum(p.y));b.maxX=Math.max(b.maxX,alNum(p.x));b.maxY=Math.max(b.maxY,alNum(p.y));return b}
function alValidBounds(b){return b&&Number.isFinite(b.minX)&&Number.isFinite(b.minY)&&Number.isFinite(b.maxX)&&Number.isFinite(b.maxY)&&b.maxX>=b.minX&&b.maxY>=b.minY}
function alExpandBounds(b,m){return{minX:b.minX-m,minY:b.minY-m,maxX:b.maxX+m,maxY:b.maxY+m}}
function alBoundsIntersect(a,b){return !!a&&!!b&&!(a.maxX<b.minX||a.minX>b.maxX||a.maxY<b.minY||a.minY>b.maxY)}
function alEntityBounds(item){
  const b=alBoundsEmpty(),t=String(item?.type||'').toUpperCase();
  if(t==='LINE'){alIncludePoint(b,item.a);alIncludePoint(b,item.b)}
  else if(t==='LWPOLYLINE'||t==='POLYLINE'||t==='FILL'){for(const p of item.points||[])alIncludePoint(b,p)}
  else if(t==='TEXT'||t==='MTEXT'){const p=item.position||item.center||{x:0,y:0},h=Math.max(.1,alNum(item.height,2.5)),text=alCleanText(item.text);alIncludePoint(b,p);alIncludePoint(b,{x:p.x+Math.max(1,text.length)*h*.65,y:p.y+h*1.2})}
  else if(t==='CIRCLE'||t==='ARC'){const c=item.center||{x:0,y:0},r=Math.abs(alNum(item.radius));alIncludePoint(b,{x:c.x-r,y:c.y-r});alIncludePoint(b,{x:c.x+r,y:c.y+r})}
  else if(t==='ELLIPSE'){const c=item.center||item.position||{x:0,y:0},rx=Math.abs(alNum(item.radiusX??item.rx??item.radius)),ry=Math.abs(alNum(item.radiusY??item.ry??item.radius));alIncludePoint(b,{x:c.x-rx,y:c.y-ry});alIncludePoint(b,{x:c.x+rx,y:c.y+ry})}
  else if(t==='RECTANGLE'||t==='SQUARE'){alIncludePoint(b,item.a);alIncludePoint(b,item.b)}
  else if(t==='SYMBOL'){const p=item.position||{x:0,y:0},s=Math.max(1,alNum(item.symbolScale,1)*20);alIncludePoint(b,{x:p.x-s,y:p.y-s});alIncludePoint(b,{x:p.x+s,y:p.y+s})}
  return alValidBounds(b)?b:null;
}
function alRefsBounds(refs){const b=alBoundsEmpty();for(const r of refs||[]){const q=alEntityBounds(r.item);if(!q)continue;alIncludePoint(b,{x:q.minX,y:q.minY});alIncludePoint(b,{x:q.maxX,y:q.maxY})}return alValidBounds(b)?b:null}
function alScopeRefs(mode){
  if(mode==='selection')return [...(selected||[])];
  return [...(entities||[]).map(item=>({kind:'entity',item})),...(overlays||[]).map(item=>({kind:'overlay',item}))];
}
function alLabelScore(item,text){
  const h=alNum(item?.height),f=alFold(text);
  if(f.length<2||/^[0-9 .()+/\-]+$/.test(text))return-999;
  if(/^\d{3,4}\s*[-/]/.test(text))return-10;
  if(f.startsWith('RMU')||f.startsWith('CHUNG COT'))return-5;
  let score=h;
  if(['DPT','T TAM','DIESEL','MC ','NUI CAM','HA AN','CUC THUE','B VIEN','C XANG','TINH UY','BCHQS','NHN NUOC','VIETTEL','BIDV','BENH VIEN','TRUONG','CHO','T401'].some(k=>f.includes(k)))score+=10;
  if(String(item?.text||'').includes('\n'))score+=2;
  return score;
}
function alClassifyLabel(text){const f=alFold(text);if(/\b(MBA|MAY BIEN AP|T TAM|T1|T2|T3)\b/.test(f))return'TRANSFORMER_2W';if(/\b(DIESEL|MAY PHAT|GEN)\b/.test(f))return'GENERATOR';if(/\b(MC|MAY CAT|CB)\b/.test(f))return'CIRCUIT_BREAKER';if(/\b(DCL|DAO CACH LY|DS)\b/.test(f))return'DISCONNECTOR';if(/\b(RMU)\b/.test(f))return'CIRCUIT_BREAKER';if(/\b(BU|VT|PT)\b/.test(f))return'VT';if(/\b(BI|CT)\b/.test(f))return'CT';return'LOAD'}
function alVoltageFromLayer(layer){const f=alFold(layer);for(const v of['110','35','22','10','6'])if(f.includes(v))return v;return f.includes('0 4')?'0.4':''}
function alPrimitiveSegments(refs){
  const out=[];
  const add=(a,b,layer)=>{if(!a||!b||!alPowerLayer(layer))return;const ax=alNum(a.x),ay=alNum(a.y),bx=alNum(b.x),by=alNum(b.y),len=Math.hypot(bx-ax,by-ay);if(len<8)return;const ori=Math.abs(by-ay)<=Math.max(.5,len*.02)?'H':(Math.abs(bx-ax)<=Math.max(.5,len*.02)?'V':'');if(ori)out.push({ori,a:[ax,ay],b:[bx,by],length:len,layer:String(layer||'0')})};
  for(const r of refs){const e=r.item||{},t=String(e.type||'').toUpperCase();if(t==='LINE')add(e.a,e.b,e.layer);else if(t==='LWPOLYLINE'||t==='POLYLINE'){const pts=e.points||[];for(let i=0;i+1<pts.length;i++)add(pts[i],pts[i+1],e.layer);if(e.closed&&pts.length>2)add(pts[pts.length-1],pts[0],e.layer)}}
  return out;
}
function alMergeSegments(segments,coordTol=1,gapTol=2){
  const out=[];
  for(const ori of['H','V']){
    const src=segments.filter(s=>s.ori===ori),fixed=s=>ori==='H'?(s.a[1]+s.b[1])/2:(s.a[0]+s.b[0])/2,start=s=>ori==='H'?Math.min(s.a[0],s.b[0]):Math.min(s.a[1],s.b[1]);
    src.sort((a,b)=>String(a.layer).localeCompare(String(b.layer))||Math.round(fixed(a)/coordTol)-Math.round(fixed(b)/coordTol)||start(a)-start(b));
    let i=0;while(i<src.length){const layer=src[i].layer,key=Math.round(fixed(src[i])/coordTol),items=[];while(i<src.length&&src[i].layer===layer&&Math.round(fixed(src[i])/coordTol)===key)items.push(src[i++]);const fc=items.reduce((s,x)=>s+fixed(x),0)/items.length,intervals=items.map(s=>ori==='H'?[Math.min(s.a[0],s.b[0]),Math.max(s.a[0],s.b[0])]:[Math.min(s.a[1],s.b[1]),Math.max(s.a[1],s.b[1])]).sort((a,b)=>a[0]-b[0]);let cur=[...intervals[0]];for(let k=1;k<intervals.length;k++){const [st,en]=intervals[k];if(st<=cur[1]+gapTol)cur[1]=Math.max(cur[1],en);else{out.push({ori,fixed:fc,start:cur[0],end:cur[1],length:cur[1]-cur[0],layer});cur=[st,en]}}out.push({ori,fixed:fc,start:cur[0],end:cur[1],length:cur[1]-cur[0],layer})}
  }
  return out;
}
function alPointSegmentDistance(p,g){let q;if(g.ori==='H')q={x:alClamp(p.x,g.start,g.end),y:g.fixed};else q={x:g.fixed,y:alClamp(p.y,g.start,g.end)};return{distance:Math.hypot(p.x-q.x,p.y-q.y),point:q}}
function alSegmentsTouch(a,b,tol=2){if(a.ori===b.ori){if(Math.abs(a.fixed-b.fixed)>tol)return false;return Math.max(a.start,b.start)<=Math.min(a.end,b.end)+tol}const h=a.ori==='H'?a:b,v=a.ori==='V'?a:b;return h.start-tol<=v.fixed&&v.fixed<=h.end+tol&&v.start-tol<=h.fixed&&h.fixed<=v.end+tol}
function alCandidateLabels(refs,maxCount=800){
  const arr=[];for(const r of refs){const e=r.item||{},t=String(e.type||'').toUpperCase();if(t!=='TEXT'&&t!=='MTEXT')continue;const text=alCleanText(e.text),score=alLabelScore(e,text);if(score>=5)arr.push({score,item:e,text,point:alPoint(e.position?.x,e.position?.y)})}arr.sort((a,b)=>b.score-a.score);
  const kept=[];for(const x of arr.slice(0,1500)){const suffix=alFold(x.text.split('/').pop());let dup=false;for(const k of kept){const ks=alFold(k.text.split('/').pop());if(Math.hypot(x.point.x-k.point.x,x.point.y-k.point.y)<18&&(suffix===ks||(suffix.length>3&&(suffix.includes(ks)||ks.includes(suffix))))){dup=true;break}}if(!dup)kept.push(x);if(kept.length>=maxCount)break}return kept;
}
function alComponentModels(nodes,connections,baseName){
  const adj=new Map(nodes.map(n=>[n.id,[]]));for(const c of connections){adj.get(c.fromNodeId)?.push(c.toNodeId);adj.get(c.toNodeId)?.push(c.fromNodeId)}const by=new Map(nodes.map(n=>[n.id,n])),seen=new Set(),out=[];
  for(const n of nodes){if(seen.has(n.id))continue;const q=[n.id],ids=[];seen.add(n.id);while(q.length){const u=q.pop();ids.push(u);for(const v of adj.get(u)||[])if(!seen.has(v)){seen.add(v);q.push(v)}}const ns=ids.map(id=>by.get(id)).filter(Boolean),cs=connections.filter(c=>ids.includes(c.fromNodeId)&&ids.includes(c.toNodeId)),labelCount=ns.filter(x=>x.type!=='BUSBAR').length;if(!labelCount)continue;const b=alBoundsEmpty();for(const x of ns)alIncludePoint(b,{x:x.x,y:x.y});out.push({labelCount,nodes:ns,connections:cs,bounds:b,name:`${baseName} · cụm ${out.length+1}`})}
  return out.sort((a,b)=>b.labelCount-a.labelCount||b.nodes.length-a.nodes.length);
}
function alNormalizeComponent(component,name){const ns=deepGridClone(component.nodes),cs=deepGridClone(component.connections),minX=Math.min(...ns.map(n=>n.x)),minY=Math.min(...ns.map(n=>n.y));ns.forEach((n,i)=>{n.x-=minX;n.y-=minY;n.order=i});return normalizeElectricalGridData({schemaVersion:2,name,orientation:'vertical',spacingX:90,spacingY:70,nodes:ns,connections:cs,source:{method:'DWG_AUTO_LEARN_V1',bounds:component.bounds,confidence:'suggested'}})}
function alTopologySignature(component){const degree=new Map(component.nodes.map(n=>[n.id,0]));for(const c of component.connections){degree.set(c.fromNodeId,(degree.get(c.fromNodeId)||0)+1);degree.set(c.toNodeId,(degree.get(c.toNodeId)||0)+1)}return component.nodes.map(n=>`${n.type}:${degree.get(n.id)||0}`).sort().join('|')}
function inferRawDwgTopologies(refs,baseName='DWG tự học'){
  const bounds=alRefsBounds(refs);if(!bounds)throw new Error('Không xác định được phạm vi hình học.');const maxDim=Math.max(bounds.maxX-bounds.minX,bounds.maxY-bounds.minY),segments=alPrimitiveSegments(refs),merged=alMergeSegments(segments),minBus=alClamp(maxDim*.004,20,80),buses=merged.filter(x=>x.length>=minBus).sort((a,b)=>b.length-a.length).slice(0,700),labels=alCandidateLabels(refs),threshold=alClamp(maxDim*.03,45,120),attachments=[],active=new Set();
  for(const label of labels){let best=null;for(let i=0;i<buses.length;i++){const d=alPointSegmentDistance(label.point,buses[i]);if(!best||d.distance<best.distance)best={...d,index:i}}if(best&&best.distance<=threshold){attachments.push({label,...best});active.add(best.index)}}
  for(let round=0;round<2;round++){const add=[];for(const i of active)for(let j=0;j<buses.length;j++)if(!active.has(j)&&alSegmentsTouch(buses[i],buses[j]))add.push(j);add.forEach(x=>active.add(x))}
  const activeList=[...active].sort((a,b)=>a-b),activeMap=new Map(activeList.map((x,i)=>[x,i])),nodes=[],connections=[];
  for(const old of activeList){const g=buses[old],x=g.ori==='H'?(g.start+g.end)/2:g.fixed,y=g.ori==='H'?g.fixed:(g.start+g.end)/2;nodes.push({id:`BUS_${String(nodes.length+1).padStart(3,'0')}`,sourceId:`BUS_${String(nodes.length+1).padStart(3,'0')}`,type:'BUSBAR',label:`Thanh dẫn ${g.layer}`,station:'',voltageLevel:alVoltageFromLayer(g.layer),x,y,scale:1,order:nodes.length,confidence:.9,sourceKind:'conductor'})}
  for(let a=0;a<activeList.length;a++)for(let b=a+1;b<activeList.length;b++)if(alSegmentsTouch(buses[activeList[a]],buses[activeList[b]]))connections.push({id:`edge-${connections.length+1}`,fromNodeId:nodes[a].id,toNodeId:nodes[b].id,fromPort:'',toPort:'',label:'',status:'inferred'});
  for(const x of attachments){const bi=activeMap.get(x.index);if(bi===undefined)continue;const base=nodes[bi],id=`N${String(nodes.length+1).padStart(3,'0')}`;nodes.push({id,sourceId:id,type:alClassifyLabel(x.label.text),label:x.label.text,station:'',voltageLevel:base.voltageLevel,x:x.label.point.x,y:x.label.point.y,scale:1,order:nodes.length,confidence:Math.max(.35,1-x.distance/threshold),sourceKind:'text-anchor'});connections.push({id:`edge-${connections.length+1}`,fromNodeId:base.id,toNodeId:id,fromPort:'',toPort:'',label:'',status:'inferred'})}
  const components=alComponentModels(nodes,connections,baseName);return{bounds,nodes,connections,components,stats:{sourceItems:refs.length,segments:segments.length,mergedConductors:merged.length,candidateBuses:buses.length,activeBuses:activeList.length,candidateLabels:labels.length,attachedLabels:attachments.length,components:components.length,minBusLength:minBus,attachThreshold:threshold}};
}
function alRefsInBounds(refs,bounds){return refs.filter(r=>alBoundsIntersect(alEntityBounds(r.item),bounds))}
function alStoreAutoLearnResult(result,refs,baseName,mode){
  const groups=new Map();for(const c of result.components){const sig=alTopologySignature(c);if(!groups.has(sig))groups.set(sig,[]);groups.get(sig).push(c)}
  const ranked=[...groups.values()].sort((a,b)=>b[0].labelCount-a[0].labelCount||b.length-a.length).slice(0,DWG_AUTO_LEARN_MAX_TOPOLOGIES),created=[];let geometryCount=0,index=0;
  for(const occurrences of ranked){const c=occurrences[0],labels=c.nodes.filter(n=>n.type!=='BUSBAR').map(n=>n.label),name=`${baseName} · ${String(++index).padStart(2,'0')} · ${labels.slice(0,3).join(' – ')||'cụm tuyến'}`,id=`dwg-auto-${Date.now().toString(36)}-${index}`,model=alNormalizeComponent(c,name);model.source={method:'DWG_AUTO_LEARN_V1',mode,occurrenceCount:occurrences.length,bounds:c.bounds,stats:result.stats};const topology={id,name,kind:'topology',createdAt:new Date().toISOString(),model,sourceBounds:c.bounds,autoLearn:{version:DWG_AUTO_LEARN_VERSION,occurrenceCount:occurrences.length,confidence:'suggested'}};learnedElectricalTemplates.push(topology);created.push(topology);
    if(geometryCount<5){const gb=alExpandBounds(c.bounds,Math.max(8,Math.min(30,Math.max(c.bounds.maxX-c.bounds.minX,c.bounds.maxY-c.bounds.minY)*.08))),grefs=alRefsInBounds(refs,gb);if(grefs.length&&grefs.length<=DWG_AUTO_LEARN_MAX_GEOMETRY_ITEMS){const geo={id:`${id}-geometry`,name:`${name} · hình học`,kind:'geometry',createdAt:new Date().toISOString(),sourceBounds:gb,items:grefs.map(r=>({kind:r.kind,item:clone(r.item)})),autoLearn:{version:DWG_AUTO_LEARN_VERSION,topologyId:id,occurrenceCount:occurrences.length}};learnedElectricalTemplates.push(geo);created.push(geo);geometryCount++}}
  }
  saveLearnedTemplates();return created;
}
function autoLearnDwgScope(mode='selection'){
  try{
    const refs=alScopeRefs(mode);if(!refs.length){alert(mode==='selection'?'Hãy kéo vùng hoặc dùng Chọn liên kết để chọn phần bản vẽ cần học.':'Bản vẽ hiện không có đối tượng.');return}
    if(mode==='drawing'&&refs.length>15000&&!confirm(`Phân tích toàn bộ ${refs.length.toLocaleString('vi-VN')} đối tượng có thể mất vài giây. Tiếp tục?`))return;
    const defaultName=mode==='selection'?`Mẫu DWG vùng chọn ${learnedElectricalTemplates.length+1}`:`${project?.sourceFile||project?.name||'DWG'} · tự học`,baseName=prompt('Tên nhóm mẫu tự học:',defaultName)?.trim();if(!baseName)return;
    updateElectricalGridStatus(`Đang nhận tuyến dẫn, nhãn và thành phần liên kết từ ${refs.length.toLocaleString('vi-VN')} đối tượng…`);
    setTimeout(()=>{try{const result=inferRawDwgTopologies(refs,baseName);if(!result.components.length){alert('Chưa suy ra được thành phần topology có nhãn. Hãy chọn phạm vi nhỏ hơn hoặc kiểm tra layer tuyến dẫn.');return}const created=alStoreAutoLearnResult(result,refs,baseName,mode);const first=created.find(x=>x.kind==='topology');if(first){$('gridLearnedTemplateSelect').value=first.id;electricalGridImportModel=deepGridClone(first.model);electricalGridSourceName=first.name;electricalGridLayoutResult=null;prepareElectricalGridLayout()}updateElectricalGridStatus(`Đã sinh ${created.filter(x=>x.kind==='topology').length} topology mẫu và ${created.filter(x=>x.kind==='geometry').length} mẫu hình học. Nhận ${result.stats.attachedLabels}/${result.stats.candidateLabels} nhãn, ${result.stats.activeBuses} tuyến dẫn, ${result.stats.components} thành phần. Hãy mở “Sửa topology mẫu” để duyệt lại loại thiết bị và liên kết.`,'success')}catch(err){console.error(err);alert('Không thể tự học DWG: '+err.message);updateElectricalGridStatus('Tự học DWG thất bại: '+err.message,'error')}},30)
  }catch(err){console.error(err);alert('Không thể bắt đầu tự học: '+err.message)}
}
function exportDwgAutoLearnPackage(){const source=learnedElectricalTemplates.filter(t=>t?.autoLearn||t?.model?.source?.method==='DWG_AUTO_LEARN_V1');if(!source.length){alert('Chưa có mẫu nào được sinh bằng cơ chế tự học DWG.');return}const payload={schema:'DwgSketchAutoLearnPackage',version:1,generatedAt:new Date().toISOString(),sourceFile:project?.sourceFile||'',templates:source};const blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json;charset=utf-8'}),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=(project?.sourceFile||'dwg').replace(/\.[^.]+$/,'')+'_auto_learn_package.json';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000)}
async function loadBundledLdTinhTemplates(){try{const res=await fetch('./samples/LD_Tinh_AutoLearn/PWA_learned_templates.json',{cache:'no-store'});if(!res.ok)throw new Error(`HTTP ${res.status}`);const list=await res.json();if(!Array.isArray(list))throw new Error('Dữ liệu mẫu không phải danh sách.');const ids=new Set(learnedElectricalTemplates.map(x=>x.id));let added=0;for(const t of list)if(t&&t.id&&!ids.has(t.id)){learnedElectricalTemplates.push(t);ids.add(t.id);added++}saveLearnedTemplates();updateElectricalGridStatus(`Đã nạp ${added} mẫu thực tế học từ LD Tinh (1)(3).dwg.`,'success')}catch(err){console.error(err);alert('Không nạp được bộ mẫu kèm theo: '+err.message)}}
function initializeDwgAutoLearningV0174(){
  $('gridAutoLearnSelectionBtn')?.addEventListener('click',()=>autoLearnDwgScope('selection'));
  $('gridAutoLearnDrawingBtn')?.addEventListener('click',()=>autoLearnDwgScope('drawing'));
  $('gridExportAutoLearnBtn')?.addEventListener('click',exportDwgAutoLearnPackage);
  $('gridLoadLdTinhSamplesBtn')?.addEventListener('click',loadBundledLdTinhTemplates);
}
initializeDwgAutoLearningV0174();
