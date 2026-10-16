import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import Game from '../../src/core/XiangqiGame.js';
import { connect, adb } from './android-connection.mjs';

// All presets must actually produce five independent rows, not just request 5.
const device = await connect();
const { evaluate, wait, touch } = device;
await wait('typeof Capacitor!=="undefined" && document.querySelectorAll(".square").length===90');
const read = async () => (await evaluate("Capacitor.nativePromise('LocalSession','get',{})")).value;
const original = await read();
if (!original) { device.close(); throw Error('A saved session is required.'); }
const profiles = ['eco', 'balanced', 'deep'];
try {
    for (const profile of profiles) {
        const seeded = JSON.stringify({ ...JSON.parse(original), game: new Game().exportGame(), language: 'vi',
            flipped: false, soundEnabled: false, previewHelpSeen: true, analysis: { profile, bookEnabled: false } });
        await evaluate(`Capacitor.nativePromise('LocalSession','set',{value:${JSON.stringify(seeded)}})`);
        await device.call('Page.reload');
        // Deep preset can spend ten seconds searching, plus startup overhead.
        await wait('document.querySelectorAll("#engine-results button").length===5');
        await wait('document.querySelector("#engine-status").dataset.state==="complete"');
        const rows = await evaluate('[...document.querySelectorAll("#engine-results button")].map(n=>({key:n.dataset.key,move:n.dataset.suggestion,text:n.textContent}))');
        assert.deepEqual(rows.map(row => row.key), ['engine-1', 'engine-2', 'engine-3', 'engine-4', 'engine-5']);
        assert.equal(new Set(rows.map(row => row.move)).size, 5);
        assert.ok(rows.every(row => row.text.includes('D')));
        const board = await evaluate('[...document.querySelectorAll(".chip")].map(n=>n.textContent)');
        await touch('#engine-results button:last-child');
        assert.equal(await evaluate('document.querySelector("#preview-position").textContent.startsWith("0 /")'), true);
        assert.equal(await evaluate('document.querySelector("#engine-results [aria-pressed=true]").dataset.key'), 'engine-5');
        assert.deepEqual(await evaluate('[...document.querySelectorAll(".chip")].map(n=>n.textContent)'), board);
        await touch('#redo');
        assert.equal(await evaluate('document.querySelector("#preview-position").textContent.startsWith("1 /")'), true);
        await touch('#cancel-preview');
        assert.equal(await read(), seeded);
        if (profile === 'balanced') await writeFile('artifacts/android-five-variations.png', adb('exec-out', 'screencap', '-p'));
    }
    console.log('ANDROID_VARIATIONS_PASS: 5 distinct final engine rows on eco/balanced/deep; row 5 selection/replay; live game/save preserved');
} finally {
    try {
        await evaluate(`Capacitor.nativePromise('LocalSession','set',{value:${JSON.stringify(original)}})`);
        await device.call('Page.reload'); await wait('document.querySelectorAll(".square").length===90');
        assert.equal(await read(), original);
    } finally { device.close(); }
}
