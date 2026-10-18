// Invalidate old output and stop old work immediately; delay only startup.
export class SearchScheduler {
    constructor(delay = 500, clock = globalThis) { this.delay = delay; this.clock = clock; }
    cancel() { if (this.timer != null) this.clock.clearTimeout(this.timer); this.timer = null; }
    schedule(callback, immediate = false) {
        this.cancel();
        if (immediate || this.delay === 0) { callback(); return; }
        this.timer = this.clock.setTimeout(() => { this.timer = null; callback(); }, this.delay);
    }
}
