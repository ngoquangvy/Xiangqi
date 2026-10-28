let pw;try{pw=require('playwright');}catch{pw=require(require('node:path').join(require('node:os').homedir(),'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));}
const thresholdMode=process.argv.includes('--threshold');
const preReady=process.argv.includes('--pre-ready');
const automatic=process.argv.includes('--auto')||thresholdMode||preReady;
const assert=require('node:assert/strict'),path=require('node:path'),fs=require('node:fs'),os=require('node:os');
(async()=>{
 const ext=path.resolve('extension'),profile=fs.mkdtempSync(path.join(os.tmpdir(),'ziga-google-guard-'));
 const ctx=await pw.chromium.launchPersistentContext(profile,{channel:'msedge',headless:true,args:[`--disable-extensions-except=${ext}`,`--load-extension=${ext}`]});
 try{
  await ctx.addInitScript(()=>{const attach=Element.prototype.attachShadow;Element.prototype.attachShadow=function(o){const r=attach.call(this,o);if(this.id==='ziga-xq-experiment')window.root=r;return r;};});
  await ctx.route('https://googleads.g.doubleclick.net/**',r=>r.fulfill({contentType:'text/html; charset=utf-8',body:`<html><body><iframe src="about:blank" style="display:none"></iframe><div id="dismiss-button"><button id="dismiss-button-element">Đóng</button></div><div id="close-confirmation-dialog" style="display:none;position:fixed;inset:0;background:white"><p>Đóng quảng cáo? Bạn sẽ bị mất phần thưởng</p><button id="close-ad-button">ĐÓNG</button><button id="resume-ad-button">TIẾP TỤC</button></div><script>window.ready=false;const dialog=document.getElementById('close-confirmation-dialog');document.getElementById('dismiss-button-element').onclick=()=>{if(ready)parent.postMessage('reward-complete','*');else dialog.style.display='block';};document.getElementById('close-ad-button').onclick=()=>parent.postMessage('forfeit','*');document.getElementById('resume-ad-button').onclick=()=>{dialog.style.display='none';parent.postMessage('continued','*');};</script></body></html>`}));
  await ctx.route('https://zigavn.com/**',r=>r.fulfill({contentType:'text/html; charset=utf-8',body:`<html><body><script>window.automatic=${automatic};window.preReady=${preReady};window.K=7;window.sj=2;window.V=3;window.Q=1;window.hearts=10;window.continued=0;window.forfeits=0;window.BkGlobal={ia:7,Ja:2,Tg:false,P:{pb:()=>hearts}};window.BkLogicManager={T:()=>({ic:{aN:[]},FJ:()=>{throw Error('Must not join during ad');}})};window.adBreak=o=>{window.options=o;o.beforeAd();if(automatic&&!preReady){BkGlobal.Ja=V;BkGlobal.Yj={ja:()=>null};}const f=document.createElement('iframe');f.src='https://googleads.g.doubleclick.net/reward';f.style='position:fixed;left:0;top:0;width:600px;height:400px';document.body.append(f);};window.WebAdsManager={showRewardAdsOnWeb:()=>{BkGlobal.Tg=true;adBreak({type:'reward',adViewed:()=>hearts++,afterAd:()=>BkGlobal.Tg=false});}};addEventListener('message',e=>{if(e.origin!=='https://googleads.g.doubleclick.net')return;if(e.data==='continued')continued++;if(e.data==='forfeit')forfeits++;if(e.data==='reward-complete'){document.querySelector('iframe').remove();BkGlobal.Ja=sj;options.adViewed();options.afterAd();}});</script></body></html>`}));
  const page=await ctx.newPage();await page.goto('https://zigavn.com/');await page.waitForFunction(()=>window.root&&!root.getElementById('testAd').disabled);
  if(preReady)await page.evaluate(()=>{
    window.order=[];window.tableHearts=0;window.GAME_STATE_PLAYING=2;window.GAME_STATE_READY=1;window.GAME_STATE_NOT_READY=0;window.GAME_STATE_FINISH=100;window.PLAYER_STATE_NOT_READY=2;window.PLAYER_STATE_READY=1;window.PLAYER_STATE_TABLE_OWNER=0;
    window.me={Ka:false,status:2,zn:()=>tableHearts};
    window.logic={Ke:1,Fb:1,Ba:()=>me,ha:[me,{Ka:false,status:1}],OA:()=>tableHearts>=1,uo:()=>{order.push('leave');BkGlobal.Ja=sj;}};
    logic.tN=()=>{if(hearts<=10||tableHearts<1)throw Error('Ready before credit');order.push('ready');logic.Fb=2;};logic.$P=()=>logic.tN();
    window.layer={T:()=>logic,onReady:()=>logic.$P()};
    BkGlobal.Yj={ja:()=>layer};BkGlobal.Ja=V;BkGlobal.af=0;BkGlobal.vi=1;
    BkLogicManager.T=()=>({ic:{aN:[{wg:1,aj:2,tk:1,Rb:0,Wj:0,Yb:1}]},FJ:()=>{order.push('join');tableHearts=1;BkGlobal.Ja=V;}});
    const show=WebAdsManager.showRewardAdsOnWeb;WebAdsManager.showRewardAdsOnWeb=()=>{order.push('ad');show();};
  });
  if(preReady)await page.evaluate(()=>{root.getElementById('autoAds').checked=true;root.getElementById('autoStart').click();layer.onReady();logic.$P();logic.tN();if(order.length)throw Error('Native Ready bypassed guard');});
  else if(automatic)await page.evaluate(threshold=>{hearts=threshold;root.getElementById('adHeartThreshold').value=String(threshold);root.getElementById('autoAds').checked=true;root.getElementById('autoStart').click();},thresholdMode?2:0);
  else await page.evaluate(()=>root.getElementById('testAd').click());
  await page.waitForFunction(()=>continued===1,null,{timeout:30000}).catch(async e=>{await page.evaluate(()=>root.getElementById('adDiagnostic').click());await page.waitForFunction(()=>!root.getElementById('adDiagnosticText').value.startsWith('Đang đọc'),null,{timeout:5000}).catch(()=>{});console.log('DIAG',await page.evaluate(()=>({text:root.getElementById('adDiagnosticText').value,status:root.getElementById('adTestStatus').textContent,hearts,continued,forfeits})));console.log('FRAME',await page.frames().find(f=>f.url().includes('doubleclick.net')).evaluate(()=>({text:document.body.innerText,state:document.documentElement.dataset.zigaAdState})));throw e;});assert.equal(await page.evaluate(()=>forfeits),0);assert.equal(await page.evaluate(()=>hearts),preReady?10:automatic?(thresholdMode?2:0):10);
  const frame=page.frames().find(f=>f.url().includes('doubleclick.net'));await frame.evaluate(()=>ready=true);
  await page.waitForFunction(target=>hearts===target,preReady?11:automatic?(thresholdMode?3:1):11,{timeout:15000});assert.equal(await page.evaluate(()=>forfeits),0);
  if(preReady){await page.waitForFunction(()=>order.includes('ready'),null,{timeout:10000});assert.deepEqual(await page.evaluate(()=>order),['leave','ad','join','ready']);console.log('PRE-READY PASS: lower table balance causes leave -> ad -> credit -> join -> Ready, in that order.');}
  console.log(automatic?'AUTO MODE: missing table layer while ad runs; SDK reward credited.':'TEST MODE');
  console.log('PASS: Google dismiss without video signal resumes on lose-reward confirmation, retries after cooldown and closes only when SDK allows; no forfeit click.');
 }finally{await ctx.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
