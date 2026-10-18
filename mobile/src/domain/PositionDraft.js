import XiangqiGame from '../../../src/core/XiangqiGame.js';
import { REVERSE_FEN_MAP, pieceToFenChar } from '../../../src/core/XiangqiNotation.js';

export const SETUP_PIECES = ['k', 'a', 'b', 'n', 'r', 'c', 'p'];
const LIMITS = { k: 1, a: 2, b: 2, n: 2, r: 2, c: 2, p: 5 };
const ADVISORS = new Set(['3,9', '5,9', '4,8', '3,7', '5,7']);
const ELEPHANTS = new Set(['2,9', '6,9', '0,7', '4,7', '8,7', '2,5', '6,5']);
function squareError(type, color, x, y) {
    const yy = color === 'red' ? y : 9 - y, square = `${x},${yy}`;
    if (type === 'k' && (x < 3 || x > 5 || yy < 7)) return 'setupPalace';
    if (type === 'a' && !ADVISORS.has(square)) return 'setupAdvisor';
    if (type === 'b' && !ELEPHANTS.has(square)) return 'setupElephant';
    if (type === 'p' && (yy > 6 || (yy >= 5 && x % 2))) return 'setupPawn';
    return null;
}
export function setupPiece(type, color) {
    const symbol = color === 'red' ? type.toUpperCase() : type;
    return REVERSE_FEN_MAP[symbol] ? { name: REVERSE_FEN_MAP[symbol], color } : null;
}

// Drafts may be incomplete. Only a validated, detached FEN can reach the live core.
export class PositionDraft {
    constructor(state) {
        this.board = structuredClone(state.board);
        this.turn = state.currentTurn;
        this.color = 'red'; this.tool = 'move'; this.selected = null; this.notice = null;
    }
    edit(action, value) {
        if (action === 'color' && ['red', 'black'].includes(value)) this.color = value;
        else if (action === 'turn' && ['red', 'black'].includes(value)) this.turn = value;
        else if (action === 'tool' && [...SETUP_PIECES, 'erase', 'move'].includes(value)) {
            if (SETUP_PIECES.includes(value) && this.remaining()[value] === 0) return false;
            this.tool = value;
        } else if (action === 'clear') {
            // Preserve each general's current square; replace a missing general
            // at home so Clear always leaves exactly two generals.
            this.board = this.board.map(row => row.map(piece => pieceToFenChar(piece)?.toLowerCase() === 'k' ? piece : null));
            for (const [color, y] of [['red', 9], ['black', 0]]) {
                if (!this.board.flat().some(piece => piece?.color === color && pieceToFenChar(piece)?.toLowerCase() === 'k')) {
                    this.board[y][4] = setupPiece('k', color);
                }
            }
        }
        else if (action === 'initial') {
            const game = new XiangqiGame(); this.board = game.getBoardSnapshot(); this.turn = 'red';
        } else return false;
        this.selected = null; this.notice = null;
        return true;
    }
    tap(x, y) {
        if (!Number.isInteger(x) || !Number.isInteger(y) || x < 0 || x > 8 || y < 0 || y > 9) return false;
        this.notice = null;
        if (this.tool === 'erase') this.board[y][x] = null;
        else if (this.tool !== 'move') {
            const piece = setupPiece(this.tool, this.color);
            if (!this.canPlace(piece, x, y)) return false;
            this.board[y][x] = piece;
        }
        else if (this.selected) {
            const from = this.selected;
            if (from.x !== x || from.y !== y) {
                if (!this.canPlace(this.board[from.y][from.x], x, y, from)) return false;
                this.board[y][x] = this.board[from.y][from.x]; this.board[from.y][from.x] = null;
            }
            this.selected = null;
        } else if (this.board[y][x]) this.selected = { x, y };
        return true;
    }
    remaining() {
        const result = { ...LIMITS };
        for (const piece of this.board.flat()) if (piece?.color === this.color) result[pieceToFenChar(piece).toLowerCase()]--;
        return result;
    }
    canPlace(piece, x, y, from = null) {
        const type = pieceToFenChar(piece)?.toLowerCase();
        this.notice = squareError(type, piece.color, x, y);
        if (this.notice) return false;
        let count = 0;
        for (let yy = 0; yy < 10; yy++) for (let xx = 0; xx < 9; xx++) {
            if ((xx === x && yy === y) || (xx === from?.x && yy === from?.y)) continue;
            const other = this.board[yy][xx];
            if (other?.color !== piece.color || pieceToFenChar(other)?.toLowerCase() !== type) continue;
            count++;
            const home = piece.color === 'red' ? y : 9 - y;
            const otherHome = piece.color === 'red' ? yy : 9 - yy;
            if (type === 'p' && home >= 5 && otherHome >= 5 && xx === x) this.notice = 'setupPawn';
        }
        if (count >= LIMITS[type]) this.notice = 'setupCount';
        return !this.notice;
    }
    fen() {
        const rows = this.board.map(row => {
            let result = '', empty = 0;
            for (const piece of row) {
                if (!piece) { empty++; continue; }
                if (empty) { result += empty; empty = 0; }
                result += pieceToFenChar(piece);
            }
            return result + (empty || '');
        });
        return `${rows.join('/')} ${this.turn === 'red' ? 'w' : 'b'} - - 0 1`;
    }
    validate() {
        const counts = { red: {}, black: {} }, pawns = new Set();
        for (let y = 0; y < 10; y++) for (let x = 0; x < 9; x++) {
            const piece = this.board[y][x];
            if (!piece) continue;
            const type = pieceToFenChar(piece)?.toLowerCase();
            if (!LIMITS[type] || !counts[piece.color]) return 'setupInvalid';
            const count = counts[piece.color][type] = (counts[piece.color][type] || 0) + 1;
            if (count > LIMITS[type]) return 'setupCount';
            const error = squareError(type, piece.color, x, y);
            if (error) return error;
            const yy = piece.color === 'red' ? y : 9 - y;
            if (type === 'p') {
                const file = `${piece.color}-${x}`;
                if (yy >= 5 && pawns.has(file)) return 'setupPawn';
                if (yy >= 5) pawns.add(file);
            }
        }
        if (counts.red.k !== 1 || counts.black.k !== 1) return 'setupKings';
        const candidate = new XiangqiGame();
        if (!candidate.importFen(this.fen())) return 'setupInvalid';
        if (candidate.willKingsFaceEachOther()) return 'setupFacing';
        // The player who just moved cannot have left their own general in check.
        if (candidate.isKingInCheck(this.turn === 'red' ? 'black' : 'red')) return 'setupPreviousCheck';
        return null;
    }
    snapshot() {
        return { board: structuredClone(this.board), turn: this.turn, color: this.color, tool: this.tool,
            remaining: this.remaining(), notice: this.notice, selected: this.selected && { ...this.selected }, error: this.validate() };
    }
}
