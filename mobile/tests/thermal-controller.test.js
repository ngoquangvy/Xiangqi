import test from 'node:test';
import assert from 'node:assert/strict';
import { AppStore } from '../src/state/AppStore.js';
import { GameStorage } from '../src/storage/GameStorage.js';
import { AnalysisController } from '../src/analysis/AnalysisController.js';
test('Thermal stop cancels pending work and cooling never overrides pause, preview, background or disposal', async t => {
    t.mock.timers.enable({ apis: ['setTimeout'] });
    const store = new AppStore(new GameStorage({ getItem: () => null, setItem: () => {} })), calls = [];
    let heat;
    const controller = new AnalysisController(store, { available: true,
        listen: async (_, __, callback) => { heat = callback; return () => {}; },
        analyze: async request => calls.push(request), stop: async () => calls.push('stop'), lookupBook: async () => [] });
    await controller.started;
    const payload = (state, revision, blocked = false, limited = blocked) => ({ state, revision, blocked, limited });
    try {
        store.tap(7, 7); store.tap(4, 7);
        heat(payload('serious', 1, true));
        t.mock.timers.tick(1000);
        assert.equal(controller.snapshot().status, 'thermal');
        assert.equal(calls.filter(call => typeof call === 'object').length, 1);
        heat(payload('nominal', 0)); // Delayed status read cannot override a newer event.
        assert.equal(controller.snapshot().status, 'thermal');
        heat(payload('cooling', 2, true));
        t.mock.timers.tick(1000);
        assert.equal(controller.snapshot().status, 'thermal');
        controller.togglePause();
        heat(payload('nominal', 3)); t.mock.timers.tick(1000);
        assert.equal(controller.snapshot().status, 'paused');
        controller.togglePause(); t.mock.timers.tick(500);
        assert.equal(calls.at(-1).moves, 'h2e2');
        store.preview('h9g7'); heat(payload('serious', 4, true)); heat(payload('nominal', 5));
        t.mock.timers.tick(1000); assert.equal(controller.snapshot().status, 'preview');
        store.cancelPreview(); controller.setForeground(false);
        heat(payload('serious', 6, true)); heat(payload('nominal', 7));
        t.mock.timers.tick(1000); assert.equal(controller.snapshot().status, 'background');
        controller.destroy(); heat(payload('nominal', 8));
        assert.equal(calls.filter(call => typeof call === 'object').length, 2);
    } finally { controller.destroy(); }
});
