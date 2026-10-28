import {readFileSync} from 'node:fs';
import {legalMoves} from './src/engine.js';
import XiangqiGame from './vendor/XiangqiGame.js';
const key=fen=>fen.split(/\s+/).slice(0,2).join(' ');
export function rotateFen(fen){
  const parts=fen.split(/\s+/);
  parts[0]=parts[0].split('/').reverse().map(r=>[...r].reverse().map(c=>/[a-z]/i.test(c)?(c===c.toUpperCase()?c.toLowerCase():c.toUpperCase()):c).join('')).join('/');
  parts[1]=parts[1]==='w'?'b':'w';return parts.join(' ');
}
export function parseMove(uci){
  if(typeof uci!=='string'||!/^[a-i][0-9][a-i][0-9]$/.test(uci))return null;
  return {x:uci.charCodeAt(0)-97,y:9-Number(uci[1]),tx:uci.charCodeAt(2)-97,ty:9-Number(uci[3])};
}
export class OpeningBook{
  constructor(path){
    this.index=new Map();this.error=null;
    try{
      const data=JSON.parse(readFileSync(path,'utf8').replace(/^\uFEFF/,''));
      if(!data.positions||typeof data.positions!=='object')throw Error('Missing positions');
      for(const [fen,entry]of Object.entries(data.positions)){
        const parts=fen.split(/\s+/),full=Number(parts[5]);
        if(!Number.isInteger(full)||full<1||!['w','b'].includes(parts[1]))continue;
        const ply=(full-1)*2+(parts[1]==='b'?1:0);
        // Index only the first five full moves, ignoring FEN clocks for lookup.
        if(ply>=10)continue;
        const candidates=Array.isArray(entry)?entry:Object.entries(entry).map(([move,d])=>({move,...d}));
        const k=key(fen),prior=this.index.get(k);
        if(!prior||ply<prior.ply)this.index.set(k,{ply,candidates});
      }
    }catch(e){this.error=e.message;}
  }
  lookup(fen,{reverse=false,bookMoves=5,ply=null}={}){
    const canonical=reverse?rotateFen(fen):fen,entry=this.index.get(key(canonical));
    const openingPly=entry?Math.max(ply??0,entry.ply):ply;
    if(!entry||openingPly===null||openingPly>=bookMoves*2)return {move:null,openingPly};
    const game=new XiangqiGame();if(!game.importFen(fen))return {move:null,openingPly};
    const legal=legalMoves(game,game.currentTurn);
    const sorted=[...entry.candidates].sort((a,b)=>(Number(b.count)||0)-(Number(a.count)||0)||(Number(b.score)||0)-(Number(a.score)||0));
    for(const candidate of sorted){
      let m=parseMove(candidate.move);if(!m)continue;
      if(reverse)m={x:8-m.x,y:9-m.y,tx:8-m.tx,ty:9-m.ty};
      if(legal.some(n=>n.x===m.x&&n.y===m.y&&n.tx===m.tx&&n.ty===m.ty))return {move:m,openingPly,bookUci:candidate.move};
    }
    return {move:null,openingPly};
  }
}
