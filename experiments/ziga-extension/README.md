# Ziga Xiangqi Extension — Pikafish + opening book

## Bản 0.6.5 — mức chờ tối thiểu trước khi đi

Giữ nguyên ponder, bộ giảm tải CPU và ngân sách tính nước lạ tối đa 10 giây. Sau khi đã có kết quả, bot chờ thêm 0,5–1 giây thay vì gửi ngay; kết quả trúng ponder cũng áp dụng mức chờ này. Nước duy nhất hợp lệ không cần gọi engine nhưng vẫn chờ 0,5 giây. Nước book cũng không dưới 0,5 giây (giữ khoảng chờ cũ, tối đa 1,4 giây). Có đếm ngược và kiểm tra lại bàn trước khi gửi; Dừng/đổi thế vẫn hủy nước đang chờ. Thời gian này cộng ngoài thời gian engine tính; nhịp kiểm tra trang có thể làm gửi trễ thêm một chút. Reload extension và tải lại Ziga, không cần khởi động lại bridge cho thay đổi này.

## Bản 0.6.4 — tránh kết nối nhầm bridge cũ

Bridge hiện dùng **127.0.0.1:17864**. Cổng cũ 17863 có thể còn tiến trình phiên bản cũ giới hạn 5 giây; extension mới không dùng cổng đó nữa. Đã chạy bridge mới và kiểm tra yêu cầu `movetime: 10000` được chấp nhận (giới hạn depth thấp trong phép thử để không gây tải kéo dài).

Extension kiểm tra `/health` và yêu cầu bridge từ 0.6.0 trở lên trước khi phân tích/ponder. Lỗi phiên bản cũ, không kết nối được và dữ liệu FEN sai được báo riêng; không còn thêm câu “hãy chạy server” vào mọi lỗi engine. Reload extension và tải lại Ziga để dùng cổng mới; thiết lập đã lưu giữ nguyên. Những lần mở máy sau chạy `start-bridge.cmd` như trước.

## Bản 0.6.3 — nhớ thiết lập và thu nhỏ menu

Nút **−** ở đầu menu thu nhỏ bảng điều khiển; nút **+** mở lại. Hàng trạng thái gọn vẫn cho biết Tự chơi/Bot đi quân đang bật hay tắt. Thu nhỏ không dừng bot; Esc vẫn dừng cả hai chế độ. Thanh tiêu đề giữ ở đầu khi cuộn menu.

Thời gian, book, độ sâu, threads, ponder, hai tùy chọn hòa, giới hạn tim, tự nhận tim, giới hạn quảng cáo và trạng thái thu nhỏ được tự lưu trong `chrome.storage.local` của extension. Khôi phục khi mở trang hoặc mở lại trình duyệt với cùng profile; không cần bridge để đọc/lưu menu. Giá trị không hợp lệ không ghi đè thiết lập tốt trước đó, và dữ liệu tải chậm không ghi đè lựa chọn vừa sửa.

Hai trạng thái chạy **Tự chơi** và **Bot đi quân** không tự bật lại sau khi tải lại trang; chỉ các lựa chọn cấu hình được nhớ. Sau khi cập nhật, Reload extension và tải lại Ziga; không cần khởi động lại bridge cho thay đổi menu này.

## Bản 0.6.1 — cờ quảng cáo bị treo

Không còn coi riêng `BkGlobal.Tg` là bằng chứng đang có quảng cáo. Bot quan sát callback SDK `beforeAd`, `afterAd`, `adBreakDone` và lớp quảng cáo che bàn. Callback thật được chuyển nguyên vẹn, không tự gọi `adViewed` hay gửi yêu cầu nhận thưởng giả.

- Cờ quảng cáo treo từ trước, tab đang hiện và canvas không bị che: kiểm tra liên tục 3 giây rồi sửa riêng cờ hiển thị để tiếp tục vào bàn/đánh.
- SDK đã báo kết thúc: tiếp tục ngay khi không còn lớp quảng cáo. SDK báo mở nhưng canvas đã lộ rõ liên tục 10 giây: phục hồi cờ bị treo. Quảng cáo thật còn che bàn thì tiếp tục chờ; không tự đóng/bỏ qua.
- SDK báo không tải được quảng cáo: báo lỗi nhận tim, không ghi nhận đã được thưởng. Tab ẩn không được dùng làm bằng chứng quảng cáo đã biến mất.
- Áp dụng cả Tự chơi và bot đi quân đơn lẻ. Với `bàn 2 · vai trò 1` của client hiện tại, ván đang chạy/người chơi đã sẵn sàng; sau phục hồi sẽ đánh thay vì bấm Sẵn sàng lần nữa.

Chỉ cần Reload extension và tải lại Ziga cho sửa lỗi này; không cần đổi bridge nếu đã dùng bản 0.6.0. Có kiểm tra callback không cấp thưởng giả, lớp quảng cáo thật, cờ treo ở home và ở trạng thái bàn người dùng báo.

## Bản 0.6.0 — ponder, engine thường trú và giảm tải CPU

Mục này thay thế cơ chế khởi động engine mỗi lượt và độ trễ nhân tạo của các bản cũ bên dưới. **Cần đóng bridge cũ rồi chạy lại `start-bridge.cmd`, Reload extension và tải lại Ziga.** Bridge mới có `/health` trả `version: 0.6.0`.

- Giữ một tiến trình Pikafish và Hash 64 MB cho các lượt, thay vì khởi động lại mỗi nước. Game/tab có ID riêng; đổi ván xóa dự đoán và cache. Mỗi tiến trình chỉ tìm một thế tại một thời điểm, gửi stop và chờ bestmove xác nhận trước khi đổi thế/settings.
- Menu **Tính trước trong lượt đối thủ** mặc định bật. Sau khi nước của mình được xác nhận, dùng nước `ponder` do Pikafish dự đoán; nếu chưa có (ví dụ đang dùng book), tính ngắn tối đa 300 ms để chọn một nhánh đối thủ, sau đó `go ponder` trên thế dự kiến. Chỉ tính **một nhánh**, không giả định đã xét mọi nước của đối thủ.
- Mỗi đợt ponder tối đa 2 giây, sâu tối đa 20; nghỉ ít nhất 3 giây rồi mới có thể tính tiếp. Luồng chờ thường gọi lại mỗi 5 giây. Cache/hash vẫn giữ trong khoảng nghỉ; kết quả hợp lệ từ đợt trước có thể dùng ngay.
- Nếu đối thủ đi đúng nhánh và đã tính sâu >=12, dùng `ponderhit`/kết quả cache đúng thế, kiểm tra lại nước hợp lệ rồi đi ngay, không cộng delay. Nếu đối thủ đi khác, dừng nhánh cũ và tìm trên thế mới. Kết quả phải khớp cả thế cờ, phía đi, tab, ván và số threads hiện cho phép.
- Menu thời gian mặc định **Tự động <=10 giây**: <=4 lựa chọn tính tối đa 650 ms; <=12 lựa chọn tối đa 2,5 giây; nhiều hơn có thể tới 10 giây. Engine có thể kết thúc sớm theo độ sâu/độ ổn định. Không cộng thêm 5 giây sau khi engine tính xong nữa. Nước book vẫn chờ ngắn 120–1400 ms; nước duy nhất hợp lệ bỏ qua engine.
- Đo CPU **toàn máy** từ `os.cpus()` mỗi 2 giây. Nếu >70% liên tục 10 giây: giảm một nửa số threads hiệu lực, nghỉ ponder ít nhất 15 giây, mỗi lượt sau tính <=2 giây, sâu <=16, MultiPV từ 2 xuống 1. Nếu vẫn >70%, xét giảm tiếp mỗi 10 giây. >=85% thì về 1 thread, ngừng lượt tính hiện tại sớm và nghỉ ponder ngay ở lần đo kế tiếp.
- Chỉ tăng lại khi CPU <50% liên tục 15 giây, sau đó tăng từng thread với khoảng cách >=10 giây. Không vượt số thread người dùng đặt hoặc khoảng 60% số CPU logic. Thay threads khi engine đã ngừng, không đổi giữa lúc tìm kiếm.
- Màn hình hiện CPU, threads hiệu lực, trạng thái giảm tải/nghỉ ponder và báo **trúng nhánh tính trước**. Bộ điều khiển chỉ giảm tải của bot, không kiểm soát CPU do ứng dụng khác tạo ra; không đo nhiệt độ và không cam kết giữ tổng CPU dưới 70% tuyệt đối.
- Dừng bot, đổi bàn, kết thúc ván, gặp popup hòa hoặc tắt ponder sẽ hủy tác vụ phù hợp; đánh giá lời cầu hòa luôn tính mới, không dùng cache ponder.

Đã kiểm tra Pikafish thật: giữ cùng PID giữa các lượt; đúng dự đoán dùng cache/ponderhit; sai dự đoán tìm lại đúng thế; nghỉ giữa các đợt, đổi ván và Dừng không dùng kết quả cũ. Kiểm tra CPU dùng số liệu giả lập theo thời gian, không cố tình gây tải cao cho máy. Bộ kiểm tra extension thật trên bàn mô phỏng đo một lần trúng ponder phản hồi khoảng 435 ms từ khi đối thủ đi (gồm nhịp kiểm tra bàn); không phải cam kết thời gian trên Ziga thật.

### Hòa cờ — 0.5.0

Menu có hai tùy chọn mặc định tắt: **Tự nhận/từ chối cầu hòa theo engine**, **Tự đề nghị hòa khi cân bằng lâu**. Chỉ hoạt động khi bot đi quân đang bật. Reload extension, tải lại Ziga và khởi động lại bridge để dùng; không cần book hòa riêng. Bridge cũ thiếu thông tin xác nhận điểm không phải bound thì bot giữ quyết định hòa cho người dùng, không tự chấp nhận.

- Khi nhận đúng popup cầu hòa của Ziga, tạm dừng nước đang tính/chờ và đánh giá lại thế cờ bằng Pikafish (1,2 giây, depth tự do, bỏ book). Cần kết quả chính xác không phải bound, đạt sâu >=14. Điểm quy đổi về phía mình: <=+30 cp thì đồng ý, >+30 cp thì từ chối để giữ lợi thế; có mate thắng thì từ chối, mate thua thì đồng ý. Chưa đủ độ sâu, mất kết nối hoặc dữ liệu không rõ: giữ popup để người dùng quyết định, không mặc định chấp nhận. Quy đổi dấu đúng cả lúc đối thủ đang đi và khi cầm Đen.
- Chỉ thao tác đúng popup có thông điệp cầu hòa; không chạm popup đầu hàng, mua tim hoặc popup lạ. Đồng ý dùng nguyên callback của nút Đồng ý, gỡ callback từ chối khi đóng để không gửi hai câu trả lời. Đọc lại bàn/popup sau phân tích; Dừng, đổi bàn hoặc đề nghị không còn thì không gửi kết quả cũ.
- Tự đề nghị: chỉ đến lượt mình, >=40 lần đổi thế cờ đã quan sát; 4 kết quả engine liên tiếp sâu >=14 trong ±20 cp; đồng thời ít quân tấn công (<=4 xe/mã/pháo/tốt hai bên cộng lại) hoặc >=40 thay đổi thế không ăn quân. Tối đa 2 đề nghị mỗi ván, cách nhau ít nhất 60 giây và 10 thay đổi thế. Nước book không dùng để quyết định hòa.
- Đây là heuristic thương lượng hòa, không phải chứng minh hòa. Điểm gần 0 chưa đảm bảo không thể thắng. Ziga quyết định kết quả chính thức. Bridge hiện gửi từng FEN với đồng hồ mặc định, chưa truyền lịch sử ván đầy đủ; vì vậy không tự tuyên bố hòa theo lặp nước/60 nước. Tablebase tàn cuộc, nếu bổ sung sau này, là nguồn kết quả chuyên biệt chứ không phải book khai cuộc.

Kiểm tra gồm chính sách điểm hai phía, từ chối mate thắng, dữ liệu book/nông/bound không được chấp thuận tự động, đúng callback một lần, kết quả cũ và giới hạn cầu hòa. Trình duyệt mô phỏng dùng phản hồi điểm có kiểm soát cho các tình huống nhận/từ chối; không thay thế xác nhận trên popup Ziga thật.

### Không giữ bàn chờ — 0.4.4

Khi Tự chơi đang bật: nếu chỉ có mình ngồi trong bàn liên tục 3 giây, hoặc đã gửi Sẵn sàng mà đối thủ vẫn chưa sẵn sàng sau 3 giây, bot yêu cầu rời bàn rồi tìm bàn khác. Với chủ bàn, thời gian chờ đối thủ được tính từ lúc nhận diện trạng thái chủ bàn đang chờ. Không gửi lặp yêu cầu rời; không rời ván đã bắt đầu. Hủy mốc chờ khi đối thủ đến/sẵn sàng; người xem không tính là người ngồi chơi.

Bàn rời vì hết hạn chờ được bỏ qua trong phần còn lại của phiên Tự chơi; nếu không còn bàn khác phù hợp thì chờ tại sảnh, không vào lại bàn cũ. Tắt rồi bật Tự chơi sẽ xóa danh sách bỏ qua. Thay đổi này chỉ cần Reload extension và tải lại Ziga, không cần đổi bridge.

### Giữ chế độ qua lúc đồng bộ bàn — 0.4.3

Tự chơi và công tắc engine đang bật tiếp tục giữ nguyên khi vào bàn, chờ đủ hai người, sẵn sàng và sang ván sau. Bàn thiếu thông tin người chơi trong lúc chuyển cảnh sẽ chờ đồng bộ tối đa 20 giây, thay vì tắt ngay và yêu cầu bật lại. Không lưu công tắc qua tải lại trang. Hai công tắc vẫn độc lập: tắt bot đi quân không tự tắt Tự chơi, và ngược lại.

### Sẵn sàng — bản 0.4.2

Chờ đủ hai người ngồi (người xem không tính), sau đó đếm ngược ngẫu nhiên 1–1,5 giây để sẵn sàng/bắt đầu. Hủy đếm ngược nếu đối thủ rời bàn hoặc trạng thái đổi. Ngoài cờ vai trò, kiểm tra nút Cocos `mb` đang hiện và hoạt động để xử lý trường hợp trạng thái chưa đồng bộ. Không gửi lại khi chưa có xác nhận. Dòng trạng thái tự chơi hiển thị số ghế, trạng thái bàn, vai trò và nút hiện/ẩn để chẩn đoán ván thật. Đã kiểm tra logic và extension trong bàn mô phỏng; cần người dùng xác nhận lại lỗi sẵn sàng trên Ziga thật. Reload extension **và tải lại tab Ziga** để thay code đang chạy.

## Cập nhật 0.4.0 — thời gian linh hoạt và chọn game

Mục này thay thế các thông số thời gian/MultiPV của bản cũ bên dưới.

- Bật **Tự chơi** từ màn hình chọn game: tự gọi đúng nút **Cờ tướng**, không chọn Cờ úp hoặc game khác. Nếu đang ở màn hình CAPTCHA/đăng nhập thì chờ người dùng tự hoàn tất rồi tiếp tục. Hai cặp nút vẫn độc lập; bật cả Tự chơi và Bật tự đánh để tự vào bàn và đánh.
- Một nước hợp lệ: gửi sau bước xác nhận bàn ổn định (~0,5 giây), không gọi engine và không chờ thêm. Có 2–4 nước và tính nhanh: chờ thêm 0–250 ms. Book: 120–1400 ms. Nước vượt trội, ổn định: 150–900 ms.
- Thế nhiều lựa chọn, tìm sâu >=18 và hai phương án gần điểm: chờ thêm ngẫu nhiên 2,2–5 giây. Trường hợp khác thay đổi theo lựa chọn/độ sâu. Độ trễ sau kết quả luôn <=5000 ms, cộng riêng thời gian engine tính. Tab nền/máy bận có thể khiến trình duyệt xử lý trễ lịch timer.
- Pikafish dùng **MultiPV 2**, so sánh điểm cp cùng độ sâu. Có thể dừng sớm khi nước đầu ổn định qua >=3 lần tăng độ sâu, sâu >=8, hơn phương án hai >=120 cp, và đã tính ít nhất 250–600 ms tùy ngân sách. Không suy đoán chênh lệch khi thiếu phương án hoặc có điểm mate. Đây là heuristic, không đảm bảo thế đã được giải xong.
- Đã đạt **27 kiểm tra Node** và kiểm tra extension thật trong Edge với bàn/sảnh mô phỏng: home → Cờ tướng → vào bàn → sẵn sàng → đánh → rời → ván tiếp; hai công tắc độc lập; hủy trong lúc tính/chờ; nước bắt buộc không gọi engine. Chưa thử lại toàn chuỗi mới trên Ziga thật.
- Kiểm tra trình duyệt chạy bridge cổng riêng, không chiếm bridge của người chơi. Sau cập nhật: Reload extension, tải lại Ziga; đóng cửa sổ bridge cũ rồi chạy lại `start-bridge.cmd`. Bước tự khởi động lại bridge bị duyệt tự động từ chối, nên bridge đang chạy chưa được thay thế.

Thử nghiệm nằm riêng trong `experiments/ziga-extension`; không sửa engine, book hoặc code ứng dụng chính.

## Chạy bản mới

1. Chạy `start-bridge.cmd` trong thư mục này. Giữ cửa sổ đó mở khi dùng bot. Bridge chỉ nghe `127.0.0.1:17864`.
2. Mở `chrome://extensions` hoặc `edge://extensions`. Nếu đã cài bản cũ, bấm **Reload**. Nếu chưa cài, bật Developer mode, chọn **Load unpacked** và chọn thư mục `extension` trong đây.
3. Tải lại tab https://zigavn.com/ trong trình duyệt thường, tự xác minh CAPTCHA nếu có, vào bàn Cờ tướng.
4. Chỉnh menu rồi bấm **Bật tự đánh**. Bấm **Dừng** hoặc **Esc** để ngừng. Bot mặc định tắt. Chế độ thường chỉ đánh trong ván; chế độ liên tiếp (tùy chọn ở dưới) có thể vào bàn/sẵn sàng/chơi tiếp. Không xử lý CAPTCHA.

## Menu

- **Thời gian tính:** 0,65 / 1,2 / 2,5 / 5 giây mỗi lượt; mặc định 1,2 giây. Khởi động tiến trình engine có thêm độ trễ, không tính vào ngân sách tìm kiếm.
- **Độ sâu tối đa:** 0–64. Giá trị 0 chỉ giới hạn theo thời gian. Giá trị lớn hơn 0 dùng cả `go movetime ... depth ...`: engine dừng khi chạm một trong hai giới hạn; có thể chưa đạt độ sâu đặt nếu hết giờ.
- **Threads:** 1–16, mặc định 2. Dùng 1–2 nếu muốn máy nhẹ; tăng theo CPU thực tế. Đổi thiết lập áp dụng từ lần tính tiếp theo, không thay đổi tác vụ đang chạy.
- **Ưu tiên book:** tắt hoặc 3 / 4 / 5 lượt đầu **mỗi bên**, mặc định 5 (tối đa 10 nước của hai bên cộng lại). Chỉ chọn nước hợp lệ trong book; không có thế phù hợp thì dùng Pikafish ngay. Thiết lập depth/threads không ảnh hưởng khi đã lấy được nước book.
- Dòng trạng thái cho biết nước đến từ **Opening book** hay **Pikafish**, cùng độ sâu thực tế, threads, số nút và thời gian.

## Engine và book đang dùng

- Engine: `assets/engines/pikafish2026/pikafish-avx2-2026-01-02.exe`, nhận dạng UCI `Pikafish 2026-01-02`. Chạy trong thư mục engine để tìm `pikafish.nnue`; Hash 64 MB, MultiPV 1. Có thể đặt biến môi trường `ZIGA_ENGINE_PATH` trước khi chạy bridge để đổi executable cục bộ.
- Book: `assets/books/opening-book.json` hiện có (22.963 thế). Bridge chỉ lập chỉ mục phần khai cuộc tối đa 5 lượt mỗi bên, bỏ qua đồng hồ FEN khi tra. Chọn theo count giảm dần, rồi score giảm dần; không sửa file book.
- Khi cầm Đen, adapter chuẩn hóa bàn hiển thị về tọa độ/màu chuẩn để tra book và chuyển nước về đúng phía. Nước từ book lẫn engine đều kiểm tra lại bằng luật cờ ở bridge và extension.
- Nếu book lỗi hoặc không có nước hợp lệ: dùng engine. Nếu engine/bridge lỗi: dừng bot và báo lỗi, không âm thầm dùng engine JS yếu.

## Kiểm soát kết quả cũ

Extension tính bất đồng bộ, kiểm tra lại bàn trước khi gửi. Dừng bot, đổi bàn hoặc thay đổi thế cờ trong lúc tính sẽ hủy tác vụ; callback cũ không được gửi nước. Sau khi gửi nước, chờ bàn đổi; không tự gửi lại, dừng nếu không thấy thay đổi sau 8 giây. Một bridge chỉ nhận một tìm kiếm đồng thời; tab khác nhận thông báo bận.

Mỗi lượt cần engine tạo tiến trình riêng và kết thúc sau khi nhận kết quả, lỗi, hết thời gian hoặc hủy. Extension dùng service worker với quyền duy nhất tới `http://127.0.0.1:17864/*`; không gọi localhost trực tiếp từ trang HTTPS. Không cần server của app hoặc Electron.

## Kiểm tra đã thực hiện ngày 28/10/2026

- 23 kiểm tra Node: tọa độ, đảo bàn, book/giới hạn khai cuộc, FEN lỗi, nước hợp lệ, Pikafish thực tế cả hai bên, depth/threads, timeout, hủy tiến trình, HTTP/CORS và khóa đồng thời.
- Cài extension thật trong Edge thử nghiệm bằng Playwright, chạy toàn chuỗi MAIN → content relay → service worker → localhost → book/Pikafish → gửi nước trên **bàn cờ mô phỏng có kiểm soát**. Kiểm tra thiết lập menu đi tới engine, dừng khi đang tính, hủy khi bàn đổi và không gửi nước cũ.
- Chưa thử lại toàn bộ phiên bản native/book trong một ván Ziga thật. Bản adapter trước đó đã được người dùng xác nhận hoạt động; lần kiểm tra trang thật trước đó gặp CAPTCHA. Tên thuộc tính rút gọn của Ziga có thể đổi theo phiên bản.

## Phát triển

`npm install`, `npm test`, `npm run build`. Build có thể dùng esbuild đã cài ở dự án gốc; bridge không có dependency npm ngoài Node.js. `node native-server.mjs` tương đương `start-bridge.cmd`. Sau khi sửa server hãy khởi động lại bridge; sau build hãy Reload extension và tải lại tab.

`src/engine.js` giữ engine JS cũ để thử nghiệm và dùng hàm sinh/lọc nước hợp lệ; bot hiện lấy quyết định từ book hoặc Pikafish. `vendor/` là bản sao luật cờ độc lập từ ứng dụng.

## Độ trễ trước khi đi quân (0.2.1)

Sau khi book hoặc engine trả kết quả, bot chờ thêm theo số nước hợp lệ ở thế cờ và độ sâu thực tế, không dựa vào số lượt đã chơi. Một lựa chọn: 0,5 giây; 2–4 lựa chọn: 0,7–1,2 giây; nhiều lựa chọn: khoảng 1–4,8 giây tùy độ sâu. Ví dụ 20 lựa chọn, sâu 20: chờ thêm 2,2 giây. Đây là số nước hợp lệ, chưa phân biệt được thế có nhiều nước hợp lệ nhưng chỉ một nước tốt. Menu hiển thị đếm ngược. Dừng/đổi thế cờ/đổi lượt trong lúc chờ sẽ hủy nước; đọc lại bàn ngay trước khi gửi. Đã kiểm tra trên extension thật với bàn mô phỏng: chưa gửi ngay, Dừng khi đang chờ và bàn đổi khi đang chờ đều không gửi nước cũ.

## Tự chơi liên tiếp — chỉ Cờ tướng (0.3.1)

1. Tự vượt CAPTCHA và vào sảnh **Cờ tướng** trước. Bấm **Bật tự chơi** để tự vào/sẵn sàng/rời bàn; bấm thêm **Bật tự đánh** để engine đi quân. Hai phần bật/tắt độc lập và mặc định đều tắt.
2. Đặt `Tim tối đa / bàn`, mặc định 1. Chỉ chọn bàn 2 chỗ, chưa bắt đầu, không mật khẩu và trong giới hạn tim/số dư. Ưu tiên bàn đã có một người. Không tự đổi sang Cờ úp hoặc game khác.
3. Bot ngồi vào ghế trống, gửi sẵn sàng; nếu là chủ bàn và đối thủ đã sẵn sàng thì bắt đầu ván. Khi trạng thái trang xác nhận ván kết thúc, chờ 4 giây rồi yêu cầu rời bàn; sau đó tìm bàn tiếp. Không rời một ván đang chơi chỉ vì hết tim.
4. Muốn nhận tim tự động, bật riêng `Hết tim: tự mở quảng cáo nhận tim`. Mặc định tắt. Chọn giới hạn 1–10 quảng cáo mỗi phiên Bật, mặc định 3. Mỗi quảng cáo chỉ gọi entrypoint rewarded chính thức của Ziga một lần, chờ số tim do trang cập nhật tăng lên mới tiếp tục. Không gọi callback hoàn thành, không gửi gói nhận thưởng trực tiếp, không bấm nội dung quảng cáo hay nút mua tim. Nếu tab bị ẩn thì chờ đưa tab ra trước.
5. Quảng cáo không tải, yêu cầu thao tác tay, không được cộng tim sau 120 giây, popup chưa nhận diện, thao tác không được xác nhận sau 20 giây hoặc đổi game: dừng/báo trạng thái để người dùng xử lý. **Tắt tự chơi** ngừng tự vào/sẵn sàng/rời bàn và mở quảng cáo, giữ nguyên công tắc engine. **Dừng** chỉ dừng bot đi quân, giữ nguyên công tắc tự chơi. **Esc** dừng cả hai phần. Không tự đóng quảng cáo đang hiển thị.

Đã chạy 23 kiểm tra Node và kiểm tra extension thật trên Edge với sảnh/bàn mô phỏng: vào bàn–sẵn sàng–đánh–kết thúc–rời–ván tiếp; đổi sang Cờ úp không phát sinh thao tác; một yêu cầu mở quảng cáo rồi chờ xác nhận tim. **Chưa thử tự chuyển bàn hoặc quảng cáo thật trên Ziga.** Không đảm bảo quảng cáo cho phép mở thiếu thao tác chuột thật; khi gặp trường hợp đó cần xem thủ công. Bộ chọn lobby dùng cấu trúc client công khai v139, có thể cần cập nhật khi trang đổi phiên bản.
Bản 0.3.1 đã kiểm tra hai cặp nút độc lập trên extension: Dừng bot vẫn giữ tự chơi, Tắt tự chơi vẫn giữ bot đang bật. Để ngừng mọi thao tác dùng Esc hoặc tắt cả hai phần.

Để chạy các script kiểm tra trình duyệt trên máy khác, cài Playwright bằng `npm install --no-save playwright` trong thư mục thử nghiệm. Script dùng Chrome/Edge đã cài trên máy; nếu thiếu, cài trình duyệt tương ứng trước khi chạy.
