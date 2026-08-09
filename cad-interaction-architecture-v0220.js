'use strict';
(()=>{
  const API_VERSION='0.22.0';
  const state={
    commandRequests:0, commandHandled:0, renderRequests:0, geometryInvalidations:0,
    selectionRevision:0, entityRevision:0, historyUndo:0, historyRedo:0,
    transactionsStarted:0, transactionsCommitted:0, transactionsCanceled:0,
    activeTransaction:null, lastCommandMs:0, lastSelectionKey:''
  };
  const commands=new Map();
  const aliases=new Map();
  const norm=v=>String(v??'').trim().toUpperCase();

  function registerCommand(canonical,handler,...names){
    canonical=norm(canonical);if(!canonical||typeof handler!=='function')return false;
    commands.set(canonical,handler);aliases.set(canonical,canonical);
    for(const n of names.flat())if(norm(n))aliases.set(norm(n),canonical);
    return true;
  }
  function selectionKey(){
    try{return `${selected?.length||0}|${(selected||[]).map(x=>String(x?.kind||'')+':'+String(x?.item?.sourceHandle||x?.item?.handle||x?.item?.blockInstanceId||x?.item?.a4TemplateInstanceId||'')).join(';')}`}
    catch{return '0|'}
  }
  function syncSelection(){const k=selectionKey();if(k!==state.lastSelectionKey){state.lastSelectionKey=k;state.selectionRevision++}}
  function beginTransaction(name='EDIT'){state.transactionsStarted++;state.activeTransaction=String(name||'EDIT')}
  function commitTransaction(){if(!state.activeTransaction)return;state.transactionsCommitted++;state.activeTransaction=null}
  function cancelTransaction(){if(!state.activeTransaction)return;state.transactionsCanceled++;state.activeTransaction=null}

  function snapshot(){
    syncSelection();
    let entityCount=0,overlayCount=0,selectedCount=0;
    try{entityCount=entities?.length||0}catch{}
    try{overlayCount=overlays?.length||0}catch{}
    try{selectedCount=selected?.length||0}catch{}
    return{apiVersion:API_VERSION,entityRevision:state.entityRevision,selectionRevision:state.selectionRevision,
      entityCount,overlayCount,selectedCount,renderRequests:state.renderRequests,
      geometryInvalidations:state.geometryInvalidations,commandRequests:state.commandRequests,
      commandHandled:state.commandHandled,historyUndo:state.historyUndo,historyRedo:state.historyRedo,
      transactionsStarted:state.transactionsStarted,transactionsCommitted:state.transactionsCommitted,
      transactionsCanceled:state.transactionsCanceled,activeTransaction:state.activeTransaction,
      lastCommandMs:+state.lastCommandMs.toFixed(3)};
  }
  function health(){
    const s=snapshot();let projectEntities=s.entityCount,projectOverlays=s.overlayCount;
    try{projectEntities=project?.entities?.length??s.entityCount;projectOverlays=project?.overlays?.length??s.overlayCount}catch{}
    const ok=projectEntities===s.entityCount&&projectOverlays===s.overlayCount;
    return{ok,snapshot:s,checks:{entityArray:projectEntities===s.entityCount,overlayArray:projectOverlays===s.overlayCount,commandFallback:typeof originalCommand==='function',renderPipeline:typeof originalDraw==='function'}};
  }
  function report(check=false){
    const h=health(),s=h.snapshot;
    const text=`CAD_ARCH_V0220 | Entity rev=${s.entityRevision} | Selection rev=${s.selectionRevision} | Selected=${s.selectedCount} | Render req=${s.renderRequests} | Geometry invalidations=${s.geometryInvalidations} | Commands=${s.commandHandled}/${s.commandRequests} | Undo/Redo=${s.historyUndo}/${s.historyRedo} | Tx=${s.transactionsCommitted}/${s.transactionsStarted} | Health=${h.ok?'OK':'CHECK'}`;
    try{status((check?'ARCHCHECK: ':'')+text)}catch{console.info(text)}
    return h;
  }

  const originalCommand=typeof command==='function'?command:null;
  if(originalCommand){
    const wrapped=function(cmd){
      const key=norm(cmd);state.commandRequests++;syncSelection();
      const canonical=aliases.get(key);
      if(canonical&&commands.has(canonical)){
        const t=performance.now();let result;
        try{result=commands.get(canonical)()}finally{state.lastCommandMs=performance.now()-t}
        state.commandHandled++;try{if(key&&typeof addCommandHistory==='function')addCommandHistory(key);if(typeof $==='function'&&$('commandInput'))$('commandInput').value=''}catch{}
        return result;
      }
      const t=performance.now();try{return originalCommand(cmd)}finally{state.lastCommandMs=performance.now()-t;syncSelection()}
    };
    try{command=wrapped}catch{window.command=wrapped}
  }

  const originalDraw=typeof draw==='function'?draw:null;
  if(originalDraw){const wrapped=function(...args){state.renderRequests++;syncSelection();return originalDraw.apply(this,args)};try{draw=wrapped}catch{window.draw=wrapped}}
  const originalInvalidate=typeof invalidateGeometryCaches==='function'?invalidateGeometryCaches:null;
  if(originalInvalidate){const wrapped=function(...args){state.geometryInvalidations++;state.entityRevision++;return originalInvalidate.apply(this,args)};try{invalidateGeometryCaches=wrapped}catch{window.invalidateGeometryCaches=wrapped}}
  const originalUndo=typeof undo==='function'?undo:null;
  if(originalUndo){const wrapped=function(...args){state.historyUndo++;return originalUndo.apply(this,args)};try{undo=wrapped}catch{window.undo=wrapped}}
  const originalRedo=typeof redo==='function'?redo:null;
  if(originalRedo){const wrapped=function(...args){state.historyRedo++;return originalRedo.apply(this,args)};try{redo=wrapped}catch{window.redo=wrapped}}

  registerCommand('ARCHINFO',()=>report(false),'ARCH','COREINFO');
  registerCommand('ARCHCHECK',()=>report(true),'CORECHECK');

  window.DwgSketchCadArchitectureV0220={
    version:API_VERSION,registerCommand,snapshot,health,report,beginTransaction,commitTransaction,cancelTransaction,
    noteSelection:syncSelection,noteGeometry(){state.geometryInvalidations++;state.entityRevision++},
    noteRender(){state.renderRequests++}
  };
  console.info(`[DWG Sketch] CAD Interaction Architecture ${API_VERSION} ready.`);
})();
