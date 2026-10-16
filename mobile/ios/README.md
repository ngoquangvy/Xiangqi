# iOS Preview / Sideloadly

Shared UI and game rules stay in mobile/src and src/core. Only native engine,
book and durable session adapters live in ios/App/App. Do not copy the rules.

## Download And Install

1. In GitHub, open Actions -> iOS IPA for Sideloadly on the master branch.
2. Wait for a green run. Download the xiangqi-ios-sideload-N artifact.
3. Extract its ZIP. The install input is xiangqi-ios-unsigned.ipa, NOT the ZIP,
   the diagnostics archive or a Simulator .app.
4. Open that IPA in Sideloadly on Windows and sign/install with your own Apple ID.
   No Apple ID, password, certificate or signing key is needed by this repository.
5. Keep the bundle identifier and Apple ID consistent when updating. Avoid
   uninstalling the app if you want to retain its locally saved game.

Free-account signing typically expires after seven days. Use Sideloadly refresh
as needed. These unsigned builds are not for direct installation, TestFlight,
or App Store submission. Test on a physical iPhone before making release claims.

## Build And Checks

The macOS-only command is `npm run ios:build` in mobile. CI installs the pinned
Capacitor packages, checks unit tests/source budgets, builds both native SDK
libraries, and runs the Debug app on an actual iPhone Simulator/WKWebView.
Only a passing Simulator smoke permits creation of the Release device IPA.

The smoke checks five real Pikafish PVs, the packaged book, offline glyph font,
selection at 0/N, navigation, help, a real move, native save and process relaunch.
Diagnostics include screenshots, JSON reports and simulator logs. This is not
a battery, thermal or low-memory benchmark and does not simulate finger input.

## Ownership

- PikafishSession.cpp wraps the pinned upstream C++ Engine API, not a spawned
  process, stdin redirection, or a duplicate search implementation.
- Native stop invalidates output immediately; a serial control queue waits
  for the previous search before reconfiguration. No search runs on the UI thread.
- On background, native code cancels work and releases engine memory. JS also
  tracks app state and rejects obsolete request IDs.
- AnalysisAssets verifies NNUE/book hashes in bounded chunks; SQLite reads
  one position at a time. The book queue is independent of engine searches.
- LocalSession writes an atomic private file, acknowledges completed writes
  and preserves the same versioned save envelope as Android.
- Debug-only smoke is opt-in via launch arguments; Release cannot run it.

The NNUE license and GPL are bundled with the exact upstream source. Linking
the GPL engine into the app requires a distribution-license review before
public/commercial release; including source alone is not a compliance guarantee.
NNUE commercial use needs permission under the bundled license. These are
prototype test artifacts, not a declaration of App Store eligibility.

## Physical iPhone Checklist

- Open the app offline; confirm all 32 pieces and correct font/board lines.
- Make a move; undo/redo, flip, language and sound toggle must work.
- Select engine/book: highlight only; Next replays, board touch/X returns.
- Reopen help via ?. Relaunch and confirm game/preferences survived.
- Lock/background during analysis; return and confirm no frozen controls or
  stale lines. Try each preset and note memory pressure, heat and battery use.
- If a failure occurs, report iPhone model/iOS, build number, exact steps and
  screenshots or Sideloadly device logs. Do not include account credentials.
