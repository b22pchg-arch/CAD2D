'use strict';
const APP_VERSION='0.15.0';
const CACHE_NAME='dwg-sketch-pwa-v'+APP_VERSION;
const DWG_ENGINE_CACHE='dwg-sketch-libredwg-web-0.7.9';
const DWG_CDN_PREFIX='https://cdn.jsdelivr.net/npm/@mlightcad/libredwg-web@0.7.9/';
const CORE_ASSETS=[
  './','./index.html','./manifest.webmanifest','./version.json','./dwg-worker.js',
  './icons/icon-192.png','./icons/icon-512.png','./icons/maskable-512.png',
  './HUONG_DAN_PWA_V0130_SELECT_FIND_MIRROR.txt','./HUONG_DAN_PWA_V0131_DWG_FIND_REPLACE.txt',
  './HUONG_DAN_PWA_V0132_OPEN_SELECT_FIX.txt','./HUONG_DAN_PWA_V0133_SELECT_DWG_COMPAT.txt',
  './HUONG_DAN_PWA_V0134_UNICODE_DXF.txt','./HUONG_DAN_PWA_V0135_DXF_TEXT.txt',
  './HUONG_DAN_PWA_V0140_DXF_MOBILE.txt','./HUONG_DAN_PWA_V0141_MOVE.txt',
  './HUONG_DAN_PWA_V0142_CAD_COMMANDS.txt','./HUONG_DAN_PWA_V0143_COLOR.txt',
  './BUILD_FIX_PWA_COLOR_V01432.txt','./HUONG_DAN_PWA_V0144_ICON_SELECTION_FILTER.txt',
  './HUONG_DAN_PWA_V0145_SPACE_LINKED_SELECTION.txt','./HUONG_DAN_PWA_V0146_COPY_MATCHPROP_REGION.txt',
  './HUONG_DAN_PWA_V0147_DXF_REFERENCE.txt','./HUONG_DAN_PWA_V0149_MULTI_TAB.txt',
  './HUONG_DAN_PWA_V01410_SELECT_FRAME.txt','./HUONG_DAN_PWA_V01411_LAYOUT.txt',
  './HUONG_DAN_PWA_V0150_DIRECT_DWG_WASM.txt','./THIRD_PARTY_NOTICES.txt',
  './sample_dxf_r12_unicode.dxf','./sample_color_aci_truecolor.dxf'
];
self.addEventListener('install',event=>{event.waitUntil(caches.open(CACHE_NAME).then(cache=>cache.addAll(CORE_ASSETS)));});
self.addEventListener('activate',event=>{event.waitUntil((async()=>{const keys=await caches.keys();await Promise.all(keys.filter(k=>k.startsWith('dwg-sketch-pwa-v')&&k!==CACHE_NAME).map(k=>caches.delete(k)));await self.clients.claim();})());});
self.addEventListener('message',event=>{if(event.data?.type==='SKIP_WAITING')self.skipWaiting();});
async function cacheDwgEngineRequest(request){
  const cache=await caches.open(DWG_ENGINE_CACHE),cached=await cache.match(request);
  if(cached)return cached;
  const response=await fetch(request);
  if(response&&(response.ok||response.type==='opaque'))await cache.put(request,response.clone());
  return response;
}
self.addEventListener('fetch',event=>{
  if(event.request.method!=='GET')return;
  const url=new URL(event.request.url);
  if(url.href.startsWith(DWG_CDN_PREFIX)){
    event.respondWith(cacheDwgEngineRequest(event.request).catch(async()=>{
      const cache=await caches.open(DWG_ENGINE_CACHE);return cache.match(event.request);
    }));
    return;
  }
  if(url.origin!==self.location.origin)return;
  if(url.pathname.endsWith('/version.json')||url.pathname.endsWith('version.json')){
    event.respondWith(fetch(event.request,{cache:'no-store'}).then(r=>{const copy=r.clone();caches.open(CACHE_NAME).then(c=>c.put(event.request,copy));return r;}).catch(()=>caches.match(event.request)));return;
  }
  if(event.request.mode==='navigate'){
    event.respondWith(fetch(event.request).then(r=>{const copy=r.clone();caches.open(CACHE_NAME).then(c=>c.put('./index.html',copy));return r;}).catch(()=>caches.match('./index.html')));return;
  }
  event.respondWith(caches.match(event.request).then(cached=>cached||fetch(event.request).then(r=>{if(r&&r.ok){const copy=r.clone();caches.open(CACHE_NAME).then(c=>c.put(event.request,copy));}return r;})));
});
