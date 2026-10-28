import {adRoots} from './ad-frame.js';
// Structural metadata only: no page body, full URLs, cookies or account data.
export function adSurface(w){
  const frames=[],controls=[];let videos=0;
  const doc=w.document;
  if(typeof doc?.querySelectorAll!=='function')return {frames,controls,videos};
  for(const root of adRoots(doc)){
    videos+=root.querySelectorAll('video').length;
    for(const frame of root.querySelectorAll('iframe')){
      if(frames.length>=20)break;
      let host='không có src';try{const url=new URL(frame.src||frame.getAttribute?.('src')||'',w.location?.href);host=url.hostname||url.protocol;}catch{}
      const r=frame.getBoundingClientRect?.();
      frames.push({host,visible:!!r&&r.width>0&&r.height>0});
    }
    for(const el of root.querySelectorAll('button, [role="button"], [aria-label], [id*="close"], [id*="dismiss"], [class*="close"]')){
      if(controls.length>=20)break;
      const label=[el.innerText,el.getAttribute?.('aria-label'),el.id].filter(Boolean).join(' ').trim();
      if(!/close|dismiss|đóng|skip|bỏ qua|reward|thưởng/i.test(label))continue;
      const r=el.getBoundingClientRect?.();if(!r||r.width<=0||r.height<=0)continue;
      controls.push(label.replace(/\s+/g,' ').slice(0,100));
    }
  }
  return {frames,controls,videos};
}
export function cleanSurface(raw){
  const text=value=>typeof value==='string'?value.replace(/[\r\n]/g,' ').slice(0,100):'';
  return {
    frames:Array.isArray(raw?.frames)?raw.frames.slice(0,20).map(f=>({host:text(f.host),visible:f.visible===true})):[],
    controls:Array.isArray(raw?.controls)?raw.controls.slice(0,20).map(text):[],
    videos:Number.isInteger(raw?.videos)?Math.max(0,Math.min(100,raw.videos)):0
  };
}
