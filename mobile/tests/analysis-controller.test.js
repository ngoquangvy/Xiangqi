import test from 'node:test';
import assert from 'node:assert/strict';
import { AppStore } from '../src/state/AppStore.js';
import { GameStorage } from '../src/storage/GameStorage.js';
import { AnalysisController } from '../src/analysis/AnalysisController.js';

const tick = () => new Promise(resolve => setImmediate(resolve));
function fixture() {
    const values = new Map();
    const storage = new GameStorage({ getItem: key => values.get(key), setItem: (key, value) => values.set(key, value) });
    const store = new AppStore(storage), calls = [], books = [];
    let output, failure, removed = false;
    const transport = { available: true,
        listen: async (onOutput, onFailure) => { output = onOutput; failure = onFailure; return () => { removed = true; }; },
        analyze: async request => calls.push(request), stop: async () => calls.push('stop'),
        lookupBook: fen => new Promise((resolve, reject) => books.push({ fen, resolve, reject })),
    };
    const analysis = new AnalysisController(store, transport);
    return { store, analysis, calls, books, storage, transport, removed: () => removed,
        emit: (id, line) => output({ id, line }), fail: id => failure({ id }) };
}

test('Analysis follows the committed path; UI-only changes do not restart searches', async () => {
    const { store, analysis, calls } = fixture(); await analysis.started;
    const first = calls[0]; assert.equal(first.moves, '');
    store.tap(7, 7); store.flip(); store.setLanguage('en'); store.setTab('history'); store.toggleSound();
    assert.equal(calls.length, 1);
    store.tap(4, 7); assert.equal(calls.at(-1).moves, 'h2e2');
    const moved = analysis.snapshot();
    assert.equal(moved.fen, store.snapshot().game.fen); assert.equal(moved.rows.length, 0);
    store.navigate('undo'); assert.equal(calls.at(-1).moves, '');
    store.navigate('redo'); assert.equal(calls.at(-1).moves, 'h2e2');
    store.saveNote('not an engine input'); assert.equal(calls.length, 4);
    analysis.destroy();
});

test('Late output, old book replies and old errors cannot overwrite a newer position', async () => {
    const { store, analysis, calls, books, emit, fail } = fixture(); await analysis.started;
    const old = calls[0].id;
    store.tap(7, 7); store.tap(4, 7);
    const id = calls.at(-1).id;
    emit(old, 'info depth 18 score cp 999 pv h2e2'); fail(old);
    assert.equal(analysis.snapshot().status, 'searching'); assert.equal(analysis.snapshot().rows.length, 0);
    books[0].resolve([{ move: 'h2e2', score: 1 }]); await tick();
    assert.equal(analysis.snapshot().book.length, 0);
    books.at(-1).resolve([{ move: 'h9g7', score: .7 }]); await tick();
    assert.equal(analysis.snapshot().book[0].move, 'h9g7');
    emit(id, 'info depth 7 score cp 25 pv h9g7');
    assert.equal(analysis.snapshot().rows[0].value, -25);
    emit(id, 'info depth 6 score cp 100 pv h9g7'); assert.equal(analysis.snapshot().rows[0].depth, 7);
    emit(id, 'bestmove h9g7'); assert.equal(analysis.snapshot().status, 'complete');
    emit(id, 'info depth 10 score cp 500 pv h9g7'); assert.equal(analysis.snapshot().rows[0].depth, 7);
    analysis.destroy();
});

test('Pause, preview and background stop work; resume never cancels a user pause', async () => {
    const { store, analysis, calls, emit } = fixture(); await analysis.started;
    const oldId = calls[0].id;
    analysis.togglePause(); assert.equal(calls.at(-1), 'stop'); assert.equal(analysis.snapshot().status, 'paused');
    analysis.setForeground(false); analysis.setForeground(true);
    assert.equal(analysis.snapshot().status, 'paused');
    emit(oldId, 'info depth 6 score cp 20 pv h2e2'); assert.equal(analysis.snapshot().rows.length, 0);
    analysis.togglePause(); assert.equal(analysis.snapshot().status, 'searching');
    store.preview('h2e2'); assert.equal(analysis.snapshot().status, 'preview'); assert.equal(calls.at(-1), 'stop');
    store.cancelPreview(); assert.equal(analysis.snapshot().status, 'searching'); assert.equal(calls.at(-1).moves, '');
    analysis.setForeground(false); store.tap(7, 7); store.tap(4, 7);
    assert.equal(calls.at(-1), 'stop');
    analysis.setForeground(true); assert.equal(calls.at(-1).moves, 'h2e2');
    analysis.destroy();
});

test('Five PV ranks remain independent, ordered and intact at bestmove; rank six is ignored', async () => {
    const { analysis, calls, emit } = fixture(); await analysis.started;
    const id = calls[0].id;
    const moves = ['h2e2', 'b2e2', 'h0g2', 'b0c2', 'e3e4'];
    for (const rank of [5, 3, 1, 4, 2]) emit(id, `info depth 8 multipv ${rank} score cp ${rank} pv ${moves[rank - 1]}`);
    assert.deepEqual(analysis.snapshot().rows.map(row => row.rank), [1, 2, 3, 4, 5]);
    assert.deepEqual(analysis.snapshot().rows.map(row => row.move), moves);
    emit(id, 'info depth 7 multipv 5 score cp 999 pv h2e2');
    assert.equal(analysis.snapshot().rows[4].value, 5);
    emit(id, 'info depth 9 multipv 6 score cp 999 pv h2e2');
    emit(id, 'bestmove h2e2');
    assert.equal(analysis.snapshot().status, 'complete');
    assert.deepEqual(analysis.snapshot().rows.map(row => row.move), moves);
    analysis.destroy();
});

test('Profile/book preferences persist, are allowlisted and book toggles do not restart the engine', async () => {
    const { store, analysis, calls, books, storage } = fixture(); await analysis.started;
    store.setAnalysis({ bookEnabled: false }); assert.equal(calls.length, 1); assert.equal(analysis.snapshot().bookStatus, 'off');
    books[0].resolve([{ move: 'h2e2' }]); await tick(); assert.equal(analysis.snapshot().book.length, 0);
    store.setAnalysis({ profile: 'deep' }); assert.equal(calls.at(-1).profile, 'deep');
    const restored = new AppStore(storage); assert.deepEqual(restored.snapshot().ui.analysis, { profile: 'deep', bookEnabled: false });
    store.setAnalysis({ profile: '../../bad', bookEnabled: true }); assert.equal(calls.at(-1).profile, 'balanced');
    analysis.destroy();
});

test('Failure is recoverable and disposal removes listeners and rejects pending responses', async () => {
    const { analysis, calls, books, fail, removed } = fixture(); await analysis.started;
    fail(calls[0].id); assert.equal(analysis.snapshot().status, 'error');
    analysis.togglePause(); assert.equal(analysis.snapshot().status, 'searching');
    analysis.destroy(); assert.equal(removed(), true);
    const before = analysis.snapshot(); books[0].resolve([{ move: 'h2e2' }]); await tick();
    assert.deepEqual(analysis.snapshot(), before); assert.equal(calls.at(-1), 'stop');
});

test('A new controller session never reuses an old request ID; late listener registration is disposed', async () => {
    const first = fixture(), second = fixture();
    await first.analysis.started; await second.analysis.started;
    assert.notEqual(first.calls[0].id, second.calls[0].id);
    first.analysis.destroy(); second.analysis.destroy();
    let ready, disposed = false;
    const analysis = new AnalysisController(first.store, { available: true, stop: async () => {},
        listen: () => new Promise(resolve => { ready = resolve; }) });
    analysis.destroy(); ready(() => { disposed = true; }); await analysis.started;
    assert.equal(disposed, true);
});

test('Listener registration failure can be retried without changing the game', async () => {
    const { store, analysis: original } = fixture(); original.destroy();
    let attempts = 0, searches = 0;
    const analysis = new AnalysisController(store, { available: true, stop: async () => {}, lookupBook: async () => [],
        listen: async () => { if (++attempts === 1) throw Error('bridge'); return () => {}; },
        analyze: async () => { searches++; } });
    await analysis.started; assert.equal(analysis.snapshot().status, 'error');
    analysis.togglePause(); await analysis.started;
    assert.equal(analysis.snapshot().status, 'searching'); assert.equal(searches, 1);
    analysis.destroy();
});

test('No-move engine replies mark a terminal position without suggesting a null move', async () => {
    const { store, analysis, calls, emit } = fixture(); await analysis.started;
    emit(calls[0].id, 'bestmove 0000');
    assert.equal(analysis.snapshot().status, 'terminal'); assert.deepEqual(analysis.snapshot().rows, []);
    assert.equal(store.snapshot().winner, null); // Engine output is not an authoritative game result.
    analysis.togglePause(); assert.equal(analysis.snapshot().status, 'searching');
    analysis.destroy();
});

test('Browsing a PV retains root suggestions/book and never starts searches for simulated positions', async () => {
    const { store, analysis, calls, books, emit } = fixture(); await analysis.started;
    emit(calls[0].id, 'info depth 8 score cp 10 pv h2e2 h9g7 h0g2');
    books[0].resolve([{ move: 'b2e2', score: .7 }]); await tick();
    store.preview('h2e2', ['h2e2', 'h9g7', 'h0g2']);
    assert.equal(calls.at(-1), 'stop'); assert.equal(analysis.snapshot().rows.length, 1); assert.equal(analysis.snapshot().book.length, 1);
    const count = calls.length;
    store.stepPreview(1); store.stepPreview(-1); store.preview('b2e2', ['b2e2', 'b9c7']);
    assert.equal(calls.length, count); assert.equal(books.length, 1);
    store.cancelPreview(); assert.equal(calls.at(-1).moves, ''); assert.equal(books.length, 1);
    analysis.destroy();
});

test('Board-touch preview exit restores live analysis without overriding a user pause', async () => {
    const { store, analysis, calls, emit } = fixture(); await analysis.started;
    const original = calls[0].id;
    store.preview('h2e2', ['h2e2', 'h9g7']); store.stepPreview(1);
    assert.equal(store.tap(4, 7), 'preview-cancelled');
    assert.equal(analysis.snapshot().status, 'searching'); assert.equal(calls.at(-1).moves, '');
    assert.notEqual(calls.at(-1).id, original);
    emit(original, 'info depth 50 score cp 999 pv h2e2');
    assert.deepEqual(analysis.snapshot().rows, []);
    analysis.togglePause(); store.preview('h2e2'); store.tap(7, 7);
    assert.equal(analysis.snapshot().status, 'paused'); assert.equal(calls.at(-1), 'stop');
    analysis.destroy();
});
