let playwright;
try {playwright=require('playwright');}catch {playwright=require(require('node:path').join(require('node:os').homedir(),'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));}
const {chromium}=playwright,assert=require('node:assert/strict'),path=require('node:path'),fs=require('node:fs'),os=require('node:os');
(async()=>{
 const extension=path.resolve('extension'),profile=fs.mkdtempSync(path.join(os.tmpdir(),'ziga-ad-frame-'));
 const context=await chromium.launchPersistentContext(profile,{channel:'msedge',headless:true,args:[`--disable-extensions-except=${extension}`,`--load-extension=${extension}`]});
 try{
  await context.addInitScript(()=>{const original=Element.prototype.attachShadow;Element.prototype.attachShadow=function(o){const r=original.call(this,o);if(this.id==='ziga-xq-experiment')window.__testRoot=r;return r;};});
  await context.route('https://googleads.g.doubleclick.net/**',r=>r.fulfill({contentType:'text/html',body:`<html><body><video></video><button id="dismiss-button" disabled style="position:fixed;top:20px;left:20px;width:100px;height:40px">Close<span style="display:none">Close in 5</span><svg style="display:none"><style>.st0{opacity:1}</style></svg></button><script>document.querySelector('button').onclick=()=>parent.postMessage('ad-closed','*');</script></body></html>`}));
  const html=`<html><body><iframe style="width:600px;height:400px" src="https://googleads.g.doubleclick.net/ad"></iframe><script>window.closes=0;addEventListener('message',e=>{if(e.data==='ad-closed'&&e.origin==='https://googleads.g.doubleclick.net'){closes++;document.querySelector('iframe').remove();}});</script></body></html>`;
  await context.route('https://zigavn.com/**',r=>r.fulfill({contentType:'text/html',body:html}));
  await context.route('https://example.org/**',r=>r.fulfill({contentType:'text/html',body:html}));
  const page=await context.newPage();await page.goto('https://zigavn.com/');
  await page.waitForTimeout(500);const frame=page.frames().find(f=>f.url().includes('doubleclick.net'));
  await frame.waitForSelector('#dismiss-button');
  assert.equal(await page.evaluate(()=>{try{return document.querySelector('iframe').contentDocument===null;}catch{return true;}}),true);
  await frame.evaluate(()=>document.querySelector('button').disabled=false);
  await page.waitForTimeout(1000);assert.equal(await page.evaluate(()=>closes),0);
  await page.evaluate(()=>{window.lease=setInterval(()=>postMessage({channel:'ziga-ad-watch',active:true,completed:false,adId:'test-ad'},location.origin),200);});
  await page.waitForTimeout(1200);assert.equal(await page.evaluate(()=>closes),0);
  await frame.evaluate(()=>{document.querySelector('button').disabled=true;const video=document.querySelector('video');video.muted=true;video.addEventListener('ended',()=>video.remove(),{once:true});video.src='data:video/webm;base64,GkXfo59ChoEBQveBAULygQRC84EIQoKEd2VibUKHgQJChYECGFOAZwEAAAAAAAIYEU2bdLpNu4tTq4QVSalmU6yBoU27i1OrhBZUrmtTrIHYTbuMU6uEElTDZ1OsggElTbuMU6uEHFO7a1OsggIC7AEAAAAAAABZAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAVSalmsirXsYMPQkBNgI1MYXZmNjIuMTMuMTAxV0GNTGF2ZjYyLjEzLjEwMUSJiEBywAAAAAAAFlSua8iuAQAAAAAAAD/XgQFzxYgkft6weOzPfZyBACK1nIN1bmSIgQCGhVZfVlA4g4EBI+ODhAX14QDgkLCBILqBIJqBAlWwhFW5gQESVMNn/HNzoGPAgGfImkWjh0VOQ09ERVJEh41MYXZmNjIuMTMuMTAxc3PWY8CLY8WIJH7esHjsz31nyKFFo4dFTkNPREVSRIeUTGF2YzYyLjI5LjEwMSBsaWJ2cHhnyKFFo4hEVVJBVElPTkSHkzAwOjAwOjAwLjMwMDAwMDAwMAAfQ7Z11+eBAKOkgQAAgDACAJ0BKiAAIAAARwiFhYiFhIgCAgAHkPPJwP7/q1CAo5WBAGQAsQEABRCsABgAGFgv9AAIcACjlYEAyACxAQAFEKwAGAAYWC/0AAhwABxTu2uRu4+zgQC3iveBAfGCAabwgQM=';void video.play();});
  await page.waitForTimeout(1200);assert.equal(await page.evaluate(()=>closes),0);
  await frame.evaluate(()=>document.querySelector('button').disabled=false);
  await page.waitForFunction(()=>closes===1,null,{timeout:5000});await page.evaluate(()=>clearInterval(lease));
  const other=await context.newPage();await other.goto('https://example.org/');
  await other.waitForTimeout(500);const otherFrame=other.frames().find(f=>f.url().includes('doubleclick.net'));
  await otherFrame.evaluate(()=>{const video=document.querySelector('video');video.muted=true;video.addEventListener('ended',()=>video.remove(),{once:true});video.src='data:video/webm;base64,GkXfo59ChoEBQveBAULygQRC84EIQoKEd2VibUKHgQJChYECGFOAZwEAAAAAAAIYEU2bdLpNu4tTq4QVSalmU6yBoU27i1OrhBZUrmtTrIHYTbuMU6uEElTDZ1OsggElTbuMU6uEHFO7a1OsggIC7AEAAAAAAABZAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAVSalmsirXsYMPQkBNgI1MYXZmNjIuMTMuMTAxV0GNTGF2ZjYyLjEzLjEwMUSJiEBywAAAAAAAFlSua8iuAQAAAAAAAD/XgQFzxYgkft6weOzPfZyBACK1nIN1bmSIgQCGhVZfVlA4g4EBI+ODhAX14QDgkLCBILqBIJqBAlWwhFW5gQESVMNn/HNzoGPAgGfImkWjh0VOQ09ERVJEh41MYXZmNjIuMTMuMTAxc3PWY8CLY8WIJH7esHjsz31nyKFFo4dFTkNPREVSRIeUTGF2YzYyLjI5LjEwMSBsaWJ2cHhnyKFFo4hEVVJBVElPTkSHkzAwOjAwOjAwLjMwMDAwMDAwMAAfQ7Z11+eBAKOkgQAAgDACAJ0BKiAAIAAARwiFhYiFhIgCAgAHkPPJwP7/q1CAo5WBAGQAsQEABRCsABgAGFgv9AAIcACjlYEAyACxAQAFEKwAGAAYWC/0AAhwABxTu2uRu4+zgQC3iveBAfGCAabwgQM=';void video.play();document.querySelector('button').disabled=false;});
  await other.waitForTimeout(1500);assert.equal(await other.evaluate(()=>closes),0);
  await page.bringToFront();
  await page.waitForFunction(()=>!!window.__testRoot&&!__testRoot.getElementById('testAd').disabled);
  const choices=await page.evaluate(()=>Array.from(__testRoot.getElementById('book').options).map(o=>o.value));
  for(const n of ['6','7','8','9','10'])assert.ok(choices.includes(n));
  await page.evaluate(()=>{const b=__testRoot.getElementById('book');b.value='10';b.dispatchEvent(new Event('change'));});
  const worker=context.serviceWorkers()[0]||await context.waitForEvent('serviceworker');
  for(let i=0;i<40;i++){if((await worker.evaluate(()=>chrome.storage.local.get('menu.book')))['menu.book']==='10')break;await page.waitForTimeout(50);}
  assert.equal(await page.evaluate(()=>__testRoot.getElementById('adTestTools').open),false);
  await page.evaluate(()=>__testRoot.getElementById('adTestToggle').click());
  assert.equal(await page.evaluate(()=>__testRoot.getElementById('adTestTools').open),true);
  await page.evaluate(()=>{
    window.K=7;window.sj=2;window.V=3;window.Q=1;window.testHearts=10;window.adRequests=0;window.joined=0;window.rewardClosed=0;
    window.BkGlobal={ia:7,Ja:2,P:{pb:()=>testHearts}};
    window.BkLogicManager={T:()=>({FJ:()=>joined++})};
    window.WebAdsManager={showRewardAdsOnWeb:()=>adRequests++};
    window.BkBonusHeartWindow=class {constructor(){this.lA=1;} removeSelf(){rewardClosed++;window.Fl=null;}};
    __testRoot.getElementById('testAd').click();__testRoot.getElementById('testAd').click();
  });
  assert.equal(await page.evaluate(()=>adRequests),1);
  await page.evaluate(()=>__testRoot.getElementById('adTestToggle').click());
  assert.equal(await page.evaluate(()=>__testRoot.getElementById('adTestTools').open),false);
  assert.equal(await page.evaluate(()=>__testRoot.getElementById('testAd').disabled),true);
  await page.evaluate(()=>__testRoot.getElementById('adTestToggle').click());
  await page.waitForFunction(()=>__testRoot.getElementById('adTestStatus').textContent.includes('Chờ Ziga'));
  await page.evaluate(()=>{testHearts=11;window.Fl=new BkBonusHeartWindow();});
  await page.waitForFunction(()=>rewardClosed===1);
  assert.equal(await page.evaluate(()=>joined),0);assert.equal(await page.evaluate(()=>adRequests),1);
  assert.equal(await page.evaluate(()=>__testRoot.getElementById('stop').disabled),true);
  assert.equal(await page.evaluate(()=>__testRoot.getElementById('autoStop').disabled),true);
  await page.evaluate(()=>__testRoot.getElementById('adDiagnostic').click());
  await page.waitForFunction(()=>__testRoot.getElementById('adDiagnosticText').value.includes('đã bấm: có'));
  await page.reload();await page.waitForFunction(()=>!!window.__testRoot&&!__testRoot.getElementById('adDiagnostic').disabled);
  assert.equal(await page.evaluate(()=>__testRoot.getElementById('book').value),'10');
  assert.equal(await page.evaluate(()=>__testRoot.getElementById('adTestTools').open),false);
  await page.evaluate(()=>__testRoot.getElementById('adTestToggle').click());
  await page.evaluate(()=>__testRoot.getElementById('adDiagnostic').click());
  await page.waitForFunction(()=>__testRoot.getElementById('adDiagnosticText').value.includes('đã bấm: có'));
  await context.close();
  const reopenedContext=await chromium.launchPersistentContext(profile,{channel:'msedge',headless:true,args:[`--disable-extensions-except=${extension}`,`--load-extension=${extension}`]});
  try{
    await reopenedContext.addInitScript(()=>{const original=Element.prototype.attachShadow;Element.prototype.attachShadow=function(o){const r=original.call(this,o);if(this.id==='ziga-xq-experiment')window.__testRoot=r;return r;};});
    await reopenedContext.route('https://zigavn.com/**',r=>r.fulfill({contentType:'text/html',body:'<html><body>Menu restore fixture</body></html>'}));
    const restoredPage=await reopenedContext.newPage();await restoredPage.goto('https://zigavn.com/');
    await restoredPage.waitForFunction(()=>!!window.__testRoot&&!__testRoot.getElementById('adDiagnostic').disabled);
    assert.equal(await restoredPage.evaluate(()=>__testRoot.getElementById('book').value),'10');
  }finally{await reopenedContext.close();}
  console.log('BOOK PASS: options 6–10 exist; book 10 persists after page reload and full browser restart.');
  console.log('PASS: real cross-origin extension frame closes after video ends and is removed, ignores hidden countdown/SVG and waits until Close is enabled; unrelated tab stays untouched. Manual test button works with 10 hearts, closes reward popup and never joins a table. Close diagnostics remain readable after manual close and page reload.');
 } finally {await context.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
