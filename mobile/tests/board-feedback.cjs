const { buildSync } = require('esbuild');
const assert = require('node:assert/strict');
const path = require('node:path');
const { checkPreviewHelp } = require('./preview-help.cjs');

async function checkBoardFeedback({ evaluate, click, resize, capture, emulateMotion }) {
    const bundle = buildSync({ stdin: { contents: `export { MobileApp } from './src/ui/MobileApp.js';
        export { AppStore } from './src/state/AppStore.js'; export { LocalGame } from './src/domain/LocalGame.js';
        export { GameStorage } from './src/storage/GameStorage.js'; export { default as Game } from '../src/core/XiangqiGame.js';`,
        resolveDir: path.resolve(__dirname, '..') }, bundle: true, format: 'iife', globalName: 'FeedbackFixture', platform: 'browser', write: false }).outputFiles[0].text;
    await evaluate(bundle + `
        window.feedback = {mount(fen) {
            this.ui?.destroy();
            const old=document.querySelector('#mobile-app'), shell=old.cloneNode(true);
            shell.querySelector('.squares').replaceChildren();shell.querySelector('.board-grid').replaceChildren();old.replaceWith(shell);
            const local=new FeedbackFixture.LocalGame();
            if(fen){const game=new FeedbackFixture.Game();if(!game.importFen(fen)||!local.restore(game.exportGame()))throw Error('fixture FEN');}
            this.writes=0;
            this.store=new FeedbackFixture.AppStore(new FeedbackFixture.GameStorage({getItem:()=>null,setItem:()=>this.writes++}),local);
            this.ui=new FeedbackFixture.MobileApp(shell,this.store);
        }};
        feedback.mount();true;
    `);
    const help = await checkPreviewHelp({ evaluate, click, resize, capture });
    assert.equal(await evaluate('document.querySelector("#turn-label").textContent'), '');
    assert.equal(await evaluate('document.querySelector("#turn-label").dataset.side'), 'red');
    await click('.square[data-square=h2]'); await click('.square[data-square=e2]');
    assert.deepEqual(await evaluate('[...document.querySelectorAll(".square.last")].map(n=>n.dataset.square).sort()'), ['e2', 'h2']);
    assert.equal(await evaluate('document.querySelector("#turn-label").dataset.side'), 'black');
    const colors = await evaluate('({dot:getComputedStyle(document.querySelector("#turn-dot")).backgroundColor,last:getComputedStyle(document.querySelector(".square.last")).backgroundColor})');
    await click('#flip');
    assert.deepEqual(await evaluate('[...document.querySelectorAll(".square.last")].map(n=>n.dataset.square).sort()'), ['e2', 'h2']);
    await click('#flip'); await click('#undo');
    assert.equal(await evaluate('document.querySelectorAll(".square.last").length'), 0);
    await click('#redo'); assert.equal(await evaluate('document.querySelectorAll(".square.last").length'), 2);
    await evaluate('feedback.store.reset();feedback.store.completePreviewHelp();feedback.before=JSON.stringify(feedback.store.snapshot().game);feedback.saved=feedback.writes;feedback.store.preview("h2e2",["h2e2","h9g7","h0g2"]);true');
    assert.equal(await evaluate('document.querySelectorAll(".square.suggestion").length'), 2);
    assert.equal(await evaluate('document.querySelector("#preview-position").textContent'), '0 / 3');
    const suggestion = await evaluate('getComputedStyle(document.querySelector(".square.suggestion")).backgroundColor');
    assert.notEqual(suggestion, colors.last);
    await capture('mobile-preview-highlight.png');
    await click('#redo');
    assert.equal(await evaluate('document.querySelector("#preview-position").textContent'), '1 / 3');
    await click('#redo');
    assert.equal(await evaluate('document.querySelector("#preview-position").textContent'), '2 / 3');
    assert.equal(await evaluate('document.querySelectorAll(".square.suggestion").length'), 0);
    assert.equal(await evaluate('document.querySelector(".board-actions").dataset.mode'), 'preview');
    await click('#undo'); await click('#undo');
    assert.equal(await evaluate('document.querySelector("#preview-position").textContent'), '0 / 3');
    assert.equal(await evaluate('document.querySelectorAll(".square.suggestion,.square.last").length'), 0);
    await click('#redo'); assert.equal(await evaluate('document.querySelectorAll(".square.suggestion").length'), 0);
    await click('.square[data-square=e2]');
    assert.equal(await evaluate('document.querySelector(".board-actions").dataset.mode'), 'game');
    assert.equal(await evaluate('feedback.store.snapshot().ui.selected'), null);
    assert.equal(await evaluate('document.querySelectorAll(".square.suggestion").length'), 0);
    assert.equal(await evaluate('JSON.stringify(feedback.store.snapshot().game)===feedback.before&&feedback.writes===feedback.saved'), true);
    // Expanded preview also exits on a board touch; the full board is restored.
    await evaluate('feedback.store.toggleExpanded();feedback.store.preview("h2e2");true');
    await click('.square[data-square=h2]');
    assert.equal(await evaluate('feedback.store.snapshot().ui.expanded||Boolean(feedback.store.snapshot().ui.preview)'), false);
    assert.equal(await evaluate('JSON.stringify(feedback.store.snapshot().game)===feedback.before&&feedback.writes===feedback.saved'), true);
    // A real non-mating check pulses only the king. Effects do not disable play.
    await evaluate('feedback.mount("4k4/9/R8/9/9/9/9/9/9/3K5 w - - 0 1");feedback.store.preview("a7e7");feedback.store.stepPreview(1);feedback.store.applyPreview();true');
    assert.deepEqual(await evaluate('[...document.querySelectorAll(".square.checked")].map(n=>n.dataset.square)'), ['e9']);
    assert.equal(await evaluate('feedback.store.snapshot().winner'), null);
    await emulateMotion(false);
    assert.equal(await evaluate('getComputedStyle(document.querySelector(".square.checked .chip"),"::after").animationName'), 'king-check');
    assert.equal(await evaluate('document.querySelectorAll(".square:disabled").length'), 0);
    await emulateMotion(true);
    assert.equal(await evaluate('getComputedStyle(document.querySelector(".square.checked .chip"),"::after").animationName'), 'none');
    await emulateMotion(false);
    await capture('mobile-king-check.png');
    // Mate remains reversible; switching language/flipping does not change it.
    await evaluate('feedback.mount("4k4/3R1P3/5R3/9/9/9/9/9/9/3K5 w - - 0 1");feedback.store.preview("f7e7");feedback.store.stepPreview(1);feedback.store.applyPreview();true');
    assert.equal(await evaluate('document.querySelector("#winner-label").textContent'), '\u0110\u1ecf th\u1eafng');
    assert.equal(await evaluate('document.querySelector("#undo").disabled'), false);
    assert.equal(await evaluate('document.querySelectorAll(".square:disabled").length'), 0);
    await click('#undo'); assert.equal(await evaluate('document.querySelector("#winner-label").hidden'), true);
    await click('#redo'); await click('#language'); await click('#flip');
    assert.equal(await evaluate('document.querySelector("#winner-label").textContent'), 'Red wins');
    await capture('mobile-red-win.png');
    await click('#tab-settings'); await click('#new-game'); await click('#confirm-accept');
    assert.equal(await evaluate('document.querySelector("#winner-label").hidden'), true);
    assert.equal(await evaluate('document.querySelectorAll(".square.checked,.square.suggestion,.square.last").length'), 0);
    await evaluate('feedback.mount("5k3/9/9/9/9/9/9/3r5/3p1r3/4K4 b - - 0 1");feedback.store.preview("d2e2");feedback.store.stepPreview(1);feedback.store.applyPreview();true');
    assert.equal(await evaluate('document.querySelector("#turn-label").dataset.side'), 'black');
    assert.equal(await evaluate('document.querySelector("#winner-label").textContent'), '\u0110en th\u1eafng');
    await evaluate('feedback.ui.destroy();true');
    return { help, lastMove: true, blueTurnDot: true, pvNavigation: true, firstHighlightOnly: true, checkPulse: true, reducedMotion: true, reversibleWinners: ['red', 'black'] };
}
module.exports = { checkBoardFeedback };
