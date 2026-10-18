import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import Game from '../../src/core/XiangqiGame.js';
import { connect, adb, pause, packageId } from './android-connection.mjs';

// All presets must actually produce five independent rows, not just request 5.
const device = await connect();
const { evaluate, wait, touch } = device;
await wait('typeof Capacitor!=="undefined" && document.querySelectorAll(".square").length===90');
const read = async () => (await evaluate("Capacitor.nativePromise('LocalSession','get',{})")).value;
const original = await read();
if (!original) { device.close(); throw Error('A saved session is required.'); }
const profiles = ['eco', 'balanced', 'deep', 'unlimited', 'deep_cool'];
const results = [];
let activeProfile;
try {
    for (const profile of profiles) {
        activeProfile = profile;
        const seeded = JSON.stringify({ ...JSON.parse(original), game: new Game().exportGame(), language: 'vi',
            flipped: false, soundEnabled: false, previewHelpSeen: true, analysis: { profile, bookEnabled: false } });
        await evaluate(`Capacitor.nativePromise('LocalSession','set',{value:${JSON.stringify(seeded)}})`);
        await device.call('Page.reload');
        await device.enterAnalysis();
        // Deep preset can spend ten seconds searching, plus startup overhead.
        await wait('document.querySelectorAll("#engine-results button").length===5');
        if (profile === 'unlimited') {
            await pause(11000);
            assert.equal(await evaluate('document.querySelector("#engine-status").dataset.state'), 'searching');
            assert.equal((await evaluate("Capacitor.nativePromise('Pikafish','status',{})")).searching, true);
            await touch('#workspace-settings');
            await wait("Capacitor.nativePromise('Pikafish','status',{}).then(s=>!s.searching)");
            assert.equal(await evaluate('document.querySelector("#engine-status").dataset.state'), 'inactive');
            await touch('#settings-back');
            await wait('document.querySelectorAll("#engine-results button").length===5');
            adb('shell', 'input', 'keyevent', 'KEYCODE_HOME'); await pause(700);
            assert.equal((await evaluate("Capacitor.nativePromise('Pikafish','status',{})")).alive, false);
            adb('shell', 'am', 'start', '-n', `${packageId}/.MainActivity`);
            // Existing rows can reappear before Android finishes the foreground
            // window transition. Wait for input focus before physical touches.
            await pause(700); await wait('document.hasFocus()');
            await wait('document.querySelector("#engine-status").dataset.state==="searching"');
            await wait('document.querySelectorAll("#engine-results button").length===5');
        } else if (profile !== 'deep_cool') await wait('document.querySelector("#engine-status").dataset.state==="complete"');
        const rows = await evaluate('[...document.querySelectorAll("#engine-results button")].map(n=>({key:n.dataset.key,move:n.dataset.suggestion,text:n.textContent,pvLength:n.suggestion.pv.length}))');
        assert.deepEqual(rows.map(row => row.key), ['engine-1', 'engine-2', 'engine-3', 'engine-4', 'engine-5']);
        assert.equal(new Set(rows.map(row => row.move)).size, 5);
        assert.ok(rows.every(row => row.text.includes('D')));
        const board = await evaluate('[...document.querySelectorAll(".chip")].map(n=>n.textContent)');
        await touch('#engine-results button:last-child');
        await wait('document.querySelector("#preview-position").textContent.startsWith("0 /")');
        assert.equal(await evaluate('document.querySelector("#preview-position").textContent.startsWith("0 /")'), true);
        assert.equal(await evaluate('document.querySelector("#engine-results [aria-pressed=true]").dataset.key'), 'engine-5');
        assert.deepEqual(await evaluate('[...document.querySelectorAll(".chip")].map(n=>n.textContent)'), board);
        assert.equal(await evaluate('document.querySelector("#mobile-app").classList.contains("previewing")'), false);
        await touch('#redo');
        assert.equal(await evaluate('document.querySelector("#preview-position").textContent.startsWith("1 /")'), true);
        const selectedLength = await evaluate('Number(document.querySelector("#preview-position").textContent.split("/")[1])');
        let replayed = 1;
        if (selectedLength >= 13) {
            for (; replayed < 13; replayed++) await touch('#redo');
            await wait('document.querySelector("#preview-position").textContent.startsWith("13 /")');
        }
        results.push({ profile, pvLengths: rows.map(row => row.pvLength), selectedLength, replayed });
        await touch('#cancel-preview');
        assert.equal(await read(), seeded);
        if (profile === 'balanced') await writeFile('artifacts/android-five-variations.png', adb('exec-out', 'screencap', '-p'));
    }
    assert.ok(results.some(result => result.replayed === 13), 'Real engine PVs must allow replay past the old 12-ply cap');
    console.log('ANDROID_VARIATIONS_PASS', JSON.stringify(results));
} catch (error) {
    console.error('ANDROID_VARIATIONS_FAILED_PROFILE', activeProfile);
    await writeFile('artifacts/android-variations-failure.png', adb('exec-out', 'screencap', '-p'));
    throw error;
} finally {
    try {
        await evaluate(`Capacitor.nativePromise('LocalSession','set',{value:${JSON.stringify(original)}})`);
        await device.call('Page.reload'); await wait('document.querySelectorAll(".square").length===90');
        assert.equal(await read(), original);
    } finally { device.close(); }
}
