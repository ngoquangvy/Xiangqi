const fs = require('fs');
const XiangqiGame = require('../src/core/XiangqiGame.js');

const fen = 'rnbakabnr/9/1c5c1/p1p1p1p1p/9/9/PP2P1P1P/1C5C1/9/RNBAKABNR w - - 0 1';
const game = new XiangqiGame();

console.log('Testing FEN Import...');
const success = game.importFen(fen);
console.log('Success:', success);

function getBoardMapString(game, fen) {
    let output = `\n[BOARD MAP TEST]\n`;
    output += '    a b c d e f g h i\n';
    for (let y = 0; y < 10; y++) {
        let label = (9 - y).toString().padStart(2, ' ');
        let line = `${label} `;
        for (let x = 0; x < 9; x++) {
            const p = game.getPiece(x, y);
            if (!p) {
                line += '. ';
            } else {
                // Manually map piece names to symbols for this test
                const symMap = { "車": "R", "馬": "N", "象": "B", "仕": "A", "帅": "K", "将": "k", "炮": "C", "兵": "P", "卒": "p" };
                const sym = symMap[p.name] || '?';
                line += (p.color === 'red' ? sym.toUpperCase() : sym.toLowerCase()) + ' ';
            }
        }
        output += line + '\n';
    }
    output += '    a b c d e f g h i\n\n';
    return output;
}

console.log(getBoardMapString(game, fen));

console.log('--- FULL PIECE SCAN (UCI Mapping) ---');
for (let y = 0; y < 10; y++) {
    for (let x = 0; x < 9; x++) {
        const p = game.getPiece(x, y);
        if (p) {
            const uciFile = String.fromCharCode(97 + x);
            const uciRank = 9 - y;
            console.log(`[PIECE] ${p.name} (${p.color}) at ${uciFile}${uciRank} (x:${x}, y:${y})`);
        }
    }
}

console.log('\n--- TESTING SPECIFIC ENGINE MOVES ---');
const testMoves = ['h7c7', 'f2h3', 'h2e2', 'b2e2'];
testMoves.forEach(m => {
    const fx = m.charCodeAt(0) - 97;
    const fy = 9 - parseInt(m[1]);
    const p = game.getPiece(fx, fy);
    console.log(`Move ${m}: Source ${m.substring(0,2)} (x:${fx}, y:${fy}) -> Found: ${p ? p.name + ' (' + p.color + ')' : 'EMPTY'}`);
});

