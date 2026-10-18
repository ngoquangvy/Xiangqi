import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import Game from '../../src/core/XiangqiGame.js';
import { connect, adb } from './android-connection.mjs';
import { readBookSource, sourceRowsFor } from './book-source.mjs';
import { bookRows } from '../src/analysis/results.js';

// Exercise a real packaged opening/PV, preserving the original native session.
const device = await connect();
const { evaluate, wait, touch } = device;
const original = (await evaluate("Capacitor.nativePromise('LocalSession','get',{})")).value;
if (!original) { device.close(); throw Error('A saved session is required.'); }
try {
    const game = new Game(); assert.equal(game.move(7, 7, 4, 7), true);
    const book = readBookSource(), fen = game.exportFen();
    const expected = bookRows(fen, sourceRowsFor(book, fen))[0];
    const seeded = JSON.stringify({ ...JSON.parse(original), game: game.exportGame(), language: 'vi',
        flipped: false, soundEnabled: false, previewHelpSeen: true, analysis: { profile: 'eco', bookEnabled: true } });
    await evaluate(`Capacitor.nativePromise('LocalSession','set',{value:${JSON.stringify(seeded)}})`);
    await device.call('Page.reload');
    await device.enterAnalysis();
    await wait('document.querySelectorAll("#book-results button").length===5');
    const selector = '#book-results button:first-child';
    assert.equal(await evaluate(`document.querySelector('${selector} strong').textContent`), expected.note);
    assert.equal(await evaluate(`document.querySelector('${selector} small').textContent.length>20`), true);
    const width = await evaluate('document.querySelector("#board").getBoundingClientRect().width');
    await touch(selector);
    assert.equal(await evaluate('document.querySelector("#preview-position").textContent'), `0 / ${expected.pv.length}`);
    assert.equal(await evaluate('document.querySelector("#board").getBoundingClientRect().width'), width);
    await touch('#redo'); await touch('#undo');
    await evaluate('for(let i=0;i<12;i++)document.querySelector("#redo").click()');
    assert.equal(await evaluate('document.querySelector("#preview-position").textContent'), `12 / ${expected.pv.length}`);
    assert.equal(await evaluate('document.querySelectorAll(".square.suggestion").length'), 0);
    await evaluate(`for(let i=0;i<${expected.pv.length};i++)document.querySelector("#redo").click()`);
    assert.equal(await evaluate('document.querySelector("#preview-position").textContent'), `${expected.pv.length} / ${expected.pv.length}`);
    assert.equal(await evaluate('document.querySelector("#redo").disabled'), true);
    assert.equal((await evaluate("Capacitor.nativePromise('LocalSession','get',{})")).value, seeded);
    await touch('.square[data-square=e2]');
    assert.equal(await evaluate('document.querySelector(".board-actions").dataset.mode'), 'game');
    assert.equal(await evaluate('document.querySelectorAll(".history-move").length'), 1);
    assert.equal(await evaluate('document.querySelectorAll(".square.selected,.square.suggestion").length'), 0);
    assert.equal(await evaluate('document.querySelector("#turn-label").dataset.side'), 'black');
    assert.equal(await evaluate('document.querySelector("#engine-status").dataset.state!=="preview"'), true);
    assert.equal((await evaluate("Capacitor.nativePromise('LocalSession','get',{})")).value, seeded);
    await writeFile('artifacts/android-opening-book.png', adb('exec-out', 'screencap', '-p'));
    // The longest recovered representative must also survive native transport.
    const nativeRoot = await evaluate(`Capacitor.nativePromise('Pikafish','lookupBook',{fen:${JSON.stringify(new Game().exportFen())}})`);
    assert.equal(nativeRoot.rows.find(row => row.move === 'b2e2').pv.length, 322);
    console.log(`ANDROID_BOOK_PASS: validated v3, ${expected.pv.length}-ply replay, board-touch exit, full native data, no commit/save`);
} finally {
    try {
        await evaluate(`Capacitor.nativePromise('LocalSession','set',{value:${JSON.stringify(original)}})`);
        await device.call('Page.reload'); await wait('document.querySelectorAll(".square").length===90');
        assert.equal((await evaluate("Capacitor.nativePromise('LocalSession','get',{})")).value, original);
    } finally { device.close(); }
}
