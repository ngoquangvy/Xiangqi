import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { ENGINE_VARIATION_COUNT } from '../src/domain/lineLimits.js';
import { createRequire } from 'node:module';
const read = name => readFileSync(new URL(name, import.meta.url), 'utf8');

test('Shared ESM core still supports the existing Electron CommonJS entry point', () => {
    const Game = createRequire(import.meta.url)('../../src/core/XiangqiGame.js');
    assert.equal(typeof Game, 'function');
    assert.equal(new Game().getGameState().board.flat().filter(Boolean).length, 32);
});

test('iOS registers both real plugins and both native backends are enabled without changing browser behavior', () => {
    const view = read('../ios/App/App/GameViewController.swift');
    assert.ok(view.includes('registerPluginInstance(LocalSessionPlugin())'));
    assert.ok(view.includes('registerPluginInstance(PikafishPlugin())'));
    assert.ok(read('../ios/App/App/SceneDelegate.swift').includes('rootViewController = GameViewController()'));
    for (const source of ['../src/analysis/native.js', '../src/storage/platform.js']) {
        assert.ok(read(source).includes("['android', 'ios'].includes(Capacitor.getPlatform())"));
    }
});

test('All handwritten iOS source build references exist; bridge and resource links are present', () => {
    const project = read('../ios/App/App.xcodeproj/project.pbxproj');
    for (const [, name] of project.matchAll(/path = ([A-Za-z][A-Za-z0-9]+\.(?:swift|mm));/g)) {
        assert.ok(existsSync(new URL(`../ios/App/App/${name}`, import.meta.url)), name);
    }
    assert.ok(project.includes('SWIFT_OBJC_BRIDGING_HEADER = "App/App-Bridging-Header.h"'));
    assert.ok(project.includes('NativeBuild/$(PLATFORM_NAME)/libPikafish.a'));
    assert.ok(project.includes('analysis in Resources'));
    assert.ok(project.includes('"-lsqlite3"'));
});

test('Native iOS compiler shares the five-PV bound and the smoke body is valid async JavaScript', () => {
    assert.equal(ENGINE_VARIATION_COUNT, 5);
    const compiler = read('../scripts/prepare-ios-engine.mjs');
    assert.ok(compiler.includes('`-DXQ_VARIATION_COUNT=${ENGINE_VARIATION_COUNT}`'));
    assert.ok(compiler.includes("name !== 'main.cpp'"));
    const AsyncFunction = Object.getPrototypeOf(async function() {}).constructor;
    assert.doesNotThrow(() => new AsyncFunction('restore', read('./ios-smoke-body.js')));
    const native = read('../native/PikafishSession.cpp');
    assert.ok(native.includes('engine->wait_for_search_finished()'));
    assert.ok(read('../native/PikafishSession.h').includes('generation.load() == requestTicket'));
    assert.ok(native.includes('set_on_update_full([this]'));
});

test('IPA workflow is unsigned, validates iPhone platform and requires simulator success before packaging', () => {
    const build = read('../scripts/ios-build.mjs');
    assert.ok(build.includes('CODE_SIGNING_ALLOWED=NO'));
    assert.ok(build.includes("'generic/platform=iOS'"));
    assert.ok(build.indexOf("['scripts/ios-simulator.mjs']") < build.indexOf("const staging"));
    assert.ok(build.includes('physicalIPhoneTested: false'));
    const workflow = read('../../.github/workflows/ios-sideload.yml');
    assert.ok(workflow.includes('branches: [master]'));
    assert.ok(!workflow.includes('secrets.'));
});
