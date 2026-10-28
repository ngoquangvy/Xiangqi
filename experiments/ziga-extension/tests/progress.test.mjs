import test from 'node:test';
import assert from 'node:assert/strict';
import {SearchProgress} from '../search-progress.mjs';
test('MultiPV compares same-depth scores and only stable separated choices stop early',()=>{
  const p=new SearchProgress();
  for(let d=5;d<=8;d++){
    p.update(`info depth ${d} multipv 1 score cp 200 nodes 100 time 700 pv b2e2`);
    assert.equal(p.scoreGap,null);
    p.update(`info depth ${d} multipv 2 score cp 20 nodes 150 time 710 pv h2e2`);
  }
  assert.equal(p.depth,8);assert.equal(p.stableDepths,3);assert.equal(p.scoreGap,180);assert.equal(p.score.value,200);assert.equal(p.canStop(1200),true);
  p.update('info depth 9 multipv 1 score cp 220 time 800 pv h2e2');
  assert.equal(p.stableDepths,0);assert.equal(p.canStop(1200),false);
});
test('mate, missing second PV or too little search time do not trigger early stop',()=>{
  const p=new SearchProgress();p.depth=12;p.stableDepths=5;p.searchMs=100;p.scoreGap=300;assert.equal(p.canStop(1200),false);
  p.searchMs=700;p.scoreGap=null;assert.equal(p.canStop(1200),false);
  p.update('info depth 12 multipv 1 score mate 3 time 900 pv b2e2');p.update('info depth 12 multipv 2 score cp 10 time 900 pv h2e2');assert.equal(p.scoreGap,null);assert.equal(p.canStop(1200),false);
});
