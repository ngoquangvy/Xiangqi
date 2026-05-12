import { BaseView } from './BaseView.js';

/**
 * INPUT MANAGER (InputManager)
 * -----------------------------------
 * Orchestrates user interactions with the game board.
 * Uses authoritative local state from UIManager to validate selections.
 */
export class InputManager extends BaseView {
    constructor(uiManager) {
        super();
        this.ui = uiManager;
        this.selectedPiece = null;
    }

    init() {
        this.setupBoardEvents();
        this.setupKeyboardEvents();
    }

    setupBoardEvents() {
        const container = document.getElementById('board-container');
        if (!container) return;

        container.addEventListener('click', (e) => {
            const rect = container.getBoundingClientRect();
            
            // Absolute coordinates to relative container coordinates
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            
            const gridCoords = this.pixelToGrid(x, y);
            
            // console.log(`[Input] Pixel: ${x},${y} -> Grid: ${gridCoords.x},${gridCoords.y}`);
            
            if (!isNaN(gridCoords.x) && !isNaN(gridCoords.y)) {
                this.handleGridClick(gridCoords.x, gridCoords.y);
            }
        });

        container.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            if (!this.selectedPiece) return;

            const rect = container.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            const gridCoords = this.pixelToGrid(x, y);
            
            if (!isNaN(gridCoords.x) && !isNaN(gridCoords.y)) {
                this.ui.evaluateSpecificMove(this.selectedPiece.x, this.selectedPiece.y, gridCoords.x, gridCoords.y);
            }
        });
    }

    /**
     * Handle user click on a board grid coordinate.
     * Logic:
     * - If a piece is already selected, try to move it.
     * - Otherwise, select the piece at (x, y) if it's the player's turn.
     */
    async handleGridClick(x, y) {
        this.ui.cancelBestMovePreview();
        if (this.selectedPiece) {
            // Toggle selection: if clicking the SAME piece, deselect it
            if (this.selectedPiece.x === x && this.selectedPiece.y === y) {
                // console.log(`[Input] Deselected piece at ${x},${y}`);
                this.selectedPiece = null;
                this.ui.clearHighlights();
                return;
            }

            const moved = await this.ui.makeMove(this.selectedPiece.x, this.selectedPiece.y, x, y);
            if (moved) {
                this.selectedPiece = null;
                this.ui.clearHighlights();
                return;
            }
        }

        // Use local authoritative board snapshot instead of IPC call
        const piece = this.ui.board[y][x];
        if (piece) {
            // Verify turn before allowing selection
            if (piece.color !== this.ui.currentTurn) {
                console.log(`[Input] Not ${piece.color}'s turn.`);
                this.selectedPiece = null;
                this.ui.clearHighlights();
                return;
            }

            // console.log(`[Input] Selected piece: ${piece.name} at ${x},${y}`);
            this.selectedPiece = { x, y };
            this.ui.highlightLegalMoves(x, y);
        } else {
            this.selectedPiece = null;
            this.ui.clearHighlights();
        }
    }

    /**
     * CONVERT PIXEL COORDINATES TO GRID COORDINATES (0-INDEXED)
     */
    pixelToGrid(pixelX, pixelY) {
        const renderer = this.ui.boardRenderer;
        
        // Reverse formula: displayX = (pixel - margin) / cellWidth
        const margin = 28;
        let x = Math.round((pixelX - margin) / renderer.cellWidth);
        let y = Math.round((pixelY - margin) / renderer.cellHeight);
        
        if (renderer.isFlipped) {
            x = 8 - x;
            y = 9 - y;
        }
        
        // Clamp to board boundaries
        x = Math.max(0, Math.min(8, x));
        y = Math.max(0, Math.min(9, y));

        return { x, y };
    }

    setupKeyboardEvents() {
        document.addEventListener('keydown', (e) => {
            if (['INPUT', 'TEXTAREA'].includes(e.target.tagName) || e.target.isContentEditable) return;

            if (e.key === 'Escape') {
                this.ui.cancelBestMovePreview();
                return;
            }
            if (e.key === 'Enter') {
                this.ui.toggleBestMove();
                return;
            }

            if (e.key === 'ArrowLeft') {
                if (this.ui.isSimulating && this.ui.currentSimulation) {
                    const nextStep = Math.max(0, this.ui.currentSimulation.step - 1);
                    if (nextStep === 0) {
                        this.ui.resetSimulation();
                    } else {
                        if (this.ui.analystUI && this.ui.analystUI.setActiveSimStep) {
                            this.ui.analystUI.setActiveSimStep(nextStep);
                        }
                        this.ui.simulateToStep(this.ui.currentSimulation.pvMoves, nextStep);
                    }
                } else {
                    this.ui.undo();
                }
            }
            if (e.key === 'ArrowRight') {
                if (this.ui.isSimulating && this.ui.currentSimulation) {
                    const nextStep = Math.min(this.ui.currentSimulation.pvMoves.length, this.ui.currentSimulation.step + 1);
                    if (this.ui.analystUI && this.ui.analystUI.setActiveSimStep) {
                        this.ui.analystUI.setActiveSimStep(nextStep);
                    }
                    this.ui.simulateToStep(this.ui.currentSimulation.pvMoves, nextStep);
                } else {
                    this.ui.redo();
                }
            }
        });
    }
}
