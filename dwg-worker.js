/* DWG Sketch PWA V0.15.6 - direct DWG reader worker.
 * LibreDWG WebAssembly is loaded in this Worker, so parsing never calls a desktop converter.
 * Upstream: @mlightcad/libredwg-web 0.7.9 (GPL-3.0)
 */
import { Dwg_File_Type, LibreDwg } from './vendor/libredwg-web-0.7.9/dist/libredwg-web.js';

const DWG_WORKER_VERSION = '0.15.6';
const DWG_ENGINE_VERSION = '0.7.9';
const DWG_ENGINE_PACKAGE = '@mlightcad/libredwg-web';
const DWG_ENGINE_SOURCE = 'local-vendor';
const DWG_ENGINE_WASM_BASE = new URL('./vendor/libredwg-web-0.7.9/wasm', self.location.href).href.replace(/\/$/, '');
const DWG_ENGINE_INFO = Object.freeze({
  workerVersion: DWG_WORKER_VERSION,
  engineVersion: DWG_ENGINE_VERSION,
  enginePackage: DWG_ENGINE_PACKAGE,
  engineSource: DWG_ENGINE_SOURCE,
  engineBase: DWG_ENGINE_WASM_BASE
});

let enginePromise = null;
const DEG = 180 / Math.PI;

function postProgress(stage, message, percent) {
  self.postMessage({ type: 'progress', stage, message, percent });
}

async function getEngine() {
  if (!enginePromise) {
    postProgress('engine', 'Đang nạp bộ đọc DWG WebAssembly…', 5);
    enginePromise = LibreDwg.create(DWG_ENGINE_WASM_BASE);
  }
  return enginePromise;
}

const n = (value, fallback = 0) => {
  const out = Number(value);
  return Number.isFinite(out) ? out : fallback;
};
const p2 = (value) => ({ x: n(value?.x ?? value?.X), y: n(value?.y ?? value?.Y) });
const upper = (value) => String(value ?? '').trim().toUpperCase();
const clonePoint = (p) => ({ x: n(p?.x), y: n(p?.y) });
const int = (value, fallback = 0) => Number.isFinite(Number(value)) ? Math.trunc(Number(value)) : fallback;

function rawNumber(value) {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value === 'object') value = value.rgb ?? value.color ?? value.value ?? value.data ?? null;
  if (value === undefined || value === null || value === '') return null;
  if (typeof value === 'string') {
    const text = value.trim();
    if (!text) return null;
    if (/^(?:0x)?[0-9a-f]{6,8}$/i.test(text) && /[a-f]/i.test(text)) return parseInt(text.replace(/^0x/i, ''), 16) >>> 0;
  }
  const out = Number(value);
  return Number.isFinite(out) ? (Math.trunc(out) >>> 0) : null;
}
function argbFromRgb(rgb) {
  const value = rawNumber(rgb);
  return value === null ? null : ((0xff000000 | (value & 0xffffff)) >>> 0);
}
function methodName(value) {
  const text = String(value ?? '').toLowerCase();
  const number = Number(value);
  if (number === 4 || text.includes('true')) return 'TrueColor';
  if (number === 3 || text.includes('aci')) return 'Aci';
  if (number === 2 || text.includes('byblock')) return 'ByBlock';
  if (number === 1 || text.includes('bylayer')) return 'ByLayer';
  return '';
}
function unwrapDyn(value) {
  if (value && typeof value === 'object' && 'data' in value) return value.data;
  if (value && typeof value === 'object' && 'value' in value && Object.keys(value).length <= 3) return value.value;
  return value;
}
function handleKey(value) {
  if (value === undefined || value === null) return '';
  if (Array.isArray(value)) return value.map(x => int(x)).join(':');
  if (typeof value === 'object') return handleKey(value.handle ?? value.value ?? value.id ?? '');
  return String(value).trim().toUpperCase();
}

/* libredwg-web <= 0.7.9 may lose old-format layer ACI colors while converting
 * the raw DWG database. Read the original LAYER/STYLE objects through the
 * exposed WASM API when it is available, then use the converted database only
 * for geometry. All calls are feature-detected so newer engines remain valid. */
function extractRawCadTables(engine, dwgPtr) {
  const api = engine?.instance || engine;
  const fn = name => typeof api?.[name] === 'function' ? api[name].bind(api) :
    (typeof engine?.[name] === 'function' ? engine[name].bind(engine) : null);
  const getCount = fn('dwg_get_num_objects'), getObject = fn('dwg_get_object');
  const getType = fn('dwg_object_get_fixedtype'), toTio = fn('dwg_object_to_object_tio');
  const dynValue = fn('dwg_dynapi_entity_value');
  const result = { layers: new Map(), styles: new Map(), usedRawApi: false, error: '' };
  if (!getCount || !getObject || !getType || !toTio || !dynValue) return result;
  try {
    const count = Math.max(0, Math.min(10_000_000, int(getCount(dwgPtr))));
    for (let i = 0; i < count; i++) {
      const objectPtr = getObject(dwgPtr, i);
      if (!objectPtr) continue;
      const fixedType = int(getType(objectPtr));
      if (fixedType !== 51 && fixedType !== 53) continue; // LAYER / STYLE
      const tio = toTio(objectPtr);
      if (!tio) continue;
      const read = field => {
        try { return unwrapDyn(dynValue(tio, field)); } catch { return undefined; }
      };
      if (fixedType === 51) {
        const name = String(read('name') ?? '').trim();
        if (!name) continue;
        const color = read('color');
        result.layers.set(upper(name), {
          name,
          index: int(color?.index, NaN),
          method: int(color?.method, NaN),
          rgb: rawNumber(color?.rgb),
          handle: handleKey(read('handle'))
        });
      } else {
        const name = String(read('name') ?? '').trim();
        if (!name) continue;
        result.styles.set(upper(name), {
          name,
          fontFile: String(read('font_file') ?? read('font') ?? '').trim(),
          bigFontFile: String(read('bigfont_file') ?? read('bigfont') ?? '').trim(),
          handle: handleKey(read('handle'))
        });
      }
    }
    result.usedRawApi = result.layers.size > 0 || result.styles.size > 0;
  } catch (error) {
    result.error = error?.message || String(error);
  }
  return result;
}

function normalizeCadColor(colorIndex, color, kind = 'entity', rawColor = null, reportedMethod = null) {
  let ci = int(colorIndex, kind === 'layer' ? 7 : 256);
  const off = kind === 'layer' && ci < 0;
  ci = Math.abs(ci);
  const declared = methodName(reportedMethod);
  const packageRgb = rawNumber(color);
  const packedMethod = packageRgb === null ? -1 : ((packageRgb >>> 24) & 0xff);
  const packageLow = packageRgb === null ? null : (packageRgb & 0xffffff);
  const rawPacked = rawNumber(rawColor?.rgb);
  const rawPackedMethod = rawPacked === null ? -1 : ((rawPacked >>> 24) & 0xff);
  const rawMethod = Number.isFinite(Number(rawColor?.method)) ? int(rawColor.method) : rawPackedMethod;
  const rawIndex = Number.isFinite(Number(rawColor?.index)) ? Math.abs(int(rawColor.index)) : null;
  const rawLow = rawPacked === null ? null : (rawPacked & 0xffffff);
  const make = (method, index, rgb, reason) => ({
    colorIndex: index, trueColorArgb: rgb === null ? null : argbFromRgb(rgb), colorMethod: method,
    sourceColorReason: reason, sourceColorRaw: packageRgb, sourceColorIndex: ci, isOff: off
  });

  // Exact raw DWG color has priority over the converter's synthesized fields.
  if (rawMethod === 0xc3 || rawPackedMethod === 0xc3) {
    const aci = (rawLow & 0xff) || rawIndex;
    if (aci >= 1 && aci <= 255) return make('Aci', aci, null, 'raw-dwg-method-c3');
  }
  if (rawMethod === 0xc2 || rawPackedMethod === 0xc2) return make('TrueColor', 256, rawLow, 'raw-dwg-method-c2');
  if ((rawMethod === 0 || !Number.isFinite(rawMethod)) && rawIndex >= 1 && rawIndex <= 255) return make('Aci', rawIndex, null, 'raw-dwg-old-aci-index');

  if (declared === 'TrueColor' && packageLow !== null) return make('TrueColor', 256, packageLow, 'reported-truecolor');
  if (declared === 'Aci' && ci >= 1 && ci <= 255) return make('Aci', ci, null, 'reported-aci');
  if (declared === 'ByBlock' && kind !== 'layer') return make('ByBlock', 0, null, 'reported-byblock');
  if (declared === 'ByLayer' && kind !== 'layer') return make('ByLayer', 256, null, 'reported-bylayer');

  if (ci >= 1 && ci <= 255) return make('Aci', ci, null, 'color-index');
  if (packedMethod === 0xc3) {
    const aci = packageLow & 0xff;
    if (aci >= 1 && aci <= 255) return make('Aci', aci, null, 'packed-method-c3');
  }
  if (packedMethod === 0xc2) return make('TrueColor', 256, packageLow, 'packed-method-c2');

  // Some libredwg-web versions expose an ACI as a small integer in `color`.
  if (packageRgb !== null && packageRgb >= 1 && packageRgb <= 255) return make('Aci', packageRgb, null, 'small-color-value-as-aci');

  if (kind !== 'layer' && ci === 0) return make('ByBlock', 0, null, 'color-index-byblock');
  if (kind !== 'layer' && ci === 256) return make('ByLayer', 256, null, 'color-index-bylayer');

  // A layer cannot itself be BYLAYER. White is the safest adaptive fallback
  // when the converter has replaced an unknown old ACI with 0xFFFFFF.
  if (kind === 'layer' && ci === 256 && packageRgb === 0xffffff) return make('Aci', 7, null, 'converter-default-white-fallback');
  if (kind === 'layer' && packageLow !== null && packageLow > 255) return make('TrueColor', 256, packageLow, 'layer-rgb-fallback');
  if (kind === 'layer') return make('Aci', 7, null, 'layer-default-aci7');
  if (packageLow !== null && packageLow > 255) return make('TrueColor', 256, packageLow, 'entity-rgb-fallback');
  return make('ByLayer', 256, null, 'entity-default-bylayer');
}

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

function commonProps(entity, inherited = null, ctx = null) {
  let layer = String(entity?.layer || inherited?.layer || '0');
  if (layer === '0' && inherited?.layer) layer = inherited.layer;
  let spec = normalizeCadColor(entity?.colorIndex, entity?.color, 'entity', (entity?.color && typeof entity.color === 'object') ? entity.color : null, entity?.colorMethod);
  if (spec.colorMethod === 'ByBlock' && inherited) {
    spec = {
      ...spec,
      colorIndex: inherited.colorIndex ?? 256,
      trueColorArgb: inherited.trueColorArgb ?? null,
      colorMethod: inherited.colorMethod || ((inherited.trueColorArgb ?? null) !== null ? 'TrueColor' : 'ByLayer'),
      sourceColorReason: 'inherited-byblock:' + (inherited.sourceColorReason || inherited.colorMethod || 'parent')
    };
  }
  if (ctx?.colorStats) ctx.colorStats[spec.sourceColorReason] = (ctx.colorStats[spec.sourceColorReason] || 0) + 1;
  return {
    layer,
    colorIndex: spec.colorIndex,
    trueColorArgb: spec.trueColorArgb,
    colorMethod: spec.colorMethod,
    sourceColorReason: spec.sourceColorReason,
    sourceColorRaw: spec.sourceColorRaw,
    sourceHandle: handleKey(entity?.handle),
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

const TCVN3_SOURCE = 'µ¸¶·¹¨»¾¼½Æ©ÇÊÈÉË®ÌÐÎÏÑªÒÕÓÔÖ×ÝØÜÞßãáâä«åèæçé¬êíëìîïóñòô­õøö÷ùúýûüþ¡¢§£¤¥¦';
const TCVN3_UNICODE = 'àáảãạăằắẳẵặâầấẩẫậđèéẻẽẹêềếểễệìíỉĩịòóỏõọôồốổỗộơờớởỡợùúủũụưừứửữựỳýỷỹỵĂÂĐÊÔƠƯ';
const TCVN3_MAP = new Map([...TCVN3_SOURCE].map((ch, i) => [ch, [...TCVN3_UNICODE][i]]));

function decodeCadUnicodeEscapes(value, stats = null) {
  return String(value ?? '').replace(/\\U\+([0-9A-Fa-f]{4})/g, (_, hex) => {
    if (stats) stats.unicodeEscapesDecoded++;
    return String.fromCodePoint(parseInt(hex, 16));
  });
}
function cleanCadText(value, isMText = false, stats = null) {
  let text = decodeCadUnicodeEscapes(value, stats)
    .replace(/%%d/gi, '°').replace(/%%p/gi, '±').replace(/%%c/gi, 'Ø')
    .replace(/\\~/g, ' ');
  if (isMText) {
    text = text.replace(/\\P/gi, '\n')
      .replace(/\\S([^;]*);/gi, (_, body) => String(body).replace(/[#^]/g, '/'))
      .replace(/\\[ACFHQTW][^;]*;/gi, '')
      .replace(/\\[LlOoKk]/g, '')
      .replace(/\\\\/g, '\\')
      .replace(/[{}]/g, '');
  }
  return text.replace(/\r/g, '').normalize('NFC');
}
function decodeTcvn3(value, uppercaseFont = false) {
  let changed = false, output = '';
  for (const ch of String(value ?? '')) {
    let mapped = TCVN3_MAP.get(ch);
    if (mapped !== undefined) {
      changed = true;
      if (uppercaseFont) mapped = mapped.toLocaleUpperCase('vi-VN');
      output += mapped;
    } else output += ch;
  }
  return { text: output.normalize('NFC'), changed };
}
function styleFontFile(entry) {
  return String(entry?.fontFile ?? entry?.font_file ?? entry?.font ?? entry?.fontName ?? entry?.fileName ?? '').trim();
}
function styleBigFontFile(entry) {
  return String(entry?.bigFontFile ?? entry?.bigfont_file ?? entry?.bigFont ?? entry?.bigfont ?? '').trim();
}
function detectTextEncoding(styleName, fontFile) {
  const key = upper(`${styleName} ${fontFile}`);
  if (/VNI[-_. ]/.test(key)) return 'VNI';
  if (/(^|[ ._\/-])\.?VN[A-Z0-9]|VNTIME|VNARIAL|VHARIAL|VHMEMO|VHELV|VNSWISS/.test(key)) return 'TCVN3';
  return 'Unicode';
}
function isLegacyUppercaseFont(styleName, fontFile) {
  const key = upper(`${styleName} ${fontFile}`).replace(/\.[A-Z0-9]+$/, '');
  return /\.VN[A-Z0-9]*H(?:\s|$)|VHTIME|VHARIAL|VHMEMO|VH[A-Z]+/.test(key);
}
function cssFontFamily(styleName, fontFile) {
  const key = upper(`${styleName} ${fontFile}`);
  if (/COURIER|MONO|TXT\.SHX/.test(key)) return '"Courier New", monospace';
  if (/TIME|ROMAN|MEMO|SERIF/.test(key)) return '"Times New Roman", "Liberation Serif", serif';
  if (/SYMBOL|WING|GREEK/.test(key)) return '"Segoe UI Symbol", Arial, sans-serif';
  return 'Arial, "Segoe UI", sans-serif';
}
function buildTextStyleMaps(database, rawTables) {
  const byName = new Map(), byHandle = new Map();
  const entries = database?.tables?.STYLE?.entries || database?.tables?.TEXTSTYLE?.entries || [];
  const add = source => {
    if (!source) return;
    const name = String(source.name ?? source.styleName ?? '').trim() || 'STANDARD';
    const raw = rawTables?.styles?.get(upper(name));
    const fontFile = styleFontFile(source) || raw?.fontFile || '';
    const bigFontFile = styleBigFontFile(source) || raw?.bigFontFile || '';
    const encoding = detectTextEncoding(name, fontFile);
    const item = {
      name, fontFile, bigFontFile, encoding,
      uppercaseLegacy: encoding === 'TCVN3' && isLegacyUppercaseFont(name, fontFile),
      fontCss: cssFontFamily(name, fontFile),
      handle: handleKey(source.handle || raw?.handle)
    };
    byName.set(upper(name), item);
    if (item.handle) byHandle.set(item.handle, item);
  };
  entries.forEach(add);
  for (const raw of rawTables?.styles?.values?.() || []) if (!byName.has(upper(raw.name))) add(raw);
  if (!byName.has('STANDARD')) add({ name: 'STANDARD', fontFile: 'Arial.ttf' });
  return { byName, byHandle, entries: [...byName.values()] };
}
function entityStyleName(entity) {
  const candidate = entity?.styleName ?? entity?.textStyleName ?? entity?.textStyle?.name ?? entity?.style?.name ??
    (typeof entity?.style === 'string' ? entity.style : '') ?? '';
  return String(candidate || '').trim();
}
function resolveTextStyle(entity, ctx) {
  const name = entityStyleName(entity);
  let style = name ? ctx.textStyles.byName.get(upper(name)) : null;
  if (!style) {
    const key = handleKey(entity?.styleHandle ?? entity?.textStyleHandle ?? entity?.style?.handle ?? entity?.style);
    if (key) style = ctx.textStyles.byHandle.get(key);
  }
  if (!style && name) {
    const encoding = detectTextEncoding(name, name);
    style = { name, fontFile: name, bigFontFile: '', encoding, uppercaseLegacy: encoding === 'TCVN3' && isLegacyUppercaseFont(name, name), fontCss: cssFontFamily(name, name), handle: '' };
  }
  return style || ctx.textStyles.byName.get('STANDARD');
}
function decodedTextRecord(entity, ctx, isMText = false, rawValue = '') {
  const style = resolveTextStyle(entity, ctx);
  const beforeEscapes = ctx.textStats.unicodeEscapesDecoded;
  let text = cleanCadText(rawValue, isMText, ctx.textStats);
  let converted = false;
  if (style.encoding === 'TCVN3') {
    const result = decodeTcvn3(text, style.uppercaseLegacy);
    text = result.text; converted = result.changed;
    if (converted) ctx.textStats.tcvn3Converted++;
  }
  if (beforeEscapes !== ctx.textStats.unicodeEscapesDecoded) ctx.textStats.entitiesWithUnicodeEscapes++;
  ctx.textStats.total++;
  ctx.textStats.styles[style.name] = (ctx.textStats.styles[style.name] || 0) + 1;
  return {
    text,
    fontName: style.fontCss,
    fontCss: style.fontCss,
    sourceStyleName: style.name,
    sourceFontFile: style.fontFile,
    sourceBigFontFile: style.bigFontFile,
    sourceTextEncoding: style.encoding,
    sourceTextConverted: converted
  };
}

function convertEntity(entity, ctx, transform = IDENTITY, inherited = null, depth = 0) {
  if (!entity || depth > 12) return [];
  const type = upper(entity.type), base = commonProps(entity, inherited, ctx);
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
      const textInfo = decodedTextRecord(entity, ctx, false, entity.text ?? entity.value ?? entity.defaultValue);
      if (textInfo.text) out.push({ type: 'TEXT', position: transform.point(entity.startPoint ?? entity.insertionPoint), height: Math.max(.0001, Math.abs(n(entity.textHeight, 2.5)) * transformedScale), rotationDeg: n(entity.rotation) * DEG + transform.rotation * DEG, ...textInfo, ...base });
      break;
    }
    case 'MTEXT': {
      const textInfo = decodedTextRecord(entity, ctx, true, entity.text);
      if (textInfo.text) out.push({ type: 'MTEXT', position: transform.point(entity.insertionPoint), height: Math.max(.0001, Math.abs(n(entity.textHeight, 2.5)) * transformedScale), rotationDeg: n(entity.rotation) * DEG + transform.rotation * DEG, ...textInfo, ...base });
      break;
    }
    case 'DIMENSION': {
      const a0 = entity.subDefinitionPoint1 || entity.centerPoint || entity.definitionPoint;
      const b0 = entity.subDefinitionPoint2 || entity.definitionPoint;
      if (a0 && b0) {
        const a = transform.point(a0), b = transform.point(b0), tp = transform.point(entity.textPoint || entity.definitionPoint || b0);
        const dx = b.x - a.x, dy = b.y - a.y, len = Math.hypot(dx, dy);
        const offset = len > 1e-12 ? (tp.x - a.x) * (-dy / len) + (tp.y - a.y) * (dx / len) : 0;
        const textInfo = decodedTextRecord(entity, ctx, true, entity.text === '<>' ? '' : (entity.text || ''));
        out.push({ type: 'DIMENSION', a, b, offset, text: textInfo.text, textOverride: textInfo.text, height: Math.max(.0001, 2.5 * transformedScale), textHeight: Math.max(.0001, 2.5 * transformedScale), arrowSize: Math.max(.0001, 2 * transformedScale), ...textInfo, ...base });
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

function convertDatabase(database, fileName, meta = {}, rawTables = null) {
  const layerEntries = database?.tables?.LAYER?.entries || [];
  const blockEntries = database?.tables?.BLOCK_RECORD?.entries || [];
  const blocks = new Map(blockEntries.map(b => [upper(b.name), b]));
  const textStyles = buildTextStyleMaps(database, rawTables);
  const colorStats = {};
  const layerStyles = layerEntries.map(layer => {
    const name = String(layer.name || '0');
    const raw = rawTables?.layers?.get(upper(name)) || null;
    const spec = normalizeCadColor(layer.colorIndex, layer.color, 'layer', raw || ((layer.color && typeof layer.color === 'object') ? layer.color : null), layer.colorMethod);
    colorStats['layer:' + spec.sourceColorReason] = (colorStats['layer:' + spec.sourceColorReason] || 0) + 1;
    return {
      name,
      colorIndex: spec.colorIndex,
      trueColorArgb: spec.trueColorArgb,
      colorMethod: spec.colorMethod,
      sourceColorReason: spec.sourceColorReason,
      sourceColorRaw: spec.sourceColorRaw,
      rawDwgColorIndex: raw?.index ?? null,
      rawDwgColorMethod: raw?.method ?? null,
      rawDwgColorRgb: raw?.rgb ?? null,
      isOff: !!layer.off || spec.isOff || n(layer.colorIndex) < 0,
      frozen: !!layer.frozen,
      locked: !!layer.locked,
      lineType: layer.lineType || null,
      lineweight: layer.lineweight ?? null
    };
  });
  const ctx = {
    blocks, unsupported: {}, blockStack: [], textStyles, colorStats,
    textStats: { total: 0, tcvn3Converted: 0, unicodeEscapesDecoded: 0, entitiesWithUnicodeEscapes: 0, styles: {} }
  };
  const entities = [];
  const sourceEntities = Array.isArray(database?.entities) ? database.entities : [];
  for (let i = 0; i < sourceEntities.length; i++) {
    if (i % 500 === 0) postProgress('convert', `Đang chuyển đối tượng ${i.toLocaleString('vi-VN')} / ${sourceEntities.length.toLocaleString('vi-VN')}…`, 50 + Math.round(45 * i / Math.max(1, sourceEntities.length)));
    entities.push(...convertEntity(sourceEntities[i], ctx));
  }
  const layers = [...new Set(entities.map(e => String(e.layer || '0')))];
  if (!layers.length) layers.push('0');
  const styleMap = new Map(layerStyles.map(s => [upper(s.name), s]));
  for (const name of layers) {
    if (!styleMap.has(upper(name))) {
      const raw = rawTables?.layers?.get(upper(name));
      const spec = normalizeCadColor(raw?.index, raw?.rgb, 'layer', raw, raw?.method);
      const item = { name, colorIndex: spec.colorIndex, trueColorArgb: spec.trueColorArgb, colorMethod: spec.colorMethod, sourceColorReason: spec.sourceColorReason, isOff: false, frozen: false, locked: false };
      layerStyles.push(item); styleMap.set(upper(name), item);
    }
  }
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
    textStyles: textStyles.entries,
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
      engine: '@mlightcad/libredwg-web 0.7.9 local + PWA color/font adapter 0.15.6',
      workerVersion: DWG_WORKER_VERSION,
      engineVersion: DWG_ENGINE_VERSION,
      engineSource: DWG_ENGINE_SOURCE,
      version: String(meta.version ?? 'không rõ'),
      codepage: String(meta.codepage ?? 'không rõ'),
      sourceEntityCount: sourceEntities.length,
      convertedEntityCount: entities.length,
      unknownEntityCount: n(meta.unknownEntityCount),
      blockCount: blockEntries.length,
      layerCount: layerEntries.length,
      textStyleCount: textStyles.entries.length,
      textStats: ctx.textStats,
      colorStats: ctx.colorStats,
      rawLayerColorCount: rawTables?.layers?.size || 0,
      rawTextStyleCount: rawTables?.styles?.size || 0,
      usedRawDwgTableApi: !!rawTables?.usedRawApi,
      rawTableApiError: rawTables?.error || '',
      directInBrowser: true
    }
  };
}

self.onmessage = async event => {
  const message = event.data || {};
  try {
    if (message.command === 'init') {
      await getEngine();
      postProgress('ready', 'Bộ đọc DWG WebAssembly nội bộ đã sẵn sàng.', 100);
      self.postMessage({ type: 'ready', ...DWG_ENGINE_INFO });
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
    let rawTables = null;
    try {
      meta.version = engine.dwg_get_version_type(ptr);
      meta.codepage = engine.dwg_get_codepage(ptr);
      postProgress('raw-tables', 'Đang khôi phục màu layer gốc và bảng font DWG…', 30);
      rawTables = extractRawCadTables(engine, ptr);
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
    const project = convertDatabase(database, message.fileName || 'BanVe.dwg', meta, rawTables);
    if (!project.entities.length) throw new Error('DWG đã được đọc nhưng chưa lấy được đối tượng 2D phù hợp để hiển thị. Hãy xem thống kê loại đối tượng chưa hỗ trợ.');
    project.dwgImport.elapsedMs = Math.round(performance.now() - started);
    postProgress('done', `Đã đọc ${project.entities.length.toLocaleString('vi-VN')} đối tượng DWG.`, 100);
    self.postMessage({ type: 'result', project, ...DWG_ENGINE_INFO });
  } catch (error) {
    console.error(error);
    self.postMessage({ type: 'error', message: error?.message || String(error), stack: error?.stack || '', ...DWG_ENGINE_INFO });
  }
};
