import {settings} from './settings.mjs';
export class SearchProgress{
  constructor(){this.depth=0;this.nodes=0;this.searchMs=0;this.score=null;this.scoreGap=null;this.stableDepths=0;this.pv=null;this.scores=new Map();}
  update(line){
    const d=Number(/\bdepth (\d+)/.exec(line)?.[1]);
    const pvIndex=Number(/\bmultipv (\d+)/.exec(line)?.[1]||1);
    const s=/\bscore (cp|mate) (-?\d+)/.exec(line);
    this.nodes=Number(/\bnodes (\d+)/.exec(line)?.[1]||this.nodes);
    this.searchMs=Number(/\btime (\d+)/.exec(line)?.[1]||this.searchMs);
    if(!d||!s)return;
    if(!this.scores.has(d))this.scores.set(d,{});
    const scores=this.scores.get(d);scores[pvIndex]=s[1]==='cp'?Number(s[2]):null;
    const gap=Number.isFinite(scores[1])&&Number.isFinite(scores[2])?scores[1]-scores[2]:null;
    if(d>=this.depth)this.scoreGap=gap;
    if(pvIndex!==1)return;
    const pv=/\bpv ([a-i][0-9][a-i][0-9])/.exec(line)?.[1];
    if(d>this.depth){this.stableDepths=pv&&pv===this.pv&&this.score?.type===s[1]&&Math.abs(this.score.value-Number(s[2]))<=35?this.stableDepths+1:0;this.pv=pv;}
    this.depth=d;this.score={type:s[1],value:Number(s[2]),bound:/\b(lowerbound|upperbound)\b/.test(line)};
  }
  canStop(movetime){return this.depth>=8&&this.stableDepths>=3&&this.scoreGap>=120&&this.searchMs>=Math.min(settings.engine.stableSearchMaxMs,Math.max(settings.engine.stableSearchMinMs,movetime/2));}
}
