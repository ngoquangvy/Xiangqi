// Function body executed only by the Debug simulator smoke harness.
const check = (condition, message) => { if (!condition) throw Error(message); };
const wait = async (condition, message) => {
    for (let i = 0; i < 400; i++) {
        if (await condition()) return;
        await new Promise(resolve => setTimeout(resolve, 100));
    }
    throw Error(message);
};
const query = selector => document.querySelector(selector);
const click = selector => { check(query(selector), `Missing ${selector}`); query(selector).click(); };
const chip = square => query(`.square[data-square=${square}] .chip`).textContent;
const native = (plugin, method, options = {}) => Capacitor.nativePromise(plugin, method, options);
const read = async () => (await native('LocalSession', 'get')).value;
try {
    await wait(() => typeof Capacitor !== 'undefined' && document.querySelectorAll('.square').length === 90, 'Board did not initialize');
    await document.fonts.ready;
    check(document.fonts.check('24px "Xiangqi Symbols"'), 'Missing offline chess font');
    check(!document.body.textContent.includes('\ufffd'), 'Encoding corruption');
    if (restore) {
        const saved = JSON.parse(await read());
        check(saved.previewHelpSeen === true && saved.language === 'en', 'Preferences did not survive relaunch');
        check(chip('h2') === '' && chip('e2') !== '', 'Live position did not survive relaunch');
        check(document.querySelectorAll('.history-move').length === 1, 'History did not survive relaunch');
        return { pass: true, restore: true, font: true };
    }
    check(await read() === null, 'Smoke test requires a fresh simulator');
    check(document.querySelectorAll('.square.red,.square.black').length === 32, 'Incorrect initial board');
    await wait(() => document.querySelectorAll('#engine-results button').length === 5, 'Engine did not return five PVs');
    await wait(() => query('#engine-status').dataset.state === 'complete', 'Engine did not finish');
    await wait(() => document.querySelectorAll('#book-results button').length === 17, 'Bundled book did not return 17 root choices');
    const rows = [...document.querySelectorAll('#engine-results button')];
    const enginePvLengths = rows.map(row => row.suggestion.pv.length);
    check(new Set(rows.map(row => row.dataset.suggestion)).size === 5, 'Engine ranks overwrote each other');
    const board = [...document.querySelectorAll('.chip')].map(node => node.textContent).join('|');
    const initialConfiguration = (await native('Pikafish', 'status')).configurationChanges;
    click('#engine-results button:last-child');
    check(!query('#mobile-app').classList.contains('previewing'), 'Highlight prematurely entered simulation');
    click('.square[data-square=h2]');
    check(query('.square[data-square=h2]').classList.contains('selected') && query('#cancel-preview').hidden, 'Pending suggestion consumed the live piece touch');
    click('.square[data-square=h2]');
    click('#engine-results button:last-child');
    check(query('#preview-position').textContent.startsWith('0 /'), 'Selection moved immediately');
    check([...document.querySelectorAll('.chip')].map(node => node.textContent).join('|') === board, 'Selection changed board');
    check(!query('#preview-guide').hidden, 'First selection did not show coaching');
    check(query('#engine-results [aria-pressed=true]').dataset.key === 'engine-5', 'Wrong selected row');
    click('#redo'); check(query('#preview-position').textContent.startsWith('1 /'), 'Next did not replay');
    check(query('#preview-guide').hidden, 'Next did not dismiss coaching');
    const replayed = Math.min(13, enginePvLengths[4]);
    for (let index = 1; index < replayed; index++) click('#redo');
    check(query('#preview-position').textContent.startsWith(`${replayed} /`), 'Engine PV replay stopped before its available move');
    for (let index = 0; index < replayed; index++) click('#undo');
    check(query('#preview-position').textContent.startsWith('0 /'), 'Previous did not return to root');
    click('.square[data-square=e2]');
    check(query('#cancel-preview').hidden && document.querySelectorAll('.analysis-row[aria-pressed=true]').length === 0, 'Board touch did not cancel');
    click('#preview-help'); check(!query('#preview-guide').hidden, 'Help cannot reopen'); click('#preview-guide-done');
    // Real move, undo/redo, reload persistence and sound preference all use the
    // production UI and native plugins, not a second game implementation.
    click('#sound-toggle');
    click('.square[data-square=h2]'); click('.square[data-square=e2]');
    check(chip('h2') === '' && chip('e2') !== '', 'Real move failed');
    click('#undo'); check(chip('h2') !== '', 'Undo failed');
    click('#redo'); check(chip('h2') === '', 'Redo failed');
    await wait(() => query('#engine-status').dataset.state === 'complete' && document.querySelectorAll('#engine-results button').length === 5, 'Blue analysis did not complete');
    const blueRows = [...document.querySelectorAll('#engine-results button')].map(row => row.suggestion);
    if (blueRows.every(row => row.kind === 'cp')) check(blueRows.every((row, i) => !i || blueRows[i - 1].value >= row.value), 'Blue best-first score order reversed');
    check((await native('Pikafish', 'status')).configurationChanges === initialConfiguration, 'Same settings reallocated engine/hash between positions');
    const newGame = query('#new-game');
    check(newGame.closest('.board-actions') && newGame.getBoundingClientRect().height >= 44, 'New game not visible beside navigation');
    click('.square[data-square=h9]'); click('[data-uci="h9g7"]'); click('#redo'); click('#expand');
    const cursor = query('#preview-position').textContent;
    click('#new-game'); check(query('#confirm-dialog').open, 'New game has no confirmation');
    click('#confirm-cancel');
    check(query('#preview-position').textContent === cursor && query('#mobile-app').classList.contains('previewing'), 'Cancel discarded preview');
    click('#new-game'); click('#confirm-accept');
    check(!query('#mobile-app').classList.contains('previewing') && !query('#mobile-app').classList.contains('expanded'), 'New game did not exit preview');
    check(chip('h2') !== '' && chip('e2') === '' && query('#undo').disabled && query('#redo').disabled, 'New game did not reset board/history');
    check(document.querySelectorAll('.square.last,.square.suggestion,.square.checked,.history-move').length === 0, 'New game left stale highlights/history');
    await wait(async () => {
        const value = await read();
        return value && JSON.parse(JSON.parse(value).game).moveHistory.length === 0;
    }, 'New game was not saved natively');
    await wait(() => document.querySelectorAll('#book-results button').length === 17, 'New game did not restore root book');
    await wait(() => document.querySelectorAll('#engine-results button').length === 5 && query('#engine-status').dataset.state === 'complete', 'New game did not restart root analysis');
    click('#tab-settings');
    query('#engine-profile').value = 'unlimited'; query('#engine-profile').dispatchEvent(new Event('change'));
    check(!query('#engine-unlimited-hint').hidden, 'Continuous mode warning missing');
    await wait(() => document.querySelectorAll('#engine-results button').length === 5, 'Continuous search has no five PVs');
    // Exceed the largest old 10-second budget; do not assert a hardware-dependent depth.
    await new Promise(resolve => setTimeout(resolve, 11000));
    check(query('#engine-status').dataset.state === 'searching' && (await native('Pikafish', 'status')).searching, 'Continuous search stopped at an old limit');
    click('#engine-pause');
    await wait(async () => !(await native('Pikafish', 'status')).searching, 'Continuous search did not stop');
    check(query('#engine-status').dataset.state === 'paused', 'Pause state lost');
    query('#engine-profile').value = 'deep_cool'; query('#engine-profile').dispatchEvent(new Event('change'));
    check(!query('#engine-cool-hint').hidden, 'One-thread Deep hint missing');
    click('#engine-pause');
    await wait(async () => (await native('Pikafish', 'status')).threads === 1 && document.querySelectorAll('#engine-results button').length === 5, 'One-thread Deep did not return five lines');
    query('#engine-profile').value = 'deep'; query('#engine-profile').dispatchEvent(new Event('change'));
    await wait(async () => (await native('Pikafish', 'status')).threads === 2 && document.querySelectorAll('#engine-results button').length === 5, 'Deep did not use two threads');
    await native('Pikafish', 'debugThermal', { state: 'fair' });
    await wait(async () => (await native('Pikafish', 'status')).threads === 1 && (await native('Pikafish', 'status')).searching, 'Fair heat did not limit threads');
    await native('Pikafish', 'debugThermal', { state: 'serious' });
    await wait(async () => !(await native('Pikafish', 'status')).searching && query('#engine-status').dataset.state === 'thermal', 'High heat did not stop native search');
    // A valid direct call must not bypass the native thermal gate.
    await native('Pikafish', 'analyze', { id: 'thermal-bypass', initialFen: query('#engine-analysis').dataset.fen, moves: '', profile: 'deep' });
    check(!(await native('Pikafish', 'status')).searching, 'Thermal gate bypassed');
    await native('Pikafish', 'debugThermal', { state: 'nominal' });
    check((await native('Pikafish', 'status')).thermal.blocked, 'Thermal cooldown did not hold');
    await wait(async () => !(await native('Pikafish', 'status')).thermal.blocked && (await native('Pikafish', 'status')).searching, 'Thermal recovery did not resume');
    await native('Pikafish', 'debugThermal', { state: 'system' });
    click('#engine-pause');
    await wait(async () => !(await native('Pikafish', 'status')).searching, 'Pause after thermal recovery failed');
    query('#engine-profile').value = 'balanced'; query('#engine-profile').dispatchEvent(new Event('change'));
    check(query('#engine-status').dataset.state === 'paused', 'Profile change overrode pause');
    click('#engine-pause'); click('#tab-analysis');
    // Leave one real move for the independent process-relaunch persistence check.
    click('.square[data-square=h2]'); click('.square[data-square=e2]');
    if (document.documentElement.lang !== 'en') click('#language');
    await wait(async () => { const value = await read(); return value && JSON.parse(value).language === 'en'; }, 'Native save did not finish');
    const saved = JSON.parse(await read());
    check(saved.previewHelpSeen === true && saved.soundEnabled === false, 'Preferences were not saved');
    check(document.querySelectorAll('.history-move').length === 1, 'Preview changed history');
    const invalid = await native('Pikafish', 'analyze', { id: 'invalid', initialFen: 'bad\nquit', moves: '', profile: 'balanced' }).then(() => false, () => true);
    check(invalid, 'Invalid native request accepted');
    const box = query('#board').getBoundingClientRect();
    check(box.left >= 0 && box.right <= innerWidth + 1 && box.top >= 0 && box.bottom <= innerHeight, 'Board outside viewport');
    return { pass: true, engineRows: 5, enginePvLengths, replayed, blueScores: blueRows.map(row => row.value), cachePreserved: true, thermalSimulation: true, oneThreadDeep: true,
        pendingBoardTouch: true, bookRows: 17, preview: true, coaching: true, newGame: true, unlimited: true, saved: true, font: true,
        viewport: [innerWidth, innerHeight], userAgent: navigator.userAgent };
} catch (error) {
    return { pass: false, error: String(error?.stack || error), status: query('#engine-status')?.textContent,
        save: query('#save-status')?.textContent, engineRows: document.querySelectorAll('#engine-results button').length };
}
