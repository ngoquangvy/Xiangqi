import { BaseView } from './BaseView.js';

/**
 * BOARD RENDERER (BoardRenderer)
 * ---------------------------------
 * Handles all visual representation of the game board, pieces, and highlights.
 * Uses a hybrid approach: Canvas for the board grid and DOM for interactive pieces.
 */
export class BoardRenderer extends BaseView {
    constructor(uiManager) {
        super();
        this.ui = uiManager;
        this.canvas = document.getElementById('boardCanvas');
        this.piecesContainer = document.getElementById('pieces');
        
        this.cellWidth = 52;
        this.cellHeight = 52;
        this.margin = 28; 
        
        this.isFlipped = false;
        this.highlights = [];
        this.lastBoardData = null;
        this._previewFrom = null;
        this._previewTo = null;

        if (this.canvas) {
            this.ctx = this.canvas.getContext('2d');
            this.devicePixelRatio = window.devicePixelRatio || 1;
            this.initCanvas();
        }
    }

    initCanvas() {
        if (!this.canvas) return;
        // Total size: 8 cells wide, 9 cells high + margins
        const width = 8 * this.cellWidth + 2 * this.margin;
        const height = 9 * this.cellHeight + 2 * this.margin;
        
        this.canvas.width = width * this.devicePixelRatio;
        this.canvas.height = height * this.devicePixelRatio;
        this.canvas.style.width = `${width}px`;
        this.canvas.style.height = `${height}px`;
        
        this.ctx.scale(this.devicePixelRatio, this.devicePixelRatio);
    }

    /**
     * RENDER BOARD COORDINATE NUMBERS (1-9)
     */
    renderBoardNumbers() {
        const topNumbers = document.getElementById("top-numbers");
        const bottomNumbers = document.getElementById("bottom-numbers");
        if (!topNumbers || !bottomNumbers) return;

        topNumbers.innerHTML = "";
        bottomNumbers.innerHTML = "";
        
        // Fixed margin using this.margin (28px) 
        topNumbers.style.paddingLeft = `${this.margin}px`;
        topNumbers.style.paddingRight = `${this.margin}px`;
        bottomNumbers.style.paddingLeft = `${this.margin}px`;
        bottomNumbers.style.paddingRight = `${this.margin}px`;
        
        const labels1 = ["1", "2", "3", "4", "5", "6", "7", "8", "9"];
        const labels2 = ["9", "8", "7", "6", "5", "4", "3", "2", "1"];

        labels1.forEach(label => {
            const span = document.createElement("span");
            span.textContent = label;
            span.style.display = "inline-block";
            span.style.width = `${this.cellWidth}px`;
            span.style.textAlign = "center";
            span.style.fontSize = "16px";
            topNumbers.appendChild(span);
        });

        labels2.forEach(label => {
            const span = document.createElement("span");
            span.textContent = label;
            span.style.display = "inline-block";
            span.style.width = `${this.cellWidth}px`;
            span.style.textAlign = "center";
            span.style.fontSize = "16px";
            bottomNumbers.appendChild(span);
        });
    }

    /**
     * DRAW BOARD GRID (Lines, Palaces, River)
     */
    drawBoard() {
        if (!this.ctx) return;
        const ctx = this.ctx;
        const boardColor = "#3D2517"; // Board grid color
        
        ctx.save();
        ctx.translate(this.margin, this.margin);
        ctx.strokeStyle = boardColor;
        ctx.lineWidth = 1.2;

        // 1. Draw horizontal lines (10 lines)
        for (let i = 0; i < 10; i++) {
            ctx.beginPath();
            ctx.moveTo(0, i * this.cellHeight);
            ctx.lineTo(8 * this.cellWidth, i * this.cellHeight);
            ctx.stroke();
        }

        // 2. Draw vertical lines (9 lines, gaps at the River)
        for (let i = 0; i < 9; i++) {
            ctx.beginPath();
            if (i === 0 || i === 8) {
                ctx.moveTo(i * this.cellWidth, 0);
                ctx.lineTo(i * this.cellWidth, 9 * this.cellHeight);
            } else {
                ctx.moveTo(i * this.cellWidth, 0);
                ctx.lineTo(i * this.cellWidth, 4 * this.cellHeight);
                ctx.moveTo(i * this.cellWidth, 5 * this.cellHeight);
                ctx.lineTo(i * this.cellWidth, 9 * this.cellHeight);
            }
            ctx.stroke();
        }

        // 3. Draw Palace diagonals
        this.drawPalaceDiagonals(ctx);

        // 4. Draw marker dots for Pawns and Cannons
        this.drawPawnAndCannonDots(ctx);

        // 5. Draw river text
        this.drawRiverText(ctx);

        ctx.restore();
    }

    drawPalaceDiagonals(ctx) {
        // Red Palace (Bottom)
        ctx.beginPath();
        ctx.moveTo(3 * this.cellWidth, 7 * this.cellHeight);
        ctx.lineTo(5 * this.cellWidth, 9 * this.cellHeight);
        ctx.moveTo(5 * this.cellWidth, 7 * this.cellHeight);
        ctx.lineTo(3 * this.cellWidth, 9 * this.cellHeight);
        ctx.stroke();

        // Black Palace (Top)
        ctx.beginPath();
        ctx.moveTo(3 * this.cellWidth, 0);
        ctx.lineTo(5 * this.cellWidth, 2 * this.cellHeight);
        ctx.moveTo(5 * this.cellWidth, 0);
        ctx.lineTo(3 * this.cellWidth, 2 * this.cellHeight);
        ctx.stroke();
    }

    drawPawnAndCannonDots(ctx) {
        const positions = [
            [0, 3, false, true], [2, 3, true, true], [4, 3, true, true], [6, 3, true, true], [8, 3, true, false],
            [0, 6, false, true], [2, 6, true, true], [4, 6, true, true], [6, 6, true, true], [8, 6, true, false],
            [1, 2, true, true], [7, 2, true, true],
            [1, 7, true, true], [7, 7, true, true]
        ];

        positions.forEach(([x, y, hasLeft, hasRight]) => {
            const px = x * this.cellWidth;
            const py = y * this.cellHeight;
            const len = 8;
            const gap = 4;

            ctx.lineWidth = 1.5;
            if (hasLeft) {
                // Top Left
                ctx.beginPath(); ctx.moveTo(px - gap, py - gap - len); ctx.lineTo(px - gap, py - gap); ctx.lineTo(px - gap - len, py - gap); ctx.stroke();
                // Bottom Left
                ctx.beginPath(); ctx.moveTo(px - gap, py + gap + len); ctx.lineTo(px - gap, py + gap); ctx.lineTo(px - gap - len, py + gap); ctx.stroke();
            }
            if (hasRight) {
                // Top Right
                ctx.beginPath(); ctx.moveTo(px + gap, py - gap - len); ctx.lineTo(px + gap, py - gap); ctx.lineTo(px + gap + len, py - gap); ctx.stroke();
                // Bottom Right
                ctx.beginPath(); ctx.moveTo(px + gap, py + gap + len); ctx.lineTo(px + gap, py + gap); ctx.lineTo(px + gap + len, py + gap); ctx.stroke();
            }
        });
    }

    drawRiverText(ctx) {
        ctx.save();
        ctx.font = "bold 28px 'Microsoft YaHei', 'PingFang SC', sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillStyle = "#3D2517";
        ctx.fillText("楚 河 - 汉 界", 4 * this.cellWidth, 4.5 * this.cellHeight);
        ctx.restore();
    }

    /**
     * APPLY HIGHLIGHT STYLES
     */
    applySuggestionHighlightStyle(marker, hasEngine, hasBook, isCapture = false) {
        marker.style.setProperty("opacity", "1", "important");
        marker.style.setProperty("border-radius", "50%", "important");
        marker.style.setProperty("box-sizing", "border-box", "important");
        marker.style.setProperty("position", "absolute", "important");
        marker.style.zIndex = "100";

        // Style for CAPTURE moves (Attack)
        if (isCapture) {
            marker.style.setProperty("border", "3px solid rgba(244,67,54,0.7)", "important");
            marker.style.setProperty("box-shadow", "0 0 10px rgba(244,67,54,0.5)", "important");
            if (hasEngine && hasBook) {
                marker.style.setProperty("background", "linear-gradient(135deg, rgba(76,175,80,0.4) 0%, rgba(33,150,243,0.4) 100%)", "important");
            } else if (hasEngine) {
                marker.style.setProperty("background", "rgba(33,150,243,0.3)", "important");
            } else if (hasBook) {
                marker.style.setProperty("background", "rgba(76,175,80,0.3)", "important");
            }
            return;
        }

        if (hasEngine && hasBook) {
            marker.style.setProperty("background", "linear-gradient(135deg, rgba(76,175,80,0.6) 0%, rgba(76,175,80,0.6) 50%, rgba(33,150,243,0.6) 50%, rgba(33,150,243,0.6) 100%)", "important");
            marker.style.setProperty("border", "3px solid #ffeb3b", "important");
            marker.style.setProperty("box-shadow", "0 0 10px rgba(255,235,59,0.8)", "important");
            return;
        }
        if (hasEngine) {
            marker.style.setProperty("background", "rgba(33,150,243,0.4)", "important");
            marker.style.setProperty("border", "3px solid #2196f3", "important");
            marker.style.setProperty("box-shadow", "0 0 8px rgba(33,150,243,0.5)", "important");
            return;
        }
        if (hasBook) {
            marker.style.setProperty("background", "rgba(76,175,80,0.4)", "important");
            marker.style.setProperty("border", "3px solid #4caf50", "important");
            marker.style.setProperty("box-shadow", "0 0 8px rgba(76,175,80,0.5)", "important");
            return;
        }
        // Normal legal move: Orange
        marker.style.setProperty("background", "rgba(255,152,0,0.35)", "important");
        marker.style.setProperty("border", "2px solid #ff9800", "important");
        marker.style.setProperty("box-shadow", "0 0 5px rgba(255,152,0,0.4)", "important");
    }

    renderHighlights() {
        if (!this.piecesContainer) return;
        
        // Get suggested move sets from UIManager
        const { engineMoves, bookMoves } = this.ui.getSuggestedMoveSets ? this.ui.getSuggestedMoveSets() : { engineMoves: new Set(), bookMoves: new Set() };

        this.highlights.forEach(move => {
            let mx, my, isSource = false, isTarget = false;
            
            if (Array.isArray(move)) {
                mx = move[0];
                my = move[1];
            } else if (typeof move === 'object') {
                mx = move.x;
                my = move.y;
                isSource = move.isSource;
                isTarget = move.isTarget;
            } else return;

            if (mx === null || my === null) return;

            const marker = document.createElement("div");
            marker.className = "piece highlight";

            // Determine UCI to check strategic suggestions
            let fx, fy, tx, ty;
            if (isSource || isTarget) {
                const source = this.highlights.find(h => h.isSource);
                const target = this.highlights.find(h => h.isTarget);
                fx = source ? source.x : -1;
                fy = source ? source.y : -1;
                tx = target ? target.x : mx;
                ty = target ? target.y : my;
            } else {
                fx = this.ui.inputManager.selectedPiece ? this.ui.inputManager.selectedPiece.x : -1;
                fy = this.ui.inputManager.selectedPiece ? this.ui.inputManager.selectedPiece.y : -1;
                tx = mx;
                ty = my;
            }

            const moveUci = this.ui.toUCIMove(fx, fy, tx, ty);
            const hasEngine = engineMoves.has(moveUci);
            const hasBook = bookMoves.has(moveUci);
            const targetPiece = this.lastBoardData && this.lastBoardData[my] ? this.lastBoardData[my][mx] : null;
            const isCapture = (isTarget && targetPiece) || (Array.isArray(move) && targetPiece);

            // 1. STRATEGIC SUGGESTIONS (Gradients/Shadows)
            if (hasEngine || hasBook) {
                this.applySuggestionHighlightStyle(marker, hasEngine, hasBook, isCapture);
                marker.style.width = `44px`;
                marker.style.height = `44px`;
                const pos = this.getPieceDisplayPosition(mx, my);
                marker.style.left = `${pos.left + 2}px`;
                marker.style.top = `${pos.top + 2}px`;
            } 
            // 2. LEGAL MOVES (Minimalist Dots/Frames)
            else {
                if (isCapture) {
                    marker.className = "legal-move-capture";
                    const pos = this.getPieceDisplayPosition(mx, my);
                    marker.style.left = `${pos.left}px`;
                    marker.style.top = `${pos.top}px`;
                } else {
                    marker.className = "legal-move-dot";
                    const pos = this.getPieceDisplayPosition(mx, my);
                    // Center the 14px dot in the 48px square
                    marker.style.left = `${pos.left + 17}px`;
                    marker.style.top = `${pos.top + 17}px`;
                }
            }

            marker.onclick = () => this.ui.handlePieceClick(mx, my);
            this.piecesContainer.appendChild(marker);
        });
    }

    render(board) {
        this.lastBoardData = board;
        if (!this.ctx) return; // Always require context

        this.renderBoardNumbers();

        // 1. Clear and redraw canvas
        // This ensures the GRID is at least visible even if board data is missing
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.drawBoard();
        
        // 2. Draw pieces (using DOM elements)
        if (!this.piecesContainer || !board) return;
        this.piecesContainer.innerHTML = '';
        
        for (let y = 0; y < 10; y++) {
            if (!board[y]) continue; // Guard against empty/malformed board
            for (let x = 0; x < 9; x++) {
                const piece = board[y][x];
                if (piece) {
                    const isSelected = this.ui.inputManager.selectedPiece && 
                                     this.ui.inputManager.selectedPiece.x === x && 
                                     this.ui.inputManager.selectedPiece.y === y;
                    
                    const activeLastMove = this.ui.isSimulating ? this.ui.simulatedLastMove : this.ui.lastMove;
                    const lastMoveClass = this.ui.isSimulating ? 'sim-move' : 'last-move';
                    
                    const isLastMoveDestination = activeLastMove && 
                                                 activeLastMove.toX === x && 
                                                 activeLastMove.toY === y;

                    // Apply check highlight for King
                    // SYNC WITH CORE: Use literal characters (帥/將)
                    const isCheck = this.ui.isCheck && 
                                   (piece.name === "帥" || piece.name === "將") && 
                                   piece.color === this.ui.currentTurn;

                    const div = document.createElement('div');
                    div.className = `piece ${piece.color} ${isSelected ? 'selected' : ''} ${isLastMoveDestination ? lastMoveClass : ''} ${isCheck ? 'check' : ''}`;
                    div.textContent = piece.name;
                    
                    const pos = this.getPieceDisplayPosition(x, y);
                    div.style.left = `${pos.left}px`;
                    div.style.top = `${pos.top}px`;
                    
                    div.onclick = (e) => { 
                        e.stopPropagation(); 
                        this.ui.handlePieceClick(x, y); 
                    };
                    this.piecesContainer.appendChild(div);
                }
            }
        }

        // 3. Render move highlights (legal moves, suggestions)
        this.renderHighlights();

        // 4. Render preview highlight (from keyboard Enter or suggestion hover)
        this.renderPreviewHighlight();

        // 5. Render Last Move highlights for source square (or empty target square)
        const activeLastMove = this.ui.isSimulating ? this.ui.simulatedLastMove : this.ui.lastMove;
        const lastMoveClass = this.ui.isSimulating ? 'sim-move' : 'last-move';
        
        if (activeLastMove) {
            const { fromX, fromY, toX, toY } = activeLastMove;
            this.renderLastMoveHighlight(fromX, fromY, lastMoveClass);
            
            const targetPiece = board[toY] ? board[toY][toX] : null;
            if (!targetPiece) {
                this.renderLastMoveHighlight(toX, toY, lastMoveClass);
            }
        }
    }

    renderLastMoveHighlight(x, y, className = 'last-move') {
        if (!this.piecesContainer) return;
        const marker = document.createElement("div");
        marker.className = `piece ${className}`; // Use pre-defined CSS class
        
        const pos = this.getPieceDisplayPosition(x, y);
        marker.style.left = `${pos.left}px`;
        marker.style.top = `${pos.top}px`;
        marker.style.width = `48px`;
        marker.style.height = `48px`;
        marker.style.zIndex = "50"; // Below pieces and slightly below suggestions
        
        this.piecesContainer.appendChild(marker);
    }

    getPieceDisplayPosition(x, y) {
        const displayX = this.isFlipped ? (8 - x) : x;
        const displayY = this.isFlipped ? (9 - y) : y;
        
        const left = displayX * this.cellWidth + this.margin - 22; 
        const top = displayY * this.cellHeight + this.margin - 22;
        
        return { left, top };
    }

    highlightMoves(moves) {
        this.highlights = moves;
        this.render(this.lastBoardData);
    }

    highlightMove(fx, fy, tx, ty, className) {
        this.highlights = [];
        this._previewFrom = { x: fx, y: fy };
        this._previewTo = { x: tx, y: ty };
        this.render(this.lastBoardData);
    }

    clearHighlights() {
        this.highlights = [];
        this._previewFrom = null;
        this._previewTo = null;
        this.render(this.lastBoardData);
    }

    renderPreviewHighlight() {
        if (!this._previewFrom || !this._previewTo || !this.piecesContainer) return;
        const board = this.lastBoardData;
        if (!board) return;

        const isCapture = board[this._previewTo.y]?.[this._previewTo.x] != null;

        // Source marker
        const srcPos = this.getPieceDisplayPosition(this._previewFrom.x, this._previewFrom.y);
        const srcMarker = document.createElement("div");
        srcMarker.className = "piece move-preview source";
        srcMarker.style.cssText = `left:${srcPos.left}px;top:${srcPos.top}px;width:48px;height:48px;z-index:85;`;
        this.piecesContainer.appendChild(srcMarker);

        // Target marker
        const tgtPos = this.getPieceDisplayPosition(this._previewTo.x, this._previewTo.y);
        const tgtMarker = document.createElement("div");
        tgtMarker.className = `piece move-preview target${isCapture ? ' capture' : ''}`;
        tgtMarker.style.cssText = `left:${tgtPos.left}px;top:${tgtPos.top}px;width:48px;height:48px;z-index:85;`;
        this.piecesContainer.appendChild(tgtMarker);
    }
}
