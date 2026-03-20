// game.js
const ROWS = 10;
const COLS = 9;

class XiangqiGame {
    constructor() {
        this.currentTurn = "red";
        this.moveHistory = []; // LÆ°u lá»‹ch sá»­ cÃ¡c nÆ°á»›c Ä‘i
        this.currentMoveIndex = -1; // Chá»‰ sá»‘ cá»§a nÆ°á»›c Ä‘i hiá»‡n táº¡i
        this.initialBoard = null;
        this.board = Array(ROWS).fill().map(() => Array(COLS).fill(null));
        this.moveCount = 1; // Khá»Ÿi táº¡o sá»‘ nÆ°á»›c Ä‘i
        this.setupInitialPosition();
        this.saveInitialBoard();
        this.fenBoardSnapshot = null; // LÆ°u tráº¡ng thÃ¡i bÃ n cá» táº¡i thá»i Ä‘iá»ƒm FEN
        // Ãnh xáº¡ tÃªn quÃ¢n cá» sang kÃ½ hiá»‡u FEN
        this.fenMap = {
            "è»Š": "r", // Xe
            "é¦¬": "n", // MÃ£
            "é©¬": "n", // MÃ£ (kÃ½ tá»± khÃ¡c)
            "è±¡": "b", // TÆ°á»£ng
            "ç›¸": "b", // TÆ°á»£ng (kÃ½ tá»± khÃ¡c)
            "ä»•": "a", // SÄ©
            "å£«": "a", // SÄ© (kÃ½ tá»± khÃ¡c)
            "å¸…": "k", // TÆ°á»›ng (Ä‘á»)
            "å°†": "k", // TÆ°á»›ng (Ä‘en)
            "ç‚®": "c", // PhÃ¡o
            "ç ²": "c", // PhÃ¡o (kÃ½ tá»± khÃ¡c)
            "å…µ": "p", // Tá»‘t (Ä‘á»)
            "å’": "p"  // Tá»‘t (Ä‘en)
        };
    }

    // HÃ m chuyá»ƒn Ä‘á»•i quÃ¢n cá» thÃ nh kÃ½ hiá»‡u FEN
    pieceToFen(piece) {
        if (!piece) return null;
        let symbol = this.fenMap[piece.name];
        if (!symbol) return null;
        // QuÃ¢n Ä‘á»: in hoa, quÃ¢n Ä‘en: in thÆ°á»ng
        return piece.color === "red" ? symbol.toUpperCase() : symbol.toLowerCase();
    }
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
                'r': "è»Š", 'R': "è»Š",
                'n': "é©¬", 'N': "é¦¬",
                'b': "ç›¸", 'B': "è±¡",
                'a': "å£«", 'A': "ä»•",
                'k': "å°†", 'K': "å¸…",
                'c': "ç ²", 'C': "ç‚®",
                'p': "å’", 'P': "å…µ"
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
                            // Kiá»ƒm tra sá»‘ lÆ°á»£ng vua
                            if (pieceName === "å¸…" && color === "red") kingRedCount++;
                            if (pieceName === "å°†" && color === "black") kingBlackCount++;
                            x++;
                        } else {
                            console.warn(`Unknown FEN symbol at row ${y}, col ${x}: ${char}`);
                            x++;
                        }
                    }
                }
            }

            // Kiá»ƒm tra lá»—i FEN
            if (kingRedCount !== 1 || kingBlackCount !== 1) {
                console.error(`Invalid FEN: Red kings: ${kingRedCount}, Black kings: ${kingBlackCount}`);
                return false;
            }

            this.currentTurn = turn === 'w' ? 'red' : 'black';
            this.moveCount = moveNumber;
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
            { name: "è»Š", color: "red", x: 0, y: 9 }, { name: "è»Š", color: "red", x: 8, y: 9 },
            { name: "é¦¬", color: "red", x: 1, y: 9 }, { name: "é¦¬", color: "red", x: 7, y: 9 },
            { name: "è±¡", color: "red", x: 2, y: 9 }, { name: "è±¡", color: "red", x: 6, y: 9 },
            { name: "ä»•", color: "red", x: 3, y: 9 }, { name: "ä»•", color: "red", x: 5, y: 9 },
            { name: "å¸…", color: "red", x: 4, y: 9 },
            { name: "ç‚®", color: "red", x: 1, y: 7 }, { name: "ç‚®", color: "red", x: 7, y: 7 },
            { name: "å…µ", color: "red", x: 0, y: 6 }, { name: "å…µ", color: "red", x: 2, y: 6 },
            { name: "å…µ", color: "red", x: 4, y: 6 }, { name: "å…µ", color: "red", x: 6, y: 6 },
            { name: "å…µ", color: "red", x: 8, y: 6 },
            { name: "è»Š", color: "black", x: 0, y: 0 }, { name: "è»Š", color: "black", x: 8, y: 0 },
            { name: "é©¬", color: "black", x: 1, y: 0 }, { name: "é©¬", color: "black", x: 7, y: 0 },
            { name: "ç›¸", color: "black", x: 2, y: 0 }, { name: "ç›¸", color: "black", x: 6, y: 0 },
            { name: "å£«", color: "black", x: 3, y: 0 }, { name: "å£«", color: "black", x: 5, y: 0 },
            { name: "å°†", color: "black", x: 4, y: 0 },
            { name: "ç ²", color: "black", x: 1, y: 2 }, { name: "ç ²", color: "black", x: 7, y: 2 },
            { name: "å’", color: "black", x: 0, y: 3 }, { name: "å’", color: "black", x: 2, y: 3 },
            { name: "å’", color: "black", x: 4, y: 3 }, { name: "å’", color: "black", x: 6, y: 3 },
            { name: "å’", color: "black", x: 8, y: 3 }
        ];

        initialSetup.forEach(piece => {
            this.board[piece.y][piece.x] = { name: piece.name, color: piece.color };
        });
    }
    exportFen() {
        // LÆ°u tráº¡ng thÃ¡i bÃ n cá» trÆ°á»›c khi xuáº¥t FEN
        this.fenBoardSnapshot = this.board.map(row => row.map(cell => (cell ? { ...cell } : null)));
        // Logic Ä‘á»ƒ táº¡o chuá»—i FEN tá»« tráº¡ng thÃ¡i bÃ n cá»
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
                    //fen += piece.toFen(); // Giáº£ Ä‘á»‹nh má»—i quÃ¢n cá» cÃ³ hÃ m toFen()
                    const fenSymbol = this.pieceToFen(piece);
                    if (fenSymbol) {
                        fen += fenSymbol;
                    } else {
                        console.warn(`Unknown piece at (${x}, ${y}):`, piece);
                        fen += '?'; // Placeholder cho quÃ¢n cá» khÃ´ng xÃ¡c Ä‘á»‹nh
                    }
                }
            }
            if (emptyCount > 0) fen += emptyCount;
            if (y < 9) fen += '/';
        }
        fen += ` ${this.currentTurn === 'red' ? 'w' : 'b'} - - 0 ${this.moveCount || 1}`;
        return fen;
    }

    // HÃ m láº¥y quÃ¢n cá» tá»« snapshot (náº¿u cÃ³), náº¿u khÃ´ng thÃ¬ tá»« bÃ n cá» hiá»‡n táº¡i
    getPieceForNotation(x, y) {
        if (this.fenBoardSnapshot && this.fenBoardSnapshot[y] && this.fenBoardSnapshot[y][x]) {
            return this.fenBoardSnapshot[y][x];
        }
        return this.getPiece(x, y);
    }

    saveInitialBoard() {
        this.initialBoard = this.board.map(row => row.map(cell => (cell ? { ...cell } : null)));
    }

    // saveState() {
    //     if (!Array.isArray(this.history)) {
    //         console.error('this.history is not an array, resetting to []');
    //         this.history = [];
    //     }
    //     if (typeof this.currentStep !== 'number' || isNaN(this.currentStep)) {
    //         console.error('this.currentStep is not a number, resetting to -1');
    //         this.currentStep = -1;
    //     }

    //     this.history = this.history.slice(0, this.currentStep + 1);
    //     this.history.push({
    //         board: this.board.map(row => row.map(cell => (cell ? { ...cell } : null))),
    //         currentTurn: this.currentTurn
    //     });
    //     this.currentStep++;
    // }

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
        if (capturedPiece && capturedPiece.name === (piece.color === "red" ? "å°†" : "å¸…")) {
            console.warn(`Attempted to capture opponent's king at (${toX}, ${toY})`);
            return false; // KhÃ´ng cho phÃ©p Äƒn vua Ä‘á»‘i phÆ°Æ¡ng
        }

        // LÆ°u lá»‹ch sá»­ nÆ°á»›c Ä‘i
        this.moveHistory = this.moveHistory.slice(0, this.currentMoveIndex + 1);
        const fenBefore = this.exportFen(); // LÆ°u FEN trÆ°á»›c khi di chuyá»ƒn Ä‘á»ƒ debug
        this.board[toY][toX] = piece;
        this.board[fromY][fromX] = null;

        // Kiá»ƒm tra chiáº¿u sau khi di chuyá»ƒn
        if (this.isKingInCheck(piece.color)) {
            this.board[fromY][fromX] = piece;
            this.board[toY][toX] = capturedPiece;
            return false;
        }

        // LÆ°u nÆ°á»›c Ä‘i vá»›i FEN sau khi di chuyá»ƒn
        const fenAfter = this.exportFen();
        const moveEntry = {
            fromX,
            fromY,
            toX,
            toY,
            capturedPiece,
            currentTurn: this.currentTurn,
            piece: { name: piece.name, color: piece.color }, // Äáº£m báº£o sao chÃ©p chÃ­nh xÃ¡c
            fen: fenAfter // ThÃªm FEN vÃ o lá»‹ch sá»­
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

    // move(fromX, fromY, toX, toY) {
    //     const piece = this.getPiece(fromX, fromY);
    //     if (!piece || piece.color !== this.currentTurn) return false;

    //     const legalMoves = this.getLegalMoves(fromX, fromY);
    //     if (!legalMoves.some(([mx, my]) => mx === toX && my === toY)) return false;

    //     const target = this.getPiece(toX, toY);
    //     this.board[toY][toX] = piece;
    //     this.board[fromY][fromX] = null;

    //     if (this.isKingInCheck(piece.color)) {
    //         this.board[fromY][fromX] = piece;
    //         this.board[toY][toX] = target;
    //         return false;
    //     }

    //     this.currentTurn = this.currentTurn === "red" ? "black" : "red";
    //     return true;
    // }

    // HÃ m má»›i: TÃ­nh nÆ°á»›c Ä‘i thÃ´ (khÃ´ng kiá»ƒm tra chiáº¿u)
    getRawMoves(x, y) {
        const piece = this.getPiece(x, y);
        if (!piece) return [];

        let moves = [];
        switch (piece.name) {
            case "å…µ": case "å’": moves = this.getSoldierMoves(x, y, piece.color); break;
            case "ç‚®": case "ç ²": moves = this.getCannonMoves(x, y, piece.color); break;
            case "è»Š": moves = this.getRookMoves(x, y, piece.color); break;
            case "é¦¬": case "é©¬": moves = this.getKnightMoves(x, y, piece.color); break;
            case "ç›¸": case "è±¡": moves = this.getElephantMoves(x, y, piece.color); break;
            case "ä»•": case "å£«": moves = this.getGuardMoves(x, y, piece.color); break;
            case "å¸…": case "å°†": moves = this.getKingMoves(x, y, piece.color); break;
            default: return [];
        }
        return moves;
    }

    // getLegalMoves(x, y) {
    //     const piece = this.getPiece(x, y);
    //     if (!piece) return [];

    //     const moves = this.getRawMoves(x, y);
    //     return moves.filter(([toX, toY]) => {
    //         const original = this.board[y][x];
    //         const target = this.board[toY][toX];
    //         this.board[toY][toX] = original;
    //         this.board[y][x] = null;

    //         const inCheck = this.isKingInCheck(piece.color);
    //         this.board[y][x] = original;
    //         this.board[toY][toX] = target;

    //         return !inCheck;
    //     });
    // }
    getLegalMoves(x, y) {
        const piece = this.getPiece(x, y);
        if (!piece) return [];

        // Láº¥y cÃ¡c nÆ°á»›c Ä‘i thÃ´ (khÃ´ng kiá»ƒm tra chiáº¿u)
        const rawMoves = this.getRawMoves(x, y);

        // Lá»c cÃ¡c nÆ°á»›c Ä‘i Ä‘á»ƒ Ä‘áº£m báº£o khÃ´ng Ä‘á»ƒ vua bá»‹ chiáº¿u sau khi di chuyá»ƒn
        const legalMoves = rawMoves.filter(([toX, toY]) => {
            // Thá»­ di chuyá»ƒn
            const originalPiece = this.board[y][x];
            const targetPiece = this.board[toY][toX];
            this.board[toY][toX] = originalPiece;
            this.board[y][x] = null;

            // Kiá»ƒm tra xem vua cá»§a bÃªn mÃ¬nh cÃ³ bá»‹ chiáº¿u khÃ´ng
            const inCheck = this.isKingInCheck(piece.color);

            // HoÃ n tÃ¡c di chuyá»ƒn
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
                    // Sá»­ dá»¥ng getRawMoves thay vÃ¬ getLegalMoves Ä‘á»ƒ trÃ¡nh Ä‘á»‡ quy
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
        // Kiá»ƒm tra xem vua cá»§a color cÃ³ bá»‹ chiáº¿u bÃ­ hay khÃ´ng
        // 1. Kiá»ƒm tra xem vua cÃ³ bá»‹ chiáº¿u khÃ´ng
        if (!this.isKingInCheck(color)) {
            return false;
        }

        // 2. Kiá»ƒm tra xem cÃ³ nÆ°á»›c Ä‘i nÃ o Ä‘á»ƒ thoÃ¡t chiáº¿u khÃ´ng
        for (let y = 0; y < ROWS; y++) {
            for (let x = 0; x < COLS; x++) {
                const piece = this.getPiece(x, y);
                if (piece && piece.color === color) {
                    const moves = this.getLegalMoves(x, y);
                    for (const [toX, toY] of moves) {
                        // Thá»­ di chuyá»ƒn vÃ  kiá»ƒm tra xem cÃ³ thoÃ¡t chiáº¿u khÃ´ng
                        const originalPiece = this.board[y][x];
                        const targetPiece = this.board[toY][toX];
                        this.board[toY][toX] = originalPiece;
                        this.board[y][x] = null;

                        const stillInCheck = this.isKingInCheck(color);

                        // HoÃ n tÃ¡c di chuyá»ƒn
                        this.board[y][x] = originalPiece;
                        this.board[toY][toX] = targetPiece;

                        if (!stillInCheck) {
                            return false; // CÃ³ nÆ°á»›c Ä‘i Ä‘á»ƒ thoÃ¡t chiáº¿u
                        }
                    }
                }
            }
        }

        return true; // KhÃ´ng cÃ³ nÆ°á»›c Ä‘i nÃ o Ä‘á»ƒ thoÃ¡t chiáº¿u -> chiáº¿u bÃ­
    }

    findKing(color) {
        for (let y = 0; y < ROWS; y++) {
            for (let x = 0; x < COLS; x++) {
                const piece = this.board[y][x];
                if (piece && piece.name === (color === "red" ? "å¸…" : "å°†") && piece.color === color) {
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
            let jumpCount = 0; // Äáº¿m sá»‘ quÃ¢n Ä‘Ã£ nháº£y qua (bá»‡ phÃ¡o)

            while (this.isValidPosition(nx + dx, ny + dy)) {
                nx += dx;
                ny += dy;
                const pieceAt = this.board[ny][nx];

                if (jumpCount === 0) {
                    // ChÆ°a nháº£y qua quÃ¢n nÃ o: cÃ³ thá»ƒ di chuyá»ƒn Ä‘áº¿n Ã´ trá»‘ng
                    if (!pieceAt) {
                        moves.push([nx, ny]);
                    } else {
                        // Gáº·p quÃ¢n Ä‘áº§u tiÃªn: tÄƒng jumpCount
                        jumpCount++;
                    }
                } else if (jumpCount === 1) {
                    // ÄÃ£ nháº£y qua má»™t quÃ¢n: kiá»ƒm tra Ã´ Ä‘Ã­ch
                    if (pieceAt) {
                        // Náº¿u Ã´ Ä‘Ã­ch cÃ³ quÃ¢n vÃ  lÃ  quÃ¢n Ä‘á»‹ch, cÃ³ thá»ƒ Äƒn
                        if (pieceAt.color !== color) {
                            moves.push([nx, ny]);
                        }
                        break; // DÃ¹ cÃ³ Äƒn Ä‘Æ°á»£c hay khÃ´ng, dá»«ng láº¡i sau khi gáº·p quÃ¢n thá»© hai
                    }
                    // Náº¿u Ã´ trá»‘ng, khÃ´ng thá»ƒ di chuyá»ƒn tiáº¿p (PhÃ¡o khÃ´ng di chuyá»ƒn qua bá»‡ phÃ¡o mÃ  khÃ´ng Äƒn)
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

        // KhÃ´i phá»¥c tráº¡ng thÃ¡i bÃ n cá»
        const piece = this.board[move.toY][move.toX];
        this.board[move.fromY][move.fromX] = piece;
        this.board[move.toY][move.toX] = move.capturedPiece; // KhÃ´i phá»¥c quÃ¢n cá» bá»‹ Äƒn (náº¿u cÃ³)
        this.currentTurn = move.currentTurn; // KhÃ´i phá»¥c lÆ°á»£t chÆ¡i
        // Giáº£m moveCount náº¿u quay láº¡i tá»« Ä‘á» vá» Ä‘en
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

        // Ãp dá»¥ng láº¡i nÆ°á»›c Ä‘i
        const piece = this.board[move.fromY][move.fromX];
        this.board[move.toY][move.toX] = piece;
        this.board[move.fromY][move.fromX] = null;
        const previousTurn = this.currentTurn;
        this.currentTurn = this.currentTurn === "red" ? "black" : "red";
        // TÄƒng moveCount náº¿u Ä‘i tá»« Ä‘en sang Ä‘á»
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
        this.moveCount = 1; // Äáº·t láº¡i moveCount
        return true;
    }

    resetGame() {
        this.board = Array(ROWS).fill().map(() => Array(COLS).fill(null));
        this.currentTurn = "red";
        this.moveHistory = [];
        this.currentMoveIndex = -1;
        this.moveCount = 1; // Äáº·t láº¡i moveCount
        this.setupInitialPosition();
        this.saveInitialBoard();
        return true;
    }

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

            // Äáº·t láº¡i bÃ n cá» vá» tráº¡ng thÃ¡i ban Ä‘áº§u
            if (this.initialBoard) {
                this.board = this.initialBoard.map(row => row.map(cell => (cell ? { ...cell } : null)));
            } else {
                this.board = Array(ROWS).fill().map(() => Array(COLS).fill(null));
                this.setupInitialPosition();
                this.saveInitialBoard();
            }
            this.currentTurn = "red";

            // Ãp dá»¥ng láº¡i cÃ¡c nÆ°á»›c Ä‘i
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

    // Chuyá»ƒn Ä‘á»•i tÃªn quÃ¢n cá» sang kÃ½ hiá»‡u ngáº¯n gá»n
    getPieceNotation(piece) {
        if (!piece) return "";
        const notationMap = {
            "å…µ": "P", "å’": "P", // Tá»‘t
            "ç‚®": "C", "ç ²": "C", // PhÃ¡o
            "é¦¬": "N", "é©¬": "N", // MÃ£
            "è±¡": "B", "ç›¸": "B", // TÆ°á»£ng
            "è»Š": "R", "è½¦": "R", // Xe
            "ä»•": "A", "å£«": "A", // SÄ©
            "å¸…": "K", "å°†": "K"  // TÆ°á»›ng/Vua
        };
        return notationMap[piece.name] || piece.name;
    }

    // Chuyá»ƒn Ä‘á»•i tá»a Ä‘á»™ (x, y) thÃ nh Ä‘á»‹nh dáº¡ng C2=5
    getPositionNotation(x, y) {
        const col = x + 1; // Cá»™t tá»« 1 Ä‘áº¿n 9 (x tá»« 0 Ä‘áº¿n 8)
        const row = 10 - y; // HÃ ng tá»« 1 Ä‘áº¿n 10 (y tá»« 0 Ä‘áº¿n 9, Ä‘áº£o ngÆ°á»£c)
        return `${col}.${row}`;
    }

    // TÃ¬m táº¥t cáº£ cÃ¡c quÃ¢n cÃ¹ng loáº¡i trÃªn cÃ¹ng má»™t cá»™t
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
    // Táº¡o kÃ½ hiá»‡u nÆ°á»›c Ä‘i (C2+2, -C+2, v.v.)
    getMoveNotation(move) {
        if (!move || typeof move.fromX === 'undefined' || typeof move.fromY === 'undefined' ||
            typeof move.toX === 'undefined' || typeof move.toY === 'undefined') {
            console.error('Invalid move object:', move);
            return "Invalid Move";
        }

        // Æ¯u tiÃªn sá»­ dá»¥ng move.piece, náº¿u khÃ´ng cÃ³ thÃ¬ láº¥y tá»« this.board
        let piece = move.piece;
        if (!piece) {
            console.warn('No piece information in move object, attempting to fetch from board:', move);
            piece = this.getPieceForNotation(move.fromX, move.fromY);
            if (!piece) {
                console.warn('No piece found at from position on current board:', move);
                return "Unknown Move";
            }
        }
        // Sá»­ dá»¥ng kÃ½ hiá»‡u Latin thay vÃ¬ tÃªn Trung Quá»‘c Ä‘á»ƒ trÃ¡nh lá»—i hiá»ƒn thá»‹
        const fenSymbol = this.pieceToFen(piece) || piece.name;
        const pieceNotation = this.getPieceNotation(piece);
        if (!pieceNotation) return "Invalid Piece";

        const fromCol = piece.color === "red" ? (9 - move.fromX) : (move.fromX + 1);
        const toCol = piece.color === "red" ? (9 - move.toX) : (move.toX + 1);
        const deltaY = move.toY - move.fromY;
        const absDeltaY = Math.abs(deltaY);

        let moveSymbol = "";
        let moveDistance = 0;

        if (["é¦¬", "é©¬", "è±¡", "ç›¸", "ä»•", "å£«"].includes(piece.name)) {
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
