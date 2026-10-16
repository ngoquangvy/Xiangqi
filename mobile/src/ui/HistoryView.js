import { getText } from './strings.js';

export class HistoryView {
    constructor(element, goTo) { this.element = element; this.goTo = goTo; }
    render(state) {
        const text = getText(state.ui.language);
        const fragment = document.createDocumentFragment();
        const start = document.createElement('button');
        start.type = 'button'; start.textContent = text.initial;
        start.className = 'history-start'; start.onclick = () => this.goTo(-1);
        fragment.append(start);
        if (!state.game.moveHistory.length) {
            const message = document.createElement('p'); message.className = 'hint';
            message.textContent = text.emptyHistory; fragment.append(message);
        }
        state.game.moveHistory.forEach((move, index) => {
            const button = document.createElement('button');
            button.type = 'button'; button.className = 'history-move';
            const number = Math.floor(index / 2) + 1;
            const color = move.currentTurn === 'red' ? text.red : text.black;
            button.dataset.side = move.currentTurn;
            const label = `${number}. ${color}, ${move.moveNotation}${move.note ? ', ' + text.noteMark : ''}`;
            button.setAttribute('aria-label', label);
            const marker = document.createElement('span'); marker.className = 'move-number';
            marker.textContent = move.currentTurn === 'red' ? `${number}.` : `${number}\u2026`;
            const notation = document.createElement('span'); notation.className = 'move-notation';
            notation.textContent = move.moveNotation;
            button.append(marker, notation);
            button.dataset.index = String(index);
            button.setAttribute('aria-current', index === state.game.currentMoveIndex ? 'step' : 'false');
            if (move.note) {
                const note = document.createElement('span'); note.className = 'note-mark';
                note.textContent = '\u270e'; note.setAttribute('aria-hidden', 'true');
                button.append(note);
            }
            button.onclick = () => this.goTo(index);
            fragment.append(button);
        });
        this.element.replaceChildren(fragment);
    }
}
