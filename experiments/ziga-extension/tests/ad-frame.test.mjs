import test from 'node:test';
import assert from 'node:assert/strict';
import {AdFrameGate} from '../src/ad-frame-gate.js';
import {closeFrameAd,videoFinished} from '../src/ad-frame.js';
const top={tab:{id:1},frameId:0,url:'https://zigavn.com/'};
const frame={tab:{id:1},frameId:2,url:'https://googleads.g.doubleclick.net/ad'};
test('ad frame gate requires Ziga top-frame lease, same tab, permitted host and current ad ID',()=>{
 const g=new AdFrameGate(2000),poll={kind:'ad-frame-poll',adId:'a',videoEnded:true};
 assert.equal(g.message(poll,frame,0).allowed,false);
 assert.equal(g.message({kind:'ad-watch',active:true,adId:'a'},frame,0).allowed,false);
 g.message({kind:'ad-watch',active:true,adId:'a'},top,0);
 assert.equal(g.message(poll,{...frame,tab:{id:2}},0).allowed,false);
 assert.equal(g.message(poll,{...frame,url:'https://evil-doubleclick.net/ad'},0).allowed,false);
 assert.equal(g.message({...poll,adId:'old'},frame,0).completed,false);
 assert.equal(g.message(poll,frame,0).completed,true);
 g.message({kind:'ad-watch',active:true,adId:'b'},top,1);
 assert.equal(g.message(poll,frame,1).completed,false);
 assert.equal(g.message(poll,frame,2002).allowed,false);
});
test('turning off the top-frame lease immediately disables ad frame access',()=>{
 const g=new AdFrameGate(2000);g.message({kind:'ad-watch',active:true,adId:'a',completed:true},top,0);
 assert.equal(g.message({kind:'ad-frame-poll'},frame,1).completed,true);
 g.message({kind:'ad-watch',active:false},top,2);
 assert.equal(g.message({kind:'ad-frame-poll'},frame,2).allowed,false);
});
test('only ended video and a visible enabled unobscured terminal Close can be used once',()=>{
 let clicks=0;const button={disabled:false,textContent:'Đóng',getAttribute:()=>null,getBoundingClientRect:()=>({left:0,top:0,width:25,height:25}),contains:()=>false,click:()=>clicks++};
 const video={ended:false,duration:30};
 const doc={visibilityState:'visible',querySelectorAll:s=>s==='video'?[video]:[button],elementFromPoint:()=>button};
 const w={document:doc,getComputedStyle:()=>({})},clicked=new WeakSet();
 assert.equal(videoFinished(doc),false);assert.equal(closeFrameAd(w,false,clicked),false);
 video.ended=true;assert.equal(videoFinished(doc),true);
 button.disabled=true;assert.equal(closeFrameAd(w,true,clicked),false);
 button.disabled=false;button.textContent='Close in 5';assert.equal(closeFrameAd(w,true,clicked),false);
 button.textContent='Skip';assert.equal(closeFrameAd(w,true,clicked),false);
 button.textContent='Đóng';assert.equal(closeFrameAd(w,true,clicked),true);assert.equal(closeFrameAd(w,true,clicked),false);assert.equal(clicks,1);
});

test('inherited about:blank ad frame uses browser-provided origin, while mixed unfinished video prevents early close',()=>{
 const g=new AdFrameGate(2000);g.message({kind:'ad-watch',active:true,adId:'a'},top,0);
 assert.equal(g.message({kind:'ad-frame-poll'}, {...frame,url:'about:blank',origin:'https://tpc.googlesyndication.com'},1).allowed,true);
 assert.equal(g.message({kind:'ad-frame-poll'}, {...frame,url:'about:blank',origin:'https://unrelated.example'},1).allowed,false);
 assert.equal(videoFinished({querySelectorAll:()=>[{duration:5,ended:true},{duration:30,ended:false}]}),false);
});

test('hidden countdown and SVG source do not block a visibly ready Close button',()=>{
 let clicks=0;const button={disabled:false,innerText:'Close',textContent:'Close in 5 .st0{opacity:1}',getAttribute:()=>null,getBoundingClientRect:()=>({left:0,top:0,width:20,height:20}),contains:()=>false,click:()=>clicks++};
 const doc={visibilityState:'visible',querySelectorAll:s=>s==='*'?[]:[button],elementFromPoint:()=>button};
 assert.equal(closeFrameAd({document:doc,getComputedStyle:()=>({})},true),true);assert.equal(clicks,1);
 button.innerText='Close in 5';assert.equal(closeFrameAd({document:doc,getComputedStyle:()=>({})},true),false);
});

test('Close inside open shadow DOM is found and hit-tested within its own root',()=>{
 let clicks=0;const button={disabled:false,innerText:'Close',getAttribute:()=>null,getBoundingClientRect:()=>({left:0,top:0,width:20,height:20}),contains:()=>false,click:()=>clicks++};
 const root={querySelectorAll:s=>s==='*'?[]:[button],elementFromPoint:()=>button};
 const doc={visibilityState:'visible',querySelectorAll:s=>s==='*'?[{shadowRoot:root}]:[],elementFromPoint:()=>({})};
 assert.equal(closeFrameAd({document:doc,getComputedStyle:()=>({})},true),true);assert.equal(clicks,1);
});

test('diagnostic survives ad close and preserves successful click despite later false reports',()=>{
 const g=new AdFrameGate(2000);
 g.message({kind:'ad-watch',active:true,adId:'a'},top,0);
 g.message({kind:'ad-frame-report',adId:'a',candidates:1,clicked:true},frame,1);
 for(let i=2;i<40;i++)g.message({kind:'ad-frame-report',adId:'a',candidates:1,clicked:false},frame,i);
 g.message({kind:'ad-watch',active:false},top,40);
 assert.equal(g.tabs.has(1),false);
 assert.equal(g.diagnostic(1).events.some(e=>e.clicked===true&&e.candidates===1),true);
 assert.ok(g.diagnostic(1).events.length<=20);
});

test('structural diagnostics retain child frame hosts and control labels after manual close',()=>{
 const g=new AdFrameGate(2000);
 g.message({kind:'ad-watch',active:true,adId:'a',surface:{frames:[{host:'ads.example.org',visible:true}],controls:['Đóng'],videos:0}},top,0);
 g.message({kind:'ad-frame-report',adId:'a',candidates:0,clicked:false,surface:{frames:[{host:'other.example.org',visible:true}],controls:['Close video'],videos:1}},frame,1);
 g.message({kind:'ad-watch',active:false},top,2);
 const surfaces=g.diagnostic(1).surfaces;assert.equal(surfaces.length,2);
 assert.equal(surfaces[0].frames[0].host,'ads.example.org');assert.deepEqual(surfaces[1].controls,['Close video']);
});

test('guarded Google close probes share one cooldown, require native guard, and stop at cap',()=>{
 const g=new AdFrameGate(2000,{probeAfterMs:1000,probeRetryMs:1000,probeMax:2});
 const watch=n=>g.message({kind:'ad-watch',active:true,adId:'a'},top,n);
 const probe=(n,hasGuard=true)=>g.message({kind:'ad-close-probe',adId:'a',hasGuard},frame,n);
 watch(0);assert.equal(probe(999).allowed,false);assert.equal(probe(1000,false).allowed,false);
 assert.equal(probe(1000).allowed,true);watch(1500);assert.equal(probe(1999).allowed,false);
 assert.equal(probe(2000).allowed,true);watch(3000);assert.equal(probe(3000).allowed,false);
});

test('Google close chooses the inner event target rather than repeatedly clicking its wrapper',()=>{
 let innerClicks=0,outerClicks=0;
 const base={disabled:false,innerText:'Đóng',getAttribute:()=>null,getBoundingClientRect:()=>({left:0,top:0,width:20,height:20}),contains:()=>true};
 const inner={...base,id:'dismiss-button-element',click:()=>innerClicks++};
 const outer={...base,id:'dismiss-button',click:()=>outerClicks++};
 const doc={visibilityState:'visible',querySelectorAll:s=>s==='*'?[]:s==='#close-confirmation-dialog'?[]:[outer,inner],elementFromPoint:()=>inner};
 assert.equal(closeFrameAd({document:doc,getComputedStyle:()=>({})},true,new WeakSet(),{googleOnly:true}),true);
 assert.equal(innerClicks,1);assert.equal(outerClicks,0);
});

test('a delayed heartbeat suspends frame access without resetting the same ad close timer',()=>{
 const g=new AdFrameGate(200,{probeAfterMs:1000,probeRetryMs:1000,probeMax:2});
 g.message({kind:'ad-watch',active:true,adId:'a'},top,0);
 assert.equal(g.message({kind:'ad-frame-poll',adId:'a'},frame,500).allowed,false);
 g.message({kind:'ad-watch',active:true,adId:'a'},top,1500);
 assert.equal(g.message({kind:'ad-close-probe',adId:'a',hasGuard:true},frame,1501).allowed,true);
 g.message({kind:'ad-watch',active:false},top,1502);
 assert.equal(g.message({kind:'ad-close-probe',adId:'a',hasGuard:true},frame,1503).allowed,false);
});
