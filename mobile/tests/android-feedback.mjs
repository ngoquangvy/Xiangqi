import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import Game from '../../src/core/XiangqiGame.js';
import { connect, adb, pause } from './android-connection.mjs';

// Temporarily seed real, low-material endgames. Restore the exact native session.
const device = await connect();
const { evaluate, wait } = device;
const original = (await evaluate("Capacitor.nativePromise('LocalSession','get',{})")).value;
if (!original) throw Error('An existing saved session is required.');
const touch = async selector => {
    await evaluate(`document.querySelector(${JSON.stringify(selector)}).scrollIntoView({block:'nearest'})`);
    await device.touch(selector);
};
const seed = async fen => {
    const game = new Game(); if (fen) assert.equal(game.importFen(fen), true);
    const data = { ...JSON.parse(original), game: game.exportGame(), language: 'vi', flipped: false,
        soundEnabled: false, previewHelpSeen: true, analysis: { profile: 'eco', bookEnabled: false } };
    await evaluate(`Capacitor.nativePromise('LocalSession','set',{value:${JSON.stringify(JSON.stringify(data))}})`);
    await device.call('Page.reload');
    await wait('document.querySelectorAll(".square").length===90');
};
const move = async (from, to) => { await touch(`.square[data-square=${from}]`); await touch(`.square[data-square=${to}]`); };
try {
    await seed('4k4/3R1P3/5R3/9/9/9/9/9/9/3K5 w - - 0 1');
    await move('f7', 'e7');
    await wait('document.querySelector("#turn-label").dataset.result==="win"');
    assert.equal(await evaluate('document.querySelector("#winner-label").textContent'), '\u0110\u1ecf th\u1eafng');
    assert.deepEqual(await evaluate('[...document.querySelectorAll(".square.checked")].map(n=>n.dataset.square)'), ['e9']);
    assert.equal(await evaluate('document.querySelectorAll(".square:disabled").length'), 0);
    await touch('#undo'); assert.equal(await evaluate('document.querySelector("#winner-label").hidden'), true);
    await touch('#redo'); assert.equal(await evaluate('document.querySelector("#winner-label").hidden'), false);
    await wait('document.querySelector("#engine-status").dataset.state==="terminal"');
    await touch('#tab-settings');
    assert.equal(await evaluate('document.querySelector("#engine-pause").disabled'), false);
    const request = await evaluate('document.querySelector("#engine-analysis").dataset.request');
    await touch('#engine-pause');
    assert.notEqual(await evaluate('document.querySelector("#engine-analysis").dataset.request'), request);
    await touch('#tab-analysis');
    await writeFile('artifacts/android-red-win.png', adb('exec-out', 'screencap', '-p'));
    await touch('#tab-settings'); await touch('#new-game'); await touch('#confirm-accept'); await touch('#tab-analysis');
    assert.equal(await evaluate('document.querySelectorAll(".square.checked,.square.last,.square.suggestion").length'), 0);
    await wait('document.querySelectorAll("#engine-results button").length>0');
    const boardWidth = await evaluate('document.querySelector("#board").getBoundingClientRect().width');
    await touch('#engine-results button');
    await wait('!document.querySelector("#cancel-preview").hidden');
    assert.equal(await evaluate('document.querySelector("#board").getBoundingClientRect().width'), boardWidth);
    assert.equal(await evaluate('document.querySelectorAll(".square.suggestion").length'), 2);
    const root = (await evaluate("Capacitor.nativePromise('LocalSession','get',{})")).value;
    await writeFile('artifacts/android-pv-highlight.png', adb('exec-out', 'screencap', '-p'));
    await touch('#redo');
    assert.equal(await evaluate('document.querySelectorAll(".square.suggestion").length'), 0);
    assert.equal(await evaluate('document.querySelector("#preview-position").textContent.startsWith("1 /")'), true);
    await touch('#undo'); await touch('#undo');
    assert.equal(await evaluate('document.querySelectorAll(".square.suggestion,.square.last").length'), 0);
    await touch('.square[data-square=e2]');
    assert.equal(await evaluate('document.querySelector(".board-actions").dataset.mode'), 'game');
    assert.equal(await evaluate('document.querySelectorAll(".square.selected,.square.suggestion").length'), 0);
    assert.equal((await evaluate("Capacitor.nativePromise('LocalSession','get',{})")).value, root);
    await move('h2', 'e2');
    assert.deepEqual(await evaluate('[...document.querySelectorAll(".square.last")].map(n=>n.dataset.square).sort()'), ['e2', 'h2']);
    assert.equal(await evaluate('document.querySelector("#turn-label").dataset.side'), 'black');
    await writeFile('artifacts/android-last-move.png', adb('exec-out', 'screencap', '-p'));
    await wait('document.querySelectorAll("#engine-results button").length>0');
    await touch('#engine-results button'); await touch('.square[data-square=e2]'); await touch('#undo');
    assert.equal(await evaluate('document.querySelector("#cancel-preview").hidden'), true);
    assert.equal(await evaluate('document.querySelectorAll(".square.suggestion,.square.last").length'), 0);
    assert.equal(await evaluate('document.querySelectorAll(".history-move").length'), 1); // Retained redo history is not a committed current move.
    assert.equal(await evaluate('document.querySelector("#undo").disabled&&!document.querySelector("#redo").disabled'), true);
    await seed('5k3/9/9/9/9/9/9/3r5/3p1r3/4K4 b - - 0 1');
    await move('d2', 'e2');
    assert.equal(await evaluate('document.querySelector("#turn-label").dataset.side'), 'black');
    assert.equal(await evaluate('document.querySelector("#winner-label").textContent'), '\u0110en th\u1eafng');
    assert.deepEqual(await evaluate('[...document.querySelectorAll(".square.checked")].map(n=>n.dataset.square)'), ['e0']);
    await writeFile('artifacts/android-black-win.png', adb('exec-out', 'screencap', '-p'));
    console.log('ANDROID_FEEDBACK_PASS: native touch, PV step/reset, last move, check pulse, both winners, terminal engine retry, undo/redo/reset');
} finally {
    try {
        await evaluate(`Capacitor.nativePromise('LocalSession','set',{value:${JSON.stringify(original)}})`);
        await device.call('Page.reload'); await wait('document.querySelectorAll(".square").length===90');
        await pause(200);
        assert.equal((await evaluate("Capacitor.nativePromise('LocalSession','get',{})")).value, original);
    } finally { device.close(); }
}
