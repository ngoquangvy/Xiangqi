import test from 'node:test';
import assert from 'node:assert/strict';
import { readBookSource } from './book-source.mjs';
import { ENGINE_LINE_LIMIT } from '../src/domain/lineLimits.js';
import { parseInfo, engineRow } from '../src/analysis/results.js';
import { LocalGame } from '../src/domain/LocalGame.js';
import { AppStore } from '../src/state/AppStore.js';
import { GameStorage } from '../src/storage/GameStorage.js';

const game = new LocalGame(), fen = game.snapshot().fen;
// Use a known legal, long game as input data, not a fabricated engine result.
const pv = readBookSource().positions[fen].find(row => row.move === 'b2e2').pv;

test('Engine parser and legality validation retain the full PV beyond twelve, independent of depth', () => {
    assert.equal(ENGINE_LINE_LIMIT, 256);
    for (const length of [13, 32, 64, 246]) {
        const line = pv.slice(0, length);
        const info = parseInfo(`info depth 40 multipv 1 score cp 25 pv ${line.join(' ')}`);
        assert.equal(info.depth, 40);
        assert.deepEqual(info.pv, line);
        const row = engineRow(fen, info);
        assert.deepEqual(row.pv, line);
        assert.equal(row.notation.length, length);
    }
    assert.equal(parseInfo(`info depth 40 score cp 25 pv ${pv.join(' ')}`).pv.length, 256);
});

test('Engine PV can replay through move 13 to its end, undo and cancel without changing the live game', () => {
    const values = new Map();
    const store = new AppStore(new GameStorage({ getItem: key => values.get(key), setItem: (key, value) => values.set(key, value) }));
    const original = store.snapshot().game;
    store.completePreviewHelp();
    const saved = [...values];
    const row = engineRow(fen, parseInfo(`info depth 32 score cp 10 pv ${pv.slice(0, 32).join(' ')}`));
    assert.equal(store.preview(row.move, row.pv, { ...row, fen, key: 'engine-1' }), true);
    assert.equal(store.snapshot().ui.preview.length, 32);
    for (let index = 0; index < 13; index++) assert.equal(store.stepPreview(1), true);
    assert.equal(store.snapshot().ui.preview.cursor, 13);
    assert.equal(store.stepPreview(-1), true);
    assert.equal(store.snapshot().ui.preview.cursor, 12);
    while (store.stepPreview(1)) {}
    assert.equal(store.snapshot().ui.preview.cursor, 32);
    assert.equal(store.stepPreview(1), false);
    assert.deepEqual(store.snapshot().game, original);
    assert.deepEqual([...values], saved);
    store.cancelPreview();
    assert.deepEqual(store.snapshot().board, original.board);
    assert.equal(store.snapshot().ui.preview, null);
    assert.deepEqual([...values], saved);
});
