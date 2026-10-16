import '../../tests/sound.test.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { AppStore } from '../src/state/AppStore.js';
import { GameStorage } from '../src/storage/GameStorage.js';
import { LocalGame } from '../src/domain/LocalGame.js';
import XiangqiGame from '../../src/core/XiangqiGame.js';

function setup() {
    const values = new Map();
    const storage = new GameStorage({ getItem: key => values.get(key), setItem: (key, value) => values.set(key, value) });
    return { store: new AppStore(storage), storage };
}
test('Only committed moves emit audio; previews, navigation, restore and settings stay silent', () => {
    const { store, storage } = setup(), sounds = [];
    const unsubscribe = store.onMove(kind => sounds.push(kind));
    store.tap(7, 7); store.flip(); store.setLanguage('en'); store.toggleExpanded(); store.back();
    store.preview('h2e2'); store.cancelPreview();
    assert.deepEqual(sounds, []);
    store.preview('h2e2'); store.stepPreview(1); assert.equal(store.applyPreview(), true);
    assert.deepEqual(sounds, ['move']);
    store.navigate('undo'); store.navigate('redo'); store.saveNote('note');
    assert.deepEqual(sounds, ['move']);
    assert.equal(new AppStore(storage).snapshot().game.currentMoveIndex, 0);
    store.navigate('undo'); store.tap(7, 7); store.tap(7, 0);
    assert.deepEqual(sounds, ['move']); // Branch confirmation is not a commit.
    assert.equal(store.tap(7, 0, true), 'moved');
    assert.deepEqual(sounds, ['move', 'capture']);
    unsubscribe(); store.reset(); store.tap(7, 7); store.tap(4, 7);
    assert.deepEqual(sounds, ['move', 'capture']);
});
test('Sound preference persists without changing the game and legacy saves default to enabled', () => {
    const { store, storage } = setup();
    const before = store.snapshot().game;
    store.toggleSound();
    assert.equal(store.snapshot().ui.soundEnabled, false);
    assert.deepEqual(store.snapshot().game, before);
    assert.equal(new AppStore(storage).snapshot().ui.soundEnabled, false);
    const raw = JSON.stringify({ version: 1, game: '{}', flipped: false });
    assert.equal(new GameStorage({ getItem: () => raw }).load().data.soundEnabled, true);
});
test('A real checking move, including a checking capture, emits only check', () => {
    for (const destination of [[0, 0], [4, 1]]) {
        const core = new XiangqiGame();
        assert.equal(core.importFen('4k4/R3p4/9/9/4P4/9/9/9/9/4K4 w - - 0 1'), true);
        const game = new LocalGame();
        assert.equal(game.restore(core.exportGame()), true);
        const store = new AppStore(new GameStorage({ getItem: () => null, setItem() {} }), game);
        const sounds = [];
        store.onMove(kind => sounds.push(kind));
        store.tap(0, 1);
        assert.equal(store.tap(...destination), 'moved');
        assert.equal(store.snapshot().game.isCheck, true);
        assert.deepEqual(sounds, ['check']);
    }
});
