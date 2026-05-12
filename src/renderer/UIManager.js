import { BoardRenderer } from './BoardRenderer.js';
import { AnalystUI } from './AnalystUI.js';
import { InputManager } from './InputManager.js';
import { ActionManager } from './ActionManager.js';

/**
 * UI MANAGER (UIManager)
 * ---------------------------------
 * The main orchestrator for the renderer process.
 * Manages game state (FEN, History) and simulation modes.
 */
export class UIManager {
    constructor() {
        this.api = window.XiangqiGameAPI;
        
        // Initialize sub-modules
        this.boardRenderer = new BoardRenderer(this);
        this.analystUI = new AnalystUI(this);
        this.inputManager = new InputManager(this);
        this.actionManager = new ActionManager(this);
        
        this.currentFen = '';
        this.board = Array(10).fill().map(() => Array(9).fill(null)); // Correctly pre-initialize size
        this.currentTurn = 'red';        // Current turn ('red' or 'black')
        this.moveHistory = [];           // Current move history
        this.currentMoveIndex = -1;      // Current move index
        this.isCheck = false;            // Current turn king in check
        this.isCheckmate = false;        // Current game is over (mate)
        this.lastMove = null;            // Last move coordinates {fromX, fromY, toX, toY}
        this.currentBookCandidates = []; // Opening book candidates for current FEN
        // Status flags
        this.isEnginePaused = false; 
        this.isSimulating = false;
        this.isStudyMode = false;

        // Config for move evaluation (Agent 3 - Eval Engine)
        this.evalConfig = {
            path: null,
            depth: 20,
            multiPV: 3
        };
        this.isEvalMultiPVOverridden = false; // Flag for inheritance logic
        
        // Analysis Scheduling
        this.pendingReadyAnalysis = false;
        this.engineStatus = 'stopped';
        this.evalStatus = 'stopped'; // Agent 3 Status
        this._analysisTimer = null;
    }

    /**
     * UPDATE EVAL ENGINE CONFIG
     */
    updateEvalConfig(newConfig) {
        this.evalConfig = { ...this.evalConfig, ...newConfig };
        console.log('[UIManager] Eval Config updated:', this.evalConfig);
    }

    async init() {
        this.inputManager.init();
        this.actionManager.init();
        this.setupIPCListeners();
        await this.syncState();
    }

    setupIPCListeners() {
        // Agent 1/2 Data Stream
        this.api.onEngineOutput((data) => {
            this.analystUI.handleEngineOutput(data);
        });

        // Agent 3 Data Stream (Move Evaluation)
        this.api.onEvalEngineOutput((data) => {
            this.analystUI.handleEngineOutput(data, true); // true = isEval
        });

        this.api.onEvalEngineStatus((status) => {
            this.evalStatus = status;
            console.log(`[UIManager] Eval Engine Status: ${status}`);
            this.analystUI.updateEvalStatus(status);
        });

        this.api.onEngineStatus((status) => {
            const oldStatus = this.engineStatus;
            this.engineStatus = status;
            this.analystUI.updateStatus(status);

            // Re-trigger analysis if we were waiting for the engine to become idle
            if (status === 'idle' && (this.pendingReadyAnalysis || oldStatus === 'starting')) {
                // console.log(`[UIManager] Engine became idle, triggering deferred analysis...`);
                this._schedulerAnalysis();
            }
        });
    }

    /**
     * REQUEST SCHEDULER: _schedulerAnalysis()
     * The single authoritative path for starting or deferring engine analysis.
     * Handles gating, debouncing, and deferred ready states.
     */
    _schedulerAnalysis() {
        // 1. Clear any pending debounced request
        if (this._analysisTimer) {
            clearTimeout(this._analysisTimer);
            this._analysisTimer = null;
        }

        // 2. Gating checks
        const canAnalyze = !this.isSimulating && !this.isEnginePaused && !this.isStudyMode && this.currentFen;
        
        if (!canAnalyze) {
            this.pendingReadyAnalysis = false;
            // console.log('[UIManager] Analysis gated (Sim/Pause/Study/NoFEN). Request cleared.');
            return;
        }

        // 3. Debounce rapid navigation (100ms)
        this._analysisTimer = setTimeout(() => {
            this._analysisTimer = null;
            
            // Re-check gating after debounce
            if (this.isSimulating || this.isEnginePaused || this.isStudyMode || !this.currentFen) return;

            // 4. Deferred logic: handle starting/busy engine
            if (this.engineStatus !== 'idle' && this.engineStatus !== 'searching') {
                this.pendingReadyAnalysis = true;
                // console.log(`[UIManager] Engine busy (${this.engineStatus}), setting pendingReadyAnalysis.`);
                return;
            }

            // 5. Execute: Clear pending and send request
            this.pendingReadyAnalysis = false;
            // console.log(`[UIManager] Scheduler executing analyzePosition: ${this.currentFen}`);
            this.api.analyzePosition(this.currentFen);
        }, 100);
    }

    /**
     * SYNC STATE (authoritative UI refresh gateway)
     * All game-changing actions (move, undo, redo, reset, goToMove) must
     * route through syncState() to keep board, history, and engine in sync.
     * Partial refresh helpers are only acceptable when the change is provably local.
     */
    async syncState() {
        // 1. Clear old suggestion tables
        this.analystUI.clearTables();

        // 2. Fetch authoritative snapshot of the entire game state
        const state = await this.api.getGameState();
        if (!state || !state.board) {
            console.error('[UIManager] Received invalid game state:', state);
            return;
        }

        this.board = state.board;
        this.currentTurn = state.currentTurn;
        this.moveHistory = state.moveHistory || [];
        this.currentMoveIndex = state.currentMoveIndex ?? -1;
        this.isCheck = state.isCheck || false;
        this.isCheckmate = state.isCheckmate || false;
        this.lastMove = state.lastMove;
        this.currentFen = state.fen || 'rnbakabnr/9/1c5c1/p1p1p1p1p/9/9/P1P1P1P1P/1C5C1/9/RNBAKABNR w - - 0 1';
        
        // 3. Lookup Opening Book immediately (still requires a separate call as it's a data-heavy search)
        this.currentBookCandidates = await this.api.getBookCandidates(this.currentFen);
        
        // Update suggestion tables (Book candidates first, Engine output will follow via events)
        this.analystUI.updateSuggestionsTable([], this.currentBookCandidates);
        
        // 4. Update engine name on UI
        const currentIndex = await this.api.getSelectedEngineIndex();
        const engines = await this.api.getEngines();
        if (engines[currentIndex]) {
            this.analystUI.updateStatus(`Ready (${engines[currentIndex].name})`);
        }
        this.analystUI.updateDashboardEngineNames();
        
        // 5. Render board from snapshot
        this.boardRenderer.render(this.board);
        
        // 6. Schedule engine analysis (authoritative scheduler)
        this._schedulerAnalysis();

        // 7. Update move history from snapshot
        this.updateMoveHistory(this.moveHistory, this.currentMoveIndex);
    }

    /**
     * UPDATE MOVE HISTORY VIEW (Authoritative Refresh)
     * Groups moves into rows (Red/Black) and highlights the current position.
     */
    updateMoveHistory(history, currentMoveIndex) {
        const moveList = document.getElementById('move-list');
        if (!moveList) return;
        
        moveList.innerHTML = '';
        
        // Group moves into rows (index 0,1 = Row 1; 2,3 = Row 2, etc.)
        for (let i = 0; i < history.length; i += 2) {
            const rowNo = Math.floor(i / 2) + 1;
            const rowDiv = document.createElement('div');
            rowDiv.className = 'move-row';
            
            // 1. Move Number
            const noSpan = document.createElement('span');
            noSpan.className = 'move-no';
            noSpan.textContent = `${rowNo}.`;
            rowDiv.appendChild(noSpan);
            
            // 2. Red Move
            const redMove = history[i];
            const redSpan = this.createMoveElement(redMove, i, currentMoveIndex);
            rowDiv.appendChild(redSpan);
            
            // 3. Black Move (if exists)
            if (i + 1 < history.length) {
                const blackMove = history[i + 1];
                const blackSpan = this.createMoveElement(blackMove, i + 1, currentMoveIndex);
                rowDiv.appendChild(blackSpan);
            }
            
            moveList.appendChild(rowDiv);
        }

        // Scroll current move into view
        const currentElement = moveList.querySelector('.move-current');
        if (currentElement) {
            currentElement.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
    }

    /**
     * Helper to create a clickable move span
     */
    createMoveElement(move, index, currentMoveIndex) {
        const span = document.createElement('span');
        span.className = 'move-side move-clickable';
        if (index === currentMoveIndex) span.classList.add('move-current');
        
        span.textContent = move.moveNotation;
        span.title = move.note || ''; // Show note on hover
        
        span.onclick = async () => {
            if (this.isSimulating) {
                await this.resetSimulation();
            }
            await this.api.goToMove(index);
            await this.syncState();
        };

        span.oncontextmenu = (e) => {
            e.preventDefault();
            this.actionManager.showMoveContext(index, move);
        };

        return span;
    }

    /**
     * EXECUTE MOVE
     * The only entry point for committing a legal move from renderer input.
     */
    async makeMove(fx, fy, tx, ty) {
        if (this.isSimulating) {
            alert('Please reset the simulation before making a new move.');
            return false;
        }

        const success = await this.api.movePiece(fx, fy, tx, ty);
        if (success) {
            this.lastMovePositions = { fx, fy, tx, ty };
            await this.syncState();
            return true;
        }
        return false;
    }

    /**
     * SIMULATE MOVE (Agent 3)
     * Allows "trying out" suggestions without breaking the game state.
     */
    async simulateToStep(pvMoves, step) {
        this.isSimulating = true;
        this.currentSimulation = { pvMoves, step };
        
        // Call simulation API (Backend restores previous state after completion)
        const simulationStates = await this.api.simulatePV(this.currentFen, pvMoves, step);
        if (simulationStates && simulationStates.length > 0) {
            const lastState = simulationStates[simulationStates.length - 1];
            
            // Set a temporary lastMove specifically for rendering the simulation
            this.simulatedLastMove = lastState.lastMove;
            
            this.boardRenderer.render(lastState.board);
            
            // Show Reset Simulation button
            this.showSimControls();
        }
    }

    showSimControls() {
        let btn = document.getElementById('sim-reset-btn');
        if (!btn) {
            btn = document.createElement('button');
            btn.id = 'sim-reset-btn';
            btn.textContent = 'Quay l\u1ea1i v\u00e1n \u0111\u1ea5u'; // "Return to game"
            btn.className = 'sim-reset-btn';
            btn.onclick = () => this.resetSimulation();
            document.body.appendChild(btn);
        }
        btn.style.display = 'block';
    }

    async resetSimulation() {
        this.isSimulating = false;
        this.currentSimulation = null;
        document.getElementById('sim-reset-btn').style.display = 'none';
        await this.syncState();
    }

    async undo() { await this.api.undo(); await this.syncState(); }
    async redo() { await this.api.redo(); await this.syncState(); }

    /**
     * CLICK PIECE HANDLER
     */
    handlePieceClick(x, y) {
        this.inputManager.handleGridClick(x, y);
    }

    async evaluateSpecificMove(fx, fy, tx, ty) {
        // CANCEL-BEFORE-START (Phase E4)
        this.api.stopEvalEngine();
        
        const moveUci = this.toUCIMove(fx, fy, tx, ty);
        // console.log(`[Eval] Analyzing move: ${moveUci} with config:`, this.evalConfig);
        
        // Clear old evaluation table rows for immediate feedback
        if (this.analystUI) {
            this.analystUI.pendingEvalSuggestions.clear();
            if (this.analystUI.evaluationBody) {
                this.analystUI.evaluationBody.innerHTML = '<tr><td colspan="6" style="text-align:center;">Analyzing move...</td></tr>';
            }
        }

        this.api.evaluateMove(
            this.currentFen, 
            moveUci, 
            this.evalConfig.depth, 
            this.evalConfig.multiPV,
            this.evalConfig.path
        );
    }

    async highlightLegalMoves(x, y) {
        const moves = await this.api.getLegalMoves(x, y);
        this.boardRenderer.highlightMoves(moves);
    }

    async highlightMove(fx, fy, tx, ty, className) {
        this.boardRenderer.highlightMove(fx, fy, tx, ty, className);
    }

    clearHighlights() {
        this.boardRenderer.clearHighlights();
    }

    /**
     * TOGGLE STUDY MODE
     */
    async setStudyMode(enabled) {
        this.isStudyMode = enabled;
        console.log(`[UIManager] Study Mode: ${enabled ? 'ENABLED' : 'DISABLED'}`);
        
        if (enabled) {
            this.api.stopEngine();
        } else {
            this._schedulerAnalysis();
        }
        
        // Show status message
        if (this.analystUI) {
            this.analystUI.showToast(enabled ? 'Study Mode Enabled' : 'Normal Mode Enabled');
        }
    }

    /**
     * COORDINATES TO UCI (0-indexed: a0-i9)
     */
    toUCIMove(fx, fy, tx, ty) {
        const files = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i'];
        const fromFile = files[fx];
        const fromRank = 9 - fy; // Standard 0-9 (y=9 -> 0, y=0 -> 9)
        const toFile = files[tx];
        const toRank = 9 - ty;
        return `${fromFile}${fromRank}${toFile}${toRank}`;
    }

    /**
     * UCI TO COORDINATES (0-indexed: a0-i9)
     */
    parseUCIMove(move) {
        if (!move || move.length < 4) return null;
        const files = { 'a': 0, 'b': 1, 'c': 2, 'd': 3, 'e': 4, 'f': 5, 'g': 6, 'h': 7, 'i': 8 };
        const match = move.match(/([a-i])(\d+)([a-i])(\d+)/);
        if (!match) return null;

        return {
            fx: files[match[1]],
            fy: 9 - parseInt(match[2]), // Standard 0-9
            tx: files[match[3]],
            ty: 9 - parseInt(match[4])
        };
    }

    /**
     * PAUSE/RESUME ENGINE
     */
    async setEnginePause(paused) {
        this.isEnginePaused = paused;
        
        // Update UI state
        if (this.actionManager) {
            this.actionManager.updatePauseButton(paused);
        }

        if (paused) {
            this.api.stopEngine();
        } else {
            this._schedulerAnalysis();
        }
    }

    /**
     * COLLECT ALL SUGGESTIONS (Engine & Book)
     */
    getSuggestedMoveSets() {
        const engineMoves = new Set();
        const bookMoves = new Set();

        // 1. Get from AnalystUI latest rows
        if (this.analystUI && Array.isArray(this.analystUI.latestSuggestionRows)) {
            this.analystUI.latestSuggestionRows.forEach(row => {
                if (row.engine && row.engine.move) engineMoves.add(row.engine.move);
                if (row.book && row.book.move) bookMoves.add(row.book.move);
            });
        }

        // 2. Get from currentBookCandidates (direct source)
        if (Array.isArray(this.currentBookCandidates)) {
            this.currentBookCandidates.forEach(item => {
                if (item && item.move) bookMoves.add(item.move);
            });
        }

        return { engineMoves, bookMoves };
    }

    /**
     * SHOW MOVE CONTEXT (Edit Notes / Variations)
     */
    async showMoveContext(index, move) {
        const currentNote = move.note || "";
        const newNote = prompt(`Edit note for move ${Math.floor(index / 2) + 1} (${move.moveNotation}):`, currentNote);
        
        if (newNote !== null && newNote !== currentNote) {
            const success = await this.api.updateMoveNote(index, newNote);
            if (success) {
                console.log(`[UIManager] Note updated for move ${index}`);
                await this.syncState();
            }
        }
    }
}
