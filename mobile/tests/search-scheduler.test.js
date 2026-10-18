import test from 'node:test';
import assert from 'node:assert/strict';
import { AppStore } from '../src/state/AppStore.js';
import { GameStorage } from '../src/storage/GameStorage.js';
import { AnalysisController } from '../src/analysis/AnalysisController.js';

test('Rapid navigation stops old work immediately but analyzes only the final position after 500ms', async t => {
    t.mock.timers.enable({ apis: ['setTimeout'] });
    const store = new AppStore(new GameStorage({ getItem: () => null, setItem: () => {} })), calls = [];
    let emit;
    const controller = new AnalysisController(store, { available: true,
        listen: async fn => { emit = fn; return () => {}; },
        analyze: async value => calls.push(value), stop: async () => calls.push('stop'), lookupBook: async () => [] });
    await controller.started;
    try {
        const old = calls[0].id;
        store.tap(7, 7); store.tap(4, 7);
        assert.equal(controller.snapshot().status, 'waiting');
        assert.equal(calls.at(-1), 'stop');
        emit({ id: old, line: 'info depth 30 score cp 999 pv h2e2' });
        assert.deepEqual(controller.snapshot().rows, []);
        t.mock.timers.tick(300); store.navigate('undo');
        t.mock.timers.tick(300); store.navigate('redo');
        t.mock.timers.tick(499);
        assert.equal(calls.filter(call => typeof call === 'object').length, 1);
        // Settings unrelated to engine inputs must not postpone the deadline.
        store.flip(); store.setLanguage('en'); store.tap(0, 3);
        t.mock.timers.tick(1);
        assert.equal(calls.filter(call => typeof call === 'object').length, 2);
        assert.equal(calls.at(-1).moves, 'h2e2');
        store.navigate('undo'); controller.togglePause();
        t.mock.timers.tick(1000);
        assert.equal(controller.snapshot().status, 'paused');
        assert.equal(calls.filter(call => typeof call === 'object').length, 2);
        controller.togglePause(); controller.setForeground(false);
        t.mock.timers.tick(1000);
        assert.equal(controller.snapshot().status, 'background');
        assert.equal(calls.filter(call => typeof call === 'object').length, 2);
        controller.setForeground(true); controller.destroy();
        t.mock.timers.tick(1000);
        assert.equal(calls.filter(call => typeof call === 'object').length, 2);
    } finally { controller.destroy(); }
});
