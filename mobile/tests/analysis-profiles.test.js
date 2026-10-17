import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PROFILES, analysisSettings } from '../src/analysis/settings.js';
import { AppStore } from '../src/state/AppStore.js';
import { GameStorage } from '../src/storage/GameStorage.js';
import { AnalysisController } from '../src/analysis/AnalysisController.js';

test('Maximum analysis is opt-in and unbounded in time/depth, not in CPU or memory', () => {
    assert.equal(analysisSettings().profile, 'balanced');
    assert.deepEqual(PROFILES.eco, { threads: 1, hash: 16, depth: 14, milliseconds: 2000 });
    assert.deepEqual(PROFILES.balanced, { threads: 1, hash: 32, depth: 18, milliseconds: 5000 });
    assert.deepEqual(PROFILES.deep, { threads: 2, hash: 64, depth: 22, milliseconds: 10000 });
    assert.deepEqual(PROFILES.unlimited, { threads: 2, hash: 64, depth: 0, milliseconds: 0 });
    assert.equal(analysisSettings({ profile: 'unlimited' }).profile, 'unlimited');
    assert.equal(analysisSettings({ profile: 'go infinite' }).profile, 'balanced');
    const read = path => readFileSync(new URL(path, import.meta.url), 'utf8');
    const android = '../android/app/src/main/java/com/ngoquangvy/xiangqi/mobile/';
    assert.ok(read(`${android}PikafishProcess.java`).includes('depth == 0 && time == 0 ? "go infinite"'));
    assert.ok(read('../native/PikafishSession.cpp').includes('limits.infinite = config.depth == 0 && config.milliseconds == 0'));
    for (const path of [`${android}PikafishPlugin.java`, '../ios/App/App/PikafishPlugin.swift', '../ios/App/App/AnalysisAssets.swift']) {
        for (const profile of Object.keys(PROFILES)) assert.ok(read(path).includes(`"${profile}"`), `${path}: ${profile}`);
    }
    assert.ok(read('../ios/App/App/AnalysisAssets.swift').includes('(depth == 0 && time == 0) : (depth > 0 && time > 0)'));
});

test('Continuous analysis persists, accepts deep output and still respects pause, preview and background', async () => {
    const values = new Map();
    const storage = new GameStorage({ getItem: key => values.get(key), setItem: (key, value) => values.set(key, value) });
    const store = new AppStore(storage), calls = [];
    let emit;
    const analysis = new AnalysisController(store, { available: true,
        listen: async output => { emit = output; return () => {}; },
        analyze: async request => calls.push(request), stop: async () => calls.push('stop'), lookupBook: async () => [] });
    try {
        await analysis.started;
        store.setAnalysis({ profile: 'unlimited' });
        assert.equal(calls.at(-1).profile, 'unlimited');
        assert.equal(new AppStore(storage).snapshot().ui.analysis.profile, 'unlimited');
        emit({ id: calls.at(-1).id, line: 'info depth 40 score cp 25 pv h2e2' });
        assert.equal(analysis.snapshot().rows[0].depth, 40);
        assert.equal(analysis.snapshot().status, 'searching');
        analysis.togglePause(); assert.equal(calls.at(-1), 'stop');
        analysis.setForeground(false); analysis.setForeground(true);
        assert.equal(analysis.snapshot().status, 'paused');
        analysis.togglePause(); assert.equal(calls.at(-1).profile, 'unlimited');
        store.preview('h2e2'); assert.equal(calls.at(-1), 'stop');
        store.cancelPreview(); assert.equal(calls.at(-1).profile, 'unlimited');
        analysis.setForeground(false); store.reset();
        assert.equal(analysis.snapshot().status, 'background');
        assert.equal(calls.at(-1), 'stop');
        analysis.setForeground(true); assert.equal(calls.at(-1).profile, 'unlimited');
    } finally { analysis.destroy(); }
});
