const fs = require('fs');
const path = require('path');
const XiangqiGame = require('../game.js');

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
    if (/^[a-i][0-9][a-i][0-9]$/i.test(t)) return t.toLowerCase();
    t = t.replace(/[+?!#x]/g, '');
    if (t.length < 2 || t.length > 4) return null;
    
    let dest = t.slice(-2);
    if (!/^[a-i][0-9]$/.test(dest)) return null;
    
    let toX = dest.charCodeAt(0) - 97;
    let toY = 9 - parseInt(dest[1], 10);
    
    let type = t.length > 2 ? t[0].toLowerCase() : 'p';
    let color = turn % 2 === 0 ? 'red' : 'black';
    let typeMap = {'h':'馬', 'r':'車','c':'炮','e':'相','a':'仕','k':'帥','p':'兵'};
    if (color === 'black') {
        typeMap = {'h':'马', 'r':'車','c':'炮','e':'象','a':'士','k':'將','p':'卒'};
    }
    
    let pName = typeMap[type];
    if (!pName) return null;

    let fromFile = null;
    if (t.length === 4) {
        const ch = t[1];
        if (/[a-i]/.test(ch)) fromFile = ch.charCodeAt(0) - 97;
    }
    
    let found = null;
    for (let y = 0; y < 10; y++) {
        for (let x = 0; x < 9; x++) {
            let p = g.board[y][x];
            if (p && p.color === color && p.name === pName && (fromFile === null || x === fromFile)) {
                let moves = g.getLegalMoves(x, y);
                if (moves.some(m => m[0] === toX && m[1] === toY)) {
                    if (found) return null; // Ambiguous move (should not happen in valid PGN)
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
 * Extracts and validates chess games from a raw PGN string, converting all moves to ICCS.
 */
function extractIccsGamesFromPgn(raw) {
    const text = stripPgnNoise(raw);
    const tokens = text.split(/\s+/).map(t => t.trim()).filter(Boolean);

    const games = [];
    let current = [];
    let stateHistory = [];
    let g = new XiangqiGame();
    g.setupInitialPosition();
    let turn = 0;
    stateHistory.push({ fen: g.exportFen(), turn: 0 });

    const stack = [];

    for (const token of tokens) {
        if (token === '(') {
            if (current.length === 0) continue;
            let branchTurn = current.length - 1;
            let branchCurrent = current.slice(0, branchTurn);
            
            stack.push({
                current: current.slice(),
                stateHistory: stateHistory.slice(),
                turn: turn,
                fen: g.exportFen()
            });

            current = branchCurrent;
            turn = branchTurn;
            g.importFen(stateHistory[turn].fen);
            stateHistory = stateHistory.slice(0, turn + 1);
            continue;
        }

        if (token === ')') {
            if (current.length > 0) {
                games.push(current.slice());
            }
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

        if (/^(1-0|0-1|1\/2-1\/2|\*)$/i.test(t)) {
            if (current.length > 0) { games.push(current.slice()); }
            current = [];
            g = new XiangqiGame();
            g.setupInitialPosition();
            turn = 0;
            stateHistory = [{ fen: g.exportFen(), turn: 0 }];
            stack.length = 0;
            continue;
        }

        if (/^\d+\.(\.\.)?$/.test(t)) continue;

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
    if (current.length > 0) games.push(current.slice());
    
    return games;
}

/**
 * Main command-line wrapper to process a PGN file and save as an Opening Book JSON.
 */
function runConverter() {
    console.log("Xiangqi PGN to Opening Book JSON Converter");
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
    
    console.log("Parsing algebraic notations and simulating board state...");
    const maxPly = 24;
    const maxMovesPerFen = 12;
    const games = extractIccsGamesFromPgn(rawPgn);
    
    const positions = Object.create(null);
    let validGames = 0, collectedMoves = 0;

    for (const gameMoves of games) {
        const sim = new XiangqiGame();
        let gameHadValidMove = false;
        
        for (let ply = 0; ply < Math.min(maxPly, gameMoves.length); ply++) {
            const uci = gameMoves[ply];
            const fen = sim.exportFen();
            const fromX = uci.charCodeAt(0) - 97;
            const fromY = 9 - parseInt(uci[1], 10);
            const toX = uci.charCodeAt(2) - 97;
            const toY = 9 - parseInt(uci[3], 10);

            const ok = sim.move(fromX, fromY, toX, toY);
            if (!ok) break;

            gameHadValidMove = true;
            collectedMoves++;
            
            if (!positions[fen]) positions[fen] = Object.create(null);
            if (!positions[fen][uci]) positions[fen][uci] = { count: 0, pv: [] };
            
            positions[fen][uci].count += 1;
            if (positions[fen][uci].pv.length === 0) {
                positions[fen][uci].pv = gameMoves.slice(ply, Math.min(gameMoves.length, ply + 6));
            }
        }
        if (gameHadValidMove) validGames++;
    }

    console.log("Normalizing frequencies and generating JSON tree...");
    const normalized = Object.create(null);
    
    for (const fen of Object.keys(positions)) {
        const moveEntries = Object.entries(positions[fen]);
        if (moveEntries.length === 0) continue;
        
        const maxCount = Math.max(...moveEntries.map(([, v]) => v.count));
        
        normalized[fen] = moveEntries
            .sort((a, b) => b[1].count - a[1].count)
            .slice(0, maxMovesPerFen)
            .map(([move, data]) => {
                const score = maxCount > 0 ? data.count / maxCount : 0;
                return {
                    move,
                    score: Number(score.toFixed(2)),
                    note: `PGN freq ${data.count}`,
                    pv: Array.isArray(data.pv) ? data.pv.filter(m => /^[a-i][0-9][a-i][0-9]$/.test(m)) : []
                };
            });
    }
    
    const outputData = {
        meta: { 
            name: 'Compiled Algebraic PGN Book', 
            version: '1.0',
            source: path.basename(inputFile)
        }, 
        positions: normalized 
    };

    fs.writeFileSync(outputFile, JSON.stringify(outputData, null, 2));
    console.log(`Success! Saved opening book to ${outputFile}`);
    console.log(`Statistics:
  Games Parsed  : ${games.length}
  Valid Games   : ${validGames}
  Moves Recorded: ${collectedMoves}
  Unique FENs   : ${Object.keys(normalized).length}
`);
}

runConverter();
