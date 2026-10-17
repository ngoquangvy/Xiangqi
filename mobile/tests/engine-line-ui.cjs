const { buildSync } = require('esbuild');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');

exports.checkEngineLine = async function ({ evaluate, click }) {
    const root = path.resolve(__dirname, '..');
    const bundle = buildSync({ stdin: { contents: `
        export { AppStore } from './src/state/AppStore.js';
        export { GameStorage } from './src/storage/GameStorage.js';
        export { MobileApp } from './src/ui/MobileApp.js';
        export { AnalysisController } from './src/analysis/AnalysisController.js';
        export { AnalysisView } from './src/ui/AnalysisView.js';`, resolveDir: root },
        bundle: true, format: 'iife', globalName: 'EngineLineModules', platform: 'browser', write: false }).outputFiles[0].text;
    const fen = await evaluate(bundle + `(async () => {
        const {AppStore,GameStorage,MobileApp,AnalysisController,AnalysisView}=EngineLineModules;
        const values=new Map(), store=new AppStore(new GameStorage({getItem:k=>values.get(k),setItem:(k,v)=>values.set(k,v)}));
        store.completePreviewHelp(); let output, request;
        const transport={available:true,listen:async fn=>{output=fn;return ()=>{};},
            analyze:async value=>{request=value;},stop:async()=>{},lookupBook:async()=>[]};
        const analysis=new AnalysisController(store,transport);
        const ui=new MobileApp(document.querySelector('#mobile-app'),store);
        const view=new AnalysisView(document.querySelector('#mobile-app'),store,analysis);
        await analysis.started;
        window.engineLineFixture={store,analysis,ui,view,original:store.snapshot().game,
            before:[...values],values,feed:pv=>output({id:request.id,line:'info depth 40 score cp 25 pv '+pv.join(' ')})};
        return store.snapshot().game.fen;
    })()`);
    const spec = JSON.parse(readFileSync(path.join(root, 'engine/pikafish.json'), 'utf8'));
    const book = JSON.parse(readFileSync(path.resolve(root, 'engine', spec.book), 'utf8'));
    const pv = book.positions[fen].find(row => row.move === 'b2e2').pv.slice(0, 32);
    await evaluate(`engineLineFixture.feed(${JSON.stringify(pv)});true`);
    assert.equal(await evaluate(`document.querySelector('#engine-results button').suggestion.pv.length`), 32);
    await click('#engine-results button');
    assert.equal(await evaluate(`document.querySelector('#preview-position').textContent`), '0 / 32');
    for (let index = 0; index < 13; index++) await click('#redo');
    assert.equal(await evaluate(`document.querySelector('#preview-position').textContent`), '13 / 32');
    await click('#undo');
    assert.equal(await evaluate(`document.querySelector('#preview-position').textContent`), '12 / 32');
    const unchanged = await evaluate(`JSON.stringify(engineLineFixture.store.snapshot().game)===JSON.stringify(engineLineFixture.original)
        &&JSON.stringify([...engineLineFixture.values])===JSON.stringify(engineLineFixture.before)`);
    assert.equal(unchanged, true);
    await click('#cancel-preview');
    assert.equal(await evaluate(`document.querySelector('#cancel-preview').hidden`), true);
    await evaluate('engineLineFixture.ui.destroy();engineLineFixture.view.destroy();engineLineFixture.analysis.destroy();true');
    return { received: 32, replayed: 13, previous: 12, liveGameUnchanged: true };
};
