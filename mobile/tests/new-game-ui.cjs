const assert = require('node:assert/strict');

exports.checkNewGame = async function ({ evaluate, click, resize }) {
    const inspect = () => evaluate(`(() => {
        const button = document.querySelector('#new-game'), b = button.getBoundingClientRect();
        return { count: document.querySelectorAll('#new-game').length,
            inControls: Boolean(button.closest('.board-actions')), label: button.getAttribute('aria-label'),
            visible: b.width >= 44 && b.height >= 44 && b.left >= 0 && b.right <= innerWidth && b.bottom <= innerHeight,
            dialog: document.querySelector('#confirm-dialog').open,
            preview: document.querySelector('#mobile-app').classList.contains('previewing'),
            expanded: document.querySelector('#mobile-app').classList.contains('expanded'),
            position: document.querySelector('#preview-position').textContent,
            chips: Array.from(document.querySelectorAll('.chip'), chip => chip.textContent),
            save: localStorage.getItem('xiangqi.mobile.session.v1') };
    })()`);
    for (const tab of ['analysis', 'history']) {
        await click(`#tab-${tab}`);
        const state = await inspect();
        assert.equal(state.count, 1);
        assert.equal(state.inControls, true);
        assert.equal(state.visible, true, `New game is hidden in ${tab}`);
        assert.equal(state.label, 'V\u00e1n m\u1edbi');
    }
    await click('#tab-analysis');
    await click('.square[data-square="h2"]'); await click('.square[data-square="e2"]');
    const live = await inspect();
    await click('#new-game'); assert.equal((await inspect()).dialog, true);
    await click('#confirm-cancel');
    assert.equal((await inspect()).save, live.save);
    // Start a black-side scratch line from the live game, then cancel New game.
    await click('.square[data-square="h9"]'); await click('[data-uci="h9g7"]');
    await click('#redo'); await click('#expand');
    const preview = await inspect();
    assert.equal(preview.preview, true); assert.equal(preview.expanded, true);
    let layouts = 0;
    for (const language of ['vi', 'en']) {
        if (await evaluate('document.documentElement.lang') !== language) await click('#language');
        for (const [width, height] of [[320, 568], [390, 844], [844, 390]]) {
            await resize(width, height);
            const state = await inspect();
            assert.equal(state.visible, true, `${language} preview at ${width}x${height}`);
            assert.equal(state.label, language === 'vi' ? 'V\u00e1n m\u1edbi' : 'New game');
            assert.equal(await evaluate(`document.querySelector('#new-game [data-text]').hidden`), true);
            layouts++;
        }
    }
    if (await evaluate('document.documentElement.lang') !== 'vi') await click('#language');
    await resize(390, 844);
    const beforeCancel = await inspect();
    await click('#new-game'); await click('#confirm-cancel');
    const cancelled = await inspect();
    assert.equal(cancelled.preview, true); assert.equal(cancelled.expanded, true);
    assert.equal(cancelled.position, preview.position);
    assert.deepEqual(cancelled.chips, preview.chips);
    assert.equal(cancelled.save, beforeCancel.save);
    await click('#new-game'); await click('#confirm-accept');
    const fresh = await inspect();
    assert.equal(fresh.dialog, false); assert.equal(fresh.preview, false); assert.equal(fresh.expanded, false);
    assert.equal(await evaluate(`document.querySelector('#new-game [data-text]').hidden`), false);
    assert.equal(await evaluate(`document.querySelector('#undo').disabled && document.querySelector('#redo').disabled`), true);
    assert.equal(await evaluate(`document.querySelectorAll('.square.last, .square.suggestion, .square.checked, .history-move').length`), 0);
    assert.equal(await evaluate(`document.querySelector('#preview-guide').hidden`), true);
    const game = JSON.parse(JSON.parse(fresh.save).game);
    assert.equal(game.moveHistory.length, 0);
    assert.equal(game.currentMoveIndex, -1);
    assert.equal(await evaluate(`document.querySelector('.square[data-square="h2"] .chip').textContent`), '\u70ae');
    return { layouts, confirmation: true, previewExit: true, savedReset: true };
};
