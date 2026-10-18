# Xiangqi Mobile 0.1

[Kết quả kiểm tra và giới hạn bản thử](QA.md).
[Kiểm tra dữ liệu book và hướng sửa bộ chuyển đổi](BOOK-REVIEW.md).
[Bản iOS, CI và cài bằng Sideloadly](ios/README.md).

Bản thử Android chạy offline. Dùng lại core tại `../src/core`, không sao chép
luật cờ, không dùng Electron IPC hay backend web của bản desktop.

## Đã có

- Chạm quân, xem ô hợp lệ, chạm đích để đi; hỗ trợ lật bàn.
- Undo/redo, chọn một vị trí trong lịch sử, xác nhận trước khi ghi đè nhánh cũ.
- Nút `+ Ván mới / New game` nằm ngay dưới bàn, cạnh tiến/lùi, không ẩn trong
  Tùy chọn. Luôn xác nhận trước khi thay ván; hủy không làm mất trạng thái xem thử.
  Xác nhận xóa lịch sử/redo/đánh dấu, thoát mô phỏng và thu bảng để hiện bàn lớn;
  giữ lựa chọn ngôn ngữ, âm thanh, chiều bàn và cấu hình engine/book.
- Xem thử nước gợi ý; không có nút đánh thay và không tự lưu thành nước thật.
- Chạm gợi ý engine/book chỉ đánh dấu hai ô và tô nổi dòng đã chọn, chưa đi
  quân. Bàn giữ thế thật ở `0/N`; biến được chốt khi chọn, không đổi theo engine.
- Chọn hàng không vào chế độ mô phỏng và không dừng engine. Chạm bàn lúc này
  chọn được quân ngay; chỉ nhấn `›` mới bắt đầu mô phỏng. Khi đã mô phỏng,
  chạm bàn vẫn chỉ thoát về ván thật để tránh đi nhầm trên hai thế khác nhau.
- Xem biến engine/book bằng `‹ / › / ×`: nhấn `›` mới đi nước đầu, tiến/lùi
  trên bản sao riêng, `×` trở về ván gốc. Dùng chung hàng điều hướng dưới bàn,
  bàn giữ nguyên kích thước; nút lật `⇅` nằm gọn trên đầu trang.
- Nút `?` cạnh tab mở hướng dẫn Việt/Anh không khóa bàn hay điều hướng.
  Lần chọn đầu tự hiện hướng dẫn; chỉ nhớ đã xem sau khi nhấn `Đã hiểu` hoặc
  thực sự tiến một nước bằng `›`. Có thể mở lại bất cứ lúc nào.
- Chạm bàn khi xem thử sẽ thoát mô phỏng và về ván thật; lần chạm đó không
  chọn quân, không đi nước, không ghi đè lịch sử hay phát âm thanh.
- Nước vừa đi có viền vàng; nước đầu mới chọn trong phân tích có màu xanh ngọc,
  tắt màu riêng sau khi tiến/lùi. Undo/redo, đi nước mới và reset không giữ dấu cũ.
- Chấm đỏ/xanh dương báo bên đi (xanh dương là bên quân đen); chiếu bí hiện bên
  thắng. Tướng bị chiếu có lớp đỏ mờ nhấp nháy nhẹ, tôn trọng reduced motion.
  Các tín hiệu không khóa bàn/nút; thông báo thắng không lấy từ điểm mate engine.
- Ghi chú từng nước, tự lưu ván và chiều bàn cờ trên thiết bị.
- Bảng thông tin có tab, thu gọn/mở rộng; bố cục hai vùng khi xoay ngang.
- Giao diện gọn: bỏ các hướng dẫn lặp, một nút mở rộng cạnh tab, nút có nền
  phân biệt và `⇅` để lật bàn. Nước hợp lệ/lịch sử dùng hàng một dòng, vùng
  chạm tối thiểu 44 px; danh sách hợp lệ không phải gợi ý engine.
- Ghi chú thật của ván vẫn được giữ, chỉ thu gọn ô nhập khi chưa cần; Back
  đóng ô ghi chú trước khi thu bảng/thoát app (xem thử vẫn được hủy trước).
- Nút `EN / VI` đổi ngôn ngữ toàn bộ giao diện và lưu lựa chọn. Điều khiển có
  ký hiệu đi kèm chữ; tên quân cho trình đọc màn hình cũng được dịch.
- Nút Back Android ưu tiên đóng hộp thoại, đóng hướng dẫn, thoát xem thử,
  thu gọn bảng, bỏ chọn quân.
- Bàn nâu gỗ và quân màu ngà dùng chung phong cách với desktop/web; font quân
  đóng gói offline, không phụ thuộc font CJK của điện thoại.
- Ba tiếng đi quân/ăn quân/chiếu. Nút loa ở đầu trang bật/tắt và lưu lựa chọn,
  không có thanh âm lượng. Chỉ nước đi thật mới phát tiếng; chiếu được ưu tiên.

**Android có Pikafish 2026-01-02 native và book đã kiểm chứng v3.** Engine,
NNUE và book đóng gói offline; không có server, tải engine hoặc nhập đường dẫn.
Browser preview vẫn không chạy engine native và không giả lập điểm phân tích.
Trong Tùy chọn > Hiệu năng Pikafish, `Tối đa (liên tục) / Maximum (continuous)`
bỏ giới hạn depth và thời gian của app, không tăng giới hạn 2 luồng / 64 MB.
Engine tăng độ sâu theo khả năng thiết bị, không bảo đảm đạt một depth cụ thể;
dừng khi pause, xem thử biến hoặc ra nền. Chế độ này hao pin và có thể nóng máy.
Ba preset nhẹ hơn và mặc định Cân bằng được giữ nguyên.
Thêm `Phân tích sâu (1 luồng) / Deep (1 thread)`: giữ D22, 64 MB và 5 biến,
không cắt thời gian; có thể chờ lâu hơn. Các thay đổi thế cờ chờ ổn định 500 ms
trước khi chạy engine, nhưng hủy công việc cũ ngay. iOS giữ cache khi cấu hình
không đổi, tự giảm còn 1 luồng khi nhiệt tăng và tạm dừng khi nóng cao; chỉ
bỏ hạn chế sau 10 giây trạng thái nhiệt bình thường. Không ghi đè Pause của người dùng.
Điểm engine theo bên đang đi, nước tốt nhất ở trên cho cả đỏ và xanh.
Dòng biến engine không còn bị cắt ở 12 nước: app giữ đủ PV do engine trả về,
với ngưỡng an toàn 256 nước lớn hơn giới hạn nội bộ Pikafish hiện tại (246).
`0/N` là số nước có trong biến đang chọn, khác với `D` là độ sâu tìm kiếm.
Danh sách "nước hợp lệ" khi chọn quân vẫn tách biệt với gợi ý engine/book.
Book lấy từ `assets/books/sources/json/game01-validated.json`: 57.558 thế FEN,
58.350 bản ghi nước đi; native giữ nguyên cả các biến phụ. UI hiện chọn PV
đại diện của mỗi nước, chưa thêm giao diện chọn mọi biến phụ. Bản web/desktop
chưa đổi book mặc định trong đợt mobile này.

## Cấu trúc và quyền sở hữu

| Đường dẫn | Trách nhiệm |
| --- | --- |
| `src/domain/LocalGame.js` | Nơi duy nhất giữ instance core đang chạy |
| `src/domain/PreviewLine.js`, `positionStatus.js` | Bản sao PV/con trỏ riêng và tín hiệu từ snapshot core, không sao chép luật cờ |
| `src/state/AppStore.js` | Selection, tab, preview, điều phối mutation và lưu |
| `src/analysis/` | Điều phối request, pause/lifecycle, loại kết quả cũ, kiểm tra PV bằng core và adapter native |
| `src/ui/AnalysisView.js` | Hiển thị kết quả thật, mở preview, chọn preset/book; không gửi UCI trực tiếp |
| `engine/` | Phiên bản/checksum engine, preset dùng chung JS/Android và điều khoản NNUE |
| `src/storage/` | Bản lưu có version, giới hạn, queue ghi tuần tự và adapter theo nền tảng |
| `src/ui/BoardView.js` | Vẽ bàn cờ, ánh xạ ô, nhận chạm; không tự xử lý luật |
| `src/ui/HistoryView.js` | Danh sách lịch sử từ snapshot |
| `src/ui/MobileApp.js` | Binding DOM và xác nhận thao tác |
| `src/ui/PreviewHelp.js` | Hướng dẫn theo ngữ cảnh, mở lại bằng `?`, không xử lý luật cờ |
| `src/ui/SoundControl.js` | Nối preference/event trong store với bộ phát dùng chung |
| `../src/presentation/`, `../styles/chess-theme.css`, `../assets/sounds`, `../assets/fonts` | Bộ phát, phong cách và media dùng chung, không chứa luật cờ |
| `src/ui/strings.js`, `src/ui/locales/` | Dictionary English/Tiếng Việt và tên quân, không trộn với luật |
| `src/styles/` | Layout, bàn cờ và panel, tách riêng |
| `android/` | Project native Capacitor; cần commit source và Gradle wrapper |
| `tests/` | Test state/storage, ánh xạ ô, browser và Android |
| `dist/`, `artifacts/` | Kết quả build/test, không commit |

Luồng chuẩn: **UI action → AppStore → LocalGame/core → snapshot → render**.
Sau mutation đã commit mới lưu; selection/preview không sửa bản lưu. Board nhỏ
khóa nhập khi mở rộng bảng; preview chỉ nhận chạm để thoát, không nhận nước đi.
UI không được tự sửa board hoặc history.
Mỗi subscriber nhận dữ liệu riêng, không nắm tham chiếu đến state của core.
Android dùng plugin `LocalSession` ghi SharedPreferences bằng `commit()` ngoài
UI thread. Chỉ khi native xác nhận ghi xong mới hiện đã lưu. Browser preview dùng
localStorage; không dựa vào độ bền của localStorage WebView để lưu ván Android.
Plugin chỉ biết một chuỗi session giới hạn 512 KiB, không chứa luật cờ.
Đọc native có timeout và tối đa một lần thử lại nếu mất phản hồi khi reload;
không coi đọc thất bại là ván rỗng, không tự ghi đè dữ liệu. Cài mới trả JSON null
tường minh thay vì mất khóa `value` khi qua JSONObject.

## Chạy và kiểm tra

Từ thư mục gốc cài dependencies desktop bằng `npm ci` để có Electron dùng làm
browser test. Sau đó trong `mobile`:

```powershell
npm ci
npm test
npm run test:ui
npm run preview
```

`preview` chỉ phục vụ file tĩnh trên máy tại `http://127.0.0.1:4173`, không có
backend. Chạy `npm run build` trước nếu chưa có `dist`.

Build APK debug với Node 24+, JDK 21+, Android SDK và NDK r28+.
Chuẩn bị engine lần đầu (hoặc khi đổi phiên bản/checksum/cách biên dịch):

```powershell
$env:ANDROID_NDK_HOME = 'C:\path\to\android-ndk'
npm run engine:prepare
```

Script lấy source upstream ở commit cố định, kiểm tra NNUE đang có tại
`../assets/engines/pikafish2026/pikafish.nnue`, biên dịch ARM64 và x86_64.
Không tự cài NDK hoặc chấp nhận license SDK. Sau đó:

```powershell
npm run android:build
```

Script dò JDK Android Studio và SDK mặc định trên Windows. Có thể đặt `JAVA_HOME`
và `ANDROID_HOME` để dùng môi trường khác. Lần đầu Gradle có thể tải dependencies
và SDK cần thiết; không tự chấp nhận license mới. Trên Windows script dùng thư
mục socket Java trong `artifacts/java-tmp` để tránh đường dẫn TEMP bị ảo hóa.

Build APK chạy lại unit tests, build và browser smoke test trước khi đóng gói.
Kết quả: `artifacts/xiangqi-mobile-debug.apk`. Đây là bản debug để thử, chưa ký
release hoặc chuẩn bị phát hành store. Project iOS nằm trong `ios/`; xem hướng
dẫn CI và Sideloadly riêng, không dùng APK để cài lên iPhone.

## Engine Và Book

- `engine/pikafish.json` pin commit `ce0679e00ee196f7ba17f6ec18941b9a5036f8cf`
  và SHA-256 NNUE. Build kèm source chính xác, GPL, điều khoản NNUE, công thức
  biên dịch và checksum binary. Không sửa source engine upstream.
- APK chứa hai ABI: `arm64-v8a` cho điện thoại và `x86_64` cho emulator. Engine
  là PIE trong thư mục native chỉ đọc do Android cài đặt; không chạy file từ
  thư mục dữ liệu ghi được. Build kiểm tra ELF alignment 16 KiB cho cả hai ABI.
- Một tiến trình, MultiPV 5. Preset Tiết kiệm: 1 thread/16 MB/depth 14/2 giây;
  Cân bằng: 1/32 MB/18/5 giây; Sâu: 2/64 MB/22/10 giây. Dừng khi đạt depth
  hoặc thời gian trước, không tự chạy vô hạn. Thế cờ mới tự được phân tích;
  điều khiển dừng/tiếp tục và engine/book nằm trong Cài đặt, không chiếm hàng
  trong tab phân tích. Hàng điều hướng chỉ hiện khi đang xem biến.
- UI và Android dùng cùng `engine/profiles.json`. Lật bàn, đổi ngôn ngữ,
  chọn quân, ghi chú và bật/tắt book không khởi động lại tìm kiếm.
- Engine nhận starting FEN + chuỗi nước đã commit đến vị trí đang xem, không
  nhận phần redo trong tương lai. Mỗi session/request có ID riêng; native chờ
  bestmove sau stop, rồi readyok trước go mới. Kết quả cũ bị loại ngay ở JS.
- Preview tạm dừng engine, không đổi ván thật. Xuống nền hủy tiến trình để
  nhả bộ nhớ/CPU; mở lại khởi động lại nếu người dùng chưa Pause. Điểm luôn
  theo phía Đỏ; mate và bound không bị biến thành điểm centipawn giả.
  Khi duyệt PV, danh sách kết quả/book vẫn thuộc thế gốc để chọn biến khác;
  con trỏ không chạy engine cho thế mô phỏng. Snapshot scratch khôi phục từ
  bản sao ván đầy đủ, giữ nguyên glyph quân cờ thay vì chuẩn hóa qua FEN.
- Book dùng `game01-validated.json`: 57.558 khóa nguồn,
  54.654 thế sau chuẩn hóa bộ đếm, giữ đủ 58.350 bản ghi nguồn. SQLite tra
  cứu theo bàn cờ + bên đi, không tải toàn bộ book vào WebView. Nước được
  kiểm tra bằng core; BOOK không hiển thị trọng số như điểm engine.
- Preset và bật/tắt book được lưu cùng session cũ, không làm mất ván đã lưu.
  Chạm gợi ý chỉ highlight ở `0/N`; nhấn `›` mới mô phỏng, không commit ván thật.
- NNUE hiện có khoảng 51 MiB; APK debug khoảng 62,7 MiB, ngân sách riêng 75 MiB.
  Ngân sách app JS/CSS 160 KiB và font/audio 256 KiB vẫn giữ nguyên. Khi cài,
  app cần thêm dung lượng cho bản NNUE/book riêng đã kiểm tra checksum.
- Đây là build thử nghiệm theo lựa chọn Pikafish của người dùng. NNUE không
  cho dùng thương mại nếu chưa được phép; GPL của engine là điều khoản riêng.
  Xem `engine/NNUE-License.md`. Quyền phân phối nguồn book cũng cần được xác
  nhận trước khi phát hành. Chưa có engine phụ hoặc adaptive depth.

`npm run test:android:engine` cài APK, **xóa dữ liệu app thử trong emulator**,
kiểm tra PV thật, book parity, pause/preview, undo/redo nhanh, crash/retry,
background và restore. Chỉ chạy trên emulator; để app mở cho test thủ công.
`npm run test:android:feedback` thử màu nước đi, tiến/lùi/reset PV, hai bên
thắng và undo/redo/reset sau chiếu bí bằng chạm thật. Test lưu lại rồi khôi phục
chính xác session native; không thao tác app trong lúc test chạy.
`npm run test:android:help` kiểm tra chọn ở `0/N`, hướng dẫn, nút `?`, Back
và việc ghi nhớ đã xem. `npm run test:android:variations` xác nhận đủ 5 dòng
engine trên cả ba preset, rồi chọn/xem thử dòng thứ 5. Hai test cần session
đã lưu và khôi phục nguyên bản trong `finally`, không dùng `pm clear`.

Khi emulator đã mở, chạy `npm run test:android` để cài APK, thử Back native,
kiểm tra bản lưu sau force-stop và chụp màn hình. Mặc định dùng `emulator-5554`;
có thể đặt `ANDROID_TEST_SERIAL` cho emulator khác. Test này xóa bản lưu của
ứng dụng thử nghiệm trong emulator, không chạy trên điện thoại thật.

`npm run test:android:media` kiểm tra chạm thật và phát cả ba tiếng WAV/MP3 trên emulator.
Khác với smoke test ở trên, test này sao lưu session native, dùng ván tạm rồi
khôi phục nguyên bản trong `finally`; không xóa dữ liệu bằng `pm clear`. Bản dự
phòng nằm trong `artifacts/android-session-backup.json`. Test media cần đã có
một ván lưu sẵn và có phát tiếng ra loa. Không thao tác app trong lúc test chạy.

## Giới hạn và kiểm chứng

- Handwritten source: tối đa 260 dòng và 18 KiB mỗi file; build thất bại nếu vượt.
- HTML/CSS/JS ứng dụng: ngân sách 160 KiB; không tính runtime Capacitor/Android
  được đóng gói trong APK. Dung lượng APK đo riêng.
- Âm thanh và font: ngân sách riêng 256 KiB, build kiểm tra cả license đi kèm.
- Bản lưu: tối đa 512 KiB, ghi chú tối đa 2.000 ký tự; lỗi quota/corrupt save
  phải hiện thông báo. Không tự ghi đè bản lưu lỗi lúc khởi động.
- Browser tests kiểm tra cả ngang/dọc, màn 320 px, safe-area và viewport bàn phím.
- Runtime không gọi API mạng; CSP `connect-src 'none'`. Không nhập transport desktop/server.
- APK không yêu cầu quyền `INTERNET`; phần asset được nạp nội bộ bởi Capacitor.
- Font quân dùng subset LXGW WenKai TC kèm OFL; tiếng Việt giữ font UI hiện có.
  Vẫn cần kiểm tra cỡ chữ lớn và khả năng đọc trên điện thoại thật.
- Dependency runtime được pin trong lockfile. `npm audit --omit=dev` được kiểm tra
  riêng; CLI hiện có advisory mức moderate qua `xcode/uuid` ở dependency dùng
  khi phát triển, chưa áp dụng ép phiên bản xuyên major.
- Core và các thay đổi desktop đang có từ đợt trước được giữ nguyên trong đợt mobile.

## Emulator Audio

Âm thanh emulator đi qua thiết bị phát mặc định của Windows. Có ba mức độc lập:
nút loa trong app, media volume Android, và volume/mixer Windows. `playing` trong
WebView chỉ chứng minh clip đang chạy, không chứng minh người dùng đã nghe qua loa.
Không khởi động emulator với `-no-audio` hoặc `-audio none` nếu cần thử tiếng.

`node scripts/inspect-emulator.mjs` đọc trạng thái âm thanh và kích thước chữ
trên emulator mà không đổi ván. Thêm `--play-sample` để phát một clip kiểm tra,
hoặc `--play-move-sample` để phát riêng `sidestick.wav`, không đi quân hoặc sửa
dữ liệu. Volume Windows không bị app tự ý thay đổi.

`npm run test:android:compact` thử nút mở rộng/Back, lật hai lần, mở/đóng ghi chú
và chọn quân bằng chạm thật. Test dùng ván đang lưu, không đi quân, không chuyển
nước trong lịch sử, không xóa/nhập lại dữ liệu; cuối test đối chiếu game và
preferences với bản ban đầu. Không thao tác app trong lúc test chạy.

## Thứ tự nâng cấp

1. Chốt thao tác và lỗi trên Android thật, thử cỡ chữ lớn và khôi phục dữ liệu.
2. Đo pin/nhiệt, bộ nhớ và tốc độ engine trên điện thoại ARM64 thật; thử thiết
   bị 16 KiB thực tế, không suy ra tương thích chỉ từ ELF alignment.
3. Sau khi một engine ổn mới thêm phân tích nước riêng và adaptive depth.
4. Thêm import/export hoặc engine/book khác theo từng lát nhỏ có regression test.
5. Kiểm tra bản iOS qua CI/Sideloadly và iPhone thật, không suy ra độ ổn định
   từ Android hoặc chỉ từ việc biên dịch thành công.
