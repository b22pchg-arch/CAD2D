(()=>{
  'use strict';
  const VERSION='0.22.15', KEY='DwgSketchPwa.MacroControlCenter.V1';
  const $=id=>document.getElementById(id);
  const panel=()=> $('macroWorkspace');
  function setOpen(open,focus=true){
    const p=panel(); if(!p)return;
    p.classList.toggle('show',!!open); p.setAttribute('aria-hidden',open?'false':'true');
    const b=$('macroBtn'); if(b)b.classList.toggle('active',!!open);
    try{localStorage.setItem(KEY,open?'1':'0')}catch{}
    if(open&&focus){setTimeout(()=>($('cadMacroSelect')||$('cadMacroName'))?.focus?.(),0)}
  }
  function toggle(){setOpen(!panel()?.classList.contains('show'))}
  function initialize(){
    $('macroBtn')?.addEventListener('click',toggle);
    $('openMacroWorkspaceBtn')?.addEventListener('click',()=>setOpen(true));
    $('mobileMacroBtn')?.addEventListener('click',()=>{document.getElementById('mobileSheet')?.classList.remove('show');setOpen(true)});
    $('closeMacroWorkspaceBtn')?.addEventListener('click',()=>setOpen(false,false));
    document.addEventListener('keydown',e=>{if(e.key==='Escape'&&panel()?.classList.contains('show')&&!document.querySelector('.modal.show'))setOpen(false,false)});
    // Không tự mở ở lần khởi động: workspace Macro là khu vực theo yêu cầu, tránh che canvas.
    setOpen(false,false);
  }
  window.DwgSketchMacroControlCenterV02215={version:VERSION,open:()=>setOpen(true),close:()=>setOpen(false,false),toggle,isOpen:()=>!!panel()?.classList.contains('show')};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',initialize,{once:true});else initialize();
})();
