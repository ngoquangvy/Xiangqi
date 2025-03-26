// preload.js
const { contextBridge, ipcRenderer } = require('electron');

let engineProtocol = 'uci';
let engineOutputCallback = null; // Lưu callback từ ui.js


contextBridge.exposeInMainWorld('XiangqiGameAPI', {
    getPiece: (x, y) => ipcRenderer.invoke('get-piece', x, y),
    move: (fromX, fromY, toX, toY) => ipcRenderer.invoke('move-piece', fromX, fromY, toX, toY),
    getLegalMoves: (x, y) => ipcRenderer.invoke('get-legal-moves', x, y),
    isKingInCheck: (color) => ipcRenderer.invoke('is-king-in-check', color),
    isCheckmate: (color) => ipcRenderer.invoke('is-checkmate', color),
    getCurrentTurn: () => ipcRenderer.invoke('get-current-turn'),
    undo: () => ipcRenderer.invoke('undo'),
    redo: () => ipcRenderer.invoke('redo'),
    resetToInitial: () => ipcRenderer.invoke('reset-to-initial'),
    resetGame: () => ipcRenderer.invoke('reset-game'),
    getMoveHistory: () => ipcRenderer.invoke('get-move-history'),
    exportGame: () => ipcRenderer.invoke('export-game'),
    setFlipped: (isFlipped) => ipcRenderer.invoke('set-flipped', isFlipped),
    importGame: (gameData) => ipcRenderer.invoke('import-game', gameData),
    analyzePosition: (fen) => ipcRenderer.send('analyze-position', fen),
    onEngineOutput: (callback) => ipcRenderer.on('engine-output', (event, data) => callback(data)),
    getFen: () => ipcRenderer.invoke('get-fen'),
    onEngineReady: (callback) => ipcRenderer.on('engine-ready', (event) => callback()),
    getMoveNotation: (fromX, fromY, toX, toY) => ipcRenderer.invoke('get-move-notation', fromX, fromY, toX, toY),
    getEngines: () => ipcRenderer.invoke('get-engines'),
    addEngine: (path) => ipcRenderer.invoke('add-engine', path),
    removeEngine: (index) => ipcRenderer.invoke('remove-engine', index),
    selectEngine: (index) => ipcRenderer.invoke('select-engine', index),
    on: (channel, callback) => ipcRenderer.on(channel, callback), // Để nhận engine-error
    getProtocol: () => engineProtocol, // Để ui.js truy cập
    setProtocol: (protocol) => { engineProtocol = protocol; }, // Đồng bộ từ main.js
    importFen: (fen) => ipcRenderer.invoke('import-fen', fen),
    updateEngine: (index, updatedEngine) => ipcRenderer.invoke('update-engine', index, updatedEngine),
    simulatePV: (fen, pvMoves, stepLimit) => ipcRenderer.invoke('simulate-pv', fen, pvMoves, stepLimit),

    onEngineOutput: (callback) => {
        engineOutputCallback = callback; // Lưu callback từ ui.js
    },
    onEngineReady: (callback) => ipcRenderer.on('engine-ready', (event) => callback()),
});

// Nhận cập nhật giao thức từ main.js
ipcRenderer.on('update-protocol', (event, protocol) => {
    engineProtocol = protocol || 'uci';
    console.log(`Protocol updated to: ${engineProtocol}`);
});

ipcRenderer.on('engine-output', (event, data) => {
    if (engineOutputCallback) {
        engineOutputCallback(data); // Chỉ gọi nếu callback đã được đăng ký
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

