'use strict';
(() => {
  const API_VERSION='0.21.6';
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
  let altFrameSelection=false;

  function isA4Frame(item){return !!item&&(String(item.automationRole||'').toUpperCase()==='A4_TEMPLATE_FRAME'||String(item.layer||'').toUpperCase()==='A4_TEMPLATE_FRAME'||item.editableA4Frame===true)}
  function frameSelectionEnabled(){return q('a4TemplateSelectFrameV0216')?.checked===true||altFrameSelection}
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
  function saveCatalog(){catalog=normalizeCatalog(catalog);localStorage.setItem(STORAGE_KEY,JSON.stringify(catalog));}
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
    const orientation=q('a4TemplateOrientationV0216')?.value==='portrait'?'portrait':'landscape';
    const margin=Math.max(0,Math.min(n(q('a4TemplateMarginV0216')?.value,12),80));
    const anchorMode=q('a4TemplateAnchorV0216')?.value||'bottom-left';
    const includesFrame=q('a4TemplateFrameV0216')?.checked!==false;
    let normalized;try{normalized=normalizeToA4(items,orientation,margin,includesFrame)}catch(err){alert(err.message);return}
    const t=normalizeTemplate({id:uid('a4-template'),name,keywords:currentSourceName(),orientation,pageWidth:normalized.pageWidth,pageHeight:normalized.pageHeight,margin,anchorMode,insertionAnchor:anchorPoint(anchorMode,normalized.pageWidth,normalized.pageHeight),sourceScope:scope,sourceFile:currentSourceName(),includesFrame,createdAt:now(),updatedAt:now(),useCount:0,items:normalized.items});
    catalog.templates.push(t);saveCatalog();q('a4TemplateSearchV0216').value='';renderList(t.id);setStatus(`Đã lưu “${t.name}”: ${items.length} phần tử độc lập, chuẩn hóa A4 với hệ số ${normalized.factor.toFixed(3)}.`)
  }
  function matches(t,query){query=String(query||'').trim().toLocaleLowerCase('vi');if(!query)return true;return `${t.name} ${t.keywords} ${t.sourceFile}`.toLocaleLowerCase('vi').includes(query)}
  function selectedTemplate(){return catalog.templates.find(x=>x.id===q('a4TemplateSelectV0216')?.value)||null}
  function renderList(selectId){
    const sel=q('a4TemplateSelectV0216');if(!sel)return;
    const query=q('a4TemplateSearchV0216')?.value||'';lastSearch=query;
    const list=catalog.templates.filter(t=>matches(t,query));sel.innerHTML='';
    for(const t of list){const o=document.createElement('option');o.value=t.id;o.textContent=`${t.name} · A4 ${t.orientation==='portrait'?'dọc':'ngang'} · ${t.items.length} phần tử`;sel.appendChild(o)}
    if(selectId&&list.some(x=>x.id===selectId))sel.value=selectId;
    else if(list.length)sel.selectedIndex=0;
    renderStatusForSelection();
  }
  function setStatus(text){const e=q('a4TemplateStatusV0216');if(e)e.textContent=text;status?.(text)}
  function renderStatusForSelection(){const t=selectedTemplate();if(!t){setStatus(lastSearch?'Không tìm thấy mẫu phù hợp.':'Chưa có mẫu sơ đồ A4.');return}setStatus(`${t.name}: A4 ${t.orientation==='portrait'?'dọc':'ngang'}, ${t.items.length} phần tử độc lập, đã chèn ${t.useCount} lần.`)}
  function remapInstanceMetadata(items){
    const instanceId=uid('a4-instance'),groupMap=new Map(),nodeMap=new Map(),connectionMap=new Map();
    const mapped=(map,value,prefix)=>{value=String(value||'');if(!value)return'';if(!map.has(value))map.set(value,`${prefix}-${instanceId}-${map.size+1}`);return map.get(value)};
    for(const item of items){item.a4TemplateInstanceId=instanceId;item.automationGroupId=mapped(groupMap,item.automationGroupId,'group');item.automationId=mapped(nodeMap,item.automationId,'node');item.nodeId=mapped(nodeMap,item.nodeId,'node');item.automationConnectionId=mapped(connectionMap,item.automationConnectionId,'connection');item.connectionId=mapped(connectionMap,item.connectionId,'connection');item.automationFromNodeId=mapped(nodeMap,item.automationFromNodeId,'node');item.automationToNodeId=mapped(nodeMap,item.automationToNodeId,'node')}
    return items;
  }
  function previewItemsAt(pointValue){if(!pendingInsert)return[];const d={x:pointValue.x-pendingInsert.anchor.x,y:pointValue.y-pendingInsert.anchor.y};return pendingInsert.items.map(raw=>{const x=deep(raw);translateItem(x,d);return x})}
  function startInsert(){
    const t=selectedTemplate();if(!t){alert('Hãy tìm và chọn một mẫu A4 trước khi chèn.');return}
    cancelPending(false);
    const screen=lastPointer&&Number.isFinite(lastPointer.x)?lastPointer:{x:(viewportWidth||canvas.clientWidth||1)/2,y:(viewportHeight||canvas.clientHeight||1)/2};
    pendingInsert={templateId:t.id,templateName:t.name,anchor:deep(t.insertionAnchor),items:t.items.map(deep),bounds:boundsOfItems(t.items),current:world(screen.x,screen.y)};
    canvas.style.cursor='crosshair';draw();setStatus(`Đang chèn “${t.name}”. Di chuyển preview, bấm chuột trái để đặt; Esc để hủy.`)
  }
  function commitPending(worldPoint){
    if(!pendingInsert)return;
    const t=catalog.templates.find(x=>x.id===pendingInsert.templateId),created=remapInstanceMetadata(previewItemsAt(worldPoint).sort((a,b)=>(isA4Frame(a)?0:1)-(isA4Frame(b)?0:1)));
    simpleAction(`Chèn mẫu A4: ${pendingInsert.templateName}`,()=>{for(const item of created)overlays.push(item);selected=created.map(item=>refFor(item,'overlay'))});
    if(t){t.useCount++;t.updatedAt=now();saveCatalog()}
    const name=pendingInsert.templateName;pendingInsert=null;canvas.style.cursor='';updateSelectionPanel?.();draw();renderList(t?.id);setStatus(`Đã chèn “${name}” tại vị trí xác định. ${created.length} phần tử có thể chọn và sửa riêng.`)
  }
  function cancelPending(notify=true){if(!pendingInsert)return;pendingInsert=null;canvas.style.cursor='';draw();if(notify)setStatus('Đã hủy chèn mẫu A4.')}
  function renameTemplate(){const t=selectedTemplate();if(!t)return;const name=prompt('Đổi tên mẫu sơ đồ A4:',t.name)?.trim();if(!name)return;t.name=name;t.updatedAt=now();saveCatalog();renderList(t.id)}
  function deleteTemplate(){const t=selectedTemplate();if(!t)return;if(!confirm(`Xóa mẫu “${t.name}” khỏi thư viện dùng chung?`))return;catalog.templates=catalog.templates.filter(x=>x.id!==t.id);saveCatalog();renderList()}
  function downloadCatalog(){const blob=new Blob([JSON.stringify(normalizeCatalog(catalog),null,2)],{type:'application/json;charset=utf-8'}),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='DWG_Sketch_A4_Editable_Templates.a4templates.json';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);setStatus('Đã xuất thư viện mẫu sơ đồ A4.')}
  function importCatalog(file){const r=new FileReader();r.onload=()=>{try{const parsed=JSON.parse(String(r.result||''));if(parsed?.schema!==SCHEMA)throw new Error('Không phải thư viện mẫu sơ đồ A4 của DWG Sketch.');const incoming=normalizeCatalog(parsed);const by=new Map(catalog.templates.map(x=>[x.id,x]));for(const t of incoming.templates){const old=by.get(t.id);if(!old||String(t.updatedAt)>=String(old.updatedAt))by.set(t.id,t)}catalog.templates=[...by.values()];saveCatalog();renderList();setStatus(`Đã nhập ${incoming.templates.length} mẫu.`)}catch(err){alert('Không nhập được thư viện: '+err.message)}};r.readAsText(file)}
  function installUi(){
    if(q('a4TemplatePanelV0216')){renderList();return}
    const network=q('networkWorkspacePanelV0210');const before=network?.nextSibling||[...document.querySelectorAll('aside.panel.right .section')].find(x=>x.querySelector('h3')?.textContent.includes('Tự động tạo sơ đồ lưới'));if(!before?.parentNode)return;
    const box=document.createElement('div');box.id='a4TemplatePanelV0216';box.className='section';box.dataset.mobileGroup='create';box.innerHTML=`<h3>Thư viện mẫu sơ đồ A4 có thể chỉnh sửa — V0.17.6</h3><div class="muted">Lưu từ vùng chọn hoặc toàn bản vẽ, chuẩn hóa A4 và chèn lại dưới dạng các phần tử vector rời.</div><label class="full" style="display:block;margin-top:7px">Tìm theo tên mẫu<input id="a4TemplateSearchV0216" placeholder="Nhập tên, từ khóa hoặc tên bản vẽ nguồn"></label><label class="full" style="display:block;margin-top:6px">Mẫu đã lưu<select id="a4TemplateSelectV0216"></select></label><div class="form-grid" style="margin-top:6px"><label>Khổ<select id="a4TemplateOrientationV0216"><option value="landscape">A4 ngang</option><option value="portrait">A4 dọc</option></select></label><label>Lề (mm)<input id="a4TemplateMarginV0216" type="number" value="12" min="0" max="80" step="1"></label><label>Điểm neo<select id="a4TemplateAnchorV0216"><option value="bottom-left">Góc trái dưới</option><option value="center">Tâm khung</option><option value="top-left">Góc trái trên</option></select></label><label style="display:flex;align-items:center;gap:6px"><input id="a4TemplateFrameV0216" type="checkbox" checked> Kèm khung A4</label></div><label style="display:flex;align-items:center;gap:7px;margin-top:7px"><input id="a4TemplateSelectFrameV0216" type="checkbox"> Cho phép chọn khung A4 (chỉ tại đường viền)</label><div class="muted" style="margin-top:3px">Mặc định khung là lớp nền xuyên chọn; các đường, chữ và ký hiệu bên trong luôn nhận chuột trước.</div><div class="button-row" style="margin-top:7px"><button id="a4TemplateSaveSelectionV0216" class="primary">Lưu vùng chọn</button><button id="a4TemplateSaveDrawingV0216">Lưu toàn bản vẽ</button><button id="a4TemplateInsertV0216" class="primary">Chèn tại vị trí</button><button id="a4TemplateRenameV0216">Đổi tên</button><button id="a4TemplateDeleteV0216" class="danger">Xóa</button><button id="a4TemplateImportV0216">Nhập</button><button id="a4TemplateExportV0216">Xuất</button></div><input id="a4TemplateImportInputV0216" type="file" accept=".json,.a4templates.json,application/json" class="hidden"><div id="a4TemplateStatusV0216" class="muted" style="margin-top:6px"></div>`;
    before.parentNode.insertBefore(box,before);
    q('a4TemplateSearchV0216').addEventListener('input',()=>renderList());q('a4TemplateSelectV0216').addEventListener('change',renderStatusForSelection);q('a4TemplateSaveSelectionV0216').onclick=()=>saveTemplate('selection');q('a4TemplateSaveDrawingV0216').onclick=()=>saveTemplate('drawing');q('a4TemplateInsertV0216').onclick=startInsert;q('a4TemplateRenameV0216').onclick=renameTemplate;q('a4TemplateDeleteV0216').onclick=deleteTemplate;q('a4TemplateExportV0216').onclick=downloadCatalog;q('a4TemplateImportV0216').onclick=()=>q('a4TemplateImportInputV0216').click();q('a4TemplateImportInputV0216').onchange=e=>{const f=e.target.files?.[0];if(f)importCatalog(f);e.target.value=''};q('a4TemplateSelectFrameV0216').addEventListener('change',()=>{removePassThroughFramesFromSelection();setStatus(frameSelectionEnabled()?'Đã bật chọn khung A4: bấm đúng đường viền; phần tử bên trong vẫn được ưu tiên.':'Khung A4 đang là lớp nền xuyên chọn.')});renderList();
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
  function installInteractionHooks(){
    if(interactionHooksInstalled)return;interactionHooksInstalled=true;
    if(typeof renderCanvasNow==='function'&&!renderCanvasNow.__a4TemplateWrapped){const base=renderCanvasNow;const wrapped=function(){base.apply(this,arguments);if(pendingInsert){ctx.save();ctx.globalAlpha=.72;if(pendingInsert.items.length<=500){for(const item of previewItemsAt(pendingInsert.current))drawItem(item,true,'#31d7ff')}else if(pendingInsert.bounds){const d={x:pendingInsert.current.x-pendingInsert.anchor.x,y:pendingInsert.current.y-pendingInsert.anchor.y},b=pendingInsert.bounds;drawItem({type:'RECTANGLE',a:{x:b.minX+d.x,y:b.minY+d.y},b:{x:b.maxX+d.x,y:b.maxY+d.y},stroke:1.5,color:0xff31d7ff,layer:'A4_TEMPLATE_PREVIEW'},true,'#31d7ff');ctx.fillStyle='#31d7ff';ctx.font='13px Segoe UI';ctx.fillText(`${pendingInsert.items.length} phần tử`,sx(b.minX+d.x)+8,sy(b.maxY+d.y)+18)}ctx.restore()}};wrapped.__a4TemplateWrapped=true;renderCanvasNow=wrapped}
    canvas?.addEventListener('pointermove',e=>{if(!pendingInsert)return;const s=eventPos(e);pendingInsert.current=world(s.x,s.y);draw();e.preventDefault();e.stopImmediatePropagation()},{capture:true});
    canvas?.addEventListener('pointerdown',e=>{if(!pendingInsert||e.button!==0)return;const s=eventPos(e);commitPending(world(s.x,s.y));e.preventDefault();e.stopImmediatePropagation()},{capture:true});
    window.addEventListener('keydown',e=>{if(pendingInsert&&e.key==='Escape'){cancelPending(true);e.preventDefault();e.stopImmediatePropagation()}},{capture:true});
  }
  function installCommandHook(){if(typeof command!=='function'||command.__a4TemplateWrapped)return;const base=command;const wrapped=function(cmd){const c=String(cmd||'').trim().toUpperCase();if(c==='A4TPLSAVE'||c==='A4TS'){saveTemplate('selection');return}if(c==='A4TPLALL'||c==='A4TA'){saveTemplate('drawing');return}if(c==='A4TPLINSERT'||c==='A4TI'){startInsert();return}if(c==='A4FRAMESEL'||c==='A4FS'){const el=q('a4TemplateSelectFrameV0216');if(el){el.checked=!el.checked;el.dispatchEvent(new Event('change'))}return}return base.apply(this,arguments)};wrapped.__a4TemplateWrapped=true;command=wrapped}
  const api={version:API_VERSION,schema:SCHEMA,getCatalog:()=>normalizeCatalog(deep(catalog)),saveSelection:()=>saveTemplate('selection'),saveDrawing:()=>saveTemplate('drawing'),insert:startInsert,cancel:cancelPending,refresh:renderList,toggleFrameSelection:()=>command('A4FRAMESEL')};
  window.DwgSketchA4DiagramTemplateCoreV0216=api;
  const boot=()=>{installUi();installSelectionPassThroughHooks();installInteractionHooks();installCommandHook()};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
  setTimeout(boot,1600);
})();
