import XiangqiGame from '../vendor/XiangqiGame.js';
import { pieceToFenChar } from '../vendor/XiangqiNotation.js';
const values = {k:100000,r:900,c:450,n:400,b:200,a:200,p:100};
const other = side => side === 'red' ? 'black' : 'red';
const value = p => p ? values[pieceToFenChar(p).toLowerCase()] || 0 : 0;
export function legalMoves(game, side) {
  const result=[];
  for(let y=0;y<10;y++) for(let x=0;x<9;x++) {
    const p=game.board[y][x];
    if(p?.color!==side) continue;
    for(const [tx,ty] of game.getLegalMoves(x,y)) {
      if(game.board[ty][tx]?.color===side) continue;
      result.push({x,y,tx,ty,order:value(game.board[ty][tx])*10-value(p)});
    }
  }
  return result.sort((a,b)=>b.order-a.order);
}
function evaluate(game, side) {
  let score=0;
  for(let y=0;y<10;y++) for(let x=0;x<9;x++) {
    const p=game.board[y][x]; if(!p) continue;
    let n=value(p), t=pieceToFenChar(p).toLowerCase();
    if(t==='p') n+=(p.color==='red'?9-y:y)*9;
    if(t==='n'||t==='c') n+= (4-Math.abs(x-4))*5;
    score+=p.color===side?n:-n;
  }
  return score;
}
export function bestMove(fen, budgetMs=650, maxDepth=4) {
  const game=new XiangqiGame();
  if(!game.importFen(fen)) throw new Error('FEN không hợp lệ');
  const root=game.currentTurn, start=performance.now(), deadline=start+budgetMs;
  let nodes=0, depthDone=0;
  const timeout={};
  function search(side,depth,alpha,beta,ply) {
    if(performance.now()>deadline) throw timeout;
    nodes++;
    if(!game.findKing(side)) return -100000+ply;
    if(!game.findKing(other(side))) return 100000-ply;
    if(!depth) return evaluate(game,side);
    const moves=legalMoves(game,side);
    if(!moves.length) return -100000+ply;
    for(const m of moves) {
      const p=game.board[m.y][m.x], captured=game.board[m.ty][m.tx];
      game.board[m.y][m.x]=null; game.board[m.ty][m.tx]=p;
      let score;
      try {score=-search(other(side),depth-1,-beta,-alpha,ply+1);}
      finally {game.board[m.y][m.x]=p;game.board[m.ty][m.tx]=captured;}
      if(score>alpha) alpha=score;
      if(alpha>=beta) break;
    }
    return alpha;
  }
  const moves=legalMoves(game,root);
  if(!moves.length) return null;
  let best=moves[0], finalScore=0;
  for(let depth=1;depth<=maxDepth;depth++) {
    let candidate=best, alpha=-Infinity;
    const ordered=[best,...moves.filter(m=>m!==best)];
    try {
      for(const m of ordered) {
        const p=game.board[m.y][m.x], captured=game.board[m.ty][m.tx];
        game.board[m.y][m.x]=null;game.board[m.ty][m.tx]=p;
        let score;
        try { score=-search(other(root),depth-1,-Infinity,-alpha,1); }
        finally {game.board[m.y][m.x]=p;game.board[m.ty][m.tx]=captured;}
        if(score>alpha){alpha=score;candidate=m;}
      }
      best=candidate;finalScore=alpha;depthDone=depth;
    } catch(e) {if(e!==timeout) throw e;break;}
  }
  return {...best,depth:depthDone,score:finalScore,nodes,ms:Math.round(performance.now()-start)};
}
