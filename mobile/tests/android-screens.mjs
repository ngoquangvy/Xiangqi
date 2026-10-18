import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import Game from '../../src/core/XiangqiGame.js';
import { connect, adb, pause } from './android-connection.mjs';

// Packaged WebView + native Pikafish, with real taps. Restore the exact session.
const device = await connect();
const { evaluate, wait, touch } = device;
const read = async () => (await evaluate("Capacitor.nativePromise('LocalSession','get',{})")).value;
const status = () => evaluate("Capacitor.nativePromise('Pikafish','status',{})");
const original = await read();
try {
    const seed = JSON.stringify({ version: 1, game: new Game().exportGame(), flipped: false,
        language: 'en', soundEnabled: false, previewHelpSeen: true, analysis: { profile: 'unlimited', bookEnabled: true } });
    await evaluate(`Capacitor.nativePromise('LocalSession','set',{value:${JSON.stringify(seed)}})`);
    await device.call('Page.reload'); await wait('document.querySelectorAll(".square").length===90');
    assert.equal(await evaluate('document.querySelector("#mobile-app").dataset.screen'), 'home');
    await pause(800); assert.equal((await status()).searching, false);
    await touch('#open-settings'); await touch('#language'); await touch('#language');
    assert.equal((await status()).searching, false);
    await touch('#settings-back'); await touch('#open-analysis');
    await wait('document.querySelectorAll("#engine-results button").length===5');
    await wait('document.querySelectorAll("#book-results button").length===17');
    await touch('#workspace-settings');
    await wait("Capacitor.nativePromise('Pikafish','status',{}).then(s=>!s.searching)");
    await evaluate("document.querySelector('#engine-profile').value='eco';document.querySelector('#engine-profile').dispatchEvent(new Event('change'))");
    await pause(800); assert.equal((await status()).searching, false);
    await touch('#settings-back');
    await touch('.square[data-square=h2]'); await touch('.square[data-square=e2]');
    await wait('document.querySelectorAll(".history-move").length===1');
    await pause(200); const before = await read();
    await touch('#setup-position');
    await wait("Capacitor.nativePromise('Pikafish','status',{}).then(s=>!s.searching)");
    assert.equal(await evaluate('document.querySelectorAll("#setup-palette button:disabled").length'), 7);
    await touch('[data-setup-action=clear]');
    assert.equal(await evaluate('document.querySelectorAll(".square.red,.square.black").length'), 2);
    assert.equal(await evaluate('document.querySelector("#setup-apply").disabled'), true);
    await touch('#setup-palette [data-type=p]'); await touch('.square[data-square=e4]');
    assert.equal(await evaluate('document.querySelector("#setup-apply").disabled'), false);
    assert.equal(await read(), before);
    adb('shell', 'input', 'keyevent', '4');
    await wait('document.querySelector("#position-editor").hidden');
    assert.equal(await read(), before);
    assert.equal(await evaluate('document.querySelectorAll(".history-move").length'), 1);
    await touch('#setup-position'); await touch('[data-setup-action=clear]');
    await touch('#setup-palette [data-type=p]'); await touch('.square[data-square=e4]');
    await touch('#setup-apply'); await touch('#confirm-cancel'); assert.equal(await read(), before);
    await writeFile('artifacts/android-position-setup.png', adb('exec-out', 'screencap', '-p'));
    await touch('#setup-apply'); await touch('#confirm-accept');
    await wait('document.querySelectorAll("#engine-results button").length>0');
    assert.match(await evaluate('document.querySelector("#engine-analysis").dataset.fen'), /^4k4\/9\/9\/9\/9\/4P4\/9\/9\/9\/4K4 b /);
    assert.equal(await evaluate('document.querySelectorAll(".history-move").length'), 0);
    await wait("Capacitor.nativePromise('LocalSession','get',{}).then(s=>JSON.parse(JSON.parse(s.value).game).startingFen.startsWith('4k4/'))");
    await touch('#workspace-home');
    await wait('document.querySelector("#mobile-app").dataset.screen==="home"');
    await pause(700); assert.equal((await status()).searching, false);
    await writeFile('artifacts/android-home-screen.png', adb('exec-out', 'screencap', '-p'));
    console.log('ANDROID_SCREENS_PASS: Home/Settings/setup native gates, live-board editor, inventories, kings-only clear, native Back cancel, confirmation, custom FEN analysis/save');
} finally {
    try {
        if (original !== null) {
            await evaluate(`Capacitor.nativePromise('LocalSession','set',{value:${JSON.stringify(original)}})`);
            await device.call('Page.reload'); await wait('document.querySelectorAll(".square").length===90');
            assert.equal(await read(), original);
        }
    } finally { device.close(); }
}
