const { ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const IPC = require('../shared/ipcChannels');

/**
 * IPC ROUTER (IPCRouter)
 * ----------------------------
 * Handles all communication between the Renderer and Main processes.
 */
class IPCRouter {
    constructor(mainWindow, mainEngine, evalEngine, dataManager, XiangqiGameClass) {
        this.mainWindow = mainWindow;
        this.mainEngine = mainEngine;
        this.evalEngine = evalEngine;
        this.dataManager = dataManager;
        this.XiangqiGame = XiangqiGameClass;
        
        // Internal game instance for simulations (e.g. notation, PV)
        this.gameInstance = new XiangqiGameClass();
    }

    /**
     * INITIALIZE ALL IPC CHANNELS
     */
    init() {
        // =====================================================================
        // GROUP 0: ENGINE EVENT BRIDGE (ONE AUTHORITATIVE PATH)
        // Relay engine process events to the renderer window.
        // =====================================================================
        
        // --- Main Engine Relay ---
        this.mainEngine.on('output', (data) => {
            this.mainWindow.webContents.send(IPC.ENGINE_OUTPUT, data);
        });
        this.mainEngine.on('status', (status) => {
            console.log(`[IPCRouter] Main Engine Status: ${status}`);
            this.mainWindow.webContents.send(IPC.ENGINE_STATUS, status);
        });
        this.mainEngine.on('error', (err) => {
            this.mainWindow.webContents.send(IPC.ENGINE_ERROR, err);
        });

        // --- Eval Engine Relay (Agent 3) ---
        this.evalEngine.on('output', (data) => {
            this.mainWindow.webContents.send(IPC.EVAL_ENGINE_OUTPUT, data);
        });
        this.evalEngine.on('status', (status) => {
            console.log(`[IPCRouter] Eval Engine Status: ${status}`);
            this.mainWindow.webContents.send(IPC.EVAL_ENGINE_STATUS, status);
        });
        this.evalEngine.on('error', (err) => {
            this.mainWindow.webContents.send(IPC.ENGINE_ERROR, err);
        });

        // =====================================================================
        // GROUP 1: GAME STATE
        // Pure game logic: board queries, move execution, history, FEN.
        // =====================================================================
        ipcMain.handle(IPC.GET_GAME_STATE,         () => this.gameInstance.getGameState());
        ipcMain.handle(IPC.GET_LEGAL_MOVES,        (_, x, y)        => this.gameInstance.getLegalMoves(x, y));
        ipcMain.handle(IPC.IMPORT_FEN,             (_, fen)         => this.gameInstance.importFen(fen));
        ipcMain.handle(IPC.SET_FLIPPED,            (_, isFlipped)   => { this.gameInstance.setFlipped(isFlipped); return true; });

        ipcMain.handle(IPC.MOVE_PIECE, (_, fromX, fromY, toX, toY, isAnalysis = false) => {
            const success = this.gameInstance.move(fromX, fromY, toX, toY, isAnalysis);
            // Analysis is now authoritative triggered by the UI's syncState() or engine status listeners
            return success;
        });

        ipcMain.handle(IPC.UNDO,                   () => this.gameInstance.undo());
        ipcMain.handle(IPC.REDO,                   () => this.gameInstance.redo());
        ipcMain.handle(IPC.RESET_TO_INITIAL,       () => this.gameInstance.resetToInitial());
        ipcMain.handle(IPC.RESET_GAME,             () => this.gameInstance.resetGame());
        ipcMain.handle(IPC.GO_TO_MOVE,             (_, index) => this.gameInstance.goToMove(index));
        ipcMain.handle(IPC.UPDATE_MOVE_NOTE,       (_, index, note)      => this.gameInstance.updateMoveNote(index, note));
        ipcMain.handle(IPC.UPDATE_MOVE_VARIATION,  (_, index, variation) => this.gameInstance.updateMoveVariation(index, variation));
        ipcMain.handle(IPC.EXPORT_GAME,            () => this.gameInstance.exportGame());
        ipcMain.handle(IPC.EXPORT_PGN,             () => this.gameInstance.exportPgn());
        ipcMain.handle(IPC.IMPORT_GAME,            (_, data) => this.gameInstance.importGame(data));

        // =====================================================================
        // GROUP 2: ANALYSIS & PV
        // Engine analysis triggers and PV formatting utilities.
        // =====================================================================
        ipcMain.on(IPC.ANALYZE_POSITION, (_, fen) => {
            if (!this.mainEngine) return;
            // Removed this.gameInstance.importFen(fen) here to prevent wiping move history
            this.mainEngine.analyze(fen);
        });

        ipcMain.on(IPC.STOP_ENGINE, () => {
            if (this.mainEngine) this.mainEngine.stop();
        });

        ipcMain.on(IPC.STOP_EVAL_ENGINE, () => {
            if (this.evalEngine) this.evalEngine.stop();
        });

        ipcMain.on(IPC.EVALUATE_MOVE, async (_, fen, moveUci, depth, multiPV, enginePath) => {
            const currentPath = enginePath || this.dataManager.selectedEnginePath;
            if (!this.evalEngine.process || this.evalEngine.currentPath !== currentPath) {
                console.log(`[Eval] Starting eval engine: ${currentPath}`);
                this.evalEngine.start(currentPath);
                this.evalEngine.currentPath = currentPath;
            }
            await this.evalEngine.waitUntilReady();
            if (this.evalEngine.status === 'idle' || this.evalEngine.status === 'searching') {
                // MERGE RULES: 
                // 1. Base = Normalized engine record for the chosen path
                // 2. Override = UI parameters (multiPV, depth)
                const engineRec = this.dataManager.engines.find(e => e.path === currentPath) || { path: currentPath };
                const baseConfig = this.dataManager.normalizeEngineConfig(engineRec);
                const finalConfig = { ...baseConfig, multiPV: multiPV || baseConfig.multiPV };

                this.evalEngine.applyConfig(finalConfig);
                this.evalEngine.analyze(fen, depth || finalConfig.depth);
            }
        });

        ipcMain.handle(IPC.FORMAT_PV, async (_, fen, pvMoves) => {
            // Translates a SINGLE sequential PV (array of UCI moves) into notations.
            // Each call gets a fresh board loaded from the given FEN.
            if (!fen) fen = this.gameInstance.exportFen();
            const temp = new this.XiangqiGame();
            if (!temp.importFen(fen)) return { moves: pvMoves || [], formatted: '-' };
            const notations = [];
            for (const move of (pvMoves || [])) {
                if (/[+\-=]/.test(move)) { notations.push(move); continue; }
                const parts = this.parseUCI(move);
                if (!parts) { notations.push(move); continue; }
                const piece = temp.getPiece(parts.fx, parts.fy);
                if (!piece) { notations.push(move); continue; }
                const note = temp.calculateMoveNotation({ fromX: parts.fx, fromY: parts.fy, toX: parts.tx, toY: parts.ty, piece });
                notations.push(note);
                const ok = temp.move(parts.fx, parts.fy, parts.tx, parts.ty, true);
                if (!ok) break;
            }
            return { moves: notations, formatted: notations.join(' ') };
        });

        // TRANSLATE_PV_GROUPS: Translates multiple independent PVs at once.
        // pvGroups = [ [uci, uci, ...], [uci, uci, ...], ... ]
        // Each group is translated independently from the same FEN.
        // Returns a flat map: { 'uci_move': 'notation', ... }
        ipcMain.handle(IPC.TRANSLATE_PV_GROUPS, async (_, fen, pvGroups) => {
            if (!fen) fen = this.gameInstance.exportFen();
            const map = {};
            for (const pv of (pvGroups || [])) {
                if (!Array.isArray(pv) || pv.length === 0) continue;
                // Fresh board for EACH independent PV
                const temp = new this.XiangqiGame();
                if (!temp.importFen(fen)) continue;
                for (const move of pv) {
                    if (!move || typeof move !== 'string') continue;
                    if (/[+\-=]/.test(move)) { map[move] = move; continue; } // already notation
                    const parts = this.parseUCI(move);
                    if (!parts) { map[move] = move; continue; }
                    const piece = temp.getPiece(parts.fx, parts.fy);
                    if (!piece) { map[move] = move; continue; }
                    if (!map[move]) { // only compute if not already cached
                        map[move] = temp.calculateMoveNotation({ fromX: parts.fx, fromY: parts.fy, toX: parts.tx, toY: parts.ty, piece });
                    }
                    const ok = temp.move(parts.fx, parts.fy, parts.tx, parts.ty, true);
                    if (!ok) break;
                }
            }
            return map;
        });

        ipcMain.handle(IPC.SIMULATE_PV, async (_, fen, pvMoves, stepLimit) => {
            const temp = new this.XiangqiGame();
            temp.importFen(fen);
            const states = [{ board: this.cloneBoard(temp.board), turn: temp.currentTurn, lastMove: null }];
            for (let i = 0; i < Math.min((pvMoves || []).length, stepLimit); i++) {
                const p = this.parseUCI(pvMoves[i]);
                if (p && temp.move(p.fx, p.fy, p.tx, p.ty, true)) {
                    states.push({ 
                        board: this.cloneBoard(temp.board), 
                        turn: temp.currentTurn,
                        lastMove: { fromX: p.fx, fromY: p.fy, toX: p.tx, toY: p.ty } 
                    });
                } else break;
            }
            return states;
        });

        // =====================================================================
        // GROUP 3: ENGINE MANAGEMENT
        // Engine list, selection, and configuration.
        // =====================================================================
        ipcMain.handle(IPC.GET_ENGINES, () => this.dataManager.engines);
        ipcMain.handle(IPC.GET_SELECTED_ENGINE_INDEX, () => {
            const idx = this.dataManager.engines.findIndex(e => e.path === this.dataManager.selectedEnginePath);
            return idx >= 0 ? idx : 0;
        });
        ipcMain.handle(IPC.ADD_ENGINE, async (_, enginePath) => {
            const name = path.basename(enginePath);
            await this.dataManager.addEngine({ name, path: enginePath, protocol: 'uci', hash: 128, threads: 1, depth: 20, multiPV: 3 });
            return true;
        });
        ipcMain.handle(IPC.REMOVE_ENGINE, async (_, index) => this.dataManager.removeEngine(index));

        ipcMain.handle(IPC.SELECT_ENGINE, async (_, index) => {
            const eng = this.dataManager.engines[index];
            if (!eng) return false;
            console.log(`[Engine] Switching to: ${eng.name}`);
            await this.dataManager.saveSelectedEnginePath(eng.path);
            this.mainEngine.kill();
            this.mainEngine.start(eng.path);
            await this.mainEngine.waitUntilReady();
            if (this.mainEngine.status === 'idle') {
                this.mainEngine.applyConfig(this.dataManager.normalizeEngineConfig(eng)); 
                return true;
            }
            return false;
        });

        ipcMain.handle(IPC.UPDATE_ENGINE_CONFIG, async (_, index, config) => {
            const success = await this.dataManager.updateEngineConfig(index, config);
            if (success) {
                const eng = this.dataManager.engines[index];
                if (eng.path === this.dataManager.selectedEnginePath) {
                    console.log(`[Engine] Updating config for: ${eng.name}`);
                    this.mainEngine.config = eng;
                    this.mainEngine.applyConfig(eng); // Single authoritative config path
                }
            }
            return success;
        });

        // =====================================================================
        // GROUP 4: BOOK OPERATIONS
        // Opening book loading, querying, and management.
        // =====================================================================
        ipcMain.handle(IPC.GET_BOOK_CANDIDATES,  (_, fen)           => this.dataManager.getBookCandidates(fen));
        ipcMain.handle(IPC.GET_CURRENT_BOOK_PATH, ()                => this.dataManager.currentBookPath);
        ipcMain.handle(IPC.SELECT_BOOK, async (_, bookPath) => {
            console.log(`[IPCRouter] Selecting book: ${bookPath}`);
            return this.dataManager.loadOpeningBook(bookPath);
        });
        ipcMain.handle(IPC.GET_BOOKS, async () => {
            const bookDir = path.join(__dirname, '../../assets/books');
            const internalFiles = [];
            try {
                if (fs.existsSync(bookDir)) {
                    const files = await fs.promises.readdir(bookDir);
                    internalFiles.push(...files.filter(f => f.endsWith('.json')).map(f => path.join(bookDir, f)));
                }
            } catch (e) {}
            const externalFiles = await this.dataManager.getExternalBooks();
            return [...new Set([...internalFiles, ...externalFiles])];
        });
        ipcMain.handle(IPC.IMPORT_BOOK_FILE, async (_, filePath) => {
            try {
                await this.dataManager.addExternalBook(filePath);
                const success = await this.dataManager.loadOpeningBook(filePath);
                return { success };
            } catch (err) {
                return { success: false, error: err.message };
            }
        });
        ipcMain.handle(IPC.UPDATE_BOOK_NOTE,     (_, fen, move, note)  => this.dataManager.updateBookNote(fen, move, note));
        ipcMain.handle(IPC.CONVERT_BOOK_LANGUAGE, async (_, bookPath, language) => {
            console.log(`[IPCRouter] convert-book-language: ${bookPath} -> ${language}`);
            return { success: true };
        });

        // =====================================================================
        // GROUP 5: APP / UTILITY
        // File dialogs, app lifecycle.
        // =====================================================================
        ipcMain.handle(IPC.EXIT_APP, () => require('electron').app.quit());
        ipcMain.handle(IPC.BROWSE_FILE, async (_, filters) => {
            const result = await dialog.showOpenDialog(this.mainWindow, { properties: ['openFile'], filters: filters || [] });
            return result.canceled ? null : result.filePaths[0];
        });
        ipcMain.handle(IPC.BROWSE_ENGINE_BOOK, async () => {
            const result = await dialog.showOpenDialog(this.mainWindow, {
                properties: ['openFile'],
                filters: [{ name: 'Opening Books', extensions: ['xob', 'bin', 'json'] }]
            });
            return result.canceled ? null : result.filePaths[0];
        });

        console.log('[IPCRouter] Initialization complete.');
    }

    parseUCI(move) {
        if (!move || move.length < 4) return null;
        const files = { 'a': 0, 'b': 1, 'c': 2, 'd': 3, 'e': 4, 'f': 5, 'g': 6, 'h': 7, 'i': 8 };
        const match = move.match(/([a-i])(\d+)([a-i])(\d+)/);
        if (!match) return null;
        const fx = files[match[1]];
        const fy = 9 - parseInt(match[2]);
        const tx = files[match[3]];
        const ty = 9 - parseInt(match[4]);
        return { fx, fy, tx, ty };
    }

    cloneBoard(board) {
        return board.map(row => row.map(cell => cell ? { ...cell } : null));
    }
}

module.exports = IPCRouter;

