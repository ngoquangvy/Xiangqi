import test from 'node:test';
import assert from 'node:assert/strict';
import {once} from 'node:events';
import {resolve} from 'node:path';
import {analyze,createServer,validate,validateSettings} from '../native-server.mjs';
import {OpeningBook,rotateFen,parseMove} from '../book.mjs';
import XiangqiGame from '../vendor/XiangqiGame.js';
import {legalMoves} from '../src/engine.js';
const initial='rnbakabnr/9/1c5c1/p1p1p1p1p/9/9/P1P1P1P1P/1C5C1/9/RNBAKABNR w - - 0 1';
const book=new OpeningBook(resolve('../../assets/books/opening-book.json'));
test('real book: legal opening on both orientations, stops at configured limit',()=>{
  assert.equal(book.error,null);assert.ok(book.index.size>20);
  for(const reverse of [false,true]){
    const g=new XiangqiGame();
    for(let ply=0;ply<10;ply++){
      const fen=g.exportFen(),display=reverse?rotateFen(fen):fen;
      const result=book.lookup(display,{reverse,bookMoves:5,ply});
      if(!result.move)break;
      const canonical=reverse?{x:8-result.move.x,y:9-result.move.y,tx:8-result.move.tx,ty:9-result.move.ty}:result.move;
      assert.ok(g.move(canonical.x,canonical.y,canonical.tx,canonical.ty));
      assert.equal(book.lookup(display,{reverse,bookMoves:3,ply:6}).move,null);
    }
  }
  assert.equal(book.lookup(initial,{ply:10}).move,null);
  assert.equal(book.lookup(initial,{bookMoves:0}).move,null);
});
test('book normalizes clocks and rejects malformed or illegal candidate',()=>{
  assert.deepEqual(book.lookup(initial).move,book.lookup(initial.replace('0 1','8 23')).move);
  const fake=new OpeningBook('missing-book.json');assert.ok(fake.error);
  fake.index.set(initial.split(' ').slice(0,2).join(' '),{ply:0,candidates:[{move:'a0a9'},{move:'garbage'}]});
  assert.equal(fake.lookup(initial).move,null);
  assert.equal(parseMove('a0a9\nquit'),null);
  assert.equal(rotateFen(rotateFen(initial)),initial);
});
test('native validation rejects injection and invalid budgets',()=>{
  for(const fen of [initial+'\nquit','bad',initial.replace('rnb','xnb')])assert.throws(()=>validate(fen,300));
  for(const ms of [0,NaN,10001,'300'])assert.throws(()=>validate(initial,ms));
});
test('real Pikafish searches both sides and returns validated ICCS coordinates',async()=>{
  for(const side of ['w','b']){
    const fen=initial.replace(' w ',` ${side} `),r=await analyze(fen,150);
    assert.match(r.engine,/Pikafish/);assert.ok(r.depth>0);assert.ok(r.nodes>0);
    const g=new XiangqiGame();assert.ok(g.importFen(fen));
    assert.ok(g.move(r.move.x,r.move.y,r.move.tx,r.move.ty));
    assert.deepEqual(parseMove(r.uci),r.move);
  }
});
test('native missing process, timeout and abort all terminate promptly',async()=>{
  await assert.rejects(analyze(initial,100,{enginePath:'Z:\no-engine.exe'}));
  await assert.rejects(analyze(initial,5000,{timeoutMs:20}),/timed out/);
  const c=new AbortController();const pending=analyze(initial,5000,{signal:c.signal});c.abort();
  await assert.rejects(pending,/cancelled/);
});
test('depth and threads reach native engine; invalid settings rejected',async()=>{
  for(const [threads,depth]of [[0,0],[17,0],[2,-1],[2,65],['2',3],[2,1.5]])assert.throws(()=>validateSettings(threads,depth));
  const r=await analyze(initial,5000,{threads:1,depth:3});
  assert.equal(r.threads,1);assert.equal(r.depthLimit,3);assert.ok(r.depth<=3);assert.ok(r.depth>0);
});
test('HTTP bridge: book hit, native fallback, CORS denial and busy lock',async()=>{
  const server=createServer({book});server.listen(0,'127.0.0.1');await once(server,'listening');
  const url=`http://127.0.0.1:${server.address().port}`;
  const post=(body,options={})=>fetch(url+'/analyze',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),...options});
  try{
    const health=await(await fetch(url+'/health')).json();assert.ok(health.bookPositions>20);
    const hit=await(await post({fen:initial,movetime:100})).json();assert.equal(hit.source,'book');assert.ok(hit.move);
    const native=await(await post({fen:initial,movetime:100,bookMoves:0})).json();assert.equal(native.source,'engine');assert.match(native.engine,/Pikafish/);
    assert.equal((await post({fen:initial,movetime:100},{headers:{Origin:'https://evil.example','Content-Type':'application/json'}})).status,403);
    assert.equal((await post({fen:initial+'\nquit',movetime:100})).status,400);
    const controller=new AbortController();
    const first=post({fen:initial,movetime:5000,bookMoves:0},{signal:controller.signal}).catch(()=>null);
    let busy=false;for(let i=0;i<50;i++){if((await(await fetch(url+'/health')).json()).busy){busy=true;break;}await new Promise(r=>setTimeout(r,10));}
    assert.ok(busy);assert.equal((await post({fen:initial,movetime:100})).status,409);
    controller.abort();await first;
    for(let i=0;i<50;i++){if(!(await(await fetch(url+'/health')).json()).busy)break;await new Promise(r=>setTimeout(r,20));}
    assert.equal((await(await fetch(url+'/health')).json()).busy,false);
  }finally{await new Promise(r=>server.close(r));}
});
