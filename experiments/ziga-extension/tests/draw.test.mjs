import test from 'node:test';
import assert from 'node:assert/strict';
import {drawDecision,drawPopup,respondDraw,DrawPolicy} from '../src/draw.js';
import {readState} from '../src/adapter.js';
const result=(value=0,depth=18,type='cp')=>({source:'engine',depth,score:{type,value,bound:false}});
function fixture(){
  const calls=[],p={Ka:false};
  const types=[0,1,1,2,2,3,3,4,4,5,5,6,6,6,6,6],cols=[4,3,5,2,6,0,8,1,7,1,7,0,2,4,6,8],rows=[0,0,0,0,0,0,0,2,2,0,0,3,3,3,3,3];
  const logic={Fb:2,Ba:()=>p,PP:()=>{},Cn:()=>1,yr:v=>calls.push(v)};
  const layer={V:Array.from({length:32},(_,i)=>({Ga:types[i%16],ka:Math.floor(i/16),fa:i<16?cols[i]:8-cols[i%16],rowIndex:i<16?rows[i]:9-rows[i%16],pa:false})),Nj:0,Yc:0,hc:false,T:()=>logic};
  const w={K:7,GAME_STATE_PLAYING:2,CHESS_DRAW_REQUEST:10,BkGlobal:{ia:7,Yj:{ja:()=>layer}}};
  const popup={la:{getString:()=> 'Đối phương muốn hòa.\n Bạn có đồng ý không?'},Vl:()=>calls.push('accept'),Bp:()=>calls.push('refuse'),hf(fn){this.Bp=fn;},removeSelf(){w.Fl=null;this.Bp?.();}};
  w.Fl=popup;
  return {w,layer,popup,calls,state:()=>readState(w)};
}
test('draw decisions translate score to our side on either turn and refuse winning mate',()=>{
  assert.equal(drawDecision({myTurn:true},result(0)),'accept');
  assert.equal(drawDecision({myTurn:true},result(-200)),'accept');
  assert.equal(drawDecision({myTurn:true},result(120)),'refuse');
  assert.equal(drawDecision({myTurn:false},result(120)),'accept');
  assert.equal(drawDecision({myTurn:false},result(-120)),'refuse');
  assert.equal(drawDecision({myTurn:true},result(3,18,'mate')),'refuse');
  assert.equal(drawDecision({myTurn:false},result(3,18,'mate')),'accept');
});
test('no automatic acceptance on shallow, missing, bound or book evaluation',()=>{
  for(const r of [null,result(0,3),{...result(),source:'book'},{...result(),score:{type:'cp',value:0,bound:true}},result(NaN)])assert.equal(drawDecision({myTurn:true},r),'manual');
});
test('accept follows Agree callback without accidentally invoking Refuse on close',()=>{
  const f=fixture();assert.equal(drawPopup(f.w),f.popup);respondDraw(f.state(),f.popup,'accept',f.w);assert.deepEqual(f.calls,['accept']);
});
test('refuse invokes original close callback exactly once; unknown dialogs never matched',()=>{
  const f=fixture();respondDraw(f.state(),f.popup,'refuse',f.w);assert.deepEqual(f.calls,['refuse']);
  const g=fixture();g.popup.la.getString=()=> 'Bạn chắc chắn muốn chịu thua?';assert.equal(drawPopup(g.w),null);
});
test('stale board, changed dialog, other game cannot answer draw',()=>{
  for(const mutate of [f=>f.layer.Yc=1,f=>f.w.Fl=null,f=>f.w.BkGlobal.ia=8]){
    const f=fixture(),state=f.state();mutate(f);assert.throws(()=>respondDraw(state,f.popup,'accept',f.w));assert.equal(f.calls.length,0);
  }
});
test('proactive offer needs long balanced play, fresh engine, cooldown and no opening/book offers',()=>{
  const f=fixture(),policy=new DrawPolicy();f.w.Fl=null;
  const base=f.state();policy.observe(base);assert.equal(policy.canOffer(base,result(),1000),false);
  for(let i=1;i<=44;i++){const state={...base,key:'position:'+i};policy.record(state,result());}
  const state={...base,key:'position:44'};assert.equal(policy.canOffer(state,result(),1000),true);
  assert.equal(policy.canOffer(state,{...result(),source:'book'},1000),false);
  assert.equal(policy.canOffer(state,result(200),1000),false);
  policy.offers=1;policy.lastOfferAt=0;policy.lastOfferPly=40;
  assert.equal(policy.canOffer(state,result(),1000),false);
  for(let i=45;i<=52;i++)policy.record({...base,key:'position:'+i},result());
  assert.equal(policy.canOffer({...base,key:'position:52'},result(),61000),true);
  policy.offers=2;assert.equal(policy.canOffer({...base,key:'position:52'},result(),61000),false);
});
test('proactive draw sends only the draw request, once, and revalidates current game',()=>{
  const f=fixture(),policy=new DrawPolicy();f.w.Fl=null;const state=f.state();policy.observe(state);
  policy.plies=44;policy.quiet=44;policy.streak=4;
  assert.equal(policy.offer(state,result(),f.w,1000),true);assert.deepEqual(f.calls,[10]);
  assert.equal(policy.offer(state,result(),f.w,1100),false);assert.equal(f.calls.length,1);
  f.w.BkGlobal.ia=8;assert.throws(()=>policy.offer(state,result(),f.w,100000));assert.equal(f.calls.length,1);
});

test('at most two requests per game, each on a separate own turn; repeated ticks and later turns cannot spam',()=>{
  const f=fixture(),p=new DrawPolicy();f.w.Fl=null;
  const prime=()=>{const s=f.state();p.record(s,result());p.plies=44;p.quiet=44;p.streak=4;return s;};
  let state=prime();assert.equal(p.offer(state,result(),f.w,1000),true);
  assert.equal(p.offer(state,result(),f.w,100000),false);
  f.layer.Yc=1;p.observe(f.state());assert.equal(p.canOffer(f.state(),result(),100000),false);
  f.layer.V[11].rowIndex=4;f.layer.Yc=0;state=prime();assert.equal(p.offer(state,result(),f.w,100000),true);
  f.layer.Yc=1;p.observe(f.state());f.layer.V[12].rowIndex=4;f.layer.Yc=0;state=prime();
  assert.equal(p.offer(state,result(),f.w,1000000),false);assert.deepEqual(f.calls,[10,10]);
});

test('an attempted draw dispatch that throws is still counted to prevent retries',()=>{
  const f=fixture(),p=new DrawPolicy();f.w.Fl=null;const state=f.state();p.observe(state);p.plies=44;p.quiet=44;p.streak=4;
  state.logic.yr=()=>{throw Error('dispatch failed after send');};
  assert.throws(()=>p.offer(state,result(),f.w,1000),/dispatch/);
  assert.equal(p.offers,1);assert.equal(p.offer(state,result(),f.w,100000),false);
});
