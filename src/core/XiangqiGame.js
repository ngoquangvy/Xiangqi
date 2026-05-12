// src/core/XiangqiGame.js
// Canonical location for Xiangqi game logic (board state, rules, FEN, notation).
const {
    FEN_MAP,
    REVERSE_FEN_MAP,
    DIAGONAL_PIECES,
    pieceToFenChar,
    getPieceNotationSymbol,
    toICCS: iccsFromMove,
    getPositionNotation: positionNotation,
} = require('./XiangqiNotation');

const ROWS = 10;
const COLS = 9;
const DEFAULT_FEN = 'rnbakabnr/9/1c5c1/p1p1p1p1p/9/9/P1P1P1P1P/1C5C1/9/RNBAKABNR w - - 0 1';

class XiangqiGame {
    constructor() {
        this.currentTurn = "red";
        this.moveHistory = []; // Move history
        this.currentMoveIndex = -1; // Current move pointer
        this._flipped = false; // Board orientation (UI concern, persisted with game state)
        
        // Authority states for custom starting positions
        this.initialBoard = null;
        this.initialTurn = "red";
        this.initialMoveCount = 1;
        this.startingFen = DEFAULT_FEN;

        this.board = Array(ROWS).fill().map(() => Array(COLS).fill(null));
        this.moveCount = 1; // Move counter
        this.setupInitialPosition();
        this.saveInitialBoard(); // Capture initial snapshot so resetToInitial/goToMove work immediately
        
        this.fenBoardSnapshot = null; // Board snapshot captured at FEN export time
        this.fenMap = FEN_MAP;
    }

    /**
     * IMPORT FEN
     * -----------------
     * Strictly requires 6 parts. Establishes a new authoritative start point.
     */
    importFen(fen) {
        if (!fen || typeof fen !== 'string') {
            console.error('Invalid FEN passed to importFen:', fen);
            return false;
        }
        try {
            const parts = fen.split(' ');
            if (parts.length !== 6) {
                console.error('Xiangqi FEN requires exactly 6 parts (got ' + parts.length + '):', fen);
                return false;
            }

            const boardFen = parts[0];
            const turn = parts[1];
            // fullmove number is index 5 in standardized FEN
            const moveNumber = parseInt(parts[5]) || 1;

            // Reset board
            this.board = Array(ROWS).fill().map(() => Array(COLS).fill(null));
            const rows = boardFen.split('/');
            if (rows.length !== ROWS) {
                console.error('Invalid number of rows in FEN:', rows.length);
                return false;
            }

            const reverseFenMap = REVERSE_FEN_MAP;

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
                            x++;
                        } else {
                            console.warn(`Unknown FEN symbol at row ${y}, col ${x}: ${char}`);
                            x++;
                        }
                    }
                }
            }

            // Update game state
            this.currentTurn = turn === 'w' ? 'red' : 'black';
            this.moveCount = moveNumber;
            this.moveHistory = []; // Clear history
            this.currentMoveIndex = -1;
            this.fenBoardSnapshot = null;
            this.startingFen = fen;

            // Establish NEW authoritative initial position for resets/navigation
            this.saveInitialBoard();

            return true;
        } catch (err) {
            console.error('Error importing FEN:', err);
            return false;
        }
    }

    setupInitialPosition() {
        const initialSetup = [
            { name: "車", color: "red", x: 0, y: 9 }, { name: "車", color: "red", x: 8, y: 9 },
            { name: "馬", color: "red", x: 1, y: 9 }, { name: "馬", color: "red", x: 7, y: 9 },
            { name: "象", color: "red", x: 2, y: 9 }, { name: "象", color: "red", x: 6, y: 9 },
            { name: "仕", color: "red", x: 3, y: 9 }, { name: "仕", color: "red", x: 5, y: 9 },
            { name: "帥", color: "red", x: 4, y: 9 },
            { name: "炮", color: "red", x: 1, y: 7 }, { name: "炮", color: "red", x: 7, y: 7 },
            { name: "兵", color: "red", x: 0, y: 6 }, { name: "兵", color: "red", x: 2, y: 6 },
            { name: "兵", color: "red", x: 4, y: 6 }, { name: "兵", color: "red", x: 6, y: 6 },
            { name: "兵", color: "red", x: 8, y: 6 },
            { name: "車", color: "black", x: 0, y: 0 }, { name: "車", color: "black", x: 8, y: 0 },
            { name: "馬", color: "black", x: 1, y: 0 }, { name: "馬", color: "black", x: 7, y: 0 },
            { name: "相", color: "black", x: 2, y: 0 }, { name: "相", color: "black", x: 6, y: 0 },
            { name: "士", color: "black", x: 3, y: 0 }, { name: "士", color: "black", x: 5, y: 0 },
            { name: "將", color: "black", x: 4, y: 0 },
            { name: "砲", color: "black", x: 1, y: 2 }, { name: "砲", color: "black", x: 7, y: 2 },
            { name: "卒", color: "black", x: 0, y: 3 }, { name: "卒", color: "black", x: 2, y: 3 },
            { name: "卒", color: "black", x: 4, y: 3 }, { name: "卒", color: "black", x: 6, y: 3 },
            { name: "卒", color: "black", x: 8, y: 3 }
        ];

        initialSetup.forEach(piece => {
            this.board[piece.y][piece.x] = { name: piece.name, color: piece.color };
        });
    }

    exportFen() {
        this.fenBoardSnapshot = this.getBoardSnapshot();
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
                    const fenSymbol = pieceToFenChar(piece);
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
        fen += ` ${this.currentTurn === 'red' ? 'w' : 'b'} - - 0 ${this.moveCount}`;
        return fen;
    }

    saveInitialBoard() {
        this.initialBoard = this.getBoardSnapshot();
        this.initialTurn = this.currentTurn;
        this.initialMoveCount = this.moveCount;
    }

    getPiece(x, y) {
        if (typeof x !== 'number' || typeof y !== 'number' || isNaN(x) || isNaN(y)) return null;
        if (!this.board || !this.board[y] || !this.isValidPosition(x, y)) return null;
        return this.board[y][x];
    }

    isValidPosition(x, y) {
        return x >= 0 && x < COLS && y >= 0 && y < ROWS;
    }

    move(fromX, fromY, toX, toY, isAnalysis = false) {
        if (!this.isValidPosition(fromX, fromY) || !this.isValidPosition(toX, toY)) return false;
        const piece = this.board[fromY][fromX];
        if (!piece) return false;

        if (!isAnalysis) {
            if (piece.color !== this.currentTurn) return false;
            const legalMoves = this.getLegalMoves(fromX, fromY);
            const isLegal = legalMoves.some(([mx, my]) => mx === toX && my === toY);
            if (!isLegal) return false;
        }

        const capturedPiece = this.board[toY][toX];
        if (!isAnalysis) {
            // SNAPSHOT NOTATION: We MUST calculate the notation while the board reflects the moment of the move.
            // This includes disambiguation (getPiecesInColumn) which requires the UNCHANGED board.
            const moveNotation = this.calculateMoveNotation({ fromX, fromY, toX, toY, piece: { ...piece } });

            this.moveHistory = this.moveHistory.slice(0, this.currentMoveIndex + 1);
            this.moveHistory.push({
                fromX,
                fromY,
                toX,
                toY,
                capturedPiece,
                currentTurn: this.currentTurn,
                piece: { ...piece },
                moveNotation, // Store immutable string for future history retrieval
                note: "",
                variation: []
            });
        }

        this.board[toY][toX] = piece;
        this.board[fromY][fromX] = null;

        if (this.isKingInCheck(piece.color)) {
            this.board[fromY][fromX] = piece;
            this.board[toY][toX] = capturedPiece;
            if (!isAnalysis) {
                this.moveHistory.pop();
            }
            return false;
        }

        if (!isAnalysis) {
            this.currentMoveIndex++;
        }
        
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
            case "兵": case "卒": moves = this.getSoldierMoves(x, y, piece.color); break;
            case "炮": case "砲": moves = this.getCannonMoves(x, y, piece.color); break;
            case "車": moves = this.getRookMoves(x, y, piece.color); break;
            case "馬": case "马": moves = this.getKnightMoves(x, y, piece.color); break;
            case "相": case "象": moves = this.getElephantMoves(x, y, piece.color); break;
            case "仕": case "士": moves = this.getGuardMoves(x, y, piece.color); break;
            case "帥": case "將": moves = this.getKingMoves(x, y, piece.color); break;
            default: return [];
        }
        return moves;
    }

    getLegalMoves(x, y) {
        const piece = this.getPiece(x, y);
        if (!piece) return [];
        const rawMoves = this.getRawMoves(x, y);
        return rawMoves.filter(([toX, toY]) => {
            const originalPiece = this.board[y][x];
            const targetPiece = this.board[toY][toX];
            this.board[toY][toX] = originalPiece;
            this.board[y][x] = null;
            const inCheck = this.isKingInCheck(piece.color);
            this.board[y][x] = originalPiece;
            this.board[toY][toX] = targetPiece;
            return !inCheck;
        });
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
        if (!this.isKingInCheck(color)) return false;
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
                        if (!stillInCheck) return false;
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
                if (piece && (piece.name === "帥" || piece.name === "將") && piece.color === color) {
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
        for (let y = minY + 1; y < maxY; y++) if (this.board[y][redKing.x]) return false;
        return true;
    }

    getSoldierMoves(x, y, color) {
        let moves = [];
        if (color === "red") {
            if (y > 0) moves.push([x, y - 1]);
            if (y <= 4) { if (x > 0) moves.push([x - 1, y]); if (x < 8) moves.push([x + 1, y]); }
        } else {
            if (y < 9) moves.push([x, y + 1]);
            if (y >= 5) { if (x > 0) moves.push([x - 1, y]); if (x < 8) moves.push([x + 1, y]); }
        }
        return moves.filter(([nx, ny]) => this.isValidPosition(nx, ny));
    }

    getCannonMoves(x, y, color) {
        let moves = [];
        const directions = [[0, 1], [0, -1], [1, 0], [-1, 0]];
        directions.forEach(([dx, dy]) => {
            let nx = x, ny = y, jumpCount = 0;
            while (this.isValidPosition(nx + dx, ny + dy)) {
                nx += dx; ny += dy;
                const pieceAt = this.board[ny][nx];
                if (jumpCount === 0) { if (!pieceAt) moves.push([nx, ny]); else jumpCount++; }
                else if (jumpCount === 1) { if (pieceAt) { if (pieceAt.color !== color) moves.push([nx, ny]); break; } }
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
                nx += dx; ny += dy;
                const pieceAt = this.board[ny][nx];
                if (pieceAt) { if (pieceAt.color !== color) moves.push([nx, ny]); break; }
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
        if (!piece) return false;
        this.board[move.fromY][move.fromX] = piece;
        this.board[move.toY][move.toX] = move.capturedPiece;
        this.currentTurn = move.currentTurn;
        if (this.currentTurn === "black" && this.moveCount > 1) this.moveCount--;
        this.currentMoveIndex--;
        return true;
    }

    redo() {
        if (this.currentMoveIndex >= this.moveHistory.length - 1) return false;
        this.currentMoveIndex++;
        const move = this.moveHistory[this.currentMoveIndex];
        if (!move) return false;

        let piece = this.board[move.fromY][move.fromX];
        if (!piece) {
            // Case: timeline corruption or jump. Re-hydrate from history snapshot.
            piece = { ...move.piece };
        }

        this.board[move.toY][move.toX] = piece;
        this.board[move.fromY][move.fromX] = null;

        const previousTurn = this.currentTurn;
        this.currentTurn = this.currentTurn === "red" ? "black" : "red";
        if (previousTurn === "black" && this.currentTurn === "red") this.moveCount++;
        return true;
    }

    resetToInitial() {
        if (!this.initialBoard) return false;
        this.board = this.initialBoard.map(row => row.map(cell => (cell ? { ...cell } : null)));
        this.currentTurn = this.initialTurn || "red";
        this.moveCount = this.initialMoveCount || 1;
        this.currentMoveIndex = -1;
        return true;
    }

    resetGame() {
        this.board = Array(ROWS).fill().map(() => Array(COLS).fill(null));
        this.currentTurn = "red";
        this.moveHistory = [];
        this.currentMoveIndex = -1;
        this.moveCount = 1;
        this.startingFen = DEFAULT_FEN;
        this.setupInitialPosition();
        this.saveInitialBoard();
        return true;
    }

    goToMove(index) {
        if (!this.initialBoard || !Array.isArray(this.moveHistory)) return false;
        if (typeof index !== "number" || index < -1 || index >= this.moveHistory.length) return false;
        this.board = this.initialBoard.map(row => row.map(cell => (cell ? { ...cell } : null)));
        this.currentTurn = this.initialTurn || "red";
        this.moveCount = this.initialMoveCount || 1;
        this.currentMoveIndex = -1;
        for (let i = 0; i <= index; i++) {
            const move = this.moveHistory[i];
            if (move) {
                const piece = this.board[move.fromY][move.fromX];
                if (!piece) return false;
                this.board[move.toY][move.toX] = piece;
                this.board[move.fromY][move.fromX] = null;
                const previousTurn = this.currentTurn;
                this.currentTurn = this.currentTurn === "red" ? "black" : "red";
                if (previousTurn === "black" && this.currentTurn === "red") this.moveCount++;
                this.currentMoveIndex = i;
            }
        }
        return true;
    }

    getMoveHistory() {
        if (!this.moveHistory || !Array.isArray(this.moveHistory)) return [];
        // PURE READ: Just return the stored immutable snapshots
        return this.moveHistory.map(move => ({ ...move }));
    }

    exportGame() {
        return JSON.stringify({
            moveHistory: this.moveHistory, currentMoveIndex: this.currentMoveIndex,
            initialBoard: this.initialBoard, initialTurn: this.initialTurn,
            initialMoveCount: this.initialMoveCount, startingFen: this.startingFen
        });
    }

    importGame(json) {
        try {
            const data = typeof json === 'string' ? JSON.parse(json) : json;
            // Support legacy JSON without startingFen
            this.initialBoard = data.initialBoard;
            this.initialTurn = data.initialTurn || "red";
            this.initialMoveCount = data.initialMoveCount || 1;
            this.startingFen = data.startingFen || DEFAULT_FEN;
            this.moveHistory = data.moveHistory || [];
            return this.goToMove(data.currentMoveIndex);
        } catch (err) { console.error('Error importing JSON:', err); return false; }
    }

    exportPgn() {
        let pgn = '[Event "Xiangqi Match"]\n';
        pgn += `[Date "${new Date().toISOString().split('T')[0]}"]\n`;
        pgn += `[FEN "${this.startingFen}"]\n\n`;
        for (let i = 0; i < this.moveHistory.length; i += 2) {
            pgn += `${Math.floor(i / 2) + 1}. ${this.toICCS(this.moveHistory[i])} `;
            if (this.moveHistory[i + 1]) pgn += `${this.toICCS(this.moveHistory[i + 1])} `;
            pgn += '\n';
        }
        return pgn;
    }

    setFlipped(isFlipped) {
        this._flipped = !!isFlipped;
    }

    isFlipped() {
        return this._flipped;
    }

    getGameState() {
        const lastMove = this.currentMoveIndex >= 0 ? this.moveHistory[this.currentMoveIndex] : null;
        return {
            fen: this.exportFen(), board: this.getBoardSnapshot(),
            currentTurn: this.currentTurn, moveCount: this.moveCount,
            currentMoveIndex: this.currentMoveIndex, moveHistory: this.getMoveHistory(),
            isCheck: this.isKingInCheck(this.currentTurn), isCheckmate: this.isCheckmate(this.currentTurn),
            lastMove: lastMove ? { ...lastMove } : null,
            flipped: this._flipped
        };
    }

    toICCS(move) { return iccsFromMove(move); }
    getPieceNotation(piece) { return getPieceNotationSymbol(piece); }
    getPositionNotation(x, y) { return positionNotation(x, y); }
    getPiecesInColumn(pieceName, col, color) {
        const pieces = [];
        for (let y = 0; y < 10; y++) {
            const p = this.board[y][col];
            if (p && p.name === pieceName && p.color === color) pieces.push({ x: col, y });
        }
        return pieces;
    }

    calculateMoveNotation(move) {
        if (!move || typeof move.fromX === 'undefined') return "Invalid Move";
        const piece = move.piece; if (!piece) return "Unknown Move";
        const pieceNotation = this.getPieceNotation(piece); if (!pieceNotation) return "Invalid Piece";
        const fromCol = piece.color === "red" ? (9 - move.fromX) : (move.fromX + 1);
        const toCol = piece.color === "red" ? (9 - move.toX) : (move.toX + 1);
        const deltaY = move.toY - move.fromY; const absDeltaY = Math.abs(deltaY);
        let symb = "", dist = 0;
        if (DIAGONAL_PIECES.has(piece.name)) {
            symb = deltaY > 0 ? (piece.color === "red" ? "-" : "+") : (piece.color === "red" ? "+" : "-");
            dist = toCol;
        } else {
            if (deltaY === 0) { symb = "="; dist = toCol; }
            else { symb = deltaY < 0 ? (piece.color === "red" ? "+" : "-") : (piece.color === "red" ? "-" : "+"); dist = absDeltaY; }
        }
        const same = this.getPiecesInColumn(piece.name, move.fromX, piece.color);
        let prefix = pieceNotation;
        if (same.length > 1) {
            same.sort((a, b) => piece.color === "red" ? b.y - a.y : a.y - b.y);
            const idx = same.findIndex(p => p.y === move.fromY);
            prefix = piece.color === "red" ? `${idx + 1}${pieceNotation}` : `${pieceNotation}${idx + 1}`;
        }
        return `${prefix}${fromCol}${symb}${dist}`;
    }

    getBoardSnapshot() { return this.board.map(row => row.map(cell => (cell ? { ...cell } : null))); }
}

module.exports = XiangqiGame;
