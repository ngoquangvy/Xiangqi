import test from 'node:test';
import assert from 'node:assert/strict';
import {moveDelayMs} from '../src/move-delay.js';
test('forced moves wait 500ms; quick choices wait 500–1000ms',()=>{
  assert.equal(moveDelayMs(1,64),500);
  assert.equal(moveDelayMs(3,64,{searchMs:100,random:()=>0}),500);
  assert.equal(moveDelayMs(3,64,{searchMs:100,random:()=>1}),1000);
});
test('completed search and ponder retain minimum delay; book also never sends immediately',()=>{
  assert.equal(moveDelayMs(30,25,{scoreGap:20,random:()=>1}),1000);
  assert.equal(moveDelayMs(30,25,{ponderHit:true,random:()=>0}),500);
  for(const n of [1,3,40,100])for(const d of [0,10,30,64,1000])for(const r of [-2,0,0.5,1,2,NaN]){
    const ms=moveDelayMs(n,d,{random:()=>r});assert.ok(ms>=500&&ms<=1000);
  }
  assert.equal(moveDelayMs(30,25,{scoreGap:200,stableDepths:4,random:()=>1}),1000);
  assert.equal(moveDelayMs(40,0,{source:'book',random:()=>0}),500);
  assert.equal(moveDelayMs(40,0,{source:'book',random:()=>1}),1400);
});
