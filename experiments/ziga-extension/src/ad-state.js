// Observe genuine SDK callbacks; never invoke adViewed/reward callbacks ourselves.
const watches=new WeakMap();
export class AdWatch{
  constructor(now=()=>Date.now()){this.phase='unknown';this.requestAt=null;this.startAt=null;this.flagAt=null;this.clearAt=null;this.wrapper=null;this.now=now;this.failed=false;}
  install(w){
    const original=w.adBreak;if(typeof original!=='function'||original===this.wrapper)return;
    const watch=this;
    const wrapper=function(options,...rest){
      if(!options||typeof options!=='object')return original.call(this,options,...rest);
      watch.phase='requested';watch.requestAt=watch.now();watch.startAt=null;watch.clearAt=null;watch.failed=false;
      const forwarded={...options};
      for(const name of ['beforeAd','afterAd','adBreakDone']){
        const callback=options[name];
        forwarded[name]=function(...args){
          if(name==='beforeAd'){watch.phase='active';watch.startAt=watch.now();watch.clearAt=null;}
          else{watch.phase='ended';if(name==='adBreakDone')watch.failed=['timeout','invalid','noAdPreloaded','frequencyCapped','error','dismissed','ignored','notReady'].includes(args[0]?.breakStatus);}
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
  inspect(w,now=Date.now()){
    this.install(w);
    const proof=this.evidence(w),flag=!!w.BkGlobal?.Tg;
    if(proof.overlay){this.clearAt=null;return {blocking:true,status:'Quảng cáo đang hiển thị. Chờ trang kết thúc…'};}
    if(proof.known){this.clearAt??=now;}else this.clearAt=null;
    const clearFor=this.clearAt===null?0:now-this.clearAt;
    const recover=()=>{
      // Repair only the stuck display flag, without granting hearts or firing SDK callbacks.
      if(w.BkGlobal)w.BkGlobal.Tg=false;
      this.phase='ended';this.flagAt=null;return {blocking:false,recovered:true,failed:this.failed};
    };
    if(this.phase==='ended')return flag&&proof.known?recover():{blocking:false,failed:this.failed};
    if(this.phase==='active'){
      if(proof.boardExposed&&clearFor>=10000)return recover();
      return {blocking:true,status:now-(this.startAt??now)>120000?'Quảng cáo chưa báo kết thúc. Hãy kiểm tra hoặc đóng quảng cáo thủ công.':'SDK đang hiển thị quảng cáo. Chờ kết thúc…'};
    }
    if(this.phase==='requested'){
      if(now-(this.requestAt??now)>=10000&&proof.known&&clearFor>=3000){const r=recover();return {...r,failed:true};}
      return {blocking:true,status:'Đang chờ trang tải quảng cáo…'};
    }
    if(flag){
      this.flagAt??=now;
      if(proof.boardExposed&&clearFor>=3000&&now-this.flagAt>=3000)return recover();
      return {blocking:true,status:'Đang kiểm tra trạng thái quảng cáo…'};
    }
    this.flagAt=null;return {blocking:false};
  }
}
export function getAdStatus(w=window,now=Date.now()){
  if(!watches.has(w))watches.set(w,new AdWatch());return watches.get(w).inspect(w,now);
}
