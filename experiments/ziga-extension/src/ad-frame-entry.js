import {settings} from '../settings.mjs';
import {adSurface} from './ad-diagnostic.js';
import {videoFinished,closeFrameAd,adRoots,closeSelectors,rewardGuard,hasGoogleRewardGuard} from './ad-frame.js';
if(window!==window.top){
  let busy=false,adId=null,clicked=new WeakSet(),endedAdId=null;
  const observedRoots=new WeakSet();
  function observeVideos(){
    for(const root of adRoots(document))if(!observedRoots.has(root)){
      observedRoots.add(root);
      root.addEventListener('ended',event=>{
        if(event.target?.tagName==='VIDEO'&&event.target.ended&&adId){endedAdId=adId;void tick();}
      },true);
    }
  }
  async function tick(){
    if(busy||document.visibilityState==='hidden')return;
    busy=true;
    try{
      const state=await chrome.runtime.sendMessage({kind:'ad-frame-poll',adId,videoEnded:adId!==null&&(videoFinished(document)||endedAdId===adId)});
      document.documentElement.dataset.zigaAdState=state?.allowed?(state.completed?'completed':'watching'):'inactive';
      if(!state?.allowed)return;
      observeVideos();
      if(adId!==state.adId){adId=state.adId;endedAdId=null;clicked=new WeakSet();setTimeout(tick,0);}
      const candidates=adRoots(document).reduce((n,root)=>n+root.querySelectorAll(closeSelectors).length,0);
      const guard=rewardGuard(window);
      let didClick=false;
      if(!guard.visible){
        if(state.completed)didClick=closeFrameAd(window,true,clicked);
        else if(hasGoogleRewardGuard(document)){
          const permission=await chrome.runtime.sendMessage({kind:'ad-close-probe',adId,hasGuard:true});
          if(permission?.allowed)didClick=closeFrameAd(window,true,new WeakSet(),{googleOnly:true});
        }
      }
      await chrome.runtime.sendMessage({kind:'ad-frame-report',adId,candidates,clicked:didClick,continued:guard.resumed,surface:adSurface(window)});
    }catch(e){document.documentElement.dataset.zigaAdState='error: '+e.message;}finally{busy=false;}
  }
  document.addEventListener('ended',()=>void tick(),true);
  new MutationObserver(()=>void tick()).observe(document.documentElement,{subtree:true,childList:true,attributes:true,attributeFilter:['disabled','aria-disabled','hidden','style','class']});
  chrome.runtime.onMessage.addListener(msg=>{if(msg?.kind==='ad-frame-wake')void tick();});
  setInterval(tick,settings.ads.framePollMs);void tick();
}
