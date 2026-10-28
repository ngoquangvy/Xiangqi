import {settings} from './settings.mjs';
import os from 'node:os';
export class CpuGuard{
  constructor({cores=os.availableParallelism?.()||os.cpus().length}={}){this.cores=cores;this.previous=null;this.percent=0;this.highAt=null;this.lowAt=null;this.lastReduce=-Infinity;this.lastRecover=-Infinity;this.cap=Infinity;this.requested=2;this.effective=1;this.pauseUntil=0;}
  observe(percent,now=Date.now()){
    this.percent=Math.max(0,Math.min(100,percent));
    if(this.percent>70){
      this.highAt??=now;this.lowAt=null;
      if(this.percent>=85||(now-this.highAt>=settings.cpu.highForMs&&now-this.lastReduce>=settings.cpu.reduceIntervalMs)){
        this.cap=this.percent>=85?1:Math.max(1,Math.floor(this.effective/2));
        this.lastReduce=now;this.pauseUntil=Math.max(this.pauseUntil,now+settings.cpu.ponderPauseMs);
      }
    }else{this.highAt=null;if(this.percent<50){this.lowAt??=now;if(now-this.lowAt>=settings.cpu.lowForMs&&now-this.lastRecover>=settings.cpu.recoverIntervalMs){this.cap=Number.isFinite(this.cap)?this.cap+1:Infinity;if(this.cap>=Math.min(this.requested,Math.max(1,Math.floor(this.cores*0.6))))this.cap=Infinity;this.lastRecover=now;}}else this.lowAt=null;}
  }
  sample(now=Date.now()){
    const total=os.cpus().reduce((a,c)=>{a.idle+=c.times.idle;a.total+=Object.values(c.times).reduce((s,n)=>s+n,0);return a;},{idle:0,total:0});
    if(this.previous){const delta=total.total-this.previous.total;if(delta>0)this.observe(100*(1-(total.idle-this.previous.idle)/delta),now);}
    this.previous=total;return this.status(now);
  }
  limits(threads,movetime,depth,now=Date.now()){
    this.requested=threads;this.effective=Math.max(1,Math.min(threads,Math.max(1,Math.floor(this.cores*0.6)),this.cap));
    const reduced=Number.isFinite(this.cap);
    return {threads:this.effective,movetime:reduced?Math.min(movetime,settings.cpu.limitedSearchMs):movetime,depth:reduced?(depth?Math.min(depth,16):16):depth,multiPV:reduced?1:2,ponderAllowed:now>=this.pauseUntil&&this.percent<85,...this.status(now)};
  }
  status(now=Date.now()){return {cpuPercent:Math.round(this.percent),cpuLimited:Number.isFinite(this.cap),effectiveThreads:this.effective,ponderPaused:now<this.pauseUntil,pauseMs:Math.max(0,this.pauseUntil-now)};}
}
