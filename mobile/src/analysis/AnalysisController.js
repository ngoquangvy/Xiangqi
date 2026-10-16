import { parseInfo, engineRow, bookRows } from './results.js';

// Engine state is derived from committed core positions, never from board DOM.
export class AnalysisController {
    #listeners = new Set();
    #sequence = 0;
    #session = globalThis.crypto?.randomUUID?.() || `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
    #bookSequence = 0;
    #paused = false;
    #foreground = true;
    #destroyed = false;
    #ready = false;
    #engineKey;
    #positionKey;
    #bookKey;
    #position;
    #snapshot;
    #removeTransport;
    #state = { status: 'unavailable', id: null, fen: null, rows: [], book: [], bookStatus: 'off' };
    constructor(store, transport) {
        this.store = store; this.transport = transport;
        this.#state.status = transport.available ? 'starting' : 'unavailable';
        this.unsubscribe = store.subscribe(state => {
            this.#snapshot = state; this.#position = store.analysisPosition(); this.#refresh();
        });
        this.started = this.#start();
    }
    async #start() {
        if (!this.transport.available) return;
        try {
            const remove = await this.transport.listen(event => this.#output(event), event => this.#fail(event.id));
            if (this.#destroyed) { await remove(); return; }
            this.#removeTransport = remove; this.#ready = true; this.#refresh();
        } catch { if (!this.#destroyed) { this.#state.status = 'error'; this.#notify(); } }
    }
    subscribe(callback) { this.#listeners.add(callback); callback(this.snapshot()); return () => this.#listeners.delete(callback); }
    snapshot() { return structuredClone(this.#state); }
    #notify() { for (const callback of this.#listeners) callback(this.snapshot()); }
    #refresh() {
        if (this.#destroyed || !this.#ready || !this.#snapshot) return;
        const state = this.#snapshot, position = this.#position;
        const profile = state.ui.analysis.profile;
        const positionKey = `${position.initialFen}|${position.moves}`;
        const blocked = !this.#foreground ? 'background' : state.ui.preview ? 'preview' : this.#paused ? 'paused' : null;
        const engineKey = `${positionKey}|${profile}|${blocked}`;
        if (engineKey !== this.#engineKey) {
            const id = `${this.#session}-${++this.#sequence}`;
            const changedPosition = this.#positionKey !== positionKey;
            if (changedPosition || this.#state.profile !== profile) this.#state.rows = [];
            this.#engineKey = engineKey;
            this.#positionKey = positionKey;
            Object.assign(this.#state, { id, fen: position.fen, profile, status: blocked || 'searching' });
            this.#notify();
            // Native also serializes stop -> bestmove -> readyok -> next go.
            // IDs are invalidated here immediately, not after an async round trip.
            const action = blocked ? this.transport.stop() : this.transport.analyze({ id, ...position, profile });
            Promise.resolve(action).catch(() => this.#fail(id));
        }
        const bookKey = `${positionKey}|${state.ui.analysis.bookEnabled}`;
        if (bookKey !== this.#bookKey) {
            this.#bookKey = bookKey;
            const version = ++this.#bookSequence;
            this.#state.book = [];
            this.#state.bookStatus = !state.ui.analysis.bookEnabled ? 'off' : 'loading';
            this.#notify();
            if (this.#state.bookStatus === 'loading') Promise.resolve(this.transport.lookupBook(position.fen)).then(rows => {
                if (this.#destroyed || version !== this.#bookSequence) return;
                this.#state.book = bookRows(position.fen, rows); this.#state.bookStatus = 'ready'; this.#notify();
            }).catch(() => {
                if (this.#destroyed || version !== this.#bookSequence) return;
                this.#state.bookStatus = 'error'; this.#notify();
            });
        }
    }
    #output(event) {
        if (this.#destroyed || event.id !== this.#state.id || this.#state.status !== 'searching') return;
        if (event.line?.startsWith('bestmove ')) {
            const terminal = /^bestmove (0000|\(none\))(?:\s|$)/.test(event.line);
            this.#state.status = terminal ? 'terminal' : 'complete';
            if (terminal) this.#state.rows = [];
            this.#notify(); return;
        }
        const parsed = parseInfo(event.line);
        if (!parsed) return;
        const row = engineRow(this.#state.fen, parsed);
        if (!row) return;
        const rows = this.#state.rows.filter(previous => previous.rank !== row.rank);
        const previous = this.#state.rows.find(previous => previous.rank === row.rank);
        if (previous && previous.depth > row.depth) return;
        this.#state.rows = [...rows, row].sort((a, b) => a.rank - b.rank); this.#notify();
    }
    #fail(id) {
        if (this.#destroyed || this.#state.id !== id || !['searching', 'complete'].includes(this.#state.status)) return;
        this.#state.status = 'error'; this.#notify();
    }
    togglePause() {
        if (!this.#ready && this.transport.available) {
            this.#state.status = 'starting'; this.#notify(); this.started = this.#start(); return;
        }
        if (['error', 'complete', 'terminal'].includes(this.#state.status)) { this.#engineKey = null; this.#paused = false; }
        else this.#paused = !this.#paused;
        this.#refresh();
    }
    setForeground(active) { this.#foreground = Boolean(active); this.#refresh(); }
    destroy() {
        this.#destroyed = true; ++this.#sequence; ++this.#bookSequence;
        this.unsubscribe(); this.#listeners.clear();
        Promise.resolve(this.#removeTransport?.()).catch(() => {});
        Promise.resolve(this.transport.stop()).catch(() => {});
    }
}
