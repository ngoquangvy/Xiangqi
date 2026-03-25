// preload.js
const { contextBridge, ipcRenderer } = require('electron');

let engineProtocol = 'uci';
let engineOutputCallback = null;


contextBridge.exposeInMainWorld('XiangqiGameAPI', {
    // Preload is the trust boundary:
    // - Renderer only sees explicit APIs listed here.
    // - Main process channels stay private behind these wrappers.
    // - Keeps UI code decoupled from Electron internals.
    getPiece: (x, y) => ipcRenderer.invoke('get-piece', x, y),
    move: (fromX, fromY, toX, toY) => ipcRenderer.invoke('move-piece', fromX, fromY, toX, toY),
    makeMove: (fromX, fromY, toX, toY) => ipcRenderer.invoke('move-piece', fromX, fromY, toX, toY),
    getLegalMoves: (x, y) => ipcRenderer.invoke('get-legal-moves', x, y),
    isKingInCheck: (color) => ipcRenderer.invoke('is-king-in-check', color),
    isCheckmate: (color) => ipcRenderer.invoke('is-checkmate', color),
    getCurrentTurn: () => ipcRenderer.invoke('get-current-turn'),
    undo: () => ipcRenderer.invoke('undo'),
    redo: () => ipcRenderer.invoke('redo'),
    resetToInitial: () => ipcRenderer.invoke('reset-to-initial'),
    resetGame: () => ipcRenderer.invoke('reset-game'),
    getMoveHistory: () => ipcRenderer.invoke('get-move-history'),
    // Move-history navigation helpers used by clickable rows in UI.
    getCurrentMoveIndex: () => ipcRenderer.invoke('get-current-move-index'),
    goToMove: (index) => ipcRenderer.invoke('go-to-move', index),
    exportGame: () => ipcRenderer.invoke('export-game'),
    setFlipped: (isFlipped) => ipcRenderer.invoke('set-flipped', isFlipped),
    importGame: (gameData) => ipcRenderer.invoke('import-game', gameData),
    importBookFile: (filePath) => ipcRenderer.invoke('import-book-file', filePath),
    getBooks: () => ipcRenderer.invoke('get-books'),
    selectBook: (bookPath) => ipcRenderer.invoke('select-book', bookPath),
    convertBookLanguage: (bookPath, language) => ipcRenderer.invoke('convert-book-language', bookPath, language),
    analyzePosition: (fen) => ipcRenderer.send('analyze-position', fen),
    onEngineOutput: (callback) => ipcRenderer.on('engine-output', (event, data) => callback(data)),
    getFen: () => ipcRenderer.invoke('get-fen'),
    onEngineReady: (callback) => ipcRenderer.on('engine-ready', (event) => callback()),
    getMoveNotation: (fromX, fromY, toX, toY) => ipcRenderer.invoke('get-move-notation', fromX, fromY, toX, toY),
    getEngines: () => ipcRenderer.invoke('get-engines'),
    addEngine: (path) => ipcRenderer.invoke('add-engine', path),
    removeEngine: (index) => ipcRenderer.invoke('remove-engine', index),
    selectEngine: (index) => ipcRenderer.invoke('select-engine', index),
    on: (channel, callback) => ipcRenderer.on(channel, callback),
    getProtocol: () => engineProtocol,
    setProtocol: (protocol) => { engineProtocol = protocol; },
    importFen: (fen) => ipcRenderer.invoke('import-fen', fen),
    updateEngine: (index, updatedEngine) => ipcRenderer.invoke('update-engine', index, updatedEngine),
    simulatePV: (fen, pvMoves, stepLimit) => ipcRenderer.invoke('simulate-pv', fen, pvMoves, stepLimit),
    formatPV: (fen, pvMoves) => ipcRenderer.invoke('format-pv', fen, pvMoves),

    onEngineOutput: (callback) => {
        engineOutputCallback = callback;
    },
    onEngineReady: (callback) => ipcRenderer.on('engine-ready', (event) => callback()),
});
ipcRenderer.on('update-protocol', (event, protocol) => {
    engineProtocol = protocol || 'uci';
    console.log(`Protocol updated to: ${engineProtocol}`);
});

ipcRenderer.on('engine-output', (event, data) => {
    // Dual registration pattern:
    // - UI may register callback later than first engine output.
    // - Keep callback in a mutable ref so late listeners still receive data.
    if (engineOutputCallback) {
        engineOutputCallback(data);
    } else {
        console.log('UI not ready, engine output received but not processed:', data);
    }
});

ipcRenderer.on('engine-ready', () => {
    console.log('Engine is ready');
});

ipcRenderer.on('engine-error', (event, error) => {
    console.error('Engine error:', error);
    window.dispatchEvent(new CustomEvent('engine-error', { detail: error }));
});





