import test from 'node:test';
import assert from 'node:assert/strict';
import XiangqiGame from '../../src/core/XiangqiGame.js';
import { PositionDraft } from '../src/domain/PositionDraft.js';
import { AppStore } from '../src/state/AppStore.js';
import { GameStorage } from '../src/storage/GameStorage.js';
import { AnalysisController } from '../src/analysis/AnalysisController.js';

const draft = () => new PositionDraft(new XiangqiGame().getGameState());
function fixture() {
    const values = new Map();
    const storage = new GameStorage({ getItem: k => values.get(k), setItem: (k, v) => values.set(k, v) });
    return { store: new AppStore(storage), values, storage };
}
test('Setup begins on the live board; full inventories cannot be selected or exceeded', () => {
    const position = draft();
    assert.equal(position.validate(), null);
    assert.deepEqual(position.snapshot().remaining, { k: 0, a: 0, b: 0, n: 0, r: 0, c: 0, p: 0 });
    assert.equal(position.edit('tool', 'p'), false);
    position.edit('tool', 'erase'); position.tap(0, 6);
    assert.equal(position.remaining().p, 1);
    assert.equal(position.edit('tool', 'p'), true);
    assert.equal(position.tap(0, 5), true);
    assert.equal(position.tap(2, 4), false);
    assert.equal(position.remaining().p, 0);
    assert.equal(position.snapshot().notice, 'setupCount');
});
test('Clear leaves both generals; Full board restores all pieces and Red to move', () => {
    const position = draft(); position.edit('clear');
    assert.equal(position.board.flat().filter(Boolean).length, 2);
    assert.equal(position.validate(), 'setupFacing');
    position.edit('tool', 'r'); position.tap(4, 5);
    assert.equal(position.validate(), 'setupPreviousCheck');
    position.edit('tool', 'erase'); position.tap(4, 5); position.edit('tool', 'p'); position.tap(4, 5);
    assert.equal(position.validate(), null);
    position.edit('turn', 'black'); position.edit('initial');
    assert.equal(position.board.flat().filter(Boolean).length, 32);
    assert.equal(position.turn, 'red');
});
test('Placement and relocation reject unreachable general, advisor, elephant and pawn squares on both sides', () => {
    for (const color of ['red', 'black']) {
        const position = draft(); position.edit('clear'); position.edit('color', color);
        const y = row => color === 'red' ? row : 9 - row;
        for (const [type, x, row, error] of [['a', 4, 9, 'setupAdvisor'], ['b', 4, 3, 'setupElephant'], ['p', 1, 6, 'setupPawn']]) {
            position.edit('tool', type);
            assert.equal(position.tap(x, y(row)), false);
            assert.equal(position.snapshot().notice, error);
        }
        position.edit('tool', 'move'); position.tap(4, y(9));
        assert.equal(position.tap(2, y(9)), false);
        assert.equal(position.snapshot().notice, 'setupPalace');
        assert.equal(position.tap(3, y(8)), true);
        assert.equal(position.board[y(8)][3].color, color);
        position.edit('tool', 'p'); assert.equal(position.tap(0, y(6)), true);
        assert.equal(position.tap(0, y(5)), false, 'Two uncrossed pawns cannot share a file');
    }
});
test('Missing generals and illegal previous check are rejected; current-side check is allowed', () => {
    const position = draft(); position.edit('clear');
    position.edit('tool', 'erase'); position.tap(4, 9);
    assert.equal(position.validate(), 'setupKings');
    position.edit('tool', 'k'); position.tap(3, 9);
    position.edit('color', 'black'); position.edit('tool', 'r'); position.tap(3, 5);
    assert.equal(position.validate(), null, 'Red may start in check');
    position.edit('turn', 'black');
    assert.equal(position.validate(), 'setupPreviousCheck');
});
test('Draft changes and cancellation preserve saved history/redo/notes; applying is atomic and restorable', () => {
    const { store, values, storage } = fixture();
    store.tap(7, 7); store.tap(4, 7); store.saveNote('Keep this'); store.navigate('undo');
    const before = store.snapshot().game, saved = [...values];
    store.beginSetup(); store.editSetup('clear');
    assert.equal(store.navigate('redo'), false);
    assert.equal(store.saveNote('Cannot change history from the editor'), false);
    assert.equal(store.selectSuggestion('h2e2'), false);
    store.toggleExpanded(); assert.equal(store.snapshot().ui.expanded, false);
    assert.equal(store.endSetup(true), false);
    assert.deepEqual(store.snapshot().game, before); assert.deepEqual([...values], saved);
    store.back(); assert.equal(store.snapshot().ui.setup, null);
    assert.deepEqual(store.snapshot().game, before); assert.deepEqual([...values], saved);
    store.beginSetup(); store.editSetup('clear'); store.editSetup('tool', 'p'); store.tap(4, 5);
    store.editSetup('turn', 'black'); assert.equal(store.endSetup(true), true);
    assert.equal(store.snapshot().game.currentMoveIndex, -1);
    assert.equal(store.snapshot().game.moveHistory.length, 0);
    assert.equal(store.snapshot().turn, 'black');
    assert.deepEqual(new AppStore(storage).snapshot().game, store.snapshot().game);
    assert.equal(store.analysisPosition().moves, '');
    assert.equal(store.analysisPosition().initialFen, store.snapshot().game.fen);
    store.reset(); assert.equal(store.snapshot().board.flat().filter(Boolean).length, 32);
});
test('Home/settings and setup block engine/book; foreground or profile changes cannot bypass the gate', async () => {
    const { store } = fixture(), requests = [], books = [];
    let output;
    const analysis = new AnalysisController(store, { available: true,
        listen: async emit => { output = emit; return () => {}; },
        analyze: async request => requests.push(request), stop: async () => {}, lookupBook: async fen => { books.push(fen); return []; }
    }, { enabled: false, delayMs: 0 });
    try {
        await analysis.started;
        analysis.setForeground(false); analysis.setForeground(true); store.setAnalysis({ profile: 'deep' });
        assert.equal(requests.length, 0); assert.equal(books.length, 0);
        analysis.setEnabled(true); assert.equal(requests.length, 1);
        const old = requests[0].id;
        store.beginSetup(); assert.equal(analysis.snapshot().status, 'setup');
        store.editSetup('clear'); analysis.setForeground(true); store.setAnalysis({ profile: 'eco' });
        output({ id: old, line: 'info depth 20 score cp 999 pv h2e2' });
        assert.equal(analysis.snapshot().rows.length, 0);
        assert.equal(requests.length, 1); assert.equal(books.length, 1);
        analysis.setEnabled(false); store.endSetup(); analysis.setForeground(true);
        assert.equal(requests.length, 1);
        analysis.setEnabled(true); assert.equal(requests.length, 2);
    } finally { analysis.destroy(); }
});
test('Reentering Analysis retries a failed listener registration without a hidden Pause button', async () => {
    const { store } = fixture(); let attempts = 0, requests = 0;
    const analysis = new AnalysisController(store, { available: true,
        listen: async () => { if (++attempts === 1) throw Error('Temporary bridge failure'); return () => {}; },
        analyze: async () => requests++, stop: async () => {}, lookupBook: async () => []
    }, { enabled: false, delayMs: 0 });
    try {
        await analysis.started; assert.equal(analysis.snapshot().status, 'error');
        analysis.setEnabled(false); analysis.setEnabled(true); await analysis.started;
        assert.equal(attempts, 2); assert.equal(requests, 1);
    } finally { analysis.destroy(); }
});
