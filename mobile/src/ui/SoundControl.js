import { GameSound } from '../../../src/presentation/GameSound.js';
import { getText } from './strings.js';

// The store owns the preference; the player only owns disposable audio resources.
export class SoundControl {
    constructor(button, store) {
        this.player = new GameSound('sounds/');
        button.onclick = () => store.toggleSound();
        this.unsubscribe = store.subscribe(({ ui }) => {
            this.player.setEnabled(ui.soundEnabled);
            const text = getText(ui.language);
            button.setAttribute('aria-pressed', String(ui.soundEnabled));
            button.setAttribute('aria-label', ui.soundEnabled ? text.soundOn : text.soundOff);
            button.title = ui.soundEnabled ? text.muteSound : text.enableSound;
            button.querySelector('[data-sound-label]').textContent = ui.soundEnabled ? text.soundOn : text.soundOff;
        });
        this.unsubscribeMove = store.onMove(kind => { void this.player.play(kind); });
        this.onHide = () => { if (document.hidden) this.player.stop(); };
        document.addEventListener('visibilitychange', this.onHide);
    }
    destroy() {
        this.unsubscribe(); this.unsubscribeMove();
        document.removeEventListener('visibilitychange', this.onHide);
        this.player.destroy();
    }
}
