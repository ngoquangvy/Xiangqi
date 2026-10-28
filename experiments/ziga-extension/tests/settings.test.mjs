import test from 'node:test';
import assert from 'node:assert/strict';
import {settings,validateSettings} from '../settings.mjs';
const copy=()=>JSON.parse(JSON.stringify(settings));
test('shared timing settings validate and reject conflicting or unsafe manual edits',()=>{
  assert.equal(validateSettings(copy()).draw.maxOffers,2);
  for(const change of [s=>s.move.minDelayMs=0,s=>s.session.readyMaxMs=1,s=>s.draw.maxOffers=3,s=>s.draw.minOwnTurnsBetweenOffers=0,s=>s.engine.clientTimeoutMs=1,s=>s.move.complexSearchMs=50001,s=>s.cpu.sampleMs='2000',s=>delete s.ads.timeoutMs]){
    const s=copy();change(s);assert.throws(()=>validateSettings(s),/settings.json/);
  }
});
