'use strict';
// DWG Sketch PWA V0.21.11 - Selection & Editing Core.
// Specialized grip undo/redo entries avoid restoring the complete project snapshot.
(() => {
  const VERSION='0.21.11';
  const KIND='grip-v02111';
  const previousUndo=typeof undo==='function'?undo:null;
  const previousRedo=typeof redo==='function'?redo:null;

  function isGripEntry(value){return !!value&&typeof value==='object'&&value.kind===KIND&&value.ref&&value.before&&value.after}
  function resolve(entry){return typeof resolveSelectionEditRefV02111==='function'?resolveSelectionEditRefV02111(entry?.ref):null}
  function applyEntry(entry,useAfter){
    const ref=resolve(entry);if(!ref?.item)return false;
    if(typeof applyEditableGeometryV02111!=='function')return false;
    applyEditableGeometryV02111(ref.item,useAfter?entry.after:entry.before);
    if(typeof recalcBounds==='function')recalcBounds();
    else if(typeof invalidateGeometryCaches==='function')invalidateGeometryCaches();
    if(typeof setDirty==='function')setDirty(true);
    if(Array.isArray(selected)){selected=[ref]}
    if(typeof updateSelectionPanel==='function')updateSelectionPanel();
    if(typeof updateHistoryButtons==='function')updateHistoryButtons();
    if(typeof draw==='function')draw();
    return true;
  }
  function undoGrip(){
    if(!Array.isArray(undoStack)||!undoStack.length||!isGripEntry(undoStack[undoStack.length-1]))return false;
    const entry=undoStack.pop();
    if(!applyEntry(entry,false)){undoStack.push(entry);if(typeof status==='function')status('Không thể Undo GRIP: đối tượng đã thay đổi hoặc không còn tồn tại.');return true}
    if(!Array.isArray(redoStack))redoStack=[];
    redoStack.push(entry);if(typeof trimAdaptiveHistory==='function')trimAdaptiveHistory(redoStack);
    if(typeof updateHistoryButtons==='function')updateHistoryButtons();
    if(typeof status==='function')status(`Đã Undo ${entry.label||'GRIP'} mà không nạp lại toàn bộ dự án.`);
    return true;
  }
  function redoGrip(){
    if(!Array.isArray(redoStack)||!redoStack.length||!isGripEntry(redoStack[redoStack.length-1]))return false;
    const entry=redoStack.pop();
    if(!applyEntry(entry,true)){redoStack.push(entry);if(typeof status==='function')status('Không thể Redo GRIP: đối tượng đã thay đổi hoặc không còn tồn tại.');return true}
    if(!Array.isArray(undoStack))undoStack=[];
    undoStack.push(entry);if(typeof trimAdaptiveHistory==='function')trimAdaptiveHistory(undoStack);
    if(typeof updateHistoryButtons==='function')updateHistoryButtons();
    if(typeof status==='function')status(`Đã Redo ${entry.label||'GRIP'} mà không nạp lại toàn bộ dự án.`);
    return true;
  }

  if(previousUndo){undo=function undoV02111(){if(undoGrip())return;return previousUndo()}}
  if(previousRedo){redo=function redoV02111(){if(redoGrip())return;return previousRedo()}}
  const undoBtn=document.getElementById('undoBtn'),redoBtn=document.getElementById('redoBtn');
  if(undoBtn)undoBtn.onclick=undo;if(redoBtn)redoBtn.onclick=redo;

  window.DwgSketchSelectionEditingCoreV02111=Object.freeze({
    version:VERSION,
    historyKind:KIND,
    undoGrip,
    redoGrip,
    cycleSelection:()=>typeof cycleSelectionAtCursorV02111==='function'?cycleSelectionAtCursorV02111():false
  });
  console.info(`[DWG Sketch] Selection & Editing Core ${VERSION} active.`);
})();
