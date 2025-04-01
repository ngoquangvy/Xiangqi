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
            this.lastMove = null; // Lưu nước đi vừa thực hiện (định dạng "R1+1")
            this.lastMoveRaw = null; // Lưu nước đi vừa thực hiện (định dạng "b2e2")
            this.lastMovePositions = null; // Lưu vị trí from/to của nước đi cuối cùng
            this.selectedEngineIndex = 0; // Engine hiện tại được chọn
            this.engineProtocol = window.XiangqiGameAPI.getProtocol();
            this.currentPVIndex = null; // Chỉ số của hàng PV hiện tại trong bảng gợi ý
            this.simulationStates = []; // Lưu danh sách trạng thái bàn cờ từ mô phỏng
            this.originalFen = null; // Lưu FEN ban đầu trước khi mô phỏng
            this.lastMovePositions = null; // Đã có, lưu nước đi cuối cùng trong chế độ chơi thông thường
            this.lastSimulatedMove = null; // Thêm thuộc tính mới để lưu nước đi vừa mô phỏng
            this.moveHistory = []; // Thêm mảng để lưu lịch sử nước đi
            this.analysisTimeout = null; // Biến để lưu timeout
            this.maxAnalysisTime = null; // Thời gian chờ tối đa (được tính dựa trên cài đặt engine)
            this.isAnalyzing = false; // Trạng thái phân tích


            // Lắng nghe dữ liệu từ engine
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

            // Gọi các phương thức sau khi window.XiangqiGameAPI đã được khởi tạo
            this.updateBoardDisplay();
            this.renderBoardNumbers();
            this.renderPieces(this.offsetX, this.offsetY, this.scale);
            this.setupControls();
            this.updateMoveHistory();
        }
        async analyzeCurrentPosition() {
            try {
                // Hiển thị "Loading" trong bảng gợi ý
                this.suggestionsBody.innerHTML = '<tr><td colspan="8" style="text-align: center;">Loading...</td></tr>';
                this.isAnalyzing = true;

                // Lấy cài đặt engine hiện tại để xác định thời gian tối đa
                const engines = await window.XiangqiGameAPI.getEngines();
                const selectedEngine = engines[this.selectedEngineIndex] || { options: {} };
                const depth = selectedEngine.options?.depth || 20; // Mặc định depth = 20 nếu không có
                this.maxAnalysisTime = (depth * 1000) + 1000; // Thời gian tối đa = (depth * 1s) + 1s

                // Thiết lập timeout để kiểm tra nếu engine không phản hồi
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
            const moveResult = await window.XiangqiGameAPI.move(fromX, fromY, toX, toY);
            if (!moveResult) {
                console.warn(`Invalid move: (${fromX}, ${fromY}) to (${toX}, ${toY})`);
                return false;
            }

            // Lưu nước đi vào moveHistory
            const moveNotation = await window.XiangqiGameAPI.getMoveNotation(fromX, fromY, toX, toY);
            this.moveHistory.push(moveNotation);

            this.lastMovePositions = { fromX, fromY, toX, toY };
            await this.renderPieces(this.offsetX, this.offsetY, this.scale);
            await this.updateMoveHistory();

            return true;
        }



        async convertMoveToNotation(move) {
            if (!move || move.length !== 4) return move;
            const fromX = move.charCodeAt(0) - 97; // 'a' = 0, 'i' = 8
            const fromY = 9 - parseInt(move[1]);   // '0' = 9, '9' = 0 (đảo ngược cho cờ Tướng)
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
            this.engineProtocol = window.XiangqiGameAPI.getProtocol(); // Cập nhật giao thức
            // Đảm bảo data là chuỗi
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

                            // Lấy chuỗi PV và lọc các nước đi hợp lệ
                            pvMoves = parts.slice(pvIndex + 1);
                            pvMoves = pvMoves.filter(move => /^[a-i][0-9][a-i][0-9]$/.test(move)); // Chỉ giữ các nước đi có định dạng hợp lệ (ví dụ: h0g2)
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
                    // Khi nhận được bestmove, kết thúc phân tích
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
                    row.dataset.rowIndex = rowIndex; // Lưu chỉ số hàng để xác định PV
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

                    // Hover: Đánh dấu nước đi (giữ nguyên)
                    moveCell.addEventListener("mouseenter", async () => {
                        const [fromX, fromY, toX, toY] = this.parseUCIMove(s.move);
                        await this.highlightMove(fromX, fromY, toX, toY, "hover-move");
                    });
                    moveCell.addEventListener("mouseleave", () => {
                        this.clearHoverHighlights();
                    });

                    // Tạo các ký hiệu có thể nhấp trong cột Principal Variation
                    const pvCell = row.querySelector('.pv-cell');
                    const pvParts = pvNotation.split(', ');
                    pvParts.forEach((part, partIndex) => {
                        const movesInPart = part.split(' ').slice(1); // Bỏ số thứ tự (ví dụ: "1." -> ["P7+1", "N8+7"])
                        movesInPart.forEach((move, moveIndex) => {
                            if (move !== '...') {
                                const moveSpan = document.createElement('span');
                                moveSpan.textContent = move;
                                moveSpan.style.cursor = 'pointer';
                                moveSpan.style.marginRight = '5px';
                                moveSpan.style.textDecoration = 'underline';
                                moveSpan.dataset.step = (partIndex * 2 + moveIndex + 1).toString(); // Số bước từ đầu chuỗi
                                moveSpan.addEventListener('click', async () => {
                                    document.querySelectorAll('.highlighted-move').forEach(span => {
                                        span.classList.remove('highlighted-move');
                                    });

                                    // Thêm lớp highlighted-move cho ký hiệu vừa được nhấp
                                    moveSpan.classList.add('highlighted-move');
                                    // Gọi hàm simulateToStep để mô phỏng nước đi
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

            // Hiển thị nút Reset nếu đang mô phỏng
            if (this.currentPVIndex !== null) {
                this.showResetButton();
            }
        }

        async resetSimulation() {
            // Khôi phục trạng thái ban đầu từ FEN
            // if (this.originalFen) {
            //     await window.XiangqiGameAPI.importFen(this.originalFen);
            // }

            // Đặt lại trạng thái mô phỏng
            this.currentPVIndex = null;
            this.simulationStates = [];
            this.originalFen = null;
            this.lastSimulatedMove = null; // Xóa highlight của nước đi mô phỏng

            // Xóa lớp highlighted-move khỏi tất cả các ký hiệu trong cột PV
            document.querySelectorAll('.highlighted-move').forEach(span => {
                span.classList.remove('highlighted-move');
            });

            // Xóa nút Reset
            const controls = document.getElementById('simulation-controls');
            if (controls) {
                controls.remove();
            }

            // Cập nhật lại giao diện
            await this.renderPieces(this.offsetX, this.offsetY, this.scale);
            await this.updateMoveHistory();
        }

        async simulateToStep(rowIndex, pvMoves, step) {
            // Nếu nhấp vào một Principal Variation khác, xóa trạng thái hiện tại
            if (this.currentPVIndex !== rowIndex) {
                this.currentPVIndex = rowIndex;
                this.simulationStates = [];
                this.originalFen = null;
            }

            // Lấy FEN hiện tại của bàn cờ
            this.originalFen = await window.XiangqiGameAPI.getFen();

            // Kiểm tra chuỗi pvMoves
            if (!pvMoves || !Array.isArray(pvMoves) || pvMoves.length === 0 || step < 1 || step > pvMoves.length) {
                console.warn('Invalid pvMoves or step:', { pvMoves, step });
                return;
            }

            // Gọi simulatePV để mô phỏng đến bước được chỉ định
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

            // Xác định nước đi cuối cùng trong chuỗi mô phỏng (tương ứng với bước step)
            if (pvMoves && pvMoves.length >= step) {
                const lastMove = pvMoves[step - 1]; // Nước đi cuối cùng trong chuỗi (step bắt đầu từ 1)
                const [fromX, fromY, toX, toY] = this.parseUCIMove(lastMove);
                this.lastSimulatedMove = { fromX, fromY, toX, toY }; // Lưu nước đi vừa mô phỏng
            } else {
                this.lastSimulatedMove = null; // Nếu không có nước đi, đặt lại
            }

            // Hiển thị trạng thái bàn cờ tại bước cuối cùng
            const lastState = this.simulationStates[this.simulationStates.length - 1];
            this.renderSimulationStep(lastState); // Bỏ await vì renderSimulationStep không còn là async

            // Hiển thị nút Reset
            this.showResetButton();
        }

        async renderSimulationStep(state) {
            if (!state || !state.board) {
                console.warn('Invalid simulation state');
                return;
            }

            // Cập nhật bàn cờ với trạng thái mô phỏng
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
                        // Highlight nước đi vừa mô phỏng
                        if (this.lastSimulatedMove &&
                            ((x === this.lastSimulatedMove.fromX && y === this.lastSimulatedMove.fromY) ||
                                (x === this.lastSimulatedMove.toX && y === this.lastSimulatedMove.toY))) {
                            div.classList.add("last-move");
                        }
                        piecesContainer.appendChild(div);
                    }
                }
            }
            // Highlight vị trí trống của nước đi vừa mô phỏng (nếu có)
            if (this.lastSimulatedMove) {
                const { fromX, fromY, toX, toY } = this.lastSimulatedMove;
                if (!state.board[fromY][fromX]) { // Nếu vị trí "from" trống
                    this.highlightPosition(fromX, fromY, "last-move");
                }
                if (!state.board[toY][toX]) { // Nếu vị trí "to" trống
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

        // Hàm định dạng chuỗi PV giống Move History
        async formatPrincipalVariation(pvMoves) {
            if (!pvMoves || pvMoves.length === 0) return '-';

            const formattedMoves = [];
            let moveNumber = 1;
            let isRedTurn = true; // Đỏ đi trước

            // Lưu trạng thái hiện tại của bàn cờ
            const originalFen = await window.XiangqiGameAPI.getFen();

            // Mô phỏng từng nước đi trong chuỗi PV
            for (let i = 0; i < pvMoves.length; i++) {
                const move = pvMoves[i];
                const [fromX, fromY, toX, toY] = this.parseUCIMove(move);

                // Chuyển đổi nước đi thành ký hiệu cờ Tướng
                const notation = await window.XiangqiGameAPI.getMoveNotation(fromX, fromY, toX, toY);

                // Thực hiện nước đi trên bàn cờ chính (tạm thời)
                await window.XiangqiGameAPI.move(fromX, fromY, toX, toY);

                formattedMoves.push(notation);
                if (i % 2 === 1) {
                    moveNumber++;
                }
                isRedTurn = !isRedTurn;
            }

            // Khôi phục trạng thái ban đầu của bàn cờ
            await window.XiangqiGameAPI.importFen(originalFen);

            // Định dạng chuỗi PV
            const result = [];
            for (let i = 0; i < formattedMoves.length; i += 2) {
                const redMove = formattedMoves[i];
                const blackMove = formattedMoves[i + 1] || '...';
                result.push(`${i / 2 + 1}. ${redMove} ${blackMove}`);
            }

            return { moves: formattedMoves, formatted: result.join(', ') };
        }

        // Hàm hỗ trợ phân tích nước đi UCI (b2e2 -> tọa độ bàn cờ)
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
                <td>${evalData.move}</td> <!-- Đã được gán thành định dạng "R1+1" trong handleEngineOutput -->
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
                    const baseWidth = 8 * this.cellWidth + 70; // Khớp với canvas.style.width
                    const baseHeight = 9 * this.cellHeight + 70; // Khớp với canvas.style.height
                    boardImage.style.width = `${baseWidth * this.imageWidthScale}px`;
                    boardImage.style.height = `${baseHeight * this.imageHeightScale}px`;
                    boardImage.style.position = "absolute";
                    boardImage.style.top = "-4px";// Lên
                    boardImage.style.left = "-3px";//Xuống
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
            // Luôn gọi renderBoardNumbers để đảm bảo số thứ tự được vẽ lại
            this.renderBoardNumbers();
        }

        drawBoard() {
            if (!this.ctx || !this.canvas) {
                console.error("Cannot draw board: ctx or canvas is undefined");
                return;
            }

            const ctx = this.ctx;
            const canvas = this.canvas;

            // Xóa canvas
            ctx.clearRect(0, 0, canvas.width, canvas.height);

            // Đặt lề để căn giữa bàn cờ
            const marginX = 23;
            const marginY = 21;
            ctx.translate(marginX, marginY);

            // Đặt kiểu vẽ
            ctx.strokeStyle = "black";
            ctx.lineWidth = 1;

            // Vẽ các đường dọc (9 cột)
            for (let i = 0; i < 9; i++) {
                ctx.beginPath();
                if (i === 0 || i === 8) {
                    // Đường dọc đầy đủ cho cột 0 và 8
                    ctx.moveTo(i * this.cellWidth, 0);
                    ctx.lineTo(i * this.cellWidth, 9 * this.cellHeight);
                } else {
                    // Đường dọc bị ngắt ở giữa (hàng 4 và 5) để tạo sông
                    ctx.moveTo(i * this.cellWidth, 0);
                    ctx.lineTo(i * this.cellWidth, 4 * this.cellHeight);
                    ctx.moveTo(i * this.cellWidth, 5 * this.cellHeight);
                    ctx.lineTo(i * this.cellWidth, 9 * this.cellHeight);
                }
                ctx.stroke();
            }

            // Vẽ các đường ngang (10 hàng)
            for (let i = 0; i < 10; i++) {
                ctx.beginPath();
                ctx.moveTo(0, i * this.cellHeight);
                ctx.lineTo(8 * this.cellWidth, i * this.cellHeight);
                ctx.stroke();
            }

            // Vẽ đường chéo trong cung
            this.drawPalaceDiagonals();

            // Vẽ các điểm đánh dấu cho Tốt và Pháo
            this.drawPawnAndCannonDots();

            // Vẽ khu vực "sông" và chữ "楚 河 - 汉 界"
            ctx.font = "20px 'Noto Sans SC', Arial, sans-serif";
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillText("楚 河 - 汉 界", 4 * this.cellWidth, 4.5 * this.cellHeight);

            // Khôi phục tọa độ
            ctx.translate(-marginX, -marginY);
        }


        renderBoardNumbers() {
            const topNumbers = document.getElementById("top-numbers");
            const bottomNumbers = document.getElementById("bottom-numbers");
            topNumbers.innerHTML = "";
            bottomNumbers.innerHTML = "";

            // Giữ nguyên thứ tự các số, không đảo ngược khi isFlipped
            const labels1 = ["1", "2", "3", "4", "5", "6", "7", "8", "9"];
            const labels2 = ["9", "8", "7", "6", "5", "4", "3", "2", "1"];

            // Hiển thị số ở phía trên
            labels1.forEach(labels1 => {
                const span = document.createElement("span");
                span.textContent = labels1;
                span.style.display = "inline-block";
                span.style.width = `${this.cellWidth * this.numberSpacing}px`;
                span.style.textAlign = "center";
                topNumbers.appendChild(span);
            });

            // Hiển thị số ở phía dưới
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
                        const marginX = 23; // Phải khớp với marginX trong drawBoard
                        const marginY = 21; // Phải khớp với marginY trong drawBoard
                        const baseLeft = displayX * this.cellWidth * this.pieceSpacing + marginX;
                        const baseTop = displayY * this.cellHeight * this.pieceSpacing + marginY;
                        div.style.left = `${(baseLeft + offsetX)}px`;
                        div.style.top = `${(baseTop + offsetY)}px`;

                        div.style.transform = `scale(${scale})`;
                        div.style.transformOrigin = "center";

                        div.dataset.x = x;
                        div.dataset.y = y;
                        div.addEventListener("click", () => this.handlePieceClick(x, y));

                        // Đánh dấu nước đi cuối cùng
                        if (this.lastMovePositions &&
                            ((x === this.lastMovePositions.fromX && y === this.lastMovePositions.fromY) ||
                                (x === this.lastMovePositions.toX && y === this.lastMovePositions.toY))) {
                            div.classList.add("last-move");
                        }

                        piecesContainer.appendChild(div);
                    }
                }
            }
            // Đánh dấu vị trí trống của nước đi cuối cùng (nếu có)
            if (this.lastMovePositions) {
                const { fromX, fromY, toX, toY } = this.lastMovePositions;
                if (!await window.XiangqiGameAPI.getPiece(fromX, fromY)) {
                    this.highlightPosition(fromX, fromY, "last-move");
                }
            }
        }

        // Hàm hỗ trợ đánh dấu vị trí trống
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
                const marginX = 23; // Phải khớp với marginX trong drawBoard
                const marginY = 21; // Phải khớp với marginY trong drawBoard
                const baseLeft = displayX * this.cellWidth * this.pieceSpacing + marginX; // Sử dụng displayX
                const baseTop = displayY * this.cellHeight * this.pieceSpacing + marginY; // Sử dụng displayY
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
                        this.lastMovePositions = { fromX, fromY, toX: x, toY: y }; // Lưu nước đi cuối cùng
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
                        this.suggestionsBody.innerHTML = ''; // Xóa bảng gợi ý nước đi ngay sau khi di chuyển
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

            console.log('Updating move history with:', this.moveHistory); // Thêm log để kiểm tra

            moveList.innerHTML = ''; // Xóa bảng hiện tại

            let moveNumber = 1;
            for (let i = 0; i < this.moveHistory.length; i += 2) {
                const row = document.createElement('tr');
                const redMove = this.moveHistory[i] || '-';
                const blackMove = this.moveHistory[i + 1] || '-';
                row.innerHTML = `
                    <td>${moveNumber}</td>
                    <td>${redMove}</td>
                    <td>${blackMove}</td>
                `;
                moveList.appendChild(row);
                moveNumber++;
            }
        }
        // Hàm đánh dấu nước đi
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
        // Hàm xóa đánh dấu hover
        clearHoverHighlights() {
            document.querySelectorAll(".hover-move").forEach(el => el.classList.remove("hover-move"));
        }

        // Hàm chuyển bàn cờ về trạng thái sau nước đi (cơ bản)
        async goToMove(index) {
            await window.XiangqiGameAPI.resetToInitial(); // Đặt lại trạng thái ban đầu
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
                    console.log(`Edit button clicked for engine index ${index}`); // Thêm log để kiểm tra
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

            // Kiểm tra các phần tử
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

            // Điền thông tin hiện tại của engine vào form
            nameInput.value = engine.name;
            hashInput.value = engine.options?.hash || 128;
            multipvInput.value = engine.options?.multipv || 6;
            depthInput.value = engine.options?.depth || 20;
            threadsInput.value = engine.options?.threads || 1;
            skillLevelInput.value = engine.options?.skillLevel || 20;

            // Hiển thị modal với hiệu ứng fade-in
            modal.classList.add("show");
            overlay.classList.add("show");

            // Đóng modal khi nhấn vào overlay
            const closeModal = () => {
                modal.classList.remove("show");
                overlay.classList.remove("show");
                overlay.removeEventListener("click", closeModal); // Xóa sự kiện sau khi đóng
            };
            overlay.addEventListener("click", closeModal);

            // Xử lý khi submit form
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
                    closeModal(); // Đóng modal khi lưu thành công
                } else {
                    alert("Failed to update engine.");
                }
            };

            // Xử lý khi nhấn Cancel
            cancelBtn.onclick = () => {
                closeModal(); // Đóng modal khi nhấn Cancel
            };
        }

        setupControls() {
            const controlsBtn = document.getElementById("controls-btn");
            const controlsMenu = document.getElementById("controls-menu");
            // Nút Engine
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

            // Hiển thị/ẩn menu khi nhấp vào nút "Controls"
            controlsBtn.addEventListener("click", () => {
                controlsMenu.style.display = controlsMenu.style.display === "none" ? "block" : "none";
            });

            // Đóng menu khi nhấp ra ngoài
            document.addEventListener("click", (event) => {
                if (!controlsBtn.contains(event.target) && !controlsMenu.contains(event.target)) {
                    controlsMenu.style.display = "none";
                }
            });

            // Nút Undo
            const undoBtn = document.getElementById("undo-btn");
            undoBtn.addEventListener("click", async () => {
                const success = await window.XiangqiGameAPI.undo();
                if (success) {
                    this.clearHighlights();
                    this.selectedPiece = null;
                    await this.renderPieces(this.offsetX, this.offsetY, this.scale);
                    await this.updateMoveHistory();
                    controlsMenu.style.display = "none"; // Đóng menu
                }
            });

            // Nút Redo
            const redoBtn = document.getElementById("redo-btn");
            redoBtn.addEventListener("click", async () => {
                const success = await window.XiangqiGameAPI.redo();
                if (success) {
                    this.clearHighlights();
                    this.selectedPiece = null;
                    await this.renderPieces(this.offsetX, this.offsetY, this.scale);
                    await this.updateMoveHistory();
                    controlsMenu.style.display = "none"; // Đóng menu
                }
            });

            // Nút Reset to Initial
            const resetInitialBtn = document.getElementById("reset-initial-btn");
            resetInitialBtn.addEventListener("click", async () => {
                const success = await window.XiangqiGameAPI.resetToInitial();
                if (success) {
                    this.clearHighlights();
                    this.selectedPiece = null;
                    await this.renderPieces(this.offsetX, this.offsetY, this.scale);
                    await this.updateMoveHistory();
                    controlsMenu.style.display = "none"; // Đóng menu
                }
            });

            // Nút Reset Game
            const resetGameBtn = document.getElementById("reset-game-btn");
            resetGameBtn.addEventListener("click", async () => {
                const success = await window.XiangqiGameAPI.resetGame();
                if (success) {
                    this.clearHighlights();
                    this.selectedPiece = null;
                    this.moveHistory = []; // Đặt lại lịch sử nước đi
                    await this.renderPieces(this.offsetX, this.offsetY, this.scale);
                    await this.updateMoveHistory();
                    controlsMenu.style.display = "none"; // Đóng menu
                }
            });

            // Nút Export Game
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
                controlsMenu.style.display = "none"; // Đóng menu
            });

            // Nút Import Game
            const importGameBtn = document.getElementById("import-game-btn");
            const importGameFile = document.getElementById("import-game-file");
            importGameBtn.addEventListener("click", () => {
                importGameFile.click();
                controlsMenu.style.display = "none"; // Đóng menu ngay khi mở file picker
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
                        controlsMenu.style.display = "none"; // Đóng menu sau khi import
                    };
                    reader.readAsText(file);
                }
            });

            // Nút Flip Board
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
                controlsMenu.style.display = "none"; // Đóng menu
            });

            // Chọn loại bàn cờ (không nằm trong menu)
            const boardTypeSelect = document.getElementById("board-type");
            boardTypeSelect.addEventListener("change", () => {
                this.useImageBoard = boardTypeSelect.value === "image";
                this.updateBoardDisplay();
            });

            //Nút load cho bảng suggest
            const loadSuggestionsBtn = document.getElementById("load-suggestions-btn");
            if (loadSuggestionsBtn) {
                loadSuggestionsBtn.addEventListener("click", async () => {
                    this.suggestionsBody.innerHTML = ''; // Xóa bảng gợi ý trước khi tải lại
                    await this.analyzeCurrentPosition(); // Gửi bàn cờ hiện tại đến engine để phân tích lại
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