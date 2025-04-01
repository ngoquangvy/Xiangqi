// game.js
const ROWS = 10;
const COLS = 9;

class XiangqiGame {
    constructor() {
        this.currentTurn = "red";
        this.moveHistory = []; // Lưu lịch sử các nước đi
        this.currentMoveIndex = -1; // Chỉ số của nước đi hiện tại
        this.initialBoard = null;
        this.board = Array(ROWS).fill().map(() => Array(COLS).fill(null));
        this.moveCount = 1; // Khởi tạo số nước đi
        this.setupInitialPosition();
        this.saveInitialBoard();
        this.fenBoardSnapshot = null; // Lưu trạng thái bàn cờ tại thời điểm FEN
        // Ánh xạ tên quân cờ sang ký hiệu FEN
        this.fenMap = {
            "車": "r", // Xe
            "馬": "n", // Mã
            "马": "n", // Mã (ký tự khác)
            "象": "b", // Tượng
            "相": "b", // Tượng (ký tự khác)
            "仕": "a", // Sĩ
            "士": "a", // Sĩ (ký tự khác)
            "帅": "k", // Tướng (đỏ)
            "将": "k", // Tướng (đen)
            "炮": "c", // Pháo
            "砲": "c", // Pháo (ký tự khác)
            "兵": "p", // Tốt (đỏ)
            "卒": "p"  // Tốt (đen)
        };
    }

    // Hàm chuyển đổi quân cờ thành ký hiệu FEN
    pieceToFen(piece) {
        if (!piece) return null;
        let symbol = this.fenMap[piece.name];
        if (!symbol) return null;
        // Quân đỏ: in hoa, quân đen: in thường
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
                'r': "車", 'R': "車",
                'n': "马", 'N': "馬",
                'b': "相", 'B': "象",
                'a': "士", 'A': "仕",
                'k': "将", 'K': "帅",
                'c': "砲", 'C': "炮",
                'p': "卒", 'P': "兵"
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
                            // Kiểm tra số lượng vua
                            if (pieceName === "帅" && color === "red") kingRedCount++;
                            if (pieceName === "将" && color === "black") kingBlackCount++;
                            x++;
                        } else {
                            console.warn(`Unknown FEN symbol at row ${y}, col ${x}: ${char}`);
                            x++;
                        }
                    }
                }
            }

            // Kiểm tra lỗi FEN
            if (kingRedCount !== 1 || kingBlackCount !== 1) {
                console.error(`Invalid FEN: Red kings: ${kingRedCount}, Black kings: ${kingBlackCount}`);
                return false;
            }

            this.currentTurn = turn === 'w' ? 'red' : 'black';
            this.moveCount = moveNumber;
            this.moveHistory = [];
            this.currentMoveIndex = -1;
            this.fenBoardSnapshot = null;

            console.log(`Imported FEN: ${fen}`);
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
            { name: "帅", color: "red", x: 4, y: 9 },
            { name: "炮", color: "red", x: 1, y: 7 }, { name: "炮", color: "red", x: 7, y: 7 },
            { name: "兵", color: "red", x: 0, y: 6 }, { name: "兵", color: "red", x: 2, y: 6 },
            { name: "兵", color: "red", x: 4, y: 6 }, { name: "兵", color: "red", x: 6, y: 6 },
            { name: "兵", color: "red", x: 8, y: 6 },
            { name: "車", color: "black", x: 0, y: 0 }, { name: "車", color: "black", x: 8, y: 0 },
            { name: "马", color: "black", x: 1, y: 0 }, { name: "马", color: "black", x: 7, y: 0 },
            { name: "相", color: "black", x: 2, y: 0 }, { name: "相", color: "black", x: 6, y: 0 },
            { name: "士", color: "black", x: 3, y: 0 }, { name: "士", color: "black", x: 5, y: 0 },
            { name: "将", color: "black", x: 4, y: 0 },
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
        // Lưu trạng thái bàn cờ trước khi xuất FEN
        this.fenBoardSnapshot = this.board.map(row => row.map(cell => (cell ? { ...cell } : null)));
        // Logic để tạo chuỗi FEN từ trạng thái bàn cờ
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
                    //fen += piece.toFen(); // Giả định mỗi quân cờ có hàm toFen()
                    const fenSymbol = this.pieceToFen(piece);
                    if (fenSymbol) {
                        fen += fenSymbol;
                    } else {
                        console.warn(`Unknown piece at (${x}, ${y}):`, piece);
                        fen += '?'; // Placeholder cho quân cờ không xác định
                    }
                }
            }
            if (emptyCount > 0) fen += emptyCount;
            if (y < 9) fen += '/';
        }
        fen += ` ${this.currentTurn === 'red' ? 'w' : 'b'} - - 0 ${this.moveCount || 1}`;
        return fen;
    }

    // Hàm lấy quân cờ từ snapshot (nếu có), nếu không thì từ bàn cờ hiện tại
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
        if (capturedPiece && capturedPiece.name === (piece.color === "red" ? "将" : "帅")) {
            console.warn(`Attempted to capture opponent's king at (${toX}, ${toY})`);
            return false; // Không cho phép ăn vua đối phương
        }

        // Lưu lịch sử nước đi
        this.moveHistory = this.moveHistory.slice(0, this.currentMoveIndex + 1);
        const fenBefore = this.exportFen(); // Lưu FEN trước khi di chuyển để debug
        this.board[toY][toX] = piece;
        this.board[fromY][fromX] = null;

        // Kiểm tra chiếu sau khi di chuyển
        if (this.isKingInCheck(piece.color)) {
            console.log(`Move rejected: ${piece.color} king in check after move`);
            this.board[fromY][fromX] = piece;
            this.board[toY][toX] = capturedPiece;
            return false;
        }

        // Lưu nước đi với FEN sau khi di chuyển
        const fenAfter = this.exportFen();
        const moveEntry = {
            fromX,
            fromY,
            toX,
            toY,
            capturedPiece,
            currentTurn: this.currentTurn,
            piece: { name: piece.name, color: piece.color }, // Đảm bảo sao chép chính xác
            fen: fenAfter // Thêm FEN vào lịch sử
        };
        this.moveHistory.push(moveEntry);

        this.currentMoveIndex++;
        const previousTurn = this.currentTurn;
        this.currentTurn = this.currentTurn === "red" ? "black" : "red";
        if (previousTurn === "black" && this.currentTurn === "red") {
            this.moveCount++;
        }

        console.log(`Move successful: ${this.getMoveNotation(moveEntry)}, New FEN: ${fenAfter}`);
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

    // Hàm mới: Tính nước đi thô (không kiểm tra chiếu)
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
            case "帅": case "将": moves = this.getKingMoves(x, y, piece.color); break;
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

        // Lấy các nước đi thô (không kiểm tra chiếu)
        const rawMoves = this.getRawMoves(x, y);

        // Lọc các nước đi để đảm bảo không để vua bị chiếu sau khi di chuyển
        const legalMoves = rawMoves.filter(([toX, toY]) => {
            // Thử di chuyển
            const originalPiece = this.board[y][x];
            const targetPiece = this.board[toY][toX];
            this.board[toY][toX] = originalPiece;
            this.board[y][x] = null;

            // Kiểm tra xem vua của bên mình có bị chiếu không
            const inCheck = this.isKingInCheck(piece.color);

            // Hoàn tác di chuyển
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
                    // Sử dụng getRawMoves thay vì getLegalMoves để tránh đệ quy
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
        // Kiểm tra xem vua của color có bị chiếu bí hay không
        // 1. Kiểm tra xem vua có bị chiếu không
        if (!this.isKingInCheck(color)) {
            return false;
        }

        // 2. Kiểm tra xem có nước đi nào để thoát chiếu không
        for (let y = 0; y < ROWS; y++) {
            for (let x = 0; x < COLS; x++) {
                const piece = this.getPiece(x, y);
                if (piece && piece.color === color) {
                    const moves = this.getLegalMoves(x, y);
                    for (const [toX, toY] of moves) {
                        // Thử di chuyển và kiểm tra xem có thoát chiếu không
                        const originalPiece = this.board[y][x];
                        const targetPiece = this.board[toY][toX];
                        this.board[toY][toX] = originalPiece;
                        this.board[y][x] = null;

                        const stillInCheck = this.isKingInCheck(color);

                        // Hoàn tác di chuyển
                        this.board[y][x] = originalPiece;
                        this.board[toY][toX] = targetPiece;

                        if (!stillInCheck) {
                            return false; // Có nước đi để thoát chiếu
                        }
                    }
                }
            }
        }

        return true; // Không có nước đi nào để thoát chiếu -> chiếu bí
    }

    findKing(color) {
        for (let y = 0; y < ROWS; y++) {
            for (let x = 0; x < COLS; x++) {
                const piece = this.board[y][x];
                if (piece && piece.name === (color === "red" ? "帅" : "将") && piece.color === color) {
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
            let jumpCount = 0; // Đếm số quân đã nhảy qua (bệ pháo)

            while (this.isValidPosition(nx + dx, ny + dy)) {
                nx += dx;
                ny += dy;
                const pieceAt = this.board[ny][nx];

                if (jumpCount === 0) {
                    // Chưa nhảy qua quân nào: có thể di chuyển đến ô trống
                    if (!pieceAt) {
                        moves.push([nx, ny]);
                    } else {
                        // Gặp quân đầu tiên: tăng jumpCount
                        jumpCount++;
                    }
                } else if (jumpCount === 1) {
                    // Đã nhảy qua một quân: kiểm tra ô đích
                    if (pieceAt) {
                        // Nếu ô đích có quân và là quân địch, có thể ăn
                        if (pieceAt.color !== color) {
                            moves.push([nx, ny]);
                        }
                        break; // Dù có ăn được hay không, dừng lại sau khi gặp quân thứ hai
                    }
                    // Nếu ô trống, không thể di chuyển tiếp (Pháo không di chuyển qua bệ pháo mà không ăn)
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

        // Khôi phục trạng thái bàn cờ
        const piece = this.board[move.toY][move.toX];
        this.board[move.fromY][move.fromX] = piece;
        this.board[move.toY][move.toX] = move.capturedPiece; // Khôi phục quân cờ bị ăn (nếu có)
        this.currentTurn = move.currentTurn; // Khôi phục lượt chơi
        // Giảm moveCount nếu quay lại từ đỏ về đen
        if (previousTurn === "red" && this.currentTurn === "black") {
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

        // Áp dụng lại nước đi
        const piece = this.board[move.fromY][move.fromX];
        this.board[move.toY][move.toX] = piece;
        this.board[move.fromY][move.fromX] = null;
        const previousTurn = this.currentTurn;
        this.currentTurn = this.currentTurn === "red" ? "black" : "red";
        // Tăng moveCount nếu đi từ đen sang đỏ
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
        this.moveCount = 1; // Đặt lại moveCount
        return true;
    }

    resetGame() {
        this.board = Array(ROWS).fill().map(() => Array(COLS).fill(null));
        this.currentTurn = "red";
        this.moveHistory = [];
        this.currentMoveIndex = -1;
        this.moveCount = 1; // Đặt lại moveCount
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
                return { moveNotation: notation };
            } catch (err) {
                console.error(`Error processing move ${index}:`, move, err);
                return { moveNotation: "Error" };
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

            // Đặt lại bàn cờ về trạng thái ban đầu
            if (this.initialBoard) {
                this.board = this.initialBoard.map(row => row.map(cell => (cell ? { ...cell } : null)));
            } else {
                this.board = Array(ROWS).fill().map(() => Array(COLS).fill(null));
                this.setupInitialPosition();
                this.saveInitialBoard();
            }
            this.currentTurn = "red";

            // Áp dụng lại các nước đi
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

    // Chuyển đổi tên quân cờ sang ký hiệu ngắn gọn
    getPieceNotation(piece) {
        if (!piece) return "";
        const notationMap = {
            "兵": "P", "卒": "P", // Tốt
            "炮": "C", "砲": "C", // Pháo
            "馬": "N", "马": "N", // Mã
            "象": "B", "相": "B", // Tượng
            "車": "R", "车": "R", // Xe
            "仕": "A", "士": "A", // Sĩ
            "帅": "K", "将": "K"  // Tướng/Vua
        };
        return notationMap[piece.name] || piece.name;
    }

    // Chuyển đổi tọa độ (x, y) thành định dạng C2=5
    getPositionNotation(x, y) {
        const col = x + 1; // Cột từ 1 đến 9 (x từ 0 đến 8)
        const row = 10 - y; // Hàng từ 1 đến 10 (y từ 0 đến 9, đảo ngược)
        return `${col}.${row}`;
    }

    // Tìm tất cả các quân cùng loại trên cùng một cột
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
    // Tạo ký hiệu nước đi (C2+2, -C+2, v.v.)
    getMoveNotation(move) {
        if (!move || typeof move.fromX === 'undefined' || typeof move.fromY === 'undefined' ||
            typeof move.toX === 'undefined' || typeof move.toY === 'undefined') {
            console.error('Invalid move object:', move);
            return "Invalid Move";
        }

        // Ưu tiên sử dụng move.piece, nếu không có thì lấy từ this.board
        let piece = move.piece;
        if (!piece) {
            console.warn('No piece information in move object, attempting to fetch from board:', move);
            piece = this.getPieceForNotation(move.fromX, move.fromY);
            if (!piece) {
                console.warn('No piece found at from position on current board:', move);
                return "Unknown Move";
            }
        }
        // Sử dụng ký hiệu Latin thay vì tên Trung Quốc để tránh lỗi hiển thị
        const fenSymbol = this.pieceToFen(piece) || piece.name;
        console.log(`Processing move: ${fenSymbol} (${piece.color}) from (${move.fromX}, ${move.fromY}) to (${move.toX}, ${move.toY})`);
        const pieceNotation = this.getPieceNotation(piece);
        if (!pieceNotation) return "Invalid Piece";

        const fromCol = piece.color === "red" ? (9 - move.fromX) : (move.fromX + 1);
        const toCol = piece.color === "red" ? (9 - move.toX) : (move.toX + 1);
        const deltaY = move.toY - move.fromY;
        const absDeltaY = Math.abs(deltaY);

        let moveSymbol = "";
        let moveDistance = 0;

        if (["馬", "马", "象", "相", "仕", "士"].includes(piece.name)) {
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