const XiangqiGame = require('./game.js');

async function testPV() {
    const game = new XiangqiGame();
    game.setupInitialPosition();
    const fen = game.exportFen();
    console.log("Initial FEN:", fen);

    const pvMoves = ["h2e2", "h9g7", "h0g2", "i9h9"];
    console.log("Testing PV:", pvMoves);

    const notations = [];
    for (const move of pvMoves) {
        const fromX = move.charCodeAt(0) - 97;
        const fromY = 9 - parseInt(move[1]);
        const toX = move.charCodeAt(2) - 97;
        const toY = 9 - parseInt(move[3]);

        const piece = game.getPiece(fromX, fromY);
        const notation = game.getMoveNotation({ fromX, fromY, toX, toY, piece });
        const currentTurn = game.currentTurn;
        const legalMoves = game.getLegalMoves(fromX, fromY);
        const isLegal = legalMoves.some(([mx, my]) => mx === toX && my === toY);
        
        console.log(`Move: ${move}, Piece: ${piece.name}, Color: ${piece.color}, Turn: ${currentTurn}, Notation: ${notation}, Legal: ${isLegal}`);
        
        const success = game.move(fromX, fromY, toX, toY);
        if (!success) {
            console.error("Move failed:", move);
            break;
        }
        notations.push(notation);
    }

    console.log("Final notations:", notations);
}

testPV().catch(console.error);
