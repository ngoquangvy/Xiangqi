import {readState} from './adapter.js';
import {settings} from '../settings.mjs';
const requestText='Đối phương muốn hòa. Bạn có đồng ý không?';
export function drawPopup(w=window){
  const popup=w.Fl;
  const text=popup?.la?.getString?.()?.replace(/\s+/g,' ').trim();
  if(text!==requestText||typeof popup.Vl!=='function'||typeof popup.hf!=='function'||typeof popup.removeSelf!=='function')return null;
  const top=w.BkStackWindow?.Vj?.();if(top&&top!==popup)return null;
  return popup;
}
export function drawDecision(state,result){
  if(result?.source!=='engine'||!Number.isInteger(result.depth)||result.depth<14||result.score?.bound!==false||!Number.isFinite(result.score?.value))return 'manual';
  const score=result.score.value*(state.myTurn?1:-1);
  if(result.score.type==='mate')return score>0?'refuse':score<0?'accept':'manual';
  if(result.score.type!=='cp')return 'manual';
  return score<=30?'accept':'refuse';
}
export function respondDraw(expected,popup,decision,w=window){
  const current=readState(w);
  if(current.key!==expected.key||current.layer!==expected.layer||drawPopup(w)!==popup)throw Error('Đề nghị hòa hoặc thế cờ đã thay đổi; không trả lời nước cũ.');
  if(decision==='accept'){
    // Same sequence as the actual Agree button. Remove the close/refuse callback first.
    const agree=popup.Vl;popup.hf(null);popup.removeSelf();agree();popup.Vl=null;
  }else if(decision==='refuse'){
    // Closing this specific dialog invokes Ziga's original CHESS_DRAW_REFUSE callback.
    if(typeof popup.Bp!=='function')throw Error('Không nhận diện được nút từ chối hòa.');
    popup.removeSelf();
  }else throw Error('Không đủ dữ liệu để tự trả lời hòa.');
}
export class DrawPolicy{
  constructor(){this.reset();}
  reset(){this.layer=null;this.room=null;this.key=null;this.plies=0;this.quiet=0;this.pieces=null;this.streak=0;this.evalKey=null;this.offers=0;this.lastOfferAt=-Infinity;this.lastOfferPly=-Infinity;this.ownTurns=0;this.lastOfferOwnTurn=-Infinity;this.lastOfferKey=null;}
  observe(state){
    if(this.layer!==state.layer||this.room!==state.room){this.reset();this.layer=state.layer;this.room=state.room;}
    if(state.key!==this.key){
      if(state.myTurn)this.ownTurns++;
      const count=(state.fen.split(' ')[0].match(/[a-z]/gi)||[]).length;
      if(this.key!==null){this.plies++;this.quiet=this.pieces===count?this.quiet+1:0;}
      this.pieces=count;this.key=state.key;
    }
  }
  record(state,result){
    this.observe(state);
    if(!state.myTurn||this.evalKey===state.key)return;
    this.evalKey=state.key;
    const balanced=result?.source==='engine'&&result.depth>=14&&result.score?.bound===false&&result.score?.type==='cp'&&Math.abs(result.score.value)<=20;
    this.streak=balanced?this.streak+1:0;
  }
  canOffer(state,result,now=Date.now()){
    const attackers=(state.fen.split(' ')[0].match(/[rncp]/gi)||[]).length;
    return state.myTurn&&this.key===state.key&&this.plies>=40&&this.streak>=4&&
      result?.source==='engine'&&result.depth>=14&&result.score?.bound===false&&result.score?.type==='cp'&&Math.abs(result.score.value)<=20&&
      (attackers<=4||this.quiet>=40)&&this.offers<settings.draw.maxOffers&&this.offers<2&&
      this.lastOfferKey!==state.key&&now-this.lastOfferAt>=settings.draw.offerCooldownMs&&
      this.ownTurns-this.lastOfferOwnTurn>=settings.draw.minOwnTurnsBetweenOffers;
  }
  offer(expected,result,w=window,now=Date.now()){
    const state=readState(w);
    if(state.key!==expected.key||state.layer!==expected.layer||!this.canOffer(state,result,now)||w.Fl||w.BkStackWindow?.Vj?.())return false;
    if(w.CHESS_DRAW_REQUEST===undefined||typeof state.logic.yr!=='function')return false;
    // Reserve the attempt before sending, even if the client throws after dispatch.
    this.offers++;this.lastOfferAt=now;this.lastOfferPly=this.plies;this.lastOfferOwnTurn=this.ownTurns;this.lastOfferKey=state.key;
    state.logic.yr(w.CHESS_DRAW_REQUEST);return true;
  }
}
