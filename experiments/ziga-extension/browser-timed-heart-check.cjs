let pw;try{pw=require('playwright');}catch{pw=require(require('node:path').join(require('node:os').homedir(),'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));}
const assert=require('node:assert/strict'),path=require('node:path'),fs=require('node:fs'),os=require('node:os');
(async()=>{
 const extension=path.resolve('extension'),profile=fs.mkdtempSync(path.join(os.tmpdir(),'ziga-timed-heart-'));
 const ctx=await pw.chromium.launchPersistentContext(profile,{channel:'msedge',headless:true,args:[`--disable-extensions-except=${extension}`,`--load-extension=${extension}`]});
 try{
  await ctx.addInitScript(()=>{const attach=Element.prototype.attachShadow;Element.prototype.attachShadow=function(o){const root=attach.call(this,o);if(this.id==='ziga-xq-experiment')window.root=root;return root;};});
  await ctx.route('https://zigavn.com/**',r=>r.fulfill({contentType:'text/html; charset=utf-8',body:`<html><body><script>window.K=7;window.sj=2;window.V=3;window.Q=1;window.qc=44;window.GAME_STATE_PLAYING=2;window.GAME_STATE_FINISH=100;window.timedClosed=0;window.joined=0;window.ads=0;window.left=0;window.BkGlobal={ia:7,Ja:sj,af:0,vi:1,P:{pb:()=>5}};window.BkLogicManager={T:()=>({ic:{aN:[{wg:1,aj:2,tk:1,Rb:0,Wj:0,Yb:1}]},FJ:()=>joined++})};window.WebAdsManager={showRewardAdsOnWeb:()=>ads++};window.BkBonusHeartWindow=class{constructor(){this.lA=1;this.Zv=qc;}removeSelf(){timedClosed++;window.Fl=null;}};window.Fl=new BkBonusHeartWindow();</script></body></html>`}));
  const page=await ctx.newPage();await page.goto('https://zigavn.com/');await page.waitForFunction(()=>window.root&&!root.getElementById('autoStart').disabled);
  await page.evaluate(()=>root.getElementById('autoStart').click());
  await page.waitForFunction(()=>timedClosed===1&&joined===1,null,{timeout:6000});
  assert.equal(await page.evaluate(()=>root.getElementById('autoStop').disabled),false);assert.equal(await page.evaluate(()=>ads),0);
  await page.evaluate(()=>{
   const me={Ka:false,status:1};const logic={Fb:GAME_STATE_PLAYING,Ba:()=>me,ha:[me,{Ka:false,status:1}],uo:()=>left++};
   const layer={T:()=>logic};BkGlobal.Ja=V;BkGlobal.Yj={ja:()=>layer};window.Fl=new BkBonusHeartWindow();
  });
  await page.waitForFunction(()=>timedClosed===2&&root.getElementById('autoStatus').textContent.includes('trong ván'),null,{timeout:5000});
  assert.equal(await page.evaluate(()=>root.getElementById('autoStop').disabled),false);assert.equal(await page.evaluate(()=>ads+left),0);
  console.log('PASS: timed-heart popup closes before lobby join and during a game; autoplay stays on, no ads requested or table left.');
 }finally{await ctx.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
