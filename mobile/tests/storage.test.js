import test from 'node:test';
import assert from 'node:assert/strict';
import { GameStorage, MAX_SAVE_BYTES } from '../src/storage/GameStorage.js';
import { AppStore } from '../src/state/AppStore.js';

test('Oversized storage payloads fail before writing; valid data is versioned', () => {
    let writes = 0, raw;
    const storage = new GameStorage({ getItem: () => raw, setItem: (_, data) => { writes++; raw = data; } });
    assert.equal(storage.save('x'.repeat(MAX_SAVE_BYTES), false), 'save-too-large');
    assert.equal(writes, 0);
    assert.equal(storage.save('{}', true), null);
    assert.deepEqual(storage.load().data, { version: 1, game: '{}', flipped: true, language: 'vi', soundEnabled: true, previewHelpSeen: false,
        analysis: { profile: 'balanced', bookEnabled: true } });
    raw = 'x'.repeat(MAX_SAVE_BYTES + 1);
    assert.equal(storage.load().error, 'invalid-save');
});
test('Valid storage envelope with a corrupt game does not replace the initial board', () => {
    let writes = 0;
    const storage = new GameStorage({ getItem: () => JSON.stringify({ version: 1, game: '{}', flipped: false }), setItem: () => writes++ });
    const store = new AppStore(storage);
    assert.equal(store.snapshot().ui.storageError, 'invalid-save');
    assert.equal(store.snapshot().game.board.flat().filter(Boolean).length, 32);
    assert.equal(writes, 0);
});
test('Preview branch confirmation is atomic and cancellation preserves redo', () => {
    const values = new Map();
    const store = new AppStore(new GameStorage({ getItem: key => values.get(key), setItem: (key, value) => values.set(key, value) }));
    store.tap(7, 7); store.tap(4, 7); store.navigate('undo');
    const before = store.snapshot().game;
    store.preview('b2e2');
    store.stepPreview(1);
    assert.equal(store.applyPreview(), 'confirm-branch');
    assert.deepEqual(store.snapshot().game, before);
    store.cancelPreview();
    assert.equal(store.navigate('redo'), true);
    store.navigate('undo'); store.preview('b2e2'); store.stepPreview(1);
    assert.equal(store.applyPreview(true), true);
    assert.equal(store.snapshot().game.moveHistory[0].fromX, 1);
    assert.equal(store.snapshot().ui.expanded, false);
    assert.equal(store.snapshot().ui.preview, null);
});

test('Native writes stay ordered and the latest mutation is not acknowledged early', async () => {
    let raw = null;
    const writes = [];
    const backend = { getItem: () => raw, setItem: (_, value) => new Promise(resolve => {
        writes.push(() => { raw = value; resolve(); });
    }) };
    const storage = new GameStorage(backend);
    const store = new AppStore(storage);
    store.setLanguage('en'); store.flip();
    assert.equal(store.snapshot().ui.saving, true);
    assert.equal(writes.length, 1);
    writes[0]();
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(store.snapshot().ui.saving, true);
    assert.equal(writes.length, 2);
    writes[1]();
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(store.snapshot().ui.saving, false);
    const restored = new AppStore(new GameStorage(backend));
    assert.equal(restored.snapshot().ui.flipped, true);
    assert.equal(restored.snapshot().ui.language, 'en');
});
test('A rejected native write reports failure without losing the in-memory game', async () => {
    const store = new AppStore(new GameStorage({ getItem: () => null, setItem: async () => { throw Error('disk'); } }));
    store.tap(7, 7); store.tap(4, 7);
    assert.equal(store.snapshot().ui.saving, true);
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(store.snapshot().ui.saving, false);
    assert.equal(store.snapshot().ui.storageError, 'save-failed');
    assert.equal(store.snapshot().game.currentMoveIndex, 0);
});
