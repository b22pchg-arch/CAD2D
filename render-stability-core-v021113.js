'use strict';
// DWG Sketch PWA V0.21.11.3 - Large Drawing Render Stability Core.
// Keeps the last complete static scene and redraws only transient interaction overlays
// (crosshair, snap, selection/grips, previews) when geometry/view has not changed.
// During pan/zoom the previous complete frame is transformed immediately, then an
// exact scene is rebuilt after interaction settles. This avoids blank/partial-looking
// frames on very large drawings without changing DWG geometry or project data.
(() => {
  const VERSION='0.21.11.3';
  const SETTLE_MS=90;
  const VIEW_EPS=1e-10;
  const originalRender=renderCanvasNow;
  const originalInvalidate=typeof invalidateGeometryCaches==='function'?invalidateGeometryCaches:null;
  const originalRecalc=typeof recalcBounds==='function'?recalcBounds:null;

  const buffer=document.createElement('canvas');
  const bufferCtx=buffer.getContext('2d',{alpha:false});
  let cacheValid=false;
  let cacheSceneKey='';
  let cacheView=null;
  let settleTimer=0;
  let forceExact=false;
  let rebuilding=false;
  let exactBuilds=0,fastComposites=0,transformedComposites=0,lastExactMs=0;
  let projectIds=new WeakMap(),nextProjectId=1;

  function projectId(){
    if(!project||typeof project!=='object')return 0;
    let id=projectIds.get(project);if(!id){id=nextProjectId++;projectIds.set(project,id)}return id;
  }
  function controlKey(id){const e=$(id);if(!e)return'';return e.type==='checkbox'?(e.checked?'1':'0'):String(e.value??'')}
  function sceneKey(){
    const layers=[...visibleLayers].sort().join('\u001f');
    const display=[
      'darkCheck','overlayCheck','colorCheck','coordinateGridCheck','coordinateGridSpacingX','coordinateGridSpacingY',
      'coordinateGridOriginX','coordinateGridOriginY','coordinateGridMajorEvery'
    ].map(controlKey).join('\u001e');
    return [projectId(),geometryRevision,entities.length,overlays.length,canvas.width,canvas.height,dpr,layers,display].join('\u001d');
  }
  function currentView(){return{scale,offsetX,offsetY,w:viewportWidth||canvas.clientWidth||1,h:viewportHeight||canvas.clientHeight||1,dpr}}
  function sameView(a,b){return !!a&&!!b&&Math.abs(a.scale-b.scale)<=VIEW_EPS*Math.max(1,Math.abs(b.scale))&&Math.abs(a.offsetX-b.offsetX)<=1e-7&&Math.abs(a.offsetY-b.offsetY)<=1e-7&&Math.abs(a.w-b.w)<.01&&Math.abs(a.h-b.h)<.01&&a.dpr===b.dpr}
  function invalidateStatic(){cacheValid=false;cacheSceneKey='';forceExact=true}
  function ensureBuffer(){if(buffer.width!==canvas.width||buffer.height!==canvas.height){buffer.width=canvas.width;buffer.height=canvas.height;cacheValid=false}}

  function withStaticOnly(fn){
    const oldPreview=preview,oldSelectionBox=selectionBox,oldSnap=snapPoint,oldRepair=repairPreviewEnabled,oldCursor=cadCursor;
    const oldSelectionPainter=drawSelectionHighlights,frameEl=$('frameCheck'),oldFrame=frameEl?.checked;
    try{
      preview=null;selectionBox=null;snapPoint=null;repairPreviewEnabled=false;
      // Keep `selected` intact: Interaction Core uses it to inject live moving/grip
      // entities into a temporarily stale spatial index. Only suppress its painter.
      drawSelectionHighlights=()=>{};
      cadCursor={...cadCursor,inside:false};if(frameEl)frameEl.checked=false;
      return fn();
    }finally{
      preview=oldPreview;selectionBox=oldSelectionBox;snapPoint=oldSnap;repairPreviewEnabled=oldRepair;cadCursor=oldCursor;drawSelectionHighlights=oldSelectionPainter;
      if(frameEl&&oldFrame!==undefined)frameEl.checked=oldFrame;
    }
  }

  function captureExact(){
    ensureBuffer();rebuilding=true;const started=performance.now();
    try{
      withStaticOnly(()=>originalRender());
      bufferCtx.setTransform(1,0,0,1,0,0);bufferCtx.clearRect(0,0,buffer.width,buffer.height);bufferCtx.drawImage(canvas,0,0);
      cacheView=currentView();cacheSceneKey=sceneKey();cacheValid=true;forceExact=false;exactBuilds++;lastExactMs=performance.now()-started;
    }finally{rebuilding=false}
  }

  function fillBackground(){
    const w=viewportWidth||canvas.clientWidth||1,h=viewportHeight||canvas.clientHeight||1;
    ctx.setTransform(dpr,0,0,dpr,0,0);ctx.fillStyle=$('darkCheck').checked?'#202124':'#fff';ctx.fillRect(0,0,w,h);
  }
  function blitExact(){
    ctx.setTransform(1,0,0,1,0,0);ctx.drawImage(buffer,0,0);ctx.setTransform(dpr,0,0,dpr,0,0);fastComposites++;
  }
  function blitTransformed(){
    const v=currentView(),base=cacheView;if(!base||!(base.scale>0)){captureExact();blitExact();return}
    const ratio=v.scale/base.scale,tx=v.offsetX-ratio*base.offsetX,ty=v.offsetY-ratio*base.offsetY;
    fillBackground();ctx.save();ctx.setTransform(dpr*ratio,0,0,dpr*ratio,dpr*tx,dpr*ty);ctx.imageSmoothingEnabled=true;ctx.drawImage(buffer,0,0,base.w,base.h);ctx.restore();ctx.setTransform(dpr,0,0,dpr,0,0);transformedComposites++;
  }
  function drawDynamic(){
    if(!project){return}
    if(preview)drawPreview();
    if(selectionBox)drawSelectionBox(selectionBox);
    if($('frameCheck').checked&&validBounds(project.exportRegion))drawFrame(project.exportRegion);
    drawSelectionHighlights();
    drawRepairPreview();
    drawCadCrosshair();
    if(snapPoint)drawSnap(snapPoint);else drawSnap(null);
  }
  function scheduleExact(){
    if(settleTimer)clearTimeout(settleTimer);
    settleTimer=setTimeout(()=>{settleTimer=0;forceExact=true;draw()},SETTLE_MS);
  }

  renderCanvasNow=function renderCanvasNowV021113(){
    if(rebuilding)return originalRender();
    ensureBuffer();const key=sceneKey(),view=currentView();
    if(!cacheValid||cacheSceneKey!==key||forceExact){captureExact();blitExact();drawDynamic();return}
    if(sameView(cacheView,view)){blitExact();drawDynamic();return}
    // View-only change: never clear to an empty frame. Reproject the last complete
    // scene immediately and build the exact viewport once wheel/pan/pinch settles.
    blitTransformed();drawDynamic();scheduleExact();
  };

  if(originalInvalidate){
    invalidateGeometryCaches=function invalidateGeometryCachesV021113(...args){invalidateStatic();return originalInvalidate(...args)};
  }
  if(originalRecalc){
    recalcBounds=function recalcBoundsV021113(...args){invalidateStatic();return originalRecalc(...args)};
  }

  // A display/layer control may alter the static scene without changing geometryRevision.
  for(const id of ['darkCheck','overlayCheck','colorCheck','coordinateGridCheck','coordinateGridSpacingX','coordinateGridSpacingY','coordinateGridOriginX','coordinateGridOriginY','coordinateGridMajorEvery']){
    $(id)?.addEventListener('change',invalidateStatic,{capture:true});
  }
  document.getElementById('layerList')?.addEventListener('change',invalidateStatic,{capture:true});

  // Chrome's desynchronized canvas path can tear on expensive frames. The main canvas
  // is created without that hint in V0.21.11.3; expose diagnostics for field testing.
  window.DwgSketchRenderStabilityV021113=Object.freeze({
    version:VERSION,
    invalidate:invalidateStatic,
    stats:()=>({cacheValid,exactBuilds,fastComposites,transformedComposites,lastExactMs,sceneItems:(entities?.length||0)+(overlays?.length||0)})
  });
  console.info(`[DWG Sketch] Large Drawing Render Stability Core ${VERSION} active.`);
})();
