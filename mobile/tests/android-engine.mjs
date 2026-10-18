import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { connect, adb, pause, packageId } from './android-connection.mjs';
import { bookRows } from '../src/analysis/results.js';
import { LocalGame } from '../src/domain/LocalGame.js';
import { readBookSource, sourceRowsFor } from './book-source.mjs';

// Real packaged engine and native touches, not mocked engine scores.
adb('install', '-r', 'artifacts/xiangqi-mobile-debug.apk');
adb('shell', 'am', 'force-stop', packageId);
adb('shell', 'pm', 'clear', packageId);
adb('shell', 'am', 'start', '-n', `${packageId}/.MainActivity`);
await pause(1500);
let device = await connect();
const nativeStatus = () => device.evaluate("Capacitor.nativePromise('Pikafish','status',{})");
const click = selector => device.evaluate(`document.querySelector(${JSON.stringify(selector)}).click()`);
const touch = async selector => {
    await device.evaluate(`document.querySelector(${JSON.stringify(selector)}).scrollIntoView({block:'nearest'})`);
    await device.touch(selector);
};
const engineReady = () => device.wait('document.querySelectorAll("#engine-results [data-source=engine]").length > 0');
const toggleEngine = async () => { await click('#tab-settings'); await touch('#engine-pause'); await click('#tab-analysis'); };
const rootFen = new LocalGame().snapshot().fen;
try {
    await engineReady();
    await device.wait('document.querySelectorAll("#book-results [data-source=book]").length > 0');
    const initial = await nativeStatus(); assert.equal(initial.alive, true);
    assert.equal(initial.id, await device.evaluate('document.querySelector("#engine-analysis").dataset.request'));
    const book = readBookSource(), sourceRows = sourceRowsFor(book, rootFen);
    const expected = bookRows(rootFen, sourceRows).map(row => row.move);
    assert.deepEqual(await device.evaluate('[...document.querySelectorAll("#book-results button")].map(row=>row.dataset.suggestion)'), expected);
    const otherCounters = rootFen.replace('0 1', '17 99');
    const lookup = await device.evaluate(`Capacitor.nativePromise('Pikafish','lookupBook',{fen:${JSON.stringify(otherCounters)}})`);
    assert.deepEqual(lookup.rows, sourceRows); // Includes every alternate PV and structured count.
    // Injected command/path/profile values cannot cross the fixed native bridge.
    assert.equal(await device.evaluate(`Capacitor.nativePromise('Pikafish','analyze',{id:'bad',initialFen:${JSON.stringify(rootFen + '\nquit')},profile:'balanced'}).then(()=>false,()=>true)`), true);
    assert.equal(await device.evaluate(`Capacitor.nativePromise('Pikafish','analyze',{id:'bad',initialFen:${JSON.stringify(rootFen)},profile:'../../other'}).then(()=>false,()=>true)`), true);

    await click('#tab-settings');
    await device.evaluate("document.querySelector('#engine-profile').value='deep';document.querySelector('#engine-profile').dispatchEvent(new Event('change'))");
    await click('#tab-analysis');
    await toggleEngine();
    await device.wait('document.querySelector("#engine-status").dataset.state === "paused"');
    await pause(300); assert.equal((await nativeStatus()).searching, false);
    await toggleEngine(); await engineReady();
    await touch('#book-results button');
    await device.wait('!document.querySelector("#cancel-preview").hidden');
    assert.equal(await device.evaluate('document.querySelectorAll(".history-move").length'), 0);
    assert.equal(await device.evaluate('document.querySelector("#mobile-app").classList.contains("previewing")'), false);
    await touch('.square[data-square=e2]'); await engineReady();
    assert.equal(await device.evaluate('document.querySelector(".board-actions").dataset.mode'), 'game');
    assert.equal(await device.evaluate('document.querySelectorAll(".square.selected,.square.suggestion").length'), 0);
    // A real move and rapid navigation must leave only the latest request active.
    await device.touch('.square[data-square=h2]'); await device.touch('.square[data-square=e2]');
    await device.evaluate("for(let i=0;i<8;i++){document.querySelector('#undo').click();document.querySelector('#redo').click();}");
    await engineReady();
    await device.wait("Capacitor.nativePromise('Pikafish','status',{}).then(s=>s.id===document.querySelector('#engine-analysis').dataset.request)");
    assert.equal(await device.evaluate('document.querySelectorAll(".history-move").length'), 1);
    assert.equal(await device.evaluate('document.querySelector("#engine-analysis").dataset.fen.split(" ")[1]'), 'b');
    assert.equal(await device.evaluate('document.querySelector(".square[data-square=e2]").classList.contains("red")'), true);
    // Kill only this app's child: errors must become retryable rather than hang.
    const pid = adb('shell', 'pidof', 'libpikafish.so').toString().trim();
    assert.match(pid, /^\d+$/);
    adb('shell', 'run-as', packageId, 'kill', '-9', pid);
    await device.wait('document.querySelector("#engine-status").dataset.state === "error"');
    await toggleEngine(); await engineReady();

    // Background releases native memory. A user pause survives foreground return.
    if (await device.evaluate('document.querySelector("#engine-status").dataset.state') === 'complete') { await toggleEngine(); }
    await toggleEngine();
    await device.wait('document.querySelector("#engine-status").dataset.state === "paused"');
    adb('shell', 'input', 'keyevent', 'KEYCODE_HOME'); await pause(700);
    assert.equal((await nativeStatus()).alive, false);
    adb('shell', 'am', 'start', '-n', `${packageId}/.MainActivity`);
    await device.wait('document.querySelector("#engine-status").dataset.state === "paused"');
    assert.equal((await nativeStatus()).alive, false);
    await toggleEngine(); await engineReady();
    // Book toggles persist, but must not restart an unrelated engine request.
    const beforeBook = await device.evaluate('document.querySelector("#engine-analysis").dataset.request');
    await click('#tab-settings'); await click('#book-toggle');
    assert.equal(await device.evaluate('document.querySelector("#engine-analysis").dataset.request'), beforeBook);
    await device.wait('document.querySelector("#save-status").textContent !== ""');
    await pause(300);
    device.close();
    adb('shell', 'am', 'force-stop', packageId);
    adb('shell', 'am', 'start', '-n', `${packageId}/.MainActivity`); await pause(700);
    device = await connect(); await engineReady();
    assert.equal(await device.evaluate('document.querySelector("#engine-profile").value'), 'deep');
    assert.equal(await device.evaluate('document.querySelector("#book-toggle").getAttribute("aria-pressed")'), 'false');
    assert.equal(await device.evaluate('document.querySelectorAll(".history-move").length'), 1);
    // Leave a fresh, balanced game open for manual testing.
    await click('#tab-settings'); await click('#book-toggle');
    await device.evaluate("document.querySelector('#engine-profile').value='balanced';document.querySelector('#engine-profile').dispatchEvent(new Event('change'))");
    await click('#new-game'); await click('#confirm-accept'); await click('#tab-analysis'); await engineReady();
    let layouts = 0;
    for (const language of ['vi', 'en']) {
        if (await device.evaluate('document.documentElement.lang') !== language) await click('#language');
        for (const [width, height] of [[320, 568], [390, 844], [844, 390]]) {
            // CDP emulates viewport sizes here; real native touches were tested
            // above at the actual device resolution, not these virtual sizes.
            await device.call('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: true });
            await device.wait(`innerWidth===${width}&&innerHeight===${height}`);
            for (const expanded of [false, true]) {
                if (await device.evaluate('document.querySelector("#expand").getAttribute("aria-expanded")==="true"') !== expanded) await click('#expand');
                const layout = await device.evaluate(`(()=>{const app=document.querySelector('#mobile-app'),panel=document.querySelector('#panel-analysis');return {
                    frame:app.scrollTop===0&&app.scrollHeight<=app.clientHeight+1&&document.body.scrollWidth<=innerWidth+1,
                    horizontal:panel.scrollWidth<=panel.clientWidth+1,
                    targets:[...document.querySelectorAll('.analysis-row')].every(n=>n.getBoundingClientRect().height>=43.9),
                    rows:document.querySelectorAll('#engine-results button').length,
                    clean:!panel.querySelector('#engine-pause,#engine-status,#score-perspective,.engine-toolbar')};})()`);
                assert.ok(layout.frame && layout.horizontal && layout.targets && layout.rows > 0 && layout.clean, JSON.stringify({ language, width, height, expanded, layout }));
                layouts++;
            }
        }
    }
    await device.call('Emulation.clearDeviceMetricsOverride');
    if (await device.evaluate('document.querySelector("#expand").getAttribute("aria-expanded")==="true"')) await click('#expand');
    if (await device.evaluate('document.documentElement.lang') !== 'vi') await click('#language');
    await device.evaluate('document.fonts.ready');
    assert.equal(await device.evaluate('document.body.textContent.includes("\ufffd")'), false);
    await writeFile('artifacts/android-engine.png', adb('exec-out', 'screencap', '-p'));
    console.log('ANDROID_ENGINE_PASS', JSON.stringify({ engine: 'Pikafish 2026-01-02', book: expected.length, layouts,
        checks: 'real PV, web book parity/counters, bridge validation, pause/preview, rapid undo/redo, crash/retry, background, restore',
        native: await nativeStatus() }));
} catch (error) {
    console.error('NATIVE_STATUS', await nativeStatus().catch(() => null));
    console.error('UI', await device.evaluate('document.querySelector("#panel-analysis").innerText').catch(() => null));
    throw error;
} finally { device.close(); }
