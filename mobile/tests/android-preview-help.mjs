import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import Game from '../../src/core/XiangqiGame.js';
import { connect, adb } from './android-connection.mjs';

// Physical emulator touches against the packaged WebView and native session.
const device = await connect();
const { evaluate, wait, touch } = device;
await wait('typeof Capacitor!=="undefined" && document.querySelectorAll(".square").length===90');
const read = async () => (await evaluate("Capacitor.nativePromise('LocalSession','get',{})")).value;
const original = await read();
if (!original) { device.close(); throw Error('A saved session is required for this preserving test.'); }
try {
    const seeded = JSON.stringify({ ...JSON.parse(original), game: new Game().exportGame(), flipped: false,
        language: 'vi', soundEnabled: false, previewHelpSeen: false, analysis: { profile: 'eco', bookEnabled: true } });
    await evaluate(`Capacitor.nativePromise('LocalSession','set',{value:${JSON.stringify(seeded)}})`);
    await device.call('Page.reload');
    await wait('document.querySelectorAll("#book-results button").length===17');
    const board = () => evaluate('[...document.querySelectorAll(".square")].map(n=>[n.dataset.square,n.querySelector(".chip").textContent])');
    const before = await board();
    const width = await evaluate('document.querySelector("#board").getBoundingClientRect().width');
    const selector = '#book-results button:first-child';
    await touch(selector);
    assert.equal(await evaluate('document.querySelector("#preview-position").textContent.startsWith("0 /")'), true);
    assert.deepEqual(await board(), before);
    assert.equal(await evaluate('document.querySelector("#board").getBoundingClientRect().width'), width);
    assert.equal(await evaluate('document.querySelector("#undo").disabled'), true);
    assert.equal(await evaluate('document.querySelector("#preview-guide").hidden'), false);
    assert.equal(await evaluate('document.querySelectorAll(".analysis-row[aria-pressed=true]").length'), 1);
    assert.equal(await read(), seeded);
    await touch('.square[data-square=h2]');
    assert.equal(await evaluate('document.querySelector(".square[data-square=h2]").classList.contains("selected")'), true);
    assert.equal(await evaluate('document.querySelector("#mobile-app").classList.contains("previewing")'), false);
    assert.equal(await read(), seeded);
    await touch('.square[data-square=h2]'); await touch(selector);
    await writeFile('artifacts/android-preview-help.png', adb('exec-out', 'screencap', '-p'));
    adb('shell', 'input', 'keyevent', '4');
    await wait('document.querySelector("#preview-guide").hidden');
    assert.equal(await evaluate('document.querySelector("#cancel-preview").hidden'), false);
    adb('shell', 'input', 'keyevent', '4');
    await wait('document.querySelector("#cancel-preview").hidden');
    assert.equal(await read(), seeded);
    await touch(selector);
    assert.equal(await evaluate('document.querySelector("#preview-guide").hidden'), false);
    await touch('#preview-help'); await touch('#preview-help');
    assert.equal(await evaluate('document.querySelector("#preview-guide").hidden'), false);
    await touch('#redo');
    await wait('document.querySelector("#save-status").textContent!=="\u0110ang l\u01b0u tr\u00ean thi\u1ebft b\u1ecb\u2026"');
    assert.equal(await evaluate('document.querySelector("#preview-guide").hidden'), true);
    assert.equal(await evaluate('document.querySelector("#preview-position").textContent.startsWith("1 /")'), true);
    assert.notDeepEqual(await board(), before);
    const completed = JSON.parse(await read());
    assert.equal(completed.previewHelpSeen, true);
    assert.deepEqual(JSON.parse(completed.game), JSON.parse(JSON.parse(seeded).game));
    await touch('#preview-help');
    assert.equal(await evaluate('document.querySelector("#preview-guide-intro").textContent.includes("ch\u01b0a")'), false);
    await touch('#language');
    assert.equal(await evaluate('document.querySelector("#preview-guide-title").textContent'), 'How to explore a suggestion');
    await touch('.square[data-square=e2]');
    assert.equal(await evaluate('document.querySelector("#preview-guide").hidden'), true);
    assert.equal(await evaluate('document.querySelectorAll(".analysis-row[aria-pressed=true]").length'), 0);
    assert.deepEqual(await board(), before);
    await touch('#preview-help'); await touch('#preview-guide-done');
    await device.call('Page.reload');
    await wait('document.querySelectorAll("#book-results button").length===17');
    await touch(selector);
    assert.equal(await evaluate('document.querySelector("#preview-guide").hidden'), true);
    assert.deepEqual(await board(), before);
    await touch('#cancel-preview');
    assert.equal(await evaluate('document.body.textContent.includes("\ufffd")'), false);
    console.log('ANDROID_PREVIEW_HELP_PASS: select-only, selected row, unchanged board, first-next, tutorial persistence/reopen/localization, touch cancellation');
} finally {
    try {
        await evaluate(`Capacitor.nativePromise('LocalSession','set',{value:${JSON.stringify(original)}})`);
        await device.call('Page.reload'); await wait('document.querySelectorAll(".square").length===90');
        assert.equal(await read(), original);
    } finally { device.close(); }
}
