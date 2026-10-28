import test from 'node:test';
import assert from 'node:assert/strict';
import {CpuGuard} from '../cpu-guard.mjs';
import {PersistentEngine} from '../persistent-engine.mjs';
import {defaultEngine} from '../native-server.mjs';
import XiangqiGame from '../vendor/XiangqiGame.js';
import {legalMoves} from '../src/engine.js';
import {parseMove} from '../book.mjs';
const initial='rnbakabnr/9/1c5c1/p1p1p1p1p/9/9/P1P1P1P1P/1C5C1/9/RNBAKABNR w - - 0 1';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
function next(fen,uci){const g=new XiangqiGame();assert.ok(g.importFen(fen));const m=parseMove(uci);assert.ok(g.move(m.x,m.y,m.tx,m.ty));return g.exportFen();}
function engine(options={}){const guard=new CpuGuard({cores:16});guard.sample=()=>guard.status();return new PersistentEngine(defaultEngine,{guard,...options});}
async function waitDepth(e){for(let i=0;i<150;i++){if((e.task?.progress.depth||e.cache?.result.depth||0)>=12)return;await sleep(10);}throw Error('Ponder did not reach test depth');}
test('CPU >70% for 10 seconds halves threads, pauses ponder; a brief spike does not',()=>{
  const g=new CpuGuard({cores:16});assert.equal(g.limits(8,10000,0,0).threads,8);
  g.observe(75,0);g.observe(75,9999);assert.equal(g.cap,Infinity);
  g.observe(75,10000);let l=g.limits(8,10000,0,10000);assert.equal(l.threads,4);assert.equal(l.movetime,2000);assert.equal(l.multiPV,1);assert.equal(l.ponderAllowed,false);
  g.observe(40,12000);g.observe(40,26999);assert.equal(g.cap,4);g.observe(40,27000);assert.equal(g.cap,5);
  assert.ok(g.limits(2,10000,0,27000).threads<=2);
  const h=new CpuGuard({cores:16});h.limits(8,10000,0,0);h.observe(75,0);h.observe(50,5000);h.observe(75,10000);assert.equal(h.cap,Infinity);
});
test('CPU >=85% immediately selects one thread and pauses background work',()=>{
  const g=new CpuGuard({cores:8});g.observe(90,0);const l=g.limits(8,10000,64,0);assert.equal(l.threads,1);assert.equal(l.depth,16);assert.equal(l.ponderAllowed,false);
  assert.equal(g.limits(1,10000,0,0).movetime,2000);
  g.requested=8;
  g.observe(40,1000);g.observe(40,16000);assert.equal(g.cap,2);
});
test('same process survives searches; predicted opponent move produces a legal ponder hit',async()=>{
  const e=engine();try{
    const r=await e.analyze(initial,{threads:1,movetime:300,depth:14});const pid=r.pid;
    const opponent=next(initial,r.uci);const p=await e.ponder(opponent,{threads:1,movetime:1000});
    assert.equal(p.pondering,true);await waitDepth(e);
    const current=next(opponent,p.predictedMove),started=Date.now();const hit=await e.analyze(current,{threads:1,movetime:1000});
    assert.equal(hit.pid,pid);assert.equal(hit.ponderHit,true);assert.ok(Date.now()-started<1000);next(current,hit.uci);
  }finally{e.close();}
});
test('different opponent move stops old ponder and searches new position with same PID',async()=>{
  const e=engine();try{
    const r=await e.analyze(initial,{threads:1,movetime:150,depth:10});const opponent=next(initial,r.uci);
    const p=await e.ponder(opponent,{threads:1,movetime:500});await waitDepth(e);
    const g=new XiangqiGame();g.importFen(opponent);
    const alt=legalMoves(g,g.currentTurn).map(m=>String.fromCharCode(97+m.x)+(9-m.y)+String.fromCharCode(97+m.tx)+(9-m.ty)).find(m=>m!==p.predictedMove);
    const current=next(opponent,alt);const fresh=await e.analyze(current,{threads:1,movetime:150,depth:8});assert.equal(fresh.ponderHit,false);assert.equal(fresh.pid,r.pid);next(current,fresh.uci);
  }finally{e.close();}
});
test('ponder bursts finish and rest; stop clears cached state; game change never reuses cache',async()=>{
  const e=engine({ponderBurstMs:200,ponderRestMs:3000});try{
    const r=await e.analyze(initial,{threads:1,movetime:100,depth:10});const opponent=next(initial,r.uci);
    const p=await e.ponder(opponent,{threads:1,movetime:1000});await sleep(350);
    assert.equal(e.task,null);assert.ok(e.cache);const resting=await e.ponder(opponent,{threads:1,movetime:1000});assert.equal(resting.pondering,false);
    const current=next(opponent,p.predictedMove);const fresh=await e.analyze(current,{gameId:'new-game',threads:1,movetime:100,depth:6});assert.equal(fresh.ponderHit,false);
    await e.ponder(next(current,fresh.uci),{gameId:'new-game',threads:1,movetime:1000});e.stop('legacy','new-game');await e.stopTask(true);assert.equal(e.cache,null);assert.equal(e.task,null);
  }finally{e.close();}
});
