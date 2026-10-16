import XiangqiGame from '../../../src/core/XiangqiGame.js';
import { parseUCI } from '../../../src/core/XiangqiPV.js';
import { PREVIEW_LINE_LIMIT } from './lineLimits.js';

// Scratch-only replay. Neither navigation nor its highlights are persisted.
export class PreviewLine {
    #states = [];
    #moves = [];
    #cursor = 0;
    #firstHighlight = true;
    constructor(serializedGame, moves) {
        const scratch = new XiangqiGame();
        // Restore preserves original piece glyphs and the actual root history;
        // a FEN-only reconstruction would normalize some horse glyphs.
        if (!scratch.importGame(serializedGame) || !Array.isArray(moves)) return;
        this.rootFen = scratch.exportFen();
        this.#states.push(this.#capture(scratch));
        for (const uci of moves.slice(0, PREVIEW_LINE_LIMIT)) {
            const coordinates = parseUCI(uci);
            if (!coordinates || !scratch.move(...coordinates)) break;
            this.#moves.push(uci); this.#states.push(this.#capture(scratch));
        }
    }
    #capture(game) {
        const { board, currentTurn, isCheck, isCheckmate, lastMove } = game.getGameState();
        return { board, currentTurn, isCheck, isCheckmate, lastMove };
    }
    get valid() { return this.#moves.length > 0; }
    step(direction) {
        if (![1, -1].includes(direction)) return false;
        const next = this.#cursor + direction;
        if (next < 0 || next >= this.#states.length) return false;
        this.#cursor = next; this.#firstHighlight = false;
        return true;
    }
    snapshot() {
        if (!this.valid) return null;
        const state = this.#states[this.#cursor];
        return structuredClone({ board: state.board, turn: state.currentTurn, currentTurn: state.currentTurn,
            isCheck: state.isCheck, isCheckmate: state.isCheckmate, lastMove: state.lastMove,
            uci: this.#moves[0], rootFen: this.rootFen, cursor: this.#cursor, length: this.#moves.length,
            firstMoveHighlight: this.#firstHighlight ? this.#states[1].lastMove : null });
    }
}
