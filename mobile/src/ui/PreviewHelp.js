import { getText } from './strings.js';

// Non-modal coaching stays over the inspector, leaving the board and its
// navigation usable. Visibility is transient; only completion is persisted.
export class PreviewHelp {
    constructor(element, store) {
        this.element = element; this.store = store;
        this.button = element.querySelector('#preview-help');
        this.card = element.querySelector('#preview-guide');
        this.button.onclick = () => store.togglePreviewHelp();
        this.escape = event => {
            if (event.key !== 'Escape' || !store.snapshot().ui.helpOpen) return;
            event.preventDefault(); store.togglePreviewHelp();
            this.button.focus({ preventScroll: true });
        };
        element.addEventListener('keydown', this.escape);
        element.querySelector('#preview-guide-done').onclick = () => {
            store.completePreviewHelp();
            this.button.focus({ preventScroll: true });
        };
        this.unsubscribe = store.subscribe(state => this.render(state));
    }
    render(state) {
        const text = getText(state.ui.language);
        const visible = state.ui.helpOpen;
        this.card.hidden = !visible;
        this.button.setAttribute('aria-expanded', String(visible));
        this.element.querySelector('#preview-guide-intro').textContent = !state.ui.preview ? text.guideSelect
            : state.ui.preview.cursor === 0 ? text.guideSelected : text.guideExploring;
        this.element.querySelector('#redo').classList.toggle('guide-target', visible && Boolean(state.ui.preview));
    }
    destroy() { this.unsubscribe(); this.element.removeEventListener('keydown', this.escape); }
}
