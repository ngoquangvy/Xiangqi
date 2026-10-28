let playwright;
try { playwright = require('playwright'); }
catch { playwright = require(require('node:path').join(require('node:os').homedir(), '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright')); }
const {chromium}=playwright;
const path=require('node:path');const fs=require('node:fs');const os=require('node:os');const assert=require('node:assert/strict');
(async()=>{
 const {createServer}=await import('./native-server.mjs');const server=createServer();await new Promise((r,j)=>server.listen(0,'127.0.0.1',r).on('error',j));const testBase='http://127.0.0.1:'+server.address().port;
 let context;
 try{
 const extension=path.resolve('extension');
 const profile=fs.mkdtempSync(path.join(os.tmpdir(),'ziga-native-check-'));context=await chromium.launchPersistentContext(profile,{channel:'msedge',headless:true,args:[`--disable-extensions-except=${extension}`,`--load-extension=${extension}`]});
 const worker=context.serviceWorkers()[0]||await context.waitForEvent('serviceworker',{timeout:12000});
  console.log('EXTENSION',await worker.evaluate(()=>chrome.runtime.getManifest().version));
 await worker.evaluate(base=>{const original=globalThis.fetch;globalThis.testRequests=0;globalThis.fetch=(url,options)=>{if(String(url).includes('/analyze'))globalThis.testRequests++;return original(String(url).replace('http://127.0.0.1:17864',base),options).then(async r=>{if(String(url).endsWith('/ponder'))globalThis.lastPonder=await r.clone().json();return r;});};},testBase);
 await context.addInitScript(()=>{const original=Element.prototype.attachShadow;Element.prototype.attachShadow=function(o){const r=original.call(this,o);if(this.id==='ziga-xq-experiment')window.__testRoot=r;return r;};});
 const page=await context.newPage();
 await page.route('https://zigavn.com/**',route=>route.fulfill({contentType:'text/html',body:`<html><body>Controlled Ziga fixture<script>
 const types=[0,1,1,2,2,3,3,4,4,5,5,6,6,6,6,6],cols=[4,3,5,2,6,0,8,1,7,1,7,0,2,4,6,8],rows=[0,0,0,0,0,0,0,2,2,0,0,3,3,3,3,3];
 window.sent=[];window.K=7;window.GAME_STATE_PLAYING=3;
 window.logic={Fb:3,Ba:()=>({Ka:false}),Cn:()=>1,PP:(x,y,tx,ty)=>{sent.push([x,y,tx,ty]);const p=layer.V.find(p=>!p.pa&&p.fa===x&&p.rowIndex===y);if(!p)throw Error('Missing source');const target=layer.V.find(p=>!p.pa&&p.fa===tx&&p.rowIndex===ty);if(target)target.pa=true;p.fa=tx;p.rowIndex=ty;layer.Yc=1;}};
 window.layer={V:Array.from({length:32},(_,i)=>({fa:i<16?cols[i]:8-cols[i%16],rowIndex:i<16?rows[i]:9-rows[i%16],Ga:types[i%16],ka:Math.floor(i/16),pa:false})),Nj:0,Yc:0,hc:false,T:()=>logic,Yt:1,nv:2};
 window.BkGlobal={ia:7,Yj:{ja:()=>layer}};
 </script></body></html>`}));
 await page.goto('https://zigavn.com/');await page.waitForFunction(()=>!!window.__testRoot && !__testRoot.getElementById("start").disabled);
 assert.match(await page.evaluate(()=>__testRoot.getElementById('menuBody').querySelector('small').textContent),/Pikafish/);
 await page.evaluate(()=>__testRoot.getElementById('start').click());
 await page.waitForFunction(()=>sent.length===1,{timeout:10000});
 console.log('BOOK MOVE',await page.evaluate(()=>({sent,detail:__testRoot.getElementById('detail').textContent})));
 assert.match(await page.evaluate(()=>__testRoot.getElementById('detail').textContent),/Opening book/);
  await page.evaluate(()=>__testRoot.getElementById('minimize').click());
 assert.equal(await page.evaluate(()=>__testRoot.getElementById('menuBody').hidden),true);
 assert.equal(await page.evaluate(()=>__testRoot.getElementById('start').disabled),true);
 await page.evaluate(()=>__testRoot.getElementById('minimize').click());
 assert.equal(await page.evaluate(()=>__testRoot.getElementById('menuBody').hidden),false);
 // Opponent plays a legal pawn move, then force engine-only calculation.
 await page.evaluate(()=>{__testRoot.getElementById('book').value='0';__testRoot.getElementById('threads').value='1';__testRoot.getElementById('depth').value='3';const p=layer.V.find(p=>p.ka===1&&p.Ga===6&&p.fa===0);p.rowIndex--;layer.Yc=0;});
 await page.waitForFunction(()=>sent.length===2,{timeout:12000});
 assert.match(await page.evaluate(()=>__testRoot.getElementById('detail').textContent),/Pikafish/);
 assert.match(await page.evaluate(()=>__testRoot.getElementById('detail').textContent),/sâu 3 · 1 threads/);
 console.log('ENGINE MOVE',await page.evaluate(()=>({sent,detail:__testRoot.getElementById('detail').textContent})));
 await page.evaluate(()=>__testRoot.getElementById('stop').click());
 const count=await page.evaluate(()=>sent.length);
 await page.waitForTimeout(1000);assert.equal(await page.evaluate(()=>sent.length),count);
  await page.reload();await page.waitForFunction(()=>!!window.__testRoot && !__testRoot.getElementById("start").disabled);
 await page.evaluate(()=>{__testRoot.getElementById('book').value='0';__testRoot.getElementById('time').value='5000';__testRoot.getElementById('start').click();});
 async function waitBusy(expected){for(let i=0;i<150;i++){if((await(await fetch(testBase+'/health')).json()).busy===expected)return;await new Promise(r=>setTimeout(r,30));}throw Error('Busy state did not become '+expected);}
 await waitBusy(true);await page.evaluate(()=>__testRoot.getElementById('stop').click());await waitBusy(false);
 await page.waitForTimeout(700);assert.equal(await page.evaluate(()=>sent.length),0);
 await page.evaluate(()=>__testRoot.getElementById('start').click());await waitBusy(true);
 await page.evaluate(()=>{layer.V[11].rowIndex++;});
 await waitBusy(false);await page.waitForTimeout(700);
 assert.equal(await page.evaluate(()=>sent.length),0);
 assert.match(await page.evaluate(()=>__testRoot.getElementById('status').textContent),/thay đổi/);
  await page.reload();await page.waitForFunction(()=>!!window.__testRoot && !__testRoot.getElementById("start").disabled);
 await page.evaluate(()=>__testRoot.getElementById('start').click());
 await page.waitForFunction(()=>__testRoot.getElementById('status').textContent.startsWith('Đã có nước'));
 assert.equal(await page.evaluate(()=>sent.length),0);
 await page.evaluate(()=>__testRoot.getElementById('stop').click());
 await page.waitForTimeout(2200);assert.equal(await page.evaluate(()=>sent.length),0);
 await page.evaluate(()=>__testRoot.getElementById('start').click());
 await page.waitForFunction(()=>__testRoot.getElementById('status').textContent.startsWith('Đã có nước'));
 await page.evaluate(()=>{layer.V[11].rowIndex++;});
 await page.waitForTimeout(2200);assert.equal(await page.evaluate(()=>sent.length),0);
 assert.match(await page.evaluate(()=>__testRoot.getElementById('status').textContent),/hủy nước/);
  await page.reload();await page.waitForFunction(()=>!!window.__testRoot && !__testRoot.getElementById("start").disabled);
 await page.evaluate(()=>{
   window.autoCalls=[];window.autoHearts=5;window.me={Ka:false,status:2};
   window.initialPieces=structuredClone(layer.V);
   window.sj=10;window.V=11;window.Q=12;window.GAME_STATE_READY=1;window.GAME_STATE_NOT_READY=0;window.GAME_STATE_FINISH=100;
   window.PLAYER_STATE_TABLE_OWNER=0;window.PLAYER_STATE_READY=1;window.PLAYER_STATE_NOT_READY=2;
   const adCanvas=document.createElement('canvas');adCanvas.width=900;adCanvas.height=600;adCanvas.style.cssText='position:fixed;left:0;top:0;width:900px;height:600px';document.body.prepend(adCanvas);BkGlobal.Tg=true;BkGlobal.Ja=Q;BkGlobal.ia=-1;BkGlobal.af=0;BkGlobal.vi=1;BkGlobal.P={pb:()=>autoHearts};window.getCurrentScene=()=>({ve:{iC:id=>{autoCalls.push('choose:'+id);BkGlobal.ia=id;BkGlobal.Ja=sj;}}});
   logic.Ke=1;logic.Fb=1;logic.Ba=()=>me;logic.ha=[me,{Ka:false,status:1}];
   layer.onReady=()=>{autoCalls.push('ready');me.status=1;logic.Fb=3;};
   logic.uo=()=>{autoCalls.push('leave');BkGlobal.Ja=sj;};
   const common={ic:{aN:[{wg:1,aj:2,tk:1,Rb:0,Wj:0,Yb:1}]},FJ:()=>{autoCalls.push('join');BkGlobal.Ja=V;logic.Fb=1;me.status=2;layer.Yc=0;layer.V=structuredClone(initialPieces);}};
   window.BkLogicManager={T:()=>common};
   __testRoot.getElementById('autoStart').click();__testRoot.getElementById('start').click();
 });
 await page.waitForFunction(()=>sent.length===1,null,{timeout:15000});
 await page.evaluate(()=>{logic.Fb=100;});
 await page.waitForFunction(()=>sent.length===2,null,{timeout:20000});
  assert.deepEqual(await page.evaluate(()=>autoCalls),['choose:7','join','ready','leave','join','ready']);
 await page.evaluate(()=>__testRoot.getElementById('stop').click());
 assert.equal(await page.evaluate(()=>__testRoot.getElementById('autoStart').disabled),true);
 assert.equal(await page.evaluate(()=>__testRoot.getElementById('start').disabled),false);
 await page.evaluate(()=>__testRoot.getElementById('start').click());
 await page.evaluate(()=>__testRoot.getElementById('autoStop').click());
 assert.equal(await page.evaluate(()=>__testRoot.getElementById('start').disabled),true);
 assert.equal(await page.evaluate(()=>__testRoot.getElementById('autoStart').disabled),false);
 await page.evaluate(()=>__testRoot.getElementById('autoStart').click());
 await page.evaluate(()=>{BkGlobal.ia=8;});await page.waitForTimeout(600);
 assert.match(await page.evaluate(()=>__testRoot.getElementById('status').textContent),/Cờ tướng/);
 const countAfterWrongGame=await page.evaluate(()=>autoCalls.length);await page.waitForTimeout(600);
 assert.equal(await page.evaluate(()=>autoCalls.length),countAfterWrongGame);
 await page.evaluate(()=>{
   BkGlobal.ia=K;BkGlobal.Ja=sj;autoHearts=0;window.adStarts=0;
   window.WebAdsManager={showRewardAdsOnWeb:()=>{adStarts++;}};
   __testRoot.getElementById('autoAds').checked=true;__testRoot.getElementById('autoStart').click();
 });
 await page.waitForFunction(()=>adStarts===1);await page.waitForTimeout(600);
 assert.equal(await page.evaluate(()=>adStarts),1);
 assert.match(await page.evaluate(()=>__testRoot.getElementById('autoStatus').textContent),/Chờ Ziga xác nhận tim/);
 await page.evaluate(()=>__testRoot.getElementById('stop').click());
  await page.reload();await page.waitForFunction(()=>!!window.__testRoot && !__testRoot.getElementById("start").disabled);
 const beforeForced=await worker.evaluate(()=>globalThis.testRequests);const forcedAt=Date.now();
 await page.evaluate(()=>{
   layer.V.forEach(p=>p.pa=true);
   for(const i of [0,16,21,22,27])layer.V[i].pa=false;
   Object.assign(layer.V[21],{fa:3,rowIndex:2});Object.assign(layer.V[22],{fa:5,rowIndex:2});Object.assign(layer.V[27],{fa:4,rowIndex:5});
   __testRoot.getElementById('start').click();
 });
 await page.waitForFunction(()=>sent.length===1,null,{timeout:3000});
 assert.deepEqual(await page.evaluate(()=>sent[0]),[4,0,4,1]);assert.ok(Date.now()-forcedAt>=700,'Forced move must include the stability check plus >=500ms delay');
 assert.equal(await worker.evaluate(()=>globalThis.testRequests),beforeForced);
  await page.reload();await page.waitForFunction(()=>!!window.__testRoot && !__testRoot.getElementById("start").disabled);
 await page.evaluate(()=>{
   window.idleCalls=[];window.me={Ka:false,status:1};window.sj=10;window.V=11;window.Q=12;
   window.GAME_STATE_READY=1;window.GAME_STATE_NOT_READY=0;window.GAME_STATE_FINISH=100;
   window.PLAYER_STATE_TABLE_OWNER=0;window.PLAYER_STATE_READY=1;window.PLAYER_STATE_NOT_READY=2;
   BkGlobal.Ja=V;BkGlobal.af=0;BkGlobal.vi=1;BkGlobal.P={pb:()=>5};
   logic.Fb=1;logic.Ke=1;logic.Ba=()=>me;logic.ha=[me];
   logic.uo=()=>{idleCalls.push('leave');BkGlobal.Ja=sj;};
   layer.onReady=()=>{idleCalls.push('ready');me.status=1;logic.Fb=3;};
   const tables=[1,2].map(wg=>({wg,aj:2,tk:1,Rb:0,Wj:0,Yb:1}));
   window.BkLogicManager={T:()=>({ic:{aN:tables},FJ:id=>{idleCalls.push('join:'+id);BkGlobal.vi=id;BkGlobal.Ja=V;me.status=2;logic.ha=[me,{Ka:false,status:1}];}})};
   __testRoot.getElementById('autoStart').click();__testRoot.getElementById('start').click();
 });
 await page.waitForTimeout(2400);assert.equal(await page.evaluate(()=>idleCalls.length),0);
 await page.waitForFunction(()=>sent.length===1,null,{timeout:15000});
 assert.deepEqual(await page.evaluate(()=>idleCalls),['leave','join:2','ready']);
  await worker.evaluate(()=>{
   const previous=globalThis.fetch;globalThis.drawScenario=null;globalThis.drawRequests=[];
   globalThis.fetch=async(url,options)=>{
     if(!globalThis.drawScenario||!String(url).endsWith('/analyze'))return previous(url,options);
     const scenario={...globalThis.drawScenario};globalThis.drawRequests.push(JSON.parse(options.body));
     await new Promise(r=>setTimeout(r,scenario.delay||0));
     return new Response(JSON.stringify({source:'engine',engine:'Pikafish test response',depth:scenario.depth??18,score:{type:scenario.type||'cp',value:scenario.cp,bound:false},move:{x:1,y:7,tx:4,ty:7}}),{status:200,headers:{'Content-Type':'application/json'}});
   };
 });
 async function prepareDraw(scenario,opponentTurn=false){
   await worker.evaluate(s=>{globalThis.drawScenario=s;globalThis.drawRequests=[];},scenario);
   await page.reload();await page.waitForFunction(()=>!!window.__testRoot && !__testRoot.getElementById("start").disabled);
   await page.evaluate(opponent=>{
     window.drawCalls=[];if(opponent)layer.Yc=1;
     const popup={la:{getString:()=> 'Đối phương muốn hòa.\n Bạn có đồng ý không?'},Vl:()=>drawCalls.push('accept'),Bp:()=>drawCalls.push('refuse'),hf(fn){this.Bp=fn;},removeSelf(){window.Fl=null;this.Bp?.();}};
     window.Fl=popup;__testRoot.getElementById('autoDrawReply').checked=true;__testRoot.getElementById('start').click();
   },opponentTurn);
 }
 for(const scenario of [{cp:0,expected:'accept'},{cp:200,expected:'refuse'},{cp:200,opponent:true,expected:'accept'},{cp:3,type:'mate',expected:'refuse'}]){
   await prepareDraw(scenario,scenario.opponent);
   await page.waitForFunction(()=>drawCalls.length===1);
   assert.deepEqual(await page.evaluate(()=>drawCalls),[scenario.expected]);
   const request=await worker.evaluate(()=>globalThis.drawRequests[0]);assert.equal(request.bookMoves,0);assert.equal(request.depth,0);
   await page.evaluate(()=>__testRoot.getElementById('stop').click());
 }
 await prepareDraw({cp:0,depth:3});await page.waitForFunction(()=>__testRoot.getElementById('status').textContent.includes('thủ công'));
 assert.equal(await page.evaluate(()=>drawCalls.length),0);assert.ok(await page.evaluate(()=>!!window.Fl));
 await prepareDraw({cp:0,delay:800});await page.waitForFunction(()=>__testRoot.getElementById('status').textContent.includes('Đang tính lại'));
 await page.evaluate(()=>__testRoot.getElementById('stop').click());await page.waitForTimeout(1100);assert.equal(await page.evaluate(()=>drawCalls.length),0);
 await prepareDraw({cp:0,delay:800});await page.waitForFunction(()=>__testRoot.getElementById('status').textContent.includes('Đang tính lại'));
 await page.evaluate(()=>{window.Fl=null;layer.Yc=1;});await page.waitForTimeout(1100);assert.equal(await page.evaluate(()=>drawCalls.length),0);
  await worker.evaluate(()=>{globalThis.drawScenario=null;globalThis.lastPonder=null;});
 await page.reload();await page.waitForFunction(()=>!!window.__testRoot && !__testRoot.getElementById("start").disabled);
 await page.evaluate(()=>{__testRoot.getElementById('book').value='0';__testRoot.getElementById('threads').value='1';__testRoot.getElementById('depth').value='14';__testRoot.getElementById('time').value='1200';__testRoot.getElementById('start').click();});
 await page.waitForFunction(()=>sent.length===1,null,{timeout:10000});
 let prediction;
 for(let i=0;i<100;i++){prediction=await worker.evaluate(()=>globalThis.lastPonder?.predictedMove);if(prediction)break;await page.waitForTimeout(50);}
 assert.match(prediction,/^[a-i][0-9][a-i][0-9]$/);await page.waitForTimeout(500);
 const responseAt=Date.now();
 await page.evaluate(uci=>{const x=uci.charCodeAt(0)-97,y=Number(uci[1]),tx=uci.charCodeAt(2)-97,ty=Number(uci[3]);const p=layer.V.find(p=>!p.pa&&p.fa===x&&p.rowIndex===y);if(!p)throw Error('Missing predicted opponent piece');const captured=layer.V.find(p=>!p.pa&&p.fa===tx&&p.rowIndex===ty);if(captured)captured.pa=true;p.fa=tx;p.rowIndex=ty;layer.Yc=0;},prediction);
 await page.waitForFunction(()=>sent.length===2,null,{timeout:5000});
 assert.match(await page.evaluate(()=>__testRoot.getElementById('detail').textContent),/trúng nhánh tính trước/);
 console.log('PONDER HIT RESPONSE MS',Date.now()-responseAt);
 await page.evaluate(()=>__testRoot.getElementById('stop').click());
  await page.reload();await page.waitForFunction(()=>!!window.__testRoot && !__testRoot.getElementById("start").disabled);
 await page.evaluate(()=>{
   const canvas=document.createElement('canvas');canvas.width=900;canvas.height=600;canvas.style.cssText='position:fixed;left:0;top:0;width:900px;height:600px';document.body.prepend(canvas);
   window.sj=10;window.V=11;window.Q=12;window.GAME_STATE_PLAYING=2;window.GAME_STATE_FINISH=100;
   const player={Ka:false,status:1};logic.Fb=2;logic.Ba=()=>player;logic.ha=[player,{Ka:false,status:1}];
   window.BkLogicManager={T:()=>({})};Object.assign(BkGlobal,{Ja:V,af:0,vi:1,Tg:true,P:{pb:()=>5}});
   __testRoot.getElementById('autoStart').click();__testRoot.getElementById('start').click();
 });
 await page.waitForFunction(()=>sent.length===1,null,{timeout:10000});
 assert.equal(await page.evaluate(()=>BkGlobal.Tg),false);
 await page.evaluate(()=>__testRoot.getElementById('stop').click());
  const savedChoices={time:'2500',book:'3',depth:'18',threads:'4',ponder:false,autoDrawReply:true,autoDrawOffer:true,maxHearts:'7',autoAds:true,maxAds:'2',minimized:true};
 await page.evaluate(values=>{for(const [key,value]of Object.entries(values)){const el=__testRoot.getElementById(key);if(typeof value==='boolean')el.checked=value;else el.value=value;el.dispatchEvent(new Event('change'));}},savedChoices);
 for(let i=0;i<100;i++){const stored=await worker.evaluate(()=>chrome.storage.local.get(null));if(stored['menu.maxAds']==='2'&&stored['menu.minimized']===true)break;await page.waitForTimeout(30);}
 const originalScript=await page.locator('body > script').first().textContent();
 await page.reload();await page.waitForFunction(()=>!!window.__testRoot && !__testRoot.getElementById('start').disabled);
 const restored=await page.evaluate(keys=>Object.fromEntries(keys.map(k=>{const el=__testRoot.getElementById(k);return [k,el.type==='checkbox'?el.checked:el.value];})),Object.keys(savedChoices));
 assert.deepEqual(restored,savedChoices);assert.equal(await page.evaluate(()=>__testRoot.getElementById('menuBody').hidden),true);assert.equal(await page.evaluate(()=>__testRoot.getElementById('stop').disabled),true);assert.equal(await page.evaluate(()=>__testRoot.getElementById('autoStop').disabled),true);
 await context.close();
 context=await chromium.launchPersistentContext(profile,{channel:'msedge',headless:true,args:[`--disable-extensions-except=${extension}`,`--load-extension=${extension}`]});
 await context.addInitScript(()=>{const original=Element.prototype.attachShadow;Element.prototype.attachShadow=function(o){const r=original.call(this,o);if(this.id==='ziga-xq-experiment')window.__testRoot=r;return r;};});
 const reopened=await context.newPage();await reopened.route('https://zigavn.com/**',r=>r.fulfill({contentType:'text/html',body:'<html><body><script>'+originalScript+'</script></body></html>'}));
 await reopened.goto('https://zigavn.com/');await reopened.waitForFunction(()=>!!window.__testRoot && !__testRoot.getElementById('start').disabled);
 const afterRestart=await reopened.evaluate(keys=>Object.fromEntries(keys.map(k=>{const el=__testRoot.getElementById(k);return [k,el.type==='checkbox'?el.checked:el.value];})),Object.keys(savedChoices));
 assert.deepEqual(afterRestart,savedChoices);assert.equal(await reopened.evaluate(()=>__testRoot.getElementById('menuBody').hidden),true);await reopened.evaluate(()=>__testRoot.getElementById('minimize').click());assert.equal(await reopened.evaluate(()=>__testRoot.getElementById('menuBody').hidden),false);assert.equal(await reopened.evaluate(()=>sent.length),0);assert.equal(await reopened.evaluate(()=>__testRoot.getElementById('autoStop').disabled),true);
 console.log('PASS: all previous flows plus all menu choices restored after reload AND browser restart; bot remains off');
 }finally{await context?.close();if(server)await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1;});
