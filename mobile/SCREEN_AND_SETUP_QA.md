# Home, Settings And Position Setup

## Boundaries

- Home exposes Analysis and Settings only. There are no Online/Puzzle placeholders.
- Settings owns language, sound, engine performance and opening-book preferences.
- ApplicationShell owns transient navigation; AppStore owns the saved game.
- AnalysisController has independent screen, foreground, preview and thermal gates.
- PositionDraft owns an isolated editor board. Incomplete drafts never reach native Pikafish or storage.
- A confirmed Use position creates a new starting FEN and clears history. Cancel and Android Back preserve the game and redo.

## Editor Controls

- Starts from the committed live position, including when launched from a variation preview.
- Move: tap an existing piece, then its destination. Pieces can be rearranged without following a playing move's path.
- Red/Black: choose the palette side. Tap an available palette piece, then a board square.
- Erase: remove individual pieces. Clear removes all pieces except both generals (restores a missing general at home).
- Full board restores the standard 32-piece draft with Red to move.
- Inventory reflects the actual draft. A full piece type is dimmed and cannot be selected.
- Placement enforces maximum counts, general/advisor palace squares, reachable elephant squares, and pawn side/file restrictions.
- Applying also requires exactly one general per side, no facing generals, and no check against the side not to move. Starting with the side to move in check is allowed.
- New game still returns to the standard starting position, not the last custom setup.

## Verification

- `npm test --prefix mobile`: 76 passing unit tests, including seven setup/gating regressions.
- `npm run test:ui --prefix mobile`: Home/Settings/editor + 50 existing layout combinations, preview help, media playback, board feedback, restore, XSS and long PV replay.
- `npm run android:build --prefix mobile`: Debug APK built, 62.7 MiB / 75 MiB budget.
- `npm run test:android:screens --prefix mobile`: passed on Pixel_10/API 37; real taps, native engine idle on Home/Settings/setup, inventories, Clear, native Back, confirmation, custom FEN analysis/save. Original native session restored afterward.
- `npm run test:android:help --prefix mobile`: passed with the new Home/Settings navigation.
- `npm run test:android:variations --prefix mobile`: all five native presets returned five independent lines; replay through ply 13 verified for Eco/Balanced/Deep/Maximum. Maximum also verified beyond 11 seconds, Settings stop/resume and OS background/foreground. One-thread Deep was checked for five available lines, without assuming a hardware-dependent depth.
- Handwritten source guard: 260 lines / 18 KiB per module. Frontend about 105 KiB / 160 KiB; existing media 248.1 KiB / 256 KiB.
- iOS simulator regression is extended with Home/Settings gates, setup cancel/apply and actual custom-position analysis. Its result must be confirmed in the GitHub build; a Windows/Android pass is not an iPhone test.

## Limits

This is a position editor for analysis, not an endgame collection, game-versus-engine mode, FEN text editor or puzzle solver. Whole-game historical reachability is not proven; local piece placement and immediate position legality are checked. Device temperature/battery and physical iPhone interaction still require manual testing.
