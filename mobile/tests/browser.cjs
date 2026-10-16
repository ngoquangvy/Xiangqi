const { app, BrowserWindow } = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const assert = require('node:assert/strict');
const { instrumentMedia } = require('../../tests/helpers/mediaProbe.cjs');
const { checkCompactUI } = require('./compact-ui.cjs');
const { checkAnalysisView } = require('./analysis-view.cjs');
const { checkBoardFeedback } = require('./board-feedback.cjs');
const root = path.resolve(__dirname, '..');
app.setPath('userData', fs.mkdtempSync(path.join(os.tmpdir(), 'xiangqi-mobile-ui-')));
const artifactDir = path.join(root, 'artifacts');
fs.mkdirSync(artifactDir, { recursive: true });
app.whenReady().then(async () => {
    const errors = [], requests = [];
    const win = new BrowserWindow({ show: false, useContentSize: true, width: 390, height: 844,
        webPreferences: { contextIsolation: true, nodeIntegration: false, backgroundThrottling: false } });
    const timeout = setTimeout(() => { console.error('MOBILE_UI_TIMEOUT'); app.exit(1); }, 60000);
    win.webContents.on('console-message', event => { if (event.level === 'error') errors.push(event.message); });
    win.webContents.session.webRequest.onBeforeRequest((details, callback) => {
        if (/^https?:|^wss?:/.test(details.url)) requests.push(details.url);
        callback({ cancel: false });
    });
    const evaluate = async code => {
        try { return await win.webContents.executeJavaScript(code); }
        catch (error) { console.error('UI_SCRIPT', code, 'CONSOLE', errors); throw error; }
    };
    const click = selector => evaluate(`document.querySelector(${JSON.stringify(selector)}).click()`);
    const text = selector => evaluate(`document.querySelector(${JSON.stringify(selector)}).textContent`);
    const chip = square => text(`.square[data-square="${square}"] .chip`);
    async function resize(width, height) {
        win.setContentSize(width, height);
        for (let i = 0; i < 100; i++) {
            if (await evaluate(`innerWidth===${width} && innerHeight===${height}`)) return;
            await new Promise(resolve => setTimeout(resolve, 20));
        }
        throw Error(`Viewport did not resize to ${width}x${height}`);
    }
    async function ready() {
        for (let i = 0; i < 100; i++) {
            if (await evaluate('document.querySelectorAll(".square.red, .square.black").length === 32')) return;
            await new Promise(resolve => setTimeout(resolve, 30));
        }
        throw Error('Mobile board failed to initialize');
    }
    try {
        await instrumentMedia(win);
        await win.loadFile(path.join(root, 'dist/index.html'));
        await ready();
        await evaluate('document.fonts.ready');
        assert.equal(await evaluate('document.fonts.check(\'24px "Xiangqi Symbols"\')'), true);
        assert.equal(await evaluate('document.querySelector("#sound-toggle").getAttribute("aria-pressed")'), 'true');
        await click('#sound-toggle');
        const mutedReload = new Promise(resolve => win.webContents.once('did-finish-load', resolve));
        win.reload(); await mutedReload; await ready();
        assert.equal(await evaluate('document.querySelector("#sound-toggle").getAttribute("aria-pressed")'), 'false');
        await click('#sound-toggle');
        await click('#language');
        assert.equal(await evaluate('document.documentElement.lang'), 'en');
        assert.match(await text('#undo'), /Previous/);
        assert.equal(await text('#undo .control-symbol'), '‹');
        assert.match(await text('#panel-analysis'), /Engine not installed/);
        const languageReloaded = new Promise(resolve => win.webContents.once('did-finish-load', resolve));
        win.reload(); await languageReloaded; await ready();
        assert.equal(await evaluate('document.documentElement.lang'), 'en');
        await click('#language');
        assert.match(await text('#panel-analysis'), /Chưa tích hợp engine/);
        assert.equal(await chip('h2'), '炮');
        await click('.square[data-square="h2"]');
        assert.ok(await evaluate('document.querySelectorAll(".square.legal").length > 0'));
        await click('[data-uci="h2e2"]');
        assert.equal(await chip('h2'), '炮');
        assert.equal(await evaluate('document.querySelector("#preview-position").textContent'), '0 / 1');
        assert.equal(await evaluate('document.querySelector("#preview-guide").hidden'), false);
        assert.equal(await evaluate('document.querySelector("#undo").disabled'), true);
        await click('#redo');
        assert.equal(await chip('h2'), '');
        assert.equal(await evaluate('document.querySelector("#preview-guide").hidden'), true);
        assert.equal(await evaluate('JSON.parse(localStorage.getItem("xiangqi.mobile.session.v1")).previewHelpSeen'), true);
        assert.match(await text('#position-label'), /ĐANG XEM THỬ/);
        assert.equal(await evaluate('document.querySelectorAll(".history-move").length'), 0);
        await click('#cancel-preview');
        assert.equal(await chip('h2'), '炮');
        assert.deepEqual(await evaluate('window.__media'), []);
        // Use real pointer coordinates once, not just programmatic DOM clicks.
        for (const square of ['h2', 'e2']) {
            const point = await evaluate(`(() => { const b=document.querySelector('.square[data-square="${square}"]').getBoundingClientRect();return {x:b.x+b.width/2,y:b.y+b.height/2};})()`);
            win.webContents.sendInputEvent({ type: 'mouseDown', x: Math.round(point.x), y: Math.round(point.y), button: 'left', clickCount: 1 });
            win.webContents.sendInputEvent({ type: 'mouseUp', x: Math.round(point.x), y: Math.round(point.y), button: 'left', clickCount: 1 });
            await new Promise(resolve => setTimeout(resolve, 50));
        }
        assert.match(await text('#position-label'), /1\/1/);
        assert.equal(await evaluate('document.querySelector("#turn-label").dataset.side'), 'black');
        assert.equal(await evaluate('document.querySelector("#turn-dot").getBoundingClientRect().width'), 13);
        assert.equal(await chip('e2'), '炮');
        for (let i = 0; i < 100 && !(await evaluate('window.__media.some(clip=>clip.playing===1)')); i++) await new Promise(r => setTimeout(r, 20));
        assert.equal(await evaluate('window.__media[0]?.src'), 'sounds/sidestick.wav');
        assert.equal(await evaluate('window.__media[0]?.playing'), 1);
        assert.equal(await evaluate('window.__media[0]?.errors'), 0);
        await click('#tab-history');
        assert.equal(await evaluate('document.querySelector("#note-editor").open'), false);
        await click('#note-editor summary');
        await evaluate(`document.querySelector('#note').value = 'Ghi chú <img src=x onerror=alert(1)>'; document.querySelector('#note-form').requestSubmit()`);
        assert.match(await evaluate('document.querySelector(".history-move").getAttribute("aria-label")'), /ghi chú/);
        assert.equal(await text('.note-mark'), '\u270e');
        await click('#undo');
        assert.equal(await chip('h2'), '炮');
        await click('#redo');
        assert.equal(await chip('e2'), '炮');
        assert.equal(await evaluate('window.__media[0].calls'), 1);
        await click('#flip');
        const location = await evaluate("document.querySelector('.square[data-square=a9]').style.left");
        assert.notEqual(location, '0%');
        const loaded = new Promise(resolve => win.webContents.once('did-finish-load', resolve));
        win.reload();
        await loaded;
        await ready();
        assert.equal(await chip('e2'), '炮');
        await click('#tab-history');
        await click('#note-editor summary');
        assert.equal(await evaluate('document.querySelector("#note").value'), 'Ghi chú <img src=x onerror=alert(1)>');
        assert.equal(await evaluate('document.querySelectorAll(".history-list img").length'), 0);
        await click('#undo');
        await click('.square[data-square="b2"]');
        await click('.square[data-square="e2"]');
        assert.equal(await evaluate('document.querySelector("#confirm-dialog").open'), true);
        await click('#confirm-cancel');
        assert.equal(await chip('h2'), '炮');
        await click('.square[data-square="e2"]');
        await click('#confirm-accept');
        assert.equal(await chip('b2'), '');
        assert.equal(await chip('e2'), '炮');
        assert.equal(await evaluate('document.querySelectorAll(".history-move").length'), 1);
        await click('#expand');
        assert.equal(await evaluate('document.querySelectorAll(".square:not(:disabled)").length'), 0);
        await click('#expand');
        await click('#tab-settings');
        await click('#new-game');
        await click('#confirm-cancel');
        assert.equal(await chip('b2'), '');
        await click('#new-game');
        await click('#confirm-accept');
        assert.equal(await chip('b2'), '炮');
        assert.equal(await evaluate('document.querySelectorAll(".history-move").length'), 0);
        // Decode and actually play capture and check too, using legal games.
        await click('.square[data-square="h2"]'); await click('.square[data-square="h9"]');
        for (let i = 0; i < 100 && !(await evaluate('window.__media.some(clip=>clip.src.endsWith("capture.mp3") && clip.playing>0)')); i++) await new Promise(r => setTimeout(r, 20));
        assert.equal(await evaluate('window.__media.some(clip=>clip.src.endsWith("capture.mp3") && clip.playing>0 && !clip.errors)'), true);
        await click('#new-game'); await click('#confirm-accept');
        // Clear the central cannon's two screens down to one: e5xe6 checks.
        for (const [from, to] of [['h2','e2'], ['a6','a5'], ['e3','e4'], ['c6','c5'], ['e4','e5'], ['g6','g5'], ['e5','e6']]) {
            await click(`.square[data-square="${from}"]`); await click(`.square[data-square="${to}"]`);
        }
        for (let i = 0; i < 100 && !(await evaluate('window.__media.some(clip=>clip.src.endsWith("check.mp3") && clip.playing>0)')); i++) await new Promise(r => setTimeout(r, 20));
        assert.equal(await evaluate('window.__media.some(clip=>clip.src.endsWith("check.mp3") && clip.playing>0 && !clip.errors)'), true);
        await click('#new-game'); await click('#confirm-accept');
        await click('#tab-analysis');

        const compact = await checkCompactUI({ evaluate, click, resize, capture: async name => {
            // Capture a painted frame, not a stale image from the hidden window.
            win.showInactive();
            await evaluate('new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))');
            await new Promise(resolve => setTimeout(resolve, 100));
            fs.writeFileSync(path.join(artifactDir, name), (await win.webContents.capturePage()).toPNG());
            win.hide();
        } });
        const layouts = [];
        for (const language of ['vi', 'en']) {
          if (await evaluate('document.documentElement.lang') !== language) await click('#language');
          for (const [width, height] of [[320, 568], [320, 640], [360, 800], [412, 915], [844, 390]]) {
            await resize(width, height);
            for (const expanded of [false, true]) {
                if (await evaluate('document.querySelector("#mobile-app").classList.contains("expanded")') !== expanded) await click('#expand');
                const bounds = await evaluate(`(() => {
                    const app=document.querySelector('#mobile-app'), board=document.querySelector('#board').getBoundingClientRect();
                    const area=document.querySelector('.board-area').getBoundingClientRect(), panel=document.querySelector('.inspector').getBoundingClientRect();
                    const footer=document.querySelector('.footer').getBoundingClientRect();
                    return {width:innerWidth,height:innerHeight,bodyWidth:document.body.scrollWidth,
                        boardBottom:board.bottom,areaBottom:area.bottom,boardTop:board.top,
                        panelHeight:panel.height,footerBottom:footer.bottom, appScroll:app.scrollHeight, appHeight:app.clientHeight};
                })()`);
                assert.ok(bounds.bodyWidth <= width + 1, `Horizontal overflow: ${JSON.stringify(bounds)}`);
                assert.ok(bounds.boardBottom <= bounds.areaBottom + 2, `Board overflow: ${JSON.stringify(bounds)}`);
                assert.ok(bounds.footerBottom <= height + 1, `Footer offscreen: ${JSON.stringify(bounds)}`);
                assert.ok(bounds.panelHeight >= 100, `No inspector space: ${JSON.stringify(bounds)}`);
                assert.ok(bounds.appScroll <= bounds.appHeight + 1, `App overflow: ${JSON.stringify(bounds)}`);
                // Keep every glyph's em box inside the engraved ring, including
                // the expanded/preview mini board, not just the large portrait board.
                assert.ok(await evaluate(`Array.from(document.querySelectorAll('.square.red .chip,.square.black .chip')).every(chip=>{
                    const b=chip.getBoundingClientRect();
                    return parseFloat(getComputedStyle(chip).fontSize)<=Math.min(b.width,b.height)*.64;
                })`), `Oversized piece lettering: ${language} ${width}x${height}`);
                assert.ok(await evaluate(`Array.from(document.querySelectorAll('.board-actions button')).every(button=>button.getBoundingClientRect().right<=innerWidth && button.scrollWidth<=button.clientWidth+1)`));
                layouts.push({ language, width, height, expanded });
            }
          }
        }
        if (await evaluate('document.documentElement.lang') !== 'vi') await click('#language');
        await evaluate("document.documentElement.style.setProperty('--safe-area-inset-top','24px'); document.documentElement.style.setProperty('--safe-area-inset-bottom','24px')");
        await resize(360, 800);
        const insets = await evaluate(`(() => {
            const top=document.querySelector('.topbar').getBoundingClientRect().top;
            const bottom=document.querySelector('.footer').getBoundingClientRect().bottom;
            return {top,bottom};
        })()`);
        assert.ok(insets.top >= 24 && insets.bottom <= 776, JSON.stringify(insets));
        await evaluate("document.documentElement.style.removeProperty('--safe-area-inset-top'); document.documentElement.style.removeProperty('--safe-area-inset-bottom')");
        // A focused editor must fit a short viewport after a software keyboard opens.
        await click('#expand');
        await click('.square[data-square="h2"]');
        await click('.square[data-square="e2"]');
        await click('#tab-history');
        if (!await evaluate('document.querySelector("#note-editor").open')) await click('#note-editor summary');
        await evaluate("document.querySelector('#note').focus()");
        await resize(390, 360);
        const editorFits = await evaluate(`(() => { const b=document.querySelector('.inspector').getBoundingClientRect(); return b.bottom<=innerHeight && b.height>=100; })()`);
        assert.equal(editorFits, true);
        await evaluate("document.querySelector('#note').blur()");
        await click('#tab-analysis');
        await resize(390, 844);
        if (await evaluate('document.querySelector("#mobile-app").classList.contains("expanded")')) await click('#expand');
        await click('#flip');
        win.showInactive();
        await new Promise(resolve => setTimeout(resolve, 200));
        fs.writeFileSync(path.join(artifactDir, 'mobile-portrait.png'), (await win.webContents.capturePage()).toPNG());
        const feedback = await checkBoardFeedback({ evaluate, click, resize,
            capture: async filename => { await evaluate('new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))'); fs.writeFileSync(path.join(artifactDir, filename), (await win.webContents.capturePage()).toPNG()); },
            emulateMotion: reduce => win.webContents.debugger.sendCommand('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: reduce ? 'reduce' : 'no-preference' }] }) });
        const analysisUI = await checkAnalysisView(evaluate);
        assert.deepEqual(errors, []);
        assert.deepEqual(requests, []);
        console.log('MOBILE_UI_PASS', JSON.stringify({ layouts: layouts.length, compact, analysisUI, feedback, externalRequests: requests.length,
            checks: 'touch, preview/cancel, undo/redo, branch confirmation, flip, notes/XSS, reload, reset, layouts, font, real WAV/MP3 playback/mute' }));
        clearTimeout(timeout);
        app.quit();
    } catch (error) {
        console.error('MOBILE_UI_FAIL', error);
        win.showInactive();
        try { fs.writeFileSync(path.join(artifactDir, 'failure.png'), (await win.webContents.capturePage()).toPNG()); } catch {}
        clearTimeout(timeout);
        app.exit(1);
    }
});
