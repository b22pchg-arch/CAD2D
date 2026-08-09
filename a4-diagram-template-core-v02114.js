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
