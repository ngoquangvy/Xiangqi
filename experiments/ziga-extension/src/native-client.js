import {settings} from '../settings.mjs';
const clientId=crypto.randomUUID();
export function nativeRequest(kind,fen,movetime,signal,bookOptions={}){
  return new Promise((resolve,reject)=>{
    const id=crypto.randomUUID();
    const cleanup=()=>{clearTimeout(timer);window.removeEventListener('message',receive);signal.removeEventListener('abort',abort);};
    const cancel=()=>window.postMessage({channel:'ziga-native-request',kind:'cancel',id},location.origin);
    const abort=()=>{cancel();cleanup();reject(new DOMException('Cancelled','AbortError'));};
    const receive=e=>{
      if(e.source!==window||e.origin!==location.origin||e.data?.channel!=='ziga-native-result'||e.data.id!==id)return;
      cleanup();const result=e.data.result;
      if(!result||result.error)reject(Error(result?.error||'Bridge không trả kết quả'));else resolve(result);
    };
    const timer=setTimeout(()=>{cancel();cleanup();reject(Error('Không kết nối được Pikafish. Hãy chạy bridge và Reload extension/tab Ziga.'));},settings.engine.clientTimeoutMs);
    window.addEventListener('message',receive);signal.addEventListener('abort',abort,{once:true});
    if(signal.aborted)abort();else window.postMessage({channel:'ziga-native-request',kind,id,fen,movetime,clientId,...bookOptions},location.origin);
  });
}
export const nativeBestMove=(fen,movetime,signal,options)=>nativeRequest('analyze',fen,movetime,signal,options);
export const nativePonder=(fen,signal,options)=>nativeRequest('ponder',fen,settings.move.complexSearchMs,signal,options);
export const nativeStop=gameId=>nativeRequest('stop',null,null,new AbortController().signal,{gameId}).catch(()=>{});
