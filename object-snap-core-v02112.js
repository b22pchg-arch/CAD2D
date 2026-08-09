'use strict';
// DWG Sketch PWA V0.21.12 - Object Snap Core.
// Spatially queries local snap geometry, stabilizes dense snap points and draws
// a true screen-pixel aperture without rebuilding the static drawing scene.
(() => {
  const VERSION='0.21.12';
  const MIN_TOL=5,MAX_TOL=48,HOLD_FACTOR=1.32,SWITCH_ADVANTAGE=2.25;
  const originalDrawSnap=drawSnap;
  let indexedSource=null,grid=null,largeEntries=[],cellSize=1;
  let stable=null;
  let queryCount=0,lastLocalCount=0,lastPoolCount=0,lastIntersectionInput=0,lastExactIntersectionChecks=0,lastMs=0,indexBuildMs=0,indexCells=0;

  function clampTol(v){v=num(v,14);return Math.max(MIN_TOL,Math.min(MAX_TOL,Number.isFinite(v)?v:14))}
  function cellKey(x,y){return x+'|'+y}
  function chooseCellSize(entries){
    let b=null;
    try{b=validBounds(project?.drawingBounds)?normalizeBounds(project.drawingBounds):computeBounds()}catch{}
    if(!b||!Number.isFinite(b.minX))return 1;
    const span=Math.max(Math.abs(b.maxX-b.minX),Math.abs(b.maxY-b.minY),1e-9);
    const target=Math.max(12,Math.min(160,Math.sqrt(Math.max(1,entries.length)/6)));
    return Math.max(span/target,1e-9);
  }
  function ensureGeometryIndex(){
    const source=getSnapGeometry();
    if(source===indexedSource&&grid)return source;
    const started=performance.now();
    indexedSource=source;grid=new Map();largeEntries=[];cellSize=chooseCellSize(source);
    const maxCellsPerEntry=96;
    for(const entry of source){
      const b=entry?.bounds;if(!b)continue;
      const x0=Math.floor(b.minX/cellSize),x1=Math.floor(b.maxX/cellSize),y0=Math.floor(b.minY/cellSize),y1=Math.floor(b.maxY/cellSize);
      const cells=(x1-x0+1)*(y1-y0+1);
      if(!Number.isFinite(cells)||cells>maxCellsPerEntry){largeEntries.push(entry);continue}
      for(let x=x0;x<=x1;x++)for(let y=y0;y<=y1;y++){const k=cellKey(x,y);let a=grid.get(k);if(!a)grid.set(k,a=[]);a.push(entry)}
    }
    indexCells=grid.size;indexBuildMs=performance.now()-started;
    return source;
  }
  function queryLocalGeometry(p,t){
    ensureGeometryIndex();
    const x0=Math.floor((p.x-t)/cellSize),x1=Math.floor((p.x+t)/cellSize),y0=Math.floor((p.y-t)/cellSize),y1=Math.floor((p.y+t)/cellSize);
    const seen=new Set(),out=[];
    for(let x=x0;x<=x1;x++)for(let y=y0;y<=y1;y++)for(const e of grid.get(cellKey(x,y))||[]){if(seen.has(e))continue;seen.add(e);if(boundsNear(e.bounds,p,t))out.push(e)}
    for(const e of largeEntries){if(seen.has(e))continue;if(boundsNear(e.bounds,p,t))out.push(e)}
    return out;
  }
  function arcAccept(entry,q){
    if(entry.type!=='ARC')return true;
    const e=entry.item,c=point(e.center),a=normalizeAngle(Math.atan2(q.y-c.y,q.x-c.x)*180/Math.PI);
    return angleOnArc(a,num(e.startDeg),num(e.endDeg));
  }
  function segmentCirclePoints(seg,entry){
    const e=entry.item,c=point(e.center),r=Math.abs(num(e.radius)),dx=seg.b.x-seg.a.x,dy=seg.b.y-seg.a.y,fx=seg.a.x-c.x,fy=seg.a.y-c.y,a=dx*dx+dy*dy;
    if(!(r>0&&a>1e-24))return[];
    const b=2*(fx*dx+fy*dy),cc=fx*fx+fy*fy-r*r,disc=b*b-4*a*cc;if(disc< -1e-12)return[];
    const root=Math.sqrt(Math.max(0,disc)),den=2*a,out=[];
    for(const u0 of[(-b-root)/den,(-b+root)/den]){if(u0< -1e-9||u0>1+1e-9)continue;const u=Math.max(0,Math.min(1,u0)),q={x:seg.a.x+u*dx,y:seg.a.y+u*dy};if(arcAccept(entry,q)&&!out.some(x=>dist(x,q)<1e-10))out.push(q)}
    return out;
  }
  function circleCirclePoints(ae,be){
    const a=ae.item,b=be.item,c1=point(a.center),c2=point(b.center),r1=Math.abs(num(a.radius)),r2=Math.abs(num(b.radius)),dx=c2.x-c1.x,dy=c2.y-c1.y,d=Math.hypot(dx,dy);
    if(!(r1>0&&r2>0&&d>1e-12)||d>r1+r2+1e-9||d<Math.abs(r1-r2)-1e-9)return[];
    const x=(r1*r1-r2*r2+d*d)/(2*d),h2=r1*r1-x*x;if(h2< -1e-9)return[];const h=Math.sqrt(Math.max(0,h2)),ux=dx/d,uy=dy/d,m={x:c1.x+x*ux,y:c1.y+x*uy},out=[];
    for(const s of h>1e-12?[1,-1]:[1]){const q={x:m.x-s*uy*h,y:m.y+s*ux*h};if(arcAccept(ae,q)&&arcAccept(be,q))out.push(q)}return out;
  }
  function exactCircularIntersections(local,p,worldTol,pool){
    const circles=local.filter(e=>e.type==='CIRCLE'||e.type==='ARC'),others=local.filter(e=>e.type!=='CIRCLE'&&e.type!=='ARC');lastExactIntersectionChecks=0;
    for(const c of circles)for(const e of others)for(const seg of e.segments||[]){lastExactIntersectionChecks++;for(const q of segmentCirclePoints(seg,c))if(dist(q,p)<=worldTol*1.08)addSnapCandidate(pool,q,'Giao điểm','intersection')}
    for(let i=0;i<circles.length;i++)for(let j=i+1;j<circles.length;j++){lastExactIntersectionChecks++;for(const q of circleCirclePoints(circles[i],circles[j]))if(dist(q,p)<=worldTol*1.08)addSnapCandidate(pool,q,'Giao điểm','intersection')}
  }
  function dedupePool(pool,tol){
    const px=Math.max(1.2,Math.min(2.2,tol*.12)),seen=new Map(),out=[];
    for(const c of pool){
      const s=screenPoint(c.point),k=`${c.kind}|${Math.round(s.x/px)}|${Math.round(s.y/px)}`,old=seen.get(k);
      if(!old){seen.set(k,c);out.push(c);continue}
      if((c.priority??5)<(old.priority??5)){const i=out.indexOf(old);if(i>=0)out[i]=c;seen.set(k,c)}
    }
    return out;
  }
  const MAGNET={intersection:10,perpendicular:9,endpoint:8,midpoint:6,center:5,quadrant:5,insert:5,nearest:0};
  function score(c,screen,tol){
    const d=dist(screen,screenPoint(c.point)),bonus=Math.min(MAGNET[c.kind]??3,tol*.58);
    return{d,score:d-bonus}
  }
  function sameStableCandidate(c){
    if(!stable||c.kind!==stable.kind)return false;
    return dist(screenPoint(c.point),screenPoint(stable.point))<=2.5;
  }
  function chooseStable(pool,screen,tol){
    let best=null,bscore=Infinity,bd=Infinity;
    for(const c of pool){const q=score(c,screen,tol);if(q.d>tol)continue;if(q.score<bscore-1e-9||(Math.abs(q.score-bscore)<=1e-9&&q.d<bd)){best=c;bscore=q.score;bd=q.d}}
    if(!best){stable=null;return null}
    if(stable){
      let previous=null;
      for(const c of pool)if(sameStableCandidate(c)){previous=c;break}
      if(previous){
        const q=score(previous,screen,tol);
        if(q.d<=tol*HOLD_FACTOR&&q.score<=bscore+SWITCH_ADVANTAGE)best=previous;
      }
    }
    stable={point:{x:best.point.x,y:best.point.y},kind:best.kind,label:best.label};
    return best;
  }

  snap=function snapV02112(worldPoint,screen,base=null){
    const started=performance.now(),gridPoint=coordinateGridSnap(worldPoint);
    if(!$('snapCheck').checked||!project){snapPoint=null;stable=null;return gridPoint}
    const tol=clampTol($('snapTolerance').value),worldTol=tol/Math.max(scale,1e-9),candidates=getSnapCandidates(),pool=[],minX=worldPoint.x-worldTol,maxX=worldPoint.x+worldTol;
    for(let i=snapLowerBound(candidates,minX);i<candidates.length&&candidates[i].point.x<=maxX;i++){const c=candidates[i];if(!snapKindEnabled(c.kind)||Math.abs(c.point.y-worldPoint.y)>worldTol)continue;pool.push(c)}
    const local=queryLocalGeometry(worldPoint,worldTol*1.35);lastLocalCount=local.length;
    if(snapKindEnabled('perpendicular')&&base)for(const entry of local)for(const q of perpendicularSnapsForEntry(entry,base))if(dist(q,worldPoint)<=worldTol*1.08)addSnapCandidate(pool,q,'Vuông góc','perpendicular',entry.item);
    if(snapKindEnabled('intersection')){lastIntersectionInput=local.length;exactCircularIntersections(local,worldPoint,worldTol,pool);dynamicIntersectionCandidates(local,worldPoint,worldTol,pool)}else{lastIntersectionInput=0;lastExactIntersectionChecks=0;}
    if(snapKindEnabled('nearest'))for(const entry of local){const q=nearestSnapForEntry(entry,worldPoint);if(q&&dist(q,worldPoint)<=worldTol*1.08)addSnapCandidate(pool,q,'Điểm trên đường','nearest',entry.item)}
    const compact=dedupePool(pool,tol);lastPoolCount=compact.length;
    const best=chooseStable(compact,screen,tol);snapPoint=best;queryCount++;lastMs=performance.now()-started;
    return best?best.point:gridPoint;
  };

  drawSnap=function drawSnapV02112(s){
    if(project&&$('snapCheck')?.checked&&cadCursor?.inside&&tool!=='pan'){
      const tol=clampTol($('snapTolerance').value);
      ctx.save();ctx.strokeStyle='rgba(0,229,255,.28)';ctx.lineWidth=1;ctx.setLineDash([]);ctx.beginPath();ctx.arc(cadCursor.x,cadCursor.y,tol,0,Math.PI*2);ctx.stroke();ctx.restore();
    }
    return originalDrawSnap(s);
  };

  function report(){
    const msg=`OSNAP PWA ${VERSION} · aperture ${clampTol($('snapTolerance').value)} px · local ${lastLocalCount} · pool ${lastPoolCount} · index ${indexCells} ô · query ${lastMs.toFixed(2)} ms`;
    status(msg);return msg;
  }

  const oldCommand=typeof command==='function'?command:null;
  // Command parser remains inline; index.html also routes OSNAPINFO directly.
  window.DwgSketchObjectSnapCoreV02112=Object.freeze({
    version:VERSION,
    rebuild:()=>{indexedSource=null;grid=null;largeEntries=[];stable=null;ensureGeometryIndex()},
    reset:()=>{stable=null},
    report,
    stats:()=>({version:VERSION,queries:queryCount,lastMs,lastLocalCount,lastPoolCount,lastIntersectionInput,lastExactIntersectionChecks,indexCells,indexBuildMs,largeEntries:largeEntries.length,tolerance:clampTol($('snapTolerance')?.value)})
  });
  console.info(`[DWG Sketch] Object Snap Core ${VERSION} active.`);
})();
