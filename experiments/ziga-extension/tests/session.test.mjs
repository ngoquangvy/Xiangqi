import {settings} from '../settings.mjs';
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
  f.hearts(5);f.w.BkGlobal.Ja=3;f.logic.Ke=2;assert.throws(()=>new AutoSession().step(f.snapshot()),/giới hạn/);
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
test('alone for configured timeout leaves once and next lobby excludes that table',()=>{
  const f=fixture(),s=new AutoSession();f.w.BkGlobal.Ja=3;f.logic.ha=[f.player];
  s.step(f.snapshot(),{},0);s.step(f.snapshot(),{},settings.session.idleTableMs-1);assert.equal(f.calls.length,0);
  s.step(f.snapshot(),{},settings.session.idleTableMs);s.step(f.snapshot(),{},settings.session.idleTableMs+3000);assert.deepEqual(f.calls,[['leave',0]]);
  f.w.BkGlobal.Ja=2;f.common.ic.aN.push({...f.common.ic.aN[0],wg:2});
  s.step(f.snapshot(),{},settings.session.idleTableMs+6000);assert.deepEqual(f.calls.at(-1),['join',2]);
});
test('no alternative means waiting in lobby, not rejoining excluded table',()=>{
  const f=fixture(),s=new AutoSession();f.w.BkGlobal.Ja=3;f.logic.ha=[f.player];s.step(f.snapshot(),{},0);s.step(f.snapshot(),{},settings.session.idleTableMs);
  f.w.BkGlobal.Ja=2;s.step(f.snapshot(),{},settings.session.idleTableMs+3000);assert.deepEqual(f.calls,[['leave',0]]);
});
test('opponent unready for configured timeout after ready request leaves; readiness ack not required to start timer',()=>{
  const f=fixture(),s=new AutoSession(()=>0);f.w.BkGlobal.Ja=3;f.logic.ha[1].status=2;
  s.step(f.snapshot(),{},0);s.step(f.snapshot(),{},1000);assert.deepEqual(f.calls,[['ready']]);
  f.player.status=1;s.step(f.snapshot(),{},1100);s.step(f.snapshot(),{},1000+settings.session.idleTableMs-1);assert.equal(f.calls.length,1);
  s.step(f.snapshot(),{},1000+settings.session.idleTableMs);assert.deepEqual(f.calls.at(-1),['leave',0]);
});
test('second person arriving or becoming ready cancels expiry, never leave active game',()=>{
  const f=fixture(),s=new AutoSession(()=>0);f.w.BkGlobal.Ja=3;const other=f.logic.ha.pop();s.step(f.snapshot(),{},0);
  f.logic.ha.push(other);s.step(f.snapshot(),{},2999);s.step(f.snapshot(),{},3000);assert.equal(f.calls.length,0);
  const h=fixture(),t=new AutoSession();h.w.BkGlobal.Ja=3;h.player.status=1;h.logic.ha[1].status=2;t.step(h.snapshot(),{},0);
  h.logic.ha[1].status=1;t.step(h.snapshot(),{},3000);assert.equal(h.calls.length,0);
  h.logic.Fb=2;assert.equal(t.step(h.snapshot(),{},6000).play,true);assert.equal(h.calls.length,0);
});

test('out-of-hearts informational prompt uses genuine Agree once and waits for server credit',()=>{
  const f=fixture(),session=new AutoSession();f.hearts(0);
  f.w.Fn='Bạn không đủ tim để chơi. Bạn có muốn xem quảng cáo không?';
  let rejected=0;
  const popup={la:{getString:()=>f.w.Fn},Vl:()=>f.calls.push(['prompt-ad']),hf:callback=>popup.close=callback,close:()=>rejected++,removeSelf:()=>{popup.close?.();f.w.Fl=null;}};
  f.w.Fl=popup;
  session.step(f.snapshot(),{autoAds:true},0);
  assert.deepEqual(f.calls,[['prompt-ad']]);assert.equal(rejected,0);
  session.step(f.snapshot(),{autoAds:true},3000);assert.equal(f.calls.length,1);
  assert.ok(session.ad);f.hearts(1);
  assert.match(session.step(f.snapshot(),{autoAds:true},4000).status,/đã cộng tim/);assert.equal(session.ad,null);
});

test('unrelated confirmation cannot trigger reward, and hidden tab never accepts heart prompt',()=>{
  const f=fixture();f.hearts(0);f.w.Fn='Không đủ tim. Xem quảng cáo?';
  let accepted=0;const popup={la:{getString:()=> 'Mua tim?'},Vl:()=>accepted++,hf:()=>{},removeSelf:()=>{}};
  f.w.Fl=popup;
  assert.throws(()=>new AutoSession().step(f.snapshot(),{autoAds:true},0),/popup/);
  popup.la.getString=()=>f.w.Fn;f.w.document.visibilityState='hidden';
  new AutoSession().step(f.snapshot(),{autoAds:true},0);assert.equal(accepted,0);
});

test('heart reward notification popup is auto-closed after credit and bot continues into table',()=>{
  const f=fixture(),session=new AutoSession();f.hearts(0);
  session.step(f.snapshot(),{autoAds:true},0);
  assert.deepEqual(f.calls,[['ad']]);
  f.hearts(1);
  let closed=0;
  const rewardPopup={
    la:{getString:()=>'Bạn đã nhận được 1 tim khi xem xong quảng cáo.'},
    Vl:()=>closed++,
    removeSelf:()=>{closed++;f.w.Fl=null;}
  };
  f.w.Fl=rewardPopup;
  const r1=session.step(f.snapshot(),{autoAds:true},3000);
  assert.match(r1.status,/đã cộng tim/);
  assert.ok(closed>=1,'Nút đóng hoặc removeSelf của thông báo nhận tim phải được gọi');
  assert.equal(f.w.Fl,null);
  session.step(f.snapshot(),{autoAds:true},6000);
  assert.deepEqual(f.calls,[['ad'],['join',1]]);
});

test('delayed heart reward popup appearing after credit is auto-dismissed before joining table',()=>{
  const f=fixture(),session=new AutoSession();f.hearts(0);
  session.step(f.snapshot(),{autoAds:true},0);
  f.hearts(1);
  session.step(f.snapshot(),{autoAds:true},3000);
  assert.equal(session.ad,null);
  let closed=0;
  const delayedPopup={
    la:{getString:()=>'Nhận tim thành công!'},
    Bp:()=>closed++,
    removeSelf:()=>{closed++;f.w.Fl=null;}
  };
  f.w.Fl=delayedPopup;
  session.step(f.snapshot(),{autoAds:true},4000);
  assert.ok(closed>=1,'Thông báo nhận tim xuất hiện trễ phải được tự đóng');
  assert.equal(f.w.Fl,null);
  session.step(f.snapshot(),{autoAds:true},6000);
  assert.deepEqual(f.calls,[['ad'],['join',1]]);
});

test('heart reward popup with single-button alert type is dismissed after recent credit',()=>{
  const f=fixture(),session=new AutoSession();f.hearts(0);
  f.w.Sa=10;
  session.step(f.snapshot(),{autoAds:true},0);
  f.hearts(1);
  session.step(f.snapshot(),{autoAds:true},3000);
  let closed=0;
  const alertPopup={
    type:10,
    removeSelf:()=>{closed++;f.w.Fl=null;}
  };
  f.w.Fl=alertPopup;
  session.step(f.snapshot(),{autoAds:true},6000);
  assert.ok(closed>=1);
  assert.deepEqual(f.calls,[['ad'],['join',1]]);
});

test('unrelated popup after ad still throws error and does not enter table',()=>{
  const f=fixture(),session=new AutoSession();f.hearts(0);
  session.step(f.snapshot(),{autoAds:true},0);
  f.hearts(1);
  session.step(f.snapshot(),{autoAds:true},3000);
  const unknownPopup={
    la:{getString:()=>'Tài khoản đăng nhập trên thiết bị khác.'},
    removeSelf:()=>{}
  };
  f.w.Fl=unknownPopup;
  assert.throws(()=>session.step(f.snapshot(),{autoAds:true},6000),/popup cần xử lý/);
  assert.deepEqual(f.calls,[['ad']]);
});

test('DOM heart reward notification is clicked and cleared',()=>{
  const f=fixture(),session=new AutoSession();f.hearts(0);
  session.step(f.snapshot(),{autoAds:true},0);
  f.hearts(1);
  let clicked=0;
  const modalEl={
    textContent:'Chúc mừng bạn đã nhận được 1 tim từ quảng cáo!',
    querySelector:()=>({click:()=>clicked++,disabled:false})
  };
  f.w.document.querySelectorAll=sel=>sel.includes('.modal')?[modalEl]:[];
  session.step(f.snapshot(),{autoAds:true},3000);
  assert.equal(clicked,1,'Nút đóng trong DOM notification phải được click');
});

test('real canvas bonus window closes once after credit, including delayed popup without text',()=>{
  const f=fixture(),session=new AutoSession();f.hearts(0);let closed=0,wrongCallback=0;
  f.w.BkBonusHeartWindow=class {constructor(){this.lA=1;} removeSelf(){closed++;f.w.Fl=null;} Vl(){wrongCallback++;} Bp(){wrongCallback++;}};
  session.step(f.snapshot(),{autoAds:true},0);f.hearts(1);session.step(f.snapshot(),{autoAds:true},1000);
  f.w.Fl=new f.w.BkBonusHeartWindow();session.step(f.snapshot(),{autoAds:true},2000);
  session.step(f.snapshot(),{autoAds:true},3000);
  assert.equal(closed,1);assert.equal(wrongCallback,0);assert.equal(f.calls.at(-1)[0],'join');
});

test('known informational type with unrelated text is not closed after credit',()=>{
  const f=fixture(),session=new AutoSession();f.hearts(0);f.w.Sa=10;
  session.step(f.snapshot(),{autoAds:true},0);f.hearts(1);session.step(f.snapshot(),{autoAds:true},1000);
  let closed=0;f.w.Fl={type:10,la:{getString:()=> 'Tài khoản đã bị ngắt kết nối'},removeSelf:()=>closed++};
  assert.throws(()=>session.step(f.snapshot(),{autoAds:true},4000),/popup/);assert.equal(closed,0);
});

test('manual reward test starts while hearts remain, opens once, closes bonus and never joins a table',()=>{
 const f=fixture(),s=new AutoSession();let closed=0;
 f.w.BkBonusHeartWindow=class{constructor(){this.lA=1;}removeSelf(){closed++;f.w.Fl=null;}};
 s.beginReward(f.snapshot(),{maxAds:1},0);assert.deepEqual(f.calls,[['ad']]);
 s.beginReward(f.snapshot(),{maxAds:1},100);assert.equal(f.calls.length,1);
 s.step(f.snapshot(),{rewardOnly:true},1000);f.hearts(6);
 s.step(f.snapshot(),{rewardOnly:true},2000);f.w.Fl=new f.w.BkBonusHeartWindow();
 s.step(f.snapshot(),{rewardOnly:true},3000);assert.equal(closed,1);
 assert.equal(s.step(f.snapshot(),{rewardOnly:true},2000+settings.session.rewardPopupWindowMs).done,true);
 assert.deepEqual(f.calls,[['ad']]);assert.throws(()=>s.beginReward(f.snapshot(),{maxAds:1},40000),/giới hạn/);
});

test('manual reward test refuses to interrupt an active game',()=>{
 const f=fixture();f.w.BkGlobal.Ja=f.w.V;f.logic.Fb=f.w.GAME_STATE_PLAYING;
 assert.throws(()=>new AutoSession().beginReward(f.snapshot(),{},0),/về sảnh/);assert.equal(f.calls.length,0);
});

test('automatic reward tracking continues while the table layer is temporarily missing',()=>{
 const f=fixture(),s=new AutoSession();f.hearts(0);s.step(f.snapshot(),{autoAds:true},0);
 f.w.BkGlobal.Ja=f.w.V;f.w.BkGlobal.Yj.ja=()=>null;
 assert.equal(f.snapshot().syncing,true);
 assert.match(s.step(f.snapshot(),{autoAds:true},25000).status,/xác nhận tim/);
 assert.equal(s.syncAt,null);f.hearts(1);
 assert.match(s.watchReward(f.w,26000).status,/đã cộng tim/);assert.equal(s.ad,null);
});

test('hidden time does not exhaust the reward timeout; returning resumes without opening another ad',()=>{
 const f=fixture(),s=new AutoSession();s.beginReward(f.snapshot(),{},0);
 f.w.document.visibilityState='hidden';assert.match(s.watchReward(f.w,100).status,/tab hiển thị/);
 assert.doesNotThrow(()=>s.watchReward(f.w,200000));
 f.w.document.visibilityState='visible';assert.doesNotThrow(()=>s.watchReward(f.w,200001));
 assert.deepEqual(f.calls,[['ad']]);f.hearts(6);
 assert.match(s.watchReward(f.w,200002).status,/đã cộng tim/);
});

test('heart threshold triggers ads at equality, repeats until above threshold, and then permits a one-heart table',()=>{
 const f=fixture(),s=new AutoSession();f.hearts(2);
 s.step(f.snapshot(),{autoAds:true,adHeartThreshold:2},0);assert.deepEqual(f.calls,[['ad']]);
 f.hearts(3);s.step(f.snapshot(),{autoAds:true,adHeartThreshold:2},1000);
 s.step(f.snapshot(),{autoAds:true,adHeartThreshold:2},4000);assert.deepEqual(f.calls.at(-1),['join',1]);
 const h=fixture(),t=new AutoSession();h.hearts(1);t.step(h.snapshot(),{autoAds:true,adHeartThreshold:2},0);
 h.hearts(2);t.step(h.snapshot(),{autoAds:true,adHeartThreshold:2},1000);t.step(h.snapshot(),{autoAds:true,adHeartThreshold:2},4000);
 assert.deepEqual(h.calls,[['ad'],['ad']]);
});

test('at threshold never spends reserved hearts when ads disabled or capped, never interrupts an active game',()=>{
 const f=fixture(),s=new AutoSession();f.hearts(2);
 assert.throws(()=>s.step(f.snapshot(),{adHeartThreshold:2},0),/chạm ngưỡng/);assert.equal(f.calls.length,0);
 s.adsUsed=1;assert.throws(()=>s.step(f.snapshot(),{autoAds:true,adHeartThreshold:2,maxAds:1},0),/giới hạn/);assert.equal(f.calls.length,0);
 f.w.BkGlobal.Ja=f.w.V;f.logic.Fb=f.w.GAME_STATE_PLAYING;
 assert.equal(s.step(f.snapshot(),{autoAds:true,adHeartThreshold:2,maxAds:1},0).play,true);
});

test('at threshold leaves a waiting table before opening an ad and never readies',()=>{
 const f=fixture(),s=new AutoSession();f.hearts(2);f.w.BkGlobal.Ja=f.w.V;
 s.step(f.snapshot(),{autoAds:true,adHeartThreshold:2},0);assert.deepEqual(f.calls,[['leave',0]]);
 s.step(f.snapshot(),{autoAds:true,adHeartThreshold:2},1000);assert.equal(f.calls.length,1);
 f.w.BkGlobal.Ja=f.w.sj;s.step(f.snapshot(),{autoAds:true,adHeartThreshold:2},3000);
 assert.deepEqual(f.calls,[['leave',0],['ad']]);
});

test('table-specific insufficient hearts are handled before Ready despite a higher global balance',()=>{
 const f=fixture(),s=new AutoSession(()=>0);f.w.BkGlobal.Ja=f.w.V;f.player.zn=()=>0;f.logic.OA=()=>false;
 s.step(f.snapshot(),{autoAds:true},0);assert.deepEqual(f.calls,[['leave',0]]);assert.equal(s.mustRewardBeforeReady,true);
 f.w.BkGlobal.Ja=f.w.sj;s.step(f.snapshot(),{autoAds:true},3000);assert.deepEqual(f.calls,[['leave',0],['ad']]);
 s.step(f.snapshot(),{autoAds:true},3500);assert.equal(f.calls.some(c=>c[0]==='ready'),false);
 f.hearts(6);s.step(f.snapshot(),{autoAds:true},4000);assert.equal(s.mustRewardBeforeReady,false);
 f.player.zn=()=>6;f.logic.OA=()=>true;f.w.BkGlobal.Ja=f.w.V;
 s.step(f.snapshot(),{autoAds:true},7000);assert.equal(f.calls.some(c=>c[0]==='ready'),false);
 s.step(f.snapshot(),{autoAds:true},8000);assert.deepEqual(f.calls,[['leave',0],['ad'],['ready']]);
});

test('insufficient table balance blocks owner Start and rechecks balance when countdown expires',()=>{
 const f=fixture(),s=new AutoSession(()=>0);f.w.BkGlobal.Ja=f.w.V;
 f.player.status=f.w.PLAYER_STATE_TABLE_OWNER;let balance=5;f.player.zn=()=>balance;
 s.step(f.snapshot(),{autoAds:true},0);balance=0;
 s.step(f.snapshot(),{autoAds:true},1000);assert.deepEqual(f.calls,[['leave',0]]);assert.equal(s.readyWait,null);
});

test('an ad cancels the existing ready countdown; no Ready until credited and a fresh delay passes',()=>{
 const f=fixture(),s=new AutoSession(()=>0);f.w.BkGlobal.Ja=f.w.V;
 s.step(f.snapshot(),{autoAds:true},0);assert.ok(s.readyWait);
 s.beginReward(f.snapshot(),{},100);s.step(f.snapshot(),{autoAds:true},1100);
 assert.equal(s.readyWait,null);assert.deepEqual(f.calls,[['ad']]);
 f.hearts(6);s.step(f.snapshot(),{autoAds:true},2000);s.step(f.snapshot(),{autoAds:true},4000);
 assert.equal(f.calls.some(c=>c[0]==='ready'),false);
 s.step(f.snapshot(),{autoAds:true},5000);assert.deepEqual(f.calls,[['ad'],['ready']]);
});

test('advertising disabled with insufficient table balance never clicks Ready',()=>{
 const f=fixture(),s=new AutoSession();f.w.BkGlobal.Ja=f.w.V;f.player.P={pb:()=>0};
 s.step(f.snapshot(),{},0);assert.deepEqual(f.calls,[['leave',0]]);f.w.BkGlobal.Ja=f.w.sj;assert.throws(()=>s.step(f.snapshot(),{},3000),/Chưa bấm Sẵn sàng/);assert.equal(f.calls.some(c=>c[0]==='ready'),false);
});

test('native site Ready and Start callbacks cannot bypass the reserve between bot ticks',()=>{
 const f=fixture(),s=new AutoSession();f.w.BkGlobal.Ja=f.w.V;
 f.logic.tN=()=>f.calls.push(['ready-packet']);f.logic.uN=()=>f.calls.push(['start-packet']);f.logic.$P=()=>f.logic.tN();f.logic.fG=()=>f.logic.uN();f.snapshot().layer.onReady=()=>f.logic.$P();
 let threshold=2;f.hearts(2);s.guardNativeReady(f.snapshot(),()=>({adHeartThreshold:threshold}));
 f.snapshot().layer.onReady();f.logic.$P();f.logic.tN();f.logic.fG();f.logic.uN();assert.equal(f.calls.length,0);assert.equal(s.mustRewardBeforeReady,true);
 s.mustRewardBeforeReady=false;f.hearts(3);f.snapshot().layer.onReady();assert.deepEqual(f.calls,[['ready-packet']]);
 threshold=3;f.logic.fG();assert.equal(f.calls.length,1);
 s.reset();f.logic.fG();assert.deepEqual(f.calls,[['ready-packet'],['start-packet']]);
});

test('native Ready remains blocked while reward is pending even when balance is above threshold',()=>{
 const f=fixture(),s=new AutoSession();f.w.BkGlobal.Ja=f.w.V;
 s.guardNativeReady(f.snapshot(),{adHeartThreshold:0});s.beginReward(f.snapshot(),{},0);
 f.snapshot().layer.onReady();assert.deepEqual(f.calls,[['ad']]);
 f.hearts(6);s.watchReward(f.w,1000);f.snapshot().layer.onReady();assert.deepEqual(f.calls,[['ad'],['ready']]);s.reset();
});

test('a reward opened by the site is adopted before credit and receives the same close/credit tracking',()=>{
 const f=fixture(),s=new AutoSession();let sdk;
 f.w.adBreak=o=>sdk=o;s.watchReward(f.w,0);
 f.w.adBreak({type:'reward'});sdk.beforeAd();s.watchReward(f.w,1000);
 assert.ok(s.ad);assert.equal(s.adsUsed,1);assert.equal(s.ad.hearts,5);
 f.hearts(6);sdk.adViewed();sdk.afterAd();assert.match(s.watchReward(f.w,2000).status,/đã cộng tim/);assert.equal(s.ad,null);
});

test('periodic free-heart popup closes without a recent ad and keeps autoplay active',()=>{
 const f=fixture(),s=new AutoSession();let closed=0;
 f.w.qc=44;f.w.BkBonusHeartWindow=class{constructor(){this.lA=1;this.Zv=44;}removeSelf(){closed++;f.w.Fl=null;}};
 f.w.Fl=new f.w.BkBonusHeartWindow();
 assert.match(s.step(f.snapshot(),{},0).status,/định kỳ/);assert.equal(closed,1);assert.equal(s.adsUsed,0);assert.equal(s.ad,null);
 s.step(f.snapshot(),{},3000);assert.deepEqual(f.calls,[['join',1]]);
});

test('periodic credit popup during a game closes once and does not leave or open ads',()=>{
 const f=fixture(),s=new AutoSession();f.w.BkGlobal.Ja=f.w.V;f.logic.Fb=f.w.GAME_STATE_PLAYING;
 let closed=0;f.w.qc=44;f.w.BkBonusHeartWindow=class{constructor(){this.lA=1;this.Zv=44;}removeSelf(){closed++;f.w.Fl=null;}};
 f.w.Fl=new f.w.BkBonusHeartWindow();assert.match(s.watchReward(f.w,0).status,/định kỳ/);
 assert.equal(s.step(f.snapshot(),{},250).play,true);assert.equal(closed,1);assert.equal(f.calls.length,0);
});

test('non-periodic rewards, failed credit and unknown info popups remain untouched without ad context',()=>{
 for(const mode of ['other-reason','no-credit','unknown']){
  const f=fixture(),s=new AutoSession();let closed=0;f.w.qc=44;
  f.w.BkBonusHeartWindow=class{constructor(){this.lA=1;this.Zv=mode==='other-reason'?55:44;}removeSelf(){closed++;f.w.Fl=null;}};
  f.w.Fl=mode==='unknown'?{type:'info',la:{getString:()=> 'Đến thời gian nhận tim miễn phí'},removeSelf:()=>closed++}:new f.w.BkBonusHeartWindow();
  if(mode==='no-credit')f.hearts(0);
  assert.equal(s.watchReward(f.w,0),null);assert.equal(closed,0);
 }
});
