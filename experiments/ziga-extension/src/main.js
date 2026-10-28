import {settings} from '../settings.mjs';
import manifest from '../extension/manifest.json' with {type:'json'};
import {nativeBestMove,nativePonder,nativeStop,nativeRequest} from './native-client.js';
import XiangqiGame from '../vendor/XiangqiGame.js';
import {legalMoves} from './engine.js';
import {readState,sendMove} from './adapter.js';
import {moveDelayMs} from './move-delay.js';
import {AutoSession,sessionSnapshot} from './session.js';
import {drawPopup,drawDecision,respondDraw,DrawPolicy} from './draw.js';
import {getAdStatus} from './ad-state.js';
import {bindPreferences} from './preferences.js';
if(!document.getElementById('ziga-xq-experiment')) {
  const host=document.createElement('div');host.id='ziga-xq-experiment';
  host.style.cssText='position:fixed;top:90px;right:16px;z-index:2147483647';
  const shadow=host.attachShadow({mode:'closed'});
  shadow.innerHTML=`<style>:host{font:14px system-ui;color:#eee}section{width:255px;background:#17212c;border:1px solid #65758a;border-radius:12px;padding:14px;box-shadow:0 5px 30px #0006}h3{margin:0 0 8px;font-size:16px}button,select{font:inherit;padding:7px;margin:4px 3px 4px 0;border-radius:5px;border:0}button{cursor:pointer}#start{background:#8be3b0}#stop{background:#ffb3ac}p{line-height:1.5;overflow-wrap:anywhere;margin:8px 0}small{color:#b0becb}label{display:block}</style><section><h3>Ziga · Thử nghiệm</h3><small>Engine JS cơ bản · Cờ tướng</small><label>Thời gian tính <select id="time"><option value="300">0,3 giây</option><option value="650" selected>0,65 giây</option><option value="1200">1,2 giây</option></select></label><button id="start">Bật tự đánh</button><button id="stop">Dừng</button><p id="status">Đã tắt. Vào bàn cờ rồi bấm Bật.</p><small id="detail"></small></section>`;
  document.documentElement.append(host);
  const $=id=>shadow.getElementById(id);
  shadow.querySelector('small').textContent='Pikafish native · localhost';
  $('time').innerHTML='<option value="auto" selected>Tự động ≤10 giây</option><option value="650">0,65 giây</option><option value="1200">1,2 giây</option><option value="2500">2,5 giây</option><option value="5000">5 giây</option><option value="10000">10 giây</option><option value="20000">20 giây</option><option value="30000">30 giây</option><option value="50000">50 giây</option>';
  const bookLabel=document.createElement('label');bookLabel.innerHTML='Ưu tiên book <select id="book"><option value="3">3 lượt đầu / bên</option><option value="4">4 lượt đầu / bên</option><option value="5" selected>5 lượt đầu / bên</option><option value="6">6 lượt đầu / bên</option><option value="7">7 lượt đầu / bên</option><option value="8">8 lượt đầu / bên</option><option value="9">9 lượt đầu / bên</option><option value="10">10 lượt đầu / bên</option><option value="0">Tắt book</option></select>';
  $('start').before(bookLabel);
  const engineSettings=document.createElement('div');engineSettings.innerHTML='<label>Độ sâu tối đa <input id="depth" type="number" min="0" max="64" step="1" value="0" style="width:65px"> <small>0 = theo thời gian</small></label><label>Threads <input id="threads" type="number" min="1" max="16" step="1" value="2" style="width:65px"></label>';
  $('start').before(engineSettings);
  const ponderSettings=document.createElement('div');ponderSettings.innerHTML='<label><input id="ponder" type="checkbox" checked> Tính trước trong lượt đối thủ</label><small id="cpuStatus">CPU: đang đo · tự giảm tải khi >70% trong 10 giây</small>';
  $('start').before(ponderSettings);
  let engineGameId=null,ponderJob=null,lastPonderAt=0,lastPonderKey=null;
  function clearBackground(){ponderJob?.controller.abort();ponderJob=null;if(engineGameId){void nativeStop(engineGameId);engineGameId=null;}lastPonderAt=0;lastPonderKey=null;}
  function cpuStatus(r){if(Number.isFinite(r.cpuPercent))$('cpuStatus').textContent=`CPU máy ${r.cpuPercent}% · ${r.effectiveThreads||r.threads||'?'} threads${r.ponderPaused?' · đang nghỉ ponder':r.cpuLimited?' · giảm tải':''}`;}
  $('ponder').onchange=()=>{if(!$('ponder').checked)clearBackground();};
  const drawSettings=document.createElement('div');drawSettings.innerHTML='<label><input id="autoDrawReply" type="checkbox"> Tự nhận/từ chối cầu hòa theo engine</label><label><input id="autoDrawOffer" type="checkbox"> Tự đề nghị hòa khi cân bằng lâu</label><small id="drawStatus"></small>';
  $('start').before(drawSettings);
  shadow.querySelector('section').style.cssText='max-height:80vh;overflow-y:auto';
  const draws=new DrawPolicy();let manualDraw=null,drawHoldUntil=0;
  const autoSettings=document.createElement('div');autoSettings.innerHTML='<hr><strong>Tự chơi liên tiếp · chỉ Cờ tướng</strong><label>Xem quảng cáo khi tim ≤ <input id="adHeartThreshold" type="number" min="0" max="10000" value="0" style="width:65px"></label><label><input id="autoAds" type="checkbox"> Tự xem quảng cáo nhận tim khi chạm ngưỡng</label><label>Tối đa quảng cáo / phiên <input id="maxAds" type="number" min="1" max="10" value="3" style="width:45px"></label><button id="autoStart">Bật tự chơi</button><button id="autoStop">Tắt tự chơi</button><p id="autoStatus">Tự chơi: đã tắt.</p><hr><strong>Bot đi quân trong bàn</strong><br>';
  $('start').before(autoSettings);
  const adTestControls=document.createElement('div');adTestControls.innerHTML='<button id="testAd">Thử quảng cáo nhận tim</button><p id="adTestStatus">Thử riêng khi còn tim, không cần bật tự chơi.</p>';
  const adTestTools=document.createElement('details');adTestTools.id='adTestTools';
  adTestTools.innerHTML='<summary id="adTestToggle" title="Mở công cụ thử quảng cáo" style="font-size:11px;color:#b0becb;cursor:pointer;width:max-content;padding:2px 0">Test</summary>';
  adTestTools.append(adTestControls);$('autoStatus').after(adTestTools);
  const diagnosticControls=document.createElement('div');diagnosticControls.innerHTML='<button id="adDiagnostic">Xem chẩn đoán quảng cáo</button><textarea id="adDiagnosticText" readonly hidden aria-label="Chẩn đoán lần quảng cáo" style="box-sizing:border-box;width:100%;height:150px"></textarea>';
  adTestControls.append(diagnosticControls);
  $('adDiagnostic').onclick=async()=>{
    const output=$('adDiagnosticText');output.hidden=false;output.value='Đang đọc chẩn đoán đã lưu…';
    try{
      const result=await nativeRequest('ad-diagnostics',null,null,new AbortController().signal);
      output.value=result.diagnostic.events.map(e=>e.stage+(e.frame!==undefined?` · khung ${e.frame} · kết thúc: ${e.completed?'có':'chưa'}${e.candidates!==undefined?' · số nút nhận diện: '+e.candidates:''}${e.clicked!==undefined?' · đã bấm: '+(e.clicked?'có':'chưa'):''}`:'')).join('\n');
      const surfaces=result.diagnostic.surfaces||[];
      output.value+=result.diagnostic.events.some(e=>e.continued)?'\nĐã chọn TIẾP TỤC xem khi quảng cáo cảnh báo mất phần thưởng.':'';
      output.value+='\n\nCẤU TRÚC KHUNG VÀ NÚT:\n'+(surfaces.length?surfaces.map(s=>`Khung ${s.frame} · số video: ${s.videos}\n  Iframe con: ${s.frames.map(f=>f.host+(f.visible?' [có kích thước]':' [ẩn/rỗng]')).join(', ')||'không có'}\n  Nhãn nút: ${s.controls.join(' | ')||'không thấy nút Đóng/X'}`).join('\n'):'Chưa thu được cấu trúc. Hãy thử quảng cáo một lần sau khi Reload extension.');
    }catch(e){output.value='Không đọc được chẩn đoán: '+e.message;}
  };
  const settingsStatus=document.createElement('small');settingsStatus.id='settingsStatus';settingsStatus.textContent='Đang đọc thiết lập đã lưu…';$('detail').after(settingsStatus);
  const panel=shadow.querySelector('section'),title=panel.querySelector('h3');
  const header=document.createElement('div');header.style.cssText='display:flex;align-items:center;justify-content:space-between;gap:8px;position:sticky;top:0;background:#17212c;z-index:1;padding-bottom:6px';
  const minimize=document.createElement('button');minimize.id='minimize';minimize.style.cssText='margin:0;padding:3px 10px;font-size:20px';
  header.append(title,minimize);title.style.margin='0';
  const menuBody=document.createElement('div');menuBody.id='menuBody';
  while(panel.firstChild)menuBody.append(panel.firstChild);
  const minimized=document.createElement('input');minimized.id='minimized';minimized.type='checkbox';minimized.hidden=true;
  const compact=document.createElement('small');compact.id='compactStatus';compact.style.cssText='display:block;margin-top:5px';compact.hidden=true;
  panel.append(header,minimized,compact,menuBody);
  function renderMenu(){
    const collapsed=minimized.checked;menuBody.hidden=collapsed;compact.hidden=!collapsed;compact.style.display=collapsed?'block':'none';
    panel.style.width=collapsed?'190px':'255px';title.textContent=collapsed?`Ziga Bot ${manifest.version}`:`Ziga · ${manifest.version}`;
    minimize.textContent=collapsed?'+':'−';minimize.title=collapsed?'Mở menu':'Thu nhỏ menu (bot vẫn chạy)';
    minimize.setAttribute('aria-label',collapsed?'Mở menu':'Thu nhỏ menu');minimize.setAttribute('aria-expanded',String(!collapsed));
  }
  minimized.addEventListener('change',renderMenu);
  minimize.onclick=()=>{minimized.checked=!minimized.checked;minimized.dispatchEvent(new Event('change'));};
  renderMenu();
  let settingsReady=false;
  const preferences=bindPreferences(shadow,{
    load:async()=>{const r=await nativeRequest('settings-get',null,null,new AbortController().signal);return r.settings;},
    save:settings=>nativeRequest('settings-set',null,null,new AbortController().signal,{settings})
  });
  void preferences.ready.then(()=>{settingsReady=true;renderMenu();updateButtons();});
  const session=new AutoSession();let continuous=false;
  function sessionOptions(){
    const raw=$('adHeartThreshold').value;
    if(!/^(0|[1-9]\d*)$/.test(raw))throw Error('Ngưỡng tim chưa hợp lệ. Không vào bàn hoặc Sẵn sàng.');
    return {autoAds:$('autoAds').checked,adHeartThreshold:Number(raw),maxAds:Number($('maxAds').value)};
  }
  const rewardTest=new AutoSession();let testingReward=false;
  let observedPly=null,observedKey=null,observedRoom=null,waiting=null;
  let enabled=false,pending=null,lastRoom=null,stableKey='',stableAt=0,search=null,generation=0;
  const setStatus=t=>{$('status').textContent=t;};
  function updateButtons(){
    $('start').disabled=!settingsReady||enabled;$('stop').disabled=!enabled;
    $('autoStart').disabled=!settingsReady||continuous;$('autoStop').disabled=!continuous;
    $('testAd').disabled=!settingsReady||testingReward;
    $('adDiagnostic').disabled=!settingsReady;
    compact.textContent=`Tự chơi: ${continuous?'bật':'tắt'} · Đi quân: ${enabled?'bật':'tắt'}`;
  }
  function stop(message,all=true){enabled=false;generation++;search?.controller.abort();search=null;waiting=null;clearBackground();if(all){continuous=false;session.reset();testingReward=false;rewardTest.ad=null;$('autoStatus').textContent='Tự chơi: đã dừng.';}updateButtons();setStatus(message);}
  $('testAd').onclick=()=>{
    try{
      const result=rewardTest.beginReward(sessionSnapshot(),{maxAds:Number($('maxAds').value)});
      $('adTestStatus').textContent=result.status;
      testingReward=!!rewardTest.ad;
      if(testingReward){generation++;search?.controller.abort();search=null;waiting=null;clearBackground();}
      updateButtons();
    }catch(e){$('adTestStatus').textContent='Không mở được quảng cáo thử: '+e.message;}
  };
  $('stop').onclick=()=>stop('Bot đi quân đã dừng.',false);
  $('start').onclick=()=>{try{if(enabled)return;const s=continuous?sessionSnapshot():readState();enabled=true;generation++;lastRoom=continuous?null:s.room;stableKey='';updateButtons();setStatus('Đã bật bot đi quân. Đang theo dõi Cờ tướng…');if(!continuous&&$('autoAds').checked)$('autoStatus').textContent='Tự chơi đang tắt. Bật Tự chơi để áp dụng ngưỡng tim và tự nhận tim.';}catch(e){setStatus(e.message);}};
  $('autoStart').onclick=()=>{try{if(continuous)return;const snapshot=sessionSnapshot();sessionOptions();session.reset();session.watchReward(window);session.guardNativeReady(snapshot,sessionOptions);continuous=true;updateButtons();$('autoStatus').textContent='Tự chơi: đã bật. Tự vào/rời bàn Cờ tướng.';}catch(e){session.releaseNativeGuard();$('autoStatus').textContent=e.message;}};
  $('autoStop').onclick=()=>{continuous=false;session.reset();updateButtons();$('autoStatus').textContent='Tự chơi: đã tắt. Không tự vào/rời bàn nữa.';};
  updateButtons();
  document.addEventListener('keydown',e=>{if(e.key==='Escape')stop('Đã dừng bằng Esc.');});
  async function tick(){
    if(!enabled&&!continuous&&!testingReward)return;
    try{
      // Keep ad control alive even if Ziga temporarily loses the table layer.
      if(testingReward||continuous){
        let reward;
        try{reward=(testingReward?rewardTest:session).watchReward(window);}
        catch(e){if(!testingReward)throw e;testingReward=false;rewardTest.ad=null;$('adTestStatus').textContent='Thử quảng cáo: '+e.message;updateButtons();return;}
        if(reward){
          $(testingReward?'adTestStatus':'autoStatus').textContent=reward.status;
          clearBackground();
          if(search||waiting){generation++;search?.controller.abort();search=null;waiting=null;}
          pending=null;lastRoom=null;stableKey='';observedRoom=null;
          if(enabled)setStatus('Đang chờ quảng cáo và xác nhận tim…');
          return;
        }
      }
      if(testingReward){
        try{
          const result=rewardTest.step(sessionSnapshot(),{rewardOnly:true,maxAds:Number($('maxAds').value)});
          $('adTestStatus').textContent=result.status;
          if(result.done){testingReward=false;updateButtons();}
        }catch(e){testingReward=false;rewardTest.ad=null;$('adTestStatus').textContent='Thử quảng cáo: '+e.message;updateButtons();}
        return;
      }
      if(continuous){
        const snapshot=sessionSnapshot();
        const options=sessionOptions();
        session.guardNativeReady(snapshot,sessionOptions);
        const sessionResult=session.step(snapshot,options);
        let diagnostic='';
        if(snapshot.stage==='table'&&!sessionResult.play){
          const seats=snapshot.logic?.ha?.filter(p=>p&&!p.Ka).length??0;
          const b=snapshot.layer?.mb;
          const button=b?(b.isVisible?.()!==false&&b.x>=0&&b.y>=0?'hiện':'ẩn'):'chưa có';
          diagnostic=` · Ghế ${seats}/2 · bàn ${snapshot.logic?.Fb??'?'} · vai trò ${snapshot.player?.status??'?'} · nút ${button}`;
        }
        $('autoStatus').textContent=(sessionResult.play?'Tự chơi: đang trong ván Cờ tướng.':sessionResult.status+diagnostic)+` · Tim ${snapshot.hearts} / ngưỡng ${options.adHeartThreshold} · nhận tim ${options.autoAds?'bật':'tắt'}`;
        if(!sessionResult.play){
          clearBackground();
          if(search||waiting){generation++;search?.controller.abort();search=null;waiting=null;}
          pending=null;lastRoom=null;stableKey='';observedRoom=null;
          if(enabled)setStatus('Bot đi quân đang chờ ván bắt đầu…');return;
        }
      }
      if(!enabled)return;
      if(!continuous){
        const ads=getAdStatus();
        if(ads.blocking){if(search||waiting){generation++;search?.controller.abort();search=null;waiting=null;}clearBackground();setStatus(ads.status);return;}
      }
      const state=readState();
      engineGameId??=crypto.randomUUID();
      draws.observe(state);
      if(observedRoom!==state.room){observedRoom=state.room;observedPly=null;observedKey=null;}
      if(observedKey!==state.key){if(observedKey!==null&&observedPly!==null)observedPly++;observedKey=state.key;}
      if(lastRoom===null&&continuous)lastRoom=state.room;
      if(state.room!==lastRoom){stop('Đã đổi bàn hoặc sang ván mới. Bấm Bật để tiếp tục.');return;}
      const offerPopup=drawPopup();
      if(offerPopup){
        ponderJob?.controller.abort();ponderJob=null;
        if(search?.kind==='draw'){
          if(search.key!==state.key){generation++;search.controller.abort();search=null;manualDraw=null;}
          else return;
        }
        if(search||waiting){generation++;search?.controller.abort();search=null;waiting=null;}
        if(!$('autoDrawReply').checked){setStatus('Có đề nghị hòa. Đang chờ bạn trả lời.');return;}
        if(manualDraw?.popup===offerPopup&&manualDraw.key===state.key){setStatus('Chưa đủ độ sâu để tự quyết định hòa. Bạn hãy trả lời thủ công.');return;}
        const job={kind:'draw',key:state.key,controller:new AbortController(),generation};search=job;
        setStatus('Đối thủ cầu hòa. Đang tính lại bằng Pikafish…');
        let evaluation;
        try{evaluation=await nativeBestMove(state.fen,settings.draw.replySearchMs,job.controller.signal,{bookMoves:0,depth:0,threads:Number($('threads').value),reverse:state.layer.hc,gameId:engineGameId,usePonder:false});}
        catch(e){if(generation===job.generation&&enabled){manualDraw={popup:offerPopup,key:state.key};setStatus('Không đánh giá được lời cầu hòa: '+e.message);}return;}
        finally{if(search===job)search=null;}
        if(!enabled||generation!==job.generation||!$('autoDrawReply').checked)return;
        if(drawPopup()!==offerPopup||readState().key!==state.key)return;
        const decision=drawDecision(state,evaluation);
        if(decision==='manual'){manualDraw={popup:offerPopup,key:state.key};setStatus('Chưa đủ dữ liệu. Giữ đề nghị hòa để bạn quyết định.');return;}
        respondDraw(state,offerPopup,decision);
        $('drawStatus').textContent=decision==='accept'?'Đã đồng ý hòa theo đánh giá engine.':'Đã từ chối hòa vì engine đánh giá có lợi thế.';
        setStatus($('drawStatus').textContent);manualDraw=null;
        if(decision==='accept')drawHoldUntil=Date.now()+settings.draw.acceptWaitMs;
        return;
      }
      manualDraw=null;
      if(Date.now()<drawHoldUntil){setStatus('Đã đồng ý hòa. Đang chờ Ziga xác nhận…');return;}
      if(waiting){
        const queued=waiting;
        if(state.key!==queued.state.key||state.layer!==queued.state.layer||!state.myTurn||generation!==queued.generation){stop('Bàn cờ hoặc lượt đã thay đổi trong lúc chờ. Đã hủy nước.');return;}
        const remaining=queued.readyAt-Date.now();
        if(remaining>0){setStatus(`Đã có nước. Chờ ${(remaining/1000).toFixed(1)} giây trước khi đi…`);return;}
        sendMove(queued.state,queued.move);
        waiting=null;pending={key:state.key,at:Date.now()};
        const move=queued.move;
        setStatus(`Đã gửi ${String.fromCharCode(97+move.x)}${9-move.y} → ${String.fromCharCode(97+move.tx)}${9-move.ty}. Chờ xác nhận…`);
        return;
      }
      if(search){if(search.key!==state.key)stop('Bàn cờ đã thay đổi trong lúc tính. Bấm Bật để tiếp tục.');return;}
      if(pending){
        if(state.key===pending.key){if(Date.now()-pending.at>settings.move.confirmMs)stop(`Chưa nhận xác nhận sau ${settings.move.confirmMs/1000} giây. Đã dừng; hãy kiểm tra bàn cờ.`);return;}
        pending=null;
      }
      if(state.key!==stableKey){stableKey=state.key;stableAt=Date.now();return;}
      if(Date.now()-stableAt<($('ponder').checked&&state.myTurn?settings.move.ponderStableMs:settings.move.stableMs))return;
      if(!state.myTurn){
        const ponderKey=state.key+':'+$('threads').value+':'+$('depth').value;
        if(lastPonderKey!==ponderKey){ponderJob?.controller.abort();ponderJob=null;lastPonderKey=ponderKey;lastPonderAt=0;}
        setStatus($('ponder').checked?'Đang chờ đối thủ · engine tính trước có giới hạn CPU…':'Đang chờ đối thủ…');
        if($('ponder').checked&&!ponderJob&&Date.now()-lastPonderAt>=settings.engine.ponderRequestIntervalMs){
          const job={key:state.key,controller:new AbortController(),gameId:engineGameId};ponderJob=job;lastPonderAt=Date.now();
          void nativePonder(state.fen,job.controller.signal,{gameId:job.gameId,threads:Number($('threads').value),depth:Number($('depth').value)})
            .then(r=>{if(enabled&&engineGameId===job.gameId)cpuStatus(r);}).catch(e=>{if(enabled&&engineGameId===job.gameId&&!job.controller.signal.aborted)$('cpuStatus').textContent='Ponder chưa sẵn sàng: '+e.message;})
            .finally(()=>{if(ponderJob===job)ponderJob=null;});
        }
        return;
      }
      if(ponderJob){ponderJob.controller.abort();ponderJob=null;}
      const forcedGame=new XiangqiGame();
      if(!forcedGame.importFen(state.fen))throw Error('Thế cờ không hợp lệ.');
      const initialChoices=legalMoves(forcedGame,forcedGame.currentTurn);
      if(initialChoices.length===1){
        waiting={state,move:initialChoices[0],generation,readyAt:Date.now()+settings.move.minDelayMs};
        setStatus(`Đã có nước duy nhất hợp lệ. Chờ ${settings.move.minDelayMs/1000} giây trước khi đi…`);
        $('detail').textContent=`1 lựa chọn · không cần gọi engine · chờ thêm ${settings.move.minDelayMs/1000}s`;return;
      }
      setStatus('Đang tính nước…');
      const job={key:state.key,controller:new AbortController(),generation};search=job;
      let result;
      const threads=Number($('threads').value),depth=Number($('depth').value);
      if(!Number.isInteger(threads)||threads<1||threads>16||!Number.isInteger(depth)||depth<0||depth>64){stop('Threads: 1–16; độ sâu: 0–64.');return;}
      const budget=$('time').value==='auto'?(initialChoices.length<=4?settings.move.smallSearchMs:initialChoices.length<=12?settings.move.mediumSearchMs:settings.move.complexSearchMs):Number($('time').value);
      try{result=await nativeBestMove(state.fen,budget,job.controller.signal,{reverse:state.layer.hc,bookMoves:Number($('book').value),ply:observedPly,threads,depth,gameId:engineGameId,usePonder:$('ponder').checked});}
      catch(e){if(generation===job.generation&&enabled)stop(e.message);return;}
      finally{if(search===job)search=null;}
      if(!enabled||generation!==job.generation)return;
      if(drawPopup())return;
      const freshState=readState();if(freshState.key!==state.key||freshState.layer!==state.layer)return;
      cpuStatus(result);
      draws.record(state,result);
      if(observedPly===null&&Number.isInteger(result.openingPly))observedPly=result.openingPly;
      const move=result.move;
      if(!move){stop('Không còn nước hợp lệ.');return;}
      const validation=new XiangqiGame();
      if(!validation.importFen(state.fen))throw Error('Thế cờ không hợp lệ; đã dừng.');
      const choices=legalMoves(validation,validation.currentTurn);
      if(!choices.some(m=>m.x===move.x&&m.y===move.y&&m.tx===move.tx&&m.ty===move.ty))throw Error('Nước engine không hợp lệ; đã dừng.');
      if($('autoDrawOffer').checked&&draws.offer(state,result))$('drawStatus').textContent='Đã đề nghị hòa: đánh giá cân bằng ổn định. Chờ đối thủ trả lời.';
      const delay=moveDelayMs(choices.length,result.depth,result);
      waiting={state,move,generation:job.generation,readyAt:Date.now()+delay};
      setStatus(`Đã có nước. Chờ ${(delay/1000).toFixed(1)} giây trước khi đi…`);
      $('detail').textContent=`${result.engine}${result.ponderHit?' · trúng nhánh tính trước':''} · sâu ${result.depth} · ${result.threads?result.threads+' threads · ':''}${result.nodes} nút · ${result.ms} ms · ${choices.length} lựa chọn · chờ thêm ${(delay/1000).toFixed(1)}s`;
    }catch(e){stop(e.message);}
  }
  setInterval(tick,settings.move.pollMs);
  document.addEventListener('visibilitychange',()=>void tick());
  window.addEventListener('pagehide',()=>stop('Đã dừng.'));
}
