export const defaults=Object.freeze({time:'auto',book:'5',depth:'0',threads:'2',ponder:true,autoDrawReply:false,autoDrawOffer:false,maxHearts:'1',autoAds:false,maxAds:'3',minimized:false});
export const preferenceKeys=Object.keys(defaults);
export function validPreferences(raw){
  const out={};if(!raw||typeof raw!=='object'||Array.isArray(raw))return out;
  for(const key of preferenceKeys){
    const v=raw[key];
    if(typeof defaults[key]==='boolean'){if(typeof v==='boolean')out[key]=v;continue;}
    const s=typeof v==='string'?v:typeof v==='number'&&Number.isInteger(v)?String(v):null;
    if(s===null)continue;
    if(key==='time'){if(['auto','650','1200','2500','5000','10000'].includes(s))out[key]=s;continue;}
    if(key==='book'){if(['0','3','4','5'].includes(s))out[key]=s;continue;}
    const [min,max]={depth:[0,64],threads:[1,16],maxHearts:[1,10000],maxAds:[1,10]}[key];
    if(/^(0|[1-9]\d*)$/.test(s)&&Number(s)>=min&&Number(s)<=max)out[key]=s;
  }
  return out;
}
export function bindPreferences(root,{load,save}){
  const dirty=new Set();let writes=Promise.resolve();
  const status=text=>{const el=root.getElementById('settingsStatus');if(el)el.textContent=text;};
  for(const key of preferenceKeys){
    const el=root.getElementById(key);
    const changed=()=>{
      dirty.add(key);const patch=validPreferences({[key]:typeof defaults[key]==='boolean'?el.checked:el.value});
      if(!(key in patch))return;
      writes=writes.catch(()=>{}).then(()=>save(patch)).then(()=>status('Đã lưu thiết lập.')).catch(e=>status('Không lưu được thiết lập: '+e.message));
    };
    el.addEventListener('change',changed);
    if(el.type==='number')el.addEventListener('input',changed);
  }
  const ready=Promise.resolve().then(load).then(raw=>{
    const values={...defaults,...validPreferences(raw)};
    for(const key of preferenceKeys){if(dirty.has(key))continue;const el=root.getElementById(key);if(typeof defaults[key]==='boolean')el.checked=values[key];else el.value=values[key];}
    status('Thiết lập tự lưu cho lần mở sau.');
  }).catch(e=>status('Không đọc được thiết lập đã lưu: '+e.message));
  return {ready,flush:()=>writes};
}
