import test from 'node:test';
import assert from 'node:assert/strict';
import {checkBridgeVersion,bridgeErrorMessage} from '../src/bridge-status.js';
test('legacy bridge without version or with old version is rejected before searching',()=>{
  for(const health of [{ok:true},{ok:true,version:'0.5.0'},{ok:false,version:'0.6.0'}])assert.throws(()=>checkBridgeVersion(health),/bản cũ/);
  assert.equal(checkBridgeVersion({ok:true,version:'0.6.0'}),true);
});
test('movetime/version errors are not misreported as a missing engine process',()=>{
  assert.match(bridgeErrorMessage(Error('Invalid movetime (100–5000 ms)')),/bản cũ/);
  assert.match(bridgeErrorMessage(Error('Failed to fetch')),/17864/);
  assert.equal(bridgeErrorMessage(Error('Invalid FEN')),'Invalid FEN');
});

test('extended book requests require bridge capability before searching',()=>{
 assert.throws(()=>checkBridgeVersion({ok:true,version:'0.7.0',maxMovetimeMs:50000},1200,10),/book tối đa 5/);
 assert.equal(checkBridgeVersion({ok:true,version:'0.8.0',maxMovetimeMs:50000,maxBookMoves:10},1200,10),true);
});
