/* DWG Sketch PWA V0.15.0 - direct DWG reader worker.
 * LibreDWG WebAssembly is loaded in this Worker, so parsing never calls a desktop converter.
 * Upstream: @mlightcad/libredwg-web 0.7.9 (GPL-3.0)
 */
import { Dwg_File_Type, LibreDwg } from 'https://cdn.jsdelivr.net/npm/@mlightcad/libredwg-web@0.7.9/dist/libredwg-web.js';

let enginePromise = null;
const DEG = 180 / Math.PI;

function postProgress(stage, message, percent) {
  self.postMessage({ type: 'progress', stage, message, percent });
}

async function getEngine() {
  if (!enginePromise) {
    postProgress('engine', 'Đang nạp bộ đọc DWG WebAssembly…', 5);
    enginePromise = LibreDwg.create();
  }
  return enginePromise;
}

const n = (value, fallback = 0) => {
  const out = Number(value);
  return Number.isFinite(out) ? out : fallback;
};
const p2 = (value) => ({ x: n(value?.x ?? value?.X), y: n(value?.y ?? value?.Y) });
const upper = (value) => String(value ?? '').trim().toUpperCase();
const colorArgb = (value) => value === undefined || value === null ? null : ((0xff000000 | (n(value) & 0xffffff)) >>> 0);
const clonePoint = (p) => ({ x: n(p?.x), y: n(p?.y) });

function makeTransform(parent = null, insertion = { x: 0, y: 0 }, sx = 1, sy = 1, rotation = 0, base = { x: 0, y: 0 }) {
  const c = Math.cos(rotation), s = Math.sin(rotation);
  return {
    rotation: (parent?.rotation || 0) + rotation,
    scaleX: (parent?.scaleX || 1) * sx,
    scaleY: (parent?.scaleY || 1) * sy,
    point(input) {
      const q = p2(input), x = (q.x - n(base.x)) * sx, y = (q.y - n(base.y)) * sy;
      const local = { x: n(insertion.x) + x * c - y * s, y: n(insertion.y) + x * s + y * c };
      return parent ? parent.point(local) : local;
    }
  };
}
const IDENTITY = makeTransform();

function commonProps(entity, inherited = null) {
  let ci = entity?.colorIndex;
  if (ci === undefined || ci === null) ci = 256;
  let tc = colorArgb(entity?.color);
  let layer = String(entity?.layer || inherited?.layer || '0');
  if (layer === '0' && inherited?.layer) layer = inherited.layer;
  if (Number(ci) === 0 && inherited) {
    ci = inherited.colorIndex ?? 256;
    tc = inherited.trueColorArgb ?? tc;
  }
  return {
    layer,
    colorIndex: n(ci, 256),
    trueColorArgb: tc,
    colorMethod: tc !== null ? 'TrueColor' : n(ci, 256) === 0 ? 'ByBlock' : n(ci, 256) === 256 ? 'ByLayer' : 'Aci',
    sourceHandle: String(entity?.handle || ''),
    sourceType: upper(entity?.type),
    lineType: entity?.lineType || null,
    lineweight: entity?.lineweight ?? null
  };
}

function appendUnsupported(ctx, type, amount = 1) {
  const key = upper(type) || 'UNKNOWN';
  ctx.unsupported[key] = (ctx.unsupported[key] || 0) + amount;
}

function expandBulges(vertices, closed, transform) {
  const src = (vertices || []).map(v => ({ ...p2(v), bulge: n(v?.bulge) }));
  if (src.length < 2) return src.map(transform.point);
  const out = [];
  const count = closed ? src.length : src.length - 1;
  for (let i = 0; i < count; i++) {
    const a = src[i], b = src[(i + 1) % src.length];
    if (!out.length) out.push(transform.point(a));
    const bulge = n(a.bulge);
    if (Math.abs(bulge) < 1e-10) {
      out.push(transform.point(b));
      continue;
    }
    const dx = b.x - a.x, dy = b.y - a.y, chord = Math.hypot(dx, dy);
    if (chord < 1e-12) continue;
    const theta = 4 * Math.atan(bulge);
    const radius = chord * (1 + bulge * bulge) / (4 * Math.abs(bulge));
    const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    const h = chord * (1 - bulge * bulge) / (4 * bulge);
    const ux = -dy / chord, uy = dx / chord;
    const center = { x: mid.x + ux * h, y: mid.y + uy * h };
    const start = Math.atan2(a.y - center.y, a.x - center.x);
    const steps = Math.max(4, Math.min(96, Math.ceil(Math.abs(theta) / (Math.PI / 18))));
    for (let j = 1; j <= steps; j++) {
      const ang = start + theta * j / steps;
      out.push(transform.point({ x: center.x + radius * Math.cos(ang), y: center.y + radius * Math.sin(ang) }));
    }
  }
  if (closed && out.length > 1) {
    const a = out[0], b = out[out.length - 1];
    if (Math.hypot(a.x - b.x, a.y - b.y) < 1e-8) out.pop();
  }
  return out;
}

function ellipsePoints(entity, transform, steps = 96) {
  const center = p2(entity.center), major = p2(entity.majorAxisEndPoint);
  const ratio = Math.abs(n(entity.axisRatio, 1));
  const minor = { x: -major.y * ratio, y: major.x * ratio };
  let start = n(entity.startAngle, 0), end = n(entity.endAngle, Math.PI * 2);
  let sweep = end - start;
  while (sweep <= 0) sweep += Math.PI * 2;
  const count = Math.max(12, Math.min(256, Math.ceil(steps * sweep / (Math.PI * 2))));
  const pts = [];
  for (let i = 0; i <= count; i++) {
    const t = start + sweep * i / count;
    pts.push(transform.point({ x: center.x + major.x * Math.cos(t) + minor.x * Math.sin(t), y: center.y + major.y * Math.cos(t) + minor.y * Math.sin(t) }));
  }
  const closed = Math.abs(sweep - Math.PI * 2) < 1e-4;
  if (closed) pts.pop();
  return { points: pts, closed };
}

function circlePoints(center, radius, transform, start = 0, end = Math.PI * 2) {
  let sweep = end - start;
  while (sweep <= 0) sweep += Math.PI * 2;
  const count = Math.max(12, Math.min(192, Math.ceil(96 * sweep / (Math.PI * 2))));
  const pts = [];
  for (let i = 0; i <= count; i++) {
    const t = start + sweep * i / count;
    pts.push(transform.point({ x: center.x + radius * Math.cos(t), y: center.y + radius * Math.sin(t) }));
  }
  const closed = Math.abs(sweep - Math.PI * 2) < 1e-4;
  if (closed) pts.pop();
  return { points: pts, closed };
}

function cleanMText(value) {
  return String(value ?? '')
    .replace(/\\P/gi, '\n')
    .replace(/\\~+/g, ' ')
    .replace(/\\[A-Za-z][^;]*;/g, '')
    .replace(/[{}]/g, '')
    .replace(/%%d/gi, '°')
    .replace(/%%p/gi, '±')
    .replace(/%%c/gi, 'Ø');
}

function convertEntity(entity, ctx, transform = IDENTITY, inherited = null, depth = 0) {
  if (!entity || depth > 12) return [];
  const type = upper(entity.type), base = commonProps(entity, inherited);
  const out = [];
  const transformedScale = Math.max(1e-12, (Math.abs(transform.scaleX) + Math.abs(transform.scaleY)) / 2);
  switch (type) {
    case 'LINE':
      out.push({ type: 'LINE', a: transform.point(entity.startPoint), b: transform.point(entity.endPoint), ...base });
      break;
    case 'CIRCLE': {
      const center = p2(entity.center), radius = Math.abs(n(entity.radius));
      if (Math.abs(Math.abs(transform.scaleX) - Math.abs(transform.scaleY)) < 1e-9) {
        out.push({ type: 'CIRCLE', center: transform.point(center), radius: radius * Math.abs(transform.scaleX), ...base });
      } else {
        const q = circlePoints(center, radius, transform);
        out.push({ type: 'LWPOLYLINE', points: q.points, closed: q.closed, ...base, approximationOf: 'CIRCLE' });
      }
      break;
    }
    case 'ARC': {
      const center = p2(entity.center), radius = Math.abs(n(entity.radius));
      const start = n(entity.startAngle), end = n(entity.endAngle);
      if (Math.abs(Math.abs(transform.scaleX) - Math.abs(transform.scaleY)) < 1e-9) {
        out.push({ type: 'ARC', center: transform.point(center), radius: radius * Math.abs(transform.scaleX), startDeg: start * DEG + transform.rotation * DEG, endDeg: end * DEG + transform.rotation * DEG, ...base });
      } else {
        const q = circlePoints(center, radius, transform, start, end);
        out.push({ type: 'LWPOLYLINE', points: q.points, closed: false, ...base, approximationOf: 'ARC' });
      }
      break;
    }
    case 'ELLIPSE': {
      const q = ellipsePoints(entity, transform);
      out.push({ type: 'LWPOLYLINE', points: q.points, closed: q.closed, ...base, approximationOf: 'ELLIPSE' });
      break;
    }
    case 'LWPOLYLINE': {
      const closed = (n(entity.flag) & 1) !== 0;
      const points = expandBulges(entity.vertices, closed, transform);
      if (points.length >= 2) out.push({ type: 'LWPOLYLINE', points, closed, ...base });
      else appendUnsupported(ctx, type + '_EMPTY');
      break;
    }
    case 'POLYLINE2D':
    case 'POLYLINE3D': {
      const closed = (n(entity.flag) & 1) !== 0;
      const vertices = entity.vertices || [];
      const points = type === 'POLYLINE2D' ? expandBulges(vertices, closed, transform) : vertices.map(transform.point);
      if (points.length >= 2) out.push({ type: 'POLYLINE', points, closed, ...base });
      else appendUnsupported(ctx, type + '_EMPTY');
      break;
    }
    case 'SPLINE': {
      const source = entity.fitPoints?.length ? entity.fitPoints : entity.controlPoints;
      const points = (source || []).map(transform.point);
      if (points.length >= 2) out.push({ type: 'LWPOLYLINE', points, closed: (n(entity.flag) & 1) !== 0, ...base, approximationOf: 'SPLINE' });
      else appendUnsupported(ctx, 'SPLINE_EMPTY');
      break;
    }
    case 'TEXT':
    case 'ATTRIB':
    case 'ATTDEF': {
      const text = cleanMText(entity.text ?? entity.value ?? entity.defaultValue);
      if (text) out.push({ type: 'TEXT', position: transform.point(entity.startPoint ?? entity.insertionPoint), text, height: Math.max(.0001, Math.abs(n(entity.textHeight, 2.5)) * transformedScale), rotationDeg: n(entity.rotation) * DEG + transform.rotation * DEG, fontName: entity.styleName || 'Arial', ...base });
      break;
    }
    case 'MTEXT': {
      const text = cleanMText(entity.text);
      if (text) out.push({ type: 'MTEXT', position: transform.point(entity.insertionPoint), text, height: Math.max(.0001, Math.abs(n(entity.textHeight, 2.5)) * transformedScale), rotationDeg: n(entity.rotation) * DEG + transform.rotation * DEG, fontName: entity.styleName || 'Arial', ...base });
      break;
    }
    case 'DIMENSION': {
      const a0 = entity.subDefinitionPoint1 || entity.centerPoint || entity.definitionPoint;
      const b0 = entity.subDefinitionPoint2 || entity.definitionPoint;
      if (a0 && b0) {
        const a = transform.point(a0), b = transform.point(b0), tp = transform.point(entity.textPoint || entity.definitionPoint || b0);
        const dx = b.x - a.x, dy = b.y - a.y, len = Math.hypot(dx, dy);
        const offset = len > 1e-12 ? (tp.x - a.x) * (-dy / len) + (tp.y - a.y) * (dx / len) : 0;
        out.push({ type: 'DIMENSION', a, b, offset, text: entity.text === '<>' ? '' : cleanMText(entity.text || ''), textOverride: entity.text === '<>' ? '' : cleanMText(entity.text || ''), height: Math.max(.0001, 2.5 * transformedScale), textHeight: Math.max(.0001, 2.5 * transformedScale), arrowSize: Math.max(.0001, 2 * transformedScale), fontName: 'Arial', ...base });
      } else appendUnsupported(ctx, 'DIMENSION_' + (entity.subclassMarker || 'UNKNOWN'));
      break;
    }
    case 'INSERT': {
      const block = ctx.blocks.get(upper(entity.name));
      if (!block || !Array.isArray(block.entities)) {
        appendUnsupported(ctx, 'INSERT_BLOCK_MISSING');
        break;
      }
      if (ctx.blockStack.includes(upper(entity.name))) {
        appendUnsupported(ctx, 'INSERT_RECURSIVE');
        break;
      }
      const rows = Math.max(1, Math.min(100, Math.trunc(n(entity.rowCount, 1))));
      const cols = Math.max(1, Math.min(100, Math.trunc(n(entity.columnCount, 1))));
      const instances = rows * cols;
      if (instances > 1000) {
        appendUnsupported(ctx, 'INSERT_ARRAY_TRUNCATED', instances - 1000);
      }
      let made = 0;
      ctx.blockStack.push(upper(entity.name));
      for (let row = 0; row < rows && made < 1000; row++) {
        for (let col = 0; col < cols && made < 1000; col++, made++) {
          const insertion = p2(entity.insertionPoint);
          insertion.x += col * n(entity.columnSpacing);
          insertion.y += row * n(entity.rowSpacing);
          const childTransform = makeTransform(transform, insertion, n(entity.xScale, 1), n(entity.yScale, 1), n(entity.rotation), p2(block.basePoint));
          const inheritedStyle = { ...base, layer: base.layer };
          for (const child of block.entities) out.push(...convertEntity(child, ctx, childTransform, inheritedStyle, depth + 1));
        }
      }
      ctx.blockStack.pop();
      for (const attr of entity.attribs || []) out.push(...convertEntity(attr, ctx, transform, base, depth + 1));
      break;
    }
    case 'POINT': {
      const q = transform.point(entity.position);
      const size = Math.max(0.05, transformedScale * .5);
      out.push({ type: 'LINE', a: { x: q.x - size, y: q.y }, b: { x: q.x + size, y: q.y }, ...base, approximationOf: 'POINT' });
      out.push({ type: 'LINE', a: { x: q.x, y: q.y - size }, b: { x: q.x, y: q.y + size }, ...base, approximationOf: 'POINT' });
      break;
    }
    default:
      appendUnsupported(ctx, type);
  }
  return out.filter(e => {
    const points = [];
    if (e.a) points.push(e.a);
    if (e.b) points.push(e.b);
    if (e.center) points.push(e.center);
    if (e.position) points.push(e.position);
    if (e.points) points.push(...e.points);
    return points.every(q => Number.isFinite(q.x) && Number.isFinite(q.y));
  });
}

function convertDatabase(database, fileName, meta = {}) {
  const layerEntries = database?.tables?.LAYER?.entries || [];
  const blockEntries = database?.tables?.BLOCK_RECORD?.entries || [];
  const blocks = new Map(blockEntries.map(b => [upper(b.name), b]));
  const layerStyles = layerEntries.map(layer => ({
    name: String(layer.name || '0'),
    colorIndex: Math.abs(n(layer.colorIndex, 7)) || 7,
    trueColorArgb: colorArgb(layer.color),
    colorMethod: layer.color !== undefined && layer.color !== null ? 'TrueColor' : 'Aci',
    isOff: !!layer.off || n(layer.colorIndex) < 0,
    frozen: !!layer.frozen,
    locked: !!layer.locked,
    lineType: layer.lineType || null,
    lineweight: layer.lineweight ?? null
  }));
  const ctx = { blocks, unsupported: {}, blockStack: [] };
  const entities = [];
  const sourceEntities = Array.isArray(database?.entities) ? database.entities : [];
  for (let i = 0; i < sourceEntities.length; i++) {
    if (i % 500 === 0) postProgress('convert', `Đang chuyển đối tượng ${i.toLocaleString('vi-VN')} / ${sourceEntities.length.toLocaleString('vi-VN')}…`, 50 + Math.round(45 * i / Math.max(1, sourceEntities.length)));
    entities.push(...convertEntity(sourceEntities[i], ctx));
  }
  const layers = [...new Set(entities.map(e => String(e.layer || '0')))];
  if (!layers.length) layers.push('0');
  const styleMap = new Map(layerStyles.map(s => [upper(s.name), s]));
  const visibleLayers = layers.filter(name => !styleMap.get(upper(name))?.isOff && !styleMap.get(upper(name))?.frozen);
  return {
    projectType: 'DwgSketchProject',
    version: 4,
    savedAt: new Date().toISOString(),
    sourceFormat: 'DWG Direct WebAssembly',
    sourceFile: fileName,
    intermediateFile: null,
    unsupportedTypes: ctx.unsupported,
    layerStyles,
    entities,
    overlays: [],
    visibleLayers: visibleLayers.length ? visibleLayers : layers,
    drawingBounds: null,
    exportRegion: null,
    display: {
      hideSmallText: false, minimumTextPixel: 1, dwgTextScale: 1, useDwgColors: true,
      exportBackground: 'Dark', enableSnap: true, snapEndpoint: true, snapMidpoint: true,
      snapCenter: true, snapIntersection: true, snapPerpendicular: false, snapTolerancePixel: 14,
      exportScope: 'full', printFrameBorder: false, exportBgMode: 'white', exportBgColor: '#ffffff',
      exportStrokeMode: 'original', exportStrokeColor: '#000000'
    },
    dwgImport: {
      engine: '@mlightcad/libredwg-web 0.7.9',
      version: String(meta.version ?? 'không rõ'),
      codepage: String(meta.codepage ?? 'không rõ'),
      sourceEntityCount: sourceEntities.length,
      convertedEntityCount: entities.length,
      unknownEntityCount: n(meta.unknownEntityCount),
      blockCount: blockEntries.length,
      layerCount: layerEntries.length,
      directInBrowser: true
    }
  };
}

self.onmessage = async event => {
  const message = event.data || {};
  try {
    if (message.command === 'init') {
      await getEngine();
      postProgress('ready', 'Bộ đọc DWG WebAssembly đã sẵn sàng và được PWA lưu đệm.', 100);
      self.postMessage({ type: 'ready' });
      return;
    }
    if (message.command !== 'open-dwg') return;
    const started = performance.now();
    const engine = await getEngine();
    postProgress('parse', 'Đang giải mã cấu trúc DWG trực tiếp trong trình duyệt…', 20);
    const ptr = engine.dwg_read_data(message.buffer, Dwg_File_Type.DWG);
    if (!ptr) throw new Error('LibreDWG không nhận được cấu trúc DWG hợp lệ hoặc phiên bản DWG này chưa được hỗ trợ.');
    let database;
    let meta = {};
    try {
      meta.version = engine.dwg_get_version_type(ptr);
      meta.codepage = engine.dwg_get_codepage(ptr);
      postProgress('database', 'Đang tạo cơ sở dữ liệu bản vẽ trong bộ nhớ…', 38);
      if (typeof engine.convertEx === 'function') {
        const converted = engine.convertEx(ptr);
        database = converted.database;
        meta.unknownEntityCount = converted.stats?.unknownEntityCount || 0;
      } else {
        database = engine.convert(ptr);
      }
    } finally {
      try { engine.dwg_free(ptr); } catch { /* memory is released when worker closes */ }
    }
    if (!database) throw new Error('Bộ đọc DWG không tạo được cơ sở dữ liệu bản vẽ.');
    const project = convertDatabase(database, message.fileName || 'BanVe.dwg', meta);
    if (!project.entities.length) throw new Error('DWG đã được đọc nhưng chưa lấy được đối tượng 2D phù hợp để hiển thị. Hãy xem thống kê loại đối tượng chưa hỗ trợ.');
    project.dwgImport.elapsedMs = Math.round(performance.now() - started);
    postProgress('done', `Đã đọc ${project.entities.length.toLocaleString('vi-VN')} đối tượng DWG.`, 100);
    self.postMessage({ type: 'result', project });
  } catch (error) {
    console.error(error);
    self.postMessage({ type: 'error', message: error?.message || String(error), stack: error?.stack || '' });
  }
};
