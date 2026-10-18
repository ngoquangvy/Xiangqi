import test from 'node:test';
import assert from 'node:assert/strict';
import { AppStore } from '../src/state/AppStore.js';
import { GameStorage } from '../src/storage/GameStorage.js';
import { AnalysisController } from '../src/analysis/AnalysisController.js';
const setup = () => {
    const values = new Map();
    const store = new AppStore(new GameStorage({ getItem: k => values.get(k), setItem: (k, v) => values.set(k, v) }));
    return { store, values };
};
test('Selecting a row only highlights; the first board touch selects a live piece and the second moves', () => {
    const { store, values } = setup(), before = store.snapshot().game;
    assert.equal(store.selectSuggestion('h2e2', ['h2e2', 'h9g7']), true);
    let state = store.snapshot();
    assert.equal(state.ui.preview, null); assert.equal(state.ui.pending.length, 2);
    assert.equal(state.boardLocked, false); assert.ok(state.suggestionMove);
    assert.deepEqual(state.game, before); assert.deepEqual(state.board, before.board);
    assert.equal(values.size, 0);
    assert.equal(store.tap(1, 7), 'selected');
    state = store.snapshot();
    assert.deepEqual(state.ui.selected, { x: 1, y: 7 });
    assert.equal(state.ui.pending, null); assert.equal(state.suggestionMove, null);
    assert.equal(store.tap(4, 7), 'moved');
    assert.equal(store.snapshot().game.moveHistory[0].fromX, 1);
});
test('Only Next starts scratch replay; returning to zero still remains scratch until explicitly cancelled', () => {
    const { store } = setup(), before = store.snapshot().game;
    store.selectSuggestion('h2e2', ['h2e2', 'h9g7']);
    assert.equal(store.stepPreview(-1), false);
    assert.equal(store.stepPreview(1), true);
    assert.equal(store.snapshot().ui.pending, null);
    assert.equal(store.snapshot().ui.preview.cursor, 1);
    assert.equal(store.snapshot().suggestionMove, null);
    store.stepPreview(-1);
    assert.equal(store.tap(7, 7), 'preview-cancelled');
    assert.equal(store.snapshot().ui.selected, null);
    assert.deepEqual(store.snapshot().game, before);
});
test('Pending selections do not pause the engine or destroy redo; a new live branch still requires confirmation', async () => {
    const { store } = setup(), calls = [];
    const controller = new AnalysisController(store, { available: true,
        listen: async () => () => {}, analyze: async request => calls.push(request), stop: async () => calls.push('stop'), lookupBook: async () => [] }, { delayMs: 0 });
    await controller.started;
    try {
        store.tap(7, 7); store.tap(4, 7); store.navigate('undo');
        const count = calls.length;
        store.selectSuggestion('h2e2');
        assert.equal(calls.length, count); assert.equal(controller.snapshot().status, 'searching');
        store.tap(1, 7);
        assert.equal(store.tap(4, 7), 'confirm-branch');
        assert.equal(store.snapshot().game.moveHistory[0].fromX, 7);
        store.selectSuggestion('h2e2'); store.stepPreview(1);
        assert.equal(calls.at(-1), 'stop');
    } finally { controller.destroy(); }
});
