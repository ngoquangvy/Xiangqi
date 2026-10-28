import test from 'node:test';
import assert from 'node:assert/strict';
import {AdWatch} from '../src/ad-state.js';
import {AutoSession,sessionSnapshot} from '../src/session.js';
function fixture(){
  let options=null,clock=0,overlay=false;const callbacks=[];
  const canvas={getBoundingClientRect:()=>({left:0,top:0,width:1000,height:700}),contains:()=>false};
  const frame={id:'google_vignette_ad',src:'https://googleads.example/ad',getBoundingClientRect:()=>({left:0,top:0,right:1000,bottom:700,width:1000,height:700})};
  const w={BkGlobal:{Tg:true},innerWidth:1000,innerHeight:700,adBreak:o=>{options=o;return 'sdk-return';},getComputedStyle:()=>({display:'block',visibility:'visible',opacity:'1'}),document:{querySelectorAll:()=>overlay?[frame]:[],querySelector:()=>canvas,elementFromPoint:()=>overlay?frame:canvas}};
  const watch=new AdWatch(()=>clock);
  return {w,watch,callbacks,setTime:t=>clock=t,setOverlay:b=>overlay=b,options:()=>options};
}
test('stale Tg without an ad does not block forever; clears display flag only',()=>{
  const f=fixture();assert.equal(f.watch.inspect(f.w,0).blocking,true);
  assert.equal(f.watch.inspect(f.w,2999).blocking,true);
  assert.equal(f.watch.inspect(f.w,3000).blocking,false);assert.equal(f.w.BkGlobal.Tg,false);assert.deepEqual(f.callbacks,[]);
});
test('visible full-screen ad blocks even when flag is false, never clears reward state',()=>{
  const f=fixture();f.setOverlay(true);f.w.BkGlobal.Tg=false;
  assert.equal(f.watch.inspect(f.w,0).blocking,true);assert.equal(f.watch.inspect(f.w,300000).blocking,true);
});
test('SDK callbacks are forwarded once; ended callback unblocks stuck flag without faking adViewed',()=>{
  const f=fixture();f.watch.inspect(f.w,0);
  assert.equal(f.w.adBreak({beforeAd:()=>f.callbacks.push('before'),afterAd:()=>f.callbacks.push('after'),adViewed:()=>f.callbacks.push('reward')}),'sdk-return');
  f.options().beforeAd();assert.equal(f.watch.inspect(f.w,1000).blocking,true);
  f.options().afterAd();assert.equal(f.watch.inspect(f.w,2000).blocking,false);
  assert.deepEqual(f.callbacks,['before','after']);assert.equal(f.w.BkGlobal.Tg,false);
});
test('active SDK flag with exposed canvas can recover after 10 seconds; actual overlay still blocks',()=>{
  const f=fixture();f.watch.inspect(f.w,0);f.w.adBreak({});f.options().beforeAd();
  assert.equal(f.watch.inspect(f.w,0).blocking,true);assert.equal(f.watch.inspect(f.w,9999).blocking,true);
  assert.equal(f.watch.inspect(f.w,10000).blocking,false);
  const g=fixture();g.watch.inspect(g.w,0);g.w.adBreak({});g.options().beforeAd();g.setOverlay(true);assert.equal(g.watch.inspect(g.w,200000).blocking,true);
});
test('unloaded request fails after ten seconds, never invokes reward callback',()=>{
  const f=fixture();f.watch.inspect(f.w,0);f.w.adBreak({adViewed:()=>f.callbacks.push('reward')});
  f.watch.inspect(f.w,0);assert.equal(f.watch.inspect(f.w,10000).failed,true);assert.deepEqual(f.callbacks,[]);
});
test('SDK reports no inventory: release blocker and report failure without granting rewards',()=>{
  const f=fixture();f.watch.inspect(f.w,0);f.w.adBreak({adBreakDone:()=>f.callbacks.push('done'),adViewed:()=>f.callbacks.push('reward')});
  f.options().adBreakDone({breakStatus:'noAdPreloaded'});
  const r=f.watch.inspect(f.w,1000);assert.equal(r.blocking,false);assert.equal(r.failed,true);assert.deepEqual(f.callbacks,['done']);
});
test('hidden tab is not evidence that an ad disappeared',()=>{
  const f=fixture();f.w.document.visibilityState='hidden';assert.equal(f.watch.inspect(f.w,0).blocking,true);assert.equal(f.watch.inspect(f.w,100000).blocking,true);assert.equal(f.w.BkGlobal.Tg,true);
  f.w.document.visibilityState='visible';f.watch.inspect(f.w,100001);assert.equal(f.watch.inspect(f.w,103001).blocking,false);
});
test('reported playing state 2/role 1 resumes after stale Tg, rather than pressing Ready again',()=>{
  const f=fixture(),w=f.w;w.K=7;w.sj=10;w.V=11;w.Q=12;w.GAME_STATE_PLAYING=2;w.GAME_STATE_FINISH=100;
  const player={Ka:false,status:1},logic={Fb:2,Ba:()=>player,ha:[player,{Ka:false,status:1}]};
  Object.assign(w.BkGlobal,{ia:7,Ja:11,af:0,vi:1,P:{pb:()=>5},Yj:{ja:()=>({T:()=>logic})}});w.BkLogicManager={T:()=>({})};
  const s=new AutoSession();assert.equal(s.step(sessionSnapshot(w),{},0).play,false);
  assert.equal(s.step(sessionSnapshot(w),{},3000).play,true);assert.equal(w.BkGlobal.Tg,false);
});
