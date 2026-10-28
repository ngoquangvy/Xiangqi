// Additional wait AFTER a result arrives; never subtract engine computation time.
export function moveDelayMs(legalCount,depth,{searchMs=0,scoreGap=null,stableDepths=0,source='engine',ponderHit=false,random=Math.random}={}){
  const choices=Number.isFinite(legalCount)?Math.max(1,Math.floor(legalCount)):1;
  const searched=Number.isFinite(depth)?Math.max(0,depth):0;
  const sample=Number(random());
  const fraction=Number.isFinite(sample)?Math.max(0,Math.min(1,sample)):0.5;
  if(choices===1)return 500;
  // Keep variable engine/ponder timing, with a minimum pause once a move is ready.
  if(ponderHit||source==='engine')return Math.round(500+500*fraction);
  let low,high;
  if(choices<=4&&searchMs<=600){low=0;high=250;}
  else if(source==='book'){low=120;high=1400;}
  else if(Number.isFinite(scoreGap)&&scoreGap>=150&&stableDepths>=3){low=150;high=900;}
  else if(choices>=16&&searched>=18&&(!Number.isFinite(scoreGap)||scoreGap<70)){low=2200;high=5000;}
  else{low=350;high=Math.min(4000,900+choices*20+searched*45);}
  return Math.round(Math.max(500,Math.min(5000,low+(high-low)*fraction)));
}
