export function checkBridgeVersion(health){
  const version=typeof health?.version==='string'?health.version.split('.').map(Number):[];
  if(!health?.ok||version.length<2||!version.every(Number.isFinite)||version[0]===0&&version[1]<6)throw Error('Bridge đang chạy bản cũ, chưa hỗ trợ 10 giây/ponder. Hãy đóng bridge cũ rồi chạy start-bridge.cmd trong thư mục extension mới.');
  return true;
}
export function bridgeErrorMessage(error){
  if(error?.name==='AbortError')return 'Đã hủy hoặc engine quá thời gian.';
  const message=String(error?.message||error);
  if(/Invalid movetime.*5000/.test(message))return 'Bridge đang chạy bản cũ (chỉ hỗ trợ 5 giây). Hãy chạy start-bridge.cmd bản mới, sau đó Reload extension và tải lại Ziga.';
  if(/Failed to fetch|fetch failed|ECONNREFUSED/i.test(message))return 'Chưa kết nối được bridge ở cổng 17864. Hãy chạy start-bridge.cmd.';
  return message;
}
