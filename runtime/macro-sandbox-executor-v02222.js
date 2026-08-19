'use strict';
(()=>{
const VERSION='0.22.22',$=id=>document.getElementById(id);
let results=[],batchId='';
const engine=()=>window.DwgSketchMacroEngineV02216;
const scenarios=()=>window.DwgSketchMacroRegressionScenariosV02220||window.DwgSketchMacroRegressionScenariosV02219;
const profiles=()=>window.DwgSketchMacroParameterProfilesV0227;
const clone=x=>JSON.parse(JSON.stringify(x));
const status=t=>{const el=$('cadMacroSandboxStatus')||$('cadMacroScenarioRunnerStatus');if(el)el.textContent=t;if(typeof showPwaToast==='function')showPwaToast(t)};
const impacts={
  ALL:'SELECTION_ONLY',SELTEXT:'SELECTION_ONLY',SELLINE:'SELECTION_ONLY',SELCIRCLE:'SELECTION_ONLY',SELCURVE:'SELECTION_ONLY',SELSQUARE:'SELECTION_ONLY',SELRECT:'SELECTION_ONLY',SELNONTEXT:'SELECTION_ONLY',SELF:'SELECTION_ONLY',
  GRIDON:'VIEW_STATE',GRIDOFF:'VIEW_STATE',GRIDSNAP:'VIEW_STATE',ORTHO:'VIEW_STATE',CROSSHAIR:'VIEW_STATE',ZA:'VIEW_STATE',F4:'VIEW_STATE',
  DELETE:'STRUCTURAL_MUTATION',BEXPLODE:'STRUCTURAL_MUTATION',B2SYM:'STRUCTURAL_MUTATION',RCOPY:'STRUCTURAL_MUTATION',
  RMOVE:'GEOMETRY_MUTATION',RROTATE:'GEOMETRY_MUTATION',RSCALE:'GEOMETRY_MUTATION',RMIRROR:'GEOMETRY_MUTATION',DEVROTATE:'GEOMETRY_MUTATION',
  SOLID:'CONTENT_MUTATION',HATCH:'CONTENT_MUTATION',AUTOCONNECT:'CONTENT_MUTATION'
};
const destructive=new Set(['DELETE','BEXPLODE','B2SYM']);
const roles=new Set(['Source','Target','Reference','Result','Result1','Result2','Result3']);
const outputRoles=new Set(['','Result','Result1','Result2','Result3','Target']);
const relative=new Set(['RMOVE','RCOPY']);
const transforms=new Set(['RROTATE','RSCALE','RMIRROR']);
function selectedSet(){const id=String($('cadMacroScenarioSetSelect')?.value||scenarios()?.selectedSetId?.()||'');return(scenarios()?.snapshot?.()||[]).find(x=>x.id===id)||null}
function valuesFor(m){return engine()?.resolvedValues?.(m)||{...(m?.parameterDefaults||{})}}
function assessStep(step,index,values){
  const action=engine()?.canon?.(step?.action)||String(step?.action||'').trim().toUpperCase(),row={stepIndex:index,stepId:step?.stepId||'',action,state:'OK',impact:impacts[action]||'UNKNOWN',inputRole:step?.inputRole||'CurrentSelection',outputRole:step?.outputRole||'',notes:[]};
  if(step?.enabled===false){row.state='SKIP_DISABLED';row.notes.push('Bước đang tắt; dry-run không tính là lỗi.');return row}
  const safe=new Set(['ALL','SELTEXT','SELLINE','SELCIRCLE','SELCURVE','SELSQUARE','SELRECT','SELNONTEXT','SELF','DELETE','SOLID','HATCH','AUTOCONNECT','DEVROTATE','BEXPLODE','B2SYM','GRIDON','GRIDOFF','GRIDSNAP','ORTHO','CROSSHAIR','ZA','F4','RMOVE','RCOPY','RROTATE','RSCALE','RMIRROR']);
  if(!safe.has(action)){row.state='FAIL';row.notes.push(`Action ${action} không thuộc replay-safe allowlist.`)}
  if(row.inputRole!=='CurrentSelection'&&!roles.has(row.inputRole)){row.state='FAIL';row.notes.push(`inputRole '${row.inputRole}' không hợp lệ.`)}
  if(step?.referenceRole&&!roles.has(step.referenceRole)){row.state='FAIL';row.notes.push(`referenceRole '${step.referenceRole}' không hợp lệ.`)}
  if(!outputRoles.has(row.outputRole)){row.state='FAIL';row.notes.push(`outputRole '${row.outputRole}' không hợp lệ.`)}
  if(row.outputRole&&!['RMOVE','RCOPY','RROTATE','RSCALE','RMIRROR'].includes(action)){row.state='FAIL';row.notes.push(`Action ${action} không hỗ trợ output role.`)}
  const args=step?.arguments&&typeof step.arguments==='object'?step.arguments:{},keys=new Set(Object.keys(args).map(k=>k.toLowerCase()));
  if(relative.has(action)&&(!keys.has('deltax')||!keys.has('deltay'))){row.state='FAIL';row.notes.push('Thiếu deltaX/deltaY.')}
  if(transforms.has(action)){
    const need=action==='RROTATE'?['pivotoffsetx','pivotoffsety','angledeg']:action==='RSCALE'?['pivotoffsetx','pivotoffsety','factor']:['axisaoffsetx','axisaoffsety','axisboffsetx','axisboffsety'];
    if(!need.every(k=>keys.has(k))){row.state='FAIL';row.notes.push('Arguments hình học chưa đủ.')}
    const mode=String(args.referenceMode||'SelectionBoundsCenter').toLowerCase();if(!['selectionboundscenter','selectionboundsanchor'].includes(mode)){row.state='FAIL';row.notes.push(`referenceMode '${args.referenceMode}' chưa hỗ trợ.`)}
  }
  for(const [arg,p] of Object.entries(step?.parameterBindings||{})){const name=String(p||'').trim();if(!name){row.state='FAIL';row.notes.push(`Binding '${arg}' chưa có tên parameter.`)}else if(!Object.prototype.hasOwnProperty.call(values,name.toUpperCase())&&!Object.prototype.hasOwnProperty.call(values,name)){row.state='FAIL';row.notes.push(`Thiếu giá trị parameter '${name}' cho argument '${arg}'.`)}}
  const cv=(window.DwgSketchMacroBranchConditionsV02216||window.DwgSketchMacroBranchConditionsV02213)?.validateSyntax?.(step);if(cv&&cv.ok===false){row.state='FAIL';row.notes.push(cv.text||'Condition syntax không hợp lệ.')}
  if(destructive.has(action)){if(row.state==='OK')row.state='WARN';row.notes.push('Thao tác phá hủy/cấu trúc; dry-run chỉ ghi nhận, không thực thi.')}
  else if(String(row.impact).endsWith('MUTATION'))row.notes.push('Bước sẽ thay đổi bản vẽ khi REAL PLAYBACK; dry-run không thực thi.')
  return row
}
function assessMacro(m,context={}){
  if(!m)return{...context,state:'DRY_FAIL',preflight:'MACROCHECK: chưa chọn macro.',warningCount:0,errorCount:1,mutationStepCount:0,checkedAt:new Date().toISOString(),steps:[]};
  const pf=engine()?.preflight?.(m,false)||{ok:false,text:'Macro Engine không hỗ trợ preflight.',errors:['preflight unavailable'],warnings:[]},values=valuesFor(m),steps=(m.steps||[]).map((s,i)=>assessStep(s,i+1,values)),errorCount=steps.filter(x=>x.state==='FAIL').length+(pf.ok?0:1),warningCount=steps.filter(x=>x.state==='WARN').length,mutationStepCount=steps.filter(x=>String(x.impact).endsWith('MUTATION')).length;
  return{scenarioSetId:context.scenarioSetId||'',scenarioId:context.scenarioId||'',scenarioName:context.scenarioName||'(macro hiện tại)',macroId:m.id||'',macroName:m.name||'',parameterProfileId:context.parameterProfileId||'',parameterProfileName:context.parameterProfileName||'',state:errorCount?'DRY_FAIL':warningCount?'DRY_WARN':'DRY_OK',preflight:pf.text||'',preflightErrors:clone(pf.errors||[]),preflightWarnings:clone(pf.warnings||[]),warningCount,errorCount,mutationStepCount,checkedAt:new Date().toISOString(),steps}
}
function render(){const box=$('cadMacroSandboxList');if(!box)return;box.innerHTML='';for(const x of results){const d=document.createElement('div');d.style.cssText='padding:4px;border-bottom:1px solid #ddd;font-size:12px';d.textContent=`[${x.state}] ${x.scenarioName||x.macroName} · ${x.errorCount} lỗi · ${x.warningCount} cảnh báo · ${x.mutationStepCount} mutation${x.parameterProfileName?' · Profile='+x.parameterProfileName:''}`;box.appendChild(d)}}
function nextBatch(){return'dry-'+new Date().toISOString().replace(/[-:.TZ]/g,'').slice(0,14)+'-'+Math.random().toString(36).slice(2,8)}
function saveUi(){return{macro:String($('cadMacroSelect')?.value||''),set:String($('cadMacroScenarioSetSelect')?.value||''),scenario:String($('cadMacroScenarioSelect')?.value||''),params:String($('cadMacroParameters')?.value||''),profile:String($('cadMacroProfileSelect')?.value||''),profileName:String($('cadMacroProfileName')?.value||'')}}
function restoreUi(s){if($('cadMacroSelect')){$('cadMacroSelect').value=s.macro;$('cadMacroSelect').dispatchEvent(new Event('change',{bubbles:true}))}if($('cadMacroParameters'))$('cadMacroParameters').value=s.params;if($('cadMacroProfileSelect'))$('cadMacroProfileSelect').value=s.profile;if($('cadMacroProfileName'))$('cadMacroProfileName').value=s.profileName;if(s.set&&$('cadMacroScenarioSetSelect')){$('cadMacroScenarioSetSelect').value=s.set;scenarios()?.refresh?.(s.set,s.scenario)}}
function loadMacroContext(macroId,profileId,originalParams){const m=(engine()?.getMacros?.()||[]).find(x=>String(x.id).toLowerCase()===String(macroId||'').toLowerCase());if(!m)return null;if($('cadMacroSelect')){$('cadMacroSelect').value=m.id;$('cadMacroSelect').dispatchEvent(new Event('change',{bubbles:true}))}if(profileId){if(!profiles()?.applyById?.(profileId))return null}else if($('cadMacroParameters'))$('cadMacroParameters').value=originalParams;return m}
function runSelected(){const m=engine()?.selectedMacro?.();if(!m){status('MACRODRYRUN: chưa chọn macro.');return}batchId=nextBatch();results=[assessMacro(m)];render();const r=results[0];status(`MACRODRYRUN ${r.state}: “${m.name}” · ${r.errorCount} lỗi · ${r.warningCount} cảnh báo · ${r.mutationStepCount} mutation · bản vẽ KHÔNG thay đổi.`)}
function runQueue(){const set=selectedSet();if(!set){status('Sandbox: chưa chọn Scenario Set.');return}const ui=saveUi(),originalParams=ui.params;batchId=nextBatch();results=[];try{for(const sc of set.scenarios||[]){if(sc.enabled===false)continue;const p=sc.parameterProfileId?profiles()?.getById?.(sc.parameterProfileId):null;if(sc.parameterProfileId&&!p){results.push({scenarioSetId:set.id,scenarioId:sc.id,scenarioName:sc.name,macroId:set.macroId,macroName:'',parameterProfileId:sc.parameterProfileId,parameterProfileName:'',state:'DRY_FAIL',preflight:'Parameter Profile liên kết không còn tồn tại.',preflightErrors:['PROFILE_MISSING'],preflightWarnings:[],warningCount:0,errorCount:1,mutationStepCount:0,checkedAt:new Date().toISOString(),steps:[]});continue}const m=loadMacroContext(set.macroId,sc.parameterProfileId,originalParams);if(!m){results.push({scenarioSetId:set.id,scenarioId:sc.id,scenarioName:sc.name,macroId:set.macroId,macroName:'',parameterProfileId:sc.parameterProfileId||'',parameterProfileName:p?.name||'',state:'DRY_FAIL',preflight:'Không thể nạp Macro/Profile cho dry-run.',preflightErrors:['CONTEXT_LOAD_FAILED'],preflightWarnings:[],warningCount:0,errorCount:1,mutationStepCount:0,checkedAt:new Date().toISOString(),steps:[]});continue}results.push(assessMacro(m,{scenarioSetId:set.id,scenarioId:sc.id,scenarioName:sc.name,parameterProfileId:sc.parameterProfileId||'',parameterProfileName:p?.name||''}))}}finally{restoreUi(ui)}render();const fail=results.filter(x=>x.state==='DRY_FAIL').length,warn=results.filter(x=>x.state==='DRY_WARN').length,ok=results.filter(x=>x.state==='DRY_OK').length;status(`Sandbox Queue hoàn tất · ${ok} DRY_OK · ${warn} DRY_WARN · ${fail} DRY_FAIL · KHÔNG phát macro, KHÔNG đổi bản vẽ/Baseline/Trace.`)}
function report(){const overall=!results.length?'EMPTY':results.some(x=>x.state==='DRY_FAIL')?'DRY_FAIL':results.some(x=>x.state==='DRY_WARN')?'DRY_WARN':'DRY_OK';return{schema:'dwg-sketch-macro-sandbox-report',schemaVersion:1,pwaVersion:VERSION,executionMode:'DRY_RUN_PLAN',drawingMutationAllowed:false,baselineUpdated:false,traceHistoryUpdated:false,macroRunCountUpdated:false,batchId,generatedAt:new Date().toISOString(),overall,results:clone(results)}}
function exportReport(){if(!results.length){status('Chưa có kết quả Dry-run/Sandbox để xuất.');return}const r=report(),name=`MacroSandbox_${new Date().toISOString().replace(/[:.]/g,'-')}.macro-sandbox.json`;if(typeof downloadTextFile==='function')downloadTextFile(name,JSON.stringify(r,null,2),'application/json;charset=utf-8');status(`Đã xuất Sandbox Report · ${r.overall}.`)}
function init(){$('cadMacroSandboxRunBtn')?.addEventListener('click',runQueue);$('cadMacroSandboxSelectedBtn')?.addEventListener('click',runSelected);$('cadMacroSandboxExportBtn')?.addEventListener('click',exportReport);render();const originalCommand=typeof command==='function'?command:null;if(originalCommand){const wrapped=function(cmd){const key=String(cmd||'').trim().toUpperCase();if(key==='MACRODRYRUN'||key==='MACROSANDBOX'){runSelected();if($('commandInput'))$('commandInput').value='';return}if(key==='MACRODRYRUNSET'||key==='MACROSANDBOXSET'){runQueue();if($('commandInput'))$('commandInput').value='';return}return originalCommand(cmd)};try{command=wrapped}catch{window.command=wrapped}}}
window.DwgSketchMacroSandboxV02222={version:VERSION,assessMacro,runSelected,runQueue,report,exportReport,snapshot:()=>clone({batchId,results})};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
