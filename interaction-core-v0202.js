/* DWG Sketch PWA 0.20.2 - Entity Core / interaction performance layer.
 * This classic script intentionally runs after index.html's core script so it can
 * replace only the hot paths while preserving the existing project format and UI.
 */
(() => {
  'use strict';

  const MODULE_VERSION = '0.20.2';
  const SPATIAL_MIN_ITEMS = 700;
  const SYNC_BUILD_LIMIT = 4500;
  const MAX_CELLS_PER_ITEM = 196;
  const LIVE_SNAP_QUERY_FACTOR = 1.7;
  const DELTA_KIND = 'translate-v0202';

  const original = {
    renderCanvasNow,
    invalidateGeometryCaches,
    recalcBounds,
    hitTest,
    hitTestAny,
    refsInRegion,
    selectByRegion,
    snap,
    beginAction,
    commitAction,
    undo,
    redo,
    cancelMoveCommand,
    historyBytes,
    loadProjectObject
  };

  let coreRevision = 1;
  let builtRevision = 0;
  let buildGeneration = 0;
  let buildHandle = 0;
  let entityIndex = null;
  let overlayIndex = null;
  let forceFullInvalidation = false;
  let liveIndexStale = false;
  let building = false;
  let lastBuildMs = 0;
  let lastRenderCandidates = 0;
  let lastHitCandidates = 0;
  let lastRegionCandidates = 0;
  let lastSnapCandidates = 0;
  let lastRenderMs = 0;

  const now = () => performance?.now?.() ?? Date.now();
  const totalCount = () => (entities?.length || 0) + (overlays?.length || 0);
  const validBox = b => b && Number.isFinite(b.minX) && Number.isFinite(b.minY) && Number.isFinite(b.maxX) && Number.isFinite(b.maxY) && b.maxX >= b.minX && b.maxY >= b.minY;
  const intersects = (a, b) => validBox(a) && validBox(b) && a.maxX >= b.minX && a.minX <= b.maxX && a.maxY >= b.minY && a.minY <= b.maxY;
  const itemBox = item => {
    try {
      const b = getSelectionBounds(item) || getItemBounds(item);
      return validBox(b) ? b : null;
    } catch {
      return null;
    }
  };

  class SpatialGrid {
    constructor(items, kind, cellSize) {
      this.items = items;
      this.kind = kind;
      this.cellSize = Math.max(1e-12, cellSize);
      this.cells = new Map();
      this.large = [];
      this.bounds = new Array(items.length);
    }

    key(x, y) { return `${x},${y}`; }

    insert(index, b) {
      this.bounds[index] = b;
      if (!validBox(b)) return;
      const s = this.cellSize;
      const x0 = Math.floor(b.minX / s), x1 = Math.floor(b.maxX / s);
      const y0 = Math.floor(b.minY / s), y1 = Math.floor(b.maxY / s);
      const cells = (x1 - x0 + 1) * (y1 - y0 + 1);
      if (!Number.isFinite(cells) || cells > MAX_CELLS_PER_ITEM) {
        this.large.push(index);
        return;
      }
      for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) {
        const k = this.key(x, y);
        let bucket = this.cells.get(k);
        if (!bucket) this.cells.set(k, bucket = []);
        bucket.push(index);
      }
    }

    query(region, descending = false) {
      if (!validBox(region)) return [];
      const s = this.cellSize;
      const x0 = Math.floor(region.minX / s), x1 = Math.floor(region.maxX / s);
      const y0 = Math.floor(region.minY / s), y1 = Math.floor(region.maxY / s);
      const seen = new Set();
      const out = [];
      const add = i => {
        if (seen.has(i)) return;
        seen.add(i);
        const b = this.bounds[i];
        if (!intersects(b, region)) return;
        out.push({ item: this.items[i], index: i, kind: this.kind, bounds: b });
      };
      const queryCells = (x1 - x0 + 1) * (y1 - y0 + 1);
      if (queryCells > 10000) {
        for (let i = 0; i < this.items.length; i++) add(i);
      } else {
        for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) {
          const bucket = this.cells.get(this.key(x, y));
          if (bucket) for (const i of bucket) add(i);
        }
        for (const i of this.large) add(i);
      }
      out.sort((a, b) => descending ? b.index - a.index : a.index - b.index);
      return out;
    }
  }

  function chooseCellSize(count) {
    const b = validBox(bounds) ? bounds : { minX: 0, minY: 0, maxX: 1000, maxY: 700 };
    const extent = Math.max(1e-6, b.maxX - b.minX, b.maxY - b.minY);
    const cellsAcross = Math.max(18, Math.min(512, Math.sqrt(Math.max(1, count)) * 1.35));
    return Math.max(1e-9, extent / cellsAcross);
  }

  function cancelScheduledBuild() {
    if (!buildHandle) return;
    if (typeof cancelIdleCallback === 'function') cancelIdleCallback(buildHandle);
    else clearTimeout(buildHandle);
    buildHandle = 0;
  }

  function idle(callback) {
    if (typeof requestIdleCallback === 'function') return requestIdleCallback(callback, { timeout: 160 });
    return setTimeout(() => callback({ didTimeout: true, timeRemaining: () => 8 }), 0);
  }

  function scheduleSpatialBuild(immediate = false) {
    cancelScheduledBuild();
    const generation = ++buildGeneration;
    const revision = coreRevision;
    if (!project || totalCount() < SPATIAL_MIN_ITEMS) {
      entityIndex = overlayIndex = null;
      builtRevision = revision;
      building = false;
      return;
    }
    const entitySnapshot = entities.slice();
    const overlaySnapshot = overlays.slice();
    const cellSize = chooseCellSize(entitySnapshot.length + overlaySnapshot.length);
    const nextEntity = new SpatialGrid(entitySnapshot, 'entity', cellSize);
    const nextOverlay = new SpatialGrid(overlaySnapshot, 'overlay', cellSize);
    const started = now();
    let phase = 0, index = 0;
    building = true;

    const finish = () => {
      if (generation !== buildGeneration || revision !== coreRevision) return;
      entityIndex = nextEntity;
      overlayIndex = nextOverlay;
      builtRevision = revision;
      liveIndexStale = false;
      building = false;
      lastBuildMs = now() - started;
      draw();
    };

    const step = deadline => {
      buildHandle = 0;
      if (generation !== buildGeneration || revision !== coreRevision) return;
      const hardLimit = deadline?.didTimeout ? 1800 : 800;
      let processed = 0;
      while (processed < hardLimit && (deadline?.timeRemaining?.() ?? 8) > 1) {
        if (phase === 0) {
          if (index >= entitySnapshot.length) { phase = 1; index = 0; continue; }
          nextEntity.insert(index, itemBox(entitySnapshot[index]));
          index++; processed++;
        } else {
          if (index >= overlaySnapshot.length) { finish(); return; }
          nextOverlay.insert(index, itemBox(overlaySnapshot[index]));
          index++; processed++;
        }
      }
      buildHandle = idle(step);
    };

    if (immediate && totalCount() <= SYNC_BUILD_LIMIT) {
      for (let i = 0; i < entitySnapshot.length; i++) nextEntity.insert(i, itemBox(entitySnapshot[i]));
      for (let i = 0; i < overlaySnapshot.length; i++) nextOverlay.insert(i, itemBox(overlaySnapshot[i]));
      finish();
    } else buildHandle = idle(step);
  }

  function spatialIndexesAvailable() {
    return !!entityIndex && !!overlayIndex;
  }

  function spatialReady() {
    return builtRevision === coreRevision && spatialIndexesAvailable();
  }

  function selectedItemsSet() {
    return new Set((selected || []).map(x => x.item));
  }

  function querySpatial(region, kind, descending = false, injectLiveSelected = false) {
    const index = kind === 'entity' ? entityIndex : overlayIndex;
    let rows = spatialReady() || (liveIndexStale && index) ? index.query(region, descending) : null;
    if (!rows) return null;
    if (injectLiveSelected && liveIndexStale && selected?.length) {
      const known = new Set(rows.map(x => x.item));
      const additions = [];
      for (const ref of selected) {
        if (ref.kind !== kind || known.has(ref.item)) continue;
        const b = itemBox(ref.item);
        if (intersects(b, region)) additions.push({ item: ref.item, index: (kind === 'entity' ? entities : overlays).indexOf(ref.item), kind, bounds: b });
      }
      if (additions.length) {
        rows = rows.concat(additions);
        rows.sort((a, b) => descending ? b.index - a.index : a.index - b.index);
      }
    }
    return rows;
  }

  function markFullGeometryChange() {
    coreRevision++;
    builtRevision = 0;
    liveIndexStale = false;
    scheduleSpatialBuild(false);
  }

  function isLiveTranslate() {
    return !forceFullInvalidation && (
      interaction?.type === 'move' ||
      interaction?.type === 'grip' ||
      (tool === 'move' && !!moveBasePoint) ||
      (tool === 'copy' && !!copyBasePoint)
    );
  }

  invalidateGeometryCaches = function invalidateGeometryCachesV0202() {
    if (!isLiveTranslate()) {
      const result = original.invalidateGeometryCaches();
      markFullGeometryChange();
      return result;
    }
    // FIX V0.18.19-FIX1: the live-stale optimization is safe only when the
    // spatial index was fully current at the start of the edit. Small/new drawings
    // have no index, and a large drawing can also have a pending rebuild after new
    // objects were added. Using an absent/older index here hides unrelated objects.
    if (!spatialReady()) {
      liveIndexStale = false;
      return original.invalidateGeometryCaches();
    }
    geometryRevision++;
    liveIndexStale = true;
    // Only moving items changed. Keep the expensive global snap/spatial caches alive;
    // the local snap path below excludes selected items and queries nearby geometry.
    for (const ref of selected || []) itemBoundsCache?.delete?.(ref.item);
  };

  recalcBounds = function recalcBoundsV0202() {
    forceFullInvalidation = true;
    try { return original.recalcBounds(); }
    finally { forceFullInvalidation = false; }
  };

  loadProjectObject = function loadProjectObjectV0202(...args) {
    const result = original.loadProjectObject(...args);
    scheduleSpatialBuild(true);
    return result;
  };

  renderCanvasNow = function renderCanvasNowV0202() {
    if (!spatialIndexesAvailable() || (!spatialReady() && !liveIndexStale)) return original.renderCanvasNow();
    const started = now();
    const w = viewportWidth || canvas.clientWidth || 1, h = viewportHeight || canvas.clientHeight || 1;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = $('darkCheck').checked ? '#202124' : '#fff';
    ctx.fillRect(0, 0, w, h);
    drawCoordinateGrid(w, h);
    if (!project) { drawEmpty(w, h); return; }
    const pad = 24 / Math.max(scale, 1e-9);
    const view = { minX: (-offsetX) / scale - pad, maxX: (w - offsetX) / scale + pad, minY: -(h - offsetY) / scale - pad, maxY: offsetY / scale + pad };
    const cadRows = querySpatial(view, 'entity', false, true) || [];
    const overlayRows = $('overlayCheck').checked ? (querySpatial(view, 'overlay', false, true) || []) : [];
    lastRenderCandidates = cadRows.length + overlayRows.length;
    for (const row of cadRows) {
      const e = row.item;
      if (visibleLayers.has(String(e.layer || '0')) && itemVisibleInViewport(e, view)) drawItem(e, false);
    }
    for (const row of overlayRows) if (itemVisibleInViewport(row.item, view)) drawItem(row.item, true);
    if (preview) drawPreview();
    if (selectionBox) drawSelectionBox(selectionBox);
    if ($('frameCheck').checked && validBounds(project.exportRegion)) drawFrame(project.exportRegion);
    drawSelectionHighlights();
    drawRepairPreview();
    drawCadCrosshair();
    if (snapPoint) drawSnap(snapPoint); else drawSnap(null);
    lastRenderMs = now() - started;
  };

  function pointerRegion(screen, pixels = 10) {
    const p = world(screen.x, screen.y), r = pixels / Math.max(scale, 1e-9);
    return { minX: p.x - r, minY: p.y - r, maxX: p.x + r, maxY: p.y + r };
  }

  function textHitScore(e, screen) {
    const p = screenPoint(point(e.position));
    const angle = num(e.rotationDeg) * Math.PI / 180;
    const dx = screen.x - p.x, dy = screen.y - p.y;
    // Inverse of drawText's clockwise screen rotation.
    const lx = dx * Math.cos(angle) - dy * Math.sin(angle);
    const ly = dx * Math.sin(angle) + dy * Math.cos(angle);
    const size = Math.max(2, num(e.height, 2.5) * scale);
    const wf = Math.max(.05, Math.min(20, num(e.textWidthFactor, 1)));
    const ob = Math.tan(Math.max(-85, Math.min(85, num(e.textObliqueDeg, 0))) * Math.PI / 180);
    const lines = String(e.text || '').replace(/\r/g, '').split('\n');
    ctx.save();
    ctx.font = `${Math.min(size, 5000)}px ${canvasFontCss(e)}`;
    let best = Infinity;
    for (let i = 0; i < lines.length; i++) {
      const baseline = i * size * 1.2;
      const rawWidth = Math.max(1, ctx.measureText(lines[i] || ' ').width);
      const localY = ly - baseline;
      const unskewX = (lx - ob * localY) / wf;
      const inside = unskewX >= -5 / wf && unskewX <= rawWidth + 5 / wf && localY >= -size - 5 && localY <= 6;
      if (inside) {
        const centerX = rawWidth / 2, centerY = -size * .42;
        best = Math.min(best, Math.hypot(unskewX - centerX, localY - centerY));
      }
    }
    ctx.restore();
    return best;
  }

  function hitFromSpatial(screen, filtered) {
    const region = pointerRegion(screen, 11);
    const overlayRows = $('overlayCheck').checked ? querySpatial(region, 'overlay', true, true) : [];
    const entityRows = querySpatial(region, 'entity', true, true);
    if (!overlayRows || !entityRows) return null;
    const rows = [...overlayRows, ...entityRows.filter(x => visibleLayers.has(String(x.item.layer || '0')))];
    lastHitCandidates = rows.length;
    let bestText = null, bestTextScore = Infinity, firstGeometry = null;
    for (const row of rows) {
      const item = row.item;
      if (filtered && !selectionFilterMatches(item)) continue;
      const t = String(item.type || '').toUpperCase();
      if (t === 'TEXT' || t === 'MTEXT') {
        const score = textHitScore(item, screen);
        if (Number.isFinite(score)) {
          const selectedBonus = selected?.some(x => x.item === item) ? -100000 : 0;
          if (score + selectedBonus < bestTextScore) {
            bestTextScore = score + selectedBonus;
            bestText = refFor(item, row.kind);
          }
        }
      } else if (!firstGeometry && hitItem(item, screen)) firstGeometry = refFor(item, row.kind);
    }
    return bestText || firstGeometry;
  }

  hitTest = function hitTestV0202(screen) {
    return !spatialIndexesAvailable() ? original.hitTest(screen) : (hitFromSpatial(screen, true) || (!spatialReady() && !liveIndexStale ? original.hitTest(screen) : null));
  };
  hitTestAny = function hitTestAnyV0202(screen) {
    return !spatialIndexesAvailable() ? original.hitTestAny(screen) : (hitFromSpatial(screen, false) || (!spatialReady() && !liveIndexStale ? original.hitTestAny(screen) : null));
  };

  function regionRefs(start, last, startScreen, lastScreen) {
    const region = { minX: Math.min(start.x, last.x), minY: Math.min(start.y, last.y), maxX: Math.max(start.x, last.x), maxY: Math.max(start.y, last.y) };
    const windowMode = lastScreen.x >= startScreen.x;
    const eps = Math.max(1e-9, 4 / Math.max(scale, 1e-9));
    const overlayRows = $('overlayCheck').checked ? querySpatial(region, 'overlay', false, true) : [];
    const entityRows = querySpatial(region, 'entity', false, true);
    if (!overlayRows || !entityRows) return null;
    const out = [];
    const rows = overlayRows.concat(entityRows.filter(x => visibleLayers.has(String(x.item.layer || '0'))));
    lastRegionCandidates = rows.length;
    for (const row of rows) {
      const item = row.item;
      if (!selectionFilterMatches(item)) continue;
      const b = getSelectionBounds(item);
      if (b && (windowMode ? boundsInside(b, region, eps) : boundsIntersect(b, region, eps))) out.push(refFor(item, row.kind));
    }
    return { refs: out, windowMode, region };
  }

  refsInRegion = function refsInRegionV0202(start, last, startScreen, lastScreen) {
    return regionRefs(start, last, startScreen, lastScreen) || original.refsInRegion(start, last, startScreen, lastScreen);
  };

  selectByRegion = function selectByRegionV0202(start, last, additive, startScreen = null, lastScreen = null) {
    if (!startScreen || !lastScreen) return original.selectByRegion(start, last, additive, startScreen, lastScreen);
    const pixelW = Math.abs(lastScreen.x - startScreen.x), pixelH = Math.abs(lastScreen.y - startScreen.y);
    if (pixelW < 4 || pixelH < 4) {
      selectionBox = null;
      status('Vùng chọn quá nhỏ; hãy kéo vùng rõ ràng hơn.');
      return;
    }
    const result = regionRefs(start, last, startScreen, lastScreen);
    if (!result) return original.selectByRegion(start, last, additive, startScreen, lastScreen);
    lastSelectionRegion = { ...result.region };
    if (!additive) selected = [];
    const selectedSet = new Set(selected.map(x => x.item));
    for (const ref of result.refs) if (!selectedSet.has(ref.item)) { selected.push(ref); selectedSet.add(ref.item); }
    selectionBox = null;
    updateSelectionPanel();
    updateHistoryButtons();
    status(`${result.windowMode ? 'Window' : 'Crossing'}: đã chọn ${selected.length} đối tượng; chỉ kiểm tra ${lastRegionCandidates} ứng viên gần vùng.`);
  };

  function localSnapRows(worldPoint, worldTol) {
    const region = { minX: worldPoint.x - worldTol * LIVE_SNAP_QUERY_FACTOR, minY: worldPoint.y - worldTol * LIVE_SNAP_QUERY_FACTOR, maxX: worldPoint.x + worldTol * LIVE_SNAP_QUERY_FACTOR, maxY: worldPoint.y + worldTol * LIVE_SNAP_QUERY_FACTOR };
    const overlayRows = $('overlayCheck').checked ? querySpatial(region, 'overlay', false, true) : [];
    const entityRows = querySpatial(region, 'entity', false, true);
    if (!overlayRows || !entityRows) return null;
    const moving = isLiveTranslate() ? selectedItemsSet() : null;
    return overlayRows.concat(entityRows.filter(x => visibleLayers.has(String(x.item.layer || '0')))).filter(x => !moving?.has(x.item));
  }

  snap = function snapV0202(worldPoint, screen, base = null) {
    const gridPoint = coordinateGridSnap(worldPoint);
    if (!$('snapCheck').checked || !project) { snapPoint = null; return gridPoint; }
    if (!spatialIndexesAvailable() || (!spatialReady() && !liveIndexStale)) return original.snap(worldPoint, screen, base);
    const tol = num($('snapTolerance').value, 14), worldTol = tol / Math.max(scale, 1e-9);
    const rows = localSnapRows(worldPoint, worldTol);
    if (!rows) return original.snap(worldPoint, screen, base);
    lastSnapCandidates = rows.length;
    const pool = [], geometry = [];
    for (const row of rows) {
      collectSnap(row.item, pool);
      addGeometryEntry(row.item, geometry);
    }
    if (snapKindEnabled('perpendicular') && base) for (const entry of geometry) for (const q of perpendicularSnapsForEntry(entry, base)) if (dist(q, worldPoint) <= worldTol * 1.05) addSnapCandidate(pool, q, 'Vuông góc', 'perpendicular', entry.item);
    if (snapKindEnabled('intersection')) dynamicIntersectionCandidates(geometry, worldPoint, worldTol, pool);
    if (snapKindEnabled('nearest')) for (const entry of geometry) {
      const q = nearestSnapForEntry(entry, worldPoint);
      if (q && dist(q, worldPoint) <= worldTol * 1.05) addSnapCandidate(pool, q, 'Điểm trên đường', 'nearest', entry.item);
    }
    let best = null, bestScore = Infinity;
    for (const c of pool) {
      if (!snapKindEnabled(c.kind)) continue;
      const d = dist(screen, screenPoint(c.point));
      if (d > tol * 1.08) continue;
      const score = candidateScore(c, d, tol);
      if (score < bestScore) { bestScore = score; best = c; }
    }
    snapPoint = best;
    return best ? best.point : gridPoint;
  };

  function refDescriptor(ref) {
    const list = ref.kind === 'entity' ? entities : overlays;
    return { kind: ref.kind, index: list.indexOf(ref.item) };
  }

  function resolveDescriptor(d) {
    const list = d.kind === 'entity' ? entities : overlays;
    const item = list[d.index];
    return item ? refFor(item, d.kind) : null;
  }

  function aggregateAnchor(refs) {
    let minX = Infinity, minY = Infinity;
    for (const ref of refs) {
      const b = itemBox(ref.item);
      if (!b) continue;
      minX = Math.min(minX, b.minX); minY = Math.min(minY, b.minY);
    }
    return Number.isFinite(minX) ? { x: minX, y: minY } : null;
  }

  function deltaMarkerEligible() {
    return selected?.length && (
      interaction?.type === 'selectPendingMove' ||
      (tool === 'move' && !moveBasePoint)
    );
  }

  function isDeltaMarker(value) { return value?.kind === 'translate-marker-v0202'; }
  function isDeltaEntry(value) { return value?.kind === DELTA_KIND && Array.isArray(value.refs); }

  beginAction = function beginActionV0202() {
    if (!deltaMarkerEligible()) return original.beginAction();
    const refs = selected.map(refDescriptor).filter(x => x.index >= 0);
    const anchor = aggregateAnchor(selected);
    actionBefore = refs.length && anchor ? { kind: 'translate-marker-v0202', refs, anchor } : snapshot();
  };

  commitAction = function commitActionV0202(label) {
    if (!isDeltaMarker(actionBefore)) return original.commitAction(label);
    const marker = actionBefore;
    const resolved = marker.refs.map(resolveDescriptor).filter(Boolean);
    const anchor = aggregateAnchor(resolved);
    actionBefore = null;
    if (!anchor) { updateHistoryButtons(); return; }
    const dx = anchor.x - marker.anchor.x, dy = anchor.y - marker.anchor.y;
    if (Math.hypot(dx, dy) <= 1e-12) { updateHistoryButtons(); return; }
    undoStack.push({ kind: DELTA_KIND, refs: marker.refs, dx, dy, label: label || 'MOVE' });
    trimAdaptiveHistory(undoStack);
    redoStack = [];
    setDirty(true);
    status(label || `Đã di chuyển ${marker.refs.length} đối tượng`);
    updateHistoryButtons();
  };

  historyBytes = function historyBytesV0202(stack) {
    let n = 0;
    for (const x of stack) n += (typeof x === 'string' ? x.length : JSON.stringify(x || '').length) * 2;
    return n;
  };

  function applyTranslateEntry(entry, direction) {
    const d = { x: entry.dx * direction, y: entry.dy * direction };
    const refs = entry.refs.map(resolveDescriptor).filter(Boolean);
    for (const ref of refs) translateItem(ref.item, d);
    selected = refs;
    recalcBounds();
    updateSelectionPanel();
    draw();
    return refs.length;
  }

  undo = function undoV0202() {
    if (!undoStack.length) return;
    const entry = undoStack.pop();
    if (!isDeltaEntry(entry)) {
      const current = snapshot();
      redoStack.push(current);
      trimAdaptiveHistory(redoStack);
      restoreSnapshot(entry);
      updateHistoryButtons();
      status('Đã Undo');
      return;
    }
    applyTranslateEntry(entry, -1);
    redoStack.push(entry);
    trimAdaptiveHistory(redoStack);
    setDirty(true);
    updateHistoryButtons();
    status(`Đã Undo ${entry.label || 'MOVE'} (delta)`);
  };

  redo = function redoV0202() {
    if (!redoStack.length) return;
    const entry = redoStack.pop();
    if (!isDeltaEntry(entry)) {
      const current = snapshot();
      undoStack.push(current);
      trimAdaptiveHistory(undoStack);
      restoreSnapshot(entry);
      updateHistoryButtons();
      status('Đã Redo');
      return;
    }
    applyTranslateEntry(entry, 1);
    undoStack.push(entry);
    trimAdaptiveHistory(undoStack);
    setDirty(true);
    updateHistoryButtons();
    status(`Đã Redo ${entry.label || 'MOVE'} (delta)`);
  };

  cancelMoveCommand = function cancelMoveCommandV0202(restore = true) {
    if (!isDeltaMarker(actionBefore)) return original.cancelMoveCommand(restore);
    if (moveBasePoint && restore) {
      const marker = actionBefore;
      const refs = marker.refs.map(resolveDescriptor).filter(Boolean);
      const current = aggregateAnchor(refs);
      if (current) {
        const d = { x: marker.anchor.x - current.x, y: marker.anchor.y - current.y };
        for (const ref of refs) translateItem(ref.item, d);
      }
      moveBasePoint = null; moveLastPoint = null; preview = null; actionBefore = null;
      recalcBounds();
      selected = refs;
      updateSelectionPanel(); draw();
      status('Đã hủy lệnh MOVE.');
      return;
    }
    moveBasePoint = null; moveLastPoint = null; preview = null; actionBefore = null;
  };

  // Handlers were assigned before this module loaded; point them at the optimized functions.
  if ($('undoBtn')) $('undoBtn').onclick = undo;
  if ($('redoBtn')) $('redoBtn').onclick = redo;

  window.DwgSketchInteractionCoreV0202 = Object.freeze({
    version: MODULE_VERSION,
    rebuild: () => { markFullGeometryChange(); scheduleSpatialBuild(true); },
    stats: () => ({
      version: MODULE_VERSION,
      ready: spatialReady(),
      building,
      revision: coreRevision,
      builtRevision,
      total: totalCount(),
      entityCells: entityIndex?.cells?.size || 0,
      overlayCells: overlayIndex?.cells?.size || 0,
      lastBuildMs,
      lastRenderMs,
      lastRenderCandidates,
      lastHitCandidates,
      lastRegionCandidates,
      lastSnapCandidates,
      undoEntries: undoStack?.length || 0,
      undoBytes: historyBytes(undoStack || [])
    })
  });

  scheduleSpatialBuild(true);
  console.info(`[DWG Sketch] Interaction Core ${MODULE_VERSION} active.`);
})();
