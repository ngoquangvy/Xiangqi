// Executed inside ad frames: access stays within each frame's own DOM.
export function adRoots(doc){
  const roots=[doc];
  for(let i=0;i<roots.length&&i<40;i++){
    for(const node of roots[i].querySelectorAll('*'))if(node.shadowRoot)roots.push(node.shadowRoot);
  }
  return roots;
}
export const closeSelectors='#dismiss-button, #dismiss-button-element, #close-button, #close_button, .close-button, [aria-label="Close ad"], [aria-label="Close Ad"], [aria-label="Đóng quảng cáo"], [aria-label="Close"], [aria-label="Đóng"]';
export function visibleControl(w,el,root=w.document){
  if(!el)return false;
  const r=el.getBoundingClientRect(),style=w.getComputedStyle(el);
  if(el.disabled||el.getAttribute('aria-disabled')==='true'||r.width<=0||r.height<=0||style.display==='none'||style.visibility==='hidden'||style.opacity==='0'||style.pointerEvents==='none')return false;
  const top=root.elementFromPoint?.(r.left+r.width/2,r.top+r.height/2)||w.document.elementFromPoint(r.left+r.width/2,r.top+r.height/2);
  return top===el||el.contains(top);
}
export function rewardGuard(w){
  for(const root of adRoots(w.document))for(const dialog of root.querySelectorAll('#close-confirmation-dialog')){
    if(dialog.id!=='close-confirmation-dialog')continue;
    if(!visibleControl(w,dialog,root))continue;
    const text=(dialog.innerText||'').replace(/\s+/g,' ');
    if(!/mất phần thưởng|lose.*reward|forfeit.*reward/i.test(text))return {visible:true,resumed:false};
    for(const button of dialog.querySelectorAll('button, [role="button"], [tabindex], #resume-button, #resume-ad-button, #continue-ad-button')){
      const label=(button.innerText||button.getAttribute('aria-label')||'').trim();
      if(/^(tiếp tục(?: xem)?|continue(?: watching)?|resume(?: ad)?)$/i.test(label)&&visibleControl(w,button,root)){
        button.click();return {visible:true,resumed:true};
      }
    }
    return {visible:true,resumed:false};
  }
  return {visible:false,resumed:false};
}
export function hasGoogleRewardGuard(doc){
  return adRoots(doc).some(root=>Array.from(root.querySelectorAll('#close-confirmation-dialog')).some(dialog=>/mất phần thưởng|lose.*reward|forfeit.*reward/i.test(dialog.textContent||''))&&root.querySelectorAll('#dismiss-button, #dismiss-button-element').length>0);
}
export function videoFinished(doc){
  const videos=adRoots(doc).flatMap(root=>Array.from(root.querySelectorAll('video'))).filter(v=>Number.isFinite(v.duration)&&v.duration>0);
  return videos.length>0&&videos.every(v=>v.ended===true);
}
export function closeFrameAd(w,completed,clicked=new WeakSet(),{googleOnly=false}={}){
  const doc=w.document;
  if(!completed||doc.visibilityState==='hidden')return false;
  if(rewardGuard(w).visible)return false;
  const selectors=googleOnly?'#dismiss-button, #dismiss-button-element':closeSelectors;
  for(const root of adRoots(doc))for(const el of Array.from(root.querySelectorAll(selectors)).sort((a,b)=>Number(b.id==='dismiss-button-element')-Number(a.id==='dismiss-button-element'))){
    if(el.closest?.('#close-confirmation-dialog'))continue;
    const r=el.getBoundingClientRect(),style=w.getComputedStyle(el);
    if(clicked.has(el)||el.disabled||el.getAttribute('aria-disabled')==='true'||r.width<=0||r.height<=0||style.display==='none'||style.visibility==='hidden'||style.opacity==='0'||style.pointerEvents==='none')continue;
    // A countdown/Skip is not the terminal Close control, even if clickable.
    // textContent includes hidden countdowns and SVG/CSS source with digits.
    // Only rendered text may block closing a button after the ad has ended.
    const text=[typeof el.innerText==='string'?el.innerText:el.textContent,el.getAttribute('aria-label')].join(' ');
    if(/\d|skip|bỏ qua/i.test(text))continue;
    const top=(root.elementFromPoint?.(r.left+r.width/2,r.top+r.height/2))||doc.elementFromPoint(r.left+r.width/2,r.top+r.height/2);
    if(top!==el&&!el.contains(top))continue;
    clicked.add(el);el.click();return true;
  }
  return false;
}
