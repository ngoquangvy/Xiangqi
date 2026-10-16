// Presentation signals come from the core snapshot, never an engine mate score.
export function positionStatus(state) {
    let checkedKing = null;
    if (state.isCheck) for (let y = 0; y < 10; y++) for (let x = 0; x < 9; x++) {
        const piece = state.board[y][x];
        if (piece?.color === state.currentTurn && ['\u5e25', '\u5c07'].includes(piece.name)) checkedKing = { x, y };
    }
    return { checkedKing, winner: state.isCheckmate ? (state.currentTurn === 'red' ? 'black' : 'red') : null };
}
