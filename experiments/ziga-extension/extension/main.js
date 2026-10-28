(() => {
  // src/native-client.js
  var clientId = crypto.randomUUID();
  function nativeRequest(kind, fen, movetime, signal, bookOptions = {}) {
    return new Promise((resolve, reject) => {
      const id = crypto.randomUUID();
      const cleanup = () => {
        clearTimeout(timer);
        window.removeEventListener("message", receive);
        signal.removeEventListener("abort", abort);
      };
      const cancel = () => window.postMessage({ channel: "ziga-native-request", kind: "cancel", id }, location.origin);
      const abort = () => {
        cancel();
        cleanup();
        reject(new DOMException("Cancelled", "AbortError"));
      };
      const receive = (e) => {
        if (e.source !== window || e.origin !== location.origin || e.data?.channel !== "ziga-native-result" || e.data.id !== id)
          return;
        cleanup();
        const result = e.data.result;
        if (!result || result.error)
          reject(Error(result?.error || "Bridge kh\xF4ng tr\u1EA3 k\u1EBFt qu\u1EA3"));
        else
          resolve(result);
      };
      const timer = setTimeout(() => {
        cancel();
        cleanup();
        reject(Error("Kh\xF4ng k\u1EBFt n\u1ED1i \u0111\u01B0\u1EE3c Pikafish. H\xE3y ch\u1EA1y bridge v\xE0 Reload extension/tab Ziga."));
      }, 22e3);
      window.addEventListener("message", receive);
      signal.addEventListener("abort", abort, { once: true });
      if (signal.aborted)
        abort();
      else
        window.postMessage({ channel: "ziga-native-request", kind, id, fen, movetime, clientId, ...bookOptions }, location.origin);
    });
  }
  var nativeBestMove = (fen, movetime, signal, options) => nativeRequest("analyze", fen, movetime, signal, options);
  var nativePonder = (fen, signal, options) => nativeRequest("ponder", fen, 1e4, signal, options);
  var nativeStop = (gameId) => nativeRequest("stop", null, null, new AbortController().signal, { gameId }).catch(() => {
  });

  // vendor/XiangqiNotation.js
  var FEN_MAP = {
    "\u8ECA": "r",
    "\u8F66": "r",
    // Rook  (Chariot)
    "\u99AC": "n",
    "\u9A6C": "n",
    // Knight (Horse)
    "\u8C61": "b",
    "\u76F8": "b",
    // Bishop (Elephant)
    "\u4ED5": "a",
    "\u58EB": "a",
    // Advisor (Guard)
    "\u5E25": "k",
    "\u5C07": "k",
    // General / King
    "\u70AE": "c",
    "\u7832": "c",
    // Cannon
    "\u5175": "p",
    "\u5352": "p"
    // Pawn / Soldier
  };
  var REVERSE_FEN_MAP = {
    "r": "\u8ECA",
    "R": "\u8ECA",
    "n": "\u9A6C",
    "N": "\u99AC",
    "b": "\u76F8",
    "B": "\u8C61",
    "a": "\u58EB",
    "A": "\u4ED5",
    "k": "\u5C07",
    "K": "\u5E25",
    "c": "\u7832",
    "C": "\u70AE",
    "p": "\u5352",
    "P": "\u5175"
  };
  var PIECE_NOTATION_MAP = {
    "\u5175": "P",
    "\u5352": "P",
    // Pawn / Soldier
    "\u70AE": "C",
    "\u7832": "C",
    // Cannon
    "\u99AC": "N",
    "\u9A6C": "N",
    // Knight (Horse)
    "\u8C61": "B",
    "\u76F8": "B",
    // Bishop (Elephant)
    "\u8ECA": "R",
    "\u8F66": "R",
    // Rook (Chariot)
    "\u4ED5": "A",
    "\u58EB": "A",
    // Advisor (Guard)
    "\u5E25": "K",
    "\u5C07": "K"
    // General / King
  };
  var DIAGONAL_PIECES = /* @__PURE__ */ new Set([
    "\u99AC",
    "\u9A6C",
    // Knight (Horse)
    "\u8C61",
    "\u76F8",
    // Bishop (Elephant)
    "\u4ED5",
    "\u58EB"
    // Advisor (Guard)
  ]);
  function pieceToFenChar(piece) {
    if (!piece || !piece.name)
      return null;
    const symbol = FEN_MAP[piece.name];
    if (!symbol)
      return null;
    return piece.color === "red" ? symbol.toUpperCase() : symbol.toLowerCase();
  }
  function getPieceNotationSymbol(piece) {
    if (!piece)
      return "";
    return PIECE_NOTATION_MAP[piece.name] || piece.name;
  }
  function toICCS(move) {
    if (!move)
      return "";
    const fX = String.fromCharCode(97 + move.fromX);
    const fY = 9 - move.fromY;
    const tX = String.fromCharCode(97 + move.toX);
    const tY = 9 - move.toY;
    return `${fX}${fY}${tX}${tY}`;
  }
  function getPositionNotation(x, y) {
    const col = x + 1;
    const row = 10 - y;
    return `${col}.${row}`;
  }

  // vendor/XiangqiPV.js
  function parseUCI(move) {
    if (typeof move !== "string" || !/^[a-i][0-9][a-i][0-9]$/.test(move))
      return null;
    return [move.charCodeAt(0) - 97, 9 - Number(move[1]), move.charCodeAt(2) - 97, 9 - Number(move[3])];
  }
  function formatPV(Game, fen, moves = []) {
    const game = new Game();
    if (!game.importFen(fen))
      return { moves: [], formatted: "-" };
    const notes = [];
    for (const move of moves) {
      const coords = parseUCI(move);
      if (!coords) {
        notes.push(move);
        continue;
      }
      const [fromX, fromY, toX, toY] = coords;
      const piece = game.getPiece(fromX, fromY);
      if (!piece)
        break;
      const note = game.calculateMoveNotation({ fromX, fromY, toX, toY, piece });
      if (!game.move(...coords))
        break;
      notes.push(note);
    }
    return { moves: notes, formatted: notes.join(" ") };
  }
  function translatePVGroups(Game, fen, groups = []) {
    const map = {};
    for (const moves of groups) {
      if (!Array.isArray(moves))
        continue;
      const notes = formatPV(Game, fen, moves).moves;
      notes.forEach((note, index) => {
        map[moves[index]] ??= note;
      });
    }
    return map;
  }
  function simulatePV(Game, fen, moves = [], limit = moves.length) {
    const game = new Game();
    if (!game.importFen(fen))
      return [];
    const states = [{ board: game.getBoardSnapshot(), turn: game.currentTurn, lastMove: null }];
    for (const move of moves.slice(0, Math.max(0, limit))) {
      const coords = parseUCI(move);
      if (!coords || !game.move(...coords))
        break;
      const [fromX, fromY, toX, toY] = coords;
      states.push({
        board: game.getBoardSnapshot(),
        turn: game.currentTurn,
        lastMove: { fromX, fromY, toX, toY }
      });
    }
    return states;
  }

  // vendor/XiangqiGame.js
  var ROWS = 10;
  var COLS = 9;
  var DEFAULT_FEN = "rnbakabnr/9/1c5c1/p1p1p1p1p/9/9/P1P1P1P1P/1C5C1/9/RNBAKABNR w - - 0 1";
  var XiangqiGame = class _XiangqiGame {
    constructor() {
      this.currentTurn = "red";
      this.moveHistory = [];
      this.currentMoveIndex = -1;
      this._flipped = false;
      this.initialBoard = null;
      this.initialTurn = "red";
      this.initialMoveCount = 1;
      this.startingFen = DEFAULT_FEN;
      this.board = Array(ROWS).fill().map(() => Array(COLS).fill(null));
      this.moveCount = 1;
      this.setupInitialPosition();
      this.saveInitialBoard();
      this.fenBoardSnapshot = null;
      this.fenMap = FEN_MAP;
    }
    /**
     * IMPORT FEN
     * -----------------
     * Strictly requires 6 parts. Establishes a new authoritative start point.
     */
    importFen(fen) {
      if (!fen || typeof fen !== "string") {
        console.error("Invalid FEN passed to importFen:", fen);
        return false;
      }
      try {
        const parts = fen.trim().split(/\s+/);
        if (parts.length !== 6) {
          console.error("Xiangqi FEN requires exactly 6 parts (got " + parts.length + "):", fen);
          return false;
        }
        const boardFen = parts[0];
        const turn = parts[1];
        const moveNumber = Number(parts[5]);
        if (!["w", "b"].includes(turn) || !Number.isSafeInteger(moveNumber) || moveNumber < 1 || parts[2] !== "-" || parts[3] !== "-" || !/^\d+$/.test(parts[4]))
          return false;
        const nextBoard = Array(ROWS).fill().map(() => Array(COLS).fill(null));
        const rows = boardFen.split("/");
        if (rows.length !== ROWS) {
          console.error("Invalid number of rows in FEN:", rows.length);
          return false;
        }
        const reverseFenMap = REVERSE_FEN_MAP;
        for (let y = 0; y < ROWS; y++) {
          let x = 0;
          const row = rows[y];
          for (let i = 0; i < row.length; i++) {
            const char = row[i];
            if (/[1-9]/.test(char)) {
              x += parseInt(char);
            } else if (x < COLS) {
              const pieceName = reverseFenMap[char];
              if (pieceName) {
                const color = char === char.toUpperCase() ? "red" : "black";
                nextBoard[y][x] = { name: pieceName, color };
                x++;
              } else {
                return false;
              }
            } else
              return false;
          }
          if (x !== COLS)
            return false;
        }
        this.board = nextBoard;
        this.currentTurn = turn === "w" ? "red" : "black";
        this.moveCount = moveNumber;
        this.moveHistory = [];
        this.currentMoveIndex = -1;
        this.fenBoardSnapshot = null;
        this.startingFen = fen;
        this.saveInitialBoard();
        return true;
      } catch (err) {
        console.error("Error importing FEN:", err);
        return false;
      }
    }
    setupInitialPosition() {
      const initialSetup = [
        { name: "\u8ECA", color: "red", x: 0, y: 9 },
        { name: "\u8ECA", color: "red", x: 8, y: 9 },
        { name: "\u99AC", color: "red", x: 1, y: 9 },
        { name: "\u99AC", color: "red", x: 7, y: 9 },
        { name: "\u8C61", color: "red", x: 2, y: 9 },
        { name: "\u8C61", color: "red", x: 6, y: 9 },
        { name: "\u4ED5", color: "red", x: 3, y: 9 },
        { name: "\u4ED5", color: "red", x: 5, y: 9 },
        { name: "\u5E25", color: "red", x: 4, y: 9 },
        { name: "\u70AE", color: "red", x: 1, y: 7 },
        { name: "\u70AE", color: "red", x: 7, y: 7 },
        { name: "\u5175", color: "red", x: 0, y: 6 },
        { name: "\u5175", color: "red", x: 2, y: 6 },
        { name: "\u5175", color: "red", x: 4, y: 6 },
        { name: "\u5175", color: "red", x: 6, y: 6 },
        { name: "\u5175", color: "red", x: 8, y: 6 },
        { name: "\u8ECA", color: "black", x: 0, y: 0 },
        { name: "\u8ECA", color: "black", x: 8, y: 0 },
        { name: "\u99AC", color: "black", x: 1, y: 0 },
        { name: "\u99AC", color: "black", x: 7, y: 0 },
        { name: "\u76F8", color: "black", x: 2, y: 0 },
        { name: "\u76F8", color: "black", x: 6, y: 0 },
        { name: "\u58EB", color: "black", x: 3, y: 0 },
        { name: "\u58EB", color: "black", x: 5, y: 0 },
        { name: "\u5C07", color: "black", x: 4, y: 0 },
        { name: "\u7832", color: "black", x: 1, y: 2 },
        { name: "\u7832", color: "black", x: 7, y: 2 },
        { name: "\u5352", color: "black", x: 0, y: 3 },
        { name: "\u5352", color: "black", x: 2, y: 3 },
        { name: "\u5352", color: "black", x: 4, y: 3 },
        { name: "\u5352", color: "black", x: 6, y: 3 },
        { name: "\u5352", color: "black", x: 8, y: 3 }
      ];
      initialSetup.forEach((piece) => {
        this.board[piece.y][piece.x] = { name: piece.name, color: piece.color };
      });
    }
    exportFen() {
      this.fenBoardSnapshot = this.getBoardSnapshot();
      let fen = "";
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
              fen += "?";
            }
          }
        }
        if (emptyCount > 0)
          fen += emptyCount;
        if (y < 9)
          fen += "/";
      }
      fen += ` ${this.currentTurn === "red" ? "w" : "b"} - - 0 ${this.moveCount}`;
      return fen;
    }
    saveInitialBoard() {
      this.initialBoard = this.getBoardSnapshot();
      this.initialTurn = this.currentTurn;
      this.initialMoveCount = this.moveCount;
    }
    getPiece(x, y) {
      if (typeof x !== "number" || typeof y !== "number" || isNaN(x) || isNaN(y))
        return null;
      if (!this.board || !this.board[y] || !this.isValidPosition(x, y))
        return null;
      return this.board[y][x];
    }
    isValidPosition(x, y) {
      return Number.isInteger(x) && Number.isInteger(y) && x >= 0 && x < COLS && y >= 0 && y < ROWS;
    }
    move(fromX, fromY, toX, toY, isAnalysis = false) {
      if (!this.isValidPosition(fromX, fromY) || !this.isValidPosition(toX, toY))
        return false;
      const piece = this.board[fromY][fromX];
      if (!piece)
        return false;
      if (!isAnalysis) {
        if (piece.color !== this.currentTurn)
          return false;
        const legalMoves2 = this.getLegalMoves(fromX, fromY);
        const isLegal = legalMoves2.some(([mx, my]) => mx === toX && my === toY);
        if (!isLegal)
          return false;
      }
      const capturedPiece = this.board[toY][toX];
      if (!isAnalysis) {
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
          moveNotation,
          // Store immutable string for future history retrieval
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
      if (!piece)
        return [];
      let moves = [];
      switch (piece.name) {
        case "\u5175":
        case "\u5352":
          moves = this.getSoldierMoves(x, y, piece.color);
          break;
        case "\u70AE":
        case "\u7832":
          moves = this.getCannonMoves(x, y, piece.color);
          break;
        case "\u8ECA":
          moves = this.getRookMoves(x, y, piece.color);
          break;
        case "\u99AC":
        case "\u9A6C":
          moves = this.getKnightMoves(x, y, piece.color);
          break;
        case "\u76F8":
        case "\u8C61":
          moves = this.getElephantMoves(x, y, piece.color);
          break;
        case "\u4ED5":
        case "\u58EB":
          moves = this.getGuardMoves(x, y, piece.color);
          break;
        case "\u5E25":
        case "\u5C07":
          moves = this.getKingMoves(x, y, piece.color);
          break;
        default:
          return [];
      }
      return moves;
    }
    getLegalMoves(x, y) {
      const piece = this.getPiece(x, y);
      if (!piece)
        return [];
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
      if (!kingPos)
        return false;
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
      if (!this.isKingInCheck(color))
        return false;
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
              if (!stillInCheck)
                return false;
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
          if (piece && (piece.name === "\u5E25" || piece.name === "\u5C07") && piece.color === color) {
            return { x, y };
          }
        }
      }
      return null;
    }
    willKingsFaceEachOther() {
      const redKing = this.findKing("red");
      const blackKing = this.findKing("black");
      if (!redKing || !blackKing || redKing.x !== blackKing.x)
        return false;
      const minY = Math.min(redKing.y, blackKing.y);
      const maxY = Math.max(redKing.y, blackKing.y);
      for (let y = minY + 1; y < maxY; y++)
        if (this.board[y][redKing.x])
          return false;
      return true;
    }
    getSoldierMoves(x, y, color) {
      let moves = [];
      if (color === "red") {
        if (y > 0)
          moves.push([x, y - 1]);
        if (y <= 4) {
          if (x > 0)
            moves.push([x - 1, y]);
          if (x < 8)
            moves.push([x + 1, y]);
        }
      } else {
        if (y < 9)
          moves.push([x, y + 1]);
        if (y >= 5) {
          if (x > 0)
            moves.push([x - 1, y]);
          if (x < 8)
            moves.push([x + 1, y]);
        }
      }
      return moves.filter(([nx, ny]) => this.isValidPosition(nx, ny));
    }
    getCannonMoves(x, y, color) {
      let moves = [];
      const directions = [[0, 1], [0, -1], [1, 0], [-1, 0]];
      directions.forEach(([dx, dy]) => {
        let nx = x, ny = y, jumpCount = 0;
        while (this.isValidPosition(nx + dx, ny + dy)) {
          nx += dx;
          ny += dy;
          const pieceAt = this.board[ny][nx];
          if (jumpCount === 0) {
            if (!pieceAt)
              moves.push([nx, ny]);
            else
              jumpCount++;
          } else if (jumpCount === 1) {
            if (pieceAt) {
              if (pieceAt.color !== color)
                moves.push([nx, ny]);
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
            if (pieceAt.color !== color)
              moves.push([nx, ny]);
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
          if (!pieceAt || pieceAt.color !== color)
            moves.push([nx, ny]);
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
          if (!pieceAt || pieceAt.color !== color)
            moves.push([nx, ny]);
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
          if (!pieceAt || pieceAt.color !== color)
            moves.push([nx, ny]);
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
          if (!pieceAt || pieceAt.color !== color)
            moves.push([nx, ny]);
        }
      });
      return moves;
    }
    undo() {
      if (this.currentMoveIndex < 0)
        return false;
      const move = this.moveHistory[this.currentMoveIndex];
      if (!move)
        return false;
      const piece = this.board[move.toY][move.toX];
      if (!piece)
        return false;
      this.board[move.fromY][move.fromX] = piece;
      this.board[move.toY][move.toX] = move.capturedPiece;
      this.currentTurn = move.currentTurn;
      if (this.currentTurn === "black" && this.moveCount > 1)
        this.moveCount--;
      this.currentMoveIndex--;
      return true;
    }
    redo() {
      if (this.currentMoveIndex >= this.moveHistory.length - 1)
        return false;
      this.currentMoveIndex++;
      const move = this.moveHistory[this.currentMoveIndex];
      if (!move)
        return false;
      let piece = this.board[move.fromY][move.fromX];
      if (!piece) {
        piece = { ...move.piece };
      }
      this.board[move.toY][move.toX] = piece;
      this.board[move.fromY][move.fromX] = null;
      const previousTurn = this.currentTurn;
      this.currentTurn = this.currentTurn === "red" ? "black" : "red";
      if (previousTurn === "black" && this.currentTurn === "red")
        this.moveCount++;
      return true;
    }
    resetToInitial() {
      if (!this.initialBoard)
        return false;
      this.board = this.initialBoard.map((row) => row.map((cell) => cell ? { ...cell } : null));
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
      if (!this.initialBoard || !Array.isArray(this.moveHistory))
        return false;
      if (!Number.isInteger(index) || index < -1 || index >= this.moveHistory.length)
        return false;
      this.board = this.initialBoard.map((row) => row.map((cell) => cell ? { ...cell } : null));
      this.currentTurn = this.initialTurn || "red";
      this.moveCount = this.initialMoveCount || 1;
      this.currentMoveIndex = -1;
      for (let i = 0; i <= index; i++) {
        const move = this.moveHistory[i];
        if (move) {
          const piece = this.board[move.fromY][move.fromX];
          if (!piece)
            return false;
          this.board[move.toY][move.toX] = piece;
          this.board[move.fromY][move.fromX] = null;
          const previousTurn = this.currentTurn;
          this.currentTurn = this.currentTurn === "red" ? "black" : "red";
          if (previousTurn === "black" && this.currentTurn === "red")
            this.moveCount++;
          this.currentMoveIndex = i;
        }
      }
      return true;
    }
    getMoveHistory() {
      if (!this.moveHistory || !Array.isArray(this.moveHistory))
        return [];
      return structuredClone(this.moveHistory);
    }
    exportGame() {
      return JSON.stringify({
        moveHistory: this.moveHistory,
        currentMoveIndex: this.currentMoveIndex,
        initialBoard: this.initialBoard,
        initialTurn: this.initialTurn,
        initialMoveCount: this.initialMoveCount,
        startingFen: this.startingFen
      });
    }
    updateMoveNote(index, note) {
      if (!Number.isInteger(index) || !this.moveHistory[index] || typeof note !== "string")
        return false;
      this.moveHistory[index].note = note;
      return true;
    }
    updateMoveVariation(index, variation) {
      if (!Number.isInteger(index) || !this.moveHistory[index] || !Array.isArray(variation))
        return false;
      this.moveHistory[index].variation = structuredClone(variation);
      return true;
    }
    importGame(json) {
      try {
        const data = typeof json === "string" ? JSON.parse(json) : structuredClone(json);
        const validPiece = (piece) => piece === null || pieceToFenChar(piece) && ["red", "black"].includes(piece.color);
        if (!data || !Array.isArray(data.initialBoard) || data.initialBoard.length !== ROWS || !data.initialBoard.every((row) => Array.isArray(row) && row.length === COLS && row.every(validPiece)) || !Array.isArray(data.moveHistory))
          return false;
        const index = data.currentMoveIndex;
        if (!Number.isInteger(index) || index < -1 || index >= data.moveHistory.length)
          return false;
        const candidate = new _XiangqiGame();
        candidate.board = structuredClone(data.initialBoard);
        candidate.currentTurn = data.initialTurn || "red";
        candidate.moveCount = data.initialMoveCount || 1;
        if (!["red", "black"].includes(candidate.currentTurn) || !Number.isSafeInteger(candidate.moveCount) || candidate.moveCount < 1)
          return false;
        candidate.saveInitialBoard();
        candidate.startingFen = data.startingFen || candidate.exportFen();
        const start = new _XiangqiGame();
        if (!start.importFen(candidate.startingFen) || start.exportFen() !== candidate.exportFen())
          return false;
        for (const move of data.moveHistory) {
          if (!move || !candidate.move(move.fromX, move.fromY, move.toX, move.toY))
            return false;
          const restored = candidate.moveHistory.at(-1);
          restored.note = typeof move.note === "string" ? move.note : "";
          restored.variation = Array.isArray(move.variation) ? structuredClone(move.variation) : [];
        }
        if (!candidate.goToMove(index))
          return false;
        for (const key of [
          "board",
          "moveHistory",
          "currentMoveIndex",
          "currentTurn",
          "moveCount",
          "initialBoard",
          "initialTurn",
          "initialMoveCount",
          "startingFen"
        ])
          this[key] = candidate[key];
        this.fenBoardSnapshot = null;
        return true;
      } catch (err) {
        console.error("Error importing JSON:", err.message);
        return false;
      }
    }
    exportPgn() {
      let pgn = '[Event "Xiangqi Match"]\n';
      pgn += `[Date "${(/* @__PURE__ */ new Date()).toISOString().split("T")[0]}"]
`;
      pgn += `[FEN "${this.startingFen}"]

`;
      for (let i = 0; i < this.moveHistory.length; i += 2) {
        pgn += `${Math.floor(i / 2) + 1}. ${this.toICCS(this.moveHistory[i])} `;
        if (this.moveHistory[i + 1])
          pgn += `${this.toICCS(this.moveHistory[i + 1])} `;
        pgn += "\n";
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
        fen: this.exportFen(),
        board: this.getBoardSnapshot(),
        currentTurn: this.currentTurn,
        moveCount: this.moveCount,
        currentMoveIndex: this.currentMoveIndex,
        moveHistory: this.getMoveHistory(),
        isCheck: this.isKingInCheck(this.currentTurn),
        isCheckmate: this.isCheckmate(this.currentTurn),
        lastMove: lastMove ? structuredClone(lastMove) : null,
        flipped: this._flipped
      };
    }
    toICCS(move) {
      return toICCS(move);
    }
    formatPV(fen, moves) {
      return formatPV(this.constructor, fen || this.exportFen(), moves);
    }
    translatePVGroups(fen, groups) {
      return translatePVGroups(this.constructor, fen || this.exportFen(), groups);
    }
    simulatePV(fen, moves, limit) {
      return simulatePV(this.constructor, fen, moves, limit);
    }
    getPieceNotation(piece) {
      return getPieceNotationSymbol(piece);
    }
    getPositionNotation(x, y) {
      return getPositionNotation(x, y);
    }
    getPiecesInColumn(pieceName, col, color) {
      const pieces = [];
      for (let y = 0; y < 10; y++) {
        const p = this.board[y][col];
        if (p && p.name === pieceName && p.color === color)
          pieces.push({ x: col, y });
      }
      return pieces;
    }
    calculateMoveNotation(move) {
      if (!move || typeof move.fromX === "undefined")
        return "Invalid Move";
      const piece = move.piece;
      if (!piece)
        return "Unknown Move";
      const pieceNotation = this.getPieceNotation(piece);
      if (!pieceNotation)
        return "Invalid Piece";
      const fromCol = piece.color === "red" ? 9 - move.fromX : move.fromX + 1;
      const toCol = piece.color === "red" ? 9 - move.toX : move.toX + 1;
      const deltaY = move.toY - move.fromY;
      const absDeltaY = Math.abs(deltaY);
      let symb = "", dist = 0;
      if (DIAGONAL_PIECES.has(piece.name)) {
        symb = deltaY > 0 ? piece.color === "red" ? "-" : "+" : piece.color === "red" ? "+" : "-";
        dist = toCol;
      } else {
        if (deltaY === 0) {
          symb = "=";
          dist = toCol;
        } else {
          symb = deltaY < 0 ? piece.color === "red" ? "+" : "-" : piece.color === "red" ? "-" : "+";
          dist = absDeltaY;
        }
      }
      const same = this.getPiecesInColumn(piece.name, move.fromX, piece.color);
      let prefix = pieceNotation;
      if (same.length > 1) {
        same.sort((a, b) => piece.color === "red" ? b.y - a.y : a.y - b.y);
        const idx = same.findIndex((p) => p.y === move.fromY);
        prefix = piece.color === "red" ? `${idx + 1}${pieceNotation}` : `${pieceNotation}${idx + 1}`;
      }
      return `${prefix}${fromCol}${symb}${dist}`;
    }
    getBoardSnapshot() {
      return this.board.map((row) => row.map((cell) => cell ? { ...cell } : null));
    }
  };
  var XiangqiGame_default = XiangqiGame;

  // src/engine.js
  var values = { k: 1e5, r: 900, c: 450, n: 400, b: 200, a: 200, p: 100 };
  var value = (p) => p ? values[pieceToFenChar(p).toLowerCase()] || 0 : 0;
  function legalMoves(game, side) {
    const result = [];
    for (let y = 0; y < 10; y++)
      for (let x = 0; x < 9; x++) {
        const p = game.board[y][x];
        if (p?.color !== side)
          continue;
        for (const [tx, ty] of game.getLegalMoves(x, y)) {
          if (game.board[ty][tx]?.color === side)
            continue;
          result.push({ x, y, tx, ty, order: value(game.board[ty][tx]) * 10 - value(p) });
        }
      }
    return result.sort((a, b) => b.order - a.order);
  }

  // src/adapter.js
  var chars = ["k", "a", "b", "r", "c", "n", "p"];
  function readState(w = window) {
    if (!w.BkGlobal || w.K === void 0 || w.BkGlobal.ia !== w.K)
      throw new Error("H\xE3y m\u1EDF ph\xF2ng C\u1EDD t\u01B0\u1EDBng (kh\xF4ng ph\u1EA3i C\u1EDD \xFAp).");
    const layer = w.BkGlobal.Yj?.ja?.();
    if (!layer || !Array.isArray(layer.V) || layer.V.length !== 32)
      throw new Error("Ch\u01B0a nh\u1EADn di\u1EC7n \u0111\u01B0\u1EE3c b\xE0n c\u1EDD Ziga.");
    const logic = layer.T?.(), player = logic?.Ba?.();
    if (!logic || typeof logic.PP !== "function")
      throw new Error("Adapter kh\xF4ng t\u01B0\u01A1ng th\xEDch phi\xEAn b\u1EA3n Ziga n\xE0y.");
    if (!player || player.Ka || ![0, 1].includes(layer.Nj))
      throw new Error("B\u1EA1n ch\u01B0a ng\u1ED3i ch\u01A1i ho\u1EB7c \u0111ang xem v\xE1n.");
    if (w.GAME_STATE_PLAYING === void 0 || logic.Fb !== w.GAME_STATE_PLAYING)
      throw new Error("\u0110ang ch\u1EDD v\xE1n b\u1EAFt \u0111\u1EA7u.");
    if (![0, 1].includes(layer.Yc) || typeof layer.hc !== "boolean")
      throw new Error("L\u01B0\u1EE3t ch\u01A1i kh\xF4ng h\u1EE3p l\u1EC7.");
    const board = Array.from({ length: 10 }, () => Array(9).fill(null));
    let kings = [0, 0];
    for (const p of layer.V) {
      if (p.pa)
        continue;
      if (!Number.isInteger(p.fa) || p.fa < 0 || p.fa > 8 || !Number.isInteger(p.rowIndex) || p.rowIndex < 0 || p.rowIndex > 9 || ![0, 1].includes(p.ka) || !chars[p.Ga])
        throw new Error("D\u1EEF li\u1EC7u qu\xE2n c\u1EDD kh\xF4ng h\u1EE3p l\u1EC7.");
      const y = 9 - p.rowIndex, x = p.fa;
      if (board[y][x])
        throw new Error("Hai qu\xE2n tr\xF9ng \xF4.");
      const ch = chars[p.Ga];
      board[y][x] = p.ka === 0 ? ch.toUpperCase() : ch;
      if (p.Ga === 0)
        kings[p.ka]++;
    }
    if (kings.some((n) => n !== 1))
      throw new Error("V\xE1n \u0111\xE3 k\u1EBFt th\xFAc ho\u1EB7c thi\u1EBFu t\u01B0\u1EDBng.");
    const rows = board.map((row) => {
      let s = "", empty = 0;
      for (const ch of row) {
        if (!ch)
          empty++;
        else {
          if (empty)
            s += empty;
          empty = 0;
          s += ch;
        }
      }
      return s + (empty || "");
    });
    const fen = rows.join("/") + ` ${layer.Yc === 0 ? "w" : "b"} - - 0 1`;
    const room = [w.BkGlobal.ia, logic.Cn?.(), layer.Yt, layer.nv].join(":");
    return { layer, logic, player, fen, key: room + ":" + fen + ":" + layer.hc, myTurn: layer.Yc === layer.Nj, room };
  }
  function sendMove(expected, move, w = window) {
    const state = readState(w);
    if (state.key !== expected.key || state.layer !== expected.layer || !state.myTurn)
      throw new Error("B\xE0n c\u1EDD ho\u1EB7c l\u01B0\u1EE3t \u0111\xE3 thay \u0111\u1ED5i; h\u1EE7y n\u01B0\u1EDBc c\u0169.");
    let coords = [move.x, 9 - move.y, move.tx, 9 - move.ty];
    if (state.layer.hc)
      coords = coords.map((n, i) => i % 2 === 0 ? 8 - n : 9 - n);
    state.logic.PP(...coords);
  }

  // src/move-delay.js
  function moveDelayMs(legalCount, depth, { searchMs = 0, scoreGap = null, stableDepths = 0, source = "engine", ponderHit = false, random = Math.random } = {}) {
    const choices = Number.isFinite(legalCount) ? Math.max(1, Math.floor(legalCount)) : 1;
    const searched = Number.isFinite(depth) ? Math.max(0, depth) : 0;
    const sample = Number(random());
    const fraction = Number.isFinite(sample) ? Math.max(0, Math.min(1, sample)) : 0.5;
    if (choices === 1)
      return 500;
    if (ponderHit || source === "engine")
      return Math.round(500 + 500 * fraction);
    let low, high;
    if (choices <= 4 && searchMs <= 600) {
      low = 0;
      high = 250;
    } else if (source === "book") {
      low = 120;
      high = 1400;
    } else if (Number.isFinite(scoreGap) && scoreGap >= 150 && stableDepths >= 3) {
      low = 150;
      high = 900;
    } else if (choices >= 16 && searched >= 18 && (!Number.isFinite(scoreGap) || scoreGap < 70)) {
      low = 2200;
      high = 5e3;
    } else {
      low = 350;
      high = Math.min(4e3, 900 + choices * 20 + searched * 45);
    }
    return Math.round(Math.max(500, Math.min(5e3, low + (high - low) * fraction)));
  }

  // src/ad-state.js
  var watches = /* @__PURE__ */ new WeakMap();
  var AdWatch = class {
    constructor(now = () => Date.now()) {
      this.phase = "unknown";
      this.requestAt = null;
      this.startAt = null;
      this.flagAt = null;
      this.clearAt = null;
      this.wrapper = null;
      this.now = now;
      this.failed = false;
    }
    install(w) {
      const original = w.adBreak;
      if (typeof original !== "function" || original === this.wrapper)
        return;
      const watch = this;
      const wrapper = function(options, ...rest) {
        if (!options || typeof options !== "object")
          return original.call(this, options, ...rest);
        watch.phase = "requested";
        watch.requestAt = watch.now();
        watch.startAt = null;
        watch.clearAt = null;
        watch.failed = false;
        const forwarded = { ...options };
        for (const name of ["beforeAd", "afterAd", "adBreakDone"]) {
          const callback = options[name];
          forwarded[name] = function(...args) {
            if (name === "beforeAd") {
              watch.phase = "active";
              watch.startAt = watch.now();
              watch.clearAt = null;
            } else {
              watch.phase = "ended";
              if (name === "adBreakDone")
                watch.failed = ["timeout", "invalid", "noAdPreloaded", "frequencyCapped", "error", "dismissed", "ignored", "notReady"].includes(args[0]?.breakStatus);
            }
            return typeof callback === "function" ? callback.apply(this, args) : void 0;
          };
        }
        return original.call(this, forwarded, ...rest);
      };
      try {
        w.adBreak = wrapper;
        this.wrapper = wrapper;
      } catch {
      }
    }
    evidence(w) {
      const d = w.document;
      if (typeof d?.querySelectorAll !== "function" || d.visibilityState === "hidden")
        return { known: false, overlay: false, boardExposed: false };
      const vw = w.innerWidth || d.documentElement?.clientWidth || 0, vh = w.innerHeight || d.documentElement?.clientHeight || 0;
      if (!vw || !vh)
        return { known: false, overlay: false, boardExposed: false };
      const canvas = d.querySelector?.("canvas");
      const r = canvas?.getBoundingClientRect?.();
      let overlay = false;
      const nodes = d.querySelectorAll('iframe, ins.adsbygoogle, [id*="google_vignette"], [class*="google-vignette"]');
      for (const el of Array.from(nodes).slice(0, 100)) {
        const rect = el.getBoundingClientRect?.();
        if (!rect || rect.width <= 0 || rect.height <= 0)
          continue;
        const style = w.getComputedStyle?.(el);
        if (style?.display === "none" || style?.visibility === "hidden" || style?.opacity === "0")
          continue;
        const label = [el.id, el.className, el.src, el.getAttribute?.("title")].join(" ");
        if (!/google|ads|doubleclick|vignette|ad-container/i.test(label))
          continue;
        const width = Math.max(0, Math.min(vw, rect.right) - Math.max(0, rect.left));
        const height = Math.max(0, Math.min(vh, rect.bottom) - Math.max(0, rect.top));
        const coversBoard = r && r.left + r.width / 2 >= rect.left && r.left + r.width / 2 <= rect.right && r.top + r.height / 2 >= rect.top && r.top + r.height / 2 <= rect.bottom;
        if (width * height >= vw * vh * 0.4 && width >= vw * 0.65 || coversBoard && width >= vw * 0.25 && height >= vh * 0.3) {
          overlay = true;
          break;
        }
      }
      let boardExposed = false;
      if (r && r.width > 0 && r.height > 0 && typeof d.elementFromPoint === "function") {
        const x = Math.max(0, Math.min(vw - 1, r.left + r.width / 2)), y = Math.max(0, Math.min(vh - 1, r.top + r.height / 2));
        const top = d.elementFromPoint(x, y);
        boardExposed = top === canvas || canvas.contains?.(top) === true;
      }
      return { known: true, overlay, boardExposed };
    }
    inspect(w, now = Date.now()) {
      this.install(w);
      const proof = this.evidence(w), flag = !!w.BkGlobal?.Tg;
      if (proof.overlay) {
        this.clearAt = null;
        return { blocking: true, status: "Qu\u1EA3ng c\xE1o \u0111ang hi\u1EC3n th\u1ECB. Ch\u1EDD trang k\u1EBFt th\xFAc\u2026" };
      }
      if (proof.known) {
        this.clearAt ??= now;
      } else
        this.clearAt = null;
      const clearFor = this.clearAt === null ? 0 : now - this.clearAt;
      const recover = () => {
        if (w.BkGlobal)
          w.BkGlobal.Tg = false;
        this.phase = "ended";
        this.flagAt = null;
        return { blocking: false, recovered: true, failed: this.failed };
      };
      if (this.phase === "ended")
        return flag && proof.known ? recover() : { blocking: false, failed: this.failed };
      if (this.phase === "active") {
        if (proof.boardExposed && clearFor >= 1e4)
          return recover();
        return { blocking: true, status: now - (this.startAt ?? now) > 12e4 ? "Qu\u1EA3ng c\xE1o ch\u01B0a b\xE1o k\u1EBFt th\xFAc. H\xE3y ki\u1EC3m tra ho\u1EB7c \u0111\xF3ng qu\u1EA3ng c\xE1o th\u1EE7 c\xF4ng." : "SDK \u0111ang hi\u1EC3n th\u1ECB qu\u1EA3ng c\xE1o. Ch\u1EDD k\u1EBFt th\xFAc\u2026" };
      }
      if (this.phase === "requested") {
        if (now - (this.requestAt ?? now) >= 1e4 && proof.known && clearFor >= 3e3) {
          const r = recover();
          return { ...r, failed: true };
        }
        return { blocking: true, status: "\u0110ang ch\u1EDD trang t\u1EA3i qu\u1EA3ng c\xE1o\u2026" };
      }
      if (flag) {
        this.flagAt ??= now;
        if (proof.boardExposed && clearFor >= 3e3 && now - this.flagAt >= 3e3)
          return recover();
        return { blocking: true, status: "\u0110ang ki\u1EC3m tra tr\u1EA1ng th\xE1i qu\u1EA3ng c\xE1o\u2026" };
      }
      this.flagAt = null;
      return { blocking: false };
    }
  };
  function getAdStatus(w = window, now = Date.now()) {
    if (!watches.has(w))
      watches.set(w, new AdWatch());
    return watches.get(w).inspect(w, now);
  }

  // src/session.js
  function sessionSnapshot(w = window) {
    const g = w.BkGlobal;
    const home = g && g.ia === -1 && (g.Ja === w.Q || w.G !== void 0 && g.Ja === w.G);
    if (!g || w.K === void 0 || g.ia !== w.K && !home)
      throw Error("T\u1EF1 ch\u01A1i ch\u1EC9 h\u1ED7 tr\u1EE3 C\u1EDD t\u01B0\u1EDBng. H\xE3y v\u1EC1 m\xE0n h\xECnh ch\xEDnh ho\u1EB7c s\u1EA3nh C\u1EDD t\u01B0\u1EDBng.");
    if ([w.sj, w.V, w.Q].some((v) => v === void 0) || !w.BkLogicManager?.T)
      throw Error("Kh\xF4ng nh\u1EADn di\u1EC7n \u0111\u01B0\u1EE3c tr\u1EA1ng th\xE1i s\u1EA3nh Ziga.");
    const common = w.BkLogicManager.T();
    const hearts = g.P?.pb?.();
    const needsVerification = w.G !== void 0 && g.Ja === w.G;
    if (!needsVerification && (!Number.isFinite(hearts) || hearts < 0))
      throw Error("Kh\xF4ng \u0111\u1ECDc \u0111\u01B0\u1EE3c s\u1ED1 tim.");
    const popup = w.BkStackWindow?.Vj?.();
    const stage = needsVerification ? "verification" : g.Ja === w.sj ? "lobby" : g.Ja === w.V ? "table" : g.Ja === w.Q ? "menu" : "unknown";
    let layer = null, logic = null, player = null;
    if (stage === "table") {
      layer = g.Yj?.ja?.();
      logic = layer?.T?.();
      player = logic?.Ba?.();
    }
    const syncing = stage === "table" && (!layer || !logic || !player);
    const playing = !syncing && stage === "table" && w.GAME_STATE_PLAYING !== void 0 && logic.Fb === w.GAME_STATE_PLAYING;
    const finished = !syncing && stage === "table" && w.GAME_STATE_FINISH !== void 0 && logic.Fb === w.GAME_STATE_FINISH;
    return {
      w,
      g,
      stage,
      common,
      hearts,
      popup,
      layer,
      logic,
      player,
      playing,
      finished,
      syncing,
      identity: stage === "table" ? `${g.af}:${g.vi}` : `${stage}:${g.af}`
    };
  }
  var AutoSession = class {
    constructor(random = Math.random) {
      this.random = random;
      this.reset();
    }
    reset() {
      this.nextAt = 0;
      this.action = null;
      this.ad = null;
      this.finishAt = null;
      this.adsUsed = 0;
      this.lastTable = null;
      this.readyWait = null;
      this.syncAt = null;
      this.idleWatch = null;
      this.leaving = null;
      this.skippedTables = /* @__PURE__ */ new Set();
    }
    leaveWaiting(s, now) {
      if (typeof s.logic.uo !== "function")
        throw Error("Kh\xF4ng nh\u1EADn di\u1EC7n \u0111\u01B0\u1EE3c n\xFAt r\u1EDDi b\xE0n.");
      this.skippedTables.add(s.identity);
      this.leaving = { key: s.identity, layer: s.layer };
      this.readyWait = null;
      this.idleWatch = null;
      return this.perform("r\u1EDDi b\xE0n ch\u1EDD", s.identity, now, () => s.logic.uo(0), "\u0110\xE3 ch\u1EDD 3 gi\xE2y. \u0110ang r\u1EDDi b\xE0n \u0111\u1EC3 t\xECm b\xE0n kh\xE1c\u2026");
    }
    checkIdle(s, now) {
      const { w, logic, player } = s;
      const waitingTable = s.stage === "table" && !s.syncing && !s.playing && !s.finished && [w.GAME_STATE_READY, w.GAME_STATE_NOT_READY].filter((v) => v !== void 0).includes(logic?.Fb);
      if (!waitingTable || player?.Ka || s.popup) {
        this.idleWatch = null;
        return null;
      }
      if (this.leaving?.key === s.identity && this.leaving.layer === s.layer)
        return this.leaveWaiting(s, now);
      const seated = logic.ha?.filter((p) => p && !p.Ka) || [];
      const ownReady = player.status === w.PLAYER_STATE_READY || player.status === w.PLAYER_STATE_TABLE_OWNER || this.action?.type === "s\u1EB5n s\xE0ng" && this.action.key === s.identity;
      const opponentUnready = seated.some((p) => p !== player && (p.status === w.PLAYER_STATE_NOT_READY || w.PLAYER_STATE_FINISH_GAME !== void 0 && p.status === w.PLAYER_STATE_FINISH_GAME));
      const kind = seated.length === 1 ? "alone" : seated.length === 2 && ownReady && opponentUnready ? "opponent" : null;
      if (!kind) {
        this.idleWatch = null;
        return null;
      }
      if (!this.idleWatch || this.idleWatch.key !== s.identity || this.idleWatch.layer !== s.layer || this.idleWatch.kind !== kind) {
        const at = kind === "opponent" && this.action?.type === "s\u1EB5n s\xE0ng" && this.action.key === s.identity ? this.action.at : now;
        this.idleWatch = { key: s.identity, layer: s.layer, kind, at };
      }
      if (now - this.idleWatch.at >= 3e3)
        return this.leaveWaiting(s, now);
      return null;
    }
    delayedReady(type, s, now, call, status) {
      if (this.action?.type === type && this.action.key === s.identity)
        return this.perform(type, s.identity, now, call, status);
      if (!this.readyWait || this.readyWait.type !== type) {
        const sample = Number(this.random());
        const delay = 1e3 + Math.round(Math.max(0, Math.min(1, Number.isFinite(sample) ? sample : 0.5)) * 500);
        this.readyWait = { type, key: s.identity, layer: s.layer, status: s.player.status, due: now + delay };
      }
      if (now < this.readyWait.due)
        return { play: false, status: `S\u1EBD ${type} sau ${((this.readyWait.due - now) / 1e3).toFixed(1)} gi\xE2y\u2026` };
      return this.perform(type, s.identity, now, call, status);
    }
    perform(type, key, now, call, status) {
      if (this.action?.type === type && this.action.key === key) {
        if (now - this.action.at > 2e4)
          throw Error("Ziga ch\u01B0a x\xE1c nh\u1EADn thao t\xE1c " + type + ". \u0110\xE3 d\u1EEBng \u0111\u1EC3 tr\xE1nh g\u1EEDi l\u1EB7p.");
        return { play: false, status: "\u0110ang ch\u1EDD Ziga x\xE1c nh\u1EADn: " + status };
      }
      this.action = { type, key, at: now };
      this.nextAt = now + (["v\xE0o b\xE0n", "ng\u1ED3i ch\u01A1i"].includes(type) ? 0 : 2500);
      call();
      return { play: false, status };
    }
    step(s, { autoAds = false, maxHearts = 1, maxAds = 3 } = {}, now = Date.now()) {
      const { w, g, stage, common, hearts, logic, layer, player } = s;
      if (this.readyWait && (stage !== "table" || this.readyWait.key !== s.identity || this.readyWait.layer !== layer || this.readyWait.status !== player?.status || player?.Ka || s.playing || s.finished || (logic?.ha?.filter((p) => p && !p.Ka).length ?? 0) < 2))
        this.readyWait = null;
      if (g.ia !== w.K && !(g.ia === -1 && ["menu", "verification"].includes(stage)))
        throw Error("\u0110\xE3 r\u1EDDi C\u1EDD t\u01B0\u1EDBng. D\u1EEBng t\u1EF1 ch\u01A1i.");
      if (!Number.isInteger(maxHearts) || maxHearts < 1 || maxHearts > 1e4 || !Number.isInteger(maxAds) || maxAds < 1 || maxAds > 10)
        throw Error("Gi\u1EDBi h\u1EA1n tim: 1\u201310000; s\u1ED1 qu\u1EA3ng c\xE1o: 1\u201310.");
      if (stage === "unknown")
        throw Error("Tr\u1EA1ng th\xE1i trang kh\xF4ng \u0111\u01B0\u1EE3c h\u1ED7 tr\u1EE3. H\xE3y ki\u1EC3m tra CAPTCHA ho\u1EB7c k\u1EBFt n\u1ED1i.");
      if (s.syncing) {
        this.idleWatch = null;
        if (this.syncAt === null)
          this.syncAt = now;
        if (now - this.syncAt > 2e4)
          throw Error("B\xE0n kh\xF4ng \u0111\u1ED3ng b\u1ED9 sau 20 gi\xE2y. H\xE3y ki\u1EC3m tra k\u1EBFt n\u1ED1i.");
        return { play: false, status: "T\u1EF1 ch\u01A1i v\u1EABn b\u1EADt. \u0110ang ch\u1EDD b\xE0n \u0111\u1ED3ng b\u1ED9\u2026" };
      }
      this.syncAt = null;
      if (stage === "verification")
        return { play: false, status: "H\xE3y t\u1EF1 x\xE1c minh CAPTCHA/\u0111\u0103ng nh\u1EADp. Bot ch\u1EDD m\xE0n h\xECnh ch\u1ECDn game r\u1ED3i s\u1EBD ch\u1ECDn C\u1EDD t\u01B0\u1EDBng." };
      if (this.ad && now - this.ad.at > 12e4)
        throw Error("Qu\u1EA3ng c\xE1o qu\xE1 th\u1EDDi gian. H\xE3y ki\u1EC3m tra ho\u1EB7c xem th\u1EE7 c\xF4ng r\u1ED3i b\u1EADt l\u1EA1i.");
      const ads = getAdStatus(w, now);
      if (ads.failed && this.ad)
        throw Error("Qu\u1EA3ng c\xE1o kh\xF4ng t\u1EA3i \u0111\u01B0\u1EE3c. Ch\u01B0a \u0111\u01B0\u1EE3c c\u1ED9ng tim; h\xE3y th\u1EED th\u1EE7 c\xF4ng.");
      if (ads.blocking) {
        this.idleWatch = null;
        return { play: false, status: ads.status };
      }
      if (this.ad) {
        if (hearts > this.ad.hearts) {
          this.ad = null;
          this.action = null;
          this.nextAt = now + 3e3;
          if (s.popup && w.Sa !== void 0 && s.popup.type === w.Sa && typeof s.popup.removeSelf === "function")
            s.popup.removeSelf();
          return { play: false, status: "Ziga \u0111\xE3 c\u1ED9ng tim. Chu\u1EA9n b\u1ECB ch\u01A1i ti\u1EBFp\u2026" };
        }
        return { play: false, status: "Ch\u1EDD Ziga x\xE1c nh\u1EADn tim t\u1EEB qu\u1EA3ng c\xE1o\u2026" };
      }
      if (s.playing) {
        if (player.Ka)
          throw Error("\u0110ang xem v\xE1n ng\u01B0\u1EDDi kh\xE1c. Kh\xF4ng t\u1EF1 chi\u1EBFm ch\u1ED7 trong v\xE1n \u0111ang di\u1EC5n ra.");
        this.action = null;
        this.finishAt = null;
        this.lastTable = s.identity;
        this.idleWatch = null;
        this.leaving = null;
        return { play: true };
      }
      if (stage !== "table")
        this.leaving = null;
      const idleAction = this.checkIdle(s, now);
      if (idleAction)
        return idleAction;
      if (now < this.nextAt)
        return { play: false, status: "Ch\u1EDD chuy\u1EC3n tr\u1EA1ng th\xE1i\u2026" };
      if (s.finished) {
        if (this.finishAt === null)
          this.finishAt = now;
        if (now - this.finishAt < 4e3)
          return { play: false, status: "V\xE1n \u0111\xE3 k\u1EBFt th\xFAc. S\u1EBD r\u1EDDi b\xE0n sau v\xE0i gi\xE2y\u2026" };
        if (typeof logic.uo !== "function")
          throw Error("Kh\xF4ng nh\u1EADn di\u1EC7n \u0111\u01B0\u1EE3c n\xFAt r\u1EDDi b\xE0n.");
        return this.perform("r\u1EDDi b\xE0n", s.identity, now, () => logic.uo(0), "\u0110\xE3 y\xEAu c\u1EA7u r\u1EDDi b\xE0n sau v\xE1n.");
      }
      this.finishAt = null;
      if (hearts < 1) {
        if (!autoAds)
          throw Error("H\u1EBFt tim. H\xE3y xem qu\u1EA3ng c\xE1o th\u1EE7 c\xF4ng ho\u1EB7c b\u1EADt t\u1EF1 xem nh\u1EADn tim.");
        if (this.adsUsed >= maxAds)
          throw Error("\u0110\xE3 \u0111\u1EA1t gi\u1EDBi h\u1EA1n qu\u1EA3ng c\xE1o trong phi\xEAn. D\u1EEBng t\u1EF1 ch\u01A1i.");
        if (w.document?.visibilityState === "hidden")
          return { play: false, status: "\u0110\u01B0a tab Ziga ra tr\u01B0\u1EDBc \u0111\u1EC3 xem qu\u1EA3ng c\xE1o nh\u1EADn tim." };
        const heartPopup = typeof w.BkAddHeartWindow === "function" && s.popup instanceof w.BkAddHeartWindow;
        if (s.popup && !heartPopup)
          throw Error("C\xF3 popup khi h\u1EBFt tim. H\xE3y x\u1EED l\xFD popup r\u1ED3i b\u1EADt l\u1EA1i \u0111\u1EC3 xem qu\u1EA3ng c\xE1o.");
        if (typeof w.WebAdsManager?.showRewardAdsOnWeb !== "function")
          throw Error("Kh\xF4ng c\xF3 n\xFAt qu\u1EA3ng c\xE1o nh\u1EADn tim t\u01B0\u01A1ng th\xEDch.");
        this.ad = { hearts, at: now };
        this.adsUsed++;
        w.WebAdsManager.showRewardAdsOnWeb();
        return { play: false, status: "\u0110\xE3 m\u1EDF qu\u1EA3ng c\xE1o nh\u1EADn tim. Ch\u1EDD trang x\xE1c nh\u1EADn\u2026" };
      }
      if (s.popup)
        throw Error("C\xF3 popup c\u1EA7n x\u1EED l\xFD. T\u1EF1 ch\u01A1i \u0111\xE3 d\u1EEBng.");
      if (stage === "menu") {
        const selector = w.getCurrentScene?.()?.ve;
        if (typeof selector?.iC === "function")
          return this.perform("ch\u1ECDn C\u1EDD t\u01B0\u1EDBng", "chess", now, () => selector.iC(w.K), "\u0110\xE3 ch\u1ECDn C\u1EDD t\u01B0\u1EDBng t\u1EEB m\xE0n h\xECnh ch\xEDnh\u2026");
        if (g.ia !== w.K)
          throw Error("Kh\xF4ng nh\u1EADn di\u1EC7n \u0111\u01B0\u1EE3c n\xFAt C\u1EDD t\u01B0\u1EDBng \u1EDF m\xE0n h\xECnh ch\xEDnh.");
        if (typeof common.gz !== "function")
          throw Error("Kh\xF4ng nh\u1EADn di\u1EC7n \u0111\u01B0\u1EE3c s\u1EA3nh C\u1EDD t\u01B0\u1EDBng.");
        return this.perform("m\u1EDF s\u1EA3nh", "chess", now, () => common.gz(w.K), "\u0110ang m\u1EDF s\u1EA3nh C\u1EDD t\u01B0\u1EDBng\u2026");
      }
      if (stage === "lobby") {
        const tables = common.ic?.aN;
        if (!Array.isArray(tables) || typeof common.FJ !== "function")
          throw Error("Kh\xF4ng \u0111\u1ECDc \u0111\u01B0\u1EE3c danh s\xE1ch b\xE0n C\u1EDD t\u01B0\u1EDBng.");
        const candidates = tables.filter((t) => Number.isInteger(t.wg) && t.wg >= 0 && t.wg <= 255 && t.aj === 2 && t.tk >= 0 && t.tk < 2 && !t.Rb && !t.Wj && Number.isFinite(t.Yb) && t.Yb >= 0 && t.Yb <= Math.min(hearts, maxHearts) && !this.skippedTables.has(`${g.af}:${t.wg}`));
        candidates.sort((a, b) => b.tk - a.tk || a.Yb - b.Yb || a.wg - b.wg);
        if (!candidates.length)
          return { play: false, status: "Ch\u01B0a c\xF3 b\xE0n C\u1EDD t\u01B0\u1EDBng kh\xE1c ph\xF9 h\u1EE3p. \u0110ang ch\u1EDD, kh\xF4ng gi\u1EEF b\xE0n c\u0169\u2026" };
        const table = candidates[0];
        return this.perform("v\xE0o b\xE0n", `${g.af}:${table.wg}`, now, () => common.FJ(table.wg), "\u0110ang v\xE0o b\xE0n C\u1EDD t\u01B0\u1EDBng " + table.wg + "\u2026");
      }
      if (stage === "table") {
        if (![w.GAME_STATE_READY, w.GAME_STATE_NOT_READY].filter((v) => v !== void 0).includes(logic.Fb))
          throw Error("B\xE0n \u0111ang \u1EDF tr\u1EA1ng th\xE1i ch\u01B0a h\u1ED7 tr\u1EE3.");
        if (!Number.isFinite(logic.Ke) || logic.Ke > maxHearts || logic.Ke > hearts)
          throw Error("M\u1EE9c tim c\u1EE7a b\xE0n v\u01B0\u1EE3t gi\u1EDBi h\u1EA1n; h\xE3y ch\u1ECDn l\u1EA1i b\xE0n.");
        if (player.Ka) {
          if (typeof logic.wz !== "function" || logic.wz() < 0 || typeof logic.TC !== "function")
            throw Error("B\xE0n kh\xF4ng c\xF2n ch\u1ED7 ng\u1ED3i.");
          return this.perform("ng\u1ED3i ch\u01A1i", s.identity, now, () => logic.TC(false), "\u0110ang ng\u1ED3i v\xE0o b\xE0n\u2026");
        }
        const players = logic.ha?.filter((p) => p && !p.Ka) || [];
        if (players.length < 2) {
          this.readyWait = null;
          return { play: false, status: "\u0110\xE3 v\xE0o b\xE0n. \u0110ang ch\u1EDD \u0111\u1EE7 2 ng\u01B0\u1EDDi ng\u1ED3i ch\u01A1i\u2026" };
        }
        const readyButton = layer.mb;
        const visibleReady = readyButton && readyButton.isVisible?.() !== false && readyButton.isEnabled?.() !== false && readyButton.isTouchEnabled?.() !== false && readyButton.x >= 0 && readyButton.y >= 0 && player.status !== w.PLAYER_STATE_TABLE_OWNER;
        if (player.status === w.PLAYER_STATE_NOT_READY || w.PLAYER_STATE_FINISH_GAME !== void 0 && player.status === w.PLAYER_STATE_FINISH_GAME || visibleReady) {
          if (typeof layer.onReady !== "function")
            throw Error("Kh\xF4ng nh\u1EADn di\u1EC7n \u0111\u01B0\u1EE3c n\xFAt s\u1EB5n s\xE0ng.");
          return this.delayedReady("s\u1EB5n s\xE0ng", s, now, () => layer.onReady(), "\u0110\xE3 y\xEAu c\u1EA7u s\u1EB5n s\xE0ng\u2026");
        }
        if (player.status === w.PLAYER_STATE_TABLE_OWNER && players.every((p) => p === player || p.status === w.PLAYER_STATE_READY)) {
          if (typeof logic.fG !== "function")
            throw Error("Kh\xF4ng nh\u1EADn di\u1EC7n \u0111\u01B0\u1EE3c n\xFAt b\u1EAFt \u0111\u1EA7u v\xE1n.");
          return this.delayedReady("b\u1EAFt \u0111\u1EA7u", s, now, () => logic.fG(), "\u0110ang b\u1EAFt \u0111\u1EA7u v\xE1n C\u1EDD t\u01B0\u1EDBng\u2026");
        }
        return { play: false, status: "\u0110ang ch\u1EDD \u0111\u1ED1i th\u1EE7 s\u1EB5n s\xE0ng\u2026" };
      }
      return { play: false, status: "\u0110ang ch\u1EDD Ziga\u2026" };
    }
  };

  // src/draw.js
  var requestText = "\u0110\u1ED1i ph\u01B0\u01A1ng mu\u1ED1n h\xF2a. B\u1EA1n c\xF3 \u0111\u1ED3ng \xFD kh\xF4ng?";
  function drawPopup(w = window) {
    const popup = w.Fl;
    const text = popup?.la?.getString?.()?.replace(/\s+/g, " ").trim();
    if (text !== requestText || typeof popup.Vl !== "function" || typeof popup.hf !== "function" || typeof popup.removeSelf !== "function")
      return null;
    const top = w.BkStackWindow?.Vj?.();
    if (top && top !== popup)
      return null;
    return popup;
  }
  function drawDecision(state, result) {
    if (result?.source !== "engine" || !Number.isInteger(result.depth) || result.depth < 14 || result.score?.bound !== false || !Number.isFinite(result.score?.value))
      return "manual";
    const score = result.score.value * (state.myTurn ? 1 : -1);
    if (result.score.type === "mate")
      return score > 0 ? "refuse" : score < 0 ? "accept" : "manual";
    if (result.score.type !== "cp")
      return "manual";
    return score <= 30 ? "accept" : "refuse";
  }
  function respondDraw(expected, popup, decision, w = window) {
    const current = readState(w);
    if (current.key !== expected.key || current.layer !== expected.layer || drawPopup(w) !== popup)
      throw Error("\u0110\u1EC1 ngh\u1ECB h\xF2a ho\u1EB7c th\u1EBF c\u1EDD \u0111\xE3 thay \u0111\u1ED5i; kh\xF4ng tr\u1EA3 l\u1EDDi n\u01B0\u1EDBc c\u0169.");
    if (decision === "accept") {
      const agree = popup.Vl;
      popup.hf(null);
      popup.removeSelf();
      agree();
      popup.Vl = null;
    } else if (decision === "refuse") {
      if (typeof popup.Bp !== "function")
        throw Error("Kh\xF4ng nh\u1EADn di\u1EC7n \u0111\u01B0\u1EE3c n\xFAt t\u1EEB ch\u1ED1i h\xF2a.");
      popup.removeSelf();
    } else
      throw Error("Kh\xF4ng \u0111\u1EE7 d\u1EEF li\u1EC7u \u0111\u1EC3 t\u1EF1 tr\u1EA3 l\u1EDDi h\xF2a.");
  }
  var DrawPolicy = class {
    constructor() {
      this.reset();
    }
    reset() {
      this.layer = null;
      this.room = null;
      this.key = null;
      this.plies = 0;
      this.quiet = 0;
      this.pieces = null;
      this.streak = 0;
      this.evalKey = null;
      this.offers = 0;
      this.lastOfferAt = -Infinity;
      this.lastOfferPly = -Infinity;
    }
    observe(state) {
      if (this.layer !== state.layer || this.room !== state.room) {
        this.reset();
        this.layer = state.layer;
        this.room = state.room;
      }
      if (state.key !== this.key) {
        const count = (state.fen.split(" ")[0].match(/[a-z]/gi) || []).length;
        if (this.key !== null) {
          this.plies++;
          this.quiet = this.pieces === count ? this.quiet + 1 : 0;
        }
        this.pieces = count;
        this.key = state.key;
      }
    }
    record(state, result) {
      this.observe(state);
      if (!state.myTurn || this.evalKey === state.key)
        return;
      this.evalKey = state.key;
      const balanced = result?.source === "engine" && result.depth >= 14 && result.score?.bound === false && result.score?.type === "cp" && Math.abs(result.score.value) <= 20;
      this.streak = balanced ? this.streak + 1 : 0;
    }
    canOffer(state, result, now = Date.now()) {
      const attackers = (state.fen.split(" ")[0].match(/[rncp]/gi) || []).length;
      return state.myTurn && this.key === state.key && this.plies >= 40 && this.streak >= 4 && result?.source === "engine" && result.depth >= 14 && result.score?.bound === false && result.score?.type === "cp" && Math.abs(result.score.value) <= 20 && (attackers <= 4 || this.quiet >= 40) && this.offers < 2 && now - this.lastOfferAt >= 6e4 && this.plies - this.lastOfferPly >= 10;
    }
    offer(expected, result, w = window, now = Date.now()) {
      const state = readState(w);
      if (state.key !== expected.key || state.layer !== expected.layer || !this.canOffer(state, result, now) || w.Fl || w.BkStackWindow?.Vj?.())
        return false;
      if (w.CHESS_DRAW_REQUEST === void 0 || typeof state.logic.yr !== "function")
        return false;
      state.logic.yr(w.CHESS_DRAW_REQUEST);
      this.offers++;
      this.lastOfferAt = now;
      this.lastOfferPly = this.plies;
      return true;
    }
  };

  // src/preferences.js
  var defaults = Object.freeze({ time: "auto", book: "5", depth: "0", threads: "2", ponder: true, autoDrawReply: false, autoDrawOffer: false, maxHearts: "1", autoAds: false, maxAds: "3", minimized: false });
  var preferenceKeys = Object.keys(defaults);
  function validPreferences(raw) {
    const out = {};
    if (!raw || typeof raw !== "object" || Array.isArray(raw))
      return out;
    for (const key of preferenceKeys) {
      const v = raw[key];
      if (typeof defaults[key] === "boolean") {
        if (typeof v === "boolean")
          out[key] = v;
        continue;
      }
      const s = typeof v === "string" ? v : typeof v === "number" && Number.isInteger(v) ? String(v) : null;
      if (s === null)
        continue;
      if (key === "time") {
        if (["auto", "650", "1200", "2500", "5000", "10000"].includes(s))
          out[key] = s;
        continue;
      }
      if (key === "book") {
        if (["0", "3", "4", "5"].includes(s))
          out[key] = s;
        continue;
      }
      const [min, max] = { depth: [0, 64], threads: [1, 16], maxHearts: [1, 1e4], maxAds: [1, 10] }[key];
      if (/^(0|[1-9]\d*)$/.test(s) && Number(s) >= min && Number(s) <= max)
        out[key] = s;
    }
    return out;
  }
  function bindPreferences(root, { load, save }) {
    const dirty = /* @__PURE__ */ new Set();
    let writes = Promise.resolve();
    const status = (text) => {
      const el = root.getElementById("settingsStatus");
      if (el)
        el.textContent = text;
    };
    for (const key of preferenceKeys) {
      const el = root.getElementById(key);
      const changed = () => {
        dirty.add(key);
        const patch = validPreferences({ [key]: typeof defaults[key] === "boolean" ? el.checked : el.value });
        if (!(key in patch))
          return;
        writes = writes.catch(() => {
        }).then(() => save(patch)).then(() => status("\u0110\xE3 l\u01B0u thi\u1EBFt l\u1EADp.")).catch((e) => status("Kh\xF4ng l\u01B0u \u0111\u01B0\u1EE3c thi\u1EBFt l\u1EADp: " + e.message));
      };
      el.addEventListener("change", changed);
      if (el.type === "number")
        el.addEventListener("input", changed);
    }
    const ready = Promise.resolve().then(load).then((raw) => {
      const values2 = { ...defaults, ...validPreferences(raw) };
      for (const key of preferenceKeys) {
        if (dirty.has(key))
          continue;
        const el = root.getElementById(key);
        if (typeof defaults[key] === "boolean")
          el.checked = values2[key];
        else
          el.value = values2[key];
      }
      status("Thi\u1EBFt l\u1EADp t\u1EF1 l\u01B0u cho l\u1EA7n m\u1EDF sau.");
    }).catch((e) => status("Kh\xF4ng \u0111\u1ECDc \u0111\u01B0\u1EE3c thi\u1EBFt l\u1EADp \u0111\xE3 l\u01B0u: " + e.message));
    return { ready, flush: () => writes };
  }

  // src/main.js
  if (!document.getElementById("ziga-xq-experiment")) {
    let clearBackground = function() {
      ponderJob?.controller.abort();
      ponderJob = null;
      if (engineGameId) {
        void nativeStop(engineGameId);
        engineGameId = null;
      }
      lastPonderAt = 0;
      lastPonderKey = null;
    }, cpuStatus = function(r) {
      if (Number.isFinite(r.cpuPercent))
        $("cpuStatus").textContent = `CPU m\xE1y ${r.cpuPercent}% \xB7 ${r.effectiveThreads || r.threads || "?"} threads${r.ponderPaused ? " \xB7 \u0111ang ngh\u1EC9 ponder" : r.cpuLimited ? " \xB7 gi\u1EA3m t\u1EA3i" : ""}`;
    }, renderMenu = function() {
      const collapsed = minimized.checked;
      menuBody.hidden = collapsed;
      compact.hidden = !collapsed;
      compact.style.display = collapsed ? "block" : "none";
      panel.style.width = collapsed ? "190px" : "255px";
      title.textContent = collapsed ? "Ziga Bot" : "Ziga \xB7 Th\u1EED nghi\u1EC7m";
      minimize.textContent = collapsed ? "+" : "\u2212";
      minimize.title = collapsed ? "M\u1EDF menu" : "Thu nh\u1ECF menu (bot v\u1EABn ch\u1EA1y)";
      minimize.setAttribute("aria-label", collapsed ? "M\u1EDF menu" : "Thu nh\u1ECF menu");
      minimize.setAttribute("aria-expanded", String(!collapsed));
    }, updateButtons = function() {
      $("start").disabled = !settingsReady || enabled;
      $("stop").disabled = !enabled;
      $("autoStart").disabled = !settingsReady || continuous;
      $("autoStop").disabled = !continuous;
      compact.textContent = `T\u1EF1 ch\u01A1i: ${continuous ? "b\u1EADt" : "t\u1EAFt"} \xB7 \u0110i qu\xE2n: ${enabled ? "b\u1EADt" : "t\u1EAFt"}`;
    }, stop = function(message, all = true) {
      enabled = false;
      generation++;
      search?.controller.abort();
      search = null;
      waiting = null;
      clearBackground();
      if (all) {
        continuous = false;
        session.reset();
        $("autoStatus").textContent = "T\u1EF1 ch\u01A1i: \u0111\xE3 d\u1EEBng.";
      }
      updateButtons();
      setStatus(message);
    };
    const host = document.createElement("div");
    host.id = "ziga-xq-experiment";
    host.style.cssText = "position:fixed;top:90px;right:16px;z-index:2147483647";
    const shadow = host.attachShadow({ mode: "closed" });
    shadow.innerHTML = `<style>:host{font:14px system-ui;color:#eee}section{width:255px;background:#17212c;border:1px solid #65758a;border-radius:12px;padding:14px;box-shadow:0 5px 30px #0006}h3{margin:0 0 8px;font-size:16px}button,select{font:inherit;padding:7px;margin:4px 3px 4px 0;border-radius:5px;border:0}button{cursor:pointer}#start{background:#8be3b0}#stop{background:#ffb3ac}p{line-height:1.5;overflow-wrap:anywhere;margin:8px 0}small{color:#b0becb}label{display:block}</style><section><h3>Ziga \xB7 Th\u1EED nghi\u1EC7m</h3><small>Engine JS c\u01A1 b\u1EA3n \xB7 C\u1EDD t\u01B0\u1EDBng</small><label>Th\u1EDDi gian t\xEDnh <select id="time"><option value="300">0,3 gi\xE2y</option><option value="650" selected>0,65 gi\xE2y</option><option value="1200">1,2 gi\xE2y</option></select></label><button id="start">B\u1EADt t\u1EF1 \u0111\xE1nh</button><button id="stop">D\u1EEBng</button><p id="status">\u0110\xE3 t\u1EAFt. V\xE0o b\xE0n c\u1EDD r\u1ED3i b\u1EA5m B\u1EADt.</p><small id="detail"></small></section>`;
    document.documentElement.append(host);
    const $ = (id) => shadow.getElementById(id);
    shadow.querySelector("small").textContent = "Pikafish native \xB7 localhost";
    $("time").innerHTML = '<option value="auto" selected>T\u1EF1 \u0111\u1ED9ng \u226410 gi\xE2y</option><option value="650">0,65 gi\xE2y</option><option value="1200">1,2 gi\xE2y</option><option value="2500">2,5 gi\xE2y</option><option value="5000">5 gi\xE2y</option><option value="10000">10 gi\xE2y</option>';
    const bookLabel = document.createElement("label");
    bookLabel.innerHTML = '\u01AFu ti\xEAn book <select id="book"><option value="3">3 l\u01B0\u1EE3t \u0111\u1EA7u / b\xEAn</option><option value="4">4 l\u01B0\u1EE3t \u0111\u1EA7u / b\xEAn</option><option value="5" selected>5 l\u01B0\u1EE3t \u0111\u1EA7u / b\xEAn</option><option value="0">T\u1EAFt book</option></select>';
    $("start").before(bookLabel);
    const settings = document.createElement("div");
    settings.innerHTML = '<label>\u0110\u1ED9 s\xE2u t\u1ED1i \u0111a <input id="depth" type="number" min="0" max="64" step="1" value="0" style="width:65px"> <small>0 = theo th\u1EDDi gian</small></label><label>Threads <input id="threads" type="number" min="1" max="16" step="1" value="2" style="width:65px"></label>';
    $("start").before(settings);
    const ponderSettings = document.createElement("div");
    ponderSettings.innerHTML = '<label><input id="ponder" type="checkbox" checked> T\xEDnh tr\u01B0\u1EDBc trong l\u01B0\u1EE3t \u0111\u1ED1i th\u1EE7</label><small id="cpuStatus">CPU: \u0111ang \u0111o \xB7 t\u1EF1 gi\u1EA3m t\u1EA3i khi >70% trong 10 gi\xE2y</small>';
    $("start").before(ponderSettings);
    let engineGameId = null, ponderJob = null, lastPonderAt = 0, lastPonderKey = null;
    $("ponder").onchange = () => {
      if (!$("ponder").checked)
        clearBackground();
    };
    const drawSettings = document.createElement("div");
    drawSettings.innerHTML = '<label><input id="autoDrawReply" type="checkbox"> T\u1EF1 nh\u1EADn/t\u1EEB ch\u1ED1i c\u1EA7u h\xF2a theo engine</label><label><input id="autoDrawOffer" type="checkbox"> T\u1EF1 \u0111\u1EC1 ngh\u1ECB h\xF2a khi c\xE2n b\u1EB1ng l\xE2u</label><small id="drawStatus"></small>';
    $("start").before(drawSettings);
    shadow.querySelector("section").style.cssText = "max-height:80vh;overflow-y:auto";
    const draws = new DrawPolicy();
    let manualDraw = null, drawHoldUntil = 0;
    const autoSettings = document.createElement("div");
    autoSettings.innerHTML = '<hr><strong>T\u1EF1 ch\u01A1i li\xEAn ti\u1EBFp \xB7 ch\u1EC9 C\u1EDD t\u01B0\u1EDBng</strong><label>Tim t\u1ED1i \u0111a / b\xE0n <input id="maxHearts" type="number" min="1" max="10000" value="1" style="width:65px"></label><label><input id="autoAds" type="checkbox"> H\u1EBFt tim: t\u1EF1 m\u1EDF qu\u1EA3ng c\xE1o nh\u1EADn tim</label><label>T\u1ED1i \u0111a qu\u1EA3ng c\xE1o / phi\xEAn <input id="maxAds" type="number" min="1" max="10" value="3" style="width:45px"></label><button id="autoStart">B\u1EADt t\u1EF1 ch\u01A1i</button><button id="autoStop">T\u1EAFt t\u1EF1 ch\u01A1i</button><p id="autoStatus">T\u1EF1 ch\u01A1i: \u0111\xE3 t\u1EAFt.</p><hr><strong>Bot \u0111i qu\xE2n trong b\xE0n</strong><br>';
    $("start").before(autoSettings);
    const settingsStatus = document.createElement("small");
    settingsStatus.id = "settingsStatus";
    settingsStatus.textContent = "\u0110ang \u0111\u1ECDc thi\u1EBFt l\u1EADp \u0111\xE3 l\u01B0u\u2026";
    $("detail").after(settingsStatus);
    const panel = shadow.querySelector("section"), title = panel.querySelector("h3");
    const header = document.createElement("div");
    header.style.cssText = "display:flex;align-items:center;justify-content:space-between;gap:8px;position:sticky;top:0;background:#17212c;z-index:1;padding-bottom:6px";
    const minimize = document.createElement("button");
    minimize.id = "minimize";
    minimize.style.cssText = "margin:0;padding:3px 10px;font-size:20px";
    header.append(title, minimize);
    title.style.margin = "0";
    const menuBody = document.createElement("div");
    menuBody.id = "menuBody";
    while (panel.firstChild)
      menuBody.append(panel.firstChild);
    const minimized = document.createElement("input");
    minimized.id = "minimized";
    minimized.type = "checkbox";
    minimized.hidden = true;
    const compact = document.createElement("small");
    compact.id = "compactStatus";
    compact.style.cssText = "display:block;margin-top:5px";
    compact.hidden = true;
    panel.append(header, minimized, compact, menuBody);
    minimized.addEventListener("change", renderMenu);
    minimize.onclick = () => {
      minimized.checked = !minimized.checked;
      minimized.dispatchEvent(new Event("change"));
    };
    renderMenu();
    let settingsReady = false;
    const preferences = bindPreferences(shadow, {
      load: async () => {
        const r = await nativeRequest("settings-get", null, null, new AbortController().signal);
        return r.settings;
      },
      save: (settings2) => nativeRequest("settings-set", null, null, new AbortController().signal, { settings: settings2 })
    });
    void preferences.ready.then(() => {
      settingsReady = true;
      renderMenu();
      updateButtons();
    });
    const session = new AutoSession();
    let continuous = false;
    let observedPly = null, observedKey = null, observedRoom = null, waiting = null;
    let enabled = false, pending = null, lastRoom = null, stableKey = "", stableAt = 0, search = null, generation = 0;
    const setStatus = (t) => {
      $("status").textContent = t;
    };
    $("stop").onclick = () => stop("Bot \u0111i qu\xE2n \u0111\xE3 d\u1EEBng.", false);
    $("start").onclick = () => {
      try {
        if (enabled)
          return;
        const s = continuous ? sessionSnapshot() : readState();
        enabled = true;
        generation++;
        lastRoom = continuous ? null : s.room;
        stableKey = "";
        updateButtons();
        setStatus("\u0110\xE3 b\u1EADt bot \u0111i qu\xE2n. \u0110ang theo d\xF5i C\u1EDD t\u01B0\u1EDBng\u2026");
      } catch (e) {
        setStatus(e.message);
      }
    };
    $("autoStart").onclick = () => {
      try {
        if (continuous)
          return;
        sessionSnapshot();
        session.reset();
        continuous = true;
        updateButtons();
        $("autoStatus").textContent = "T\u1EF1 ch\u01A1i: \u0111\xE3 b\u1EADt. T\u1EF1 v\xE0o/r\u1EDDi b\xE0n C\u1EDD t\u01B0\u1EDBng.";
      } catch (e) {
        $("autoStatus").textContent = e.message;
      }
    };
    $("autoStop").onclick = () => {
      continuous = false;
      session.reset();
      updateButtons();
      $("autoStatus").textContent = "T\u1EF1 ch\u01A1i: \u0111\xE3 t\u1EAFt. Kh\xF4ng t\u1EF1 v\xE0o/r\u1EDDi b\xE0n n\u1EEFa.";
    };
    updateButtons();
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape")
        stop("\u0110\xE3 d\u1EEBng b\u1EB1ng Esc.");
    });
    async function tick() {
      if (!enabled && !continuous)
        return;
      try {
        if (continuous) {
          const snapshot = sessionSnapshot();
          const sessionResult = session.step(snapshot, { autoAds: $("autoAds").checked, maxHearts: Number($("maxHearts").value), maxAds: Number($("maxAds").value) });
          let diagnostic = "";
          if (snapshot.stage === "table" && !sessionResult.play) {
            const seats = snapshot.logic?.ha?.filter((p) => p && !p.Ka).length ?? 0;
            const b = snapshot.layer?.mb;
            const button = b ? b.isVisible?.() !== false && b.x >= 0 && b.y >= 0 ? "hi\u1EC7n" : "\u1EA9n" : "ch\u01B0a c\xF3";
            diagnostic = ` \xB7 Gh\u1EBF ${seats}/2 \xB7 b\xE0n ${snapshot.logic?.Fb ?? "?"} \xB7 vai tr\xF2 ${snapshot.player?.status ?? "?"} \xB7 n\xFAt ${button}`;
          }
          $("autoStatus").textContent = sessionResult.play ? "T\u1EF1 ch\u01A1i: \u0111ang trong v\xE1n C\u1EDD t\u01B0\u1EDBng." : sessionResult.status + diagnostic;
          if (!sessionResult.play) {
            clearBackground();
            if (search || waiting) {
              generation++;
              search?.controller.abort();
              search = null;
              waiting = null;
            }
            pending = null;
            lastRoom = null;
            stableKey = "";
            observedRoom = null;
            if (enabled)
              setStatus("Bot \u0111i qu\xE2n \u0111ang ch\u1EDD v\xE1n b\u1EAFt \u0111\u1EA7u\u2026");
            return;
          }
        }
        if (!enabled)
          return;
        if (!continuous) {
          const ads = getAdStatus();
          if (ads.blocking) {
            if (search || waiting) {
              generation++;
              search?.controller.abort();
              search = null;
              waiting = null;
            }
            clearBackground();
            setStatus(ads.status);
            return;
          }
        }
        const state = readState();
        engineGameId ??= crypto.randomUUID();
        draws.observe(state);
        if (observedRoom !== state.room) {
          observedRoom = state.room;
          observedPly = null;
          observedKey = null;
        }
        if (observedKey !== state.key) {
          if (observedKey !== null && observedPly !== null)
            observedPly++;
          observedKey = state.key;
        }
        if (lastRoom === null && continuous)
          lastRoom = state.room;
        if (state.room !== lastRoom) {
          stop("\u0110\xE3 \u0111\u1ED5i b\xE0n ho\u1EB7c sang v\xE1n m\u1EDBi. B\u1EA5m B\u1EADt \u0111\u1EC3 ti\u1EBFp t\u1EE5c.");
          return;
        }
        const offerPopup = drawPopup();
        if (offerPopup) {
          ponderJob?.controller.abort();
          ponderJob = null;
          if (search?.kind === "draw") {
            if (search.key !== state.key) {
              generation++;
              search.controller.abort();
              search = null;
              manualDraw = null;
            } else
              return;
          }
          if (search || waiting) {
            generation++;
            search?.controller.abort();
            search = null;
            waiting = null;
          }
          if (!$("autoDrawReply").checked) {
            setStatus("C\xF3 \u0111\u1EC1 ngh\u1ECB h\xF2a. \u0110ang ch\u1EDD b\u1EA1n tr\u1EA3 l\u1EDDi.");
            return;
          }
          if (manualDraw?.popup === offerPopup && manualDraw.key === state.key) {
            setStatus("Ch\u01B0a \u0111\u1EE7 \u0111\u1ED9 s\xE2u \u0111\u1EC3 t\u1EF1 quy\u1EBFt \u0111\u1ECBnh h\xF2a. B\u1EA1n h\xE3y tr\u1EA3 l\u1EDDi th\u1EE7 c\xF4ng.");
            return;
          }
          const job2 = { kind: "draw", key: state.key, controller: new AbortController(), generation };
          search = job2;
          setStatus("\u0110\u1ED1i th\u1EE7 c\u1EA7u h\xF2a. \u0110ang t\xEDnh l\u1EA1i b\u1EB1ng Pikafish\u2026");
          let evaluation;
          try {
            evaluation = await nativeBestMove(state.fen, 1200, job2.controller.signal, { bookMoves: 0, depth: 0, threads: Number($("threads").value), reverse: state.layer.hc, gameId: engineGameId, usePonder: false });
          } catch (e) {
            if (generation === job2.generation && enabled) {
              manualDraw = { popup: offerPopup, key: state.key };
              setStatus("Kh\xF4ng \u0111\xE1nh gi\xE1 \u0111\u01B0\u1EE3c l\u1EDDi c\u1EA7u h\xF2a: " + e.message);
            }
            return;
          } finally {
            if (search === job2)
              search = null;
          }
          if (!enabled || generation !== job2.generation || !$("autoDrawReply").checked)
            return;
          if (drawPopup() !== offerPopup || readState().key !== state.key)
            return;
          const decision = drawDecision(state, evaluation);
          if (decision === "manual") {
            manualDraw = { popup: offerPopup, key: state.key };
            setStatus("Ch\u01B0a \u0111\u1EE7 d\u1EEF li\u1EC7u. Gi\u1EEF \u0111\u1EC1 ngh\u1ECB h\xF2a \u0111\u1EC3 b\u1EA1n quy\u1EBFt \u0111\u1ECBnh.");
            return;
          }
          respondDraw(state, offerPopup, decision);
          $("drawStatus").textContent = decision === "accept" ? "\u0110\xE3 \u0111\u1ED3ng \xFD h\xF2a theo \u0111\xE1nh gi\xE1 engine." : "\u0110\xE3 t\u1EEB ch\u1ED1i h\xF2a v\xEC engine \u0111\xE1nh gi\xE1 c\xF3 l\u1EE3i th\u1EBF.";
          setStatus($("drawStatus").textContent);
          manualDraw = null;
          if (decision === "accept")
            drawHoldUntil = Date.now() + 5e3;
          return;
        }
        manualDraw = null;
        if (Date.now() < drawHoldUntil) {
          setStatus("\u0110\xE3 \u0111\u1ED3ng \xFD h\xF2a. \u0110ang ch\u1EDD Ziga x\xE1c nh\u1EADn\u2026");
          return;
        }
        if (waiting) {
          const queued = waiting;
          if (state.key !== queued.state.key || state.layer !== queued.state.layer || !state.myTurn || generation !== queued.generation) {
            stop("B\xE0n c\u1EDD ho\u1EB7c l\u01B0\u1EE3t \u0111\xE3 thay \u0111\u1ED5i trong l\xFAc ch\u1EDD. \u0110\xE3 h\u1EE7y n\u01B0\u1EDBc.");
            return;
          }
          const remaining = queued.readyAt - Date.now();
          if (remaining > 0) {
            setStatus(`\u0110\xE3 c\xF3 n\u01B0\u1EDBc. Ch\u1EDD ${(remaining / 1e3).toFixed(1)} gi\xE2y tr\u01B0\u1EDBc khi \u0111i\u2026`);
            return;
          }
          sendMove(queued.state, queued.move);
          waiting = null;
          pending = { key: state.key, at: Date.now() };
          const move2 = queued.move;
          setStatus(`\u0110\xE3 g\u1EEDi ${String.fromCharCode(97 + move2.x)}${9 - move2.y} \u2192 ${String.fromCharCode(97 + move2.tx)}${9 - move2.ty}. Ch\u1EDD x\xE1c nh\u1EADn\u2026`);
          return;
        }
        if (search) {
          if (search.key !== state.key)
            stop("B\xE0n c\u1EDD \u0111\xE3 thay \u0111\u1ED5i trong l\xFAc t\xEDnh. B\u1EA5m B\u1EADt \u0111\u1EC3 ti\u1EBFp t\u1EE5c.");
          return;
        }
        if (pending) {
          if (state.key === pending.key) {
            if (Date.now() - pending.at > 8e3)
              stop("Ch\u01B0a nh\u1EADn x\xE1c nh\u1EADn sau 8 gi\xE2y. \u0110\xE3 d\u1EEBng; h\xE3y ki\u1EC3m tra b\xE0n c\u1EDD.");
            return;
          }
          pending = null;
        }
        if (state.key !== stableKey) {
          stableKey = state.key;
          stableAt = Date.now();
          return;
        }
        if (Date.now() - stableAt < ($("ponder").checked && state.myTurn ? 200 : 500))
          return;
        if (!state.myTurn) {
          const ponderKey = state.key + ":" + $("threads").value + ":" + $("depth").value;
          if (lastPonderKey !== ponderKey) {
            ponderJob?.controller.abort();
            ponderJob = null;
            lastPonderKey = ponderKey;
            lastPonderAt = 0;
          }
          setStatus($("ponder").checked ? "\u0110ang ch\u1EDD \u0111\u1ED1i th\u1EE7 \xB7 engine t\xEDnh tr\u01B0\u1EDBc c\xF3 gi\u1EDBi h\u1EA1n CPU\u2026" : "\u0110ang ch\u1EDD \u0111\u1ED1i th\u1EE7\u2026");
          if ($("ponder").checked && !ponderJob && Date.now() - lastPonderAt >= 5e3) {
            const job2 = { key: state.key, controller: new AbortController(), gameId: engineGameId };
            ponderJob = job2;
            lastPonderAt = Date.now();
            void nativePonder(state.fen, job2.controller.signal, { gameId: job2.gameId, threads: Number($("threads").value), depth: Number($("depth").value) }).then((r) => {
              if (enabled && engineGameId === job2.gameId)
                cpuStatus(r);
            }).catch((e) => {
              if (enabled && engineGameId === job2.gameId && !job2.controller.signal.aborted)
                $("cpuStatus").textContent = "Ponder ch\u01B0a s\u1EB5n s\xE0ng: " + e.message;
            }).finally(() => {
              if (ponderJob === job2)
                ponderJob = null;
            });
          }
          return;
        }
        if (ponderJob) {
          ponderJob.controller.abort();
          ponderJob = null;
        }
        const forcedGame = new XiangqiGame_default();
        if (!forcedGame.importFen(state.fen))
          throw Error("Th\u1EBF c\u1EDD kh\xF4ng h\u1EE3p l\u1EC7.");
        const initialChoices = legalMoves(forcedGame, forcedGame.currentTurn);
        if (initialChoices.length === 1) {
          waiting = { state, move: initialChoices[0], generation, readyAt: Date.now() + 500 };
          setStatus("\u0110\xE3 c\xF3 n\u01B0\u1EDBc duy nh\u1EA5t h\u1EE3p l\u1EC7. Ch\u1EDD 0,5 gi\xE2y tr\u01B0\u1EDBc khi \u0111i\u2026");
          $("detail").textContent = "1 l\u1EF1a ch\u1ECDn \xB7 kh\xF4ng c\u1EA7n g\u1ECDi engine \xB7 ch\u1EDD th\xEAm 0,5s";
          return;
        }
        setStatus("\u0110ang t\xEDnh n\u01B0\u1EDBc\u2026");
        const job = { key: state.key, controller: new AbortController(), generation };
        search = job;
        let result;
        const threads = Number($("threads").value), depth = Number($("depth").value);
        if (!Number.isInteger(threads) || threads < 1 || threads > 16 || !Number.isInteger(depth) || depth < 0 || depth > 64) {
          stop("Threads: 1\u201316; \u0111\u1ED9 s\xE2u: 0\u201364.");
          return;
        }
        const budget = $("time").value === "auto" ? initialChoices.length <= 4 ? 650 : initialChoices.length <= 12 ? 2500 : 1e4 : Number($("time").value);
        try {
          result = await nativeBestMove(state.fen, budget, job.controller.signal, { reverse: state.layer.hc, bookMoves: Number($("book").value), ply: observedPly, threads, depth, gameId: engineGameId, usePonder: $("ponder").checked });
        } catch (e) {
          if (generation === job.generation && enabled)
            stop(e.message);
          return;
        } finally {
          if (search === job)
            search = null;
        }
        if (!enabled || generation !== job.generation)
          return;
        if (drawPopup())
          return;
        const freshState = readState();
        if (freshState.key !== state.key || freshState.layer !== state.layer)
          return;
        cpuStatus(result);
        draws.record(state, result);
        if (observedPly === null && Number.isInteger(result.openingPly))
          observedPly = result.openingPly;
        const move = result.move;
        if (!move) {
          stop("Kh\xF4ng c\xF2n n\u01B0\u1EDBc h\u1EE3p l\u1EC7.");
          return;
        }
        const validation = new XiangqiGame_default();
        if (!validation.importFen(state.fen))
          throw Error("Th\u1EBF c\u1EDD kh\xF4ng h\u1EE3p l\u1EC7; \u0111\xE3 d\u1EEBng.");
        const choices = legalMoves(validation, validation.currentTurn);
        if (!choices.some((m) => m.x === move.x && m.y === move.y && m.tx === move.tx && m.ty === move.ty))
          throw Error("N\u01B0\u1EDBc engine kh\xF4ng h\u1EE3p l\u1EC7; \u0111\xE3 d\u1EEBng.");
        if ($("autoDrawOffer").checked && draws.offer(state, result))
          $("drawStatus").textContent = "\u0110\xE3 \u0111\u1EC1 ngh\u1ECB h\xF2a: \u0111\xE1nh gi\xE1 c\xE2n b\u1EB1ng \u1ED5n \u0111\u1ECBnh. Ch\u1EDD \u0111\u1ED1i th\u1EE7 tr\u1EA3 l\u1EDDi.";
        const delay = moveDelayMs(choices.length, result.depth, result);
        waiting = { state, move, generation: job.generation, readyAt: Date.now() + delay };
        setStatus(`\u0110\xE3 c\xF3 n\u01B0\u1EDBc. Ch\u1EDD ${(delay / 1e3).toFixed(1)} gi\xE2y tr\u01B0\u1EDBc khi \u0111i\u2026`);
        $("detail").textContent = `${result.engine}${result.ponderHit ? " \xB7 tr\xFAng nh\xE1nh t\xEDnh tr\u01B0\u1EDBc" : ""} \xB7 s\xE2u ${result.depth} \xB7 ${result.threads ? result.threads + " threads \xB7 " : ""}${result.nodes} n\xFAt \xB7 ${result.ms} ms \xB7 ${choices.length} l\u1EF1a ch\u1ECDn \xB7 ch\u1EDD th\xEAm ${(delay / 1e3).toFixed(1)}s`;
      } catch (e) {
        stop(e.message);
      }
    }
    setInterval(tick, 250);
    window.addEventListener("pagehide", () => stop("\u0110\xE3 d\u1EEBng."));
  }
})();
