import { connect, adb } from '../tests/android-connection.mjs';
import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';

// Read-only diagnostics: never reset or alter the user's current game.
const connection = await connect();
try {
    await connection.wait('document.querySelectorAll(".square").length===90');
    await connection.evaluate('document.fonts.ready.then(()=>true)');
    const status = await connection.evaluate(`(() => {
        const chip = document.querySelector('.red .chip');
        const css = getComputedStyle(chip), rect = chip.getBoundingClientRect();
        return {
            soundEnabled: document.querySelector('#sound-toggle').getAttribute('aria-pressed'),
            soundLabel: document.querySelector('#sound-toggle').getAttribute('aria-label'),
            testProbePresent: Boolean(window.__media),
            position: document.querySelector('#position-label').textContent,
            viewport: [innerWidth, innerHeight],
            chip: { size: [rect.width, rect.height], font: css.font, fontSize: css.fontSize },
            letteringFits: Array.from(document.querySelectorAll('.square.red .chip,.square.black .chip')).every(node=>{
                const b=node.getBoundingClientRect();
                return parseFloat(getComputedStyle(node).fontSize)<=Math.min(b.width,b.height)*.64;
            }),
            fontLoaded: document.fonts.check('24px "Xiangqi Symbols"'),
        };
    })()`);
    console.log(JSON.stringify(status, null, 2));
    assert.equal(status.fontLoaded, true);
    assert.equal(status.letteringFits, true);
    if (process.argv.includes('--screenshot')) {
        await writeFile(new URL('../artifacts/android-kai-board.png', import.meta.url), adb('exec-out', 'screencap', '-p'));
    }
    if (process.argv.includes('--play-sample') || process.argv.includes('--play-move-sample')) {
        const source = process.argv.includes('--play-move-sample') ? 'sounds/sidestick.wav' : 'sounds/check.mp3';
        // An explicit diagnostic clip only; never simulate/commit a game move.
        const result = await connection.call('Runtime.evaluate', { userGesture: true, awaitPromise: true, returnByValue: true,
            expression: `(async()=>{
                const clip = new Audio(${JSON.stringify(source)});
                await clip.play();
                await new Promise((resolve,reject)=>{clip.onended=resolve;clip.onerror=reject;});
                return {ended:true, muted:clip.muted, volume:clip.volume, duration:clip.duration, source:clip.src};
            })()` });
        console.log(JSON.stringify(result));
    }
} finally { connection.close(); }
