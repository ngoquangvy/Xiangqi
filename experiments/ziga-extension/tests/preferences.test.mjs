import test from 'node:test';
import assert from 'node:assert/strict';
import {defaults,preferenceKeys,validPreferences,bindPreferences} from '../src/preferences.js';
function root(){
  const elements={settingsStatus:{textContent:''}};
  for(const key of preferenceKeys){const listeners={};elements[key]={value:String(defaults[key]),checked:defaults[key],type:['depth','threads','maxHearts','maxAds'].includes(key)?'number':'checkbox',addEventListener:(event,fn)=>{(listeners[event]??=[]).push(fn);},emit:event=>listeners[event]?.forEach(fn=>fn())};}
  return {getElementById:key=>elements[key],elements};
}
test('preferences validate range/type and never persist bot run flags',()=>{
  assert.deepEqual(validPreferences({threads:4,depth:'18',ponder:false,time:'auto',book:'3',enabled:true,continuous:true}),{threads:'4',depth:'18',ponder:false,time:'auto',book:'3'});
  assert.deepEqual(validPreferences({depth:'999',threads:'0',maxAds:'11',time:'9',autoAds:'true',book:'2'}),{});
  assert.deepEqual(validPreferences(null),{});assert.deepEqual(validPreferences([]),{});
});
test('restore all choices, including false checkbox values, without firing user events',async()=>{
  const r=root(),writes=[];r.elements.ponder.checked=true;
  const binding=bindPreferences(r,{load:async()=>({ponder:false,time:'2500',threads:'4',autoAds:true}),save:async p=>writes.push(p)});
  await binding.ready;assert.equal(r.elements.ponder.checked,false);assert.equal(r.elements.time.value,'2500');assert.equal(r.elements.threads.value,'4');assert.equal(r.elements.autoAds.checked,true);assert.equal(writes.length,0);
});
test('late load cannot overwrite a user edit; writes preserve order and reject invalid input',async()=>{
  const r=root(),writes=[];let loaded;
  const binding=bindPreferences(r,{load:()=>new Promise(resolve=>loaded=resolve),save:async p=>writes.push(p)});
  await Promise.resolve();r.elements.threads.value='4';r.elements.threads.emit('input');await binding.flush();loaded({threads:'16',book:'3'});await binding.ready;
  assert.equal(r.elements.threads.value,'4');assert.equal(r.elements.book.value,'3');
  r.elements.threads.value='';r.elements.threads.emit('input');r.elements.depth.value='12';r.elements.depth.emit('input');await binding.flush();
  assert.deepEqual(writes,[{threads:'4'},{depth:'12'}]);
});
test('storage error is visible and a later edit can save successfully',async()=>{
  const r=root();let fail=true;const binding=bindPreferences(r,{load:async()=>{throw Error('offline');},save:async()=>{if(fail)throw Error('failed');}});
  await binding.ready;assert.match(r.elements.settingsStatus.textContent,/Không đọc/);
  r.elements.threads.value='3';r.elements.threads.emit('change');await binding.flush();assert.match(r.elements.settingsStatus.textContent,/Không lưu/);
  fail=false;r.elements.threads.value='4';r.elements.threads.emit('change');await binding.flush();assert.match(r.elements.settingsStatus.textContent,/Đã lưu/);
});
