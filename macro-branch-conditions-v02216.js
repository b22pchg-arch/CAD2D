
'use strict';
(()=>{
 const VERSION='0.22.16',MODES=['Always','IfRoleExists','IfRoleMissing','IfCountAtLeast','IfCountAtMost','IfCountEquals','IfKindOverlay','IfKindCad','IfKindMixed'],ROLES=['SameAsInput','CurrentSelection','Source','Target','Reference','Result','Result1','Result2','Result3'];
 const norm=v=>String(v||'').trim().toLowerCase();
 function modeOf(s){const raw=String(s?.conditionMode||'Always');return MODES.find(x=>norm(x)===norm(raw))||null}
 function roleOf(s){let r=String(s?.conditionRole||'SameAsInput');if(norm(r)==='sameasinput')r=String(s?.inputRole||'CurrentSelection');return ROLES.find(x=>norm(x)===norm(r))||null}
 function validateSyntax(s){const m=modeOf(s);if(!m)return{ok:false,text:`conditionMode ${s?.conditionMode} không hợp lệ.`};if(m==='Always')return{ok:true,text:'Always'};const r=roleOf(s);if(!r)return{ok:false,text:`conditionRole ${s?.conditionRole} không hợp lệ.`};if(['IfCountAtLeast','IfCountAtMost','IfCountEquals'].includes(m)){const n=Number(s?.conditionValue);if(!Number.isInteger(n)||n<0)return{ok:false,text:`${m} cần ConditionValue là số nguyên >= 0.`}}return{ok:true,text:`${m}(${r})`}}
 function refsForRole(s,binding){const r=roleOf(s);if(r==='CurrentSelection')return Array.isArray(selected)?selected.slice():[];return binding?.refsFor?.(r)||[]}
 function evaluate(s,binding){const v=validateSyntax(s);if(!v.ok)return{ok:false,run:false,text:v.text};const m=modeOf(s);if(m==='Always')return{ok:true,run:true,text:'Always'};const r=roleOf(s),refs=refsForRole(s,binding),count=refs.length,ov=refs.filter(x=>x?.kind==='overlay').length,cad=refs.filter(x=>x?.kind==='entity').length,n=Math.max(0,Math.floor(Number(s?.conditionValue)||0));const run=({IfRoleExists:count>0,IfRoleMissing:count===0,IfCountAtLeast:count>=n,IfCountAtMost:count<=n,IfCountEquals:count===n,IfKindOverlay:count>0&&cad===0,IfKindCad:count>0&&ov===0,IfKindMixed:ov>0&&cad>0})[m]??true;return{ok:true,run,text:`${m}(${r}${m.startsWith('IfCount')?','+n:''}) => ${run?'RUN':'SKIP'} [${count}=${ov}O+${cad}C]`}}
 function init(){const cm=document.getElementById('cadMacroStepConditionMode'),cr=document.getElementById('cadMacroStepConditionRole');if(cm&&!cm.options.length)for(const v of MODES){const o=document.createElement('option');o.value=v;o.textContent=v;cm.appendChild(o)}if(cr&&!cr.options.length)for(const v of ROLES){const o=document.createElement('option');o.value=v;o.textContent=v;cr.appendChild(o)}}
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
 window.DwgSketchMacroBranchConditionsV02216={version:VERSION,modes:[...MODES],roles:[...ROLES],validateSyntax,evaluate,roleOf};window.DwgSketchMacroBranchConditionsV02215=window.DwgSketchMacroBranchConditionsV02216;window.DwgSketchMacroBranchConditionsV02213=window.DwgSketchMacroBranchConditionsV02216;
})();

