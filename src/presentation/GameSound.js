const FILES = { move: 'sidestick.wav', capture: 'capture.mp3', check: 'check.mp3' };

// Classify a committed core snapshot, never a visual board diff or preview.
// A checking capture uses one sound (check), rather than overlapping two clips.
export function moveSound(state) {
    const move = state?.moveHistory?.[state.currentMoveIndex];
    if (!move) return null;
    return state.isCheck ? 'check' : move.capturedPiece ? 'capture' : 'move';
}

export class GameSound {
    #clips = new Map();
    #active = null;
    #enabled = true;
    constructor(baseUrl, createAudio = url => new Audio(url)) {
        this.baseUrl = baseUrl;
        this.createAudio = createAudio;
    }
    get enabled() { return this.#enabled; }
    setEnabled(enabled) {
        this.#enabled = Boolean(enabled);
        if (!this.#enabled) this.stop();
    }
    stop() {
        if (!this.#active) return;
        this.#active.pause();
        this.#active.currentTime = 0;
        this.#active = null;
    }
    async play(kind) {
        if (!this.#enabled || !Object.hasOwn(FILES, kind)) return false;
        try {
            this.stop();
            if (!this.#clips.has(kind)) this.#clips.set(kind, this.createAudio(this.baseUrl + FILES[kind]));
            const clip = this.#clips.get(kind);
            clip.currentTime = 0;
            this.#active = clip;
            await clip.play();
            return true;
        } catch {
            // Autoplay restrictions, missing files or audio-device failures must
            // never reject a legal move. Do not replay blocked sounds later.
            return false;
        }
    }
    destroy() {
        this.stop();
        for (const clip of this.#clips.values()) { clip.removeAttribute('src'); clip.load(); }
        this.#clips.clear();
    }
}
