(function () {
    const canvas = document.getElementById("boardCanvas");
    const ctx = canvas ? canvas.getContext("2d") : null;
    const piecesContainer = document.getElementById("pieces");
    const gameOverMessage = document.getElementById("game-over-message");
    const moveList = document.getElementById("move-list");

    class XiangqiUI {
        constructor() {
            if (!canvas || !ctx || !piecesContainer || !gameOverMessage || !moveList) {
                console.error('One or more required DOM elements are missing!');
                return;
            }

            this.canvas = document.getElementById("boardCanvas");
            this.ctx = this.canvas ? this.canvas.getContext("2d") : null;
            this.context = this.canvas.getContext('2d');
            this.suggestionsBody = document.getElementById('suggestions-body');
            this.evaluationBody = document.getElementById('evaluation-body');
            this.cellWidth = 47;
            this.cellHeight = 48;
            this.pieceSpacing = 1.07;
            this.devicePixelRatio = window.devicePixelRatio || 1;
            this.useImageBoard = false;
            this.imageWidthScale = 1.02;
            this.imageHeightScale = 1.02;
            this.isFlipped = false;
            this.lastMove = null;
            this.lastMoveRaw = null;
            this.lastMovePositions = null;
            this.selectedEngineIndex = 0;
            this.engineProtocol = window.XiangqiGameAPI.getProtocol();
            this.currentPVIndex = null;
            this.simulationStates = [];
            this.originalFen = null;
            this.lastMovePositions = null;
            this.lastSimulatedMove = null;
            this.moveHistory = [];
            this.analysisTimeout = null;
            this.maxAnalysisTime = null;
            this.isAnalyzing = false;


            window.XiangqiGameAPI.onEngineOutput((data) => {
                this.handleEngineOutput(data);
            });
            window.XiangqiGameAPI.onEngineReady(() => {
                this.analyzeCurrentPosition();
            });
            window.addEventListener('engine-error', (event) => {
                const errorMessage = event.detail || 'Unknown engine error';
                alert(`Engine Error: ${errorMessage}`);
            });

            window.XiangqiGameAPI.on('engine-switched', (event, index) => {
                this.selectedEngineIndex = index;
                this.updateEngineList();
                alert(`Engine crashed. Switched to default engine: ${engines[index].name}`);
            });

            if (canvas) {
                canvas.width = (8 * this.cellWidth + 40) * this.devicePixelRatio;
                canvas.height = (9 * this.cellHeight + 40) * this.devicePixelRatio;
                canvas.style.width = `${8 * this.cellWidth + 70}px`;
                canvas.style.height = `${9 * this.cellHeight + 70}px`;
                ctx.scale(this.devicePixelRatio, this.devicePixelRatio);
            }

            this.numberSpacing = 1.05;
            this.selectedPiece = null;
            this.offsetX = -23;
            this.offsetY = -24;
            this.scale = 0.87;

            this.updateBoardDisplay();
            this.renderBoardNumbers();
            this.renderPieces(this.offsetX, this.offsetY, this.scale);
            this.setupControls();
            this.updateMoveHistory();
        }
        async analyzeCurrentPosition() {
            try {
                this.suggestionsBody.innerHTML = '<tr><td colspan="8" style="text-align: center;">Loading...</td></tr>';
                this.isAnalyzing = true;

                const engines = await window.XiangqiGameAPI.getEngines();
                const selectedEngine = engines[this.selectedEngineIndex] || { options: {} };
                const depth = selectedEngine.options?.depth || 20;
                this.maxAnalysisTime = (depth * 1000) + 1000;

                if (this.analysisTimeout) clearTimeout(this.analysisTimeout);
                this.analysisTimeout = setTimeout(() => {
                    if (this.isAnalyzing) {
                        this.suggestionsBody.innerHTML = '<tr><td colspan="8" style="text-align: center;">Engine timeout</td></tr>';
                        this.isAnalyzing = false;
                    }
                }, this.maxAnalysisTime);

                const fen = await window.XiangqiGameAPI.getFen();
                window.XiangqiGameAPI.analyzePosition(fen);
            } catch (err) {
                console.error('Error analyzing position:', err);
                this.suggestionsBody.innerHTML = '<tr><td colspan="8" style="text-align: center;">Error analyzing position</td></tr>';
                this.isAnalyzing = false;
            }
        }
        async makeMove(fromX, fromY, toX, toY) {
            try {
                const moveResult = await window.XiangqiGameAPI.makeMove(fromX, fromY, toX, toY);
                if (!moveResult) {
                    console.warn('Move failed:', { fromX, fromY, toX, toY });
                    return false;
                }
                this.updateMoveHistory();
                const fen = await window.XiangqiGameAPI.getFen();
                this.gameFen = fen;
                this.updateBoardFromFen(fen);
                this.updateCapturedPieces();
                await this.stopAnalysis();
                return true;
            } catch (err) {
                console.error('Error making move:', err);
                return false;
            }
        }



        async convertMoveToNotation(move) {
            if (!move || move.length !== 4) return move;
            const fromX = move.charCodeAt(0) - 97;
            const fromY = 9 - parseInt(move[1]);
            const toX = move.charCodeAt(2) - 97;
            const toY = 9 - parseInt(move[3]);
            try {
                const notation = await window.XiangqiGameAPI.getMoveNotation(fromX, fromY, toX, toY);
                return notation || move;
            } catch (err) {
                console.error('Error converting move to notation:', err);
                return move;
            }
        }

        async handleEngineOutput(data) {
            this.engineProtocol = window.XiangqiGameAPI.getProtocol();
            if (typeof data !== 'string') {
                if (typeof data === 'object') {
                    data = JSON.stringify(data);
                } else {
                    return;
                }
            }
            const lines = data.split('\n');
            const suggestions = [];

            lines.forEach(line => {
                if (line.startsWith('info') && (line.includes('pv') || line.includes('move'))) {
                    const parts = line.split(' ');
                    const depthIndex = parts.indexOf('depth');
                    const scoreIndex = parts.indexOf('score');
                    const nodesIndex = parts.indexOf('nodes');
                    const timeIndex = parts.indexOf('time');
                    let move, scoreValue, note = '', pvMoves = [];

                    if (this.engineProtocol === 'uci' && line.includes('pv')) {
                        const pvIndex = parts.indexOf('pv');
                        const multipvIndex = parts.indexOf('multipv');
                        if (scoreIndex !== -1 && pvIndex !== -1) {
                            const scoreType = parts[scoreIndex + 1];
                            scoreValue = parseInt(parts[scoreIndex + 2]);
                            move = parts[pvIndex + 1];
                            const rank = multipvIndex !== -1 ? parseInt(parts[multipvIndex + 1]) : 1;
                            if (scoreType === 'mate') {
                                note = `Mate in ${scoreValue}`;
                            } else if (scoreType === 'cp') {
                                note = `${(scoreValue / 100).toFixed(2)} points`;
                            }
                            const depth = depthIndex !== -1 ? parseInt(parts[depthIndex + 1]) : '-';
                            const nodes = nodesIndex !== -1 ? parseInt(parts[nodesIndex + 1]) : '-';
                            const time = timeIndex !== -1 ? (parseInt(parts[timeIndex + 1]) / 1000).toFixed(2) : '-';

                            pvMoves = parts.slice(pvIndex + 1);
                            pvMoves = pvMoves.filter(move => /^[a-i][0-9][a-i][0-9]$/.test(move));
                            suggestions.push({ move, score: scoreValue, rank, note, depth, nodes, time, pv: pvMoves });
                        }
                    } else if (this.engineProtocol === 'ucci' && line.includes('move')) {
                        const moveIndex = parts.indexOf('move');
                        if (scoreIndex !== -1 && moveIndex !== -1) {
                            scoreValue = parseInt(parts[scoreIndex + 1]);
                            move = parts[moveIndex + 1];
                            note = `${scoreValue} points`;
                            const depth = depthIndex !== -1 ? parseInt(parts[depthIndex + 1]) : '-';
                            const nodes = nodesIndex !== -1 ? parseInt(parts[nodesIndex + 1]) : '-';
                            const time = timeIndex !== -1 ? (parseInt(parts[timeIndex + 1]) / 1000).toFixed(2) : '-';
                            suggestions[0] = { move, score: scoreValue, rank: 1, note, depth, nodes, time };
                        }
                    }
                } else if (line.startsWith('bestmove')) {
                    if (suggestions.length > 0) {
                        this.updateSuggestionsTable(suggestions.sort((a, b) => a.rank - b.rank));
                    } else {
                        this.suggestionsBody.innerHTML = '<tr><td colspan="8" style="text-align: center;">No suggestions available</td></tr>';
                    }
                    if (this.analysisTimeout) clearTimeout(this.analysisTimeout);
                    this.isAnalyzing = false;
                }
            });
        }

        async updateSuggestionsTable(suggestions) {
            this.suggestionsBody.innerHTML = '';
            for (const [rowIndex, s] of suggestions.entries()) {
                if (s && s.move) {
                    const moveNotation = await this.convertMoveToNotation(s.move);
                    const pvResult = await this.formatPrincipalVariation(s.pv);
                    const pvNotation = pvResult.formatted;
                    const pvMoves = pvResult.moves;

                    const row = document.createElement('tr');
                    row.dataset.rowIndex = rowIndex;
                    row.innerHTML = `
                        <td>${moveNotation} (${s.move})</td>
                        <td>${s.score}</td>
                        <td>${s.rank}</td>
                        <td>${s.note}</td>
                        <td>${s.depth}</td>
                        <td>${s.nodes}</td>
                        <td>${s.time} s</td>
                        <td class="pv-cell"></td>
                    `;

                    const moveCell = row.querySelector('td:first-child');
                    moveCell.dataset.move = s.move;

                    moveCell.addEventListener("mouseenter", async () => {
                        const [fromX, fromY, toX, toY] = this.parseUCIMove(s.move);
                        await this.highlightMove(fromX, fromY, toX, toY, "hover-move");
                    });
                    moveCell.addEventListener("mouseleave", () => {
                        this.clearHoverHighlights();
                    });

                    const pvCell = row.querySelector('.pv-cell');
                    const pvParts = pvNotation.split(', ');
                    pvParts.forEach((part, partIndex) => {
                        const movesInPart = part.split(' ').slice(1);
                        movesInPart.forEach((move, moveIndex) => {
                            if (move !== '...') {
                                const moveSpan = document.createElement('span');
                                moveSpan.textContent = move;
                                moveSpan.style.cursor = 'pointer';
                                moveSpan.style.marginRight = '5px';
                                moveSpan.style.textDecoration = 'underline';
                                moveSpan.dataset.step = (partIndex * 2 + moveIndex + 1).toString();
                                moveSpan.addEventListener('click', async () => {
                                    document.querySelectorAll('.highlighted-move').forEach(span => {
                                        span.classList.remove('highlighted-move');
                                    });

                                    moveSpan.classList.add('highlighted-move');
                                    const step = parseInt(moveSpan.dataset.step);
                                    await this.simulateToStep(rowIndex, s.pv, step);
                                });
                                pvCell.appendChild(moveSpan);
                            }
                        });
                        if (partIndex < pvParts.length - 1) {
                            pvCell.appendChild(document.createTextNode(', '));
                        }
                    });

                    this.suggestionsBody.appendChild(row);
                } else {
                    console.warn('Invalid suggestion object:', s);
                }
            }

            if (this.currentPVIndex !== null) {
                this.showResetButton();
            }
        }

        async resetSimulation() {

            this.currentPVIndex = null;
            this.simulationStates = [];
            this.originalFen = null;
            this.lastSimulatedMove = null;

            document.querySelectorAll('.highlighted-move').forEach(span => {
                span.classList.remove('highlighted-move');
            });

            const controls = document.getElementById('simulation-controls');
            if (controls) {
                controls.remove();
            }

            await this.renderPieces(this.offsetX, this.offsetY, this.scale);
            await this.updateMoveHistory();
        }

        async simulateToStep(rowIndex, pvMoves, step) {
            if (this.currentPVIndex !== rowIndex) {
                this.currentPVIndex = rowIndex;
                this.simulationStates = [];
                this.originalFen = null;
            }

            this.originalFen = await window.XiangqiGameAPI.getFen();

            if (!pvMoves || !Array.isArray(pvMoves) || pvMoves.length === 0 || step < 1 || step > pvMoves.length) {
                console.warn('Invalid pvMoves or step:', { pvMoves, step });
                return;
            }

            try {
                this.simulationStates = await window.XiangqiGameAPI.simulatePV(this.originalFen, pvMoves, step);
                if (this.simulationStates.length === 0) {
                    console.warn('Failed to simulate PV');
                    return;
                }
            } catch (err) {
                console.error('Error simulating PV:', err);
                return;
            }

            if (pvMoves && pvMoves.length >= step) {
                const lastMove = pvMoves[step - 1];
                const [fromX, fromY, toX, toY] = this.parseUCIMove(lastMove);
                this.lastSimulatedMove = { fromX, fromY, toX, toY };
            } else {
                this.lastSimulatedMove = null;
            }

            const lastState = this.simulationStates[this.simulationStates.length - 1];
            this.renderSimulationStep(lastState);

            this.showResetButton();
        }

        async renderSimulationStep(state) {
            if (!state || !state.board) {
                console.warn('Invalid simulation state');
                return;
            }

            piecesContainer.innerHTML = "";
            for (let y = 0; y < 10; y++) {
                for (let x = 0; x < 9; x++) {
                    const piece = state.board[y][x];
                    if (piece) {
                        const div = document.createElement("div");
                        div.className = `piece ${piece.color}`;
                        div.textContent = piece.name;

                        div.style.width = `${this.cellWidth}px`;
                        div.style.height = `${this.cellHeight}px`;
                        div.style.lineHeight = `${this.cellHeight}px`;

                        const displayX = this.isFlipped ? (8 - x) : x;
                        const displayY = this.isFlipped ? (9 - y) : y;
                        const marginX = 23;
                        const marginY = 21;
                        const baseLeft = displayX * this.cellWidth * this.pieceSpacing + marginX;
                        const baseTop = displayY * this.cellHeight * this.pieceSpacing + marginY;
                        div.style.left = `${(baseLeft + this.offsetX)}px`;
                        div.style.top = `${(baseTop + this.offsetY)}px`;

                        div.style.transform = `scale(${this.scale})`;
                        div.style.transformOrigin = "center";

                        div.dataset.x = x;
                        div.dataset.y = y;
                        if (this.lastSimulatedMove &&
                            ((x === this.lastSimulatedMove.fromX && y === this.lastSimulatedMove.fromY) ||
                                (x === this.lastSimulatedMove.toX && y === this.lastSimulatedMove.toY))) {
                            div.classList.add("last-move");
                        }
                        piecesContainer.appendChild(div);
                    }
                }
            }
            if (this.lastSimulatedMove) {
                const { fromX, fromY, toX, toY } = this.lastSimulatedMove;
                if (!state.board[fromY][fromX]) {
                    this.highlightPosition(fromX, fromY, "last-move");
                }
                if (!state.board[toY][toX]) {
                    this.highlightPosition(toX, toY, "last-move");
                }
            }
        }

        showResetButton() {
            let resetButton = document.getElementById('sim-reset-btn');
            if (!resetButton) {
                const container = document.createElement('div');
                container.id = 'simulation-controls';
                container.style.position = 'absolute';
                container.style.top = '10px';
                container.style.right = '10px';
                container.style.background = 'rgba(255, 255, 255, 0.9)';
                container.style.padding = '10px';
                container.style.border = '1px solid #ccc';
                container.style.borderRadius = '5px';

                resetButton = document.createElement('button');
                resetButton.id = 'sim-reset-btn';
                resetButton.textContent = 'Reset';
                container.appendChild(resetButton);
                document.getElementById('board-section').appendChild(container);

                resetButton.addEventListener('click', async () => {
                    await this.resetSimulation();
                });
            }
        }

        // Keep UI analysis read-only: delegate PV formatting to main process temp game.
        // Ask main process to format PV on a temp board so this renderer never mutates live game state.
        async formatPrincipalVariation(pvMoves) {
            if (!pvMoves || pvMoves.length === 0) return { moves: [], formatted: '-' };

            try {
                const fen = await window.XiangqiGameAPI.getFen();
                const result = await window.XiangqiGameAPI.formatPV(fen, pvMoves);
                if (!result || !Array.isArray(result.moves)) {
                    return { moves: [], formatted: '-' };
                }
                return result;
            } catch (err) {
                console.error('Error formatting PV:', err);
                return { moves: [], formatted: '-' };
            }
        }

        parseUCIMove(move) {
            const fromX = move.charCodeAt(0) - 97;
            const fromY = 9 - parseInt(move[1]);
            const toX = move.charCodeAt(2) - 97;
            const toY = 9 - parseInt(move[3]);
            return [fromX, fromY, toX, toY];
        }

        updateEvaluationTable(evalData) {
            this.evaluationBody.innerHTML = '';
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${evalData.move}</td>
                <td>${evalData.rank}</td>
                <td>${evalData.note}</td>
            `;
            this.evaluationBody.appendChild(row);
        }

        updateBoardDisplay() {
            const boardImage = document.getElementById("board-image");
            if (boardImage) {
                if (this.useImageBoard) {
                    boardImage.style.display = "block";
                    const baseWidth = 8 * this.cellWidth + 70;
                    const baseHeight = 9 * this.cellHeight + 70;
                    boardImage.style.width = `${baseWidth * this.imageWidthScale}px`;
                    boardImage.style.height = `${baseHeight * this.imageHeightScale}px`;
                    boardImage.style.position = "absolute";
                    boardImage.style.top = "-4px";
                    boardImage.style.left = "-3px";
                    if (this.ctx && this.canvas) {
                        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
                    } else {
                        console.error("Cannot clear canvas: ctx or canvas is undefined");
                    }
                } else {
                    boardImage.style.display = "none";
                    if (this.ctx && this.canvas) {
                        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
                    }
                    this.drawBoard();
                }
            } else {
                if (this.ctx && this.canvas) {
                    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
                }
                this.drawBoard();
            }
            this.renderBoardNumbers();
        }

        drawBoard() {
            if (!this.ctx || !this.canvas) {
                console.error("Cannot draw board: ctx or canvas is undefined");
                return;
            }

            const ctx = this.ctx;
            const canvas = this.canvas;

            ctx.clearRect(0, 0, canvas.width, canvas.height);

            const marginX = 23;
            const marginY = 21;
            ctx.translate(marginX, marginY);

            ctx.strokeStyle = "black";
            ctx.lineWidth = 1;

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

            for (let i = 0; i < 10; i++) {
                ctx.beginPath();
                ctx.moveTo(0, i * this.cellHeight);
                ctx.lineTo(8 * this.cellWidth, i * this.cellHeight);
                ctx.stroke();
            }

            this.drawPalaceDiagonals();

            this.drawPawnAndCannonDots();

            ctx.font = "20px 'Noto Sans SC', Arial, sans-serif";
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillText("\u695A \u6CB3 - \u6C49 \u754C", 4 * this.cellWidth, 4.5 * this.cellHeight);

            ctx.translate(-marginX, -marginY);
        }


        renderBoardNumbers() {
            const topNumbers = document.getElementById("top-numbers");
            const bottomNumbers = document.getElementById("bottom-numbers");
            topNumbers.innerHTML = "";
            bottomNumbers.innerHTML = "";

            const labels1 = ["1", "2", "3", "4", "5", "6", "7", "8", "9"];
            const labels2 = ["9", "8", "7", "6", "5", "4", "3", "2", "1"];

            labels1.forEach(labels1 => {
                const span = document.createElement("span");
                span.textContent = labels1;
                span.style.display = "inline-block";
                span.style.width = `${this.cellWidth * this.numberSpacing}px`;
                span.style.textAlign = "center";
                topNumbers.appendChild(span);
            });

            labels2.forEach(labels2 => {
                const span = document.createElement("span");
                span.textContent = labels2;
                span.style.display = "inline-block";
                span.style.width = `${this.cellWidth * this.numberSpacing}px`;
                span.style.textAlign = "center";
                bottomNumbers.appendChild(span);
            });
        }
        drawPalaceDiagonals() {
            ctx.strokeStyle = "black";
            ctx.lineWidth = 1;

            ctx.beginPath();
            ctx.moveTo(3 * this.cellWidth, 0 * this.cellHeight);
            ctx.lineTo(5 * this.cellWidth, 2 * this.cellHeight);
            ctx.stroke();

            ctx.beginPath();
            ctx.moveTo(5 * this.cellWidth, 0 * this.cellHeight);
            ctx.lineTo(3 * this.cellWidth, 2 * this.cellHeight);
            ctx.stroke();

            ctx.beginPath();
            ctx.moveTo(3 * this.cellWidth, 7 * this.cellHeight);
            ctx.lineTo(5 * this.cellWidth, 9 * this.cellHeight);
            ctx.stroke();

            ctx.beginPath();
            ctx.moveTo(5 * this.cellWidth, 7 * this.cellHeight);
            ctx.lineTo(3 * this.cellWidth, 9 * this.cellHeight);
            ctx.stroke();
        }

        drawPawnAndCannonDots() {
            const dots = [
                [0, 3], [2, 3], [4, 3], [6, 3], [8, 3],
                [0, 6], [2, 6], [4, 6], [6, 6], [8, 6],
                [1, 2], [7, 2], [1, 7], [7, 7]
            ];
            ctx.fillStyle = "black";
            dots.forEach(([x, y]) => {
                ctx.beginPath();
                ctx.arc(x * this.cellWidth, y * this.cellHeight, 4, 0, 2 * Math.PI);
                ctx.fill();
            });
        }

        async renderPieces(offsetX = 0, offsetY = 0, scale = 1) {
            piecesContainer.innerHTML = "";
            for (let y = 0; y < 10; y++) {
                for (let x = 0; x < 9; x++) {
                    const piece = await window.XiangqiGameAPI.getPiece(x, y);
                    if (piece) {
                        const div = document.createElement("div");
                        div.className = `piece ${piece.color}`;
                        div.textContent = piece.name;

                        div.style.width = `${this.cellWidth}px`;
                        div.style.height = `${this.cellHeight}px`;
                        div.style.lineHeight = `${this.cellHeight}px`;

                        const displayX = this.isFlipped ? (8 - x) : x;
                        const displayY = this.isFlipped ? (9 - y) : y;
                        const marginX = 23;
                        const marginY = 21;
                        const baseLeft = displayX * this.cellWidth * this.pieceSpacing + marginX;
                        const baseTop = displayY * this.cellHeight * this.pieceSpacing + marginY;
                        div.style.left = `${(baseLeft + offsetX)}px`;
                        div.style.top = `${(baseTop + offsetY)}px`;

                        div.style.transform = `scale(${scale})`;
                        div.style.transformOrigin = "center";

                        div.dataset.x = x;
                        div.dataset.y = y;
                        div.addEventListener("click", () => this.handlePieceClick(x, y));

                        if (this.lastMovePositions &&
                            ((x === this.lastMovePositions.fromX && y === this.lastMovePositions.fromY) ||
                                (x === this.lastMovePositions.toX && y === this.lastMovePositions.toY))) {
                            div.classList.add("last-move");
                        }

                        piecesContainer.appendChild(div);
                    }
                }
            }
            if (this.lastMovePositions) {
                const { fromX, fromY, toX, toY } = this.lastMovePositions;
                if (!await window.XiangqiGameAPI.getPiece(fromX, fromY)) {
                    this.highlightPosition(fromX, fromY, "last-move");
                }
            }
        }

        highlightPosition(x, y, className) {
            const marker = document.createElement("div");
            marker.className = `piece ${className}`;

            marker.style.width = `${this.cellWidth}px`;
            marker.style.height = `${this.cellHeight}px`;
            marker.style.lineHeight = `${this.cellHeight}px`;

            const displayX = this.isFlipped ? (8 - x) : x;
            const displayY = this.isFlipped ? (9 - y) : y;
            const marginX = 23;
            const marginY = 21;
            const baseLeft = displayX * this.cellWidth * this.pieceSpacing + marginX;
            const baseTop = displayY * this.cellHeight * this.pieceSpacing + marginY;
            marker.style.left = `${baseLeft + this.offsetX}px`;
            marker.style.top = `${baseTop + this.offsetY}px`;

            marker.style.transform = `scale(${this.scale})`;
            marker.style.transformOrigin = "center";

            piecesContainer.appendChild(marker);
        }

        async highlightMoves(x, y, offsetX = 0, offsetY = 0, scale = 1) {
            this.clearHighlights();
            const moves = await window.XiangqiGameAPI.getLegalMoves(x, y);
            moves.forEach(([mx, my]) => {
                const marker = document.createElement("div");
                marker.className = "piece highlight";

                marker.style.width = `${this.cellWidth}px`;
                marker.style.height = `${this.cellHeight}px`;
                marker.style.lineHeight = `${this.cellHeight}px`;

                const displayX = this.isFlipped ? (8 - mx) : mx;
                const displayY = this.isFlipped ? (9 - my) : my;
                const marginX = 23;
                const marginY = 21;
                const baseLeft = displayX * this.cellWidth * this.pieceSpacing + marginX;
                const baseTop = displayY * this.cellHeight * this.pieceSpacing + marginY;
                marker.style.left = `${(baseLeft + offsetX)}px`;
                marker.style.top = `${(baseTop + offsetY)}px`;

                marker.style.transform = `scale(${scale})`;
                marker.style.transformOrigin = "center";

                marker.addEventListener("click", () => this.handlePieceClick(mx, my));
                piecesContainer.appendChild(marker);
            });
        }

        async handlePieceClick(x, y) {
            if (this.currentPVIndex !== null) {
                alert('Please reset the simulation before interacting with the board.');
                return;
            }
            const piece = await window.XiangqiGameAPI.getPiece(x, y);
            const currentTurn = await window.XiangqiGameAPI.getCurrentTurn();

            if (this.selectedPiece) {
                const [fromX, fromY] = this.selectedPiece;

                if (fromX === x && fromY === y) {
                    this.clearHighlights();
                    this.selectedPiece = null;
                    return;
                }

                const legalMoves = await window.XiangqiGameAPI.getLegalMoves(fromX, fromY);
                const isLegalMove = legalMoves.some(([mx, my]) => mx === x && my === y);

                if (isLegalMove) {
                    const success = await window.XiangqiGameAPI.move(fromX, fromY, x, y);
                    if (success) {
                        this.lastMovePositions = { fromX, fromY, toX: x, toY: y };
                        await this.renderPieces(this.offsetX, this.offsetY, this.scale);
                        const moveHistory = await window.XiangqiGameAPI.getMoveHistory();
                        const lastMoveEntry = moveHistory[moveHistory.length - 1];
                        this.lastMove = lastMoveEntry ? lastMoveEntry.moveNotation : null;
                        this.lastMoveRaw = `${String.fromCharCode(97 + fromX)}${10 - fromY}${String.fromCharCode(97 + x)}${10 - y}`;
                        await this.updateMoveHistory();
                        if (await window.XiangqiGameAPI.isKingInCheck(currentTurn)) {
                            console.log("King is in check!");
                        }
                        await this.checkForCheckmate();
                        this.suggestionsBody.innerHTML = '';
                        await this.analyzeCurrentPosition();
                    }
                    this.clearHighlights();
                    this.selectedPiece = null;
                    return;
                }
            }

            this.clearHighlights();
            this.selectedPiece = null;

            if (piece && piece.color === currentTurn) {
                this.selectedPiece = [x, y];
                this.highlightMoves(x, y, this.offsetX, this.offsetY, this.scale);
            }
        }

        clearHighlights() {
            document.querySelectorAll(".highlight").forEach(el => el.remove());
        }

        async checkForCheckmate() {
            const currentTurn = await window.XiangqiGameAPI.getCurrentTurn();
            const opponentColor = currentTurn === "red" ? "black" : "red";
            try {
                const isCheckmate = await window.XiangqiGameAPI.isCheckmate(opponentColor);
                if (isCheckmate) {
                    const winner = opponentColor === "red" ? "Black" : "Red";
                    this.showGameOverMessage(`${winner} wins!`);
                }
            } catch (err) {
                console.error('Error checking for checkmate:', err);
            }
        }

        showGameOverMessage(message) {
            gameOverMessage.textContent = message;
            gameOverMessage.style.display = "block";
            gameOverMessage.classList.add("blink");

            setTimeout(() => {
                gameOverMessage.classList.remove("blink");
                gameOverMessage.classList.add("fade-out");
            }, 3000);

            setTimeout(() => {
                gameOverMessage.style.display = "none";
            }, 5000);
        }

        // Refresh move list from main-process source of truth after each game-state change.
        async updateMoveHistory() {
            const moveList = document.getElementById('move-list');
            if (!moveList) {
                console.warn('Move list element not found');
                return;
            }

            const history = await window.XiangqiGameAPI.getMoveHistory();
            this.moveHistory = history.map((entry) => entry.moveNotation || '-');

            moveList.innerHTML = '';

            let moveNumber = 1;
            for (let i = 0; i < this.moveHistory.length; i += 2) {
                const row = document.createElement('tr');
                const redMove = this.moveHistory[i] || '-';
                const blackMove = this.moveHistory[i + 1] || '-';
                row.innerHTML =
                    '<td>' + moveNumber + '</td>' +
                    '<td>' + redMove + '</td>' +
                    '<td>' + blackMove + '</td>';
                moveList.appendChild(row);
                moveNumber++;
            }
        }

        highlightMove(fromX, fromY, toX, toY, className) {
            this.clearHoverHighlights();
            const fromPiece = window.XiangqiGameAPI.getPiece(fromX, fromY);
            if (fromPiece) {
                const pieceDiv = piecesContainer.querySelector(`[data-x="${fromX}"][data-y="${fromY}"]`);
                if (pieceDiv) pieceDiv.classList.add(className);
            } else {
                this.highlightPosition(fromX, fromY, className);
            }
            this.highlightPosition(toX, toY, className);
        }
        clearHoverHighlights() {
            document.querySelectorAll(".hover-move").forEach(el => el.classList.remove("hover-move"));
        }

        async goToMove(index) {
            await window.XiangqiGameAPI.resetToInitial();
            const moves = await window.XiangqiGameAPI.getMoveHistory();
            for (let i = 0; i <= index; i++) {
                const move = moves[i];
                await window.XiangqiGameAPI.move(move.fromX, move.fromY, move.toX, move.toY);
            }
            await this.renderPieces(this.offsetX, this.offsetY, this.scale);
            await this.updateMoveHistory();
            await this.analyzeCurrentPosition();
        }

        async updateEngineList() {
            const engineList = document.getElementById("engine-list");
            engineList.innerHTML = "";
            const engines = await window.XiangqiGameAPI.getEngines();

            engines.forEach((engine, index) => {
                const div = document.createElement("div");
                div.className = "engine-item";
                div.innerHTML = `
                    <input type="radio" name="engine" value="${index}" ${index === this.selectedEngineIndex ? "checked" : ""}>
                    <span>${engine.name}</span>
                    <button class="edit-engine-btn" data-index="${index}">Edit</button>
                    <button class="remove-engine-btn" data-index="${index}">X</button>
                `;

                const radio = div.querySelector("input");
                radio.addEventListener("change", async () => {
                    this.selectedEngineIndex = index;
                    const success = await window.XiangqiGameAPI.selectEngine(index);
                    if (success) {
                        this.analyzeCurrentPosition();
                    }
                });

                const editBtn = div.querySelector(".edit-engine-btn");
                editBtn.addEventListener("click", () => {
                    this.showEditEngineForm(index, engine);
                });

                const removeBtn = div.querySelector(".remove-engine-btn");
                removeBtn.addEventListener("click", async () => {
                    const success = await window.XiangqiGameAPI.removeEngine(index);
                    if (success) {
                        if (this.selectedEngineIndex === index && engines.length > 1) {
                            this.selectedEngineIndex = 0;
                            await window.XiangqiGameAPI.selectEngine(0);
                        }
                        this.updateEngineList();
                    }
                });

                engineList.appendChild(div);
            });
        }

        showEditEngineForm(index, engine) {
            const modal = document.getElementById("edit-engine-modal");
            const overlay = document.getElementById("modal-overlay");
            const form = document.getElementById("edit-engine-form");
            const cancelBtn = document.getElementById("cancel-edit-engine");
            const nameInput = document.getElementById("edit-engine-name");
            const hashInput = document.getElementById("edit-engine-hash");
            const multipvInput = document.getElementById("edit-engine-multipv");
            const depthInput = document.getElementById("edit-engine-depth");
            const threadsInput = document.getElementById("edit-engine-threads");
            const skillLevelInput = document.getElementById("edit-engine-skill-level");

            if (!modal || !overlay || !form || !cancelBtn || !nameInput || !hashInput || !multipvInput || !depthInput || !threadsInput || !skillLevelInput) {
                console.error('One or more modal elements are missing:', {
                    modal: !!modal,
                    overlay: !!overlay,
                    form: !!form,
                    cancelBtn: !!cancelBtn,
                    nameInput: !!nameInput,
                    hashInput: !!hashInput,
                    multipvInput: !!multipvInput,
                    depthInput: !!depthInput,
                    threadsInput: !!threadsInput,
                    skillLevelInput: !!skillLevelInput
                });
                alert('Error: Modal elements are missing. Please check index.html.');
                return;
            }

            nameInput.value = engine.name;
            hashInput.value = engine.options?.hash || 128;
            multipvInput.value = engine.options?.multipv || 6;
            depthInput.value = engine.options?.depth || 20;
            threadsInput.value = engine.options?.threads || 1;
            skillLevelInput.value = engine.options?.skillLevel || 20;

            modal.classList.add("show");
            overlay.classList.add("show");

            const closeModal = () => {
                modal.classList.remove("show");
                overlay.classList.remove("show");
                overlay.removeEventListener("click", closeModal);
            };
            overlay.addEventListener("click", closeModal);

            form.onsubmit = async (e) => {
                e.preventDefault();
                const updatedEngine = {
                    name: nameInput.value,
                    path: engine.path,
                    protocol: engine.protocol,
                    options: {
                        hash: parseInt(hashInput.value),
                        multipv: parseInt(multipvInput.value),
                        depth: parseInt(depthInput.value),
                        threads: parseInt(threadsInput.value),
                        skillLevel: parseInt(skillLevelInput.value)
                    }
                };

                const success = await window.XiangqiGameAPI.updateEngine(index, updatedEngine);
                if (success) {
                    if (this.selectedEngineIndex === index) {
                        await window.XiangqiGameAPI.selectEngine(index);
                        this.analyzeCurrentPosition();
                    }
                    this.updateEngineList();
                    closeModal();
                } else {
                    alert("Failed to update engine.");
                }
            };

            cancelBtn.onclick = () => {
                closeModal();
            };
        }

        setupControls() {
            const controlsBtn = document.getElementById("controls-btn");
            const controlsMenu = document.getElementById("controls-menu");
            const engineBtn = document.getElementById("engine-btn");
            const engineMenu = document.getElementById("engine-menu");
            const addEngineBtn = document.getElementById("add-engine-btn");
            const engineFileInput = document.getElementById("engine-file-input");

            engineBtn.addEventListener("click", () => {
                engineMenu.style.display = engineMenu.style.display === "none" ? "block" : "none";
                this.updateEngineList();
            });

            document.addEventListener("click", (event) => {
                if (!engineBtn.contains(event.target) && !engineMenu.contains(event.target)) {
                    engineMenu.style.display = "none";
                }
            });

            addEngineBtn.addEventListener("click", () => {
                engineFileInput.click();
            });

            engineFileInput.addEventListener("change", async (event) => {
                const file = event.target.files[0];
                if (file) {
                    const result = await window.XiangqiGameAPI.addEngine(file.path);
                    if (result.success) {
                        this.updateEngineList();
                        engineMenu.style.display = "none";
                    } else {
                        alert(`Failed to add engine: ${result.error}`);
                    }
                    engineFileInput.value = "";
                }
            });
            window.XiangqiGameAPI.on('engine-output', (data) => {
                this.handleEngineOutput(data);
            });

            window.XiangqiGameAPI.on('engine-error', (event, error) => {
                console.error('Engine error:', error);
                alert(`Engine error: ${error}`);
            });

            controlsBtn.addEventListener("click", () => {
                controlsMenu.style.display = controlsMenu.style.display === "none" ? "block" : "none";
            });

            document.addEventListener("click", (event) => {
                if (!controlsBtn.contains(event.target) && !controlsMenu.contains(event.target)) {
                    controlsMenu.style.display = "none";
                }
            });

            const undoBtn = document.getElementById("undo-btn");
            undoBtn.addEventListener("click", async () => {
                const success = await window.XiangqiGameAPI.undo();
                if (success) {
                    this.clearHighlights();
                    this.selectedPiece = null;
                    await this.renderPieces(this.offsetX, this.offsetY, this.scale);
                    await this.updateMoveHistory();
                    controlsMenu.style.display = "none";
                }
            });

            const redoBtn = document.getElementById("redo-btn");
            redoBtn.addEventListener("click", async () => {
                const success = await window.XiangqiGameAPI.redo();
                if (success) {
                    this.clearHighlights();
                    this.selectedPiece = null;
                    await this.renderPieces(this.offsetX, this.offsetY, this.scale);
                    await this.updateMoveHistory();
                    controlsMenu.style.display = "none";
                }
            });

            const resetInitialBtn = document.getElementById("reset-initial-btn");
            resetInitialBtn.addEventListener("click", async () => {
                const success = await window.XiangqiGameAPI.resetToInitial();
                if (success) {
                    this.clearHighlights();
                    this.selectedPiece = null;
                    await this.renderPieces(this.offsetX, this.offsetY, this.scale);
                    await this.updateMoveHistory();
                    controlsMenu.style.display = "none";
                }
            });

            const resetGameBtn = document.getElementById("reset-game-btn");
            resetGameBtn.addEventListener("click", async () => {
                const success = await window.XiangqiGameAPI.resetGame();
                if (success) {
                    this.clearHighlights();
                    this.selectedPiece = null;
                    this.moveHistory = [];
                    await this.renderPieces(this.offsetX, this.offsetY, this.scale);
                    await this.updateMoveHistory();
                    controlsMenu.style.display = "none";
                }
            });

            const exportGameBtn = document.getElementById("export-game-btn");
            exportGameBtn.addEventListener("click", async () => {
                const gameData = await window.XiangqiGameAPI.exportGame();
                const blob = new Blob([gameData], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = 'xiangqi-game.json';
                a.click();
                URL.revokeObjectURL(url);
                controlsMenu.style.display = "none";
            });

            const importGameBtn = document.getElementById("import-game-btn");
            const importGameFile = document.getElementById("import-game-file");
            importGameBtn.addEventListener("click", () => {
                importGameFile.click();
                controlsMenu.style.display = "none";
            });

            importGameFile.addEventListener("change", async (event) => {
                const file = event.target.files[0];
                if (file) {
                    const reader = new FileReader();
                    reader.onload = async (e) => {
                        const gameData = e.target.result;
                        const success = await window.XiangqiGameAPI.importGame(gameData);
                        if (success) {
                            this.clearHighlights();
                            this.selectedPiece = null;
                            await this.renderPieces(this.offsetX, this.offsetY, this.scale);
                            await this.updateMoveHistory();
                        } else {
                            alert('Failed to import game.');
                        }
                        controlsMenu.style.display = "none";
                    };
                    reader.readAsText(file);
                }
            });

            const flipBoardBtn = document.getElementById("flip-board-btn");
            flipBoardBtn.addEventListener("click", async () => {
                this.isFlipped = !this.isFlipped;
                window.XiangqiGameAPI.setFlipped(this.isFlipped);
                this.updateBoardDisplay();
                await this.renderPieces(this.offsetX, this.offsetY, this.scale);
                if (this.selectedPiece) {
                    const [x, y] = this.selectedPiece;
                    await this.highlightMoves(x, y, this.offsetX, this.offsetY, this.scale);
                }
                controlsMenu.style.display = "none";
            });

            const boardTypeSelect = document.getElementById("board-type");
            boardTypeSelect.addEventListener("change", () => {
                this.useImageBoard = boardTypeSelect.value === "image";
                this.updateBoardDisplay();
            });

            const loadSuggestionsBtn = document.getElementById("load-suggestions-btn");
            if (loadSuggestionsBtn) {
                loadSuggestionsBtn.addEventListener("click", async () => {
                    this.suggestionsBody.innerHTML = '';
                    await this.analyzeCurrentPosition();
                });
            } else {
                console.warn('Load Suggestions button not found in DOM');
            }
        }
    }

    window.addEventListener('DOMContentLoaded', () => {
        new XiangqiUI();
    });
})();




