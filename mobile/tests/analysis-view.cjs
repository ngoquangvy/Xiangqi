const { buildSync } = require('esbuild');
const assert = require('node:assert/strict');
const path = require('node:path');

// A UI-only fixture exercises the actual view module. Engine integration is
// tested separately against real native Pikafish in android-engine.mjs.
async function checkAnalysisView(evaluate) {
    const bundle = buildSync({ stdin: { contents: "export { AnalysisView } from './src/ui/AnalysisView.js';", resolveDir: path.resolve(__dirname, '..') },
        bundle: true, format: 'iife', globalName: 'AnalysisViewFixture', platform: 'browser', write: false }).outputFiles[0].text;
    await evaluate(bundle + `
        window.engineUIFixture = (() => {
            const fen='rnbakabnr/9/1c5c1/p1p1p1p1p/9/9/P1P1P1P1P/1C5C1/9/RNBAKABNR w - - 0 1';
            let game={game:{fen},ui:{language:'en',analysis:{profile:'balanced',bookEnabled:true},selected:null,preview:null}};
            const base={source:'engine',rank:1,move:'h2e2',notation:['C2=5','N8+7'],pv:['h2e2','h9g7'],kind:'cp',value:25,depth:8};
            let state={status:'searching',id:'fixture-1',fen,rows:[base],bookStatus:'ready',book:[{...base,rank:undefined,source:'book',note:'<img src=x onerror=alert(1)>'}]};
            const previews=[], callbacks=new Set(); let render;
            const store={snapshot:()=>structuredClone(game),subscribe:callback=>{callbacks.add(callback);callback();return()=>callbacks.delete(callback);},
                selectSuggestion:(move,pv,suggestion)=>{previews.push({move,pv});game.ui.suggestion=structuredClone(suggestion);game.ui.pending={length:pv.length};for(const callback of callbacks)callback();},
                setAnalysis:settings=>{Object.assign(game.ui.analysis,settings);for(const callback of callbacks)callback();}};
            const analysis={transport:{available:true},snapshot:()=>structuredClone(state),subscribe:callback=>{render=callback;callback();return()=>{};},togglePause:()=>{state.status='paused';render();}};
            const view=new AnalysisViewFixture.AnalysisView(document.querySelector('#mobile-app'),store,analysis);
            return {previews,update:patch=>{Object.assign(state,patch);render();},cancel:()=>{game.ui.suggestion=null;game.ui.preview=null;render();},changeFen:()=>{game.game.fen='different';render();},view};
        })();
        true;
    `);
    const result = await evaluate(`(()=>{
        const fixture=engineUIFixture, row=document.querySelector('#engine-results button'), book=document.querySelector('#book-results button');
        const pause=document.querySelector('#engine-pause'), icon=pause.querySelector('svg'), option=document.querySelector('#engine-profile option');
        row.focus();row.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true}));
        fixture.update({rows:[{source:'engine',rank:1,move:'b2e2',notation:['C8=5'],pv:['b2e2'],kind:'cp',value:40,depth:9}]});
        const stable=row===document.querySelector('#engine-results button')&&book===document.querySelector('#book-results button')&&icon===pause.querySelector('svg')&&document.activeElement===row;
        row.dispatchEvent(new MouseEvent('click',{detail:1,bubbles:true}));
        fixture.update({rows:[{source:'engine',rank:1,move:'b2e2',notation:['C8=5'],pv:['b2e2'],kind:'cp',value:50,depth:10}]});
        const selectedFrozen=row.getAttribute('aria-pressed')==='true'&&row.dataset.suggestion==='h2e2'&&row.querySelector('small').textContent==='N8+7';
        fixture.cancel();
        const cleared=row.getAttribute('aria-pressed')==='false';
        row.click();
        book.click();
        const exclusiveSelection=book.getAttribute('aria-pressed')==='true'&&row.getAttribute('aria-pressed')==='false';
        const escaped=!document.querySelector('#book-results img')&&book.textContent.includes('<img');
        const continuation=book.querySelector('small').textContent;
        const headings=[document.querySelector('#engine-heading').textContent,document.querySelector('#book-status').textContent];
        const profile=document.querySelector('#engine-profile'), hint=document.querySelector('#engine-unlimited-hint');
        profile.value='unlimited';profile.dispatchEvent(new Event('change'));
        const unlimited=!hint.hidden&&profile.value==='unlimited'&&profile.selectedOptions[0].textContent.includes('Maximum (continuous)')&&!profile.selectedOptions[0].textContent.includes('D0');
        profile.value='balanced';profile.dispatchEvent(new Event('change'));
        const boundedHintHidden=hint.hidden;
        fixture.changeFen();row.click();
        fixture.view.destroy();
        return {stable,selectedFrozen,cleared,exclusiveSelection,escaped,continuation,headings,unlimited,boundedHintHidden,previews:fixture.previews,profileOption:option.textContent};
    })()`);
    assert.equal(result.stable, true);
    assert.equal(result.escaped, true);
    assert.equal(result.continuation, 'N8+7');
    assert.equal(result.headings[1], 'Opening book');
    assert.equal(result.selectedFrozen, true);
    assert.equal(result.cleared, true);
    assert.equal(result.exclusiveSelection, true);
    assert.deepEqual(result.previews, [{move:'h2e2',pv:['h2e2','h9g7']},{move:'b2e2',pv:['b2e2']},{move:'h2e2',pv:['h2e2','h9g7']}]);
    assert.match(result.profileOption, /Battery saver/);
    assert.equal(result.unlimited, true);
    assert.equal(result.boundedHintHidden, true);
    return { stableStreamingRows: true, touchedMovePreserved: true, staleFenRejected: true, escapedNotes: true, unlimitedOption: true };
}
module.exports = { checkAnalysisView };
