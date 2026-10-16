import test from 'node:test';
import assert from 'node:assert/strict';
import { parseInfo, engineRow, bookRows } from '../src/analysis/results.js';
import { analysisSettings, bookKey } from '../src/analysis/settings.js';
import { LocalGame } from '../src/domain/LocalGame.js';
import { readFileSync } from 'node:fs';
import { readBookSource } from './book-source.mjs';
import { ENGINE_VARIATION_COUNT } from '../src/domain/lineLimits.js';

test('Only known profiles and counter-independent, side-aware book keys are accepted', () => {
    assert.deepEqual(analysisSettings({ profile: '__proto__', bookEnabled: false }), { profile: 'balanced', bookEnabled: false });
    assert.equal(bookKey('position w - - 0 1'), bookKey('position w - - 4 30'));
    assert.notEqual(bookKey('position b - - 0 1'), bookKey('position w - - 0 1'));
    assert.equal(bookKey(null), null);
});
test('UCI results preserve mate and bound semantics, reject noise and invalid PVs', () => {
    const fen = new LocalGame().snapshot().fen;
    const info = parseInfo('info depth 12 multipv 2 score cp 45 lowerbound nodes 1234 pv h2e2 h9g7');
    assert.equal(info.rank, 2); assert.equal(info.value, 45); assert.equal(info.bound, 'lowerbound');
    const row = engineRow(fen, info);
    assert.equal(row.source, 'engine'); assert.equal(row.value, 45); assert.equal(row.pv.length, 2);
    const game = new LocalGame(); game.move(7, 7, 4, 7);
    const mate = engineRow(game.snapshot().fen, parseInfo('info depth 3 score mate -2 upperbound pv h9g7'));
    assert.equal(mate.value, 2); assert.equal(mate.kind, 'mate'); assert.equal(mate.bound, 'lowerbound');
    assert.equal(engineRow(fen, { ...info, pv: ['h2e3'] }), null);
    for (const bad of ['info string pv h2e2', 'bestmove h2e2', 'info depth 2 score cp 3 pv z2e2', 'info depth 2 multipv 6 score cp 3 pv h2e2']) assert.equal(parseInfo(bad), null);
});

test('All five engine ranks are accepted and the native option/buffers share the same bound', () => {
    assert.equal(ENGINE_VARIATION_COUNT, 5);
    for (let rank = 1; rank <= 5; rank++) {
        assert.equal(parseInfo(`info depth 4 multipv ${rank} score cp 20 pv h2e2`).rank, rank);
    }
    for (const rank of [0, 6, 99]) assert.equal(parseInfo(`info depth 4 multipv ${rank} score cp 20 pv h2e2`), null);
    const native = readFileSync(new URL('../android/app/src/main/java/com/ngoquangvy/xiangqi/mobile/PikafishProcess.java', import.meta.url), 'utf8');
    assert.equal(Number(/VARIATION_COUNT = (\d+)/.exec(native)[1]), ENGINE_VARIATION_COUNT);
    assert.ok(native.includes('new long[VARIATION_COUNT]') && native.includes('new String[VARIATION_COUNT]'));
    assert.ok(native.includes('"setoption name MultiPV value " + VARIATION_COUNT'));
});
test('Book weights are not engine scores, invalid moves are dropped and the live game is untouched', () => {
    const game = new LocalGame(), before = game.snapshot();
    const rows = bookRows(before.fen, [{ move: 'h2e2', score: .65, pv: ['h2e2', 'h9g7'] },
        { move: 'h2e2', score: .8 }, { move: 'a0a9' }, { move: 'h2e3', score: 1 }, { move: 'b2e2', score: 123 }]);
    assert.equal(rows.length, 3); assert.equal(rows[0].weight, .8); assert.equal(rows[2].weight, null);
    assert.deepEqual(rows[1].pv, ['h2e2', 'h9g7']);
    assert.ok(rows.every(row => !Object.hasOwn(row, 'value') && !Object.hasOwn(row, 'kind')));
    assert.deepEqual(game.snapshot(), before);
});

test('Legacy book legality filter still truncates the invalid Phan Cung tail without inventing moves', () => {
    const positions = JSON.parse(readFileSync(new URL('../../assets/books/opening-book.json', import.meta.url), 'utf8')).positions;
    const fen = new LocalGame().snapshot().fen;
    assert.equal(bookRows(fen, positions[fen]).length, 17);
    const [openingFen, candidates] = Object.entries(positions).find(([, rows]) => rows.some(row => /Ph\u1ea3n Cung/.test(row.note)));
    const row = bookRows(openingFen, candidates).find(row => /Ph\u1ea3n Cung/.test(row.note));
    assert.equal(row.pv.length, 32); // Source ply 33 is illegal, not silently fabricated.
    assert.equal(row.notation.length, row.pv.length);
    const local = new LocalGame();
    local.move(7, 7, 4, 7);
    const preview = local.preview(row.move, row.pv);
    assert.ok(preview); assert.equal(preview.snapshot().length, 32);
    while (preview.step(1)) {}
    assert.equal(preview.snapshot().cursor, 32);
    assert.equal(local.snapshot().moveHistory.length, 1);
});

test('Selected v3 book retains all root choices and its full 322-ply representative without clipping', () => {
    const book = readBookSource(), local = new LocalGame(), fen = local.snapshot().fen;
    assert.equal(book.meta.version, '3.0');
    const rows = bookRows(fen, book.positions[fen]);
    assert.equal(rows.length, 17);
    const longest = rows.find(row => row.move === 'b2e2');
    assert.equal(longest.pv.length, 322); assert.equal(longest.notation.length, 322);
    const preview = local.preview(longest.move, longest.pv);
    assert.equal(preview.snapshot().length, 322);
    while (preview.step(1)) {}
    assert.equal(preview.snapshot().cursor, 322);
    assert.equal(local.snapshot().moveHistory.length, 0);
});

test('Distinct book continuations survive; exact duplicate lines keep their best weight', () => {
    const fen = new LocalGame().snapshot().fen;
    const rows = bookRows(fen, [
        { move: 'h2e2', score: .4, pv: ['h2e2', 'h9g7'] },
        { move: 'h2e2', score: .9, pv: ['h2e2', 'b9c7'] },
        { move: 'h2e2', score: .6, pv: ['h2e2', 'h9g7'] },
    ]);
    assert.deepEqual(rows.map(row => row.pv), [['h2e2', 'b9c7'], ['h2e2', 'h9g7']]);
    assert.deepEqual(rows.map(row => row.weight), [.9, .6]);
});
