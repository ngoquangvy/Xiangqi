const chars=['k','a','b','r','c','n','p'];
export function readState(w=window) {
  if(!w.BkGlobal || w.K===undefined || w.BkGlobal.ia!==w.K) throw new Error('Hãy mở phòng Cờ tướng (không phải Cờ úp).');
  const layer=w.BkGlobal.Yj?.ja?.();
  if(!layer || !Array.isArray(layer.V) || layer.V.length!==32) throw new Error('Chưa nhận diện được bàn cờ Ziga.');
  const logic=layer.T?.(), player=logic?.Ba?.();
  if(!logic || typeof logic.PP!=='function') throw new Error('Adapter không tương thích phiên bản Ziga này.');
  if(!player || player.Ka || ![0,1].includes(layer.Nj)) throw new Error('Bạn chưa ngồi chơi hoặc đang xem ván.');
  if(w.GAME_STATE_PLAYING===undefined || logic.Fb!==w.GAME_STATE_PLAYING) throw new Error('Đang chờ ván bắt đầu.');
  if(![0,1].includes(layer.Yc) || typeof layer.hc!=='boolean') throw new Error('Lượt chơi không hợp lệ.');
  const board=Array.from({length:10},()=>Array(9).fill(null));
  let kings=[0,0];
  for(const p of layer.V) {
    if(p.pa) continue;
    if(!Number.isInteger(p.fa)||p.fa<0||p.fa>8||!Number.isInteger(p.rowIndex)||p.rowIndex<0||p.rowIndex>9||![0,1].includes(p.ka)||!chars[p.Ga]) throw new Error('Dữ liệu quân cờ không hợp lệ.');
    const y=9-p.rowIndex,x=p.fa;
    if(board[y][x]) throw new Error('Hai quân trùng ô.');
    const ch=chars[p.Ga];board[y][x]=p.ka===0?ch.toUpperCase():ch;
    if(p.Ga===0) kings[p.ka]++;
  }
  if(kings.some(n=>n!==1)) throw new Error('Ván đã kết thúc hoặc thiếu tướng.');
  const rows=board.map(row=>{let s='',empty=0;for(const ch of row){if(!ch)empty++;else{if(empty)s+=empty;empty=0;s+=ch;}}return s+(empty||'');});
  const fen=rows.join('/')+` ${layer.Yc===0?'w':'b'} - - 0 1`;
  const room=[w.BkGlobal.ia,logic.Cn?.(),layer.Yt,layer.nv].join(':');
  return {layer,logic,player,fen,key:room+':'+fen+':'+layer.hc,myTurn:layer.Yc===layer.Nj,room};
}
export function sendMove(expected,move,w=window) {
  const state=readState(w);
  if(state.key!==expected.key || state.layer!==expected.layer || !state.myTurn) throw new Error('Bàn cờ hoặc lượt đã thay đổi; hủy nước cũ.');
  let coords=[move.x,9-move.y,move.tx,9-move.ty];
  if(state.layer.hc) coords=coords.map((n,i)=>i%2===0?8-n:9-n);
  state.logic.PP(...coords);
}
