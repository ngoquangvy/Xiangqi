import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { adb, connect, pause } from './android-connection.mjs';

// Exercise display-only controls on the existing saved game. No pm clear,
// temporary replacement game, move commit, import, undo or history navigation.
const connection = await connect();
try {
    const { evaluate, wait, touch } = connection;
    await wait('document.querySelectorAll(".square").length===90');
    await connection.enterAnalysis();
    const saved = async () => JSON.parse((await evaluate("Capacitor.nativePromise('LocalSession','get',{})")).value);
    const original = await saved();
    assert.ok(original, 'An existing saved game is required for this preserving test.');
    assert.equal(await evaluate('document.querySelector("#flip .control-symbol").textContent'), '\u21c5');
    assert.equal(await evaluate('Boolean(document.querySelector("#board-hint,#sheet-mode,#legal-help,.eyebrow"))'), false);
    const area = () => evaluate('document.querySelector(".inspector").getBoundingClientRect().height');
    const before = await area();
    await touch('#expand');
    await wait('document.querySelector("#expand").getAttribute("aria-expanded")==="true"');
    assert.ok(await area() > before + 60);
    assert.equal(await evaluate('document.querySelectorAll(".square:not(:disabled)").length'), 0);
    adb('shell', 'input', 'keyevent', '4');
    await wait('document.querySelector("#expand").getAttribute("aria-expanded")==="false"');
    const coordinate = () => evaluate('document.querySelector(".square[data-square=a9]").style.left');
    const initial = await coordinate();
    await touch('#flip');
    assert.notEqual(await coordinate(), initial);
    await touch('#flip');
    assert.equal(await coordinate(), initial);
    const savedText = original.language === 'en' ? 'Autosaved on this device' : 'T\u1ef1 l\u01b0u tr\u00ean thi\u1ebft b\u1ecb';
    await wait(`document.querySelector('#save-status').textContent===${JSON.stringify(savedText)}`);
    await touch('#tab-history');
    assert.equal(await evaluate('document.querySelector("#note-editor").open'), false);
    await evaluate('document.querySelector("#note-editor summary").scrollIntoView({block:"end"})');
    await pause(150); await touch('#note-editor summary');
    assert.equal(await evaluate('document.querySelector("#note-editor").open'), true);
    adb('shell', 'input', 'keyevent', '4');
    await wait('document.querySelector("#note-editor").open===false');
    assert.equal(await evaluate(`Array.from(document.querySelectorAll('.history-move')).every(node=>{
        const h=node.getBoundingClientRect().height;
        return h>=43.9&&h<=45&&node.getAttribute('aria-label');
    })`), true);
    await touch('#expand');
    await evaluate('document.querySelector("#panel-history").scrollTop=0');
    await pause(150);
    await writeFile(new URL('../artifacts/android-compact-history.png', import.meta.url), adb('exec-out', 'screencap', '-p'));
    adb('shell', 'input', 'keyevent', '4');
    await wait('document.querySelector("#expand").getAttribute("aria-expanded")==="false"');
    await touch('#tab-analysis');
    const side = await evaluate('document.querySelector("#turn-label").dataset.side');
    const pieces = await evaluate(`Array.from(document.querySelectorAll('.square.${side}')).map(node=>node.dataset.square)`);
    let selected;
    for (const square of pieces) {
        await touch(`.square[data-square="${square}"]`);
        selected = square;
        if (await evaluate('document.querySelectorAll("#legal-moves button").length>0')) break;
    }
    const legal = await evaluate(`(()=>{const rows=[...document.querySelectorAll('#legal-moves button')];return {
        count:rows.length,heading:!document.querySelector('#legal-heading').hidden,
        frameVisible:document.querySelector('.topbar').getBoundingClientRect().top>=0&&document.querySelector('.footer').getBoundingClientRect().bottom<=innerHeight+1,
        outerScroll:document.querySelector('#mobile-app').scrollTop,
        compact:rows.every(node=>{const b=node.getBoundingClientRect();return b.height>=43.9&&b.height<=45&&node.scrollWidth<=node.clientWidth+1;})
    };})()`);
    assert.ok(legal.compact);
    assert.ok(legal.frameVisible);
    assert.equal(legal.outerScroll, 0);
    if (legal.count) assert.ok(legal.heading);
    await pause(150);
    await writeFile(new URL('../artifacts/android-compact-legal.png', import.meta.url), adb('exec-out', 'screencap', '-p'));
    if (selected) await touch(`.square[data-square="${selected}"]`);
    const restored = await saved();
    assert.deepEqual(JSON.parse(restored.game), JSON.parse(original.game));
    assert.equal(restored.flipped, original.flipped);
    assert.equal(restored.language, original.language);
    assert.equal(restored.soundEnabled, original.soundEnabled);
    console.log('ANDROID_COMPACT_PASS', JSON.stringify({ nativeBack: true, flip: true, noteDisclosure: true, legal, savedGameUnchanged: true }));
} finally { connection.close(); }
