import test from 'node:test';
import assert from 'node:assert/strict';
import {AutoSession,sessionSnapshot} from '../src/session.js';
function fixture(){
  const calls=[];
  const w={K:7,L:8,sj:2,V:3,Q:1,GAME_STATE_PLAYING:2,GAME_STATE_FINISH:100,GAME_STATE_READY:1,GAME_STATE_NOT_READY:0,PLAYER_STATE_TABLE_OWNER:0,PLAYER_STATE_READY:1,PLAYER_STATE_NOT_READY:2,document:{visibilityState:'visible'}};
  let hearts=5;
  const player={Ka:false,status:2};
  const logic={Ke:1,Fb:1,Ba:()=>player,ha:[player,{Ka:false,status:1}],TC:v=>calls.push(['sit',v]),wz:()=>1,uo:v=>calls.push(['leave',v]),fG:()=>calls.push(['start'])};
  const layer={T:()=>logic,onReady:()=>calls.push(['ready'])};
  const common={gz:id=>calls.push(['lobby',id]),FJ:id=>calls.push(['join',id]),ic:{aN:[{wg:1,aj:2,tk:1,Rb:0,Wj:0,Yb:1}]}};
  w.BkGlobal={ia:7,Ja:2,af:0,vi:1,P:{pb:()=>hearts},Yj:{ja:()=>layer}};
  w.BkLogicManager={T:()=>common};w.WebAdsManager={showRewardAdsOnWeb:()=>calls.push(['ad'])};
  return {w,logic,player,common,calls,hearts:n=>hearts=n,snapshot:()=>sessionSnapshot(w)};
}
test('hard guard: co up and every other game cannot trigger actions',()=>{
  for(const id of [8,1,-1,undefined]){const f=fixture();f.w.BkGlobal.ia=id;assert.throws(()=>f.snapshot(),/Cờ tướng/);assert.equal(f.calls.length,0);}
  const f=fixture(),s=f.snapshot();f.w.BkGlobal.ia=8;assert.throws(()=>new AutoSession().step(s),/Cờ tướng/);assert.equal(f.calls.length,0);
});
test('join only affordable two-seat chess tables without password or active game',()=>{
  const f=fixture(),session=new AutoSession();
  const t=f.common.ic.aN[0];f.common.ic.aN=[{...t,wg:2,Wj:1},{...t,wg:3,Rb:1},{...t,wg:4,Yb:10},{...t,wg:5,aj:4},t];
  session.step(f.snapshot(),{},0);assert.deepEqual(f.calls,[['join',1]]);
  session.step(f.snapshot(),{},3000);assert.equal(f.calls.length,1);
  assert.throws(()=>session.step(f.snapshot(),{},21001),/xác nhận/);
});
test('sit, ready, start are separate acknowledged actions; never leaves active game',()=>{
  const f=fixture(),s=new AutoSession();f.w.BkGlobal.Ja=3;f.player.Ka=true;
  s.step(f.snapshot(),{},0);assert.deepEqual(f.calls.pop(),['sit',false]);
  f.player.Ka=false;s.step(f.snapshot(),{},3000);assert.equal(f.calls.length,0);
  s.step(f.snapshot(),{},4500);assert.deepEqual(f.calls.pop(),['ready']);
  f.player.status=0;s.step(f.snapshot(),{},9000);assert.equal(f.calls.length,0);
  s.step(f.snapshot(),{},10500);assert.deepEqual(f.calls.pop(),['start']);
  f.logic.Fb=2;assert.equal(s.step(f.snapshot(),{},12000).play,true);assert.equal(f.calls.length,0);
});
test('finished game waits, leaves once; lobby opens next chess table',()=>{
  const f=fixture(),s=new AutoSession();f.w.BkGlobal.Ja=3;f.logic.Fb=100;
  s.step(f.snapshot(),{},0);assert.equal(f.calls.length,0);
  s.step(f.snapshot(),{},4000);s.step(f.snapshot(),{},7000);assert.deepEqual(f.calls,[['leave',0]]);
  f.w.BkGlobal.Ja=2;s.step(f.snapshot(),{},10000);assert.deepEqual(f.calls.at(-1),['join',1]);
});
test('reward: real entrypoint only, one request, wait for balance credit, max ads',()=>{
  const f=fixture(),s=new AutoSession();f.hearts(0);
  assert.throws(()=>s.step(f.snapshot(),{},0),/Hết tim/);
  s.step(f.snapshot(),{autoAds:true,maxAds:1},0);assert.deepEqual(f.calls,[['ad']]);
  s.step(f.snapshot(),{autoAds:true,maxAds:1},5000);assert.equal(f.calls.length,1);
  f.hearts(1);s.step(f.snapshot(),{autoAds:true,maxAds:1},6000);
  f.hearts(0);assert.throws(()=>s.step(f.snapshot(),{autoAds:true,maxAds:1},10000),/giới hạn quảng cáo/);
});
test('unconfirmed ad or stuck ad times out; active game never opens reward',()=>{
  for(const adShowing of [false,true]){
    const f=fixture(),s=new AutoSession();f.hearts(0);s.step(f.snapshot(),{autoAds:true},0);f.w.BkGlobal.Tg=adShowing;
    assert.throws(()=>s.step(f.snapshot(),{autoAds:true},120001),/quá thời gian/);
  }
  const f=fixture();f.hearts(0);f.w.BkGlobal.Ja=3;f.logic.Fb=2;
  assert.equal(new AutoSession().step(f.snapshot(),{autoAds:true},0).play,true);assert.equal(f.calls.length,0);
});
test('unknown popup, hidden ad tab, over-budget table fail safely',()=>{
  const f=fixture();f.w.BkStackWindow={Vj:()=>({})};assert.throws(()=>new AutoSession().step(f.snapshot()),/popup/);
  delete f.w.BkStackWindow;f.hearts(0);f.w.document.visibilityState='hidden';new AutoSession().step(f.snapshot(),{autoAds:true},0);assert.equal(f.calls.length,0);
  f.hearts(5);f.w.BkGlobal.Ja=3;f.logic.Ke=2;assert.throws(()=>new AutoSession().step(f.snapshot(),{maxHearts:1}),/giới hạn/);
});
test('menu always requests K and unknown states never navigate',()=>{
  const f=fixture();f.w.BkGlobal.Ja=1;new AutoSession().step(f.snapshot(),{},0);assert.deepEqual(f.calls,[['lobby',7]]);
  f.w.BkGlobal.Ja=99;assert.throws(()=>new AutoSession().step(f.snapshot(),{},0),/Trạng thái/);
});
test('home screen with no game selected clicks only chess; verification stays manual',()=>{
  const f=fixture();f.w.BkGlobal.ia=-1;f.w.BkGlobal.Ja=f.w.Q;
  f.w.getCurrentScene=()=>({ve:{iC:id=>f.calls.push(['select',id])}});
  new AutoSession().step(f.snapshot(),{},0);assert.deepEqual(f.calls,[['select',f.w.K]]);
  f.w.G=99;f.w.BkGlobal.Ja=99;f.w.BkGlobal.P=null;
  const r=new AutoSession().step(f.snapshot(),{},0);assert.match(r.status,/CAPTCHA/);assert.equal(f.calls.length,1);
  f.w.BkGlobal.ia=f.w.L;assert.throws(()=>f.snapshot(),/Cờ tướng/);
});
test('waits for two seated players, then delays 1–1.5 seconds and never resends without acknowledgement',()=>{
  for(const sample of [0,0.5,1]){
    const f=fixture(),s=new AutoSession(()=>sample);f.w.BkGlobal.Ja=3;f.logic.ha=[f.player];
    s.step(f.snapshot(),{},0);s.step(f.snapshot(),{},1999);assert.equal(f.calls.length,0);
    f.logic.ha.push({Ka:false,status:1});s.step(f.snapshot(),{},2000);
    const due=2000+1000+sample*500;s.step(f.snapshot(),{},due-1);assert.equal(f.calls.length,0);
    s.step(f.snapshot(),{},due);assert.deepEqual(f.calls,[['ready']]);
    s.step(f.snapshot(),{},due+3000);assert.equal(f.calls.length,1);
  }
});
test('opponent leaving cancels readiness countdown; observer does not count as second player',()=>{
  const f=fixture(),s=new AutoSession(()=>0);f.w.BkGlobal.Ja=3;
  s.step(f.snapshot(),{},0);f.logic.ha[1].Ka=true;s.step(f.snapshot(),{},1500);assert.equal(f.calls.length,0);
  f.logic.ha[1].Ka=false;s.step(f.snapshot(),{},2000);s.step(f.snapshot(),{},2999);assert.equal(f.calls.length,0);
  s.step(f.snapshot(),{},3000);assert.deepEqual(f.calls,[['ready']]);
});
test('ready countdown cancelled when player becomes ready, game starts or session stops',()=>{
  for(const change of [f=>f.player.status=1,f=>f.logic.Fb=2]){
    const f=fixture(),s=new AutoSession(()=>0);f.w.BkGlobal.Ja=3;s.step(f.snapshot(),{},0);
    change(f);s.step(f.snapshot(),{},1500);assert.equal(f.calls.length,0);
  }
  const f=fixture(),s=new AutoSession(()=>0);f.w.BkGlobal.Ja=3;s.step(f.snapshot(),{},0);s.reset();s.step(f.snapshot(),{},1500);assert.equal(f.calls.length,0);
});
test('visible active ready button is honored if role flag is out of sync',()=>{
  const f=fixture(),s=new AutoSession(()=>0);f.w.BkGlobal.Ja=3;f.player.status=1;
  f.w.BkGlobal.Yj.ja().mb={x:200,y:200,isVisible:()=>true,isEnabled:()=>true,isTouchEnabled:()=>true};
  s.step(f.snapshot(),{},0);assert.equal(f.calls.length,0);
  s.step(f.snapshot(),{},1000);assert.deepEqual(f.calls,[['ready']]);
});
test('temporary table sync waits and automatically resumes ready/play without resetting session',()=>{
  const f=fixture(),s=new AutoSession(()=>0);f.w.BkGlobal.Ja=3;
  f.logic.Ba=()=>null;assert.equal(s.step(f.snapshot(),{},0).play,false);
  assert.equal(s.step(f.snapshot(),{},500).play,false);
  f.logic.Ba=()=>f.player;s.step(f.snapshot(),{},1000);s.step(f.snapshot(),{},2000);
  assert.deepEqual(f.calls,[['ready']]);
  f.logic.Fb=2;assert.equal(s.step(f.snapshot(),{},2500).play,true);
});
test('alone for 3 seconds leaves once and next lobby excludes that table',()=>{
  const f=fixture(),s=new AutoSession();f.w.BkGlobal.Ja=3;f.logic.ha=[f.player];
  s.step(f.snapshot(),{},0);s.step(f.snapshot(),{},2999);assert.equal(f.calls.length,0);
  s.step(f.snapshot(),{},3000);s.step(f.snapshot(),{},6000);assert.deepEqual(f.calls,[['leave',0]]);
  f.w.BkGlobal.Ja=2;f.common.ic.aN.push({...f.common.ic.aN[0],wg:2});
  s.step(f.snapshot(),{},9000);assert.deepEqual(f.calls.at(-1),['join',2]);
});
test('no alternative means waiting in lobby, not rejoining excluded table',()=>{
  const f=fixture(),s=new AutoSession();f.w.BkGlobal.Ja=3;f.logic.ha=[f.player];s.step(f.snapshot(),{},0);s.step(f.snapshot(),{},3000);
  f.w.BkGlobal.Ja=2;s.step(f.snapshot(),{},6000);assert.deepEqual(f.calls,[['leave',0]]);
});
test('opponent unready for 3 seconds after ready request leaves; readiness ack not required to start timer',()=>{
  const f=fixture(),s=new AutoSession(()=>0);f.w.BkGlobal.Ja=3;f.logic.ha[1].status=2;
  s.step(f.snapshot(),{},0);s.step(f.snapshot(),{},1000);assert.deepEqual(f.calls,[['ready']]);
  f.player.status=1;s.step(f.snapshot(),{},1100);s.step(f.snapshot(),{},3999);assert.equal(f.calls.length,1);
  s.step(f.snapshot(),{},4000);assert.deepEqual(f.calls.at(-1),['leave',0]);
});
test('second person arriving or becoming ready cancels expiry, never leave active game',()=>{
  const f=fixture(),s=new AutoSession(()=>0);f.w.BkGlobal.Ja=3;const other=f.logic.ha.pop();s.step(f.snapshot(),{},0);
  f.logic.ha.push(other);s.step(f.snapshot(),{},2999);s.step(f.snapshot(),{},3000);assert.equal(f.calls.length,0);
  const h=fixture(),t=new AutoSession();h.w.BkGlobal.Ja=3;h.player.status=1;h.logic.ha[1].status=2;t.step(h.snapshot(),{},0);
  h.logic.ha[1].status=1;t.step(h.snapshot(),{},3000);assert.equal(h.calls.length,0);
  h.logic.Fb=2;assert.equal(t.step(h.snapshot(),{},6000).play,true);assert.equal(h.calls.length,0);
});
