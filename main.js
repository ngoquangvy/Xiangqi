// main.js
const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs').promises;
const { spawn } = require('child_process');
const fsSync = require('fs'); // Để kiểm tra file tồn tại

const XiangqiGame = require(path.join(__dirname, 'game.js'));

let gameInstance = new XiangqiGame();
let mainWindow;
let engineProcess;
let engines = [];
let engineProtocol = 'uci';
const enginesFile = path.join(app.getPath('userData'), 'engines.json');
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

    await mainWindow.loadFile('index.html').catch(err => {
        console.error('Error loading index.html:', err);
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
        console.error('Error loading engines:', err.message);
        // Kiểm tra xem file Pikafish có tồn tại không
        if (fsSync.existsSync(defaultEngine.path)) {
            engines = [defaultEngine];
            await saveEngines();
        } else {
            console.error(`Default engine not found at ${defaultEngine.path}`);
            engines = [];
        }
    }
}

async function saveEngines() {
    try {
        await fs.writeFile(enginesFile, JSON.stringify(engines, null, 2), 'utf8');
    } catch (err) {
        console.error('Error saving engines:', err.message);
    }
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

    // Kiểm tra xem file engine có tồn tại không
    if (!fsSync.existsSync(enginePath)) {
        console.error(`Engine file does not exist at ${enginePath}`);
        if (mainWindow) {
            mainWindow.webContents.send('engine-error', `Engine file does not exist at ${enginePath}`);
        }
        return;
    }

    try {
        console.log(`Starting engine: ${enginePath}`);
        engineProcess = spawn(enginePath);
    } catch (err) {
        console.error(`Failed to start engine at ${enginePath}: ${err.message}`);
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
        console.log(`Engine output: ${output}`); // Log chi tiết
        if (output.includes('readyok') && mainWindow) {
            mainWindow.webContents.send('engine-ready');
        }
    });

    engineProcess.stderr.on('data', (data) => {
        console.error(`Engine error from ${enginePath}: ${data}`);
        if (mainWindow) {
            mainWindow.webContents.send('engine-error', `Engine error: ${data}`);
        }
    });

    engineProcess.on('error', (err) => {
        console.error(`Engine process error: ${err.message}`);
        if (mainWindow) {
            mainWindow.webContents.send('engine-error', `Engine process error: ${err.message}`);
        }
        engineProcess = null;
    });

    engineProcess.on('close', (code) => {
        console.log(`Engine ${enginePath} exited with code ${code}`);
        if (mainWindow) {
            mainWindow.webContents.send('engine-error', `Engine exited with code ${code}`);
        }
        engineProcess = null;

        if (code !== 0) {
            console.log('Engine crashed, switching to default engine (Pikafish)...');
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
                    console.error('Default engine not available.');
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
        // Tạo một instance tạm thời của XiangqiGame
        const tempGame = new XiangqiGame();

        // Khôi phục trạng thái bàn cờ từ FEN
        tempGame.importFen(fen);

        // Danh sách lưu các trạng thái bàn cờ sau mỗi nước đi
        const boardStates = [];

        // Lưu trạng thái ban đầu
        boardStates.push({
            board: tempGame.board.map(row => row.map(cell => (cell ? { ...cell } : null))),
            currentTurn: tempGame.currentTurn,
            moveCount: tempGame.moveCount
        });

        // Mô phỏng các nước đi trong chuỗi PV đến stepLimit
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
        console.error('Error simulating PV:', err);
        return [];
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
        console.log(`Testing engine: ${enginePath}`);
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
        console.log(`Engine added: ${name} (${protocol}) at ${enginePath}`);
        startEngine(enginePath);
        return { success: true };
    } catch (err) {
        console.error(`Error adding engine: ${err.message}`);
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

ipcMain.handle('get-move-notation', (event, fromX, fromY, toX, toY) => {
    if (!gameInstance.board || !Array.isArray(gameInstance.board)) {
        console.error('Game board is not initialized:', gameInstance.board);
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
        console.warn('No piece found at position for move notation:', { fromX, fromY, toX, toY });
        const pastMove = gameInstance.moveHistory.find(move =>
            move.fromX === fromX && move.fromY === fromY && move.toX === toX && move.toY === toY
        );
        if (pastMove && pastMove.piece) {
            piece = pastMove.piece;
        } else {
            return "Unknown Move";
        }
    }

    const move = { fromX, fromY, toX, toY, piece: { ...piece } };
    return gameInstance.getMoveNotation(move);
});

ipcMain.on('analyze-position', (event, fen) => {
    if (engineProcess && engineProcess.stdin && !engineProcess.killed) {
        try {
            console.log(`Analyzing FEN: ${fen}`);
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
            console.error(`Error writing to engine: ${err.message}`);
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
        console.error('No engines available to start.');
        if (mainWindow) {
            mainWindow.webContents.send('engine-error', 'No engines available. Please add a valid engine.');
        }
    }
}).catch(err => {
    console.error('Error starting app:', err);
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});

process.on('SIGINT', () => {
    console.log('Received SIGINT. Exiting gracefully...');
    app.quit();
});