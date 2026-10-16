// Both transports use these pure helpers so previews have identical shapes.
export function parseUCI(move) {
    if (typeof move !== 'string' || !/^[a-i][0-9][a-i][0-9]$/.test(move)) return null;
    return [move.charCodeAt(0) - 97, 9 - Number(move[1]), move.charCodeAt(2) - 97, 9 - Number(move[3])];
}

export function formatPV(Game, fen, moves = []) {
    const game = new Game();
    if (!game.importFen(fen)) return { moves: [], formatted: '-' };
    const notes = [];
    for (const move of moves) {
        const coords = parseUCI(move);
        if (!coords) { notes.push(move); continue; }
        const [fromX, fromY, toX, toY] = coords;
        const piece = game.getPiece(fromX, fromY);
        if (!piece) break;
        const note = game.calculateMoveNotation({ fromX, fromY, toX, toY, piece });
        if (!game.move(...coords)) break;
        notes.push(note);
    }
    return { moves: notes, formatted: notes.join(' ') };
}

export function translatePVGroups(Game, fen, groups = []) {
    const map = {};
    for (const moves of groups) {
        if (!Array.isArray(moves)) continue;
        const notes = formatPV(Game, fen, moves).moves;
        notes.forEach((note, index) => { map[moves[index]] ??= note; });
    }
    return map;
}

export function simulatePV(Game, fen, moves = [], limit = moves.length) {
    const game = new Game();
    if (!game.importFen(fen)) return [];
    const states = [{ board: game.getBoardSnapshot(), turn: game.currentTurn, lastMove: null }];
    for (const move of moves.slice(0, Math.max(0, limit))) {
        const coords = parseUCI(move);
        if (!coords || !game.move(...coords)) break;
        const [fromX, fromY, toX, toY] = coords;
        states.push({ board: game.getBoardSnapshot(), turn: game.currentTurn,
            lastMove: { fromX, fromY, toX, toY } });
    }
    return states;
}
