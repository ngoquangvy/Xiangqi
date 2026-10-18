import XiangqiGame from '../../../src/core/XiangqiGame.js';
import { parseUCI } from '../../../src/core/XiangqiPV.js';
import { PreviewLine } from './PreviewLine.js';

// Only this adapter owns a live core instance. Views receive detached snapshots.
export class LocalGame {
    #game = new XiangqiGame();
    snapshot() { return this.#game.getGameState(); }
    serialize() { return this.#game.exportGame(); }
    restore(data) { return this.#game.importGame(data); }
    move(...coordinates) { return this.#game.move(...coordinates); }
    undo() { return this.#game.undo(); }
    redo() { return this.#game.redo(); }
    goTo(index) { return this.#game.goToMove(index); }
    reset() { return this.#game.resetGame(); }
    importPosition(fen) { return this.#game.importFen(fen); }
    note(index, text) { return this.#game.updateMoveNote(index, text); }
    analysisPosition() {
        // Replaying the committed path preserves repetition information. Future
        // redo moves and display-only previews must not enter engine history.
        const moves = this.#game.moveHistory.slice(0, this.#game.currentMoveIndex + 1).map(move => this.#game.toICCS(move));
        return { initialFen: this.#game.startingFen, moves: moves.join(' '), fen: this.#game.exportFen() };
    }

    legalMoves(x, y) {
        const state = this.snapshot();
        if (state.board[y]?.[x]?.color !== state.currentTurn) return [];
        return this.#game.getLegalMoves(x, y).map(([toX, toY]) => {
            const uci = String.fromCharCode(97 + x) + (9 - y) + String.fromCharCode(97 + toX) + (9 - toY);
            const notation = this.#game.formatPV(state.fen, [uci]).moves[0];
            return { x: toX, y: toY, uci, notation };
        });
    }

    preview(uci, pv = [uci]) {
        if (!parseUCI(uci)) return null;
        if (!Array.isArray(pv) || pv[0] !== uci) return null;
        const line = new PreviewLine(this.#game.exportGame(), pv);
        return line.valid ? line : null;
    }

    applyPreview(preview) {
        if (!preview || preview.rootFen !== this.#game.exportFen()) return false;
        const coordinates = parseUCI(preview.uci);
        return coordinates ? this.move(...coordinates) : false;
    }
}
