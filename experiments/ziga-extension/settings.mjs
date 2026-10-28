import values from './settings.json' with {type:'json'};
// Configurations saved before iframe support do not contain these new keys.
if(values.ads)values.ads={framePollMs:500,frameLeaseMs:2000,googleCloseProbeAfterMs:15000,googleCloseRetryMs:10000,googleCloseMaxProbes:8,...values.ads};
const required={"session":["idleTableMs","readyMinMs","readyMaxMs","actionConfirmMs","transitionMs","tableSyncMs","finishedLeaveMs","rewardResumeMs","rewardPopupWindowMs"],"move":["minDelayMs","quickMaxMs","bookMinMs","bookMaxMs","maxDelayMs","confirmMs","stableMs","ponderStableMs","pollMs","smallSearchMs","mediumSearchMs","complexSearchMs"],"draw":["maxOffers","minOwnTurnsBetweenOffers","offerCooldownMs","replySearchMs","acceptWaitMs"],"ads":["timeoutMs","loadTimeoutMs","clearMs","exposedRecoveryMs","framePollMs","frameLeaseMs","googleCloseProbeAfterMs","googleCloseRetryMs","googleCloseMaxProbes"],"engine":["ponderRequestIntervalMs","ponderBurstMs","ponderRestMs","ponderSeedMs","stopTimeoutMs","handshakeMs","searchGraceMs","httpTimeoutMs","clientTimeoutMs","healthCacheMs","legacyTimeoutMs","stableSearchMinMs","stableSearchMaxMs"],"cpu":["sampleMs","highForMs","reduceIntervalMs","ponderPauseMs","lowForMs","recoverIntervalMs","limitedSearchMs"],"fallbackDelay":["quickSearchThresholdMs","quickMaxMs","advantageMinMs","advantageMaxMs","complexMinMs","baseMinMs","baseMs","perChoiceMs","perDepthMs","maxMs"]};
// Parsed as data by Node and bundled by esbuild; no eval or environment secrets.
export function validateSettings(s){
  for(const [section,entries] of Object.entries(required)){
    for(const key of entries){
      const value=s?.[section]?.[key];
      if(!Number.isSafeInteger(value)||value<0||value>3600000)throw Error(`settings.json: ${section}.${key} must be an integer from 0 to 3600000`);
    }
  }
  const check=(ok,message)=>{if(!ok)throw Error('settings.json: '+message);};
  check(s.ads.googleCloseProbeAfterMs>=1000&&s.ads.googleCloseRetryMs>=1000&&s.ads.googleCloseMaxProbes<=10,'invalid Google reward close probe limits');
  check(s.ads.framePollMs>=100&&s.ads.frameLeaseMs>=s.ads.framePollMs*2,'ad frame lease/poll interval invalid');
  check(s.move.minDelayMs>=500,'move.minDelayMs must be >= 500');
  check(s.move.quickMaxMs>=s.move.minDelayMs&&s.move.maxDelayMs>=s.move.quickMaxMs,'invalid move delay range');
  check(s.move.bookMaxMs>=s.move.bookMinMs,'invalid book delay range');
  check(s.session.readyMaxMs>=s.session.readyMinMs,'invalid ready delay range');
  check(s.draw.maxOffers<=2,'draw.maxOffers cannot exceed 2');
  check(s.draw.minOwnTurnsBetweenOffers>=1,'draw.minOwnTurnsBetweenOffers must be >= 1');
  for(const key of ['smallSearchMs','mediumSearchMs','complexSearchMs'])check(s.move[key]>=100&&s.move[key]<=50000,`move.${key} must be 100–50000`);
  check(s.draw.replySearchMs>=100&&s.draw.replySearchMs<=10000,'draw.replySearchMs must be 100–10000');
  check(s.move.pollMs>=50&&s.cpu.sampleMs>=250,'poll/sample interval too small');
  check(s.engine.httpTimeoutMs>s.move.complexSearchMs+s.engine.stopTimeoutMs,'HTTP timeout must exceed search + stop timeout');
  check(s.engine.clientTimeoutMs>s.engine.httpTimeoutMs,'client timeout must exceed HTTP timeout');
  for(const entries of Object.values(s))Object.freeze(entries);
  return Object.freeze(s);
}
export const settings=validateSettings(values);
