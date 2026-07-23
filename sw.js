'use strict';
const APP_VERSION='0.16.7';
const CACHE_NAME='dwg-sketch-pwa-v'+APP_VERSION;
const WORKER_URL='./dwg-worker.js?v='+encodeURIComponent(APP_VERSION);
const CORE_ASSETS=[
  './','./index.html','./manifest.webmanifest','./version.json',WORKER_URL,
  './icons/icon-192.png','./icons/icon-512.png','./icons/maskable-512.png',
  './vendor/libredwg-web-0.7.9/dist/libredwg-web.js',
  './vendor/libredwg-web-0.7.9/wasm/libredwg-web.js',
  './vendor/libredwg-web-0.7.9/wasm/libredwg-web.wasm',
  './vendor/libredwg-web-0.7.9/package.json',
  './vendor/libredwg-web-0.7.9/INTEGRATION_INFO.json'
];
const OPTIONAL_ASSETS=[
  './HUONG_DAN_PWA_V0130_SELECT_FIND_MIRROR.txt','./HUONG_DAN_PWA_V0131_DWG_FIND_REPLACE.txt',
  './HUONG_DAN_PWA_V0132_OPEN_SELECT_FIX.txt','./HUONG_DAN_PWA_V0133_SELECT_DWG_COMPAT.txt',
  './HUONG_DAN_PWA_V0134_UNICODE_DXF.txt','./HUONG_DAN_PWA_V0135_DXF_TEXT.txt',
  './HUONG_DAN_PWA_V0140_DXF_MOBILE.txt','./HUONG_DAN_PWA_V0141_MOVE.txt',
  './HUONG_DAN_PWA_V0142_CAD_COMMANDS.txt','./HUONG_DAN_PWA_V0143_COLOR.txt',
  './BUILD_FIX_PWA_COLOR_V01432.txt','./HUONG_DAN_PWA_V0144_ICON_SELECTION_FILTER.txt',
  './HUONG_DAN_PWA_V0145_SPACE_LINKED_SELECTION.txt','./HUONG_DAN_PWA_V0146_COPY_MATCHPROP_REGION.txt',
  './HUONG_DAN_PWA_V0147_DXF_REFERENCE.txt','./HUONG_DAN_PWA_V0149_MULTI_TAB.txt',
  './HUONG_DAN_PWA_V01410_SELECT_FRAME.txt','./HUONG_DAN_PWA_V01411_LAYOUT.txt',
  './HUONG_DAN_PWA_V0150_DIRECT_DWG_WASM.txt','./HUONG_DAN_PWA_V0151_COLOR_FONT_VIETNAMESE.txt',
  './HUONG_DAN_PWA_V0152_MOBILE_COMMAND_BACK_RECOVERY.txt','./HUONG_DAN_PWA_V0153_QUICK_FIND_MOBILE_PANELS.txt',
  './HUONG_DAN_PWA_V0154_LOCAL_LIBREDWG_CACHE_GUARD.txt','./HUONG_DAN_PWA_V0155_EXPORT_COLOR_CLIPBOARD.txt','./HUONG_DAN_PWA_V0156_PNG_SHARP_QUALITY.txt','./HUONG_DAN_PWA_V0157_FILE_OPEN_REGRESSION_FIX.txt','./HUONG_DAN_PWA_V0158_SMOOTH_INTERACTION.txt','./HUONG_DAN_PWA_V0159_PINCH_ZOOM_ANCHOR_FIX.txt','./HUONG_DAN_PWA_V0160_TRIM_CURVES_SCALE_AREA.txt','./HUONG_DAN_PWA_V0161_GEOMETRY_REPAIR.txt','./HUONG_DAN_PWA_V0162_TEXT_PLACEMENT_REPAIR.txt','./HUONG_DAN_PWA_V0163_REPAIR_EXPORT_FRAME_SCOPE.txt','./HUONG_DAN_PWA_V0164_REPAIR_SCOPE_BATCH_SCAN.txt','./HUONG_DAN_PWA_V0165_TEXT_OVERLAP_DETECTION_FIX.txt','./HUONG_DAN_PWA_V0166_TRIANGLE_FILL_ELECTRICAL_AUTOMATION.txt',
  './BUILD_REPORT_V0151.txt','./BUILD_REPORT_V0152.txt','./BUILD_REPORT_V0153.txt','./BUILD_REPORT_V0154.txt','./BUILD_REPORT_V0155.txt','./BUILD_REPORT_V0156.txt','./BUILD_REPORT_V0157.txt','./BUILD_REPORT_V0158.txt','./BUILD_REPORT_V0159.txt','./BUILD_REPORT_V0160.txt','./BUILD_REPORT_V0161.txt','./BUILD_REPORT_V0162.txt','./BUILD_REPORT_V0163.txt','./BUILD_REPORT_V0164.txt','./BUILD_REPORT_V0165.txt','./BUILD_REPORT_V0166.txt',
  './huong-dan.html','./HUONG_DAN_PWA_V0167_INTEGRATED_HELP.txt','./BUILD_REPORT_V0167.txt','./THIRD_PARTY_NOTICES.txt','./sample_dxf_r12_unicode.dxf','./sample_color_aci_truecolor.dxf'
];
self.addEventListener('install',event=>{
  self.skipWaiting();
  event.waitUntil((async()=>{
    const cache=await caches.open(CACHE_NAME);
    await cache.addAll(CORE_ASSETS);
    await Promise.allSettled(OPTIONAL_ASSETS.map(asset=>cache.add(asset)));
  })());
});
self.addEventListener('activate',event=>{
  event.waitUntil((async()=>{
    const keys=await caches.keys();
    await Promise.all(keys.filter(k=>(k.startsWith('dwg-sketch-pwa-v')&&k!==CACHE_NAME)||k==='dwg-sketch-libredwg-web-0.7.9').map(k=>caches.delete(k)));
    await self.clients.claim();
  })());
});
self.addEventListener('message',event=>{if(event.data?.type==='SKIP_WAITING')self.skipWaiting();});
async function networkFirst(request,fallbackKey=null){
  const cache=await caches.open(CACHE_NAME);
  try{
    const response=await fetch(request,{cache:'no-store'});
    if(response&&response.ok)await cache.put(request,response.clone());
    return response;
  }catch(error){
    const cached=await cache.match(request)|| (fallbackKey?await cache.match(fallbackKey):null);
    if(cached)return cached;
    throw error;
  }
}
self.addEventListener('fetch',event=>{
  if(event.request.method!=='GET')return;
  const url=new URL(event.request.url);
  if(url.origin!==self.location.origin)return;
  if(url.pathname.endsWith('/version.json')||url.pathname.endsWith('version.json')){
    event.respondWith(networkFirst(event.request,'./version.json'));return;
  }
  if(event.request.mode==='navigate'){
    event.respondWith(networkFirst(event.request,'./index.html'));return;
  }
  if(url.pathname.endsWith('/dwg-worker.js')){
    event.respondWith(networkFirst(event.request,WORKER_URL));return;
  }
  event.respondWith((async()=>{
    const cache=await caches.open(CACHE_NAME);
    const cached=await cache.match(event.request);
    if(cached)return cached;
    const response=await fetch(event.request);
    if(response&&response.ok)await cache.put(event.request,response.clone());
    return response;
  })());
});
