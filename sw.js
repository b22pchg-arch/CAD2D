'use strict';
const APP_VERSION='0.22.13';
const CACHE_NAME='dwg-sketch-pwa-v'+APP_VERSION+'-fix1'; // V0.22.13 FIX1 cache bust for OSNAP aperture UI fix
const WORKER_URL='./dwg-worker.js?v='+encodeURIComponent(APP_VERSION);
const CORE_ASSETS=[
  './','./index.html','./manifest.webmanifest','./version.json',WORKER_URL,
  './icons/icon-192.png','./icons/icon-512.png','./icons/maskable-512.png',
  './vendor/libredwg-web-0.7.9/dist/libredwg-web.js',
  './vendor/libredwg-web-0.7.9/wasm/libredwg-web.js',
  './vendor/libredwg-web-0.7.9/wasm/libredwg-web.wasm',
  './vendor/libredwg-web-0.7.9/package.json',
  './vendor/libredwg-web-0.7.9/INTEGRATION_INFO.json',
  './vietnamese-text-normalizer-v02253.js','./interaction-core-v0202.js','./cad-interaction-architecture-v0225.js','./symbol-library-catalog-v0226.js','./symbol-instance-link-v0226.js','./macro-library-core-v02213.js','./macro-step-editor-relative-v02213.js','./macro-input-binding-v02213.js','./macro-branch-conditions-v02213.js','./macro-library-core-v02212.js','./macro-step-editor-relative-v02212.js','./macro-input-binding-v02212.js','./symbol-update-manager-v0227.js','./macro-parameter-profiles-v0227.js','./selection-editing-core-v02111.js','./render-stability-core-v021113.js','./object-snap-core-v02112.js','./block-symbol-editing-core-v02113.js','./network-diagram-core-v0210.js','./network-learning-core-v0214.js','./a4-diagram-template-core-v02114.js','./electrical-automation-v0179.js','./electrical-auto-learn-v0174.js','./electrical-learning-core-v0175.js','./electrical-learning-session-v0180.js','./symbol-template-v0169.js','./samples/LD_Tinh_AutoLearn/PWA_learned_templates.json'
];
const OPTIONAL_ASSETS=[
  './RELEASE_NOTES_V01812_PWA_V02212.txt','./HUONG_DAN_THU_V01812_ROLE_DERIVED_OUTPUTS.txt','./ROLE_DERIVED_OUTPUT_SCHEMA_V01812.md',
  './RELEASE_NOTES_V01811_PWA_V02211.txt','./HUONG_DAN_THU_V01811_MACRO_INPUT_BINDING.txt','./MACRO_INPUT_BINDING_SCHEMA_V01811.md',
  './RELEASE_NOTES_V01810_PWA_V02210.txt','./HUONG_DAN_THU_V01810_RELATIVE_GEOMETRY_PHASE3.txt','./RELATIVE_GEOMETRY_SCHEMA_V01810.md',
  './RELEASE_NOTES_V0189_PWA_V0229.txt','./HUONG_DAN_THU_V0189_RELATIVE_GEOMETRY_PHASE2.txt','./RELATIVE_GEOMETRY_SCHEMA_V0189.md',
  './RELEASE_NOTES_V0188_PWA_V0228.txt','./HUONG_DAN_THU_V0188_MACRO_STEP_RELATIVE.txt','./MACRO_STEP_RELATIVE_SCHEMA_V0188.md',
  './RELEASE_NOTES_V0187_PWA_V0227.txt','./HUONG_DAN_THU_V0187_SYMBOL_UPDATE_MACRO_PROFILES.txt','./SYMBOL_UPDATE_MACRO_PROFILE_SCHEMA_V0187.md',
  './RELEASE_NOTES_V01854_PWA_V02254_TEXT_PARAGRAPH_PARITY.txt','./HUONG_DAN_THU_V01854_TEXT_PARAGRAPH_PARITY.txt','./DWG_SAMPLE_TEXT_DIAGNOSTIC_V01854.txt','./TEXT_PARAGRAPH_PARITY_STATIC_TEST_V01854.txt','./MTEXT_CAP_HEIGHT_PARAGRAPH_PARITY_V01854.md',
  './RELEASE_NOTES_V01853_PWA_V02253_TEXT_METRIC_UNICODE.txt','./HUONG_DAN_THU_V01853_TEXT_METRIC_UNICODE.txt','./VIETNAMESE_ENCODING_NORMALIZER_V01853.md','./TEXT_METRIC_UNICODE_STATIC_TEST_V01853.txt','./DWG_SAMPLE_TEXT_DIAGNOSTIC_V01853.txt',
  './RELEASE_NOTES_V01852_PWA_V02252_MTEXT_LINE_SPACING_PARITY.txt','./HUONG_DAN_THU_V01852_MTEXT_LINE_SPACING_PARITY.txt','./MTEXT_LINE_SPACING_PARITY_DIAGNOSTIC_V01852.txt','./TEXT_LAYOUT_PARITY_STATIC_TEST_V01852.txt',
  './HUONG_DAN_THU_V0185_MACRO_LIBRARY_CATALOG.txt','./RELEASE_NOTES_V0185_PWA_V0225.txt','./INTERACTION_ARCHITECTURE_STATIC_TEST_V0185.txt','./MACRO_LIBRARY_CATALOG_SCHEMA_V0185.md',
  './HUONG_DAN_THU_V0184_CURVE_EDIT_DELTA.txt','./RELEASE_NOTES_V0184_PWA_V0224.txt','./INTERACTION_ARCHITECTURE_STATIC_TEST_V0184.txt','./VERSIONED_SYMBOL_LIBRARY_SCHEMA_V0184.md','./HUONG_DAN_THU_V0183_STRUCTURAL_TRANSACTION_DELTA.txt','./RELEASE_NOTES_V0183_PWA_V0223.txt','./INTERACTION_ARCHITECTURE_STATIC_TEST_V0183.txt','./HUONG_DAN_THU_V0182_TRANSACTION_DELTA_EXPANSION.txt','./RELEASE_NOTES_V0182_PWA_V0222.txt','./INTERACTION_ARCHITECTURE_STATIC_TEST_V0182.txt','./HUONG_DAN_THU_V0181_SERVICE_OWNERSHIP_DELTA.txt','./RELEASE_NOTES_V0181_PWA_V0221.txt','./INTERACTION_ARCHITECTURE_STATIC_TEST_V0181.txt','./HUONG_DAN_THU_V0180_INTERACTION_ARCHITECTURE.txt','./RELEASE_NOTES_V0180_PWA_V0220.txt','./INTERACTION_ARCHITECTURE_STATIC_TEST_V0180.txt',
  './HUONG_DAN_THU_V01713_BLOCK_SYMBOL_EDITING.txt','./RELEASE_NOTES_V01713_PWA_V02113.txt','./BLOCK_SYMBOL_EDITING_STATIC_TEST_V01713.txt','./HUONG_DAN_THU_V01714_A4_TEMPLATE_WORKFLOW.txt','./RELEASE_NOTES_V01714_PWA_V02114.txt','./A4_TEMPLATE_WORKFLOW_STATIC_TEST_V01714.txt',
  './HUONG_DAN_THU_V01712_OBJECT_SNAP.txt','./RELEASE_NOTES_V01712_PWA_V02112.txt','./OBJECT_SNAP_REGRESSION_V01712.txt',
  './HUONG_DAN_THU_V017113_PWA_RENDER_STABILITY.txt','./RELEASE_NOTES_V017113_PWA_V021113.txt','./PWA_LARGE_DRAWING_RENDER_STABILITY_TEST_V017113.txt',
  './HUONG_DAN_THU_V01711_SELECTION_EDITING.txt','./RELEASE_NOTES_V01711_PWA_V02111.txt','./SELECTION_EDITING_REGRESSION_V01711.txt','./SELECTION_EDITING_STATIC_TEST_V01711.txt',
  './HUONG_DAN_THU_V01710_RENDERING_PARITY.txt','./RELEASE_NOTES_V01710_PWA_V02110.txt',
  './HUONG_DAN_THU_V0177_A4_TEMPLATE_WORKFLOW.txt','./RELEASE_NOTES_V0177_PWA_V0217.txt','./A4_TEMPLATE_WORKFLOW_TEST_REPORT_V0177.txt',
  './HUONG_DAN_THU_V0176_A4_FRAME_SELECTION.txt','./RELEASE_NOTES_V0176_PWA_V0216.txt','./A4_FRAME_SELECTION_TEST_REPORT_V0176.txt',
  './HUONG_DAN_THU_V0175_A4_EDITABLE_TEMPLATES.txt','./RELEASE_NOTES_V0175_PWA_V0215.txt','./A4_EDITABLE_TEMPLATE_SCHEMA_V0175.md',
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
  './huong-dan.html',
  './BUILD_REPORT_V0168.txt',
  './HUONG_DAN_PWA_V0168_AUTO_GRID_GENERATOR.txt','./HUONG_DAN_PWA_V0169_ROTATE_CUSTOM_SYMBOL_TEMPLATES.txt','./BUILD_REPORT_V0169.txt','./HUONG_DAN_PWA_V0170_COMBINED_OSNAP.txt','./BUILD_REPORT_V0170.txt','./HUONG_DAN_PWA_V0171_HATCH_COMPLETENESS.txt','./BUILD_REPORT_V0171.txt','./PWA_HATCH_DWG_TEST_REPORT_V0171.txt','./HUONG_DAN_PWA_V0172_LWPOLYLINE_CLOSURE_FIX.txt','./BUILD_REPORT_V0172.txt','./PWA_LWPOLYLINE_DWG_TEST_REPORT_V0172.txt','./HUONG_DAN_PWA_V0173_TOPOLOGY_LEARNING_A4.txt','./BUILD_REPORT_V0173.txt','./PWA_UI_SMOKE_TEST_V0173.txt','./HUONG_DAN_PWA_V0174_DWG_AUTO_LEARN.txt','./BUILD_REPORT_V0174.txt','./HUONG_DAN_PWA_V0175_LONG_TERM_LEARNING.txt','./BUILD_REPORT_V0175.txt','./HUONG_DAN_PWA_V0176_CURSOR_COORDINATE_FIX.txt','./BUILD_REPORT_V0176.txt','./HUONG_DAN_PWA_V0177_ORTHO_CROSSHAIR.txt','./BUILD_REPORT_V0177.txt','./HUONG_DAN_PWA_V0178_DIRECTIONAL_AUTOGRID.txt','./BUILD_REPORT_V0178.txt','./PWA_DIRECTIONAL_AUTOGRID_TEST_V0178.txt','./HUONG_DAN_PWA_V0179_VIETNAMESE_TOPOLOGY_BULK_APPLY.txt','./BUILD_REPORT_V0179.txt','./PWA_TOPOLOGY_VIETNAMESE_BULK_APPLY_TEST_V0179.txt',
  './sample_electrical_grid.topology.json','./sample_electrical_grid_directional.topology.json','./sample_custom_symbol_library.json',
  './sample_electrical_grid.csv','./HUONG_DAN_PWA_V0186_LAYER_COLOR_JSON_AUTONATIVE.txt','./BUILD_REPORT_V0186.txt','./HUONG_DAN_PWA_V0181_GRID_AUTOCONNECT_FONT.txt','./BUILD_REPORT_V0181.txt','./GRID_AUTOCONNECT_FONT_TEST_REPORT_V01441_V0181.txt','./HUONG_DAN_PWA_V0182_VECTOR_PRINT_NATIVE_DWG.txt','./BUILD_REPORT_V0182.txt','./PRINT_NATIVE_DWG_TEST_REPORT_V01442_V0182.txt','./HUONG_DAN_PWA_V0167_INTEGRATED_HELP.txt','./BUILD_REPORT_V0167.txt','./THIRD_PARTY_NOTICES.txt','./sample_dxf_r12_unicode.dxf','./sample_color_aci_truecolor.dxf'
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
