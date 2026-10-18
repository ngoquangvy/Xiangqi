import test from 'node:test';
import assert from 'node:assert/strict';
import { engineRow, parseInfo } from '../src/analysis/results.js';
import { LocalGame } from '../src/domain/LocalGame.js';
import { AppStore } from '../src/state/AppStore.js';
import { GameStorage } from '../src/storage/GameStorage.js';
import { AnalysisController } from '../src/analysis/AnalysisController.js';

test('Red and blue preserve UCI cp, mate and bound perspective, regardless of board orientation', () => {
    const game = new LocalGame();
    for (const move of ['h2e2', 'h9g7']) {
        const fen = game.snapshot().fen;
        for (const score of ['cp 50 lowerbound', 'cp -20 upperbound', 'mate 3', 'mate -2 upperbound']) {
            const info = parseInfo(`info depth 18 score ${score} pv ${move}`);
            const row = engineRow(fen, info);
            assert.equal(row.value, info.value);
            assert.equal(row.kind, info.kind);
            assert.equal(row.bound, info.bound);
        }
        if (move === 'h2e2') game.move(7, 7, 4, 7);
    }
});

test('Best-first engine ranks remain consistent for blue and red even with out-of-order output', async () => {
    const store = new AppStore(new GameStorage({ getItem: () => null, setItem: () => {} }));
    let output, request;
    const controller = new AnalysisController(store, { available: true,
        listen: async callback => { output = callback; return () => {}; },
        analyze: async value => { request = value; }, stop: async () => {}, lookupBook: async () => [] }, { delayMs: 0 });
    await controller.started;
    try {
        for (const moves of [['h2e2', 'b2e2'], ['h9g7', 'b9c7']]) {
            output({ id: request.id, line: `info depth 12 multipv 2 score cp 10 pv ${moves[1]}` });
            output({ id: request.id, line: `info depth 12 multipv 1 score cp 50 pv ${moves[0]}` });
            assert.deepEqual(controller.snapshot().rows.map(row => row.value), [50, 10]);
            store.flip();
            assert.deepEqual(controller.snapshot().rows.map(row => row.rank), [1, 2]);
            if (moves[0] === 'h2e2') { store.tap(7, 7); store.tap(4, 7); }
        }
    } finally { controller.destroy(); }
});
