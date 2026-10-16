import test from 'node:test';
import assert from 'node:assert/strict';
import { AppStore } from '../src/state/AppStore.js';
import { GameStorage } from '../src/storage/GameStorage.js';

function setup(storage) {
    const values = new Map();
    const backend = storage || { getItem: key => values.get(key) || null, setItem: (key, value) => values.set(key, value) };
    return { store: new AppStore(new GameStorage(backend)), backend, values };
}
function move(store) { store.tap(7, 7); assert.equal(store.tap(4, 7), 'moved'); }

test('A legal touch sequence changes board/history/turn once; illegal moves change none', () => {
    const { store } = setup();
    const fen = store.snapshot().game.fen;
    store.tap(7, 7);
    assert.equal(store.snapshot().game.fen, fen);
    assert.ok(store.snapshot().legalMoves.some(move => move.uci === 'h2e2'));
    store.tap(7, 7); // Deselect first, then start a fresh touch sequence.
    move(store);
    assert.equal(store.snapshot().game.currentMoveIndex, 0);
    assert.equal(store.snapshot().turn, 'black');
    assert.equal(store.snapshot().game.moveHistory.length, 1);
    const after = store.snapshot().game;
    store.tap(4, 7); store.tap(3, 6);
    assert.deepEqual(store.snapshot().game, after);
});
test('Undo, redo and restored historical positions preserve the future timeline', () => {
    const { store, backend } = setup();
    move(store);
    const moved = store.snapshot().game.fen;
    assert.equal(store.navigate('undo'), true);
    const restored = new AppStore(new GameStorage(backend));
    assert.equal(restored.snapshot().game.currentMoveIndex, -1);
    assert.equal(restored.snapshot().game.moveHistory.length, 1);
    assert.equal(restored.navigate('redo'), true);
    assert.equal(restored.snapshot().game.fen, moved);
});
test('Branching requires confirmation; cancelling does not destroy the future', () => {
    const { store } = setup();
    move(store); store.navigate('undo'); store.tap(1, 7);
    const before = store.snapshot().game;
    assert.equal(store.tap(4, 7), 'confirm-branch');
    assert.deepEqual(store.snapshot().game, before);
    assert.equal(store.tap(4, 7, true), 'moved');
    assert.equal(store.snapshot().game.moveHistory[0].fromX, 1);
    assert.equal(store.navigate('redo'), false);
});
test('Preview and expanded board never commit accidental touches', () => {
    const { store, values } = setup();
    const before = store.snapshot().game;
    assert.equal(store.preview('h2e2'), true);
    assert.equal(store.snapshot().turn, 'red');
    assert.deepEqual(store.snapshot().board, before.board);
    assert.equal(store.tap(0, 3), 'preview-cancelled');
    assert.equal(store.snapshot().ui.preview, null);
    assert.equal(store.snapshot().ui.selected, null);
    assert.deepEqual(store.snapshot().game, before);
    assert.equal(values.size, 0);
    store.cancelPreview();
    assert.deepEqual(store.snapshot().game, before);
    store.toggleExpanded();
    assert.equal(store.tap(7, 7), 'locked');
    assert.equal(store.back(), true);
    assert.equal(store.preview('h2e2'), true);
    store.stepPreview(1);
    assert.equal(store.applyPreview(), true);
    assert.equal(store.snapshot().game.currentMoveIndex, 0);
    assert.equal(store.snapshot().ui.preview, null);
    assert.equal(store.preview('h2e3'), false);
});
test('Flipping and notes persist; snapshots and subscribers cannot mutate the owner', () => {
    const { store, backend } = setup();
    store.subscribe(state => { state.game.board[0][0] = null; });
    move(store); store.flip();
    assert.equal(store.saveNote('Ghi chú <script>'), true);
    const restored = new AppStore(new GameStorage(backend));
    assert.equal(restored.snapshot().ui.flipped, true);
    assert.equal(restored.snapshot().game.moveHistory[0].note, 'Ghi chú <script>');
    assert.ok(restored.snapshot().game.board[0][0]);
    assert.equal(restored.saveNote('x'.repeat(2001)), false);
    store.reset();
    assert.equal(store.snapshot().game.moveHistory.length, 0);
});
test('Corrupt saves and unavailable storage are explicit; in-memory play still works', () => {
    const broken = setup({ getItem: () => '{bad', setItem: () => { throw Error('quota'); } });
    assert.equal(broken.store.snapshot().ui.storageError, 'invalid-save');
    move(broken.store);
    assert.equal(broken.store.snapshot().ui.storageError, 'save-failed');
    assert.equal(broken.store.snapshot().game.currentMoveIndex, 0);
});
