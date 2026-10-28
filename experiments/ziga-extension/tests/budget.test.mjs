import test from 'node:test';
import assert from 'node:assert/strict';
import {budgetTimeouts} from '../engine-budget.mjs';
import {validPreferences} from '../src/preferences.js';
import {checkBridgeVersion} from '../src/bridge-status.js';
test('20/30/50 second budgets persist and get a bridge/client timeout longer than the search',()=>{
 for(const ms of [20000,30000,50000]){
  assert.equal(validPreferences({time:String(ms)}).time,String(ms));
  const timeout=budgetTimeouts(ms);assert.ok(timeout.bridgeMs>ms+8000);assert.ok(timeout.clientMs>timeout.bridgeMs);
  assert.throws(()=>checkBridgeVersion({ok:true,version:'0.6.0'},ms),/bản cũ/);
  assert.equal(checkBridgeVersion({ok:true,version:'0.7.0',maxMovetimeMs:50000},ms),true);
 }
 assert.equal(budgetTimeouts(10000).clientMs,22000);
});
