const assert = require('node:assert/strict');

// Additional UI contracts live separately from the baseline game smoke test.
async function checkCompactUI({ evaluate, click, resize, capture }) {
    assert.equal(await evaluate('document.querySelectorAll("#expand").length'), 1);
    assert.equal(await evaluate('Boolean(document.querySelector("#board-hint,#sheet-mode,#legal-help,.eyebrow"))'), false);
    assert.equal(await evaluate('document.querySelector("#flip .control-symbol").textContent'), '\u21c5');
    assert.equal(await evaluate('Boolean(document.querySelector(".header-actions #flip"))'), true);
    assert.equal(await evaluate('Boolean(document.querySelector("#apply-preview,#preview-bar,#analysis-navigation"))'), false);
    const expanded = () => evaluate('document.querySelector("#expand").getAttribute("aria-expanded")==="true"');
    const normal = async () => {
        if (!await evaluate('document.querySelector("#cancel-preview").hidden')) await click('#cancel-preview');
        if (await expanded()) await click('#expand');
    };
    const select = async () => {
        if (await evaluate('document.querySelector(".square[data-square=h2]").getAttribute("aria-pressed")') !== 'true') {
            await click('.square[data-square=h2]');
        }
    };
    let layouts = 0, visibleAt390 = 0;
    for (const language of ['vi', 'en']) {
        await normal();
        if (await evaluate('document.documentElement.lang') !== language) await click('#language');
        for (const [width, height] of [[320, 568], [320, 640], [360, 800], [390, 844], [844, 390]]) {
            await resize(width, height);
            await normal(); await select();
            const base = await evaluate('(()=>{const b=document.querySelector(".inspector").getBoundingClientRect();return {width:b.width,height:b.height,board:document.querySelector("#board").getBoundingClientRect().width};})()');
            for (const mode of ['board', 'expanded', 'preview']) {
                await normal(); await select();
                if (mode === 'expanded') await click('#expand');
                if (mode === 'preview') await click('[data-uci=h2e2]');
                const state = await evaluate(`(() => {
                    const app=document.querySelector('#mobile-app'), board=document.querySelector('#board').getBoundingClientRect();
                    const area=document.querySelector('.board-area').getBoundingClientRect(), panel=document.querySelector('.inspector').getBoundingClientRect();
                    const legal=document.querySelector('#legal-moves'), viewport=document.querySelector('#panel-analysis').getBoundingClientRect();
                    const rows=[...legal.querySelectorAll('button')];
                    const targets=[...document.querySelectorAll('.header-actions button,.board-actions button,.inspector-toolbar button')].filter(n=>!n.hidden);
                    return {overflow:app.scrollHeight>app.clientHeight+1 || document.body.scrollWidth>innerWidth+1 || app.scrollTop!==0,
                        boardFits:board.bottom<=area.bottom+2, boardWidth:board.width, panelWidth:panel.width,panelHeight:panel.height,
                        buttonsFit:targets.every(node=>{const b=node.getBoundingClientRect();return b.height>=44 && b.left>=0 && b.right<=innerWidth+1 && node.scrollWidth<=node.clientWidth+1;}),
                        backgrounds:targets.every(node=>!['transparent','rgba(0, 0, 0, 0)'].includes(getComputedStyle(node).backgroundColor)),
                        rowsFit:rows.every(node=>{const b=node.getBoundingClientRect();return b.height>=44 && b.height<=45 && node.scrollWidth<=node.clientWidth+1;}),
                        count:rows.length,label:document.querySelector('#legal-count').textContent,
                        visible:rows.filter(node=>{const b=node.getBoundingClientRect();return b.top>=viewport.top && b.bottom<=viewport.bottom;}).length,
                        locked:document.querySelectorAll('.square:not(:disabled)').length===0,
                        previewFits:document.querySelector('.board-actions').getBoundingClientRect().bottom<=innerHeight,
                        heading:!document.querySelector('#legal-heading').hidden};
                })()`);
                const context = JSON.stringify({ language, width, height, mode, state });
                assert.equal(state.overflow, false, context);
                assert.ok(state.boardFits && state.buttonsFit && state.backgrounds, context);
                assert.ok(state.panelHeight >= 100, context);
                if (mode === 'preview') {
                    assert.ok(!state.locked && state.previewFits, context);
                    assert.ok(Math.abs(state.boardWidth - base.board) < 1, context);
                }
                else {
                    assert.ok(state.rowsFit && state.heading && state.count > 0, context);
                    assert.equal(state.label, String(state.count));
                }
                if (mode === 'expanded') {
                    assert.ok(state.locked, context);
                    assert.ok(width > height ? state.panelWidth > base.width + 40 : state.panelHeight > base.height + 60, context);
                }
                if (width === 390 && mode === 'board') {
                    assert.ok(state.visible >= 6, context);
                    visibleAt390 = state.visible;
                    if (language === 'vi') await capture('mobile-compact-legal.png');
                }
                layouts++;
            }
        }
    }
    await normal();
    if (await evaluate('document.documentElement.lang') !== 'vi') await click('#language');
    await resize(390, 844);
    // Build an actual seven-ply history and test its compact, accessible labels.
    // The cannon is deselected first; selecting twice would cancel the first move.
    if (await evaluate('document.querySelector(".square[data-square=h2]").getAttribute("aria-pressed")') === 'true') await click('.square[data-square=h2]');
    for (const [from, to] of [['h2','e2'], ['a6','a5'], ['e3','e4'], ['c6','c5'], ['e4','e5'], ['g6','g5'], ['e5','e6']]) {
        await click(`.square[data-square="${from}"]`); await click(`.square[data-square="${to}"]`);
    }
    await click('#tab-history');
    assert.equal(await evaluate('document.querySelectorAll(".history-move").length'), 7);
    await evaluate('document.querySelector("#note-editor").open=false');
    await click('#note-editor summary');
    await evaluate('document.querySelector("#note").value="Draft stays through display changes"');
    await click('#expand'); await click('#flip'); await click('#language');
    assert.equal(await evaluate('document.querySelector("#note").value'), 'Draft stays through display changes');
    await click('#language'); await click('#save-note'); await click('#note-editor summary');
    assert.equal(await evaluate('document.querySelector("#note-editor").open'), false);
    const history = await evaluate(`(()=>{const rows=[...document.querySelectorAll('.history-move')];return {
        compact:rows.every(node=>{const b=node.getBoundingClientRect();return b.height>=44&&b.height<=45&&node.scrollWidth<=node.clientWidth+1;}),
        sides:rows.slice(0,2).map(node=>node.dataset.side),
        labels:rows.slice(0,2).map(node=>node.getAttribute('aria-label')),
        annotated:document.querySelector('[aria-current=step]').getAttribute('aria-label')
    };})()`);
    assert.equal(history.compact, true);
    assert.deepEqual(history.sides, ['red', 'black']);
    assert.match(history.labels[0], /\u0110\u1ecf/);
    assert.match(history.labels[1], /\u0110en/);
    assert.match(history.annotated, /ghi ch\u00fa/);
    await capture('mobile-compact-history.png');
    await normal();
    // Focus/scroll restoration must never push the fixed viewport offscreen.
    await evaluate('document.querySelector("#mobile-app").scrollTop=200');
    assert.equal(await evaluate('document.querySelector("#mobile-app").scrollTop'), 0);
    assert.equal(await evaluate('document.querySelector(".topbar").getBoundingClientRect().top>=0'), true);
    await click('#new-game'); await click('#confirm-accept');
    await click('#tab-analysis');
    return { layouts, visibleLegalMovesAt390: visibleAt390 };
}
module.exports = { checkCompactUI };
