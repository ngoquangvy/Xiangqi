let playwright;
try { playwright = require('playwright'); }
catch { playwright = require(require('node:path').join(require('node:os').homedir(), '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright')); }
const {chromium}=playwright;
const readline=require('node:readline');
(async()=>{
 const browser=await chromium.launch({channel:'chrome',headless:false,args:['--autoplay-policy=no-user-gesture-required']});
 const context=await browser.newContext({viewport:{width:1400,height:950}});
 const page=await context.newPage();
 page.on('pageerror',e=>console.log('PAGEERROR',e.message));
 await page.goto('https://zigavn.com/',{waitUntil:'domcontentloaded'});
 await page.waitForTimeout(7000);
 await page.addScriptTag({path:'extension/main.js'});
 await page.screenshot({path:'test-results/01-loaded.png'});
 console.log('READY',await page.title(),await page.locator('body').innerText());
 const rl=readline.createInterface({input:process.stdin});
 for await(const line of rl){try{const cmd=JSON.parse(line);if(cmd.close){await browser.close();break;}if(cmd.eval)console.log('RESULT',JSON.stringify(await page.evaluate(cmd.eval)));if(cmd.click)await page.mouse.click(...cmd.click);if(cmd.wait)await page.waitForTimeout(cmd.wait);if(cmd.shot){await page.screenshot({path:'test-results/'+cmd.shot});console.log('SHOT',cmd.shot);}}catch(e){console.log('ERROR',e.message);}}
})().catch(e=>{console.error(e);process.exit(1)});
