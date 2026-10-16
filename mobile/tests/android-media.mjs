import { writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import assert from 'node:assert/strict';
import XiangqiGame from '../../src/core/XiangqiGame.js';
import probe from '../../tests/helpers/mediaProbe.cjs';
import { adb, packageId, connect } from './android-connection.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let connection, original, injection;
try {
    console.log(adb('install', '-r', path.join(root, 'artifacts/xiangqi-mobile-debug.apk')).toString().trim());
    adb('shell', 'am', 'start', '-W', '-n', `${packageId}/.MainActivity`);
    connection = await connect();
    const { evaluate, call, wait, touch } = connection;
    await wait('Boolean(document.querySelector("#sound-toggle"))');
    // Save the exact native session before temporarily replacing it for tests.
    // Unlike android-smoke, this script never runs pm clear.
    original = (await evaluate("Capacitor.nativePromise('LocalSession','get',{})")).value;
    if (typeof original !== 'string') throw Error('Create a saved game before this preserving test.');
    await writeFile(path.join(root, 'artifacts/android-session-backup.json'), original);
    const baseline = JSON.stringify({ version: 1, game: new XiangqiGame().exportGame(), flipped: false, language: 'en', soundEnabled: true });
    await evaluate(`Capacitor.nativePromise('LocalSession','set',{value:${JSON.stringify(baseline)}})`);
    await call('Page.enable');
    injection = (await call('Page.addScriptToEvaluateOnNewDocument', { source: probe.mediaProbeSource(false) })).identifier;
    await call('Page.reload');
    await wait('document.querySelector("#position-label")?.textContent === "Starting position"');
    await evaluate('document.fonts.ready.then(()=>true)');
    assert.equal(await evaluate('document.fonts.check(\'24px "Xiangqi Symbols"\')'), true);
    const move = async (from, to) => {
        await touch(`.square[data-square="${from}"]`); await touch(`.square[data-square="${to}"]`);
        await wait('document.querySelector("#save-status").textContent === "Autosaved on this device"');
    };
    const reset = async () => {
        await touch('#tab-settings'); await touch('#new-game'); await touch('#confirm-accept'); await touch('#tab-analysis');
    };
    await move('h2', 'e2');
    await wait('window.__media.some(clip=>clip.src.endsWith("sidestick.wav") && clip.playing===1)');
    await touch('#undo'); await touch('#redo');
    assert.equal(await evaluate('window.__media[0].calls'), 1);
    await reset();
    await move('h2', 'h9');
    await wait('window.__media.some(clip=>clip.src.endsWith("capture.mp3") && clip.playing>0)');
    await reset();
    for (const [from, to] of [['h2','e2'], ['a6','a5'], ['e3','e4'], ['c6','c5'], ['e4','e5'], ['g6','g5'], ['e5','e6']]) await move(from, to);
    await wait('window.__media.some(clip=>clip.src.endsWith("check.mp3") && clip.playing>0)');
    const beforeMute = await evaluate('window.__media.reduce((n,clip)=>n+clip.calls,0)');
    await touch('#sound-toggle');
    await reset(); await move('h2', 'e2');
    assert.equal(await evaluate('window.__media.reduce((n,clip)=>n+clip.calls,0)'), beforeMute);
    assert.equal(await evaluate('window.__media.every(clip=>!clip.errors)'), true);
    await call('Page.reload');
    await wait('document.querySelector("#sound-toggle")?.getAttribute("aria-pressed")==="false"');
    await writeFile(path.join(root, 'artifacts/android-wood-board.png'), adb('exec-out', 'screencap', '-p'));
    assert.equal(await evaluate('window.__media.every(clip=>!clip.errors)'), true);
    console.log('ANDROID_MEDIA_PASS: real touch, unmuted WAV/MP3 clips, font, silent navigation, mute/reload');
} finally {
    if (connection) {
        try {
            if (typeof original === 'string') {
                await connection.evaluate(`Capacitor.nativePromise('LocalSession','set',{value:${JSON.stringify(original)}})`);
                if (injection) await connection.call('Page.removeScriptToEvaluateOnNewDocument', { identifier: injection });
                await connection.call('Page.reload');
                await connection.wait('document.querySelectorAll(".square").length===90');
                assert.equal((await connection.evaluate("Capacitor.nativePromise('LocalSession','get',{})")).value, original);
                console.log('Original session restored; emulator stays open.');
            }
        } finally { connection.close(); }
    }
}
