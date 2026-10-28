import {settings} from './settings.mjs';
export const MAX_MOVETIME_MS=50000;
export function budgetTimeouts(movetime){
  const budget=Number.isInteger(movetime)&&movetime>0?Math.min(movetime,MAX_MOVETIME_MS):0;
  const bridgeMs=budget>10000?Math.max(settings.engine.httpTimeoutMs,budget+settings.engine.handshakeMs+settings.engine.searchGraceMs+settings.engine.stopTimeoutMs):settings.engine.httpTimeoutMs;
  return {bridgeMs,clientMs:Math.max(settings.engine.clientTimeoutMs,bridgeMs+Math.max(2000,settings.engine.clientTimeoutMs-settings.engine.httpTimeoutMs))};
}
