import {settings} from '../settings.mjs';
import {adSurface} from './ad-diagnostic.js';
// Observe genuine SDK callbacks; never invoke adViewed/reward callbacks ourselves.
const watches=new WeakMap();
// Only inspect accessible ad documents. Cross-origin frames remain browser-protected.
export function closeCompletedAd(w,completed,clicked=new WeakSet()){
  if(!completed||w.document?.visibilityState==='hidden')return false;
  function scan(doc,insideAd=false,depth=0){
    if(!doc||depth>3)return false;
    const view=doc.defaultView||w;
    for(const el of doc.querySelectorAll?.('#dismiss-button, #close-button, #close_button, .close-button, [aria-label="Close"], [aria-label="Đóng"]')||[]){
      if(!insideAd&&!el.closest?.('[id*="google_vignette"], ins.adsbygoogle, [id*="ad-container"]'))continue;
      const rect=el.getBoundingClientRect?.(),style=view.getComputedStyle?.(el);
      if(clicked.has(el)||el.disabled||el.getAttribute?.('aria-disabled')==='true'||!rect||rect.width<=0||rect.height<=0||style?.display==='none'||style?.visibility==='hidden'||style?.opacity==='0'||style?.pointerEvents==='none'||typeof el.click!=='function')continue;
      const top=doc.elementFromPoint?.(rect.left+rect.width/2,rect.top+rect.height/2);
      if(top!==el&&!el.contains?.(top))continue;
      clicked.add(el);el.click();return true;
    }
    for(const frame of doc.querySelectorAll?.('iframe')||[]){
      const ad=insideAd||/google|doubleclick|vignette|ad-container/i.test([frame.id,frame.src,frame.title].join(' '));
      if(!ad)continue;
      try{if(scan(frame.contentDocument,true,depth+1))return true;}catch{}
    }
    return false;
  }
  return scan(w.document);
}
export class AdWatch{
  constructor(now=()=>Date.now()){this.phase='unknown';this.requestAt=null;this.startAt=null;this.flagAt=null;this.clearAt=null;this.wrapper=null;this.now=now;this.failed=false;this.sequence=0;this.adId=null;}
  install(w){
    const original=w.adBreak;if(typeof original!=='function'||original===this.wrapper)return;
    const watch=this;
    const wrapper=function(options,...rest){
      if(!options||typeof options!=='object')return original.call(this,options,...rest);
      watch.phase='requested';watch.requestAt=watch.now();watch.startAt=null;watch.clearAt=null;watch.failed=false;watch.completed=false;watch.clicked=new WeakSet();
      watch.reward=options.type==='reward';
      watch.adId=`${watch.now()}:${++watch.sequence}`;
      const forwarded={...options};
      for(const name of ['beforeAd','afterAd','adBreakDone','adViewed']){
        const callback=options[name];
        forwarded[name]=function(...args){
          if(name==='beforeAd'){watch.phase='active';watch.startAt=watch.now();watch.clearAt=null;}
          else if(name==='adViewed'){watch.completed=true;}
          else{watch.phase='ended';if(name==='afterAd'||args[0]?.breakStatus==='viewed')watch.completed=true;if(name==='adBreakDone')watch.failed=['timeout','invalid','noAdPreloaded','frequencyCapped','error','dismissed','ignored','notReady'].includes(args[0]?.breakStatus);}
          return typeof callback==='function'?callback.apply(this,args):undefined;
        };
      }
      return original.call(this,forwarded,...rest);
    };
    try{w.adBreak=wrapper;this.wrapper=wrapper;}catch{}
  }
  evidence(w){
    const d=w.document;
    if(typeof d?.querySelectorAll!=='function'||d.visibilityState==='hidden')return {known:false,overlay:false,boardExposed:false};
    const vw=w.innerWidth||d.documentElement?.clientWidth||0,vh=w.innerHeight||d.documentElement?.clientHeight||0;
    if(!vw||!vh)return {known:false,overlay:false,boardExposed:false};
    const canvas=d.querySelector?.('canvas');const r=canvas?.getBoundingClientRect?.();
    let overlay=false;
    const nodes=d.querySelectorAll('iframe, ins.adsbygoogle, [id*="google_vignette"], [class*="google-vignette"]');
    for(const el of Array.from(nodes).slice(0,100)){
      const rect=el.getBoundingClientRect?.();if(!rect||rect.width<=0||rect.height<=0)continue;
      const style=w.getComputedStyle?.(el);if(style?.display==='none'||style?.visibility==='hidden'||style?.opacity==='0')continue;
      const label=[el.id,el.className,el.src,el.getAttribute?.('title')].join(' ');
      if(!/google|ads|doubleclick|vignette|ad-container/i.test(label))continue;
      const width=Math.max(0,Math.min(vw,rect.right)-Math.max(0,rect.left));
      const height=Math.max(0,Math.min(vh,rect.bottom)-Math.max(0,rect.top));
      const coversBoard=r&&r.left+r.width/2>=rect.left&&r.left+r.width/2<=rect.right&&r.top+r.height/2>=rect.top&&r.top+r.height/2<=rect.bottom;
      if((width*height>=vw*vh*0.4&&width>=vw*0.65)||(coversBoard&&width>=vw*0.25&&height>=vh*0.3)){overlay=true;break;}
    }
    let boardExposed=false;
    if(r&&r.width>0&&r.height>0&&typeof d.elementFromPoint==='function'){
      const x=Math.max(0,Math.min(vw-1,r.left+r.width/2)),y=Math.max(0,Math.min(vh-1,r.top+r.height/2));
      const top=d.elementFromPoint(x,y);boardExposed=top===canvas||canvas.contains?.(top)===true;
    }
    return {known:true,overlay,boardExposed};
  }
  inspect(w,now=Date.now(),{credited=false}={}){
    this.install(w);
    if(w.document?.visibilityState==='hidden')this.hiddenAt??=now;
    else if(this.hiddenAt!==undefined){
      const pause=now-this.hiddenAt;
      for(const key of ['requestAt','startAt','flagAt'])if(Number.isFinite(this[key]))this[key]+=pause;
      this.clearAt=null;delete this.hiddenAt;
    }
    if(credited)this.completed=true;
    const closed=closeCompletedAd(w,this.completed,this.clicked);
    const proof=this.evidence(w),flag=!!w.BkGlobal?.Tg;
    const active=proof.overlay||flag||['requested','active'].includes(this.phase);
    if(active&&!this.adId)this.adId=`${now}:${++this.sequence}`;
    // The isolated relay gives only frames in this same tab a short-lived lease.
    w.postMessage?.({channel:'ziga-ad-watch',active,completed:!!this.completed,adId:this.adId,surface:active?adSurface(w):null},w.location?.origin||'*');
    if(proof.overlay){this.clearAt=null;return {blocking:true,status:closed?'Đã bấm đóng quảng cáo. Chờ trang xác nhận…':this.completed?'Quảng cáo đã kết thúc. Đang tìm nút đóng; nếu nút nằm trong khung được bảo vệ, hãy bấm đóng thủ công.':'Quảng cáo đang hiển thị. Chờ trang kết thúc…'};}
    if(proof.known){this.clearAt??=now;}else this.clearAt=null;
    const clearFor=this.clearAt===null?0:now-this.clearAt;
    const recover=()=>{
      // Repair only the stuck display flag, without granting hearts or firing SDK callbacks.
      if(w.BkGlobal)w.BkGlobal.Tg=false;
      this.phase='ended';this.flagAt=null;return {blocking:false,recovered:true,failed:this.failed};
    };
    if(this.phase==='ended')return flag&&proof.known?recover():{blocking:false,failed:this.failed};
    if(this.phase==='active'){
      if(proof.boardExposed&&clearFor>=settings.ads.exposedRecoveryMs)return recover();
      return {blocking:true,status:now-(this.startAt??now)>settings.ads.timeoutMs?'Quảng cáo chưa báo kết thúc. Hãy kiểm tra hoặc đóng quảng cáo thủ công.':'SDK đang hiển thị quảng cáo. Chờ kết thúc…'};
    }
    if(this.phase==='requested'){
      if(now-(this.requestAt??now)>=settings.ads.loadTimeoutMs&&proof.known&&clearFor>=settings.ads.clearMs){const r=recover();return {...r,failed:true};}
      return {blocking:true,status:'Đang chờ trang tải quảng cáo…'};
    }
    if(flag){
      this.flagAt??=now;
      if(proof.boardExposed&&clearFor>=settings.ads.clearMs&&now-this.flagAt>=settings.ads.clearMs)return recover();
      return {blocking:true,status:'Đang kiểm tra trạng thái quảng cáo…'};
    }
    this.flagAt=null;return {blocking:false};
  }
}
export function getAdStatus(w=window,now=Date.now(),options){
  if(!watches.has(w))watches.set(w,new AdWatch());const watch=watches.get(w);const status=watch.inspect(w,now,options);return {...status,reward:watch.reward===true,rewardPending:watch.reward===true&&!watch.completed&&['requested','active'].includes(watch.phase)};
}
