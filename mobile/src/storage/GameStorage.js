import { analysisSettings } from '../analysis/settings.js';
const KEY = 'xiangqi.mobile.session.v1';
export const MAX_SAVE_BYTES = 512 * 1024;

export class GameStorage {
    constructor(storage) { this.storage = storage; }
    load() {
        try {
            const raw = this.storage.getItem(KEY);
            if (!raw) return { data: null, error: null };
            if (new TextEncoder().encode(raw).length > MAX_SAVE_BYTES) throw new Error('size');
            const data = JSON.parse(raw);
            if (data?.version !== 1 || typeof data.game !== 'string' || typeof data.flipped !== 'boolean') throw new Error('schema');
            return { data: { ...data, language: data.language === 'en' ? 'en' : 'vi', soundEnabled: data.soundEnabled !== false,
                analysis: analysisSettings(data.analysis) }, error: null };
        } catch { return { data: null, error: 'invalid-save' }; }
    }
    save(game, flipped, language = 'vi', soundEnabled = true, analysis, previewHelpSeen = false) {
        try {
            const raw = JSON.stringify({ version: 1, game, flipped, language, soundEnabled, analysis: analysisSettings(analysis), previewHelpSeen });
            if (new TextEncoder().encode(raw).length > MAX_SAVE_BYTES) return 'save-too-large';
            const write = () => this.storage.setItem(KEY, raw);
            if (this.pendingWrite) {
                this.pendingWrite = this.pendingWrite.then(write).then(() => null, () => 'save-failed');
                return this.pendingWrite;
            }
            const result = write();
            if (result?.then) {
                this.pendingWrite = Promise.resolve(result).then(() => null, () => 'save-failed');
                return this.pendingWrite;
            }
            return null;
        } catch { return 'save-failed'; }
    }
}
