const assert = require('node:assert/strict');

// Uses the isolated real AppStore/MobileApp mounted by board-feedback.cjs.
async function checkPreviewHelp({ evaluate, click, resize, capture }) {
    await evaluate('feedback.original=JSON.stringify(feedback.store.snapshot().game);feedback.store.preview("h2e2",["h2e2","h9g7"]);true');
    assert.equal(await evaluate('document.querySelector("#preview-guide").hidden'), false);
    assert.equal(await evaluate('document.querySelector("#preview-position").textContent'), '0 / 2');
    assert.equal(await evaluate('document.querySelector("#redo").classList.contains("guide-target")'), true);
    assert.equal(await evaluate('JSON.stringify(feedback.store.snapshot().board)===JSON.stringify(feedback.store.snapshot().game.board)'), true);
    const width = await evaluate('document.querySelector("#board").getBoundingClientRect().width');
    await click('#preview-help'); // Closing is not completion.
    assert.equal(await evaluate('feedback.store.snapshot().ui.previewHelpSeen'), false);
    await click('#preview-help');
    assert.equal(await evaluate('document.querySelector("#board").getBoundingClientRect().width'), width);
    let layouts = 0;
    for (const language of ['vi', 'en']) {
        await evaluate(`feedback.store.setLanguage('${language}');true`);
        for (const [w, h] of [[320, 568], [360, 800], [390, 844], [844, 390]]) {
            await resize(w, h);
            const result = await evaluate(`(()=>{
                const card=document.querySelector('#preview-guide'), box=card.getBoundingClientRect();
                const board=document.querySelector('#board').getBoundingClientRect(), next=document.querySelector('#redo').getBoundingClientRect();
                const done=document.querySelector('#preview-guide-done');done.scrollIntoView({block:'nearest'});
                const target=done.getBoundingClientRect();
                return {width:innerWidth,height:innerHeight,card:box.toJSON(),next:next.toJSON(),target:target.toJSON(),
                    boardSafe:box.top>=board.bottom || box.left>=board.right,controlSafe:box.top>=next.bottom || box.left>=next.right,
                    actionable:document.elementFromPoint(target.x+target.width/2,target.y+target.height/2)===done};
            })()`);
            assert.ok(result.card.left >= 0 && result.card.right <= w + 1 && result.card.bottom <= h + 1, JSON.stringify(result));
            assert.ok(result.boardSafe && result.controlSafe && result.actionable, JSON.stringify(result));
            layouts++;
        }
    }
    await resize(390, 844);
    await evaluate('feedback.store.setLanguage("vi");document.querySelector("#preview-guide").scrollTop=0;true');
    await capture('mobile-preview-help.png');
    await click('#redo');
    assert.equal(await evaluate('document.querySelector("#preview-guide").hidden'), true);
    assert.equal(await evaluate('feedback.store.snapshot().ui.previewHelpSeen'), true);
    assert.equal(await evaluate('JSON.stringify(feedback.store.snapshot().game)===feedback.original'), true);
    await click('#preview-help');
    assert.equal(await evaluate('document.querySelector("#preview-guide-intro").textContent.includes("chưa")'), false);
    await evaluate('document.querySelector("#preview-help").dispatchEvent(new KeyboardEvent("keydown",{key:"Escape",bubbles:true}));true');
    assert.equal(await evaluate('document.querySelector("#preview-guide").hidden'), true);
    await click('#cancel-preview');
    await evaluate('feedback.store.preview("b2e2");true');
    assert.equal(await evaluate('document.querySelector("#preview-guide").hidden'), true);
    await click('#preview-help'); await click('#preview-guide-done');
    assert.equal(await evaluate('document.activeElement.id'), 'preview-help');
    await click('#cancel-preview');
    await click('#tab-history');
    await evaluate('document.querySelector("#note-editor").open=true;true');
    await click('#preview-help');
    await evaluate('feedback.ui.back();true');
    assert.equal(await evaluate('document.querySelector("#preview-guide").hidden'), true);
    assert.equal(await evaluate('document.querySelector("#note-editor").open'), true);
    await evaluate('document.querySelector("#note-editor").open=false;true');
    await click('#tab-analysis');
    return { firstSelection: true, reopen: true, nextDismisses: true, keyboard: true, nonBlockingLayouts: layouts };
}
module.exports = { checkPreviewHelp };
