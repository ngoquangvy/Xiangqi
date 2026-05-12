// src/core/XiangqiNotation.js
// Pure stateless notation helpers.
// No board access, no class state, no side effects.
// XiangqiGame imports these constants and functions to avoid duplication.

// ---------------------------------------------------------------------------
// Piece -> FEN symbol mapping
// Red pieces: uppercase.  Black pieces: lowercase (handled by caller).
// ---------------------------------------------------------------------------
const FEN_MAP = {
    '車': 'r', '车': 'r', // Rook  (Chariot)
    '馬': 'n', '马': 'n', // Knight (Horse)
    '象': 'b', '相': 'b', // Bishop (Elephant)
    '仕': 'a', '士': 'a', // Advisor (Guard)
    '帥': 'k', '將': 'k', // General / King
    '炮': 'c', '砲': 'c', // Cannon
    '兵': 'p', '卒': 'p', // Pawn / Soldier
};

// ---------------------------------------------------------------------------
// FEN char -> piece name mapping
// Upper case = red piece,  lower case = black piece.
// ---------------------------------------------------------------------------
const REVERSE_FEN_MAP = {
    'r': '車', 'R': '車',
    'n': '马', 'N': '馬',
    'b': '相', 'B': '象',
    'a': '士', 'A': '仕',
    'k': '將', 'K': '帥',
    'c': '砲', 'C': '炮',
    'p': '卒', 'P': '兵',
};

// ---------------------------------------------------------------------------
// Piece name -> display shorthand (Latin letter used in printed notation)
// ---------------------------------------------------------------------------
const PIECE_NOTATION_MAP = {
    '兵': 'P', '卒': 'P', // Pawn / Soldier
    '炮': 'C', '砲': 'C', // Cannon
    '馬': 'N', '马': 'N', // Knight (Horse)
    '象': 'B', '相': 'B', // Bishop (Elephant)
    '車': 'R', '车': 'R', // Rook (Chariot)
    '仕': 'A', '士': 'A', // Advisor (Guard)
    '帥': 'K', '將': 'K', // General / King
};

// Pieces whose distance value is the destination column (not row delta).
// Used by getMoveNotation to decide whether the move symbol encodes column or distance.
const DIAGONAL_PIECES = new Set([
    '馬', '马', // Knight (Horse)
    '象', '相', // Bishop (Elephant)
    '仕', '士', // Advisor (Guard)
]);

// ---------------------------------------------------------------------------
// Pure functions
// ---------------------------------------------------------------------------

/**
 * Convert a piece object to its FEN character.
 * Red pieces use upper case; black pieces use lower case.
 * Returns null if the piece name is unknown.
 */
function pieceToFenChar(piece) {
    if (!piece || !piece.name) return null;
    const symbol = FEN_MAP[piece.name];
    if (!symbol) return null;
    return piece.color === 'red' ? symbol.toUpperCase() : symbol.toLowerCase();
}

/**
 * Return the single-letter display symbol for a piece (e.g. 'R', 'C', 'K').
 * Returns the raw piece name if no mapping exists.
 */
function getPieceNotationSymbol(piece) {
    if (!piece) return '';
    return PIECE_NOTATION_MAP[piece.name] || piece.name;
}

/**
 * Convert a move object to ICCS (International Chinese Chess Standard) format.
 * e.g. { fromX:0, fromY:9, toX:0, toY:8 } -> "a0a1"
 */
function toICCS(move) {
    if (!move) return '';
    const fX = String.fromCharCode(97 + move.fromX);
    const fY = 9 - move.fromY;
    const tX = String.fromCharCode(97 + move.toX);
    const tY = 9 - move.toY;
    return `${fX}${fY}${tX}${tY}`;
}

/**
 * Convert zero-indexed (x, y) board coordinates to a human-readable position
 * string in "col.row" format (e.g. x=2, y=7 -> "3.3").
 * Primarily used for debugging; not part of standard Xiangqi notation.
 */
function getPositionNotation(x, y) {
    const col = x + 1;       // Col 1-9  (x: 0-8)
    const row = 10 - y;      // Row 1-10 (y: 0-9, inverted)
    return `${col}.${row}`;
}

module.exports = {
    FEN_MAP,
    REVERSE_FEN_MAP,
    PIECE_NOTATION_MAP,
    DIAGONAL_PIECES,
    pieceToFenChar,
    getPieceNotationSymbol,
    toICCS,
    getPositionNotation,
};
