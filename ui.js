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
            this.lastMove = null; // LÆ°u nÆ°á»›c Ä‘i vá»«a thá»±c hiá»‡n (Ä‘á»‹nh dáº¡ng "R1+1")
            this.lastMoveRaw = null; // LÆ°u nÆ°á»›c Ä‘i vá»«a thá»±c hiá»‡n (Ä‘á»‹nh dáº¡ng "b2e2")
            this.lastMovePositions = null; // LÆ°u vá»‹ trÃ­ from/to cá»§a nÆ°á»›c Ä‘i cuá»‘i cÃ¹ng
            this.selectedEngineIndex = 0; // Engine hiá»‡n táº¡i Ä‘Æ°á»£c chá»n
            this.engineProtocol = window.XiangqiGameAPI.getProtocol();
            this.currentPVIndex = null; // Chá»‰ sá»‘ cá»§a hÃ ng PV hiá»‡n táº¡i trong báº£ng gá»£i Ã½
            this.simulationStates = []; // LÆ°u danh sÃ¡ch tráº¡ng thÃ¡i bÃ n cá» tá»« mÃ´ phá»ng
            this.originalFen = null; // LÆ°u FEN ban Ä‘áº§u trÆ°á»›c khi mÃ´ phá»ng
            this.lastMovePositions = null; // ÄÃ£ cÃ³, lÆ°u nÆ°á»›c Ä‘i cuá»‘i cÃ¹ng trong cháº¿ Ä‘á»™ chÆ¡i thÃ´ng thÆ°á»ng
            this.lastSimulatedMove = null; // ThÃªm thuá»™c tÃ­nh má»›i Ä‘á»ƒ lÆ°u nÆ°á»›c Ä‘i vá»«a mÃ´ phá»ng
            this.moveHistory = []; // ThÃªm máº£ng Ä‘á»ƒ lÆ°u lá»‹ch sá»­ nÆ°á»›c Ä‘i
            this.analysisTimeout = null; // Biáº¿n Ä‘á»ƒ lÆ°u timeout
            this.maxAnalysisTime = null; // Thá»i gian chá» tá»‘i Ä‘a (Ä‘Æ°á»£c tÃ­nh dá»±a trÃªn cÃ i Ä‘áº·t engine)
            this.isAnalyzing = false; // Tráº¡ng thÃ¡i phÃ¢n tÃ­ch


            // Láº¯ng nghe dá»¯ liá»‡u tá»« engine
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

            // Gá»i cÃ¡c phÆ°Æ¡ng thá»©c sau khi window.XiangqiGameAPI Ä‘Ã£ Ä‘Æ°á»£c khá»Ÿi táº¡o
            this.updateBoardDisplay();
            this.renderBoardNumbers();
            this.renderPieces(this.offsetX, this.offsetY, this.scale);
            this.setupControls();
            this.updateMoveHistory();
        }
        async analyzeCurrentPosition() {
            try {
                // Hiá»ƒn thá»‹ "Loading" trong báº£ng gá»£i Ã½
                this.suggestionsBody.innerHTML = '<tr><td colspan="8" style="text-align: center;">Loading...</td></tr>';
                this.isAnalyzing = true;

                // Láº¥y cÃ i Ä‘áº·t engine hiá»‡n táº¡i Ä‘á»ƒ xÃ¡c Ä‘á»‹nh thá»i gian tá»‘i Ä‘a
                const engines = await window.XiangqiGameAPI.getEngines();
                const selectedEngine = engines[this.selectedEngineIndex] || { options: {} };
                const depth = selectedEngine.options?.depth || 20; // Máº·c Ä‘á»‹nh depth = 20 náº¿u khÃ´ng cÃ³
                this.maxAnalysisTime = (depth * 1000) + 1000; // Thá»i gian tá»‘i Ä‘a = (depth * 1s) + 1s

                // Thiáº¿t láº­p timeout Ä‘á»ƒ kiá»ƒm tra náº¿u engine khÃ´ng pháº£n há»“i
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
            const fromX = move.charCodeAt(0) - 97; // 'a' = 0, 'i' = 8
            const fromY = 9 - parseInt(move[1]);   // '0' = 9, '9' = 0 (Ä‘áº£o ngÆ°á»£c cho cá» TÆ°á»›ng)
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
            this.engineProtocol = window.XiangqiGameAPI.getProtocol(); // Cáº­p nháº­t giao thá»©c
            // Äáº£m báº£o data lÃ  chuá»—i
            if (typeof data !== 'string') {
                // console.warn('Engine output is not a string:', data);
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

                            // Láº¥y chuá»—i PV vÃ  lá»c cÃ¡c nÆ°á»›c Ä‘i há»£p lá»‡
                            pvMoves = parts.slice(pvIndex + 1);
                            pvMoves = pvMoves.filter(move => /^[a-i][0-9][a-i][0-9]$/.test(move)); // Chá»‰ giá»¯ cÃ¡c nÆ°á»›c Ä‘i cÃ³ Ä‘á»‹nh dáº¡ng há»£p lá»‡ (vÃ­ dá»¥: h0g2)
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
                    // Khi nháº­n Ä‘Æ°á»£c bestmove, káº¿t thÃºc phÃ¢n tÃ­ch
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
                    row.dataset.rowIndex = rowIndex; // LÆ°u chá»‰ sá»‘ hÃ ng Ä‘á»ƒ xÃ¡c Ä‘á»‹nh PV
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

                    // Hover: ÄÃ¡nh dáº¥u nÆ°á»›c Ä‘i (giá»¯ nguyÃªn)
                    moveCell.addEventListener("mouseenter", async () => {
                        const [fromX, fromY, toX, toY] = this.parseUCIMove(s.move);
                        await this.highlightMove(fromX, fromY, toX, toY, "hover-move");
                    });
                    moveCell.addEventListener("mouseleave", () => {
                        this.clearHoverHighlights();
                    });

                    // Táº¡o cÃ¡c kÃ½ hiá»‡u cÃ³ thá»ƒ nháº¥p trong cá»™t Principal Variation
                    const pvCell = row.querySelector('.pv-cell');
                    const pvParts = pvNotation.split(', ');
                    pvParts.forEach((part, partIndex) => {
                        const movesInPart = part.split(' ').slice(1); // Bá» sá»‘ thá»© tá»± (vÃ­ dá»¥: "1." -> ["P7+1", "N8+7"])
                        movesInPart.forEach((move, moveIndex) => {
                            if (move !== '...') {
                                const moveSpan = document.createElement('span');
                                moveSpan.textContent = move;
                                moveSpan.style.cursor = 'pointer';
                                moveSpan.style.marginRight = '5px';
                                moveSpan.style.textDecoration = 'underline';
                                moveSpan.dataset.step = (partIndex * 2 + moveIndex + 1).toString(); // Sá»‘ bÆ°á»›c tá»« Ä‘áº§u chuá»—i
                                moveSpan.addEventListener('click', async () => {
                                    document.querySelectorAll('.highlighted-move').forEach(span => {
                                        span.classList.remove('highlighted-move');
                                    });

                                    // ThÃªm lá»›p highlighted-move cho kÃ½ hiá»‡u vá»«a Ä‘Æ°á»£c nháº¥p
                                    moveSpan.classList.add('highlighted-move');
                                    // Gá»i hÃ m simulateToStep Ä‘á»ƒ mÃ´ phá»ng nÆ°á»›c Ä‘i
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

            // Hiá»ƒn thá»‹ nÃºt Reset náº¿u Ä‘ang mÃ´ phá»ng
            if (this.currentPVIndex !== null) {
                this.showResetButton();
            }
        }

        async resetSimulation() {
            // KhÃ´i phá»¥c tráº¡ng thÃ¡i ban Ä‘áº§u tá»« FEN
            // if (this.originalFen) {
            //     await window.XiangqiGameAPI.importFen(this.originalFen);
            // }

            // Äáº·t láº¡i tráº¡ng thÃ¡i mÃ´ phá»ng
            this.currentPVIndex = null;
            this.simulationStates = [];
            this.originalFen = null;
            this.lastSimulatedMove = null; // XÃ³a highlight cá»§a nÆ°á»›c Ä‘i mÃ´ phá»ng

            // XÃ³a lá»›p highlighted-move khá»i táº¥t cáº£ cÃ¡c kÃ½ hiá»‡u trong cá»™t PV
            document.querySelectorAll('.highlighted-move').forEach(span => {
                span.classList.remove('highlighted-move');
            });

            // XÃ³a nÃºt Reset
            const controls = document.getElementById('simulation-controls');
            if (controls) {
                controls.remove();
            }

            // Cáº­p nháº­t láº¡i giao diá»‡n
            await this.renderPieces(this.offsetX, this.offsetY, this.scale);
            await this.updateMoveHistory();
        }

        async simulateToStep(rowIndex, pvMoves, step) {
            // Náº¿u nháº¥p vÃ o má»™t Principal Variation khÃ¡c, xÃ³a tráº¡ng thÃ¡i hiá»‡n táº¡i
            if (this.currentPVIndex !== rowIndex) {
                this.currentPVIndex = rowIndex;
                this.simulationStates = [];
                this.originalFen = null;
            }

            // Láº¥y FEN hiá»‡n táº¡i cá»§a bÃ n cá»
            this.originalFen = await window.XiangqiGameAPI.getFen();

            // Kiá»ƒm tra chuá»—i pvMoves
            if (!pvMoves || !Array.isArray(pvMoves) || pvMoves.length === 0 || step < 1 || step > pvMoves.length) {
                console.warn('Invalid pvMoves or step:', { pvMoves, step });
                return;
            }

            // Gá»i simulatePV Ä‘á»ƒ mÃ´ phá»ng Ä‘áº¿n bÆ°á»›c Ä‘Æ°á»£c chá»‰ Ä‘á»‹nh
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

            // XÃ¡c Ä‘á»‹nh nÆ°á»›c Ä‘i cuá»‘i cÃ¹ng trong chuá»—i mÃ´ phá»ng (tÆ°Æ¡ng á»©ng vá»›i bÆ°á»›c step)
            if (pvMoves && pvMoves.length >= step) {
                const lastMove = pvMoves[step - 1]; // NÆ°á»›c Ä‘i cuá»‘i cÃ¹ng trong chuá»—i (step báº¯t Ä‘áº§u tá»« 1)
                const [fromX, fromY, toX, toY] = this.parseUCIMove(lastMove);
                this.lastSimulatedMove = { fromX, fromY, toX, toY }; // LÆ°u nÆ°á»›c Ä‘i vá»«a mÃ´ phá»ng
            } else {
                this.lastSimulatedMove = null; // Náº¿u khÃ´ng cÃ³ nÆ°á»›c Ä‘i, Ä‘áº·t láº¡i
            }

            // Hiá»ƒn thá»‹ tráº¡ng thÃ¡i bÃ n cá» táº¡i bÆ°á»›c cuá»‘i cÃ¹ng
            const lastState = this.simulationStates[this.simulationStates.length - 1];
            this.renderSimulationStep(lastState); // Bá» await vÃ¬ renderSimulationStep khÃ´ng cÃ²n lÃ  async

            // Hiá»ƒn thá»‹ nÃºt Reset
            this.showResetButton();
        }

        async renderSimulationStep(state) {
            if (!state || !state.board) {
                console.warn('Invalid simulation state');
                return;
            }

            // Cáº­p nháº­t bÃ n cá» vá»›i tráº¡ng thÃ¡i mÃ´ phá»ng
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
                        // Highlight nÆ°á»›c Ä‘i vá»«a mÃ´ phá»ng
                        if (this.lastSimulatedMove &&
                            ((x === this.lastSimulatedMove.fromX && y === this.lastSimulatedMove.fromY) ||
                                (x === this.lastSimulatedMove.toX && y === this.lastSimulatedMove.toY))) {
                            div.classList.add("last-move");
                        }
                        piecesContainer.appendChild(div);
                    }
                }
            }
            // Highlight vá»‹ trÃ­ trá»‘ng cá»§a nÆ°á»›c Ä‘i vá»«a mÃ´ phá»ng (náº¿u cÃ³)
            if (this.lastSimulatedMove) {
                const { fromX, fromY, toX, toY } = this.lastSimulatedMove;
                if (!state.board[fromY][fromX]) { // Náº¿u vá»‹ trÃ­ "from" trá»‘ng
                    this.highlightPosition(fromX, fromY, "last-move");
                }
                if (!state.board[toY][toX]) { // Náº¿u vá»‹ trÃ­ "to" trá»‘ng
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

        // HÃ m Ä‘á»‹nh dáº¡ng chuá»—i PV giá»‘ng Move History
        async formatPrincipalVariation(pvMoves) {
            if (!pvMoves || pvMoves.length === 0) return '-';

            const formattedMoves = [];
            let moveNumber = 1;
            let isRedTurn = true; // Äá» Ä‘i trÆ°á»›c

            // LÆ°u tráº¡ng thÃ¡i hiá»‡n táº¡i cá»§a bÃ n cá»
            const originalFen = await window.XiangqiGameAPI.getFen();

            // MÃ´ phá»ng tá»«ng nÆ°á»›c Ä‘i trong chuá»—i PV
            for (let i = 0; i < pvMoves.length; i++) {
                const move = pvMoves[i];
                const [fromX, fromY, toX, toY] = this.parseUCIMove(move);

                // Chuyá»ƒn Ä‘á»•i nÆ°á»›c Ä‘i thÃ nh kÃ½ hiá»‡u cá» TÆ°á»›ng
                const notation = await window.XiangqiGameAPI.getMoveNotation(fromX, fromY, toX, toY);

                // Thá»±c hiá»‡n nÆ°á»›c Ä‘i trÃªn bÃ n cá» chÃ­nh (táº¡m thá»i)
                await window.XiangqiGameAPI.move(fromX, fromY, toX, toY);

                formattedMoves.push(notation);
                if (i % 2 === 1) {
                    moveNumber++;
                }
                isRedTurn = !isRedTurn;
            }

            // KhÃ´i phá»¥c tráº¡ng thÃ¡i ban Ä‘áº§u cá»§a bÃ n cá»
            await window.XiangqiGameAPI.importFen(originalFen);

            // Äá»‹nh dáº¡ng chuá»—i PV
            const result = [];
            for (let i = 0; i < formattedMoves.length; i += 2) {
                const redMove = formattedMoves[i];
                const blackMove = formattedMoves[i + 1] || '...';
                result.push(`${i / 2 + 1}. ${redMove} ${blackMove}`);
            }

            return { moves: formattedMoves, formatted: result.join(', ') };
        }

        // HÃ m há»— trá»£ phÃ¢n tÃ­ch nÆ°á»›c Ä‘i UCI (b2e2 -> tá»a Ä‘á»™ bÃ n cá»)
        parseUCIMove(move) {
            const fromX = move.charCodeAt(0) - 97; // 'a' = 0, 'i' = 8
            const fromY = 9 - parseInt(move[1]);   // '0' = 9, '9' = 0
            const toX = move.charCodeAt(2) - 97;
            const toY = 9 - parseInt(move[3]);
            return [fromX, fromY, toX, toY];
        }

        updateEvaluationTable(evalData) {
            this.evaluationBody.innerHTML = '';
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${evalData.move}</td> <!-- ÄÃ£ Ä‘Æ°á»£c gÃ¡n thÃ nh Ä‘á»‹nh dáº¡ng "R1+1" trong handleEngineOutput -->
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
                    const baseWidth = 8 * this.cellWidth + 70; // Khá»›p vá»›i canvas.style.width
                    const baseHeight = 9 * this.cellHeight + 70; // Khá»›p vá»›i canvas.style.height
                    boardImage.style.width = `${baseWidth * this.imageWidthScale}px`;
                    boardImage.style.height = `${baseHeight * this.imageHeightScale}px`;
                    boardImage.style.position = "absolute";
                    boardImage.style.top = "-4px";// LÃªn
                    boardImage.style.left = "-3px";//Xuá»‘ng
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
            // LuÃ´n gá»i renderBoardNumbers Ä‘á»ƒ Ä‘áº£m báº£o sá»‘ thá»© tá»± Ä‘Æ°á»£c váº½ láº¡i
            this.renderBoardNumbers();
        }

        drawBoard() {
            if (!this.ctx || !this.canvas) {
                console.error("Cannot draw board: ctx or canvas is undefined");
                return;
            }

            const ctx = this.ctx;
            const canvas = this.canvas;

            // XÃ³a canvas
            ctx.clearRect(0, 0, canvas.width, canvas.height);

            // Äáº·t lá» Ä‘á»ƒ cÄƒn giá»¯a bÃ n cá»
            const marginX = 23;
            const marginY = 21;
            ctx.translate(marginX, marginY);

            // Äáº·t kiá»ƒu váº½
            ctx.strokeStyle = "black";
            ctx.lineWidth = 1;

            // Váº½ cÃ¡c Ä‘Æ°á»ng dá»c (9 cá»™t)
            for (let i = 0; i < 9; i++) {
                ctx.beginPath();
                if (i === 0 || i === 8) {
                    // ÄÆ°á»ng dá»c Ä‘áº§y Ä‘á»§ cho cá»™t 0 vÃ  8
                    ctx.moveTo(i * this.cellWidth, 0);
                    ctx.lineTo(i * this.cellWidth, 9 * this.cellHeight);
                } else {
                    // ÄÆ°á»ng dá»c bá»‹ ngáº¯t á»Ÿ giá»¯a (hÃ ng 4 vÃ  5) Ä‘á»ƒ táº¡o sÃ´ng
                    ctx.moveTo(i * this.cellWidth, 0);
                    ctx.lineTo(i * this.cellWidth, 4 * this.cellHeight);
                    ctx.moveTo(i * this.cellWidth, 5 * this.cellHeight);
                    ctx.lineTo(i * this.cellWidth, 9 * this.cellHeight);
                }
                ctx.stroke();
            }

            // Váº½ cÃ¡c Ä‘Æ°á»ng ngang (10 hÃ ng)
            for (let i = 0; i < 10; i++) {
                ctx.beginPath();
                ctx.moveTo(0, i * this.cellHeight);
                ctx.lineTo(8 * this.cellWidth, i * this.cellHeight);
                ctx.stroke();
            }

            // Váº½ Ä‘Æ°á»ng chÃ©o trong cung
            this.drawPalaceDiagonals();

            // Váº½ cÃ¡c Ä‘iá»ƒm Ä‘Ã¡nh dáº¥u cho Tá»‘t vÃ  PhÃ¡o
            this.drawPawnAndCannonDots();

            // Váº½ khu vá»±c "sÃ´ng" vÃ  chá»¯ "æ¥š æ²³ - æ±‰ ç•Œ"
            ctx.font = "20px 'Noto Sans SC', Arial, sans-serif";
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillText("æ¥š æ²³ - æ±‰ ç•Œ", 4 * this.cellWidth, 4.5 * this.cellHeight);

            // KhÃ´i phá»¥c tá»a Ä‘á»™
            ctx.translate(-marginX, -marginY);
        }


        renderBoardNumbers() {
            const topNumbers = document.getElementById("top-numbers");
            const bottomNumbers = document.getElementById("bottom-numbers");
            topNumbers.innerHTML = "";
            bottomNumbers.innerHTML = "";

            // Giá»¯ nguyÃªn thá»© tá»± cÃ¡c sá»‘, khÃ´ng Ä‘áº£o ngÆ°á»£c khi isFlipped
            const labels1 = ["1", "2", "3", "4", "5", "6", "7", "8", "9"];
            const labels2 = ["9", "8", "7", "6", "5", "4", "3", "2", "1"];

            // Hiá»ƒn thá»‹ sá»‘ á»Ÿ phÃ­a trÃªn
            labels1.forEach(labels1 => {
                const span = document.createElement("span");
                span.textContent = labels1;
                span.style.display = "inline-block";
                span.style.width = `${this.cellWidth * this.numberSpacing}px`;
                span.style.textAlign = "center";
                topNumbers.appendChild(span);
            });

            // Hiá»ƒn thá»‹ sá»‘ á»Ÿ phÃ­a dÆ°á»›i
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
                        const marginX = 23; // Pháº£i khá»›p vá»›i marginX trong drawBoard
                        const marginY = 21; // Pháº£i khá»›p vá»›i marginY trong drawBoard
                        const baseLeft = displayX * this.cellWidth * this.pieceSpacing + marginX;
                        const baseTop = displayY * this.cellHeight * this.pieceSpacing + marginY;
                        div.style.left = `${(baseLeft + offsetX)}px`;
                        div.style.top = `${(baseTop + offsetY)}px`;

                        div.style.transform = `scale(${scale})`;
                        div.style.transformOrigin = "center";

                        div.dataset.x = x;
                        div.dataset.y = y;
                        div.addEventListener("click", () => this.handlePieceClick(x, y));

                        // ÄÃ¡nh dáº¥u nÆ°á»›c Ä‘i cuá»‘i cÃ¹ng
                        if (this.lastMovePositions &&
                            ((x === this.lastMovePositions.fromX && y === this.lastMovePositions.fromY) ||
                                (x === this.lastMovePositions.toX && y === this.lastMovePositions.toY))) {
                            div.classList.add("last-move");
                        }

                        piecesContainer.appendChild(div);
                    }
                }
            }
            // ÄÃ¡nh dáº¥u vá»‹ trÃ­ trá»‘ng cá»§a nÆ°á»›c Ä‘i cuá»‘i cÃ¹ng (náº¿u cÃ³)
            if (this.lastMovePositions) {
                const { fromX, fromY, toX, toY } = this.lastMovePositions;
                if (!await window.XiangqiGameAPI.getPiece(fromX, fromY)) {
                    this.highlightPosition(fromX, fromY, "last-move");
                }
            }
        }

        // HÃ m há»— trá»£ Ä‘Ã¡nh dáº¥u vá»‹ trÃ­ trá»‘ng
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
                const marginX = 23; // Pháº£i khá»›p vá»›i marginX trong drawBoard
                const marginY = 21; // Pháº£i khá»›p vá»›i marginY trong drawBoard
                const baseLeft = displayX * this.cellWidth * this.pieceSpacing + marginX; // Sá»­ dá»¥ng displayX
                const baseTop = displayY * this.cellHeight * this.pieceSpacing + marginY; // Sá»­ dá»¥ng displayY
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
                        this.lastMovePositions = { fromX, fromY, toX: x, toY: y }; // LÆ°u nÆ°á»›c Ä‘i cuá»‘i cÃ¹ng
                        await this.renderPieces(this.offsetX, this.offsetY, this.scale);
                        const moveHistory = await window.XiangqiGameAPI.getMoveHistory();
                        const lastMoveEntry = moveHistory[moveHistory.length - 1];
                        this.lastMove = lastMoveEntry ? lastMoveEntry.moveNotation : null; // "R1+1"
                        this.lastMoveRaw = `${String.fromCharCode(97 + fromX)}${10 - fromY}${String.fromCharCode(97 + x)}${10 - y}`; // "b2e2"
                        await this.updateMoveHistory();
                        if (await window.XiangqiGameAPI.isKingInCheck(currentTurn)) {
                            console.log("King is in check!");
                        }
                        await this.checkForCheckmate();
                        this.suggestionsBody.innerHTML = ''; // XÃ³a báº£ng gá»£i Ã½ nÆ°á»›c Ä‘i ngay sau khi di chuyá»ƒn
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
        // HÃ m xÃ³a Ä‘Ã¡nh dáº¥u hover
        clearHoverHighlights() {
            document.querySelectorAll(".hover-move").forEach(el => el.classList.remove("hover-move"));
        }

        // HÃ m chuyá»ƒn bÃ n cá» vá» tráº¡ng thÃ¡i sau nÆ°á»›c Ä‘i (cÆ¡ báº£n)
        async goToMove(index) {
            await window.XiangqiGameAPI.resetToInitial(); // Äáº·t láº¡i tráº¡ng thÃ¡i ban Ä‘áº§u
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

            // Kiá»ƒm tra cÃ¡c pháº§n tá»­
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

            // Äiá»n thÃ´ng tin hiá»‡n táº¡i cá»§a engine vÃ o form
            nameInput.value = engine.name;
            hashInput.value = engine.options?.hash || 128;
            multipvInput.value = engine.options?.multipv || 6;
            depthInput.value = engine.options?.depth || 20;
            threadsInput.value = engine.options?.threads || 1;
            skillLevelInput.value = engine.options?.skillLevel || 20;

            // Hiá»ƒn thá»‹ modal vá»›i hiá»‡u á»©ng fade-in
            modal.classList.add("show");
            overlay.classList.add("show");

            // ÄÃ³ng modal khi nháº¥n vÃ o overlay
            const closeModal = () => {
                modal.classList.remove("show");
                overlay.classList.remove("show");
                overlay.removeEventListener("click", closeModal); // XÃ³a sá»± kiá»‡n sau khi Ä‘Ã³ng
            };
            overlay.addEventListener("click", closeModal);

            // Xá»­ lÃ½ khi submit form
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
                    closeModal(); // ÄÃ³ng modal khi lÆ°u thÃ nh cÃ´ng
                } else {
                    alert("Failed to update engine.");
                }
            };

            // Xá»­ lÃ½ khi nháº¥n Cancel
            cancelBtn.onclick = () => {
                closeModal(); // ÄÃ³ng modal khi nháº¥n Cancel
            };
        }

        setupControls() {
            const controlsBtn = document.getElementById("controls-btn");
            const controlsMenu = document.getElementById("controls-menu");
            // NÃºt Engine
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
                    engineFileInput.value = ""; // Reset input
                }
            });
            window.XiangqiGameAPI.on('engine-output', (data) => {
                this.handleEngineOutput(data);
            });

            window.XiangqiGameAPI.on('engine-error', (event, error) => {
                console.error('Engine error:', error);
                alert(`Engine error: ${error}`);
            });

            // Hiá»ƒn thá»‹/áº©n menu khi nháº¥p vÃ o nÃºt "Controls"
            controlsBtn.addEventListener("click", () => {
                controlsMenu.style.display = controlsMenu.style.display === "none" ? "block" : "none";
            });

            // ÄÃ³ng menu khi nháº¥p ra ngoÃ i
            document.addEventListener("click", (event) => {
                if (!controlsBtn.contains(event.target) && !controlsMenu.contains(event.target)) {
                    controlsMenu.style.display = "none";
                }
            });

            // NÃºt Undo
            const undoBtn = document.getElementById("undo-btn");
            undoBtn.addEventListener("click", async () => {
                const success = await window.XiangqiGameAPI.undo();
                if (success) {
                    this.clearHighlights();
                    this.selectedPiece = null;
                    await this.renderPieces(this.offsetX, this.offsetY, this.scale);
                    await this.updateMoveHistory();
                    controlsMenu.style.display = "none"; // ÄÃ³ng menu
                }
            });

            // NÃºt Redo
            const redoBtn = document.getElementById("redo-btn");
            redoBtn.addEventListener("click", async () => {
                const success = await window.XiangqiGameAPI.redo();
                if (success) {
                    this.clearHighlights();
                    this.selectedPiece = null;
                    await this.renderPieces(this.offsetX, this.offsetY, this.scale);
                    await this.updateMoveHistory();
                    controlsMenu.style.display = "none"; // ÄÃ³ng menu
                }
            });

            // NÃºt Reset to Initial
            const resetInitialBtn = document.getElementById("reset-initial-btn");
            resetInitialBtn.addEventListener("click", async () => {
                const success = await window.XiangqiGameAPI.resetToInitial();
                if (success) {
                    this.clearHighlights();
                    this.selectedPiece = null;
                    await this.renderPieces(this.offsetX, this.offsetY, this.scale);
                    await this.updateMoveHistory();
                    controlsMenu.style.display = "none"; // ÄÃ³ng menu
                }
            });

            // NÃºt Reset Game
            const resetGameBtn = document.getElementById("reset-game-btn");
            resetGameBtn.addEventListener("click", async () => {
                const success = await window.XiangqiGameAPI.resetGame();
                if (success) {
                    this.clearHighlights();
                    this.selectedPiece = null;
                    this.moveHistory = []; // Äáº·t láº¡i lá»‹ch sá»­ nÆ°á»›c Ä‘i
                    await this.renderPieces(this.offsetX, this.offsetY, this.scale);
                    await this.updateMoveHistory();
                    controlsMenu.style.display = "none"; // ÄÃ³ng menu
                }
            });

            // NÃºt Export Game
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
                controlsMenu.style.display = "none"; // ÄÃ³ng menu
            });

            // NÃºt Import Game
            const importGameBtn = document.getElementById("import-game-btn");
            const importGameFile = document.getElementById("import-game-file");
            importGameBtn.addEventListener("click", () => {
                importGameFile.click();
                controlsMenu.style.display = "none"; // ÄÃ³ng menu ngay khi má»Ÿ file picker
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
                        controlsMenu.style.display = "none"; // ÄÃ³ng menu sau khi import
                    };
                    reader.readAsText(file);
                }
            });

            // NÃºt Flip Board
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
                controlsMenu.style.display = "none"; // ÄÃ³ng menu
            });

            // Chá»n loáº¡i bÃ n cá» (khÃ´ng náº±m trong menu)
            const boardTypeSelect = document.getElementById("board-type");
            boardTypeSelect.addEventListener("change", () => {
                this.useImageBoard = boardTypeSelect.value === "image";
                this.updateBoardDisplay();
            });

            //NÃºt load cho báº£ng suggest
            const loadSuggestionsBtn = document.getElementById("load-suggestions-btn");
            if (loadSuggestionsBtn) {
                loadSuggestionsBtn.addEventListener("click", async () => {
                    this.suggestionsBody.innerHTML = ''; // XÃ³a báº£ng gá»£i Ã½ trÆ°á»›c khi táº£i láº¡i
                    await this.analyzeCurrentPosition(); // Gá»­i bÃ n cá» hiá»‡n táº¡i Ä‘áº¿n engine Ä‘á»ƒ phÃ¢n tÃ­ch láº¡i
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


