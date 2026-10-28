window.addEventListener('message',async event=>{
  if(event.source===window&&event.origin===location.origin&&event.data?.channel==='ziga-ad-watch'){
    const {active,completed,adId,surface}=event.data;
    chrome.runtime.sendMessage({kind:'ad-watch',active:active===true,completed:completed===true,adId,surface}).catch(()=>{});return;
  }
  if(event.source!==window||event.origin!==location.origin||event.data?.channel!=='ziga-native-request')return;
  const msg=event.data;
  if(typeof msg.id!=='string'||msg.id.length>100||!['analyze','ponder','stop','cancel','settings-get','settings-set','ad-diagnostics'].includes(msg.kind))return;
  try{
    const result=await chrome.runtime.sendMessage({...msg,channel:undefined});
    if(msg.kind!=='cancel')window.postMessage({channel:'ziga-native-result',id:msg.id,result},location.origin);
  }catch(e){window.postMessage({channel:'ziga-native-result',id:msg.id,result:{error:e.message}},location.origin);}
});
