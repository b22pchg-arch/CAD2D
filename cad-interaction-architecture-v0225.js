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
  if(previousRotateSelected){const wrapped=function(deg){if(!(selected||[]).length)return;const tx=captureSelectionDelta('ROTATE');try{const c=selectionCenter();selected.forEach(s=>rotateItem(s.item,c,deg));recalcBounds();finalizeSelectionDelta(tx,`Đã xoay ${deg}° bằng transaction delta.`);updateSelectionPanel();draw()}catch(err){cancelTransaction();throw err}};try{rotateSelected=wrapped}catch{window.rotateSelected=wrapped}}
  const scaleApply=document.getElementById('scaleApply');if(scaleApply)scaleApply.onclick=()=>{const f=num(document.getElementById('scaleFactorInput')?.value,NaN);if(!(f>0&&Number.isFinite(f))){alert('Hệ số SCALE phải là số dương.');return}const base=scaleBasePoint||selectionCenter(),tx=captureSelectionDelta('SCALE');try{selected.forEach(s=>scaleItem(s.item,base,f));recalcBounds();finalizeSelectionDelta(tx,`Đã SCALE ${selected.length} đối tượng × ${f} bằng transaction delta.`);scaleBasePoint=null;document.getElementById('scaleModal')?.classList.remove('show');setTool('select');updateSelectionPanel();draw()}catch(err){cancelTransaction();throw err}};
  const rotateApply=document.getElementById('rotateApply');if(rotateApply)rotateApply.addEventListener('click',e=>{e.preventDefault();e.stopImmediatePropagation();const angle=num(document.getElementById('rotateAngleInput')?.value,NaN),base={x:num(document.getElementById('rotateBaseX')?.value,NaN),y:num(document.getElementById('rotateBaseY')?.value,NaN)};if(!Number.isFinite(angle)||!Number.isFinite(base.x)||!Number.isFinite(base.y)){alert('Góc quay và tọa độ điểm gốc phải là số hợp lệ.');return}const tx=captureSelectionDelta('ROTATE');try{selected.forEach(s=>rotateItem(s.item,base,angle));try{syncElectricalAutomationFromSymbols()}catch{}recalcBounds();finalizeSelectionDelta(tx,`Đã ROTATE ${selected.length} đối tượng ${angle}° bằng transaction delta.`);document.getElementById('rotateModal')?.classList.remove('show');updateSelectionPanel();draw()}catch(err){cancelTransaction();throw err}},true);

  const previousMirrorSelected=typeof mirrorSelected==='function'?mirrorSelected:null;
  if(previousMirrorSelected){const wrapped=function(a,b){if(!(selected||[]).length){try{status('Hãy chọn đối tượng trước khi dùng Đối xứng.');setTool('select')}catch{}return}if(typeof dist==='function'&&dist(a,b)<1e-9){try{status('Trục đối xứng không hợp lệ.')}catch{}return}const tx=captureSelectionDelta('MIRROR');try{selected.forEach(s=>mirrorItem(s.item,a,b));recalcBounds();finalizeSelectionDelta(tx,`Đã MIRROR ${selected.length} đối tượng bằng transaction delta.`);try{syncElectricalAutomationFromSymbols()}catch{}setTool('select');updateSelectionPanel();draw()}catch(err){cancelTransaction();throw err}};try{mirrorSelected=wrapped}catch{window.mirrorSelected=wrapped}}

  const previousApplyProperties=typeof applyProperties==='function'?applyProperties:null,applyBtn=document.getElementById('applyBtn');
  if(previousApplyProperties&&applyBtn)applyBtn.onclick=()=>{if(!(selected||[]).length)return previousApplyProperties();const tx=captureSelectionDelta('PROPERTIES'),previousSimpleAction=typeof simpleAction==='function'?simpleAction:null;try{if(previousSimpleAction){simpleAction=function(_label,fn){fn();recalcBounds();updateSelectionPanel();draw()}}previousApplyProperties();finalizeSelectionDelta(tx,'Đã áp dụng thuộc tính bằng transaction delta.');updateSelectionPanel();draw()}catch(err){cancelTransaction();throw err}finally{if(previousSimpleAction)try{simpleAction=previousSimpleAction}catch{window.simpleAction=previousSimpleAction}}};

  registerCommand('ARCHINFO',()=>report(false),'ARCH','COREINFO');registerCommand('ARCHCHECK',()=>report(true),'CORECHECK');registerCommand('TXINFO',()=>reportTransactions(),'HISTORYINFO','DELTAINFO');

  window.DwgSketchCadArchitectureV0225={version:API_VERSION,registerCommand,snapshot,health,report,reportTransactions,beginTransaction,commitTransaction,cancelTransaction,
    selection:{clear:clearSelection,replace:replaceSelection,single:selectSingle,toggle:toggleSelection,sync:syncSelection},
    transaction:{captureSelectionDelta,finalizeSelectionDelta,noteDelta,beginStructuralAdd,commitStructuralAdd,cancelStructuralAdd,beginStructuralRemove,commitStructuralRemove,cancelStructural,applyStructural,beginCurveEdit,commitCurveEdit,cancelCurveEdit,applyCurveEdit},noteSelection:syncSelection,noteGeometry(){state.geometryInvalidations++;state.entityRevision++},noteRender(){state.renderRequests++}};
  console.info(`[DWG Sketch] CAD Interaction Architecture ${API_VERSION} ready.`);
})();
