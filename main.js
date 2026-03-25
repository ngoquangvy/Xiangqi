// main.js
const { app, BrowserWindow, ipcMain, Menu } = require('electron');
const path = require('path');
const fs = require('fs').promises;
const { spawn } = require('child_process');
const fsSync = require('fs');

const XiangqiGame = require(path.join(__dirname, 'game.js'));

const safeLog = (...args) => {
    try {
        console.log(...args);
    } catch (err) {
        if (!err || err.code !== 'EPIPE') {
            throw err;
        }
    }
};

const safeError = (...args) => {
    try {
        console.error(...args);
    } catch (err) {
        if (!err || err.code !== 'EPIPE') {
            throw err;
        }
    }
};

let gameInstance = new XiangqiGame();
let mainWindow;
let engineProcess;
let engines = [];
let engineProtocol = 'uci';
const enginesFile = path.join(app.getPath('userData'), 'engines.json');
const VERBOSE_ENGINE_OUTPUT = process.env.XQ_ENGINE_LOG === '1';

const defaultEngine = {
    name: 'Pikafish',
    path: path.join(__dirname, './assets/pikafish-avx2.exe'),
    protocol: 'uci',
    options: {
        hash: 128,
        multipv: 6,
        depth: 20,
        threads: 1,
        skillLevel: 20
    }
};


function sendMenuAction(action) {
    // Bridge native menu clicks to renderer-side handlers.
    //
    // Renderer action contract:
    // - action is a small string key (e.g. 'undo', 'reset-game').
    // - ui.js is the single place that interprets these actions.
    // - this keeps menu wiring in main process and game behavior in renderer.
    if (!mainWindow || mainWindow.isDestroyed()) {
        return;
    }
    mainWindow.webContents.send('menu-action', action);
}

function buildAppMenu() {
    // Keep common actions available from top menu on desktop.
    //
    // Desktop menu strategy:
    // - File: import/export and data-related actions.
    // - Edit: game timeline actions (undo/redo/reset).
    // - View: board visualization behavior.
    // - Tools: analysis/book/engine quick actions.
    const template = [
        {
            label: 'File',
            submenu: [
                { label: 'Import Game', accelerator: 'CmdOrCtrl+O', click: () => sendMenuAction('import-game') },
                { label: 'Export Game', accelerator: 'CmdOrCtrl+S', click: () => sendMenuAction('export-game') },
                { label: 'Import Book', click: () => sendMenuAction('import-book') },
                { type: 'separator' },
                { role: 'quit' }
            ]
        },
        {
            label: 'Edit',
            submenu: [
                { label: 'Undo', accelerator: 'CmdOrCtrl+Z', click: () => sendMenuAction('undo') },
                { label: 'Redo', accelerator: 'CmdOrCtrl+Y', click: () => sendMenuAction('redo') },
                { type: 'separator' },
                { label: 'Back to Start', click: () => sendMenuAction('reset-initial') },
                { label: 'New Game', click: () => sendMenuAction('reset-game') }
            ]
        },
        {
            label: 'View',
            submenu: [
                { label: 'Flip Board', accelerator: 'CmdOrCtrl+Shift+F', click: () => sendMenuAction('flip-board') },
                { type: 'separator' },
                { role: 'reload' },
                { role: 'toggleDevTools' }
            ]
        },
        {
            label: 'Tools',
            submenu: [
                { label: 'Load Suggestions', accelerator: 'CmdOrCtrl+L', click: () => sendMenuAction('load-suggestions') },
                { label: 'Open Engine Panel', click: () => sendMenuAction('open-engine-menu') },
                { label: 'Open Book Panel', click: () => sendMenuAction('open-book-menu') }
            ]
        }
    ];

    Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

async function createWindow() {
    mainWindow = new BrowserWindow({
        width: 950,
        height: 600,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            sandbox: false,
            preload: path.join(__dirname, 'preload.js')
        }
    });

    buildAppMenu();

    await mainWindow.loadFile('index.html').catch(err => {
        safeError('Error loading index.html:', err);
    });
}

async function loadEngines() {
    try {
        const data = await fs.readFile(enginesFile, 'utf8');
        engines = JSON.parse(data);
        engines = engines.map(engine => ({
            ...engine,
            protocol: engine.protocol || 'uci',
            options: engine.options || {
                hash: 128,
                multipv: 6,
                depth: 20,
                threads: 1,
                skillLevel: 20
            }
        }));
    } catch (err) {
        safeError('Error loading engines:', err.message);
        if (fsSync.existsSync(defaultEngine.path)) {
            engines = [defaultEngine];
            await saveEngines();
        } else {
            safeError(`Default engine not found at ${defaultEngine.path}`);
            engines = [];
        }
    }
}

async function saveEngines() {
    try {
        await fs.writeFile(enginesFile, JSON.stringify(engines, null, 2), 'utf8');
    } catch (err) {
        safeError('Error saving engines:', err.message);
    }
}


function stripPgnNoise(raw) {
    if (!raw || typeof raw !== 'string') {
        return '';
    }

    let text = raw.replace(/^\uFEFF/, '');
    text = text.replace(/\[[^\]]*\]/g, ' '); // PGN tags
    text = text.replace(/\{[^}]*\}/g, ' '); // comments
    text = text.replace(/;[^\n\r]*/g, ' '); // ; comment line tails

    // Remove simple and nested (...) variations
    let prev;
    do {
        prev = text;
        text = text.replace(/\([^()]*\)/g, ' ');
    } while (text !== prev);

    return text;
}

function extractIccsGamesFromPgn(raw) {
    const text = stripPgnNoise(raw);
    const tokens = text.split(/\s+/).map(t => t.trim()).filter(Boolean);

    const games = [];
    let current = [];

    for (const token of tokens) {
        const t = token.replace(/[?!+#]+$/g, '');

        if (/^(1-0|0-1|1\/2-1\/2|\*)$/i.test(t)) {
            if (current.length > 0) {
                games.push(current);
                current = [];
            }
            continue;
        }

        if (/^\d+\.(\.\.)?$/.test(t)) {
            continue;
        }

        if (/^[a-i][0-9][a-i][0-9]$/i.test(t)) {
            current.push(t.toLowerCase());
        }
    }

    if (current.length > 0) {
        games.push(current);
    }

    return games;
}

function convertPgnToOpeningBook(rawPgn, options = {}) {
    const maxPly = Number.isInteger(options.maxPly) ? options.maxPly : 24;
    const maxMovesPerFen = Number.isInteger(options.maxMovesPerFen) ? options.maxMovesPerFen : 12;

    const games = extractIccsGamesFromPgn(rawPgn);
    const positions = Object.create(null);

    let validGames = 0;
    let collectedMoves = 0;

    for (const gameMoves of games) {
        const sim = new XiangqiGame();
        let gameHadValidMove = false;

        for (let ply = 0; ply < Math.min(maxPly, gameMoves.length); ply++) {
            const uci = gameMoves[ply];
            if (!/^[a-i][0-9][a-i][0-9]$/.test(uci)) {
                continue;
            }

            const fen = sim.exportFen();
            const fromX = uci.charCodeAt(0) - 97;
            const fromY = 9 - parseInt(uci[1], 10);
            const toX = uci.charCodeAt(2) - 97;
            const toY = 9 - parseInt(uci[3], 10);

            const ok = sim.move(fromX, fromY, toX, toY);
            if (!ok) {
                break;
            }

            gameHadValidMove = true;
            collectedMoves++;

            if (!positions[fen]) {
                positions[fen] = Object.create(null);
            }
            if (!positions[fen][uci]) {
                positions[fen][uci] = { count: 0, pv: [] };
            }

            positions[fen][uci].count += 1;
            if (positions[fen][uci].pv.length === 0) {
                positions[fen][uci].pv = gameMoves.slice(ply, Math.min(gameMoves.length, ply + 6));
            }
        }

        if (gameHadValidMove) {
            validGames++;
        }
    }

    const normalized = Object.create(null);
    for (const fen of Object.keys(positions)) {
        const moveEntries = Object.entries(positions[fen]);
        if (moveEntries.length === 0) {
            continue;
        }

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

    return {
        book: {
            meta: {
                name: 'PGN Converted Opening Book',
                version: '1.0',
                source: 'pgn-import',
                generatedAt: new Date().toISOString(),
                gamesParsed: games.length,
                gamesAccepted: validGames,
                collectedMoves,
                maxPly,
                maxMovesPerFen
            },
            positions: normalized
        },
        stats: {
            gamesParsed: games.length,
            gamesAccepted: validGames,
            collectedMoves,
            positions: Object.keys(normalized).length
        }
    };
}

function getBookPaths() {
    const booksRoot = path.join(__dirname, 'assets', 'books');
    const sourcesRoot = path.join(booksRoot, 'sources');
    const jsonRoot = path.join(sourcesRoot, 'json');
    const activePath = path.join(booksRoot, 'opening-book.json');
    return { booksRoot, sourcesRoot, jsonRoot, activePath };
}

function translateBookNoteText(text, language) {
    if (!text || typeof text !== 'string') {
        return text;
    }

    const dictVi = [
        ['开局', 'khai cuộc'], ['中炮', 'Trung pháo'], ['顺炮', 'Thuận pháo'], ['屏风马', 'Bình phong mã'],
        ['飞相', 'Phi tượng'], ['仙人指路', 'Tiên nhân chỉ lộ'], ['过宫炮', 'Quá cung pháo'],
        ['先手', 'đi tiên'], ['后手', 'đi hậu'], ['进攻', 'tấn công'], ['防守', 'phòng thủ'], ['变化', 'biến'],
        ['红', 'đỏ'], ['黑', 'đen'], ['车', 'xe'], ['車', 'xe'], ['马', 'mã'], ['炮', 'pháo'],
        ['兵', 'tốt'], ['卒', 'tốt'], ['象', 'tượng'], ['相', 'tượng'], ['士', 'sĩ'], ['仕', 'sĩ'],
        ['将', 'tướng'], ['帅', 'tướng']
    ];

    const dictEn = [
        ['开局', 'opening'], ['中炮', 'central cannon'], ['顺炮', 'parallel cannon'], ['屏风马', 'screen horse'],
        ['飞相', 'flying elephant'], ['仙人指路', 'immortal points the way'], ['过宫炮', 'cross-palace cannon'],
        ['先手', 'first move'], ['后手', 'second move'], ['进攻', 'attack'], ['防守', 'defense'], ['变化', 'variation'],
        ['红', 'red'], ['黑', 'black'], ['车', 'rook'], ['車', 'rook'], ['马', 'horse'], ['炮', 'cannon'],
        ['兵', 'pawn'], ['卒', 'pawn'], ['象', 'elephant'], ['相', 'elephant'], ['士', 'advisor'], ['仕', 'advisor'],
        ['将', 'general'], ['帅', 'general']
    ];

    const dictionary = language === 'vi' ? dictVi : dictEn;
    let output = text;
    dictionary.forEach(([zh, mapped]) => {
        output = output.replace(new RegExp(zh, 'g'), mapped);
    });
    return output;
}

function convertBookNotesLanguage(bookJson, language) {
    const converted = JSON.parse(JSON.stringify(bookJson || {}));
    if (!converted.meta) {
        converted.meta = {};
    }

    converted.meta.language = language;
    converted.meta.translatedAt = new Date().toISOString();
    converted.meta.translationMode = 'dictionary-offline';

    if (converted.positions && typeof converted.positions === 'object') {
        Object.keys(converted.positions).forEach(fen => {
            const arr = converted.positions[fen];
            if (!Array.isArray(arr)) {
                return;
            }
            arr.forEach(item => {
                if (!item || typeof item !== 'object') {
                    return;
                }
                if (typeof item.note === 'string' && item.note.trim()) {
                    item.note = translateBookNoteText(item.note, language);
                }
            });
        });
    }

    return converted;
}

async function listBooksWithMeta() {
    const { jsonRoot, activePath } = getBookPaths();
    await fs.mkdir(jsonRoot, { recursive: true });

    const result = [];
    const seen = new Set();

    const addBook = async (bookPath, isActive) => {
        const resolved = path.resolve(bookPath);
        if (seen.has(resolved) || !fsSync.existsSync(resolved)) {
            return;
        }
        seen.add(resolved);

        let name = path.basename(resolved, '.json');
        try {
            const raw = await fs.readFile(resolved, 'utf8');
            const parsed = JSON.parse(raw);
            if (parsed && parsed.meta && parsed.meta.name) {
                name = parsed.meta.name;
            }
        } catch {
            // Keep file name when JSON meta unavailable
        }

        result.push({
            name,
            path: resolved,
            isActive: Boolean(isActive)
        });
    };

    if (fsSync.existsSync(activePath)) {
        await addBook(activePath, true);
    }

    const files = await fs.readdir(jsonRoot);
    for (const file of files) {
        if (!file.toLowerCase().endsWith('.json')) {
            continue;
        }
        const full = path.join(jsonRoot, file);
        await addBook(full, false);
    }

    return result;
}
async function detectEngineProtocol(enginePath) {
    return new Promise((resolve) => {
        const testProcess = spawn(enginePath);
        let protocol = 'unknown';

        testProcess.stdout.on('data', (data) => {
            const output = data.toString();
            if (output.includes('uciok')) {
                protocol = 'uci';
            } else if (output.includes('ucciok')) {
                protocol = 'ucci';
            }
        });

        testProcess.on('close', () => resolve(protocol));
        testProcess.stdin.write('uci\n');
        testProcess.stdin.write('ucci\n');
        setTimeout(() => testProcess.kill(), 2000);
    });
}

function startEngine(enginePath) {
    if (engineProcess) {
        engineProcess.kill();
        engineProcess = null;
    }
    if (!fsSync.existsSync(enginePath)) {
        safeError(`Engine file does not exist at ${enginePath}`);
        if (mainWindow) {
            mainWindow.webContents.send('engine-error', `Engine file does not exist at ${enginePath}`);
        }
        return;
    }

    try {
        safeLog(`Starting engine: ${enginePath}`);
        engineProcess = spawn(enginePath);
    } catch (err) {
        safeError(`Failed to start engine at ${enginePath}: ${err.message}`);
        if (mainWindow) {
            mainWindow.webContents.send('engine-error', `Failed to start engine: ${err.message}`);
        }
        return;
    }

    engineProcess.stdout.on('data', (data) => {
        if (mainWindow) {
            mainWindow.webContents.send('engine-output', data.toString());
        }
        const output = data.toString();
        if (VERBOSE_ENGINE_OUTPUT) {
            safeLog(`Engine output: ${output}`);
        }
        if (output.includes('readyok') && mainWindow) {
            mainWindow.webContents.send('engine-ready');
        }
    });

    engineProcess.stderr.on('data', (data) => {
        safeError(`Engine error from ${enginePath}: ${data}`);
        if (mainWindow) {
            mainWindow.webContents.send('engine-error', `Engine error: ${data}`);
        }
    });

    engineProcess.on('error', (err) => {
        safeError(`Engine process error: ${err.message}`);
        if (mainWindow) {
            mainWindow.webContents.send('engine-error', `Engine process error: ${err.message}`);
        }
        engineProcess = null;
    });

    engineProcess.on('close', (code) => {
        safeLog(`Engine ${enginePath} exited with code ${code}`);
        if (mainWindow) {
            mainWindow.webContents.send('engine-error', `Engine exited with code ${code}`);
        }
        engineProcess = null;

        if (code !== 0) {
            safeLog('Engine crashed, switching to default engine (Pikafish)...');
            setTimeout(() => {
                const pikafishIndex = engines.findIndex(e => e.name === defaultEngine.name);
                if (pikafishIndex !== -1) {
                    startEngine(engines[pikafishIndex].path);
                    if (mainWindow) {
                        mainWindow.webContents.send('engine-switched', pikafishIndex);
                    }
                } else if (fsSync.existsSync(defaultEngine.path)) {
                    engines.push(defaultEngine);
                    saveEngines();
                    startEngine(defaultEngine.path);
                    if (mainWindow) {
                        mainWindow.webContents.send('engine-switched', engines.length - 1);
                    }
                } else {
                    safeError('Default engine not available.');
                    if (mainWindow) {
                        mainWindow.webContents.send('engine-error', 'No valid engines available.');
                    }
                }
            }, 1000);
        }
    });

    const selectedEngine = engines.find(e => e.path === enginePath) || { protocol: 'uci', options: {} };
    engineProtocol = selectedEngine.protocol;
    if (engineProtocol === 'uci') {
        engineProcess.stdin.write('uci\n');
        if (selectedEngine.options) {
            if (selectedEngine.options.hash) {
                engineProcess.stdin.write(`setoption name Hash value ${selectedEngine.options.hash}\n`);
            }
            if (selectedEngine.options.multipv) {
                engineProcess.stdin.write(`setoption name MultiPV value ${selectedEngine.options.multipv}\n`);
            }
            if (selectedEngine.options.threads) {
                engineProcess.stdin.write(`setoption name Threads value ${selectedEngine.options.threads}\n`);
            }
            if (selectedEngine.options.skillLevel) {
                engineProcess.stdin.write(`setoption name Skill Level value ${selectedEngine.options.skillLevel}\n`);
            }
        }
    } else if (engineProtocol === 'ucci') {
        engineProcess.stdin.write('ucci\n');
    }
    engineProcess.stdin.write('isready\n');
    if (mainWindow) {
        mainWindow.webContents.send('update-protocol', engineProtocol);
    }
}

ipcMain.handle('simulate-pv', async (event, fen, pvMoves, stepLimit) => {
    try {
        const tempGame = new XiangqiGame();
        tempGame.importFen(fen);
        const boardStates = [];
        boardStates.push({
            board: tempGame.board.map(row => row.map(cell => (cell ? { ...cell } : null))),
            currentTurn: tempGame.currentTurn,
            moveCount: tempGame.moveCount
        });
        for (let i = 0; i < pvMoves.length && i < stepLimit; i++) {
            const move = pvMoves[i];
            const fromX = move.charCodeAt(0) - 97; // 'a' = 0, 'i' = 8
            const fromY = 9 - parseInt(move[1]);   // '0' = 9, '9' = 0
            const toX = move.charCodeAt(2) - 97;
            const toY = 9 - parseInt(move[3]);

            const success = tempGame.move(fromX, fromY, toX, toY);
            if (success) {
                boardStates.push({
                    board: tempGame.board.map(row => row.map(cell => (cell ? { ...cell } : null))),
                    currentTurn: tempGame.currentTurn,
                    moveCount: tempGame.moveCount
                });
            } else {
                console.warn(`Invalid move in PV: ${move}`);
                break;
            }
        }

        return boardStates;
    } catch (err) {
        safeError('Error simulating PV:', err);
        return [];
    }
});

ipcMain.handle('format-pv', async (event, fen, pvMoves) => {
    try {
        const tempGame = new XiangqiGame();
        tempGame.importFen(fen);

        const notations = [];
        for (const move of pvMoves || []) {
            if (!/^[a-i][0-9][a-i][0-9]$/.test(move)) continue;

            const fromX = move.charCodeAt(0) - 97;
            const fromY = 9 - parseInt(move[1], 10);
            const toX = move.charCodeAt(2) - 97;
            const toY = 9 - parseInt(move[3], 10);

            const piece = tempGame.getPiece(fromX, fromY);
            const success = tempGame.move(fromX, fromY, toX, toY);
            if (!success) break;

            const lastMove = tempGame.moveHistory[tempGame.moveHistory.length - 1];
            const notation = lastMove?.moveNotation || tempGame.getMoveNotation({
                fromX, fromY, toX, toY, piece: piece ? { ...piece } : null
            });
            notations.push(notation || move);
        }

        const lines = [];
        for (let i = 0; i < notations.length; i += 2) {
            const redMove = notations[i];
            const blackMove = notations[i + 1] || '...';
            lines.push((i / 2 + 1) + '. ' + redMove + ' ' + blackMove);
        }

        return { moves: notations, formatted: lines.join(', ') };
    } catch (err) {
        safeError('Error formatting PV:', err);
        return { moves: [], formatted: '-' };
    }
});

ipcMain.handle('import-fen', (event, fen) => {
    if (typeof gameInstance.importFen !== 'function') {
        throw new Error('importFen is not a function');
    }
    return gameInstance.importFen(fen);
});

ipcMain.handle('get-engines', () => {
    return engines;
});

ipcMain.handle('add-engine', async (event, enginePath) => {
    try {
        safeLog(`Testing engine: ${enginePath}`);
        const protocol = await detectEngineProtocol(enginePath);
        if (protocol === 'unknown') {
            return { success: false, error: 'Engine does not support UCI or UCCI' };
        }

        const name = path.basename(enginePath, '.exe');
        const newEngine = {
            name,
            path: enginePath,
            protocol,
            options: {
                hash: 128,
                multipv: 6,
                depth: 20,
                threads: 1,
                skillLevel: 20
            }
        };
        engines.push(newEngine);
        await saveEngines();
        safeLog(`Engine added: ${name} (${protocol}) at ${enginePath}`);
        startEngine(enginePath);
        return { success: true };
    } catch (err) {
        safeError(`Error adding engine: ${err.message}`);
        return { success: false, error: err.message };
    }
});

ipcMain.handle('remove-engine', async (event, index) => {
    if (index >= 0 && index < engines.length) {
        engines.splice(index, 1);
        await saveEngines();
        if (engines.length > 0) {
            startEngine(engines[0].path);
        } else if (engineProcess) {
            engineProcess.kill();
        }
        return true;
    }
    return false;
});

ipcMain.handle('select-engine', (event, index) => {
    if (index >= 0 && index < engines.length) {
        engineProtocol = engines[index].protocol || 'uci';
        startEngine(engines[index].path);
        mainWindow.webContents.send('update-protocol', engineProtocol);
        return true;
    }
    return false;
});

ipcMain.handle('update-engine', async (event, index, updatedEngine) => {
    if (index >= 0 && index < engines.length) {
        engines[index] = updatedEngine;
        await saveEngines();
        return true;
    }
    return false;
});

ipcMain.handle('get-protocol', () => {
    return engineProtocol;
});

ipcMain.handle('get-fen', () => {
    return gameInstance.exportFen();
});

ipcMain.handle('get-piece', (event, x, y) => {
    if (typeof gameInstance.getPiece !== 'function') {
        throw new Error('getPiece is not a function');
    }
    return gameInstance.getPiece(x, y);
});

ipcMain.handle('set-flipped', (event, isFlipped) => {
    if (typeof gameInstance.setFlipped !== 'function') {
        throw new Error('setFlipped is not a function');
    }
    gameInstance.setFlipped(isFlipped);
    return true;
});

ipcMain.handle('move-piece', (event, fromX, fromY, toX, toY) => {
    if (typeof gameInstance.move !== 'function') {
        throw new Error('move is not a function');
    }
    return gameInstance.move(fromX, fromY, toX, toY);
});

ipcMain.handle('get-legal-moves', (event, x, y) => {
    if (typeof gameInstance.getLegalMoves !== 'function') {
        throw new Error('getLegalMoves is not a function');
    }
    return gameInstance.getLegalMoves(x, y);
});

ipcMain.handle('is-king-in-check', (event, color) => {
    if (typeof gameInstance.isKingInCheck !== 'function') {
        throw new Error('isKingInCheck is not a function');
    }
    return gameInstance.isKingInCheck(color);
});

ipcMain.handle('is-checkmate', (event, color) => {
    if (typeof gameInstance.isCheckmate !== 'function') {
        throw new Error('isCheckmate is not a function');
    }
    return gameInstance.isCheckmate(color);
});

ipcMain.handle('get-current-turn', () => {
    return gameInstance.currentTurn;
});

ipcMain.handle('undo', () => {
    if (typeof gameInstance.undo !== 'function') {
        throw new Error('undo is not a function');
    }
    return gameInstance.undo();
});

ipcMain.handle('redo', () => {
    if (typeof gameInstance.redo !== 'function') {
        throw new Error('redo is not a function');
    }
    return gameInstance.redo();
});

ipcMain.handle('reset-to-initial', () => {
    if (typeof gameInstance.resetToInitial !== 'function') {
        throw new Error('resetToInitial is not a function');
    }
    return gameInstance.resetToInitial();
});

ipcMain.handle('reset-game', () => {
    if (typeof gameInstance.resetGame !== 'function') {
        throw new Error('resetGame is not a function');
    }
    return gameInstance.resetGame();
});

ipcMain.handle('get-move-history', () => {
    if (typeof gameInstance.getMoveHistory !== 'function') {
        throw new Error('getMoveHistory is not a function');
    }
    return gameInstance.getMoveHistory();
});


// Helpers for clickable move history in renderer.
//
// IPC guard pattern:
// - We validate each method exists before calling into gameInstance.
// - This avoids silent failures if class APIs are renamed/refactored.
ipcMain.handle('get-current-move-index', () => {
    if (typeof gameInstance.getCurrentMoveIndex !== 'function') {
        throw new Error('getCurrentMoveIndex is not a function');
    }
    return gameInstance.getCurrentMoveIndex();
});

ipcMain.handle('go-to-move', (event, index) => {
    if (typeof gameInstance.goToMove !== 'function') {
        throw new Error('goToMove is not a function');
    }
    return gameInstance.goToMove(index);
});

ipcMain.handle('export-game', () => {
    if (typeof gameInstance.exportGame !== 'function') {
        throw new Error('exportGame is not a function');
    }
    return gameInstance.exportGame();
});

ipcMain.handle('import-game', (event, gameData) => {
    if (typeof gameInstance.importGame !== 'function') {
        throw new Error('importGame is not a function');
    }
    return gameInstance.importGame(gameData);
});


ipcMain.handle('import-book-file', async (event, sourcePath) => {
    try {
        if (!sourcePath || typeof sourcePath !== 'string') {
            return { success: false, error: 'Invalid book path.' };
        }

        const ext = path.extname(sourcePath).toLowerCase();
        const booksRoot = path.join(__dirname, 'assets', 'books');
        const sourcesRoot = path.join(booksRoot, 'sources');
        const pgnRoot = path.join(sourcesRoot, 'pgn');
        const xobRoot = path.join(booksRoot, 'external', 'xob');
        const jsonRoot = path.join(sourcesRoot, 'json');

        await fs.mkdir(booksRoot, { recursive: true });
        await fs.mkdir(sourcesRoot, { recursive: true });
        await fs.mkdir(pgnRoot, { recursive: true });
        await fs.mkdir(xobRoot, { recursive: true });
        await fs.mkdir(jsonRoot, { recursive: true });

        const fileName = path.basename(sourcePath);
        const stamp = Date.now();

        if (ext === '.json') {
            const raw = await fs.readFile(sourcePath, 'utf8');
            let parsed;
            try {
                parsed = JSON.parse(raw);
            } catch {
                return { success: false, error: 'JSON book is not valid JSON.' };
            }

            if (!parsed || typeof parsed !== 'object' || !parsed.positions || typeof parsed.positions !== 'object') {
                return { success: false, error: 'JSON book must contain an object field: positions.' };
            }

            const activePath = path.join(booksRoot, 'opening-book.json');
            const backupPath = path.join(jsonRoot, `${stamp}-${fileName}`);
            await fs.writeFile(activePath, JSON.stringify(parsed, null, 2), 'utf8');
            await fs.writeFile(backupPath, JSON.stringify(parsed, null, 2), 'utf8');

            return {
                success: true,
                type: 'json',
                activePath,
                storedPath: backupPath,
                message: 'JSON book imported and activated.'
            };
        }

        if (ext === '.pgn') {
            const targetPath = path.join(pgnRoot, `${stamp}-${fileName}`);
            await fs.copyFile(sourcePath, targetPath);

            const rawPgn = await fs.readFile(sourcePath, 'utf8');
            const converted = convertPgnToOpeningBook(rawPgn, { maxPly: 24, maxMovesPerFen: 12 });

            if (!converted.book || !converted.book.positions || Object.keys(converted.book.positions).length === 0) {
                return {
                    success: true,
                    type: 'pgn',
                    storedPath: targetPath,
                    converted: false,
                    message: 'PGN imported to sources, but auto-convert failed (file is not ICCS a0a1 move format).'
                };
            }

            const activePath = path.join(booksRoot, 'opening-book.json');
            const jsonFileName = `${stamp}-${path.parse(fileName).name}.json`;
            const backupPath = path.join(jsonRoot, jsonFileName);

            await fs.writeFile(activePath, JSON.stringify(converted.book, null, 2), 'utf8');
            await fs.writeFile(backupPath, JSON.stringify(converted.book, null, 2), 'utf8');

            return {
                success: true,
                type: 'pgn',
                storedPath: targetPath,
                activePath,
                jsonPath: backupPath,
                stats: converted.stats,
                message: `PGN converted and activated (${converted.stats.positions} positions, ${converted.stats.collectedMoves} moves).`
            };
        }

        if (ext === '.xob') {
            const targetPath = path.join(xobRoot, `${stamp}-${fileName}`);
            await fs.copyFile(sourcePath, targetPath);
            return {
                success: true,
                type: 'xob',
                storedPath: targetPath,
                message: 'XOB imported to external books. Convert to JSON to activate as opening book.'
            };
        }

        return { success: false, error: 'Unsupported book format. Use .json, .pgn, or .xob' };
    } catch (err) {
        safeError('Error importing book file:', err.message || err);
        return { success: false, error: `Import failed: ${err.message || err}` };
    }
});
ipcMain.handle('get-books', async () => {
    try {
        const books = await listBooksWithMeta();
        return { success: true, books };
    } catch (err) {
        safeError('Error loading book list:', err.message || err);
        return { success: false, error: `Failed to load books: ${err.message || err}` };
    }
});

ipcMain.handle('select-book', async (event, bookPath) => {
    try {
        if (!bookPath || typeof bookPath !== 'string') {
            return { success: false, error: 'Invalid book path.' };
        }

        const { activePath, jsonRoot } = getBookPaths();
        const resolved = path.resolve(bookPath);

        if (!fsSync.existsSync(resolved)) {
            return { success: false, error: 'Selected book file does not exist.' };
        }

        await fs.mkdir(jsonRoot, { recursive: true });
        const raw = await fs.readFile(resolved, 'utf8');
        const parsed = JSON.parse(raw);
        if (!parsed || typeof parsed !== 'object' || !parsed.positions || typeof parsed.positions !== 'object') {
            return { success: false, error: 'Selected JSON does not contain a valid positions object.' };
        }

        await fs.writeFile(activePath, JSON.stringify(parsed, null, 2), 'utf8');
        return { success: true, activePath, message: 'Book activated successfully.' };
    } catch (err) {
        safeError('Error selecting book:', err.message || err);
        return { success: false, error: `Select book failed: ${err.message || err}` };
    }
});

ipcMain.handle('convert-book-language', async (event, bookPath, language) => {
    try {
        const lang = String(language || '').toLowerCase();
        if (!['vi', 'en'].includes(lang)) {
            return { success: false, error: 'Unsupported language. Use vi or en.' };
        }
        if (!bookPath || typeof bookPath !== 'string') {
            return { success: false, error: 'Invalid source book path.' };
        }

        const resolved = path.resolve(bookPath);
        if (!fsSync.existsSync(resolved)) {
            return { success: false, error: 'Source book does not exist.' };
        }

        const { jsonRoot } = getBookPaths();
        await fs.mkdir(jsonRoot, { recursive: true });

        const raw = await fs.readFile(resolved, 'utf8');
        const parsed = JSON.parse(raw);
        if (!parsed || typeof parsed !== 'object' || !parsed.positions || typeof parsed.positions !== 'object') {
            return { success: false, error: 'Source JSON does not contain a valid positions object.' };
        }

        const converted = convertBookNotesLanguage(parsed, lang);
        const srcName = path.basename(resolved, '.json');
        const outName = `${Date.now()}-${srcName}.${lang}.json`;
        const outPath = path.join(jsonRoot, outName);

        await fs.writeFile(outPath, JSON.stringify(converted, null, 2), 'utf8');
        return {
            success: true,
            language: lang,
            outputPath: outPath,
            message: `Converted book notes to ${lang.toUpperCase()} and saved.`
        };
    } catch (err) {
        safeError('Error converting book language:', err.message || err);
        return { success: false, error: `Convert failed: ${err.message || err}` };
    }
});
ipcMain.handle('get-move-notation', (event, fromX, fromY, toX, toY) => {
    // Notation request can arrive when board is no longer at move.from state
    // (e.g. user navigated history or suggestion list is from previous position).
    // We therefore recover piece info from move history as a stable fallback.
    if (!gameInstance.board || !Array.isArray(gameInstance.board)) {
        safeError('Game board is not initialized:', gameInstance.board);
        return "Error: Board not initialized";
    }
    const ROWS = 10;
    const COLS = 9;
    if (fromX < 0 || fromX >= COLS || fromY < 0 || fromY >= ROWS ||
        toX < 0 || toX >= COLS || toY < 0 || toY >= ROWS) {
        console.warn('Invalid move coordinates:', { fromX, fromY, toX, toY });
        return "Invalid Move";
    }

    let piece = gameInstance.getPiece(fromX, fromY);
    if (!piece) {
        // Board may have advanced; recover piece from move history for stable notation.

        // Prefer the most recent matching move record when board state has advanced
        const reversedHistory = [...(gameInstance.moveHistory || [])].reverse();
        const pastMove = reversedHistory.find(move =>
            move.fromX === fromX && move.fromY === fromY && move.toX === toX && move.toY === toY && move.piece
        );
        if (pastMove && pastMove.piece) {
            piece = pastMove.piece;
        }
    }

    if (!piece) {
        // Fallback placeholder to avoid "Unknown Move" spam in UI tables.
        return `${String.fromCharCode(97 + fromX)}${10 - fromY}-${String.fromCharCode(97 + toX)}${10 - toY}`;
    }

    const move = { fromX, fromY, toX, toY, piece: { ...piece } };
    return gameInstance.getMoveNotation(move);
});

ipcMain.on('analyze-position', (event, fen) => {
    if (engineProcess && engineProcess.stdin && !engineProcess.killed) {
        try {
            safeLog(`Analyzing FEN: ${fen}`);
            if (engineProtocol === 'uci' || engineProtocol === 'ucci') {
                engineProcess.stdin.write('stop\n');
            }
            engineProcess.stdin.write(`position fen ${fen}\n`);
            const selectedEngine = engines.find(e => e.path === engineProcess.spawnargs[0]) || { options: {} };
            if (engineProtocol === 'uci') {
                if (selectedEngine.options && selectedEngine.options.depth) {
                    engineProcess.stdin.write(`go depth ${selectedEngine.options.depth}\n`);
                } else {
                    engineProcess.stdin.write('go movetime 1000\n');
                }
            } else if (engineProtocol === 'ucci') {
                if (selectedEngine.options && selectedEngine.options.depth) {
                    engineProcess.stdin.write(`go depth ${selectedEngine.options.depth}\n`);
                } else {
                    engineProcess.stdin.write('go time 1000\n');
                }
            }
        } catch (err) {
            safeError(`Error writing to engine: ${err.message}`);
            if (mainWindow) {
                mainWindow.webContents.send('engine-error', `Error writing to engine: ${err.message}`);
            }
        }
    } else {
        console.warn('Engine process is not ready or has been terminated.');
        if (mainWindow) {
            mainWindow.webContents.send('engine-error', 'Engine is not running. Please select a valid engine.');
        }
    }
});

app.whenReady().then(async () => {
    await createWindow();
    await loadEngines();
    if (engines.length > 0) {
        engineProtocol = engines[0].protocol || 'uci';
        startEngine(engines[0].path);
        mainWindow.webContents.send('update-protocol', engineProtocol);
    } else {
        safeError('No engines available to start.');
        if (mainWindow) {
            mainWindow.webContents.send('engine-error', 'No engines available. Please add a valid engine.');
        }
    }
}).catch(err => {
    safeError('Error starting app:', err);
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});

process.on('SIGINT', () => {
    safeLog('Received SIGINT. Exiting gracefully...');
    app.quit();
});














