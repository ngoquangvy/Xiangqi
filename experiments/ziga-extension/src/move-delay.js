import {settings} from '../settings.mjs';
// Additional wait AFTER a result arrives; never subtract engine computation time.
export function moveDelayMs(legalCount,depth,{searchMs=0,scoreGap=null,stableDepths=0,source='engine',ponderHit=false,random=Math.random}={}){
  const choices=Number.isFinite(legalCount)?Math.max(1,Math.floor(legalCount)):1;
  const searched=Number.isFinite(depth)?Math.max(0,depth):0;
  const sample=Number(random());
  const fraction=Number.isFinite(sample)?Math.max(0,Math.min(1,sample)):0.5;
  const {minDelayMs,quickMaxMs,bookMinMs,bookMaxMs,maxDelayMs}=settings.move;
  if(choices===1)return minDelayMs;
  // Keep variable engine/ponder timing, with a minimum pause once a move is ready.
  if(ponderHit||source==='engine')return Math.round(minDelayMs+(quickMaxMs-minDelayMs)*fraction);
  const fallback=settings.fallbackDelay;
  let low,high;
  if(choices<=4&&searchMs<=fallback.quickSearchThresholdMs){low=0;high=fallback.quickMaxMs;}
  else if(source==='book'){low=bookMinMs;high=bookMaxMs;}
  else if(Number.isFinite(scoreGap)&&scoreGap>=150&&stableDepths>=3){low=fallback.advantageMinMs;high=fallback.advantageMaxMs;}
  else if(choices>=16&&searched>=18&&(!Number.isFinite(scoreGap)||scoreGap<70)){low=fallback.complexMinMs;high=maxDelayMs;}
  else{low=fallback.baseMinMs;high=Math.min(fallback.maxMs,fallback.baseMs+choices*fallback.perChoiceMs+searched*fallback.perDepthMs);}
  return Math.round(Math.max(minDelayMs,Math.min(maxDelayMs,low+(high-low)*fraction)));
}
