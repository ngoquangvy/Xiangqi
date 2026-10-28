// Adapter for Ziga's public client v139. Never choose a game ID other than K.
import {getAdStatus} from './ad-state.js';
export function sessionSnapshot(w=window){
  const g=w.BkGlobal;
  const home=g&&g.ia===-1&&(g.Ja===w.Q||(w.G!==undefined&&g.Ja===w.G));
  if(!g||w.K===undefined||(g.ia!==w.K&&!home))throw Error('Tự chơi chỉ hỗ trợ Cờ tướng. Hãy về màn hình chính hoặc sảnh Cờ tướng.');
  if([w.sj,w.V,w.Q].some(v=>v===undefined)||!w.BkLogicManager?.T)throw Error('Không nhận diện được trạng thái sảnh Ziga.');
  const common=w.BkLogicManager.T();
  const hearts=g.P?.pb?.();
  const needsVerification=w.G!==undefined&&g.Ja===w.G;
  if(!needsVerification&&(!Number.isFinite(hearts)||hearts<0))throw Error('Không đọc được số tim.');
  const popup=w.BkStackWindow?.Vj?.();
  const stage=needsVerification?'verification':g.Ja===w.sj?'lobby':g.Ja===w.V?'table':g.Ja===w.Q?'menu':'unknown';
  let layer=null,logic=null,player=null;
  if(stage==='table'){
    layer=g.Yj?.ja?.();logic=layer?.T?.();player=logic?.Ba?.();
  }
  const syncing=stage==='table'&&(!layer||!logic||!player);
  const playing=!syncing&&stage==='table'&&w.GAME_STATE_PLAYING!==undefined&&logic.Fb===w.GAME_STATE_PLAYING;
  const finished=!syncing&&stage==='table'&&w.GAME_STATE_FINISH!==undefined&&logic.Fb===w.GAME_STATE_FINISH;
  return {w,g,stage,common,hearts,popup,layer,logic,player,playing,finished,syncing,
    identity:stage==='table'?`${g.af}:${g.vi}`:`${stage}:${g.af}`};
}
export class AutoSession{
  constructor(random=Math.random){this.random=random;this.reset();}
  reset(){this.nextAt=0;this.action=null;this.ad=null;this.finishAt=null;this.adsUsed=0;this.lastTable=null;this.readyWait=null;this.syncAt=null;this.idleWatch=null;this.leaving=null;this.skippedTables=new Set();}
  leaveWaiting(s,now){
    if(typeof s.logic.uo!=='function')throw Error('Không nhận diện được nút rời bàn.');
    this.skippedTables.add(s.identity);this.leaving={key:s.identity,layer:s.layer};this.readyWait=null;this.idleWatch=null;
    return this.perform('rời bàn chờ',s.identity,now,()=>s.logic.uo(0),'Đã chờ 3 giây. Đang rời bàn để tìm bàn khác…');
  }
  checkIdle(s,now){
    const {w,logic,player}=s;
    const waitingTable=s.stage==='table'&&!s.syncing&&!s.playing&&!s.finished&&[w.GAME_STATE_READY,w.GAME_STATE_NOT_READY].filter(v=>v!==undefined).includes(logic?.Fb);
    if(!waitingTable||player?.Ka||s.popup){this.idleWatch=null;return null;}
    if(this.leaving?.key===s.identity&&this.leaving.layer===s.layer)return this.leaveWaiting(s,now);
    const seated=logic.ha?.filter(p=>p&&!p.Ka)||[];
    const ownReady=player.status===w.PLAYER_STATE_READY||player.status===w.PLAYER_STATE_TABLE_OWNER||(this.action?.type==='sẵn sàng'&&this.action.key===s.identity);
    const opponentUnready=seated.some(p=>p!==player&&(p.status===w.PLAYER_STATE_NOT_READY||(w.PLAYER_STATE_FINISH_GAME!==undefined&&p.status===w.PLAYER_STATE_FINISH_GAME)));
    const kind=seated.length===1?'alone':seated.length===2&&ownReady&&opponentUnready?'opponent':null;
    if(!kind){this.idleWatch=null;return null;}
    if(!this.idleWatch||this.idleWatch.key!==s.identity||this.idleWatch.layer!==s.layer||this.idleWatch.kind!==kind){
      const at=kind==='opponent'&&this.action?.type==='sẵn sàng'&&this.action.key===s.identity?this.action.at:now;
      this.idleWatch={key:s.identity,layer:s.layer,kind,at};
    }
    if(now-this.idleWatch.at>=3000)return this.leaveWaiting(s,now);
    return null;
  }
  delayedReady(type,s,now,call,status){
    if(this.action?.type===type&&this.action.key===s.identity)return this.perform(type,s.identity,now,call,status);
    if(!this.readyWait||this.readyWait.type!==type){
      const sample=Number(this.random());
      const delay=1000+Math.round(Math.max(0,Math.min(1,Number.isFinite(sample)?sample:0.5))*500);
      this.readyWait={type,key:s.identity,layer:s.layer,status:s.player.status,due:now+delay};
    }
    if(now<this.readyWait.due)return {play:false,status:`Sẽ ${type} sau ${((this.readyWait.due-now)/1000).toFixed(1)} giây…`};
    return this.perform(type,s.identity,now,call,status);
  }
  perform(type,key,now,call,status){
    if(this.action?.type===type&&this.action.key===key){
      if(now-this.action.at>20000)throw Error('Ziga chưa xác nhận thao tác '+type+'. Đã dừng để tránh gửi lặp.');
      return {play:false,status:'Đang chờ Ziga xác nhận: '+status};
    }
    this.action={type,key,at:now};this.nextAt=now+(['vào bàn','ngồi chơi'].includes(type)?0:2500);call();return {play:false,status};
  }
  step(s,{autoAds=false,maxHearts=1,maxAds=3}={},now=Date.now()){
    const {w,g,stage,common,hearts,logic,layer,player}=s;
    if(this.readyWait&&(stage!=='table'||this.readyWait.key!==s.identity||this.readyWait.layer!==layer||this.readyWait.status!==player?.status||player?.Ka||s.playing||s.finished||(logic?.ha?.filter(p=>p&&!p.Ka).length??0)<2))this.readyWait=null;
    if(g.ia!==w.K&&!(g.ia===-1&&['menu','verification'].includes(stage)))throw Error('Đã rời Cờ tướng. Dừng tự chơi.');
    if(!Number.isInteger(maxHearts)||maxHearts<1||maxHearts>10000||!Number.isInteger(maxAds)||maxAds<1||maxAds>10)throw Error('Giới hạn tim: 1–10000; số quảng cáo: 1–10.');
    if(stage==='unknown')throw Error('Trạng thái trang không được hỗ trợ. Hãy kiểm tra CAPTCHA hoặc kết nối.');
    if(s.syncing){
      this.idleWatch=null;
      if(this.syncAt===null)this.syncAt=now;
      if(now-this.syncAt>20000)throw Error('Bàn không đồng bộ sau 20 giây. Hãy kiểm tra kết nối.');
      return {play:false,status:'Tự chơi vẫn bật. Đang chờ bàn đồng bộ…'};
    }
    this.syncAt=null;
    if(stage==='verification')return {play:false,status:'Hãy tự xác minh CAPTCHA/đăng nhập. Bot chờ màn hình chọn game rồi sẽ chọn Cờ tướng.'};
    if(this.ad&&now-this.ad.at>120000)throw Error('Quảng cáo quá thời gian. Hãy kiểm tra hoặc xem thủ công rồi bật lại.');
    const ads=getAdStatus(w,now);
    if(ads.failed&&this.ad)throw Error('Quảng cáo không tải được. Chưa được cộng tim; hãy thử thủ công.');
    if(ads.blocking){this.idleWatch=null;return {play:false,status:ads.status};}
    if(this.ad){
      if(hearts>this.ad.hearts){
        this.ad=null;this.action=null;this.nextAt=now+3000;
        // Only dismiss a one-button informational message after confirmed credit.
        if(s.popup&&w.Sa!==undefined&&s.popup.type===w.Sa&&typeof s.popup.removeSelf==='function')s.popup.removeSelf();
        return {play:false,status:'Ziga đã cộng tim. Chuẩn bị chơi tiếp…'};
      }
      return {play:false,status:'Chờ Ziga xác nhận tim từ quảng cáo…'};
    }
    if(s.playing){
      if(player.Ka)throw Error('Đang xem ván người khác. Không tự chiếm chỗ trong ván đang diễn ra.');
      this.action=null;this.finishAt=null;this.lastTable=s.identity;this.idleWatch=null;this.leaving=null;
      return {play:true};
    }
    if(stage!=='table')this.leaving=null;
    const idleAction=this.checkIdle(s,now);if(idleAction)return idleAction;
    if(now<this.nextAt)return {play:false,status:'Chờ chuyển trạng thái…'};
    if(s.finished){
      if(this.finishAt===null)this.finishAt=now;
      if(now-this.finishAt<4000)return {play:false,status:'Ván đã kết thúc. Sẽ rời bàn sau vài giây…'};
      if(typeof logic.uo!=='function')throw Error('Không nhận diện được nút rời bàn.');
      return this.perform('rời bàn',s.identity,now,()=>logic.uo(0),'Đã yêu cầu rời bàn sau ván.');
    }
    this.finishAt=null;
    if(hearts<1){
      if(!autoAds)throw Error('Hết tim. Hãy xem quảng cáo thủ công hoặc bật tự xem nhận tim.');
      if(this.adsUsed>=maxAds)throw Error('Đã đạt giới hạn quảng cáo trong phiên. Dừng tự chơi.');
      if(w.document?.visibilityState==='hidden')return {play:false,status:'Đưa tab Ziga ra trước để xem quảng cáo nhận tim.'};
      const heartPopup=typeof w.BkAddHeartWindow==='function'&&s.popup instanceof w.BkAddHeartWindow;
      if(s.popup&&!heartPopup)throw Error('Có popup khi hết tim. Hãy xử lý popup rồi bật lại để xem quảng cáo.');
      if(typeof w.WebAdsManager?.showRewardAdsOnWeb!=='function')throw Error('Không có nút quảng cáo nhận tim tương thích.');
      this.ad={hearts,at:now};this.adsUsed++;
      w.WebAdsManager.showRewardAdsOnWeb();
      return {play:false,status:'Đã mở quảng cáo nhận tim. Chờ trang xác nhận…'};
    }
    if(s.popup)throw Error('Có popup cần xử lý. Tự chơi đã dừng.');
    if(stage==='menu'){
      const selector=w.getCurrentScene?.()?.ve;
      if(typeof selector?.iC==='function')return this.perform('chọn Cờ tướng','chess',now,()=>selector.iC(w.K),'Đã chọn Cờ tướng từ màn hình chính…');
      if(g.ia!==w.K)throw Error('Không nhận diện được nút Cờ tướng ở màn hình chính.');
      if(typeof common.gz!=='function')throw Error('Không nhận diện được sảnh Cờ tướng.');
      return this.perform('mở sảnh','chess',now,()=>common.gz(w.K),'Đang mở sảnh Cờ tướng…');
    }
    if(stage==='lobby'){
      const tables=common.ic?.aN;
      if(!Array.isArray(tables)||typeof common.FJ!=='function')throw Error('Không đọc được danh sách bàn Cờ tướng.');
      const candidates=tables.filter(t=>Number.isInteger(t.wg)&&t.wg>=0&&t.wg<=255&&t.aj===2&&t.tk>=0&&t.tk<2&&!t.Rb&&!t.Wj&&Number.isFinite(t.Yb)&&t.Yb>=0&&t.Yb<=Math.min(hearts,maxHearts)&&!this.skippedTables.has(`${g.af}:${t.wg}`));
      candidates.sort((a,b)=>b.tk-a.tk||a.Yb-b.Yb||a.wg-b.wg);
      if(!candidates.length)return {play:false,status:'Chưa có bàn Cờ tướng khác phù hợp. Đang chờ, không giữ bàn cũ…'};
      const table=candidates[0];
      return this.perform('vào bàn',`${g.af}:${table.wg}`,now,()=>common.FJ(table.wg),'Đang vào bàn Cờ tướng '+table.wg+'…');
    }
    if(stage==='table'){
      if(![w.GAME_STATE_READY,w.GAME_STATE_NOT_READY].filter(v=>v!==undefined).includes(logic.Fb))throw Error('Bàn đang ở trạng thái chưa hỗ trợ.');
      if(!Number.isFinite(logic.Ke)||logic.Ke>maxHearts||logic.Ke>hearts)throw Error('Mức tim của bàn vượt giới hạn; hãy chọn lại bàn.');
      if(player.Ka){
        if(typeof logic.wz!=='function'||logic.wz()<0||typeof logic.TC!=='function')throw Error('Bàn không còn chỗ ngồi.');
        return this.perform('ngồi chơi',s.identity,now,()=>logic.TC(false),'Đang ngồi vào bàn…');
      }
      const players=logic.ha?.filter(p=>p&&!p.Ka)||[];
      if(players.length<2){this.readyWait=null;return {play:false,status:'Đã vào bàn. Đang chờ đủ 2 người ngồi chơi…'};}
      const readyButton=layer.mb;
      const visibleReady=readyButton&&readyButton.isVisible?.()!==false&&readyButton.isEnabled?.()!==false&&readyButton.isTouchEnabled?.()!==false&&readyButton.x>=0&&readyButton.y>=0&&player.status!==w.PLAYER_STATE_TABLE_OWNER;
      if(player.status===w.PLAYER_STATE_NOT_READY||(w.PLAYER_STATE_FINISH_GAME!==undefined&&player.status===w.PLAYER_STATE_FINISH_GAME)||visibleReady){
        if(typeof layer.onReady!=='function')throw Error('Không nhận diện được nút sẵn sàng.');
        return this.delayedReady('sẵn sàng',s,now,()=>layer.onReady(),'Đã yêu cầu sẵn sàng…');
      }
      if(player.status===w.PLAYER_STATE_TABLE_OWNER&&players.every(p=>p===player||p.status===w.PLAYER_STATE_READY)){
        if(typeof logic.fG!=='function')throw Error('Không nhận diện được nút bắt đầu ván.');
        return this.delayedReady('bắt đầu',s,now,()=>logic.fG(),'Đang bắt đầu ván Cờ tướng…');
      }
      return {play:false,status:'Đang chờ đối thủ sẵn sàng…'};
    }
    return {play:false,status:'Đang chờ Ziga…'};
  }
}
