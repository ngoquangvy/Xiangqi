import test from 'node:test';
import assert from 'node:assert/strict';
import { languages, getText, pieceName } from '../src/ui/strings.js';
import { AppStore } from '../src/state/AppStore.js';
import { GameStorage } from '../src/storage/GameStorage.js';

test('Both languages have exactly the same nonempty translation keys', () => {
    assert.deepEqual(Object.keys(languages.en).sort(), Object.keys(languages.vi).sort());
    for (const dictionary of Object.values(languages)) for (const value of Object.values(dictionary)) {
        assert.equal(typeof value, 'string');
        assert.ok(value.length > 0 && !value.includes('\uFFFD'));
    }
    assert.equal(pieceName('馬', 'en'), 'horse');
    assert.equal(pieceName('馬', 'vi'), 'mã');
    assert.equal(getText('unknown'), languages.vi);
});
test('Language switches persist without changing the game, preview or selection', () => {
    const values = new Map();
    const storage = new GameStorage({ getItem: key => values.get(key), setItem: (key, value) => values.set(key, value) });
    const store = new AppStore(storage);
    store.tap(7, 7);
    const before = store.snapshot();
    assert.equal(store.setLanguage('en'), true);
    assert.deepEqual(store.snapshot().game, before.game);
    assert.deepEqual(store.snapshot().ui.selected, before.ui.selected);
    store.preview('h2e2');
    const preview = store.snapshot().ui.preview;
    store.setLanguage('vi');
    assert.deepEqual(store.snapshot().ui.preview, preview);
    assert.equal(store.setLanguage('fr'), false);
    store.setLanguage('en');
    const restored = new AppStore(storage);
    assert.equal(restored.snapshot().ui.language, 'en');
    assert.deepEqual(restored.snapshot().game, before.game);
    assert.equal(restored.snapshot().ui.preview, null);
});
