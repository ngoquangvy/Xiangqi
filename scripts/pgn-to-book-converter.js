const fs = require('fs');
const path = require('path');
const XiangqiGame = require('../game.js');

/**
 * TỪ ĐIỂN KHAI CUỘC TIẾNG VIỆT (VIETNAMESE OPENING DICTIONARY)
 * Dựa trên các chuỗi nước đi đầu tiên (ICCS).
 */
const VIETNAMESE_OPENINGS = {
    // --- RED FIRST MOVES ---
    'h2e2': 'Pháo Đầu', 'b2e2': 'Pháo Đầu',
    'h0g2': 'Khởi Mã Cuộc', 'b0c2': 'Khởi Mã Cuộc',
    'c3c4': 'Tiên Nhân Chỉ Lộ', 'g3g4': 'Tiên Nhân Chỉ Lộ',
    'e0g2': 'Phi Tượng Cuộc', 'e0c2': 'Phi Tượng Cuộc',
    'h2i2': 'Quá Cung Pháo', 'b2a2': 'Quá Cung Pháo',
    'h2g2': 'Sĩ Giác Pháo', 'b2c2': 'Sĩ Giác Pháo',
    'h2f2': 'Kim Câu Pháo', 'b2d2': 'Kim Câu Pháo',
    'c0e2': 'Sĩ Cuộc', 'g0e2': 'Sĩ Cuộc',
    'h0i2': 'Biên Mã', 'b0a2': 'Biên Mã',

    // --- BLACK RESPONSES TO CENTRAL CANNON (h2e2 / b2e2) ---
    'h2e2_h9e7': 'Thuận Pháo', 'h2e2_b9e7': 'Thuận Pháo',
    'b2e2_h9e7': 'Thuận Pháo', 'b2e2_b9e7': 'Thuận Pháo',
    'h2e2_h9c7': 'Nghịch Pháo', 'h2e2_b9g7': 'Nghịch Pháo',
    'b2e2_h9c7': 'Nghịch Pháo', 'b2e2_b9g7': 'Nghịch Pháo',
    
    'h2e2_h9g7': 'Bình Phong Mã', 'h2e2_b9c7': 'Bình Phong Mã',
    'b2e2_h9g7': 'Bình Phong Mã', 'b2e2_b9c7': 'Bình Phong Mã',
    'h2e2_c9e7': 'Phản Cung Mã', 'h2e2_g9e7': 'Phản Cung Mã',
    'b2e2_c9e7': 'Phản Cung Mã', 'b2e2_g9e7': 'Phản Cung Mã',
    'h2e2_h9i7': 'Đơn Đề Mã', 'h2e2_b9a7': 'Đơn Đề Mã',

    // --- BLACK RESPONSES TO PAWN OPENING (c3c4 / g3g4) ---
    'c3c4_g6g5': 'Đối Binh Cuộc', 'g3g4_c6c5': 'Đối Binh Cuộc',
    'c3c4_h9g7': 'Tiên Nhân Đối Bình Phong',
};

/**
 * Nhận diện tên khai cuộc dựa trên chuỗi nước đi và độ sâu hiện tại.
 */
function identifyOpening(moves, ply) {
    if (!moves || moves.length === 0) return 'Vô Đề';
    
    // Kiểm tra từ biến sâu nhất tới biến nông nhất (max 3 nước đầu)
    const limit = Math.min(ply + 1, 3); 
    for (let i = limit; i >= 1; i--) {
        const sig = moves.slice(0, i).join('_');
        if (VIETNAMESE_OPENINGS[sig]) return VIETNAMESE_OPENINGS[sig];
    }
    
    return 'Biến hóa Lạ';
}

/**
 * Strips metadata tags, braces, semicolon comments, and parentheses variations from PGN.
 */
function stripPgnNoise(raw) {
    if (!raw) return '';
    let text = raw.replace(/^\uFEFF/, '');
    text = text.replace(/\[[^\]]*\]/g, ' '); 
    text = text.replace(/\{[^}]*\}/g, ' '); 
    text = text.replace(/;[^\n\r]*/g, ' '); 
    text = text.replace(/\(/g, ' ( ').replace(/\)/g, ' ) ');
    return text;
}

/**
 * Simulates a PGN token on the Xiangqi board to convert Algebraic Notation (e.g. Hc7) to standard ICCS (e.g. b0c2).
 */
function parsePgnTokenToIccs(t, g, turn) {
    // 1. Handle pure ICCS (e.g. h2e2)
    if (/^[a-i][0-9][a-i][0-9]$/i.test(t)) return t.toLowerCase();
    
    // Clean noise
    t = t.replace(/[+?!#x]/g, '');
    if (t.length < 2) return null;
    
    // Extract target square (last 2 chars)
    let dest = t.slice(-2);
    if (!/^[a-i][0-9]$/.test(dest)) return null;
    let toX = dest.charCodeAt(0) - 97;
    let toY = 9 - parseInt(dest[1], 10);
    
    // Identify piece type
    let pieceType = 'p'; 
    let firstChar = t[0].toLowerCase();
    // Support common PGN piece abbreviations
    if (t.length > 2) {
        if (/[hncbeakmrp]/.test(firstChar)) pieceType = firstChar;
        else return null;
    }
    
    let color = (turn % 2 === 0) ? 'red' : 'black';
    // Match piece names as defined in game.js
    let typeMap = {
        'red':   {'h':'馬', 'r':'車','c':'炮','e':'象','a':'仕','k':'帅','p':'兵', 'n':'馬', 'b':'象', 'm':'仕'},
        'black': {'h':'马', 'r':'車','c':'砲','e':'相','a':'士','k':'将','p':'卒', 'n':'马', 'b':'相', 'm':'士'}
    };
    let pName = typeMap[color][pieceType];
    if (!pName) return null;

    // Disambiguation: Check for source file or rank
    let fromFile = null;
    let fromRank = null;
    if (t.length >= 4) {
        const dChar = t[1].toLowerCase();
        if (/[a-i]/.test(dChar)) fromFile = dChar.charCodeAt(0) - 97;
        else if (/[0-9]/.test(dChar)) fromRank = 9 - parseInt(dChar, 10);
    }
    
    let found = null;
    for (let y = 0; y < 10; y++) {
        if (fromRank !== null && y !== fromRank) continue;
        for (let x = 0; x < 9; x++) {
            if (fromFile !== null && x !== fromFile) continue;
            let p = g.board[y][x];
            if (p && p.color === color && p.name === pName) {
                let moves = g.getLegalMoves(x, y);
                if (moves.some(m => m[0] === toX && m[1] === toY)) {
                    if (found) return null; 
                    found = { fx: x, fy: y };
                }
            }
        }
    }
    
    if (found) {
        return String.fromCharCode(97 + found.fx) + (9 - found.fy) + dest;
    }
    return null;
}

/**
 * Trích xuất ván đấu kèm kết quả từ PGN thô.
 */
function extractIccsGamesFromPgn(raw) {
    // Tách ván đấu dựa trên các tag mở đầu ván mới [Event ...]
    const gameBlocks = raw.split(/\[Event\s+/).filter(Boolean);
    const games = [];

    for (let block of gameBlocks) {
        block = '[Event ' + block;
        
        // 1. Trích xuất kết quả (Result)
        const resultMatch = block.match(/\[Result\s+"(1-0|0-1|1\/2-1\/2|\*)"\]/);
        const result = resultMatch ? resultMatch[1] : '*';

        // 2. Làm sạch noise và lấy tokens nước đi
        const text = stripPgnNoise(block);
        const tokens = text.split(/\s+/).map(t => t.trim()).filter(Boolean);

        let current = [];
        let stateHistory = [];
        let g = new XiangqiGame();
        g.setupInitialPosition();
        let turn = 0;
        stateHistory.push({ fen: g.exportFen(), turn: 0 });

        const stack = [];

        for (const token of tokens) {
            // Xử lý biến hóa phụ ( )
            if (token === '(') {
                if (current.length === 0) continue;
                let branchTurn = current.length - 1;
                stack.push({
                    current: current.slice(),
                    stateHistory: stateHistory.slice(),
                    turn: turn,
                    fen: g.exportFen()
                });
                current = current.slice(0, branchTurn);
                turn = branchTurn;
                g.importFen(stateHistory[turn].fen);
                stateHistory = stateHistory.slice(0, turn + 1);
                continue;
            }

            if (token === ')') {
                if (current.length > 0) games.push({ moves: current.slice(), result });
                if (stack.length > 0) {
                    let restored = stack.pop();
                    current = restored.current;
                    stateHistory = restored.stateHistory;
                    turn = restored.turn;
                    g.importFen(restored.fen);
                }
                continue;
            }

            const t = token.replace(/[?!+#]+$/g, '');

            // Kết thúc ván
            if (/^(1-0|0-1|1\/2-1\/2|\*)$/i.test(t)) {
                if (current.length > 0) games.push({ moves: current.slice(), result });
                break; // Hết ván này
            }

            if (/^\d+\.(\.\.)?$/.test(t)) continue;

            // Parser Algebraic Notation sang ICCS
            const iccs = parsePgnTokenToIccs(t, g, turn);
            if (iccs) {
                current.push(iccs);
                const fx = iccs.charCodeAt(0) - 97;
                const fy = 9 - parseInt(iccs[1], 10);
                const tx = iccs.charCodeAt(2) - 97;
                const ty = 9 - parseInt(iccs[3], 10);
                g.move(fx, fy, tx, ty);
                turn++;
                stateHistory.push({ fen: g.exportFen(), turn: turn });
            }
        }
        if (current.length > 0) games.push({ moves: current.slice(), result });
    }
    
    return games;
}

/**
 * Main command-line wrapper to process a PGN file and save as an Opening Book JSON.
 */
function runConverter() {
    console.log("Xiangqi PGN to Opening Book JSON Converter (Nâng cấp Tên Khai Cuộc & Win-Rate)");
    const args = process.argv.slice(2);
    if (args.length < 2) {
        console.log("Usage: node pgn-to-book-converter.js <input.pgn> <output.json>");
        process.exit(1);
    }
    
    const inputFile = path.resolve(args[0]);
    const outputFile = path.resolve(args[1]);
    
    if (!fs.existsSync(inputFile)) {
        console.error("Input file not found:", inputFile);
        process.exit(1);
    }
    
    console.log(`Reading PGN from ${inputFile}...`);
    const rawPgn = fs.readFileSync(inputFile, 'utf8');
    
    console.log("Parsing results and simulating board state with maximum depth...");
    const maxPly = 200; // Tăng lên 200 để lấy gần như toàn bộ ván đấu
    const maxMovesPerFen = 30; // Tăng lên để chứa mọi biến thể có trong PGN
    const gamesData = extractIccsGamesFromPgn(rawPgn);
    
    const positions = Object.create(null);
    let validGames = 0, collectedMoves = 0;

    for (const { moves, result } of gamesData) {
        const sim = new XiangqiGame();
        let gameHadValidMove = false;
        
        for (let ply = 0; ply < Math.min(maxPly, moves.length); ply++) {
            const uci = moves[ply];
            const fen = sim.exportFen();
            const fromX = uci.charCodeAt(0) - 97;
            const fromY = 9 - parseInt(uci[1], 10);
            const tx = uci.charCodeAt(2) - 97;
            const ty = 9 - parseInt(uci[3], 10);

            // Xác định tên khai cuộc dựa trên chuỗi nước đi đến tận nước này
            const openingName = identifyOpening(moves, ply);

            const ok = sim.move(fromX, fromY, tx, ty);
            if (!ok) break;

            gameHadValidMove = true;
            collectedMoves++;
            
            if (!positions[fen]) positions[fen] = Object.create(null);
            if (!positions[fen][uci]) {
                positions[fen][uci] = { 
                    wins: 0, draws: 0, losses: 0, count: 0,
                    opening: openingName, 
                    pv: [] 
                };
            }
            
            const data = positions[fen][uci];
            data.count += 1;
            
            // Cập nhật tên khai cuộc nếu tìm thấy tên chi tiết hơn
            if (openingName !== 'Biến hóa Lạ' && data.opening === 'Biến hóa Lạ') {
                data.opening = openingName;
            }
            
            // Cập nhật thống kê thắng/thua dựa trên bên nào vừa đi
            const playerColor = (ply % 2 === 0) ? 'red' : 'black';
            let isWinForMover = false;
            
            if (result === '1-0') { // Đỏ thắng
                if (playerColor === 'red') { data.wins++; isWinForMover = true; } else data.losses++;
            } else if (result === '0-1') { // Đen thắng
                if (playerColor === 'black') { data.wins++; isWinForMover = true; } else data.losses++;
            } else if (result === '1/2-1/2') { // Hòa
                data.draws++;
            }
            
            // CẬP NHẬT BIẾN HÓA (PV):
            // Ưu tiên chuỗi PV DÀI NHẤT để có thông tin tối đa (không lọc win_rate)
            const fullRemainingPv = moves.slice(ply); 
            if (data.pv.length < fullRemainingPv.length) {
                data.pv = fullRemainingPv;
                data.lastResult = isWinForMover ? 'WIN' : (result === '1/2-1/2' ? 'DRAW' : 'LOSS');
            }
        }
        if (gameHadValidMove) validGames++;
    }

    console.log("Normalizing scores with Win-Rate formula...");
    const normalized = Object.create(null);
    
    for (const fen of Object.keys(positions)) {
        const moveEntries = Object.entries(positions[fen]);
        if (moveEntries.length === 0) continue;
        
        normalized[fen] = moveEntries
            .map(([move, data]) => {
                // Công thức: Score = (Wins + 0.5 * Draws) / Total
                const total = data.wins + data.draws + data.losses;
                const winProbability = total > 0 ? (data.wins + 0.5 * data.draws) / total : 0.5;
                
                return {
                    move,
                    score: Number(winProbability.toFixed(2)),
                    note: `${data.opening} (W:${data.wins} D:${data.draws} L:${data.losses})`,
                    pv: Array.isArray(data.pv) ? data.pv.filter(m => /^[a-i][0-9][a-i][0-9]$/.test(m)) : []
                };
            })
            // Không lọc bỏ nước đi nào, giữ nguyên mọi biến thể
            .sort((a, b) => b.score - a.score)
            .slice(0, maxMovesPerFen);
    }
    
    const outputData = {
        meta: { 
            name: 'Advanced Vietnamese Opening Book', 
            version: '2.0',
            source: path.basename(inputFile),
            processedAt: new Date().toISOString()
        }, 
        positions: normalized 
    };

    fs.writeFileSync(outputFile, JSON.stringify(outputData, null, 2));
    console.log(`Success! Saved advanced book to ${outputFile}`);
    console.log(`Statistics:
  Games Parsed  : ${gamesData.length}
  Valid Games   : ${validGames}
  Moves Processed: ${collectedMoves}
  Unique FENs   : ${Object.keys(normalized).length}
`);
}

runConverter();
