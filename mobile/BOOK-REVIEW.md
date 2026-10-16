# Mobile Book Review

## Display And Replay

- Mobile now bundles `assets/books/sources/json/game01-validated.json`, selected
  by `engine/pikafish.json`. Original PGN/JSON sources remain unchanged.
- The native SQLite index preserves all 58,350 v3 records and their alternative
  PVs/metadata, across 54,654 counter-normalized positions. Mobile previously
  showed at most eight suggestions, collapsed different PVs with the same
  first move, hid PV text when a note existed, and limited replay to 12 plies.
- Suggestions now retain distinct legal continuations and show opening notes
  alongside a notation preview. There are 17 choices at the initial position.
  Tap a row to browse it with the shared navigation; this never plays a move.
- Book validation/replay has a 1024-ply safety bound (the v3 maximum is
  322). Engine rows retain their independent 12-ply display bound. All moves
  still pass through the shared core; invalid tails stop at the last legal ply.
- UI keeps one representative PV per source row; selecting every stored
  alternative is a separate future UX step, not silently expanded into hundreds
  of rows. Packaging parity tests compare all alternatives against the source.
- The installed SQLite is 52.3 MiB, with a 64 MiB installed-data budget and
  a 1 MiB maximum decoded position. APK is 62.7 MiB under the unchanged 75 MiB
  limit. Per-position gzip was rejected because it increased APK size; APK
  compression benefits from shared repeated PV text across the full database.

## Historical V2 Findings

Read-only replay against the current core found 0 illegal first moves and
7,376 records with a rejected continuation among 23,751 source records.
This is a core/data compatibility finding, not independent proof that every
rejection is a book error. The original data remains unchanged for diagnosis.
Run `npm run book:audit -- ../assets/books/opening-book.json` in `mobile` to
reproduce it. Without an argument, audit now follows the selected v3 book,
including its alternative PVs.

The first record named Phan Cung Ma after `h2e2` has a 35-ply PV beginning
`g9e7 b0c2 h9g7 h0g2 i9h9`; only its first 32 plies pass the current core.
The converter's opening dictionary itself assigns that name to the immediate
elephant reply `g9e7`. Names are generated labels, not validated opening theory.

The source metadata identifies `game01.pgn` as input. The converter before repair had
two concrete validation gaps to check against that original file:

- Extraction appends ICCS, advances the turn and records a FEN without checking
  whether `g.move(...)` succeeded. Unrecognized tokens are skipped without a
  parse-error report, so later tokens can lose their original position context.
- Book assembly validates the current move, but saves `moves.slice(ply)` as
  its PV before validating that future suffix. Breaking on a later illegal
  move does not remove the invalid suffix already saved for earlier positions.

These paths explain how a legal first move could retain an illegal continuation.
The subsequent repair validates full lines, distinguishes SAN case from ICCS,
reports ambiguous tokens, preserves alternatives and corrects double-counted
results. See [converter details](../../scripts/book/README.md). Android now uses
this validated candidate; web/desktop defaults have not been changed here.

Other available sources are not interchangeable:

- `sources/json/classic-openings.json`: 3 positions, 18 records, PVs up to
  2 plies; includes labels that need review, e.g. a horse move named Phi Tuong.
- `sources/json/game01-database.json`: 6,575 positions, 7,321 records,
  PVs up to 6 plies. A separate generated dataset, not a missing continuation
  layer automatically merged into the default book.
- `mrxq-tree.json`: UTF-16LE GitHub repository directory metadata, NOT a chess
  book. `external/mrxq/openingbook.xob` is a binary book format. Neither is loaded
  by the current fixed mobile book adapter.

## Recommended Next Slice

For larger sources and Chinese sites, see
[source research](../docs/BOOK_SOURCES_2026-10-16.md) at the repository root.

1. Keep the raw book immutable. Audit PGN conversion and representative
   rejected plies against known legal positions before regenerating anything.
2. Separate reviewed opening names/theory from database statistics. Preserve
   source/game IDs, counts and the score perspective as structured fields;
   do not treat a book weight as an engine evaluation.
3. Store multiple validated continuations per position/move instead of only
   choosing the longest sample game. Model nested PGN variations explicitly.
4. Generate a new versioned book plus a rejection report, replay every line
   in CI, and compare old/new position and variation counts before switching.
5. Only then add a fixed Settings catalog of reviewed books. Do not blindly
   merge incompatible formats, conflicting labels or overlapping statistics.
