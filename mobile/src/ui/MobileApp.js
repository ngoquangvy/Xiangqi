import { BoardView } from './BoardView.js';
import { HistoryView } from './HistoryView.js';
import { getText } from './strings.js';
import { SoundControl } from './SoundControl.js';
import { PreviewHelp } from './PreviewHelp.js';

export class MobileApp {
    constructor(element, store) {
        this.element = element;
        this.store = store;
        this.noteIndex = null;
        this.confirmAction = null;
        this.toastTimer = null;
        this.copy = getText(store.snapshot().ui.language);
        this.board = new BoardView(this.get('board'), (x, y) => this.tap(x, y));
        this.history = new HistoryView(this.get('history-list'), index => store.navigate('goTo', index));
        this.sound = new SoundControl(this.get('sound-toggle'), store);
        // One control row, two explicit modes. Preview never commits a move.
        this.get('undo').onclick = () => store.snapshot().ui.preview ? store.stepPreview(-1) : store.navigate('undo');
        this.get('redo').onclick = () => {
            if (!store.snapshot().ui.preview && !store.snapshot().ui.pending) return store.navigate('redo');
            if (store.stepPreview(1)) store.completePreviewHelp();
        };
        this.get('flip').onclick = () => store.flip();
        this.get('language').onclick = () => store.setLanguage(store.snapshot().ui.language === 'vi' ? 'en' : 'vi');
        this.get('expand').onclick = () => store.toggleExpanded();
        this.get('new-game').onclick = () => this.confirm('new', () => store.reset());
        this.get('cancel-preview').onclick = () => store.cancelPreview();
        for (const tab of element.querySelectorAll('[data-tab]')) tab.onclick = () => store.setTab(tab.dataset.tab);
        this.get('note-form').onsubmit = event => {
            event.preventDefault();
            const saved = store.saveNote(this.get('note').value);
            this.toast(saved ? (store.snapshot().ui.saving ? 'saving' : 'saveOK') : 'saveNoteError');
        };
        this.get('confirm-accept').onclick = () => {
            const action = this.confirmAction;
            this.closeDialog();
            action?.();
        };
        this.get('confirm-cancel').onclick = () => this.closeDialog();
        this.get('confirm-dialog').addEventListener('cancel', () => { this.confirmAction = null; });
        this.unsubscribe = store.subscribe(state => this.render(state));
        this.help = new PreviewHelp(element, store);
    }
    get(id) { return this.element.querySelector(`#${id}`); }
    tap(x, y) {
        if (this.store.tap(x, y) === 'confirm-branch') this.confirm('branch', () => this.store.tap(x, y, true));
    }
    confirm(kind, action) {
        const text = this.copy;
        this.confirmAction = action;
        this.get('confirm-title').textContent = kind === 'new' ? text.confirmNew : text.confirmBranch;
        this.get('confirm-body').textContent = kind === 'new' ? text.confirmNewBody : text.confirmBranchBody;
        this.get('confirm-dialog').showModal();
    }
    closeDialog() {
        this.confirmAction = null;
        this.get('confirm-dialog').close();
    }
    back() {
        if (this.get('confirm-dialog').open) { this.closeDialog(); return true; }
        if (this.store.snapshot().ui.helpOpen) return this.store.back();
        // Keep preview cancellation first; an open note editor then consumes
        // Back before the panel collapses or Android exits the application.
        if (!this.store.snapshot().ui.preview && !this.get('panel-history').hidden && this.get('note-editor').open) {
            this.get('note-editor').open = false;
            return true;
        }
        return this.store.back();
    }
    toast(key) {
        clearTimeout(this.toastTimer);
        this.toastKey = key;
        this.get('toast').textContent = this.copy[key];
        this.get('toast').hidden = false;
        this.toastTimer = setTimeout(() => { this.get('toast').hidden = true; }, 2500);
    }
    render(state) {
        const text = this.copy = getText(state.ui.language);
        document.documentElement.lang = state.ui.language;
        document.title = text.title + ' Mobile';
        for (const node of this.element.querySelectorAll('[data-text]')) node.textContent = text[node.dataset.text];
        for (const node of this.element.querySelectorAll('[data-label]')) node.setAttribute('aria-label', text[node.dataset.label]);
        this.get('language').setAttribute('aria-label', text.languageToggle);
        this.get('language').setAttribute('title', text.languageToggle);
        if (this.toastKey === 'saving' && !state.ui.saving) this.toastKey = state.ui.storageError ? 'saveNoteError' : 'saveOK';
        if (this.toastKey) this.get('toast').textContent = text[this.toastKey];
        this.element.classList.toggle('expanded', state.ui.expanded);
        this.element.classList.toggle('previewing', Boolean(state.ui.preview));
        this.element.classList.toggle('suggestion-selected', Boolean(state.ui.pending));
        this.board.render(state);
        const turn = this.get('turn-label'), winner = this.get('winner-label');
        const side = state.winner || state.turn;
        turn.dataset.side = side; turn.dataset.result = state.winner ? 'win' : 'turn';
        const label = state.winner ? text[`${side}Win`] : `${text[side]} ${text.turn}${state.checkedKing ? ', ' + text.check : ''}`;
        if (turn.getAttribute('aria-label') !== label) turn.setAttribute('aria-label', label);
        winner.hidden = !state.winner; winner.textContent = state.winner ? text[`${side}Win`] : '';
        this.get('position-label').textContent = state.ui.pending ? text.suggestionSelected : state.ui.preview ? text.preview
            : state.game.currentMoveIndex < 0 ? text.initial : `${text.move} ${state.game.currentMoveIndex + 1}/${state.game.moveHistory.length}`;
        this.get('expand-label').textContent = state.ui.expanded ? text.collapse : text.expand;
        this.get('expand').title = state.ui.expanded ? text.collapse : text.expand;
        this.get('expand').setAttribute('aria-expanded', String(state.ui.expanded));
        this.get('expand-icon').textContent = state.ui.expanded ? '\u2199' : '\u2197';
        const preview = state.ui.preview || (state.ui.pending ? { cursor: 0, length: state.ui.pending.length } : null);
        this.element.querySelector('.board-actions').dataset.mode = preview ? 'preview' : 'game';
        this.element.querySelector('.board-actions').setAttribute('aria-label', preview ? text.previewNavigation : text.controlsRegion);
        this.get('undo').disabled = preview ? preview.cursor === 0 : state.game.currentMoveIndex < 0;
        this.get('redo').disabled = preview ? preview.cursor === preview.length : state.game.currentMoveIndex >= state.game.moveHistory.length - 1;
        this.get('undo').setAttribute('aria-label', preview ? text.previewPrevious : text.undo);
        this.get('redo').setAttribute('aria-label', preview ? text.previewNext : text.redo);
        for (const button of [this.get('undo'), this.get('redo')]) button.querySelector('[data-text]').hidden = Boolean(preview);
        // Keep New game reachable in both modes without crowding preview navigation.
        this.get('new-game').querySelector('[data-text]').hidden = Boolean(preview);
        this.get('cancel-preview').hidden = !preview;
        this.get('preview-position').hidden = !preview;
        this.get('preview-position').textContent = preview ? `${preview.cursor} / ${preview.length}` : '';
        for (const tab of this.element.querySelectorAll('[data-tab]')) {
            const active = tab.dataset.tab === state.ui.tab;
            tab.setAttribute('aria-selected', String(active));
            this.get(`panel-${tab.dataset.tab}`).hidden = !active;
        }
        this.history.render(state);
        this.renderLegal(state);
        const note = state.game.moveHistory[state.game.currentMoveIndex]?.note || '';
        // Do not overwrite an unsaved draft just because the user expands/flips the board.
        if (this.noteIndex !== state.game.currentMoveIndex || this.savedNote !== note) this.get('note').value = note;
        this.noteIndex = state.game.currentMoveIndex;
        this.savedNote = note;
        this.get('note').disabled = state.game.currentMoveIndex < 0;
        this.get('save-note').disabled = state.game.currentMoveIndex < 0;
        const warnings = { 'invalid-save': text.restoreWarning, 'save-failed': text.saveWarning, 'save-too-large': text.sizeWarning };
        this.get('save-status').textContent = state.ui.saving ? text.saving : warnings[state.ui.storageError] || text.localSave;
        this.element.querySelector('.footer').classList.toggle('warning', Boolean(state.ui.storageError));
    }
    renderLegal(state) {
        const text = this.copy;
        this.get('legal-heading').hidden = !state.ui.selected;
        this.get('engine-empty').hidden = Boolean(state.ui.selected || state.ui.preview);
        this.get('legal-count').textContent = String(state.legalMoves.length);
        const fragment = document.createDocumentFragment();
        for (const move of state.legalMoves) {
            const button = document.createElement('button');
            button.type = 'button'; button.dataset.uci = move.uci;
            button.append(document.createTextNode(move.notation));
            // Visible rows stay one line; accessibility retains the action and UCI.
            button.setAttribute('aria-label', `${text.previewAction}: ${move.notation}, ${move.uci}`);
            const small = document.createElement('small'); small.textContent = move.uci;
            button.append(small); button.onclick = () => this.store.selectSuggestion(move.uci);
            fragment.append(button);
        }
        this.get('legal-moves').replaceChildren(fragment);
    }
    destroy() { this.unsubscribe(); this.sound.destroy(); this.help.destroy(); clearTimeout(this.toastTimer); }
}
