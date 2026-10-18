import { SETUP_PIECES, setupPiece } from '../domain/PositionDraft.js';
import { getText, pieceName } from './strings.js';

export function setupBoardState(state) {
    const draft = state.ui.setup;
    if (!draft) return state;
    return { ...state, board: draft.board, turn: draft.turn, boardLocked: false,
        ui: { ...state.ui, selected: draft.selected }, legalMoves: [],
        checkedKing: null, winner: null, lastMove: null, suggestionMove: null };
}

export class SetupView {
    constructor(element, store, confirm) {
        this.element = element; this.store = store;
        this.get('setup-position').onclick = () => store.beginSetup();
        this.get('setup-cancel').onclick = () => store.endSetup();
        this.get('setup-apply').onclick = () => confirm(() => store.endSetup(true));
        for (const button of element.querySelectorAll('[data-setup-action]')) {
            button.onclick = () => store.editSetup(button.dataset.setupAction, button.dataset.value);
        }
        this.get('setup-turn').onchange = event => store.editSetup('turn', event.target.value);
        for (const type of SETUP_PIECES) {
            const button = document.createElement('button'); button.type = 'button'; button.dataset.type = type;
            button.className = 'setup-piece chess-piece';
            button.onclick = () => store.editSetup('tool', type);
            this.get('setup-palette').append(button);
        }
        this.unsubscribe = store.subscribe(state => this.render(state));
    }
    get(id) { return this.element.querySelector(`#${id}`); }
    render(state) {
        const draft = state.ui.setup, text = getText(state.ui.language);
        this.element.classList.toggle('setting-up', Boolean(draft));
        this.get('position-editor').hidden = !draft;
        if (!draft) return;
        this.get('setup-turn').value = draft.turn;
        this.get('setup-apply').disabled = Boolean(draft.error);
        this.get('setup-validation').textContent = text[draft.notice || draft.error || 'setupReady'];
        this.get('setup-validation').dataset.valid = String(!draft.error && !draft.notice);
        for (const button of this.element.querySelectorAll('[data-setup-action]')) {
            if (!['color', 'tool'].includes(button.dataset.setupAction)) continue;
            const selected = draft[button.dataset.setupAction] === button.dataset.value;
            button.setAttribute('aria-pressed', String(selected));
        }
        for (const button of this.get('setup-palette').children) {
            const piece = setupPiece(button.dataset.type, draft.color);
            button.textContent = piece.name; button.dataset.side = draft.color;
            button.disabled = draft.remaining[button.dataset.type] === 0;
            button.title = `${draft.remaining[button.dataset.type]}`;
            button.setAttribute('aria-label', `${pieceName(piece.name, state.ui.language)} ${text[draft.color]}`);
            button.setAttribute('aria-pressed', String(button.dataset.type === draft.tool));
        }
    }
    destroy() { this.unsubscribe(); }
}
