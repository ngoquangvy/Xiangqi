const ROWS = 10;
const COLS = 9;

class XiangqiGame {
    constructor() {
        this.currentTurn = "red";
        this.moveHistory = [];
        this.currentMoveIndex = -1;
        this.initialBoard = null;
        this.board = Array(ROWS).fill().map(() => Array(COLS).fill(null));
        this.moveCount = 1;
        this.setupInitialPosition();
        this.saveInitialBoard();
        this.fenBoardSnapshot = null;
        this.fenMap = {
            "\u8eca": "r",
            "\u99Ac": "n",
            "\u9a6c": "n",
            "\u8c61": "b",
            "\u76f8": "b",
            "\u4ed5": "a",
            "\u58eb": "a",
            "\u5e05": "k",
            "\u5c06": "k",
            "\u70ae": "c",
            "\u7832": "c",
            "\u5175": "p",
            "\u5352": "p"
        };
    }

    pieceToFen(piece) {
        if (!piece) return null;
        let symbol = this.fenMap[piece.name];
        if (!symbol) return null;
        return piece.color === "red" ? symbol.toUpperCase() : symbol.toLowerCase();
    }
    // Rebuild board state from FEN and reset replay pointers for that new state.
    importFen(fen) {
        try {
            const parts = fen.split(' ');
            if (parts.length < 6) {
                console.error('Invalid FEN string:', fen);
                return false;
            }

            const boardFen = parts[0];
            const turn = parts[1];
            const moveNumber = parseInt(parts[4]) || 1;

            this.board = Array(ROWS).fill().map(() => Array(COLS).fill(null));
            const rows = boardFen.split('/');
            if (rows.length !== ROWS) {
                console.error('Invalid number of rows in FEN:', rows.length);
                return false;
            }

            const reverseFenMap = {
                'r': "\u8eca", 'R': "\u8eca",
                'n': "\u9a6c", 'N': "\u99Ac",
                'b': "\u76f8", 'B': "\u8c61",
                'a': "\u58eb", 'A': "\u4ed5",
                'k': "\u5c06", 'K': "\u5e05",
                'c': "\u7832", 'C': "\u70ae",
                'p': "\u5352", 'P': "\u5175"
            };

            let kingRedCount = 0;
            let kingBlackCount = 0;

            for (let y = 0; y < ROWS; y++) {
                let x = 0;
                const row = rows[y];
                for (let i = 0; i < row.length; i++) {
                    const char = row[i];
                    if (/[0-9]/.test(char)) {
                        x += parseInt(char);
                    } else if (x < COLS) {
                        const pieceName = reverseFenMap[char];
                        if (pieceName) {
                            const color = char === char.toUpperCase() ? "red" : "black";
                            this.board[y][x] = { name: pieceName, color };
                            if (pieceName === "\u5e05" && color === "red") kingRedCount++;
                            if (pieceName === "\u5c06" && color === "black") kingBlackCount++;
                            x++;
                        } else {
                            console.warn(`Unknown FEN symbol at row ${y}, col ${x}: ${char}`);
                            x++;
                        }
                    }
                }
            }

            if (kingRedCount !== 1 || kingBlackCount !== 1) {
                console.error(`Invalid FEN: Red kings: ${kingRedCount}, Black kings: ${kingBlackCount}`);
                return false;
            }

            this.currentTurn = turn === 'w' ? 'red' : 'black';
            this.moveCount = moveNumber;
            // Importing a fresh FEN intentionally clears current game history.
            this.moveHistory = [];
            this.currentMoveIndex = -1;
            this.fenBoardSnapshot = null;
            return true;
        } catch (err) {
            console.error('Error importing FEN:', err);
            return false;
        }
    }

    setupInitialPosition() {
        const initialSetup = [
            { name: "\u8eca", color: "red", x: 0, y: 9 }, { name: "\u8eca", color: "red", x: 8, y: 9 },
            { name: "\u99Ac", color: "red", x: 1, y: 9 }, { name: "\u99Ac", color: "red", x: 7, y: 9 },
            { name: "\u8c61", color: "red", x: 2, y: 9 }, { name: "\u8c61", color: "red", x: 6, y: 9 },
            { name: "\u4ed5", color: "red", x: 3, y: 9 }, { name: "\u4ed5", color: "red", x: 5, y: 9 },
            { name: "\u5e05", color: "red", x: 4, y: 9 },
            { name: "\u70ae", color: "red", x: 1, y: 7 }, { name: "\u70ae", color: "red", x: 7, y: 7 },
            { name: "\u5175", color: "red", x: 0, y: 6 }, { name: "\u5175", color: "red", x: 2, y: 6 },
            { name: "\u5175", color: "red", x: 4, y: 6 }, { name: "\u5175", color: "red", x: 6, y: 6 },
            { name: "\u5175", color: "red", x: 8, y: 6 },
            { name: "\u8eca", color: "black", x: 0, y: 0 }, { name: "\u8eca", color: "black", x: 8, y: 0 },
            { name: "\u9a6c", color: "black", x: 1, y: 0 }, { name: "\u9a6c", color: "black", x: 7, y: 0 },
            { name: "\u76f8", color: "black", x: 2, y: 0 }, { name: "\u76f8", color: "black", x: 6, y: 0 },
            { name: "\u58eb", color: "black", x: 3, y: 0 }, { name: "\u58eb", color: "black", x: 5, y: 0 },
            { name: "\u5c06", color: "black", x: 4, y: 0 },
            { name: "\u7832", color: "black", x: 1, y: 2 }, { name: "\u7832", color: "black", x: 7, y: 2 },
            { name: "\u5352", color: "black", x: 0, y: 3 }, { name: "\u5352", color: "black", x: 2, y: 3 },
            { name: "\u5352", color: "black", x: 4, y: 3 }, { name: "\u5352", color: "black", x: 6, y: 3 },
            { name: "\u5352", color: "black", x: 8, y: 3 }
        ];

        initialSetup.forEach(piece => {
            this.board[piece.y][piece.x] = { name: piece.name, color: piece.color };
        });
    }
    exportFen() {
        this.fenBoardSnapshot = this.board.map(row => row.map(cell => (cell ? { ...cell } : null)));
        let fen = '';
        for (let y = 0; y < ROWS; y++) {
            let emptyCount = 0;
            for (let x = 0; x < COLS; x++) {
                const piece = this.board[y][x];
                if (!piece) {
                    emptyCount++;
                } else {
                    if (emptyCount > 0) {
                        fen += emptyCount;
                        emptyCount = 0;
                    }
                    const fenSymbol = this.pieceToFen(piece);
                    if (fenSymbol) {
                        fen += fenSymbol;
                    } else {
                        console.warn(`Unknown piece at (${x}, ${y}):`, piece);
                        fen += '?';
                    }
                }
            }
            if (emptyCount > 0) fen += emptyCount;
            if (y < 9) fen += '/';
        }
        fen += ` ${this.currentTurn === 'red' ? 'w' : 'b'} - - 0 ${this.moveCount || 1}`;
        return fen;
    }

    getPieceForNotation(x, y) {
        if (this.fenBoardSnapshot && this.fenBoardSnapshot[y] && this.fenBoardSnapshot[y][x]) {
            return this.fenBoardSnapshot[y][x];
        }
        return this.getPiece(x, y);
    }

    saveInitialBoard() {
        this.initialBoard = this.board.map(row => row.map(cell => (cell ? { ...cell } : null)));
    }



    getPiece(x, y) {
        if (!this.board || !Array.isArray(this.board) || !this.board[y] || !this.isValidPosition(x, y)) {
            console.error(`Invalid board state or position: x=${x}, y=${y}, board=`, this.board);
            return null;
        }
        return this.board[y][x];
    }

    isValidPosition(x, y) {
        return x >= 0 && x < COLS && y >= 0 && y < ROWS;
    }
    move(fromX, fromY, toX, toY) {
        const piece = this.board[fromY][fromX];
        if (!piece) {
            console.error(`No piece found at (${fromX}, ${fromY})`);
            return false;
        }

        if (piece.color !== this.currentTurn) {
            console.log(`Not ${piece.color}'s turn, current turn is ${this.currentTurn}`);
            return false;
        }

        const legalMoves = this.getLegalMoves(fromX, fromY);
        const isLegal = legalMoves.some(([mx, my]) => mx === toX && my === toY);
        if (!isLegal) {
            console.log(`Illegal move attempted: (${fromX}, ${fromY}) to (${toX}, ${toY})`);
            return false;
        }

        const capturedPiece = this.board[toY][toX];
        if (capturedPiece && capturedPiece.name === (piece.color === "red" ? "\u5c06" : "\u5e05")) {
            console.warn(`Attempted to capture opponent's king at (${toX}, ${toY})`);
            return false;
        }

        this.moveHistory = this.moveHistory.slice(0, this.currentMoveIndex + 1);
        const fenBefore = this.exportFen();
        this.board[toY][toX] = piece;
        this.board[fromY][fromX] = null;

        if (this.isKingInCheck(piece.color)) {
            this.board[fromY][fromX] = piece;
            this.board[toY][toX] = capturedPiece;
            return false;
        }

        const fenAfter = this.exportFen();
        const moveEntry = {
            fromX,
            fromY,
            toX,
            toY,
            capturedPiece,
            currentTurn: this.currentTurn,
            piece: { name: piece.name, color: piece.color },
            fen: fenAfter
        };
        this.moveHistory.push(moveEntry);

        this.currentMoveIndex++;
        const previousTurn = this.currentTurn;
        this.currentTurn = this.currentTurn === "red" ? "black" : "red";
        if (previousTurn === "black" && this.currentTurn === "red") {
            this.moveCount++;
        }
        return true;
    }






    getRawMoves(x, y) {
        const piece = this.getPiece(x, y);
        if (!piece) return [];

        let moves = [];
        switch (piece.name) {
            case "\u5175": case "\u5352": moves = this.getSoldierMoves(x, y, piece.color); break;
            case "\u70ae": case "\u7832": moves = this.getCannonMoves(x, y, piece.color); break;
            case "\u8eca": moves = this.getRookMoves(x, y, piece.color); break;
            case "\u99Ac": case "\u9a6c": moves = this.getKnightMoves(x, y, piece.color); break;
            case "\u76f8": case "\u8c61": moves = this.getElephantMoves(x, y, piece.color); break;
            case "\u4ed5": case "\u58eb": moves = this.getGuardMoves(x, y, piece.color); break;
            case "\u5e05": case "\u5c06": moves = this.getKingMoves(x, y, piece.color); break;
            default: return [];
        }
        return moves;
    }




    getLegalMoves(x, y) {
        const piece = this.getPiece(x, y);
        if (!piece) return [];

        const rawMoves = this.getRawMoves(x, y);

        const legalMoves = rawMoves.filter(([toX, toY]) => {
            const originalPiece = this.board[y][x];
            const targetPiece = this.board[toY][toX];
            this.board[toY][toX] = originalPiece;
            this.board[y][x] = null;

            const inCheck = this.isKingInCheck(piece.color);

            this.board[y][x] = originalPiece;
            this.board[toY][toX] = targetPiece;

            return !inCheck;
        });
        return legalMoves;
    }

    isKingInCheck(color) {
        const kingPos = this.findKing(color);
        if (!kingPos) return false;

        const enemyColor = color === "red" ? "black" : "red";
        for (let y = 0; y < ROWS; y++) {
            for (let x = 0; x < COLS; x++) {
                const piece = this.board[y][x];
                if (piece && piece.color === enemyColor) {
                    const moves = this.getRawMoves(x, y);
                    if (moves.some(([mx, my]) => mx === kingPos.x && my === kingPos.y)) {
                        return true;
                    }
                }
            }
        }

        return this.willKingsFaceEachOther();
    }

    isCheckmate(color) {
        if (!this.isKingInCheck(color)) {
            return false;
        }

        for (let y = 0; y < ROWS; y++) {
            for (let x = 0; x < COLS; x++) {
                const piece = this.getPiece(x, y);
                if (piece && piece.color === color) {
                    const moves = this.getLegalMoves(x, y);
                    for (const [toX, toY] of moves) {
                        const originalPiece = this.board[y][x];
                        const targetPiece = this.board[toY][toX];
                        this.board[toY][toX] = originalPiece;
                        this.board[y][x] = null;

                        const stillInCheck = this.isKingInCheck(color);

                        this.board[y][x] = originalPiece;
                        this.board[toY][toX] = targetPiece;

                        if (!stillInCheck) {
                            return false;
                        }
                    }
                }
            }
        }

        return true;
    }

    findKing(color) {
        for (let y = 0; y < ROWS; y++) {
            for (let x = 0; x < COLS; x++) {
                const piece = this.board[y][x];
                if (piece && piece.name === (color === "red" ? "\u5e05" : "\u5c06") && piece.color === color) {
                    return { x, y };
                }
            }
        }
        return null;
    }

    willKingsFaceEachOther() {
        const redKing = this.findKing("red");
        const blackKing = this.findKing("black");
        if (!redKing || !blackKing || redKing.x !== blackKing.x) return false;

        const minY = Math.min(redKing.y, blackKing.y);
        const maxY = Math.max(redKing.y, blackKing.y);
        for (let y = minY + 1; y < maxY; y++) {
            if (this.board[y][redKing.x]) return false;
        }
        return true;
    }

    getSoldierMoves(x, y, color) {
        let moves = [];
        if (color === "red") {
            if (y > 0) moves.push([x, y - 1]);
            if (y <= 4) {
                if (x > 0) moves.push([x - 1, y]);
                if (x < 8) moves.push([x + 1, y]);
            }
        } else {
            if (y < 9) moves.push([x, y + 1]);
            if (y >= 5) {
                if (x > 0) moves.push([x - 1, y]);
                if (x < 8) moves.push([x + 1, y]);
            }
        }
        return moves.filter(([nx, ny]) => this.isValidPosition(nx, ny));
    }

    getCannonMoves(x, y, color) {
        let moves = [];
        const directions = [[0, 1], [0, -1], [1, 0], [-1, 0]];

        directions.forEach(([dx, dy]) => {
            let nx = x, ny = y;
            let jumpCount = 0;

            while (this.isValidPosition(nx + dx, ny + dy)) {
                nx += dx;
                ny += dy;
                const pieceAt = this.board[ny][nx];

                if (jumpCount === 0) {
                    if (!pieceAt) {
                        moves.push([nx, ny]);
                    } else {
                        jumpCount++;
                    }
                } else if (jumpCount === 1) {
                    if (pieceAt) {
                        if (pieceAt.color !== color) {
                            moves.push([nx, ny]);
                        }
                        break;
                    }
                }
            }
        });

        return moves;
    }

    getRookMoves(x, y, color) {
        let moves = [];
        const directions = [[0, 1], [0, -1], [1, 0], [-1, 0]];
        directions.forEach(([dx, dy]) => {
            let nx = x, ny = y;
            while (this.isValidPosition(nx + dx, ny + dy)) {
                nx += dx;
                ny += dy;
                const pieceAt = this.board[ny][nx];
                if (pieceAt) {
                    if (pieceAt.color !== color) moves.push([nx, ny]);
                    break;
                }
                moves.push([nx, ny]);
            }
        });
        return moves;
    }

    getKnightMoves(x, y, color) {
        let moves = [];
        const knightMoves = [[2, 1], [2, -1], [-2, 1], [-2, -1], [1, 2], [1, -2], [-1, 2], [-1, -2]];
        knightMoves.forEach(([dx, dy]) => {
            const nx = x + dx, ny = y + dy;
            const blockX = dx === 2 ? x + 1 : dx === -2 ? x - 1 : x;
            const blockY = dy === 2 ? y + 1 : dy === -2 ? y - 1 : y;
            if (this.isValidPosition(nx, ny) && !this.board[blockY][blockX]) {
                const pieceAt = this.board[ny][nx];
                if (!pieceAt || pieceAt.color !== color) moves.push([nx, ny]);
            }
        });
        return moves;
    }

    getElephantMoves(x, y, color) {
        let moves = [];
        const elephantMoves = [{ dx: 2, dy: 2 }, { dx: 2, dy: -2 }, { dx: -2, dy: 2 }, { dx: -2, dy: -2 }];
        const riverBoundary = color === "red" ? 4 : 5;
        elephantMoves.forEach(({ dx, dy }) => {
            const nx = x + dx, ny = y + dy;
            const blockX = x + dx / 2, blockY = y + dy / 2;
            if (this.isValidPosition(nx, ny) && (color === "red" ? ny > riverBoundary : ny < riverBoundary) && !this.board[blockY][blockX]) {
                const pieceAt = this.board[ny][nx];
                if (!pieceAt || pieceAt.color !== color) moves.push([nx, ny]);
            }
        });
        return moves;
    }

    getGuardMoves(x, y, color) {
        let moves = [];
        const palace = color === "red" ? { minX: 3, maxX: 5, minY: 7, maxY: 9 } : { minX: 3, maxX: 5, minY: 0, maxY: 2 };
        const guardMoves = [{ dx: 1, dy: 1 }, { dx: 1, dy: -1 }, { dx: -1, dy: 1 }, { dx: -1, dy: -1 }];
        guardMoves.forEach(({ dx, dy }) => {
            const nx = x + dx, ny = y + dy;
            if (nx >= palace.minX && nx <= palace.maxX && ny >= palace.minY && ny <= palace.maxY) {
                const pieceAt = this.board[ny][nx];
                if (!pieceAt || pieceAt.color !== color) moves.push([nx, ny]);
            }
        });
        return moves;
    }

    getKingMoves(x, y, color) {
        let moves = [];
        const palace = color === "red" ? { minX: 3, maxX: 5, minY: 7, maxY: 9 } : { minX: 3, maxX: 5, minY: 0, maxY: 2 };
        const directions = [[1, 0], [-1, 0], [0, 1], [0, -1]];
        directions.forEach(([dx, dy]) => {
            const nx = x + dx, ny = y + dy;
            if (nx >= palace.minX && nx <= palace.maxX && ny >= palace.minY && ny <= palace.maxY) {
                const pieceAt = this.board[ny][nx];
                if (!pieceAt || pieceAt.color !== color) moves.push([nx, ny]);
            }
        });
        return moves;
    }

    undo() {
        if (this.currentMoveIndex < 0) return false;

        const move = this.moveHistory[this.currentMoveIndex];
        if (!move) return false;

        const piece = this.board[move.toY][move.toX];
        this.board[move.fromY][move.fromX] = piece;
        this.board[move.toY][move.toX] = move.capturedPiece;
        this.currentTurn = move.currentTurn;
        // moveCount increases after black moves, so undo black turn should decrement it.
        if (this.currentTurn === "black" && this.moveCount > 1) {
            this.moveCount--;
        }
        this.currentMoveIndex--;

        return true;
    }

    redo() {
        if (this.currentMoveIndex >= this.moveHistory.length - 1) return false;

        this.currentMoveIndex++;
        const move = this.moveHistory[this.currentMoveIndex];
        if (!move) return false;

        const piece = this.board[move.fromY][move.fromX];
        this.board[move.toY][move.toX] = piece;
        this.board[move.fromY][move.fromX] = null;
        const previousTurn = this.currentTurn;
        this.currentTurn = this.currentTurn === "red" ? "black" : "red";
        if (previousTurn === "black" && this.currentTurn === "red") {
            this.moveCount++;
        }
        return true;
    }

    resetToInitial() {
        if (!this.initialBoard) return false;
        this.board = this.initialBoard.map(row => row.map(cell => (cell ? { ...cell } : null)));
        this.currentTurn = "red";
        this.moveHistory = [];
        this.currentMoveIndex = -1;
        this.moveCount = 1;
        return true;
    }

    resetGame() {
        this.board = Array(ROWS).fill().map(() => Array(COLS).fill(null));
        this.currentTurn = "red";
        this.moveHistory = [];
        this.currentMoveIndex = -1;
        this.moveCount = 1;
        this.setupInitialPosition();
        this.saveInitialBoard();
        return true;
    }

    // Return history entries with both notation and coordinates for UI replay/navigation.
    getMoveHistory() {
        if (!this.moveHistory || !Array.isArray(this.moveHistory)) {
            console.error('Move history is not initialized or invalid:', this.moveHistory);
            return [];
        }
        return this.moveHistory.map((move, index) => {
            if (!move.piece) {
                console.warn(`Move ${index} missing piece information, attempting to fix:`, move);
                move.piece = this.board[move.fromY][move.fromX] || null;
            }
            try {
                const notation = this.getMoveNotation(move);
                // Keep coordinates in history entries so replay and jump-to-move stay stable.
                return { ...move, moveNotation: notation };
            } catch (err) {
                console.error(`Error processing move ${index}:`, move, err);
                return { ...move, moveNotation: "Error" };
            }
        });
    }

    exportGame() {
        return JSON.stringify({
            moveHistory: this.moveHistory,
            currentMoveIndex: this.currentMoveIndex,
            initialBoard: this.initialBoard
        });
    }

    importGame(gameData) {
        try {
            const data = JSON.parse(gameData);
            this.moveHistory = data.moveHistory || [];
            this.currentMoveIndex = data.currentMoveIndex || -1;
            this.initialBoard = data.initialBoard || null;

            if (this.initialBoard) {
                this.board = this.initialBoard.map(row => row.map(cell => (cell ? { ...cell } : null)));
            } else {
                this.board = Array(ROWS).fill().map(() => Array(COLS).fill(null));
                this.setupInitialPosition();
                this.saveInitialBoard();
            }
            this.currentTurn = "red";

            for (let i = 0; i <= this.currentMoveIndex; i++) {
                const move = this.moveHistory[i];
                if (move) {
                    const piece = this.board[move.fromY][move.fromX];
                    this.board[move.toY][move.toX] = piece;
                    this.board[move.fromY][move.fromX] = null;
                    this.currentTurn = this.currentTurn === "red" ? "black" : "red";
                }
            }
            return true;
        } catch (err) {
            console.error('Error importing game:', err);
            return false;
        }
    }

    getPieceNotation(piece) {
        if (!piece) return "";
        const notationMap = {
            "\u5175": "P", "\u5352": "P",
            "\u70ae": "C", "\u7832": "C",
            "\u99Ac": "N", "\u9a6c": "N",
            "\u8c61": "B", "\u76f8": "B",
            "\u8eca": "R", "\u8f66": "R",
            "\u4ed5": "A", "\u58eb": "A",
            "\u5e05": "K", "\u5c06": "K"
        };
        return notationMap[piece.name] || piece.name;
    }

    getPositionNotation(x, y) {
        const col = x + 1;
        const row = 10 - y;
        return `${col}.${row}`;
    }

    getPiecesInColumn(pieceName, col, color) {
        const pieces = [];
        for (let y = 0; y < 10; y++) {
            const piece = this.board[y][col];
            if (piece && piece.name === pieceName && piece.color === color) {
                pieces.push({ x: col, y });
            }
        }
        return pieces;
    }
    getMoveNotation(move) {
        if (!move || typeof move.fromX === 'undefined' || typeof move.fromY === 'undefined' ||
            typeof move.toX === 'undefined' || typeof move.toY === 'undefined') {
            console.error('Invalid move object:', move);
            return "Invalid Move";
        }

        let piece = move.piece;
        if (!piece) {
            console.warn('No piece information in move object, attempting to fetch from board:', move);
            piece = this.getPieceForNotation(move.fromX, move.fromY);
            if (!piece) {
                console.warn('No piece found at from position on current board:', move);
                return "Unknown Move";
            }
        }
        const fenSymbol = this.pieceToFen(piece) || piece.name;
        const pieceNotation = this.getPieceNotation(piece);
        if (!pieceNotation) return "Invalid Piece";

        const fromCol = piece.color === "red" ? (9 - move.fromX) : (move.fromX + 1);
        const toCol = piece.color === "red" ? (9 - move.toX) : (move.toX + 1);
        const deltaY = move.toY - move.fromY;
        const absDeltaY = Math.abs(deltaY);

        let moveSymbol = "";
        let moveDistance = 0;

        if (["\u99Ac", "\u9a6c", "\u8c61", "\u76f8", "\u4ed5", "\u58eb"].includes(piece.name)) {
            moveSymbol = deltaY > 0 ? (piece.color === "red" ? "-" : "+") : (piece.color === "red" ? "+" : "-");
            moveDistance = toCol;
        } else {
            if (deltaY === 0) {
                moveSymbol = "=";
                moveDistance = toCol;
            } else {
                moveSymbol = deltaY < 0 ? (piece.color === "red" ? "+" : "-") : (piece.color === "red" ? "-" : "+");
                moveDistance = absDeltaY;
            }
        }

        const samePieces = this.getPiecesInColumn(piece.name, move.fromX, piece.color);
        let prefix = pieceNotation;
        if (samePieces.length > 1) {
            samePieces.sort((a, b) => piece.color === "red" ? b.y - a.y : a.y - b.y);
            const index = samePieces.findIndex(p => p.y === move.fromY);
            prefix = piece.color === "red" ? `${index + 1}${pieceNotation}` : `${pieceNotation}${index + 1}`;
        }

        const result = `${prefix}${fromCol}${moveSymbol}${moveDistance}`;
        return result;
    }
    setFlipped(isFlipped) {
        this.isFlipped = isFlipped;
    }
}

module.exports = XiangqiGame;


