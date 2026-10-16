import test from 'node:test';
import assert from 'node:assert/strict';
import XiangqiGame from '../../src/core/XiangqiGame.js';
import { LocalGame } from '../src/domain/LocalGame.js';
import { AppStore } from '../src/state/AppStore.js';
import { GameStorage } from '../src/storage/GameStorage.js';

function setup(game) {
    const values = new Map();
    const store = new AppStore(new GameStorage({ getItem: key => values.get(key), setItem: (key, value) => values.set(key, value) }), game);
    return { store, values };
}
test('PV navigation is scratch-only; only the initially selected first move has a special highlight', () => {
    const { store, values } = setup(), original = store.snapshot().game;
    let sounds = 0; store.onMove(() => sounds++);
    assert.equal(store.preview('h2e2', ['h2e2', 'h9g7', 'h0g2']), true);
    assert.equal(store.snapshot().ui.preview.cursor, 0);
    assert.deepEqual(store.snapshot().board, original.board);
    assert.equal(store.snapshot().turn, original.currentTurn);
    assert.equal(store.snapshot().lastMove, original.lastMove);
    const hint = store.snapshot().suggestionMove;
    assert.deepEqual([hint.fromX, hint.fromY, hint.toX, hint.toY], [7, 7, 4, 7]);
    assert.equal(store.applyPreview(), false);
    assert.equal(store.stepPreview(-1), false);
    assert.equal(store.stepPreview(1), true);
    assert.equal(store.snapshot().ui.preview.cursor, 1);
    assert.equal(store.snapshot().board[7][7], null);
    assert.equal(store.stepPreview(1), true);
    assert.equal(store.snapshot().ui.preview.cursor, 2); assert.equal(store.snapshot().turn, 'red');
    assert.equal(store.snapshot().suggestionMove, null); assert.equal(store.applyPreview(), false);
    assert.equal(store.stepPreview(-1), true); assert.equal(store.snapshot().suggestionMove, null);
    assert.equal(store.stepPreview(-1), true); assert.equal(store.snapshot().ui.preview.cursor, 0);
    assert.deepEqual(store.snapshot().board, original.board);
    assert.equal(store.stepPreview(-1), false); assert.equal(store.applyPreview(), false);
    assert.deepEqual(store.snapshot().game, original); assert.equal(values.size, 0); assert.equal(sounds, 0);
    store.cancelPreview(); assert.deepEqual(store.snapshot().game, original); assert.equal(store.snapshot().suggestionMove, null);
});
test('Invalid PV tails are truncated, reselection starts fresh and only the explicit first move commits', () => {
    const { store } = setup();
    assert.equal(store.preview('h2e2', ['h2e2', 'a9a0', 'h0g2']), true);
    assert.equal(store.snapshot().ui.preview.length, 1); assert.equal(store.stepPreview(1), true);
    assert.equal(store.stepPreview(1), false);
    assert.equal(store.preview('h2e2', ['b2e2']), false);
    assert.equal(store.preview('b2e2', ['b2e2', 'b9c7']), true);
    const detached = store.snapshot(); detached.ui.preview.board[0][0] = null;
    assert.ok(store.snapshot().board[0][0]);
    assert.equal(store.stepPreview(1), true);
    assert.equal(store.applyPreview(), true); assert.equal(store.snapshot().game.moveHistory.length, 1);
    assert.equal(store.snapshot().ui.preview, null); assert.equal(store.snapshot().suggestionMove, null);
    store.navigate('undo'); assert.equal(store.snapshot().lastMove, null);
    store.navigate('redo'); assert.equal(store.snapshot().lastMove.fromX, 1);
    store.reset(); assert.equal(store.snapshot().lastMove, null);
});
test('Check/mate signals belong to the displayed core position and never lock recovery actions', () => {
    const core = new XiangqiGame();
    assert.equal(core.importFen('4k4/3R1P3/5R3/9/9/9/9/9/9/3K5 w - - 0 1'), true);
    const local = new LocalGame(); assert.equal(local.restore(core.exportGame()), true);
    const { store } = setup(local);
    assert.equal(store.preview('f7e7'), true);
    assert.equal(store.snapshot().winner, null); store.stepPreview(1);
    assert.equal(store.snapshot().winner, 'red'); assert.deepEqual(store.snapshot().checkedKing, { x: 4, y: 0 });
    store.cancelPreview(); assert.equal(store.snapshot().winner, null);
    assert.equal(store.preview('f7e7'), true); store.stepPreview(1); assert.equal(store.applyPreview(), true);
    assert.equal(store.snapshot().winner, 'red'); assert.equal(store.snapshot().boardLocked, false);
    store.toggleExpanded(); store.toggleExpanded(); assert.equal(store.snapshot().winner, 'red');
    assert.equal(store.navigate('undo'), true); assert.equal(store.snapshot().winner, null);
    assert.equal(store.navigate('redo'), true); assert.equal(store.snapshot().winner, 'red');
    store.reset(); assert.equal(store.snapshot().winner, null); assert.equal(store.snapshot().boardLocked, false);
});

test('First board touch cancels the entire preview only, preserving redo, preferences, saves and silence', () => {
    const { store, values } = setup();
    store.tap(7, 7); store.tap(4, 7); store.navigate('undo'); store.flip();
    const before = store.snapshot(), saved = [...values];
    let sounds = 0; store.onMove(() => sounds++);
    store.preview('h2e2', ['h2e2', 'h9g7', 'h0g2']); store.stepPreview(1); store.toggleExpanded();
    assert.equal(store.tap(-1, 0), 'locked'); assert.ok(store.snapshot().ui.preview);
    assert.equal(store.tap(4, 7), 'preview-cancelled');
    const after = store.snapshot();
    assert.deepEqual(after.game, before.game); assert.deepEqual(after.board, before.board);
    assert.equal(after.ui.preview, null); assert.equal(after.ui.selected, null);
    assert.equal(after.ui.expanded, false); assert.equal(after.boardLocked, false);
    assert.equal(after.ui.flipped, true); assert.equal(after.turn, before.turn);
    assert.equal(after.suggestionMove, null); assert.equal(after.winner, before.winner);
    assert.deepEqual([...values], saved); assert.equal(sounds, 0);
    assert.equal(store.tap(7, 7), 'selected');
    assert.equal(store.snapshot().game.currentMoveIndex, -1);
    assert.equal(store.tap(4, 7), 'confirm-branch'); // Redo remains intact.
});

test('Board-touch exit clears simulated check/winner and restores the original turn indicators', () => {
    const core = new XiangqiGame(), local = new LocalGame();
    assert.equal(core.importFen('4k4/3R1P3/5R3/9/9/9/9/9/9/3K5 w - - 0 1'), true);
    assert.equal(local.restore(core.exportGame()), true);
    const { store, values } = setup(local), before = store.snapshot();
    store.preview('f7e7');
    store.stepPreview(1);
    assert.equal(store.snapshot().winner, 'red'); assert.ok(store.snapshot().checkedKing);
    assert.equal(store.tap(4, 0), 'preview-cancelled');
    const after = store.snapshot();
    assert.equal(after.winner, null); assert.equal(after.checkedKing, null);
    assert.equal(after.turn, 'red'); assert.equal(after.suggestionMove, null);
    assert.equal(after.ui.selected, null); assert.equal(after.lastMove, null);
    assert.deepEqual(after.game, before.game); assert.equal(values.size, 0);
});
