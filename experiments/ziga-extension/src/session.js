import {settings} from '../settings.mjs';
// Adapter for Ziga's public client v139. Never choose a game ID other than K.
import { getAdStatus } from './ad-state.js';
function heartAdPrompt(w, popup) {
  const text = popup?.la?.getString?.()?.replace(/\s+/g, ' ').trim();
  const expected = typeof w.Fn === 'string' ? w.Fn.replace(/\s+/g, ' ').trim() : null;
  return !!expected && text === expected && typeof popup.Vl === 'function' && typeof popup.hf === 'function' && typeof popup.removeSelf === 'function';
}
export function getPopupText(popup) {
  if (!popup) return '';
  const pieces = [];
  if (typeof popup.la?.getString === 'function') pieces.push(popup.la.getString());
  if (typeof popup.getString === 'function') pieces.push(popup.getString());
  if (typeof popup.getMessage === 'function') pieces.push(popup.getMessage());
  if (typeof popup.getText === 'function') pieces.push(popup.getText());
  if (typeof popup.title?.getString === 'function') pieces.push(popup.title.getString());
  if (typeof popup._message === 'string') pieces.push(popup._message);
  if (typeof popup.message === 'string') pieces.push(popup.message);
  if (typeof popup.text === 'string') pieces.push(popup.text);
  const children = Array.isArray(popup._children) ? popup._children : typeof popup.getChildren === 'function' ? (() => { try { return popup.getChildren() || []; } catch { return []; } })() : [];
  for (const child of children) {
    if (typeof child?.getString === 'function') pieces.push(child.getString());
  }
  return pieces.filter(Boolean).join(' ').replace(/\s+/g, ' ').trim();
}
export function isHeartRewardText(text) {
  if (!text || typeof text !== 'string') return false;
  const t = text.toLowerCase();
  const hasHeart = /tim\b|trái tim|heart/i.test(t);
  const hasRewardAction = /(?:nhận|được|cộng|thưởng|tặng|thành công|chúc mừng|quảng cáo|hoàn thành|video)/i.test(t);
  const isQuestion = /\?|muốn xem|bạn có muốn|đồng ý xem/i.test(t);
  return hasHeart && hasRewardAction && !isQuestion && !/mua|thanh toán|không|chưa|thất bại/i.test(t);
}
export function isHeartRewardPopup(w, popup, { recentReward = false } = {}) {
  if (!popup || !recentReward || heartAdPrompt(w,popup)) return false;
  if (typeof w.BkBonusHeartWindow==='function' && popup instanceof w.BkBonusHeartWindow) return Number.isFinite(popup.lA)&&popup.lA>0;
  const text=getPopupText(popup);
  if(text)return isHeartRewardText(text)&&!/mua|thanh toán|không|chưa|thất bại|cầu hòa|đối phương muốn hòa/i.test(text);
  return w.Sa!==undefined&&popup.type===w.Sa;
}
export function dismissHeartPopup(w, popup) {
  if (!popup) return false;
  // The real bonus window's Close handler includes its animation and cleanup.
  const close=popup.removeSelf||popup.closeWindow||popup.close;
  if(typeof close!=='function')return false;
  close.call(popup);
  if(w.Fl===popup)w.Fl=null;
  return true;
}
export function closeHeartRewardDom(w) {
  const doc = w?.document;
  if (!doc?.querySelectorAll) return false;
  let clicked = false;
  const selectors = ['.modal', '.dialog', '.popup', '.alert', '.notification', '[role="dialog"]', '[role="alertdialog"]', '[class*="notify"]', '[class*="popup"]', '[class*="modal"]', '[class*="dialog"]', '[id*="notify"]', '[id*="popup"]', '[id*="modal"]', '[id*="dialog"]'];
  for (const sel of selectors) {
    for (const el of doc.querySelectorAll(sel) || []) {
      const t = el.textContent || '';
      if (isHeartRewardText(t)) {
        let btn = el.querySelector('button, [role="button"], .close, #close, #close-button, #dismiss-button, [aria-label="Close"], [aria-label="Đóng"], input[type="button"]');
        if (!btn) {
          for (const b of el.querySelectorAll('button, div, a, span') || []) {
            const bt = (b.textContent || '').trim().toLowerCase();
            if (['đóng', 'ok', 'xác nhận', 'đồng ý', 'close'].includes(bt) && typeof b.click === 'function') { btn = b; break; }
          }
        }
        if (btn && typeof btn.click === 'function' && !btn.disabled) { btn.click(); clicked = true; }
      }
    }
  }
  return clicked;
}
export function sessionSnapshot(w = window) {
  const g = w.BkGlobal;
  const home = g && g.ia === -1 && (g.Ja === w.Q || (w.G !== undefined && g.Ja === w.G));
  if (!g || w.K === undefined || (g.ia !== w.K && !home)) throw Error('Tự chơi chỉ hỗ trợ Cờ tướng. Hãy về màn hình chính hoặc sảnh Cờ tướng.');
  if ([w.sj, w.V, w.Q].some(v => v === undefined) || !w.BkLogicManager?.T) throw Error('Không nhận diện được trạng thái sảnh Ziga.');
  const common = w.BkLogicManager.T();
  const hearts = g.P?.pb?.();
  const needsVerification = w.G !== undefined && g.Ja === w.G;
  if (!needsVerification && (!Number.isFinite(hearts) || hearts < 0)) throw Error('Không đọc được số tim.');
  let popup = w.BkStackWindow?.Vj?.() || w.Fl || null;
  if (popup && popup === w.Fl && (popup._parent === null || popup.parent === null) && (popup._parent !== undefined || popup.parent !== undefined)) {
    popup = null; try { w.Fl = null; } catch { }
  }
  const stage = needsVerification ? 'verification' : g.Ja === w.sj ? 'lobby' : g.Ja === w.V ? 'table' : g.Ja === w.Q ? 'menu' : 'unknown';
  let layer = null, logic = null, player = null;
  if (stage === 'table') {
    layer = g.Yj?.ja?.(); logic = layer?.T?.(); player = logic?.Ba?.();
  }
  const syncing = stage === 'table' && (!layer || !logic || !player);
  const playing = !syncing && stage === 'table' && w.GAME_STATE_PLAYING !== undefined && logic.Fb === w.GAME_STATE_PLAYING;
  const finished = !syncing && stage === 'table' && w.GAME_STATE_FINISH !== undefined && logic.Fb === w.GAME_STATE_FINISH;
  return {
    w, g, stage, common, hearts, popup, layer, logic, player, playing, finished, syncing,
    identity: stage === 'table' ? `${g.af}:${g.vi}` : `${stage}:${g.af}`
  };
}
export class AutoSession {
  constructor(random = Math.random) { this.random = random; this.reset(); }
  releaseNativeGuard(){
    for(const hook of this.nativeGuards||[])if(hook.target[hook.key]===hook.wrapped)hook.target[hook.key]=hook.original;
    this.nativeGuards=[];this.nativeGuardState=null;
  }
  guardNativeReady(s,options){
    if(s.stage!=='table'||s.syncing){this.releaseNativeGuard();return;}
    const previous=this.nativeGuardState;
    if(previous?.layer!==s.layer||previous?.logic!==s.logic)this.releaseNativeGuard();
    this.nativeGuardState=s;this.nativeGuardOptions=options;
    if(this.nativeGuards.length)return;
    for(const [target,keys]of [[s.layer,['onReady']],[s.logic,['$P','tN','fG','uN']]])for(const key of keys){
      const original=target[key];if(typeof original!=='function')continue;
      const owner=this;
      const wrapped=function(...args){
        try{
          const current=sessionSnapshot(s.w);
          const opt=typeof owner.nativeGuardOptions==='function'?owner.nativeGuardOptions():owner.nativeGuardOptions;
          let balance=current.hearts;
          if(typeof current.player?.zn==='function')balance=Math.min(balance,current.player.zn());
          else if(typeof current.player?.P?.pb==='function')balance=Math.min(balance,current.player.P.pb());
          const threshold=opt.adHeartThreshold??0;
          const low=!Number.isFinite(balance)||balance<=threshold||balance<current.logic?.Ke;
          const pending=owner.ad||owner.mustRewardBeforeReady||getAdStatus(s.w).blocking;
          if(low)owner.mustRewardBeforeReady=true;
          if(current.syncing||current.layer!==s.layer||current.logic!==s.logic||current.playing||current.finished||current.player?.Ka||current.popup||low||pending){
            owner.readyWait=null;owner.nativeReadyBlocked=true;return false;
          }
        }catch{owner.readyWait=null;owner.nativeReadyBlocked=true;return false;}
        return original.apply(this,args);
      };
      target[key]=wrapped;this.nativeGuards.push({target,key,original,wrapped});
    }
  }
  requireReward(s,{autoAds=false,adHeartThreshold=0,maxAds=3}={},now=Date.now()){
    this.readyWait=null;this.idleWatch=null;this.mustRewardBeforeReady=true;
    if(s.stage==='table'){
      if(s.popup)throw Error('Có popup cần xử lý trước khi rời bàn nhận tim.');
      if(typeof s.logic.uo!=='function')throw Error('Không nhận diện được nút rời bàn để nhận tim.');
      return this.perform('rời bàn để nhận tim',s.identity,now,()=>s.logic.uo(0),'Đang rời bàn để xác nhận tim/quảng cáo trước Sẵn sàng…');
    }
    if(!autoAds)throw Error(`Tim chưa đủ hoặc đã chạm ngưỡng ${adHeartThreshold}. Chưa bấm Sẵn sàng; hãy nhận thêm tim trước.`);
    return this.beginReward(s,{maxAds},now);
  }
  beforeReady(expected,options,now){
    const reward=this.watchReward(expected.w,now);if(reward){this.readyWait=null;return reward;}
    const s=sessionSnapshot(expected.w);
    if(s.syncing||s.stage!=='table'||s.identity!==expected.identity||s.layer!==expected.layer||s.logic!==expected.logic||s.player?.Ka||s.playing||s.finished){this.readyWait=null;return {play:false,status:'Bàn vừa thay đổi. Kiểm tra lại trước khi Sẵn sàng…'};}
    if(s.popup){this.readyWait=null;return {play:false,status:'Chờ xử lý thông báo trước khi Sẵn sàng…'};}
    let tableHearts=s.hearts;
    if(typeof s.player.zn==='function')tableHearts=s.player.zn();
    else if(typeof s.player.P?.pb==='function')tableHearts=s.player.P.pb();
    if(!Number.isFinite(tableHearts)||tableHearts<0)throw Error('Chưa xác nhận được tim trong bàn. Không bấm Sẵn sàng.');
    const threshold=options.adHeartThreshold??0;
    const available=Math.min(s.hearts,tableHearts);
    const enough=typeof s.logic.OA==='function'?s.logic.OA():true;
    if(this.mustRewardBeforeReady||available<=threshold||available<s.logic.Ke||enough===false)return this.requireReward(s,options,now);
    return null;
  }
  watchReward(w,now=Date.now()){
    if(w.BkGlobal&&w.K!==undefined&&![w.K,-1].includes(w.BkGlobal.ia))return null;
    const hearts=w.BkGlobal?.P?.pb?.();
    const hidden=w.document?.visibilityState==='hidden';
    if(this.ad){
      this.readyWait=null;this.idleWatch=null;
      if(hidden)this.ad.hiddenAt??=now;
      else if(this.ad.hiddenAt!==undefined){this.ad.at+=now-this.ad.hiddenAt;delete this.ad.hiddenAt;}
    }
    const ads=getAdStatus(w,now,{credited:!!this.ad&&Number.isFinite(hearts)&&hearts>this.ad.hearts});
    if(!this.ad&&ads.rewardPending&&ads.blocking&&Number.isFinite(hearts)){
      this.ad={hearts,at:now};this.adsUsed++;this.readyWait=null;
    }
    if(hidden&&(this.ad||ads.blocking))return {play:false,status:'Quảng cáo đang chờ tab hiển thị. Khi quay lại Ziga, bot sẽ tiếp tục theo dõi và đóng quảng cáo.'};
    if(this.ad&&now-this.ad.at>settings.ads.timeoutMs)throw Error('Quảng cáo quá thời gian. Hãy kiểm tra hoặc xem thủ công rồi bật lại.');
    if(ads.failed&&this.ad)throw Error('Quảng cáo không tải được. Chưa được cộng tim; hãy thử thủ công.');
    if(ads.blocking){this.readyWait=null;this.idleWatch=null;return {play:false,status:ads.status};}
    if(!this.ad)return null;
    if(Number.isFinite(hearts)&&hearts>this.ad.hearts){
      this.ad=null;this.action=null;this.mustRewardBeforeReady=false;this.nextAt=now+settings.session.rewardResumeMs;this.adRewardAt=now;
      const popup=w.BkStackWindow?.Vj?.()||w.Fl||null;
      if(isHeartRewardPopup(w,popup,{recentReward:true}))dismissHeartPopup(w,popup);
      closeHeartRewardDom(w);
      return {play:false,status:'Ziga đã cộng tim. Chuẩn bị chơi tiếp…'};
    }
    return {play:false,status:'Chờ Ziga xác nhận tim từ quảng cáo…'};
  }
  beginReward(s,{maxAds=3}={},now=Date.now()){
    const {w,hearts}=s;
    if(s.playing||s.syncing||['unknown','verification'].includes(s.stage))throw Error('Hãy về sảnh hoặc màn hình Cờ tướng để thử quảng cáo.');
    if(this.ad)return {play:false,status:'Đang theo dõi quảng cáo đã mở; không mở lặp.'};
    if(!Number.isInteger(maxAds)||maxAds<1||maxAds>10)throw Error('Giới hạn quảng cáo phải từ 1–10.');
    if(this.adsUsed>=maxAds)throw Error('Đã đạt giới hạn quảng cáo trong phiên thử.');
    if(w.document?.visibilityState==='hidden')return {play:false,status:'Đưa tab Ziga ra trước để xem quảng cáo nhận tim.'};
    const ads=getAdStatus(w,now);if(ads.blocking)return {play:false,status:ads.status};
    const heartPopup=typeof w.BkAddHeartWindow==='function'&&s.popup instanceof w.BkAddHeartWindow;
    const prompt=heartAdPrompt(w,s.popup);
    if(s.popup&&!heartPopup&&!prompt)throw Error('Có popup khi mở quảng cáo. Hãy xử lý popup rồi thử lại.');
    if(typeof w.WebAdsManager?.showRewardAdsOnWeb!=='function')throw Error('Không có nút quảng cáo nhận tim tương thích.');
    this.ad={hearts,at:now};this.adRewardAt=null;this.adsUsed++;
    if(prompt){const agree=s.popup.Vl;s.popup.hf(null);s.popup.removeSelf();s.popup.Vl=null;agree();}
    else w.WebAdsManager.showRewardAdsOnWeb();
    return {play:false,status:'Đã mở quảng cáo nhận tim. Đang theo dõi đóng quảng cáo và cộng tim…'};
  }
  reset() { this.releaseNativeGuard();this.nativeReadyBlocked=false;this.nextAt = 0; this.action = null; this.ad = null; this.adRewardAt = null; this.mustRewardBeforeReady=false;this.finishAt = null; this.adsUsed = 0; this.lastTable = null; this.readyWait = null; this.syncAt = null; this.idleWatch = null; this.leaving = null; this.skippedTables = new Set(); }
  leaveWaiting(s, now) {
    if (typeof s.logic.uo !== 'function') throw Error('Không nhận diện được nút rời bàn.');
    this.skippedTables.add(s.identity); this.leaving = { key: s.identity, layer: s.layer }; this.readyWait = null; this.idleWatch = null;
    return this.perform('rời bàn chờ', s.identity, now, () => s.logic.uo(0), `Đã chờ ${settings.session.idleTableMs/1000} giây. Đang rời bàn để tìm bàn khác…`);
  }
  checkIdle(s, now) {
    const { w, logic, player } = s;
    const waitingTable = s.stage === 'table' && !s.syncing && !s.playing && !s.finished && [w.GAME_STATE_READY, w.GAME_STATE_NOT_READY].filter(v => v !== undefined).includes(logic?.Fb);
    if (!waitingTable || player?.Ka || s.popup) { this.idleWatch = null; return null; }
    if (this.leaving?.key === s.identity && this.leaving.layer === s.layer) return this.leaveWaiting(s, now);
    const seated = logic.ha?.filter(p => p && !p.Ka) || [];
    const ownReady = player.status === w.PLAYER_STATE_READY || player.status === w.PLAYER_STATE_TABLE_OWNER || (this.action?.type === 'sẵn sàng' && this.action.key === s.identity);
    const opponentUnready = seated.some(p => p !== player && (p.status === w.PLAYER_STATE_NOT_READY || (w.PLAYER_STATE_FINISH_GAME !== undefined && p.status === w.PLAYER_STATE_FINISH_GAME)));
    const kind = seated.length === 1 ? 'alone' : seated.length === 2 && ownReady && opponentUnready ? 'opponent' : null;
    if (!kind) { this.idleWatch = null; return null; }
    if (!this.idleWatch || this.idleWatch.key !== s.identity || this.idleWatch.layer !== s.layer || this.idleWatch.kind !== kind) {
      const at = kind === 'opponent' && this.action?.type === 'sẵn sàng' && this.action.key === s.identity ? this.action.at : now;
      this.idleWatch = { key: s.identity, layer: s.layer, kind, at };
    }
    if (now - this.idleWatch.at >= settings.session.idleTableMs) return this.leaveWaiting(s, now);
    return null;
  }
  delayedReady(type, s, now, call, status, options={}) {
    const gate=this.beforeReady(s,options,now);if(gate)return gate;
    if (this.action?.type === type && this.action.key === s.identity) return this.perform(type, s.identity, now, call, status);
    if (!this.readyWait || this.readyWait.type !== type) {
      const sample = Number(this.random());
      const delay = settings.session.readyMinMs + Math.round(Math.max(0, Math.min(1, Number.isFinite(sample) ? sample : 0.5)) * (settings.session.readyMaxMs-settings.session.readyMinMs));
      this.readyWait = { type, key: s.identity, layer: s.layer, status: s.player.status, due: now + delay };
    }
    if (now < this.readyWait.due) return { play: false, status: `Sẽ ${type} sau ${((this.readyWait.due - now) / 1000).toFixed(1)} giây…` };
    return this.perform(type, s.identity, now, call, status);
  }
  perform(type, key, now, call, status) {
    if (this.action?.type === type && this.action.key === key) {
      if (now - this.action.at > settings.session.actionConfirmMs) throw Error('Ziga chưa xác nhận thao tác ' + type + '. Đã dừng để tránh gửi lặp.');
      return { play: false, status: 'Đang chờ Ziga xác nhận: ' + status };
    }
    this.action = { type, key, at: now }; this.nextAt = now + (['vào bàn', 'ngồi chơi'].includes(type) ? 0 : settings.session.transitionMs); call(); return { play: false, status };
  }
  step(s, { autoAds = false, adHeartThreshold = 0, maxAds = 3, rewardOnly = false } = {}, now = Date.now()) {
    const { w, g, stage, common, hearts, logic, layer, player } = s;
    if (this.readyWait && (stage !== 'table' || this.readyWait.key !== s.identity || this.readyWait.layer !== layer || this.readyWait.status !== player?.status || player?.Ka || s.playing || s.finished || (logic?.ha?.filter(p => p && !p.Ka).length ?? 0) < 2)) this.readyWait = null;
    if (g.ia !== w.K && !(g.ia === -1 && ['menu', 'verification'].includes(stage))) throw Error('Đã rời Cờ tướng. Dừng tự chơi.');
    if (!Number.isInteger(adHeartThreshold) || adHeartThreshold < 0 || adHeartThreshold > 10000 || !Number.isInteger(maxAds) || maxAds < 1 || maxAds > 10) throw Error('Ngưỡng tim: 0–10000; số quảng cáo: 1–10.');
    const reward=this.watchReward(w,now);if(reward)return reward;
    if (stage === 'unknown') throw Error('Trạng thái trang không được hỗ trợ. Hãy kiểm tra CAPTCHA hoặc kết nối.');
    if (s.syncing) {
      this.idleWatch = null;
      if (this.syncAt === null) this.syncAt = now;
      if (now - this.syncAt > settings.session.tableSyncMs) throw Error('Bàn không đồng bộ sau 20 giây. Hãy kiểm tra kết nối.');
      return { play: false, status: 'Tự chơi vẫn bật. Đang chờ bàn đồng bộ…' };
    }
    this.syncAt = null;
    if (stage === 'verification') return { play: false, status: 'Hãy tự xác minh CAPTCHA/đăng nhập. Bot chờ màn hình chọn game rồi sẽ chọn Cờ tướng.' };
    if(rewardOnly){
      const recent=this.adRewardAt!==null&&now-this.adRewardAt<settings.session.rewardPopupWindowMs;
      if(recent){
        if(isHeartRewardPopup(w,s.popup,{recentReward:true}))dismissHeartPopup(w,s.popup);
        closeHeartRewardDom(w);
      }
      return {play:false,done:!recent,status:recent?'Đã nhận tim. Theo dõi và đóng thông báo nhận tim xuất hiện trễ…':'Đã hoàn tất thử quảng cáo. Không tự vào bàn.'};
    }
    if (s.playing) {
      if (player.Ka) throw Error('Đang xem ván người khác. Không tự chiếm chỗ trong ván đang diễn ra.');
      this.action = null; this.finishAt = null; this.lastTable = s.identity; this.idleWatch = null; this.leaving = null;
      return { play: true };
    }
    if (stage !== 'table') this.leaving = null;
    const idleAction = this.checkIdle(s, now); if (idleAction) return idleAction;
    const isRecentReward = this.adRewardAt !== null && (now - this.adRewardAt < settings.session.rewardPopupWindowMs);
    if (s.popup && isHeartRewardPopup(w, s.popup, { recentReward: isRecentReward })) {
      dismissHeartPopup(w, s.popup);
      s.popup = w.BkStackWindow?.Vj?.() || w.Fl || null;
      closeHeartRewardDom(w);
    }
    if (now < this.nextAt) return { play: false, status: 'Chờ chuyển trạng thái…' };
    if (s.finished) {
      if (this.finishAt === null) this.finishAt = now;
      if (now - this.finishAt < settings.session.finishedLeaveMs) return { play: false, status: 'Ván đã kết thúc. Sẽ rời bàn sau vài giây…' };
      if (typeof logic.uo !== 'function') throw Error('Không nhận diện được nút rời bàn.');
      return this.perform('rời bàn', s.identity, now, () => logic.uo(0), 'Đã yêu cầu rời bàn sau ván.');
    }
    this.finishAt = null;
    if (hearts <= adHeartThreshold || this.mustRewardBeforeReady) {
      if(hearts<1&&!autoAds)throw Error('Hết tim. Hãy xem quảng cáo thủ công hoặc bật tự xem nhận tim.');
      return this.requireReward(s,{autoAds,adHeartThreshold,maxAds},now);
    }
    if (s.popup) throw Error('Có popup cần xử lý. Tự chơi đã dừng.');
    if (stage === 'menu') {
      const selector = w.getCurrentScene?.()?.ve;
      if (typeof selector?.iC === 'function') return this.perform('chọn Cờ tướng', 'chess', now, () => selector.iC(w.K), 'Đã chọn Cờ tướng từ màn hình chính…');
      if (g.ia !== w.K) throw Error('Không nhận diện được nút Cờ tướng ở màn hình chính.');
      if (typeof common.gz !== 'function') throw Error('Không nhận diện được sảnh Cờ tướng.');
      return this.perform('mở sảnh', 'chess', now, () => common.gz(w.K), 'Đang mở sảnh Cờ tướng…');
    }
    if (stage === 'lobby') {
      const tables = common.ic?.aN;
      if (!Array.isArray(tables) || typeof common.FJ !== 'function') throw Error('Không đọc được danh sách bàn Cờ tướng.');
      const candidates = tables.filter(t => Number.isInteger(t.wg) && t.wg >= 0 && t.wg <= 255 && t.aj === 2 && t.tk >= 0 && t.tk < 2 && !t.Rb && !t.Wj && Number.isFinite(t.Yb) && t.Yb >= 0 && t.Yb <= Math.min(hearts, 1) && !this.skippedTables.has(`${g.af}:${t.wg}`));
      candidates.sort((a, b) => b.tk - a.tk || a.Yb - b.Yb || a.wg - b.wg);
      if (!candidates.length) return { play: false, status: 'Chưa có bàn Cờ tướng khác phù hợp. Đang chờ, không giữ bàn cũ…' };
      const table = candidates[0];
      return this.perform('vào bàn', `${g.af}:${table.wg}`, now, () => common.FJ(table.wg), 'Đang vào bàn Cờ tướng ' + table.wg + '…');
    }
    if (stage === 'table') {
      if (![w.GAME_STATE_READY, w.GAME_STATE_NOT_READY].filter(v => v !== undefined).includes(logic.Fb)) throw Error('Bàn đang ở trạng thái chưa hỗ trợ.');
      if (!Number.isFinite(logic.Ke) || logic.Ke > 1 || logic.Ke > hearts) throw Error('Mức tim của bàn vượt giới hạn; hãy chọn lại bàn.');
      if (player.Ka) {
        if (typeof logic.wz !== 'function' || logic.wz() < 0 || typeof logic.TC !== 'function') throw Error('Bàn không còn chỗ ngồi.');
        return this.perform('ngồi chơi', s.identity, now, () => logic.TC(false), 'Đang ngồi vào bàn…');
      }
      const players = logic.ha?.filter(p => p && !p.Ka) || [];
      if (players.length < 2) { this.readyWait = null; return { play: false, status: 'Đã vào bàn. Đang chờ đủ 2 người ngồi chơi…' }; }
      const readyButton = layer.mb;
      const visibleReady = readyButton && readyButton.isVisible?.() !== false && readyButton.isEnabled?.() !== false && readyButton.isTouchEnabled?.() !== false && readyButton.x >= 0 && readyButton.y >= 0 && player.status !== w.PLAYER_STATE_TABLE_OWNER;
      if (player.status === w.PLAYER_STATE_NOT_READY || (w.PLAYER_STATE_FINISH_GAME !== undefined && player.status === w.PLAYER_STATE_FINISH_GAME) || visibleReady) {
        if (typeof layer.onReady !== 'function') throw Error('Không nhận diện được nút sẵn sàng.');
        return this.delayedReady('sẵn sàng', s, now, () => layer.onReady(), 'Đã yêu cầu sẵn sàng…',{autoAds,adHeartThreshold,maxAds});
      }
      if (player.status === w.PLAYER_STATE_TABLE_OWNER && players.every(p => p === player || p.status === w.PLAYER_STATE_READY)) {
        if (typeof logic.fG !== 'function') throw Error('Không nhận diện được nút bắt đầu ván.');
        return this.delayedReady('bắt đầu', s, now, () => logic.fG(), 'Đang bắt đầu ván Cờ tướng…',{autoAds,adHeartThreshold,maxAds});
      }
      return { play: false, status: 'Đang chờ đối thủ sẵn sàng…' };
    }
    return { play: false, status: 'Đang chờ Ziga…' };
  }
}
