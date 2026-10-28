import test from 'node:test';
import assert from 'node:assert/strict';
import XiangqiGame from '../vendor/XiangqiGame.js';
import {bestMove,legalMoves} from '../src/engine.js';
import {readState,sendMove} from '../src/adapter.js';
const initial='rnbakabnr/9/1c5c1/p1p1p1p1p/9/9/P1P1P1P1P/1C5C1/9/RNBAKABNR w - - 0 1';
function fixture(reverse=false){
  const types=[0,1,1,2,2,3,3,4,4,5,5,6,6,6,6,6];
  const cols=[4,3,5,2,6,0,8,1,7,1,7,0,2,4,6,8];
  const rows=[0,0,0,0,0,0,0,2,2,0,0,3,3,3,3,3];
  const sent=[],player={Ka:false};
  const logic={Fb:3,Ba:()=>player,PP:(...m)=>sent.push(m),Cn:()=>1};
  const layer={V:Array.from({length:32},(_,i)=>({fa:i<16?cols[i]:8-cols[i%16],rowIndex:i<16?rows[i]:9-rows[i%16],Ga:types[i%16],ka:Math.floor(i/16),pa:false})),Nj:0,Yc:0,hc:reverse,T:()=>logic,Yt:1,nv:2};
  return {w:{K:7,GAME_STATE_PLAYING:3,BkGlobal:{ia:7,Yj:{ja:()=>layer}}},layer,logic,player,sent};
}
test('adapter exports initial display position',()=>{const f=fixture();assert.equal(readState(f.w).fen,initial);});
test('normal and reversed server coordinates',()=>{
  for(const reverse of [false,true]){const f=fixture(reverse);sendMove(readState(f.w),{x:1,y:7,tx:1,ty:4},f.w);assert.deepEqual(f.sent[0],reverse?[7,7,7,4]:[1,2,1,5]);}
});
test('stale position and opponent turn cannot send',()=>{
  const f=fixture(),state=readState(f.w);f.layer.Yc=1;
  assert.throws(()=>sendMove(state,{x:0,y:6,tx:0,ty:5},f.w));assert.equal(f.sent.length,0);
});
test('spectators, co up, finished games and malformed boards fail closed',()=>{
  for(const mutate of [f=>f.player.Ka=true,f=>f.w.BkGlobal.ia=8,f=>f.logic.Fb=0,f=>f.layer.V[0].fa=100,f=>f.layer.V[0].pa=true]){const f=fixture();mutate(f);assert.throws(()=>readState(f.w));}
});
test('search returns a legal move for each side within bounded time',()=>{
  for(const turn of ['w','b']){
    const fen=initial.replace(' w ',` ${turn} `),g=new XiangqiGame();assert.ok(g.importFen(fen));
    const before=g.exportFen(),m=bestMove(fen,90,3);
    assert.ok(m);assert.ok(legalMoves(g,g.currentTurn).some(n=>n.x===m.x&&n.y===m.y&&n.tx===m.tx&&n.ty===m.ty));
    assert.equal(g.exportFen(),before);assert.ok(m.ms<1500);
  }
});
test('own pawn and advisor are never captured by search',()=>{
  const g=new XiangqiGame();assert.ok(g.importFen('4k4/9/9/9/4p4/9/9/9/4P4/3AKA3 w - - 0 1'));
  for(const m of legalMoves(g,'red')) assert.notEqual(g.board[m.ty][m.tx]?.color,'red');
});
test('facing generals cannot be exposed',()=>{
  const g=new XiangqiGame();assert.ok(g.importFen('4k4/9/9/9/4R4/9/9/9/9/4K4 w - - 0 1'));
  assert.ok(legalMoves(g,'red').filter(m=>m.x===4&&m.y===4).every(m=>m.tx===4));
});
