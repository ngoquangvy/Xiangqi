# Mobile 0.1 Verification

Date: 2026-10-16. Working tree: `E:/project/Xiangqi/xiangqi-app/mobile`.
The first iteration was confined to `mobile/`. The subsequent wood-board/audio
slice adds shared presentation code and assets to desktop/web/mobile, without
changing core rules or engine transports. Existing unrelated changes are retained.
No commit or push made.

## Checkpoints

1. State and storage: tested before adding views. Covered legal moves, history,
   branching, immutable snapshots, notes and bad/quota-limited saves.
2. Browser UI: tested after binding the board and controls, before packaging.
   Used actual pointer input, then DOM checks for preview/cancel, undo/redo,
   branch/reset confirmation, flip, notes, reload and escaping user notes.
3. Localization: equal translation key sets, language persistence, unchanged
   game/selection/preview, translated accessible labels, symbols alongside text.
4. Android: compiled, installed and tested on the existing Pixel_10 emulator.
   Tested native Back, physical touch coordinates, all 32 pieces, system insets,
   English persistence and a committed move after force-stop/relaunch.

## Final Results

- `npm test` in `mobile`: **40 tests passed**, including engine request/lifecycle
  isolation, PV validation, Red-perspective cp/mate/bounds, fixed preferences,
  old-session IDs, bridge-listener retry/disposal, no-move terminal replies,
  complete web-book indexing parity and the packaged WAV level,
  format/duration regression and real core checking
  captures, commit-only feedback, interruption/mute and legacy save migration.
- `npm run test:ui`: **20 layouts passed** across 320x568, 320x640, 360x800,
  412x915 and 844x390, both languages, collapsed/expanded. Also checked safe-area
  padding and the shortened editor viewport when a keyboard opens.
- Compact UI adds **30 layout cases**, covering board/expanded/preview in both
  languages. Verifies filled buttons, 44 px touch targets, one-line 44 px list
  rows, correct legal count, no old instruction blocks, and the vertical flip
  symbol. At 390x844 at least six full legal-move entries fit before scrolling.
  Also tests note disclosure, accessible side/note labels, and drafts surviving
  expand/flip/language changes. Total: **50 layout checks**.
- Browser UI recorded **0 external network requests** and no console errors.
- Engine-view fixtures additionally verify stable row/icon DOM during streaming,
  retained keyboard focus, selecting the move touched before a PV update,
  rejection after a FEN change, and escaping external book notes. These are UI
  fixtures, not evidence of a browser-native engine; real engine checks are below.
- Browser UI additionally decoded/played all three real WAV/MP3 clips, checked the
  bundled font, silent undo/redo/preview, and persisted mute across reload.
- `npm run android:build`: **BUILD SUCCESSFUL**; unit and UI checks run first.
- `npm run test:android`: **ANDROID_SMOKE_PASS**. Restored English and the
  played move after process death. Native Back cancels preview/collapses the panel.
  Rerun on the compact UI after the user authorized resetting the test game.
- `npm run test:android:compact`: **ANDROID_COMPACT_PASS**. Real touches verify
  expand/Back, vertical-symbol flip, note open/Back-close, compact list rows and
  visible header/footer after focus changes. Outer scroll remains zero. Game
  content and preferences stay unchanged during this display-only test.
- `npm run test:android:media`: **ANDROID_MEDIA_PASS** on the compact UI. Real
  Android touches trigger the sidestick WAV and both MP3 clips; checked mute,
  reload, silent navigation and bundled font. Emulator left open afterward.
- APK requests **no INTERNET permission**. Package ID:
  `com.ngoquangvy.xiangqi.mobile`, version `0.1.0`, min SDK 24, target SDK 36.
- `npm audit --omit=dev` in `mobile`: **0 findings**. Development CLI retains
  moderate findings through `xcode/uuid`; no forced dependency override applied.
- Parent core smoke suite and **19 regression tests** passed, as did
  `npm run test:electron` and `npm run test:web`. Web smoke exercised real
  move/capture/check audio and mute through the browser/service/core path.

## Size and Architecture

- Application HTML/CSS/JS: **61.9 KiB**, below the **160 KiB** build limit.
- Shared font/audio/license media: **248.1 KiB**, below the **256 KiB** media limit.
- Debug APK: about 4.4 MB (exact size varies with the current build).
- Largest handwritten mobile module: under 170 lines. Build enforces 260 lines
  and 18 KiB per source file. Shared core and generated native files are separate.
- Core rules are imported from the parent source, not copied or reimplemented.
- No engine binary, NNUE, book database, remote font or fake evaluation is bundled.

## Bugs Caught During Verification

- Android process-death testing exposed that WebView localStorage could lose
  recent writes while the UI reported saved. Android now uses a small native
  SharedPreferences plugin with synchronous disk commit on Capacitor's background
  plugin handler. JavaScript serializes writes and shows Saving until acknowledged.
- Capacitor's initial CSS safe-area injection logged an error before the document
  existed. Switched to its native inset handling; no vendor code was patched.
- Added explicit keyboard/safe-area layout handling and condition-based test waits.
- Gradle could not create its socket in virtualized Windows TEMP. The build script
  uses a project-local Java socket directory; no global Java/system settings changed.
- The API 37 emulator with 2 GB RAM killed WebView under memory pressure. Final
  native checks used 3 GB RAM; low-memory real-device behavior remains unverified.
- Removed generated sample tests that checked arithmetic or a wrong package name.

## Artifacts and Limits

- APK: `artifacts/xiangqi-mobile-debug.apk`.
- Screenshots: `artifacts/mobile-portrait.png`, `artifacts/android-portrait.png`.
  Inspected board lines, Chinese glyphs, Vietnamese labels and English controls.
- Updated wood-board Android screenshot: `artifacts/android-wood-board.png`.
- Compact browser screenshots: `artifacts/mobile-compact-legal.png` and
  `artifacts/mobile-compact-history.png`. The test waits for painted frames;
  hidden-window captures were initially stale and are not used as visual proof.
- Compact Android screenshots: `artifacts/android-compact-history.png`,
  `artifacts/android-compact-legal.png` and `artifacts/android-compact-ready.png`.
  Final emulator view uses Vietnamese and a fresh game, with a cannon selected
  to show actual legal moves. Original test game was reset with user approval.
- Native interaction testing exposed that focus restoration after opening notes
  and collapsing the panel could scroll the fixed app frame, hiding its header.
  The outer viewport now uses `overflow: clip`; only inner panels scroll. Both
  browser and Android regression checks assert the header/footer stay visible
  and the outer frame's scroll offset remains zero.
- Sound assets are user-supplied; confirm their redistribution rights before release.
- Move audio now uses the user's FL Studio `sidestick.wav`, PCM16 stereo/48 kHz,
  trimmed to 0.30 seconds after its audible decay. A loudness follow-up adds gain
  with oversampled peak limiting: mean -16.2 dBFS, peak -1.49 dBFS; capture/check
  stay unchanged. The old
  putpiece file and its x1.4 boost are no longer used or packaged. Original files
  are untouched. See `../assets/sounds/README.md`.
- Lettering follow-up: switched to an offline LXGW WenKai TC glyph subset and
  reduced mobile lettering by about 20%. All 20 layout cases now assert the font
  em size stays below 64% of the disc diameter, including mini boards.
- Audio diagnostics found app/emulator sessions unmuted, Android media at 5/15
  and Windows master around 12%. Windows CoreAudio measured a nonzero emulator
  signal on the default Realtek output. Raised emulator media to 10/15 without
  changing Windows master; user then confirmed sound was audible. This is host
  configuration, not an app volume slider. The user subsequently supplied the
  sidestick recording to replace the old perceptually quiet move clip.
- Sidestick follow-up: 20 mobile unit tests, 20 browser layouts and web smoke
  passed with the WAV mapping. The new APK was installed without clearing data;
  `inspect-emulator.mjs --play-move-sample` confirmed Android plays the exact
  `https://localhost/sounds/sidestick.wav` asset unmuted through to completion
  (0.30 seconds), without changing the user's game. The preserving but temporarily
  game-replacing full Android media suite was not rerun while the user was playing.
- Loudness balancing: packaged sidestick mean increased from -26.8 to -16.2
  dBFS, with oversampled limiting to about -1.5 dBFS peak. Reference means are
  -13.7 (capture) and -17.1 (check); perceptual matching still depends on the
  different timbres. Added a regression test for PCM16/stereo/48 kHz, duration,
  average level and peak headroom. Capture/check and OS volume are unchanged.
- The Android screenshot contains an existing emulator accessibility overlay;
  it is not part of this app and its settings were not changed.
- No physical phone, older Android/WebView, large OS font scale or iOS verification
  yet. This is a debug prototype, not a store release or an exhaustive rules audit.
- Android now includes the first native Pikafish/book slice; browser preview
  still has no native engine. Import/export, secondary evaluation engine,
  adaptive depth, unlimited continuous search and servers remain outside scope.

## Pikafish And Web Book Slice

- Uses unmodified Pikafish 2026-01-02, commit
  `ce0679e00ee196f7ba17f6ec18941b9a5036f8cf`, compiled with Android NDK r30.
  ARM64 baseline NEON and x86_64 baseline SSE2 are built from that same source;
  no dot-product/AVX requirement is imposed on unknown devices.
- The existing 53,212,941-byte web/desktop NNUE is pinned by SHA-256. APK includes
  corresponding engine source archive, GPL, exact NNUE terms, compiler identity,
  per-ABI binary hashes, profiles and the native build recipe. Engine/NNUE terms
  are separate; commercial distribution and book provenance need review before
  any release. This is the user's selected private development build.
- `verify-engine.mjs` passes: both 64-bit machine IDs, loadable PIE/interpreter,
  16 KiB ELF segment alignment, provenance hashes and source/license presence.
  This is NOT a test on a 16 KiB ARM64 device or proof of store eligibility.
- Web book source: 22,963 keys, 23,751 candidate records. Index: 22,387 unique
  board+turn keys, 10,084,352-byte SQLite database. Full-source unit comparison
  proves every record, PV and UTF-8 note survives counter-key merging. Runtime
  filters illegal roots, truncates invalid PV tails, ranks weights without
  pretending they are engine cp scores, and shows at most eight book rows.
- `npm run test:android:engine`: **ANDROID_ENGINE_PASS** on API 37 x86_64,
  Pixel_10 with 3 GiB RAM. Actual native PV/depth/score output, initial book
  parity, counter-independent lookup, rejected newline/profile injection,
  pause/resume, book preview without commit, committed move and 16 rapid
  undo/redo operations all passed.
- Native engine child was deliberately killed under the test app's UID; UI
  showed an error and Retry launched a working engine. Home released the child;
  foreground return preserved a user Pause rather than silently restarting it.
  Force-stop/relaunch retained game, resource preset and book preference.
- Engine screen additionally passed **12 CDP-emulated viewport cases**: both
  languages, 320x568/390x844/844x390, collapsed/expanded. Checked clipping,
  horizontal overflow, 44 px targets, real result rows and monochrome SVG icon.
  These viewport checks are distinct from real touch tests at the device's
  actual resolution; they do not claim physical-device rotation coverage.
- Existing Android smoke, compact and real WAV/MP3 media tests were rerun with
  the native engine present and passed. APK still has no INTERNET permission.
- Frontend code/styles: about 82 KiB / 160 KiB; font/audio 248.1 KiB / 256 KiB.
  APK about 57.9 MiB / a separate 75 MiB budget. Engine data is not hidden inside
  the old media budget. Build outputs and NDK/source downloads remain ignored.
- `artifacts/android-engine.png` shows the native board and streamed results;
  inspected Vietnamese text and piece font. Emulator remains open on a fresh
  balanced game for manual testing. Previous test games may be reset as allowed.
- Not verified: real ARM64 execution, battery/thermal behavior, low-memory phones,
  API 24/older WebViews, 16 KiB device runtime, iOS or release signing. Presets
  stop at their depth OR 2/5/10-second budget; they do not search indefinitely.

## Board Feedback And PV Navigation

- Removed the engine name, visible score-perspective caption and Analyze button
  from the analysis pane. Engine selection/performance, book and pause/retry
  controls are in Settings. `scoreRed` remains an accessible score tooltip.
- Turn is a red/blue dot (blue represents the black army); a mated position
  replaces the turn-only indication with the actual winner. Check/winner
  signals come from the displayed core snapshot, never an engine mate estimate.
- Last-move endpoints use visible gold borders/outlines. Selecting an engine or
  book PV shows only its first move with a separate cyan highlight. `Previous`
  and `Next` remove that special color, even if revisiting the first move.
- `PreviewLine` owns a scratch core and cursor 0..N, capped at 256 plies. It
  restores the complete serialized root game to preserve original piece glyphs;
  FEN-only reconstruction had changed horse glyphs. Invalid tails stop at the
  last legal ply. Preview states are detached and never stored as live history.
- The shared board control row switches to `‹ / counter / › / ×` in preview.
  X returns to the exact root, including the redo timeline. There is no Apply
  button: preview controls never commit any part of a suggestion.
  Root engine/book suggestions remain available for switching variations.
- Checked kings alone receive a gentle 1.8-second red overlay. Reduced-motion
  users get a static warning. Pseudo-elements have no pointer hit targets;
  check/mate never changes board/control locking. Preview/expanded mode retains
  its existing intentional board lock, independent of all check notifications.
- Added unit checks for PV isolation, invalid tails, first-only highlight,
  cursor bounds, silent/non-persisted navigation, full restoration, legal commit,
  both notification reversal and re-analysis after an engine no-move reply.
- Browser fixtures verify actual gold/cyan CSS, turn markers, navigation,
  check-only king selection, reduced-motion style, both winners, undo/redo/reset,
  flipping and language changes. Existing 50 layout checks still pass.
- Native stress testing exposed an occasional lost first LocalSession reply on
  WebView reload. Startup reads now time out after two seconds and retry once;
  malformed/rejected reads never become an empty auto-saved game. Java emits an
  explicit JSON null on a fresh install. Unit tests cover lost/late replies,
  null, malformed replies and repeated failure; Android smoke checks fresh null.
- Native artifacts: `android-pv-highlight.png`, `android-last-move.png`,
  `android-red-win.png`, `android-black-win.png`. Browser artifacts include
  `mobile-preview-highlight.png`, `mobile-king-check.png`, `mobile-red-win.png`.
  Test fixtures use legal low-material mate-in-one positions for both sides.
- Final APK rerun: ANDROID_SMOKE_PASS, ANDROID_ENGINE_PASS (12 viewport cases),
  ANDROID_FEEDBACK_PASS, ANDROID_COMPACT_PASS and ANDROID_MEDIA_PASS. Real touches
  covered first-only PV highlight, stepping to root, X, manual move, main undo
  after closing preview, both winning sides, terminal engine retry and new-game reset.
  Six consecutive native WebView reloads also passed with the exact session
  unchanged. Final `android-feedback-ready.png` shows the restored initial game;
  emulator is open in Vietnamese with balanced analysis and book enabled.

## Compact Preview And Book Review (Previous Book)

- Engine/Opening book headings are short; note and PV are separate fields.
  Flip moved to the header. Preview uses the existing history arrows plus a
  counter and X, with no Apply footer and no automatic board shrinking.
- All 50 browser layout cases pass, including equal board width before/after
  preview, minimum 44 px controls, 320 px layouts and both languages.
- 42 mobile unit tests pass. Native smoke, engine (17 root book choices,
  12 viewport cases), feedback, compact and media tests pass. A separate
  `test:android:book` replays the real Phan Cung entry past ply 12 to ply 32,
  checks notes plus continuation, and confirms no game/save mutation.
- APK was rebuilt and installed; frontend 81.2 KiB, font/audio 248.1 KiB,
  APK about 57.9 MiB. Source/font corruption guardrails pass.
- The source book is not silently replaced. Read-only `book:audit` and
  `BOOK-REVIEW.md` distinguish display loss from source/converter problems.
  The repaired converter and candidate are documented in `scripts/book/README.md`
  at the repository root; APK still bundles the original default book.

## Validated V3 And Board-Touch Exit

- Android explicitly selects `game01-validated.json` via its engine manifest:
  57,558 full-FEN positions, 58,350 rows, and 54,654 counter-normalized entries.
  Index parity tests compare every field and alternative against the source.
- Scratch replay now supports the converter's 1024-ply bound, including the
  full 322-ply representative. Engine row length remains independently bounded.
  UI still shows a representative PV, not every stored alternative.
- A first board touch exits either engine/book preview, clears selection and
  simulation highlights/status, and collapses an expanded panel. It never
  selects a live piece, moves, sounds, overwrites redo or persists a new game.
  Analysis resumes on the true position unless the user had paused it.
- 46 unit tests and all 50 browser layout cases pass. Android smoke, engine
  (12 viewport cases), book (112-ply actual replay + 322-ply native payload),
  feedback, compact and real audio tests pass; seeded tests restore the session.
- Frontend 81.4 KiB; font/audio 248.1 KiB; APK 62.7 MiB / unchanged 75 MiB budget.
  Installed book DB 52.3 MiB / 64 MiB installed-data budget; one position <=1 MiB.
  Rejected per-position gzip because it exceeded the APK limit; whole-APK
  compression shares repeated PV text more effectively. Native still queries
  SQLite on demand, not an entire JSON book in WebView memory.
- Existing font/encoding guards pass. Real ARM64, battery/thermal, older
  WebViews, iOS and actual low-memory devices remain unverified.

## Select-Then-Step, Help And Five Variations

- Selecting an engine/book row now starts at 0/N: the live board, turn, last
  move, history and redo are unchanged. Cyan endpoints show the selected move;
  the row has an exclusive selected background and aria-pressed state. The
  captured PV and row content are frozen against streaming rank replacement.
- Only Next plays the first scratch move. Previous is disabled at zero; X or
  a board touch clears the selection/preview without playing a live move.
- The first selection opens non-modal coaching. Next successfully advancing
  or Got it marks completion in the existing version-1 session envelope. The
  live game, not scratch state, is saved with that preference. Older sessions
  without the flag remain valid. Opening/closing help alone does not write.
- A persistent ? button opens the guide again, including after completion.
  Guide text follows English/Vietnamese and the current pending/stepped state.
  Android Back/Escape dismiss coaching first without marking it complete.
  The guide overlays only the inspector; board and navigation stay usable.
- MultiPV is now 5 on all presets. Native throttling and final-output buffers
  have five independent slots; the parser/controller accept ranks 1-5 and
  reject rank 6. Unit guards check JS/native limit parity. Time, depth, hash
  and thread budgets are unchanged, so the extra breadth may reduce depth.
- 51 mobile unit tests, 50 baseline/compact layout cases and 8 additional
  non-blocking coaching layouts pass. Streaming-row, keyboard, localization,
  selected-PV freezing, save isolation and font guards also pass. Root core
  smoke tests and all 29 root unit tests pass; no core/desktop changes here.
- The rebuilt APK passes test:android:variations: five distinct final rows on
  eco/balanced/deep and successful selection/replay of row five. It also passes
  test:android:help (real touch, native Back, completion persistence/reopen),
  test:android:book (112-ply replay, 322-ply native data) and feedback checks.
  These native fixtures restore the exact original saved session afterward.
- Frontend 86.1 KiB / 160 KiB; media 248.1 KiB / 256 KiB; APK 62.7 MiB / 75 MiB.
  New artifacts: mobile-preview-help.png, android-preview-help.png,
  android-five-variations.png. The emulator remains open for manual testing.
- Test environment limitation: API-37 Google Play emulator cold boot with
  2 GB RAM triggered Android LOW_MEMORY kills of the app/WebView. Retesting
  uses 4 GB via an emulator runtime argument, without wiping data or changing
  the AVD configuration. This is not a low-memory fix or a phone benchmark.

## New Game Discoverability

- Moved the existing New game control out of Settings into the persistent
  navigation row below the board. English/Vietnamese labels share the same
  plus icon; preview mode retains a compact 44 px icon button with a full
  accessible label. No duplicate reset entry or alternate state path.
- Confirmation cancellation preserves the live game, scratch cursor and saved
  session. Acceptance resets the core, clears redo/preview/highlights/help,
  collapses the panel and saves the initial position, without a move sound.
  Language, audio, orientation, tutorial and analysis preferences remain intact.
- 58 unit tests pass, including persisted reset and rejection of stale engine
  and book responses. The browser suite passes its 50 baseline/compact layouts,
  8 coaching layouts and 6 new preview reset layouts in both languages.
  Existing font, audio, keyboard and selected-row checks also pass.
- The iOS Simulator gate now exercises the visible button, cancellation during
  scratch replay, confirmed native save, fresh five-PV analysis and all 17 root
  book choices before leaving a real move for the process-relaunch test.
  Physical iPhone installation and touch/audio testing remain separate checks.

## Opt-In Continuous Analysis

- Added a fourth, persisted `unlimited` profile. The previous three presets
  and the default balanced profile are unchanged. The zero depth/time pair is
  a sentinel for Android `go infinite` and iOS `LimitsType.infinite`, not a
  D0 search. Threads (2), hash (64 MB) and MultiPV (5) remain bounded.
- Engine-internal MAX_PLY and search safeguards are not modified. Actual depth
  is device/position dependent, not a promise to reach a specific number.
  Settings show a localized battery/heat warning only for continuous mode.
- 60 unit tests cover opt-in/default/persistence, native allowlists, limits
  mapping, high-depth output and pause/preview/background behavior. Browser
  coverage verifies the additional option and conditional warning.
- Android variations and the iOS Simulator gate now require a real search to
  remain active past the former 10-second cap, then stop through the production
  Pause action. Android additionally checks continuous mode background release.
- Verification completed: Android four-profile native test passes, including
  pause, Home/background release, foreground resume and fifth-row touch/replay.
  The original saved session is restored. Tests wait for foreground input focus;
  a first attempt was interrupted by an emulator WebView package update.
- iOS build 5 (`84c0763`) succeeds in GitHub Actions. Simulator initial report
  has pass/newGame/unlimited/font=true, five engine rows and 17 book rows;
  the separate process-relaunch report also passes. Screenshots were inspected.
  Device IPA is unsigned for Sideloadly; physical iPhone behavior is not claimed.

## Full Engine PV Replay

- Fixed the separate `ENGINE_LINE_LIMIT = 12` truncation in the result parser
  and legality validator. Infinite search alone did not address this limit.
  The input safety bound is now 256, above pinned Pikafish MAX_PLY (246).
  Compact visual rows still ellipsize text; their full validated PV is retained.
- 62 unit tests pass. Regression input uses a known legal game to exercise
  parser/validation at 13, 32, 64 and 246 plies, independently of search depth.
  Oversized input still clips at the safety bound, not an unbounded allocation.
- Browser tests feed a 32-ply line through the actual controller and both
  production views: selection shows 0/32, Next reaches 13/32, Previous returns
  to 12/32, and cancellation restores the live game without a session write.
- The iOS smoke report records real engine PV lengths and replay distance;
  it steps to 13 when the selected native line contains that many moves.
- Native verification completed: Android balanced returned a selected 25-ply
  PV and unlimited returned 20 plies; both replayed to ply 13 with real touches.
  All four profiles passed and the original session was restored afterward.
- iOS build 6 (`bdc1213`) passes: five real PV lengths are 22/18/19/13/15,
  selected row five replays to ply 13 and returns to the root. Native save,
  process relaunch, continuous mode, New game and offline font checks pass.
  Reports are in the `ios-diagnostics-6` GitHub Actions artifact.

## Cooler Analysis And Selection Ownership

- Scores now follow the side to move, including cp/mate/bounds; native MultiPV
  rank remains authoritative, best-first for red and blue regardless of flip.
- Engine/book row selection stores a frozen pending line, not a simulation.
  The board stays live and the same first board touch selects a piece. Only
  Next starts scratch replay; an actual scratch board still exits on first touch.
- Position changes immediately stop/invalidate old work, then wait 500 ms for
  the latest position. Pause, background, thermal block and disposal cancel
  pending timers. UI-only changes do not postpone the trailing-edge deadline.
- Added optional deep_cool: 1 thread, 64 MB, D22, no time cutoff, still 5 PVs.
  Existing presets/default are unchanged. This trades response time for a lower
  parallel CPU load, not a guarantee of lower total energy or equal evaluations.
- Native option caching avoids repeated EvalFile/Threads/Hash/MultiPV writes.
  Worker callbacks now capture session-owned output buffers, not prior-search
  stack locals, because workers are reused instead of recreated each search.
- iOS observes public ProcessInfo thermal notifications. Fair limits to one
  thread; serious/critical blocks native search. Ten stable nominal seconds
  are required to remove limits/resume. User pause/background/preview still win.
  Thermal tests inject states only into Debug; the Release binary is checked
  for absence of the test hook. Physical temperature/battery remain unmeasured.
- Unit and browser suites pass, including a real DOM one-touch piece selection,
  13-ply replay, font/audio checks, both languages and small-screen layouts.
  CI additionally runs standalone C++ cache and Swift thermal-policy assertions
  before the native Simulator integration and Release packaging checks.
