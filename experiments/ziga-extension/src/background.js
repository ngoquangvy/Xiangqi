const jobs=new Map();
import {validPreferences,preferenceKeys} from './preferences.js';
import {checkBridgeVersion,bridgeErrorMessage} from './bridge-status.js';
const bridgeUrl='http://127.0.0.1:17864';let lastHealthAt=0;
chrome.runtime.onMessage.addListener((msg,sender,reply)=>{
  if(!/^https:\/\/(www\.)?zigavn\.com\//.test(sender.url||'')||typeof msg?.id!=='string')return;
  const key=sender.tab.id+':'+sender.frameId+':'+msg.id;
  if(msg.kind==='settings-get'){
    chrome.storage.local.get(preferenceKeys.map(k=>'menu.'+k)).then(data=>{
      const values={};for(const k of preferenceKeys)if(('menu.'+k)in data)values[k]=data['menu.'+k];reply({settings:validPreferences(values)});
    }).catch(e=>reply({error:e.message}));return true;
  }
  if(msg.kind==='settings-set'){
    const patch=validPreferences(msg.settings),data={};for(const [k,v]of Object.entries(patch))data['menu.'+k]=v;
    chrome.storage.local.set(data).then(()=>reply({ok:true})).catch(e=>reply({error:e.message}));return true;
  }
  if(msg.kind==='cancel'){jobs.get(key)?.abort();reply({ok:true});return;}
  if(!['analyze','ponder','stop'].includes(msg.kind))return;
  if(msg.kind!=='stop'&&(typeof msg.fen!=='string'||msg.fen.length>200||!Number.isInteger(msg.movetime)||msg.movetime<100||msg.movetime>10000)){reply({error:'Invalid request'});return;}
  const controller=new AbortController();jobs.set(key,controller);
  const timer=setTimeout(()=>controller.abort(),20000);
  Promise.resolve().then(async()=>{
    if(msg.kind!=='stop'&&Date.now()-lastHealthAt>5000){
      const response=await fetch(bridgeUrl+'/health',{signal:controller.signal});
      checkBridgeVersion(await response.json());lastHealthAt=Date.now();
    }
    return fetch(bridgeUrl+'/'+msg.kind,{method:'POST',headers:{'Content-Type':'application/json','X-Ziga-Client':msg.clientId||'legacy'},body:JSON.stringify({fen:msg.fen,movetime:msg.movetime,reverse:msg.reverse,bookMoves:msg.bookMoves,ply:msg.ply,threads:msg.threads,depth:msg.depth,clientId:msg.clientId,gameId:msg.gameId,usePonder:msg.usePonder}),signal:controller.signal});
  })
    .then(async r=>{const data=await r.json();if(!r.ok)throw Error(data.error||'Bridge error');return data;})
    .then(reply).catch(e=>reply({error:bridgeErrorMessage(e)}))
    .finally(()=>{clearTimeout(timer);jobs.delete(key);});
  return true;
});
