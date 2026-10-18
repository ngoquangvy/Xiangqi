import { LocalGame } from '../domain/LocalGame.js';
import { moveSound } from '../../../src/presentation/GameSound.js';
import { analysisSettings } from '../analysis/settings.js';
import { positionStatus } from '../domain/positionStatus.js';
import { PREVIEW_LINE_LIMIT } from '../domain/lineLimits.js';
import { PositionDraft } from '../domain/PositionDraft.js';

export class AppStore {
    #game;
    #listeners = new Set();
    #moveListeners = new Set();
    #storage;
    #saveRevision = 0;
    #preview = null;
    #pending = null;
    #editor = null;
    #ui = { selected: null, suggestion: null, helpOpen: false, previewHelpSeen: false,
        expanded: false, flipped: false, tab: 'analysis', storageError: null, language: 'vi', soundEnabled: true, analysis: analysisSettings(), saving: false };
    constructor(storage, game = new LocalGame()) {
        this.#storage = storage;
        this.#game = game;
        const { data, error } = storage.load();
        this.#ui.storageError = error;
        if (data) {
            if (game.restore(data.game)) {
                this.#ui.flipped = data.flipped;
                this.#ui.language = data.language;
                this.#ui.soundEnabled = data.soundEnabled;
                this.#ui.analysis = analysisSettings(data.analysis);
                this.#ui.previewHelpSeen = data.previewHelpSeen === true;
            }
            else this.#ui.storageError = 'invalid-save';
        }
    }
    subscribe(callback) {
        this.#listeners.add(callback);
        callback(this.snapshot());
        return () => this.#listeners.delete(callback);
    }
    onMove(callback) {
        this.#moveListeners.add(callback);
        return () => this.#moveListeners.delete(callback);
    }
    analysisPosition() { return this.#game.analysisPosition(); }
    setAnalysis(settings) {
        this.#ui.analysis = analysisSettings({ ...this.#ui.analysis, ...settings });
        this.#notify(true);
    }
    #didMove() {
        this.#clearTransient();
        this.#notify(true);
        const sound = moveSound(this.#game.snapshot());
        for (const callback of this.#moveListeners) callback(sound);
    }
    snapshot() {
        const game = this.#game.snapshot();
        const ui = { ...structuredClone(this.#ui), setup: this.#editor?.snapshot() || null, preview: this.#preview?.snapshot() || null,
            pending: this.#pending ? { uci: this.#pending.uci, length: this.#pending.pv.length } : null };
        return { game, ui, board: ui.preview?.board || game.board,
            turn: ui.preview?.turn || game.currentTurn,
            lastMove: ui.preview ? ui.preview.lastMove : game.lastMove,
            ...positionStatus(ui.preview || game),
            suggestionMove: this.#pending ? structuredClone(this.#pending.firstMove) : ui.preview?.firstMoveHighlight || null,
            legalMoves: ui.selected ? this.#game.legalMoves(ui.selected.x, ui.selected.y) : [],
            boardLocked: (ui.expanded && !ui.pending) || Boolean(ui.preview) };
    }
    #notify(persist = false) {
        if (persist) {
            const revision = ++this.#saveRevision;
            const result = this.#storage.save(this.#game.serialize(), this.#ui.flipped, this.#ui.language, this.#ui.soundEnabled, this.#ui.analysis, this.#ui.previewHelpSeen);
            this.#ui.saving = Boolean(result?.then);
            if (result?.then) result.then(error => {
                // Earlier writes cannot clear the pending state of a newer mutation.
                if (revision !== this.#saveRevision) return;
                this.#ui.saving = false;
                this.#ui.storageError = error;
                this.#notify();
            });
            else this.#ui.storageError = result;
        }
        const state = this.snapshot();
        // Each subscriber owns its copy; a view cannot corrupt another view's state.
        for (const callback of this.#listeners) callback(structuredClone(state));
    }
    #clearTransient() {
        this.#ui.selected = null; this.#ui.suggestion = null;
        this.#ui.helpOpen = false; this.#preview = null; this.#pending = null;
    }
    togglePreviewHelp() { this.#ui.helpOpen = !this.#ui.helpOpen; this.#notify(); }
    completePreviewHelp() {
        const changed = !this.#ui.previewHelpSeen;
        if (!changed && !this.#ui.helpOpen) return;
        this.#ui.helpOpen = false; this.#ui.previewHelpSeen = true;
        // Persist the tutorial preference with the LIVE game, never the scratch board.
        this.#notify(changed);
    }
    tap(x, y, confirmBranch = false) {
        if (!Number.isInteger(x) || !Number.isInteger(y) || x < 0 || x > 8 || y < 0 || y > 9) return 'locked';
        if (this.#editor) { this.#editor.tap(x, y); this.#notify(); return 'setup'; }
        // The first touch exits the scratch position only. Never interpret its
        // coordinates against the different live board or commit a suggestion.
        if (this.#preview) {
            this.#ui.expanded = false;
            this.cancelPreview();
            return 'preview-cancelled';
        }
        // A highlighted row is not a scratch board. Clear its markers, then
        // interpret this SAME touch against the live position (no wasted tap).
        if (this.#pending) { this.#clearTransient(); this.#ui.expanded = false; }
        const state = this.snapshot();
        if (state.boardLocked) return 'locked';
        const selected = this.#ui.selected;
        const destination = state.legalMoves.find(move => move.x === x && move.y === y);
        if (selected && destination) {
            if (state.game.currentMoveIndex < state.game.moveHistory.length - 1 && !confirmBranch) return 'confirm-branch';
            if (!this.#game.move(selected.x, selected.y, x, y)) return 'illegal';
            this.#didMove();
            return 'moved';
        }
        if (state.game.board[y][x]?.color === state.game.currentTurn) {
            this.#ui.selected = selected?.x === x && selected?.y === y ? null : { x, y };
        } else this.#ui.selected = null;
        this.#notify();
        return 'selected';
    }
    navigate(action, index) {
        if (this.#editor) return false;
        if (!['undo', 'redo', 'goTo'].includes(action)) return false;
        const changed = this.#game[action](index);
        if (!changed) return false;
        this.#clearTransient();
        this.#notify(true);
        return true;
    }
    toggleExpanded() {
        if (this.#editor) return;
        this.#ui.expanded = !this.#ui.expanded;
        this.#notify();
    }
    setTab(tab) {
        if (!['analysis', 'history'].includes(tab)) return;
        this.#ui.tab = tab;
        this.#ui.helpOpen = false;
        this.#notify();
    }
    flip() { this.#ui.flipped = !this.#ui.flipped; this.#notify(true); }
    toggleSound() { this.#ui.soundEnabled = !this.#ui.soundEnabled; this.#notify(true); }
    setLanguage(language) {
        if (!['en', 'vi'].includes(language)) return false;
        this.#ui.language = language;
        this.#notify(true);
        return true;
    }
    reset() {
        this.#editor = null;
        this.#game.reset();
        this.#clearTransient();
        this.#ui.expanded = false;
        this.#notify(true);
    }
    preview(uci, pv = [uci], suggestion = null) {
        if (this.#editor) return false;
        const preview = this.#game.preview(uci, pv);
        if (!preview) return false;
        this.#preview = preview;
        this.#pending = null;
        this.#ui.selected = null;
        this.#ui.suggestion = suggestion ? structuredClone(suggestion) : null;
        this.#ui.helpOpen = !this.#ui.previewHelpSeen;
        this.#notify();
        return true;
    }
    cancelPreview() { this.#clearTransient(); this.#notify(); }
    selectSuggestion(uci, pv = [uci], suggestion = null) {
        if (this.#editor) return false;
        if (!Array.isArray(pv) || pv[0] !== uci) return false;
        const first = this.#game.preview(uci, [uci]);
        if (!first) return false;
        this.#preview = null;
        this.#pending = { uci, pv: pv.slice(0, PREVIEW_LINE_LIMIT), firstMove: first.snapshot().firstMoveHighlight };
        this.#ui.selected = null;
        this.#ui.suggestion = suggestion ? structuredClone(suggestion) : null;
        this.#ui.helpOpen = !this.#ui.previewHelpSeen;
        this.#notify();
        return true;
    }
    stepPreview(direction) {
        if (this.#pending) {
            if (direction !== 1) return false;
            const preview = this.#game.preview(this.#pending.uci, this.#pending.pv);
            if (!preview?.step(1)) return false;
            this.#pending = null; this.#preview = preview;
            this.#notify(); return true;
        }
        if (!this.#preview?.step(direction)) return false;
        this.#notify();
        return true;
    }
    applyPreview(confirmBranch = false) {
        const state = this.snapshot();
        if (!state.ui.preview || state.ui.preview.cursor !== 1) return false;
        if (state.game.currentMoveIndex < state.game.moveHistory.length - 1 && !confirmBranch) return 'confirm-branch';
        if (!this.#game.applyPreview(state.ui.preview)) return false;
        this.#ui.expanded = false;
        this.#didMove();
        return true;
    }
    saveNote(text) {
        if (this.#editor) return false;
        const index = this.#game.snapshot().currentMoveIndex;
        if (typeof text !== 'string' || text.length > 2000 || !this.#game.note(index, text)) return false;
        this.#notify(true);
        return true;
    }
    beginSetup() {
        if (this.#editor) return;
        this.#editor = new PositionDraft(this.#game.snapshot());
        this.#clearTransient(); this.#ui.expanded = false; this.#notify();
    }
    editSetup(action, value) {
        if (this.#editor?.edit(action, value)) this.#notify();
    }
    endSetup(apply = false) {
        if (!this.#editor) return false;
        if (apply && (this.#editor.validate() || !this.#game.importPosition(this.#editor.fen()))) return false;
        this.#editor = null; this.#clearTransient(); this.#notify(apply); return true;
    }
    back() {
        if (this.#editor) { this.endSetup(); return true; }
        if (this.#ui.helpOpen) { this.togglePreviewHelp(); return true; }
        if (this.#preview || this.#pending) { this.cancelPreview(); return true; }
        if (this.#ui.expanded) { this.toggleExpanded(); return true; }
        if (this.#ui.selected) { this.cancelPreview(); return true; }
        return false;
    }
}
