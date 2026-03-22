# Xiangqi App - Change Notes and Common Mistakes

Updated: 2026-03-22

## Why this note exists
This file tracks important fixes and mistakes we met, so future edits do not repeat the same issues.

## 1) Main process crash (EPIPE) when logging engine output
- Symptom:
  - App shows "A JavaScript error occurred in the main process"
  - Error contains: EPIPE: broken pipe, write
- Root cause:
  - Writing logs while output stream is closed/broken can throw EPIPE.
  - Engine stdout can be noisy, increasing logging pressure.
- Fix:
  - Use safe logging wrappers in `main.js` to avoid crash on broken output pipe.
  - Add `VERBOSE_ENGINE_OUTPUT` flag (env `XQ_ENGINE_LOG=1`) to print raw engine stdout only when needed.

## 2) UI slow render because of many IPC calls
- Symptom:
  - Board redraw is slower than expected, especially on repeated updates.
- Root cause:
  - `renderPieces` requested each square through IPC (`getPiece`) many times.
- Fix:
  - Add `getBoardSnapshot()` in `game.js`.
  - Expose `getBoard` in `preload.js`.
  - In `ui.js`, fetch board once per render and draw from local snapshot.

## 3) Duplicate preload API definitions
- Symptom:
  - API object had repeated keys for engine callbacks, easy to confuse and risky to maintain.
- Root cause:
  - Same methods defined in two places in `contextBridge.exposeInMainWorld` object.
- Fix:
  - Keep one callback-cache style implementation and remove duplicate definitions.

## 4) Board border and layer overlap (visual)
- Symptom:
  - Thin border line looked hidden on top/left/bottom while right side looked visible.
- Root cause:
  - Draw order and stroke placement caused parts of border to be visually covered.
- Fix:
  - Keep double-border drawing with stable order in board drawing routine.
  - Maintain piece calibration values tuned manually by project owner.

## 5) Comment/font corruption risk
- Symptom:
  - Source comments may render broken in some editors due to encoding mismatch.
- Root cause:
  - Mixed encodings or non-UTF8 handling in older edits.
- Prevention:
  - Keep files in UTF-8.
  - For technical notes, prefer ASCII if environment has unstable Vietnamese rendering.
  - Put long explanations in markdown docs (like this file), not only inline comments.

## Changed files in this optimization pass
- `game.js`
  - Added `getBoardSnapshot()`.
- `main.js`
  - Added conditional engine stdout logging via `XQ_ENGINE_LOG`.
  - Added IPC handler `get-board`.
- `preload.js`
  - Removed duplicate engine callback API entries.
  - Added `getBoard` bridge method.
- `ui.js`
  - Optimized `renderPieces` to use one board snapshot per frame.

## How to inspect these changes later
- `git log --oneline --decorate --graph`
- `git show <commit_id>`
- `git blame ui.js`
- `git blame main.js`

## Safe workflow reminder
- Before big UI edits:
  - run `node --check main.js`
  - run `node --check preload.js`
  - run `node --check game.js`
  - run `node --check ui.js`
- Then run app and verify:
  - pieces visible
  - border lines visible on all sides
  - move history still updates after each move

## 6) Undo/Redo only moved pieces but did not sync full UI state
- Symptom:
  - Piece position changed, but move history, last-move markers, and suggestions became out of sync.
- Root cause:
  - Undo/Redo/Reset handlers refreshed board only, not all dependent UI state.
- Fix:
  - Added `syncAfterStateChange()` in `ui.js` to centralize post-state refresh.
  - This now updates:
    - board render
    - move history table
    - last move cache/markers
    - suggestion table and pending suggestion buffer
    - re-analysis request for current FEN

## 7) Reset actions were easy to misclick
- Symptom:
  - Reset could happen immediately by accidental click.
- Fix:
  - Added confirm dialog for `Reset to Initial` and `Reset Game`.

## 8) Action buttons hard to use inside Controls menu
- Symptom:
  - Undo/Redo/Reset were less convenient during fast testing.
- Fix:
  - Moved Undo/Redo/Reset buttons below the board.
  - Added visual button classes for clearer intent:
    - neutral (Undo/Redo)
    - warning (Reset to Initial)
    - danger (Reset Game)
