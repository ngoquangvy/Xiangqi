// tests/core_tests.js
/**
 * CORE SMOKE TESTS (XiangqiGame.js)
 * -------------------------------------
 * Standalone Node.js script to verify business logic invariants.
 * No Electron or Renderer dependency.
 */
const XiangqiGame = require('../src/core/XiangqiGame');

function assert(condition, message) {
    if (!condition) {
        console.error(`[FAIL] ${message}`);
        process.exit(1);
    }
}

console.log('--- STARTING CORE SMOKE TESTS ---');

// 1. Initial Position Invariants
const game = new XiangqiGame();
assert(game.currentTurn === 'red', 'Initial turn must be red');
assert(game.moveCount === 1, 'Initial move must be 1');

// 2. FEN Round-Trip
const initialFen = 'rnbakabnr/9/1c5c1/p1p1p1p1p/9/9/P1P1P1P1P/1C5C1/9/RNBAKABNR w - - 0 1';
assert(game.exportFen() === initialFen, 'Standard FEN export must match');

// 3. Serialization Round-Trip (JSON + startingFen)
console.log('Testing Serialization (startingFen preservation)...');
const midGameFen = '3ak1b2/4a4/4b4/1R2p3p/6p2/2P3P2/P3P3P/3C5/9/2B1KAB1R b - - 0 15';
game.importFen(midGameFen);
const jsonSnapshot = game.exportGame();
const game2 = new XiangqiGame();
game2.importGame(jsonSnapshot);
assert(game2.startingFen === midGameFen, 'startingFen must be preserved after JSON round-trip');
assert(game2.exportPgn().includes(`[FEN "${midGameFen}"]`), 'PGN must use the preserved startingFen');

// 4. Immutable Notation Snapshots (Disambiguation Case)
console.log('Testing Immutable Notation Snapshots (Disambiguation)...');
game.importFen(initialFen);
assert(game.move(1, 7, 1, 5) === true, 'Move 1 (Red Cannon 2 forward) must be successful'); 
let history = game.getMoveHistory();
const firstMoveNotation = history[0].moveNotation;
assert(game.move(2, 3, 2, 4) === true, 'Setup Black move must be successful');
assert(game.move(7, 7, 1, 7) === true, 'Move 3 (Red Cannon 8 sideways) must be successful'); 
history = game.getMoveHistory();
assert(history[0].moveNotation === firstMoveNotation, 'Notation for Move 1 must NOT change after Move 3');
console.log('  Notation Stability Verified.');

// 5. Hard Rule: Kings Facing
console.log('Testing Hard Rule: Kings Facing...');
// Position: Red King (4,9), Black King (4,0), Black Rook (4,8) - separating them.
const kingsFacingFen = '4k4/9/9/9/9/9/9/9/4r4/4K4 w - - 0 1';
game.importFen(kingsFacingFen);
// Moving Red King to (3,9) is legal (different column)
assert(game.move(4, 9, 3, 9) === true, 'Red King can move away from the column');
game.undo();
// Moving Black Rook (4,8) to (3,8) is ILLEGAL (leaves Kings facing)
assert(game.move(4, 8, 3, 8) === false, 'Black Rook cannot leave column if kings would face');
console.log('  Kings Facing Rule Verified.');

// 6. Hard Rule: Pinned Pieces
console.log('Testing Hard Rule: Pinned Pieces...');
// Position: Red King (4,9), Red Guard (4,8), Black Rook (4,0) - Guard is pinned.
const pinnedFen = '3r5/9/9/9/9/9/9/9/4a4/3K5 w - - 0 1';
game.importFen(pinnedFen);
// Red Guard (4,8) tries to move to (3,7) - would leave King in check (vertical rook attack)
assert(game.move(4, 8, 3, 7) === false, 'Pinned Guard cannot move out of the line of fire');
console.log('  Pinned Piece Rule Verified.');

// 7. Hard Rule: Checkmate Sanity
console.log('Testing Hard Rule: Checkmate Sanity...');
// Specialized Mate FEN: k at (4,0) attacked by Rooks at (0,0), (8,0) and (4,1).
// No escape squares in the palace on row 0 or 1.
const mateFen = 'R3k2RR/4R4/9/9/9/9/9/9/9/4K4 b - - 0 1';
game.importFen(mateFen);
assert(game.isKingInCheck('black') === true, 'Black King must be in check');
assert(game.isCheckmate('black') === true, 'Black King must be checkmated');
console.log('  Checkmate Sanity Verified.');

// 8. Sanity: Cannon Mechanics
console.log('Testing Sanity: Cannon Mechanics...');
// Red Cannon at (1,7), Red Soldier at (1,6), Black Horse at (1,0)
const cannonFen = '1n7/9/9/9/9/9/1P7/1C7/9/9 w - - 0 1';
game.importFen(cannonFen);
assert(game.move(1, 7, 1, 9) === true, 'Cannon can move without screen');
game.undo();
assert(game.move(1, 7, 1, 0) === true, 'Cannon can capture with exactly 1 screen');
game.undo();
// Add another screen at (1,2) -> total 2 screens
game.importFen('1n7/9/1p7/9/9/9/1P7/1C7/9/9 w - - 0 1');
assert(game.move(1, 7, 1, 0) === false, 'Cannon cannot capture with 2 screens');
console.log('  Cannon Mechanics Verified.');

// 9. Sanity: Knight Leg Block (Ma cản)
console.log('Testing Sanity: Knight Leg Block...');
// Red Knight at (1,9). Blocker at (1,8) prevents move to (0,7) or (2,7).
const knightFen = '9/9/9/9/9/9/9/9/1p7/1N7 w - - 0 1';
game.importFen(knightFen);
assert(game.move(1, 9, 0, 7) === false, 'Knight is blocked from (0,7) by piece at (1,8)');
assert(game.move(1, 9, 3, 8) === true, 'Knight can move to (3,8) as (2,9) is empty');
console.log('  Knight Leg Block Verified.');

// 10. Sanity: Elephant River & Block
console.log('Testing Sanity: Elephant River & Block...');
const elephantFen = '9/9/9/9/9/9/9/9/9/2B6 w - - 0 1';
game.importFen(elephantFen);
assert(game.move(2, 9, 4, 7) === true, 'Elephant can move to (4,7)');
// Try to cross river (Red Elephant cannot go to y < 5)
game.importFen('9/9/9/9/9/2B6/9/9/9/9 w - - 0 1');
assert(game.move(2, 5, 0, 3) === false, 'Elephant cannot cross the river');
console.log('  Elephant Rules Verified.');

// 11. Sanity: Palace Restrictions (Guard/King)
console.log('Testing Sanity: Palace Restrictions...');
// Red King at (4,9). Palace is x:[3,5], y:[7,9]. Empty Palace except King.
game.importFen('9/9/9/9/9/9/9/9/9/4K4 w - - 0 1');
assert(game.move(4, 9, 5, 9) === true, 'King can move within Palace');
// Black move to pass turn
game.importFen('9/9/9/9/9/9/9/9/9/5K3 b - - 0 1');
game.importFen('4k4/9/9/9/9/9/9/9/9/5K3 w - - 0 1'); 
assert(game.move(5, 9, 6, 9) === false, 'King cannot leave the Palace boundaries (X)');
assert(game.move(5, 9, 5, 6) === false, 'King cannot leave the Palace boundaries (Y)');
console.log('  Palace Restrictions Verified.');

// 12. Deep Navigation & Timeline Invariants
console.log('Testing Deep Navigation & Timeline...');
game.resetGame();
const moves = [
    [1, 7, 4, 7], // C2-5 (Red)
    [1, 0, 2, 2], // N2+3 (Black)
    [1, 9, 2, 7], // N2+3 (Red)
    [8, 0, 8, 1], // R9+1 (Black)
    [0, 9, 0, 8]  // R1+1 (Red)
];
moves.forEach(([fx, fy, tx, ty], i) => {
    assert(game.move(fx, fy, tx, ty) === true, `Move ${i+1} must be successful`);
    const state = game.getGameState();
    assert(state.lastMove.fromX === fx && state.lastMove.fromY === fy, `lastMove FROM mismatch at move ${i+1}`);
    assert(state.lastMove.toX === tx && state.lastMove.toY === ty, `lastMove TO mismatch at move ${i+1}`);
});

assert(game.currentMoveIndex === 4, 'Move index should be 4');
assert(game.moveCount === 3, 'Move count should be 3 (Red1, Black1, Red2, Black2, Red3)');
assert(game.currentTurn === 'black', 'After 5 moves, it should be Black turn');

console.log('  Testing Undo sequence...');
game.undo(); // Undo R1+1
assert(game.currentTurn === 'red', 'Turn must revert to Red after undo');
assert(game.moveCount === 3, 'Move count remains 3 (Red3 just undone)');
game.undo(); // Undo R9+1 (Black)
assert(game.currentTurn === 'black', 'Turn must revert to Black after second undo');
assert(game.moveCount === 2, 'Move count must revert to 2');

console.log('  Testing Branching...');
// From move index 2 (N2+3 Red), make a different 4th move.
assert(game.move(7, 0, 6, 2) === true, 'New move (N8+7 Black) from historical point must work');
assert(game.getMoveHistory().length === 4, 'History must be truncated after branching at index 3');
assert(game.currentMoveIndex === 3, 'Move index should be 3');
assert(game.currentTurn === 'red', 'After Black move, turn must be Red');

console.log('  Testing JSON Persistence mid-timeline...');
const deepJson = game.exportGame();
const game3 = new XiangqiGame();
game3.importGame(deepJson);
assert(game3.currentMoveIndex === 3, 'Imported game must preserve move index 3');
assert(game3.exportFen() === game.exportFen(), 'Imported game FEN mismatch');
assert(game3.moveCount === game.moveCount, 'Imported game moveCount mismatch');
assert(game3.currentTurn === game.currentTurn, 'Imported game turn mismatch');
assert(game3.getMoveHistory().length === 4, 'Imported history length mismatch');

console.log('  Deep Navigation Verified.');

console.log('--- ALL CORE TESTS PASSED SUCCESSFULLY ---');
