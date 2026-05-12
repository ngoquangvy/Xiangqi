// preload.js
// Trust boundary between renderer and main process.
// Renderer only sees APIs listed here; raw IPC channels stay hidden.
const { contextBridge, ipcRenderer } = require('electron');
const IPC = require('./src/shared/ipcChannels');

let engineProtocol = 'uci';
let engineOutputCallback = null;

contextBridge.exposeInMainWorld('XiangqiGameAPI', {
    // --- GAME STATE ---
    getGameState: () => ipcRenderer.invoke(IPC.GET_GAME_STATE),
    importFen: (fen) => ipcRenderer.invoke(IPC.IMPORT_FEN, fen),
    getLegalMoves: (x, y) => ipcRenderer.invoke(IPC.GET_LEGAL_MOVES, x, y),
    movePiece: (fx, fy, tx, ty) => ipcRenderer.invoke(IPC.MOVE_PIECE, fx, fy, tx, ty),
    undo: () => ipcRenderer.invoke(IPC.UNDO),
    redo: () => ipcRenderer.invoke(IPC.REDO),
    resetToInitial: () => ipcRenderer.invoke(IPC.RESET_TO_INITIAL),
    resetGame: () => ipcRenderer.invoke(IPC.RESET_GAME),
    goToMove: (index) => ipcRenderer.invoke(IPC.GO_TO_MOVE, index),
    exportGame: () => ipcRenderer.invoke(IPC.EXPORT_GAME),
    exportPgn: () => ipcRenderer.invoke(IPC.EXPORT_PGN),
    importGame: (gameData) => ipcRenderer.invoke(IPC.IMPORT_GAME, gameData),
    updateMoveNote: (index, note) => ipcRenderer.invoke(IPC.UPDATE_MOVE_NOTE, index, note),
    updateMoveVariation: (index, variation) => ipcRenderer.invoke(IPC.UPDATE_MOVE_VARIATION, index, variation),
    setFlipped: (isFlipped) => ipcRenderer.invoke(IPC.SET_FLIPPED, isFlipped),

    // --- ENGINE ---
    analyzePosition: (fen) => ipcRenderer.send(IPC.ANALYZE_POSITION, fen),
    stopEngine: () => ipcRenderer.send(IPC.STOP_ENGINE),
    stopEvalEngine: () => ipcRenderer.send(IPC.STOP_EVAL_ENGINE),
    evaluateMove: (fen, moveUci, depth, multiPV, enginePath) =>
        ipcRenderer.send(IPC.EVALUATE_MOVE, fen, moveUci, depth, multiPV, enginePath),
    formatPV: (fen, pvMoves) => ipcRenderer.invoke(IPC.FORMAT_PV, fen, pvMoves),
    // translatePVGroups: Process multiple independent PVs correctly.
    // Each PV is translated with a fresh board starting from the given FEN,
    // preventing cross-PV board state contamination.
    translatePVGroups: (fen, pvGroups) => ipcRenderer.invoke(IPC.TRANSLATE_PV_GROUPS, fen, pvGroups),
    // Legacy alias kept for backward compat (single sequential PV only)
    translateMoves: (fen, moves) => ipcRenderer.invoke(IPC.FORMAT_PV, fen, moves),
    simulatePV: (fen, pvMoves, stepLimit) =>
        ipcRenderer.invoke(IPC.SIMULATE_PV, fen, pvMoves, stepLimit),
    getEngines: () => ipcRenderer.invoke(IPC.GET_ENGINES),
    getSelectedEngineIndex: () => ipcRenderer.invoke(IPC.GET_SELECTED_ENGINE_INDEX),
    addEngine: (enginePath) => ipcRenderer.invoke(IPC.ADD_ENGINE, enginePath),
    removeEngine: (index) => ipcRenderer.invoke(IPC.REMOVE_ENGINE, index),
    selectEngine: (index) => ipcRenderer.invoke(IPC.SELECT_ENGINE, index),
    updateEngineConfig: (index, config) => ipcRenderer.invoke(IPC.UPDATE_ENGINE_CONFIG, index, config),
    browseEngineBook: () => ipcRenderer.invoke(IPC.BROWSE_ENGINE_BOOK),

    // --- ENGINE EVENTS ---
    onEngineOutput: (callback) => { engineOutputCallback = callback; },
    onEvalEngineOutput: (callback) => ipcRenderer.on(IPC.EVAL_ENGINE_OUTPUT, (_, data) => callback(data)),
    onEvalEngineStatus: (callback) => ipcRenderer.on(IPC.EVAL_ENGINE_STATUS, (_, status) => callback(status)),
    onEngineReady: (callback) => ipcRenderer.on(IPC.ENGINE_READY, () => callback()),
    onEngineStatus: (callback) => ipcRenderer.on(IPC.ENGINE_STATUS, (_, status) => callback(status)),
    onEnginePonder: (callback) => ipcRenderer.on(IPC.ENGINE_PONDER, (_, move) => callback(move)),

    // --- BOOK ---
    getBookCandidates: (fen) => ipcRenderer.invoke(IPC.GET_BOOK_CANDIDATES, fen),
    getCurrentBookPath: () => ipcRenderer.invoke(IPC.GET_CURRENT_BOOK_PATH),
    getBooks: () => ipcRenderer.invoke(IPC.GET_BOOKS),
    selectBook: (bookPath) => ipcRenderer.invoke(IPC.SELECT_BOOK, bookPath),
    importBookFile: (filePath) => ipcRenderer.invoke(IPC.IMPORT_BOOK_FILE, filePath),
    updateBookNote: (fen, move, note) => ipcRenderer.invoke(IPC.UPDATE_BOOK_NOTE, fen, move, note),
    convertBookLanguage: (bookPath, language) => ipcRenderer.invoke(IPC.CONVERT_BOOK_LANGUAGE, bookPath, language),

    // --- APP / UTILITY ---
    exitApp: () => ipcRenderer.invoke(IPC.EXIT_APP),
    browseFile: (filters) => ipcRenderer.invoke(IPC.BROWSE_FILE, filters),

    // --- LEGACY / MISC ---
    // Exposed for compatibility with existing renderer code.
    on: (channel, callback) => ipcRenderer.on(channel, callback),
    getProtocol: () => engineProtocol,
    setProtocol: (protocol) => { engineProtocol = protocol; },
});

// Sync protocol token from main
ipcRenderer.on(IPC.UPDATE_PROTOCOL, (_, protocol) => {
    engineProtocol = protocol || 'uci';
});

// Relay engine-output to registered callback (dual-registration pattern)
ipcRenderer.on(IPC.ENGINE_OUTPUT, (_, data) => {
    if (engineOutputCallback) engineOutputCallback(data);
});

// No-op listener keeps event channel alive (required for onEngineReady to fire correctly)
ipcRenderer.on(IPC.ENGINE_READY, () => { });

ipcRenderer.on(IPC.ENGINE_ERROR, (_, error) => {
    console.error('Engine error:', error);
    window.dispatchEvent(new CustomEvent('engine-error', { detail: error }));
});
