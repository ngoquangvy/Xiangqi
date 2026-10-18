import { parseInfo, engineRow, bookRows } from './results.js';
import { SearchScheduler } from './SearchScheduler.js';

// Engine state is derived from committed core positions, never from board DOM.
export class AnalysisController {
    #listeners = new Set();
    #sequence = 0;
    #session = globalThis.crypto?.randomUUID?.() || `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
    #bookSequence = 0;
    #paused = false;
    #foreground = true;
    #enabled = true;
    #destroyed = false;
    #ready = false;
    #engineKey;
    #positionKey;
    #bookKey;
    #position;
    #snapshot;
    #removeTransport;
    #thermal = { state: 'nominal', limited: false, blocked: false, revision: -1 };
    #state = { status: 'unavailable', id: null, fen: null, rows: [], book: [], bookStatus: 'off' };
    constructor(store, transport, { delayMs = 500, clock = globalThis, enabled = true } = {}) {
        this.store = store; this.transport = transport;
        this.#enabled = enabled;
        this.scheduler = new SearchScheduler(delayMs, clock);
        this.#state.status = transport.available ? 'starting' : 'unavailable';
        this.unsubscribe = store.subscribe(state => {
            this.#snapshot = state; this.#position = store.analysisPosition(); this.#refresh();
        });
        this.started = this.#start();
    }
    async #start() {
        if (!this.transport.available) return;
        try {
            const remove = await this.transport.listen(event => this.#output(event), event => this.#fail(event.id), event => this.setThermal(event));
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
        const blocked = !this.#enabled ? 'inactive' : !this.#foreground ? 'background' : state.ui.setup ? 'setup'
            : state.ui.preview ? 'preview' : this.#paused ? 'paused' : this.#thermal.blocked ? 'thermal' : null;
        const engineKey = `${positionKey}|${profile}|${blocked}|${this.#thermal.limited}`;
        if (engineKey !== this.#engineKey) {
            const initial = this.#engineKey === undefined;
            this.scheduler.cancel();
            const id = `${this.#session}-${++this.#sequence}`;
            const changedPosition = this.#positionKey !== positionKey;
            if (changedPosition || this.#state.profile !== profile) this.#state.rows = [];
            this.#engineKey = engineKey;
            this.#positionKey = positionKey;
            Object.assign(this.#state, { id, fen: position.fen, profile, status: blocked || 'waiting' });
            this.#notify();
            // Native also serializes stop -> bestmove -> readyok -> next go.
            // IDs are invalidated here immediately, not after an async round trip.
            if (blocked || (!initial && this.scheduler.delay > 0)) {
                Promise.resolve(this.transport.stop()).catch(() => this.#fail(id));
            }
            if (!blocked) this.scheduler.schedule(() => {
                if (this.#destroyed || this.#state.id !== id) return;
                this.#state.status = 'searching'; this.#notify();
                Promise.resolve(this.transport.analyze({ id, ...position, profile })).catch(() => this.#fail(id));
            }, initial);
        }
        const bookEnabled = this.#enabled && !state.ui.setup && state.ui.analysis.bookEnabled;
        const bookKey = `${positionKey}|${bookEnabled}`;
        if (bookKey !== this.#bookKey) {
            this.#bookKey = bookKey;
            const version = ++this.#bookSequence;
            this.#state.book = [];
            this.#state.bookStatus = !bookEnabled ? 'off' : 'loading';
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
        if (this.#destroyed || this.#state.id !== id || !['waiting', 'searching', 'complete'].includes(this.#state.status)) return;
        this.scheduler.cancel();
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
    setEnabled(active) {
        this.#enabled = Boolean(active);
        if (active && !this.#ready && this.transport.available && this.#state.status === 'error') {
            this.#state.status = 'starting'; this.#notify(); this.started = this.#start(); return;
        }
        this.#refresh();
    }
    setThermal(value) {
        if (this.#destroyed || !value || value.revision < this.#thermal.revision) return;
        const previous = this.#thermal;
        this.#thermal = { state: value.state, blocked: value.blocked === true, limited: value.limited === true, revision: value.revision };
        if (previous.blocked === this.#thermal.blocked && previous.limited === this.#thermal.limited && previous.state === value.state) return;
        this.#state.thermal = { ...this.#thermal };
        this.#refresh(); this.#notify();
    }
    destroy() {
        this.#destroyed = true; ++this.#sequence; ++this.#bookSequence;
        this.scheduler.cancel();
        this.unsubscribe(); this.#listeners.clear();
        Promise.resolve(this.#removeTransport?.()).catch(() => {});
        Promise.resolve(this.transport.stop()).catch(() => {});
    }
}
