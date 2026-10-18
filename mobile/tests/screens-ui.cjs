const assert = require('node:assert/strict');

exports.checkApplicationScreens = async function ({ evaluate, click, resize, capture }) {
    const screen = () => evaluate('document.querySelector("#mobile-app").dataset.screen');
    const save = () => evaluate('localStorage.getItem("xiangqi.mobile.session.v1")');
    const pieces = () => evaluate('document.querySelectorAll(".square.red,.square.black").length');
    await click('#workspace-home'); assert.equal(await screen(), 'home');
    assert.equal(await evaluate('document.querySelectorAll(".mode-card").length'), 1);
    assert.equal(await evaluate('Boolean(document.querySelector("#tab-settings"))'), false);
    assert.equal(await evaluate('document.querySelector(".topbar").inert'), true);
    assert.equal(await evaluate('document.querySelector("#board").getBoundingClientRect().width'), 0);
    await capture('mobile-home.png');
    await click('#open-settings'); assert.equal(await screen(), 'settings');
    assert.equal(await evaluate('document.querySelector("#sound-toggle").closest("#panel-settings")!==null'), true);
    await click('#language'); assert.equal(await evaluate('document.documentElement.lang'), 'en');
    await click('#language');
    await click('#sound-toggle'); assert.equal(await evaluate('document.querySelector("#sound-toggle").getAttribute("aria-pressed")'), 'false');
    await click('#sound-toggle');
    await capture('mobile-settings.png');
    await click('#settings-back'); assert.equal(await screen(), 'home');
    await click('#open-analysis'); assert.equal(await screen(), 'analysis');
    await click('#workspace-settings'); await click('#settings-back'); assert.equal(await screen(), 'analysis');
    await click('.square[data-square=h2]'); await click('.square[data-square=e2]');
    const old = await save();
    await click('#setup-position');
    assert.equal(await evaluate('document.querySelector("#position-editor").hidden'), false);
    assert.equal(await evaluate('document.querySelectorAll("#setup-palette button:disabled").length'), 7);
    // Moving an existing piece is free placement, not a legal-game move.
    await click('#flip');
    await click('.square[data-square=a0]'); await click('.square[data-square=a4]');
    assert.equal(await evaluate('document.querySelector(".square[data-square=a4] .chip").textContent'), '\u8eca');
    await click('#flip');
    assert.equal(await save(), old, 'Editing must not autosave a draft');
    await click('[data-setup-action=clear]'); assert.equal(await pieces(), 2);
    assert.equal(await evaluate('document.querySelector("#setup-apply").disabled'), true);
    assert.equal(await evaluate('document.querySelector("#setup-palette [data-type=k]").disabled'), true);
    await click('#setup-palette [data-type=p]'); await click('.square[data-square=e4]');
    assert.equal(await pieces(), 3);
    assert.equal(await evaluate('document.querySelector("#setup-apply").disabled'), false);
    // A full-board reset is draft-only; invalid placement cannot alter it.
    await click('[data-setup-action=initial]'); assert.equal(await pieces(), 32);
    await click('[data-setup-action=tool][data-value=move]');
    await click('.square[data-square=e0]'); await click('.square[data-square=c0]');
    assert.equal(await evaluate('document.querySelector(".square[data-square=e0] .chip").textContent'), '\u5e25');
    let layouts = 0;
    for (const [width, height] of [[320, 568], [390, 844], [844, 390]]) {
        await resize(width, height);
        const layout = await evaluate(`(() => {
            const apply=document.querySelector('#setup-apply').getBoundingClientRect();
            const board=document.querySelector('#board').getBoundingClientRect();
            return {overflow:document.body.scrollWidth>innerWidth, board:board.width>=180&&board.bottom<=innerHeight,
                apply:apply.height>=44&&apply.bottom<=innerHeight&&apply.right<=innerWidth,
                tools:[...document.querySelectorAll('.setup-tools button')].every(button=>{
                    const b=button.getBoundingClientRect(), target=document.elementFromPoint(b.x+b.width/2,b.y+b.height/2);
                    return button===target||button.contains(target);
                })};
        })()`);
        assert.deepEqual(layout, { overflow: false, board: true, apply: true, tools: true }, JSON.stringify({width,height,layout}));
        layouts++;
    }
    await resize(390, 844); await capture('mobile-position-setup.png');
    await click('#setup-cancel'); assert.equal(await save(), old);
    assert.equal(await pieces(), 32);
    await click('#setup-position'); await click('[data-setup-action=clear]');
    await click('#setup-palette [data-type=p]'); await click('.square[data-square=e4]');
    await click('#setup-apply'); assert.equal(await evaluate('document.querySelector("#confirm-dialog").open'), true);
    await click('#confirm-cancel'); assert.equal(await save(), old);
    await click('#setup-apply'); await click('#confirm-accept');
    assert.equal(await pieces(), 3);
    assert.equal(await evaluate('document.querySelectorAll(".history-move").length'), 0);
    assert.equal(await evaluate('document.querySelector("#position-editor").hidden'), true);
    const game = JSON.parse(JSON.parse(await save()).game);
    assert.match(game.startingFen, /4k4\/9\/9\/9\/9\/4P4\/9\/9\/9\/4K4 b/);
    await click('#new-game'); await click('#confirm-accept');
    return { home: true, settings: true, onlyAnalysis: true, draftCancel: true, placement: true, confirmation: true, layouts };
};
