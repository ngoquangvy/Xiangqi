export function checkBridgeVersion(health,movetime=10000,bookMoves=5){
  const version=typeof health?.version==='string'?health.version.split('.').map(Number):[];
  if(!health?.ok||version.length<2||!version.every(Number.isFinite)||version[0]===0&&version[1]<6)throw Error('Bridge đang chạy bản cũ, chưa hỗ trợ 10 giây/ponder. Hãy đóng bridge cũ rồi chạy start-bridge.cmd trong thư mục extension mới.');
  const maximum=Number.isInteger(health.maxMovetimeMs)?health.maxMovetimeMs:10000;
  if(movetime>maximum)throw Error(`Bridge đang chạy bản cũ, chỉ hỗ trợ tối đa ${maximum/1000} giây. Hãy đóng bridge cũ rồi chạy lại start-bridge.cmd bản mới để dùng 20/30/50 giây.`);
  if(bookMoves>(Number.isInteger(health.maxBookMoves)?health.maxBookMoves:5))throw Error('Bridge đang chạy bản cũ, chỉ hỗ trợ book tối đa 5 lượt/bên. Hãy đóng bridge cũ rồi chạy lại start-bridge.cmd bản mới để dùng book 6–10.');
  return true;
}
export function bridgeErrorMessage(error){
  if(error?.name==='AbortError')return 'Đã hủy hoặc engine quá thời gian.';
  const message=String(error?.message||error);
  const limit=/Invalid movetime.*?[–-](\d+)\s*ms/.exec(message);
  if(limit&&Number(limit[1])<50000)return `Bridge đang chạy bản cũ (chỉ hỗ trợ ${Number(limit[1])/1000} giây). Hãy chạy start-bridge.cmd bản mới, sau đó Reload extension và tải lại Ziga.`;
  if(/Failed to fetch|fetch failed|ECONNREFUSED/i.test(message))return 'Chưa kết nối được bridge ở cổng 17864. Hãy chạy start-bridge.cmd.';
  return message;
}
