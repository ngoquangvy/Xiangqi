import { getText } from './strings.js';
import { PROFILES } from '../analysis/settings.js';

export class AnalysisView {
    constructor(element, store, analysis) {
        this.element = element; this.store = store; this.analysis = analysis;
        this.get('engine-pause').onclick = () => analysis.togglePause();
        this.get('engine-profile').onchange = event => store.setAnalysis({ profile: event.target.value });
        this.get('book-toggle').onclick = () => store.setAnalysis({ bookEnabled: !store.snapshot().ui.analysis.bookEnabled });
        this.unsubscribeStore = store.subscribe(() => this.render());
        this.unsubscribeAnalysis = analysis.subscribe(() => this.render());
    }
    get(id) { return this.element.querySelector(`#${id}`); }
    render() {
        const game = this.store.snapshot(), state = this.analysis.snapshot(), text = getText(game.ui.language);
        const available = this.analysis.transport.available;
        this.get('engine-analysis').hidden = !available;
        this.get('engine-settings').hidden = !available;
        if (!available) return;
        this.get('engine-empty').hidden = true;
        const statuses = { searching: text.engineSearching, starting: text.engineStarting, complete: text.engineComplete,
            paused: text.enginePaused, background: text.engineBackground, preview: text.preview, terminal: text.engineTerminal, error: text.engineError };
        const statusText = statuses[state.status] || text.engine;
        // Streaming PVs must not repeatedly announce an unchanged live status.
        if (this.get('engine-status').textContent !== statusText) this.get('engine-status').textContent = statusText;
        this.get('engine-status').dataset.state = state.status;
        this.get('engine-analysis').dataset.fen = state.fen || '';
        this.get('engine-analysis').dataset.request = state.id || '';
        const resume = ['paused', 'error', 'complete', 'terminal'].includes(state.status);
        const pause = this.get('engine-pause');
        const caption = state.status === 'error' ? text.engineRetry : resume ? text.engineResume : text.enginePause;
        let icon = pause.querySelector('svg'), label = pause.querySelector('span');
        if (!icon) {
            icon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
            icon.setAttribute('viewBox', '0 0 20 20'); icon.setAttribute('aria-hidden', 'true');
            icon.append(document.createElementNS(icon.namespaceURI, 'path'));
            label = document.createElement('span'); pause.replaceChildren(icon, label);
        }
        const shape = icon.firstChild;
        shape.setAttribute('d', resume ? 'M5 2 17 10 5 18Z' : 'M4 3H8V17H4ZM12 3H16V17H12Z');
        label.textContent = caption;
        pause.setAttribute('aria-label', state.status === 'error' ? text.engineRetry : resume ? text.engineResume : text.enginePause);
        pause.disabled = ['starting', 'background', 'preview'].includes(state.status);
        pause.setAttribute('aria-pressed', String(state.status === 'paused'));
        this.get('engine-profile-label').textContent = text.engineProfile;
        this.get('engine-profile').value = game.ui.analysis.profile;
        this.get('engine-unlimited-hint').hidden = game.ui.analysis.profile !== 'unlimited';
        if (this.language !== game.ui.language) {
            this.language = game.ui.language;
            for (const option of this.get('engine-profile').options) {
                const profile = PROFILES[option.value];
                const depth = profile.depth ? ` \u00b7 D${profile.depth}` : '';
                option.textContent = `${text[`profile_${option.value}`]}${depth} \u00b7 ${profile.threads}T / ${profile.hash} MB`;
            }
        }
        this.get('book-toggle').textContent = `${game.ui.analysis.bookEnabled ? '\u2713' : '\u00d7'} ${text.webBook}`;
        this.get('book-toggle').setAttribute('aria-pressed', String(game.ui.analysis.bookEnabled));
        this.get('book-status').textContent = text.webBook;
        const bookStatus = ({ loading: text.bookLoading, error: text.bookError,
            ready: state.book.length ? text.webBook : text.bookEmpty, off: text.bookOff })[state.bookStatus];
        this.get('book-status').title = bookStatus;
        this.get('book-status').setAttribute('aria-label', `${text.webBook}: ${bookStatus}`);
        this.get('book-status').dataset.state = state.bookStatus;
        const showRows = !game.ui.selected && state.fen === game.game.fen;
        this.get('engine-heading').hidden = !showRows;
        this.get('book-status').hidden = !showRows;
        this.get('engine-results').hidden = !showRows;
        this.get('book-results').hidden = !showRows;
        this.rows('engine-results', showRows ? state.rows : [], state.fen, text);
        this.rows('book-results', showRows ? state.book : [], state.fen, text);
    }
    rows(id, rows, fen, text) {
        const container = this.get(id), keep = new Set();
        const selected = this.store.snapshot().ui.suggestion;
        const rowKey = row => `${row.source}-${row.source === 'book' ? row.pv.join(' ') : row.rank}`;
        const display = [...rows];
        // Freeze the selected row AND its PV. A new engine PV at the same rank
        // must not silently change what the highlighted row represents.
        if (selected?.fen === fen && id === `${selected.source}-results`) {
            const index = display.findIndex(row => rowKey(row) === selected.key);
            if (index < 0) display.unshift(selected); else display[index] = selected;
        }
        for (const [index, row] of display.entries()) {
            const key = rowKey(row); keep.add(key);
            let button = [...container.children].find(node => node.dataset.key === key);
            if (!button) {
                button = document.createElement('button'); button.type = 'button';
                button.className = 'analysis-row'; button.dataset.key = key;
                const title = document.createElement('span'); title.className = 'analysis-move';
                button.append(title, document.createElement('strong'), document.createElement('small'));
                // Keep a touched row alive during streaming updates and honor
                // the move the user actually touched, not a later replacement PV.
                button.onpointerdown = () => { button.pressedSuggestion = button.suggestion; };
                button.onpointercancel = () => { button.pressedSuggestion = null; };
                button.onclick = event => {
                    const chosen = event.detail ? button.pressedSuggestion || button.suggestion : button.suggestion;
                    button.pressedSuggestion = null;
                    if (this.store.snapshot().game.fen === chosen.fen) this.store.preview(chosen.move, chosen.pv, chosen);
                };
            }
            const [title, score, pv] = button.children;
            button.suggestion = { ...row, fen, key, pv: [...row.pv] };
            button.setAttribute('aria-pressed', String(selected?.fen === fen && selected.key === key));
            button.dataset.suggestion = row.move; button.dataset.source = row.source;
            title.textContent = row.notation[0];
            const bound = row.bound === 'lowerbound' ? '\u2265' : row.bound === 'upperbound' ? '\u2264' : '';
            score.textContent = row.source === 'book' ? row.note : `${bound}${row.kind === 'mate' ? '#' + row.value : (row.value >= 0 ? '+' : '') + (row.value / 100).toFixed(2)} \u00b7 D${row.depth}`;
            if (row.source === 'book') score.title = row.note;
            if (row.source === 'engine') score.title = text.scoreRed;
            // Opening labels and continuation are independent fields, not fallbacks.
            pv.textContent = row.notation.slice(1).join(' ') || row.move;
            pv.title = row.notation.join(' ');
            button.setAttribute('aria-label', `${text.previewAction}: ${row.notation[0]}, ${row.move}, ${score.textContent}`);
            if (container.children[index] !== button) container.insertBefore(button, container.children[index] || null);
        }
        for (const button of [...container.children]) if (!keep.has(button.dataset.key)) button.remove();
    }
    destroy() { this.unsubscribeStore(); this.unsubscribeAnalysis(); }
}
