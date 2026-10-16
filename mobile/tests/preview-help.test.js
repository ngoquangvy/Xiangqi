import test from 'node:test';
import assert from 'node:assert/strict';
import { AppStore } from '../src/state/AppStore.js';
import { GameStorage } from '../src/storage/GameStorage.js';

function setup() {
    let raw = null, writes = 0;
    const backend = { getItem: () => raw, setItem: (_, value) => { raw = value; writes++; } };
    return { store: new AppStore(new GameStorage(backend)), backend, raw: () => raw, writes: () => writes };
}

test('First selection coaches without playing, saving or marking completion; cancellation can show it again', () => {
    const { store, writes } = setup(), original = store.snapshot().game;
    assert.equal(store.snapshot().ui.helpOpen, false);
    store.preview('h2e2');
    assert.equal(store.snapshot().ui.helpOpen, true);
    assert.equal(store.snapshot().ui.previewHelpSeen, false);
    assert.equal(store.snapshot().ui.preview.cursor, 0);
    assert.equal(store.stepPreview(-1), false);
    assert.deepEqual(store.snapshot().game, original);
    assert.deepEqual(store.snapshot().board, original.board);
    assert.equal(store.back(), true); // Back dismisses the guide without acknowledging it.
    assert.equal(store.snapshot().ui.helpOpen, false);
    assert.ok(store.snapshot().ui.preview);
    assert.equal(store.back(), true);
    store.preview('b2e2'); assert.equal(store.snapshot().ui.helpOpen, true);
    store.tap(4, 7); assert.equal(store.snapshot().ui.helpOpen, false);
    assert.equal(writes(), 0);
});

test('Acknowledgment persists only the live game and redo, never the selected or simulated position', () => {
    const fixture = setup(), { store } = fixture;
    store.tap(7, 7); store.tap(4, 7); store.navigate('undo');
    const original = store.snapshot().game;
    const row = { source: 'engine', key: 'engine-1', pv: ['b2e2', 'b9c7'] };
    store.preview('b2e2', row.pv, row); row.pv[0] = 'bad';
    assert.equal(store.snapshot().ui.suggestion.pv[0], 'b2e2');
    store.stepPreview(1); store.completePreviewHelp();
    assert.equal(store.snapshot().ui.helpOpen, false);
    assert.equal(store.snapshot().ui.previewHelpSeen, true);
    const saved = JSON.parse(fixture.raw());
    assert.equal(saved.previewHelpSeen, true);
    assert.equal('preview' in saved, false); assert.equal('suggestion' in saved, false);
    const restored = new AppStore(new GameStorage(fixture.backend));
    assert.deepEqual(restored.snapshot().game, original);
    assert.equal(restored.snapshot().ui.preview, null);
    restored.preview('h2e2'); assert.equal(restored.snapshot().ui.helpOpen, false);
    restored.togglePreviewHelp(); assert.equal(restored.snapshot().ui.helpOpen, true);
    restored.cancelPreview(); assert.equal(restored.snapshot().ui.suggestion, null);
    assert.equal(restored.navigate('redo'), true);
});

test('Opening/replaying help is not a game action; repeat completion does not write again', () => {
    const { store, writes } = setup(), original = store.snapshot().game;
    let sounds = 0; store.onMove(() => sounds++);
    store.togglePreviewHelp(); store.completePreviewHelp(); assert.equal(writes(), 1);
    store.completePreviewHelp(); assert.equal(writes(), 1);
    store.togglePreviewHelp(); store.setLanguage('en');
    assert.equal(store.snapshot().ui.helpOpen, true);
    store.completePreviewHelp(); assert.equal(writes(), 2); // Only the language change wrote.
    assert.deepEqual(store.snapshot().game, original); assert.equal(sounds, 0);
});
