const ziga=url=>/^https:\/\/(www\.)?zigavn\.com\//.test(url||'');
const adFrame=url=>{try{return /(^|\.)(googlesyndication\.com|doubleclick\.net|googleadservices\.com)$/.test(new URL(url).hostname);}catch{return false;}};
export class AdFrameGate{
  constructor(leaseMs,{probeAfterMs=15000,probeRetryMs=10000,probeMax=8}={}){Object.assign(this,{leaseMs,probeAfterMs,probeRetryMs,probeMax});this.tabs=new Map();this.logs=new Map();this.surfaces=new Map();this.revision=0;}
  surface(tab,frame,raw){
    if(!raw)return;
    const data={frame,...cleanSurface(raw)},all=this.surfaces.get(tab)||{};
    if(JSON.stringify(all[frame])===JSON.stringify(data))return;
    if(!all[frame]&&Object.keys(all).length>=40)return;
    all[frame]=data;this.surfaces.set(tab,all);this.revision++;
  }
  record(tab,event){
    const log=this.logs.get(tab)||[];
    if(JSON.stringify(log.at(-1))===JSON.stringify(event))return;
    log.push(event);if(log.length>20)log.shift();this.logs.set(tab,log);this.revision++;
  }
  diagnostic(tab){return this.logs.has(tab)?{events:this.logs.get(tab),surfaces:Object.values(this.surfaces.get(tab)||{})}:null;}
  message(msg,sender,now=Date.now()){
    const tab=sender.tab?.id;if(!Number.isInteger(tab))return {allowed:false};
    if(msg.kind==='ad-watch'){
      if(sender.frameId!==0||!ziga(sender.url))return {allowed:false};
      if(!msg.active){if(this.tabs.has(tab))this.record(tab,{stage:'Đã kết thúc theo dõi quảng cáo'});this.tabs.delete(tab);return {allowed:false};}
      if(typeof msg.adId!=='string'||msg.adId.length>100)return {allowed:false};
      const previous=this.tabs.get(tab);
      if(!previous||previous.adId!==msg.adId){this.record(tab,{stage:'Bắt đầu theo dõi quảng cáo'});this.surfaces.delete(tab);}
      this.surface(tab,0,msg.surface);
      const same=previous?.adId===msg.adId;
      this.tabs.set(tab,{adId:msg.adId,expires:now+this.leaseMs,completed:msg.completed===true||(same&&previous.completed===true),frames:same?previous.frames:new Map(),startedAt:same?previous.startedAt:now,lastProbe:same?previous.lastProbe:-Infinity,probeAttempts:same?previous.probeAttempts:0});
      return {allowed:true};
    }
    if(!['ad-frame-poll','ad-frame-report','ad-close-probe'].includes(msg.kind)||sender.frameId===0||!(adFrame(sender.url)||adFrame(sender.origin)))return {allowed:false};
    const state=this.tabs.get(tab);
    if(!state||now>state.expires){this.tabs.delete(tab);return {allowed:false};}
    if(msg.kind==='ad-close-probe'){
      if(msg.adId!==state.adId||msg.hasGuard!==true||now-state.startedAt<this.probeAfterMs||now-state.lastProbe<this.probeRetryMs||state.probeAttempts>=this.probeMax)return {allowed:false};
      state.lastProbe=now;state.probeAttempts++;
      this.record(tab,{stage:'Thử nút Đóng qua hộp bảo vệ phần thưởng',frame:sender.frameId});
      return {allowed:true};
    }
    if(msg.adId===state.adId&&msg.videoEnded===true)state.completed=true;
    if(msg.kind==='ad-frame-report'){
      if(msg.adId!==state.adId)return {allowed:false};
      this.surface(tab,sender.frameId,msg.surface);
      const previous=state.frames.get(sender.frameId);
      const report={stage:'Khung quảng cáo',frame:sender.frameId,completed:state.completed===true,candidates:Number.isInteger(msg.candidates)?Math.max(0,Math.min(100,msg.candidates)):0,clicked:msg.clicked===true||previous?.clicked===true,continued:msg.continued===true||previous?.continued===true};
      if(JSON.stringify(previous)!==JSON.stringify(report)){state.frames.set(sender.frameId,report);this.record(tab,report);}
    }else if(msg.adId!==state.adId)this.record(tab,{stage:'Đã nhận tín hiệu từ iframe',frame:sender.frameId,completed:state.completed===true});
    return {allowed:true,adId:state.adId,completed:state.completed};
  }
}
import {cleanSurface} from './ad-diagnostic.js';
