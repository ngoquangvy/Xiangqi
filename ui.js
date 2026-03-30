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
            this.suggestionsStatus = document.getElementById('suggestions-status');
            this.suggestionStatusTimer = null;
            this.moveContextPanel = document.getElementById('move-context-panel');
            this.moveContextTitle = document.getElementById('move-context-title');
            this.moveContextClose = document.getElementById('move-context-close');
            this.moveNoteInput = document.getElementById('move-note-input');
            this.saveNoteBtn = document.getElementById('save-note-btn');
            this.moveVariationDisplay = document.getElementById('move-variation-display');
            this.liveVariationDisplay = document.getElementById('live-variation-display');
            this.recordVariationBtn = document.getElementById('record-variation-btn');
            this.variationControls = document.getElementById('variation-controls');
            this.commitVariationBtn = document.getElementById('commit-variation-btn');
            this.cancelVariationBtn = document.getElementById('cancel-variation-btn');

            // PV/Variation tracking for keyboard navigation
            this.currentPVData = {
                container: null,
                moves: [],
                activeIndex: -1,
                onClick: null
            };
            this.setupKeyboardNavigation();

            this.isRecordingVariation = false;
            this.recordedMoves = [];
            this.preRecordingHistory = [];
            this.preRecordingFen = null;
            this.cellWidth = 47;
            this.cellHeight = 48;
            this.pieceSpacing = 1.07;
            this.devicePixelRatio = window.devicePixelRatio || 1;
            this.useImageBoard = false;
            this.imageWidthScale = 1.02;
            this.imageHeightScale = 1.02;
            this.isFlipped = false;
            this.isRecordingVariation = false;
            this.recordedMoves = [];
            this.selectedMoveIndex = -1;
            this.lastMove = null;
            this.lastMoveRaw = null;
            this.lastMovePositions = null;
            this.selectedEngineIndex = 0;
            this.selectedBookPath = null;
            this.availableBooks = [];
            this.engineProtocol = window.XiangqiGameAPI.getProtocol();
            this.currentPVIndex = null;
            this.simulationStates = [];
            this.originalFen = null;
            this.lastMovePositions = null;
            this.lastSimulatedMove = null;
            this.moveHistory = [];
            this.pendingSuggestions = new Map(); // Buffer info lines until bestmove
            this.bookData = { positions: {} };
            this.currentFen = null;
            this.currentBookCandidates = [];
            this.latestSuggestionRows = [];
            this.isEvaluatingSpecificMove = false;
            window.XiangqiGameAPI.onEngineOutput((data) => {
                this.handleEngineOutput(data);
            });
            window.XiangqiGameAPI.onEngineReady(() => {
                this.analyzeCurrentPosition();
            });
            this.setupNoteEditor();
            window.addEventListener('engine-error', (event) => {
                const errorMessage = event.detail || 'Unknown engine error';
                alert(`Engine Error: ${errorMessage}`);
            });

            window.XiangqiGameAPI.on('engine-switched', (event, index) => {
                this.selectedEngineIndex = index;
                this.updateEngineList();
                alert(`Engine crashed. Switched to default engine: ${engines[index].name}`);
            });

            if (window.XiangqiGameAPI.on) {
                window.XiangqiGameAPI.on('menu-action', (event, action) => {
                    switch (action) {
                        case 'import-game': document.getElementById('import-game-btn').click(); break;
                        case 'export-game': document.getElementById('export-game-btn').click(); break;
                        case 'import-book': document.getElementById('import-book-btn').click(); break;
                        case 'undo': document.getElementById('undo-btn').click(); break;
                        case 'redo': document.getElementById('redo-btn').click(); break;
                        case 'reset-initial': document.getElementById('reset-initial-btn').click(); break;
                        case 'reset-game': document.getElementById('reset-game-btn').click(); break;
                        case 'flip-board': document.getElementById('flip-board-btn').click(); break;
                        case 'load-suggestions': document.getElementById('load-suggestions-btn').click(); break;
                        case 'open-engine-menu':
                            setTimeout(() => {
                                const engineMenu = document.getElementById('engine-menu');
                                if (engineMenu) {
                                    if (engineMenu.parentElement.id !== 'main-container' && engineMenu.parentElement !== document.body) {
                                        document.body.appendChild(engineMenu);
                                    }
                                    engineMenu.style.zIndex = "9999";
                                    engineMenu.style.top = "30%";
                                    engineMenu.style.left = "50%";
                                    engineMenu.style.transform = "translate(-50%, -50%)";
                                    engineMenu.style.boxShadow = "0px 10px 30px rgba(0,0,0,0.5)";
                                    engineMenu.style.padding = "20px";
                                    engineMenu.style.borderRadius = "8px";
                                    engineMenu.style.display = "block";
                                    this.updateEngineList();
                                }
                            }, 50);
                            break;
                        case 'open-book-menu':
                            setTimeout(() => {
                                const bookMenu = document.getElementById('book-menu');
                                if (bookMenu) {
                                    if (bookMenu.parentElement.id !== 'main-container' && bookMenu.parentElement !== document.body) {
                                        document.body.appendChild(bookMenu);
                                    }
                                    bookMenu.style.zIndex = "9999";
                                    bookMenu.style.top = "30%";
                                    bookMenu.style.left = "50%";
                                    bookMenu.style.transform = "translate(-50%, -50%)";
                                    bookMenu.style.boxShadow = "0px 10px 30px rgba(0,0,0,0.5)";
                                    bookMenu.style.padding = "20px";
                                    bookMenu.style.borderRadius = "8px";
                                    bookMenu.style.display = "block";
                                    this.updateBookList();
                                }
                            }, 50);
                            break;
                    }
                });
            }

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
            this.loadBookData();
        }
        async analyzeCurrentPosition() {
            if (this.isEvaluatingSpecificMove) return;

            try {
                // Giữ trạng thái thông báo đang xử lý
                this.clearHoverHighlights();
                this.setSuggestionLoading(true, 'Đang phân tích...');
                
                const fen = await window.XiangqiGameAPI.getFen();
                this.currentFen = fen;
                this.pendingSuggestions.clear();

                // --- BƯỚC 1: KIỂM TRA MÃ KHAI CUỘC (BOOK) TRƯỚC ---
                // Việc này diễn ra tức thì, không cần đợi Engine khởi động
                const bookCandidates = this.getBookCandidatesForFen(fen);
                this.currentBookCandidates = bookCandidates;

                if (bookCandidates.length > 0) {
                    // Nếu tìm thấy trong Book, cập nhật UI ngay lập tức
                    console.log(`[Book] Found ${bookCandidates.length} candidates for ${fen}`);
                    await this.updateSuggestionsTable([]); // Truyền mảng rỗng cho Engine vì Engine chưa có kết quả
                    this.setSuggestionLoading(true, 'Đã tìm thấy trong Book. Engine đang tính thêm...');
                } else {
                    // Nếu không có trong Book, xóa dữ liệu cũ để tránh nhầm lẫn
                    this.latestSuggestionRows = [];
                    if (this.suggestionsBody) {
                        this.suggestionsBody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding: 10px; color: #8A7355;">Đang phân tích vị trí...</td></tr>';
                    }
                }

                // --- BƯỚC 2: KÍCH HOẠT ENGINE CHẠY NGẦM ---
                // Engine sẽ gửi kết quả qua handleEngineOutput sau vài giây
                window.XiangqiGameAPI.analyzePosition(fen);
            } catch (err) {
                this.setSuggestionLoading(false, 'Phân tích thất bại');
                console.error('Error analyzing position:', err);
            }
        }

        setSuggestionLoading(isLoading, message = '') {
            // Suggestion loading UX policy:
            // - Keep existing rows visible while engine calculates.
            // - Show lightweight status text instead of clearing table immediately.
            // - Disable load button during active run to avoid request spam.
            const engineContainer = document.getElementById('engine-container');
            const loadBtn = document.getElementById('load-suggestions-btn');
            if (this.suggestionStatusTimer) {
                clearTimeout(this.suggestionStatusTimer);
                this.suggestionStatusTimer = null;
            }

            if (engineContainer) {
                engineContainer.classList.toggle('is-loading', !!isLoading);
            }
            if (loadBtn) {
                loadBtn.disabled = !!isLoading;
            }
            if (!this.suggestionsStatus) {
                return;
            }

            if (isLoading) {
                this.suggestionsStatus.textContent = message || 'Analyzing suggestions...';
                this.suggestionsStatus.classList.add('visible');
                return;
            }

            if (message) {
                this.suggestionsStatus.textContent = message;
                this.suggestionsStatus.classList.add('visible');
                this.suggestionStatusTimer = setTimeout(() => {
                    this.suggestionsStatus.classList.remove('visible');
                    this.suggestionsStatus.textContent = '';
                }, 1200);
                return;
            }

            this.suggestionsStatus.classList.remove('visible');
            this.suggestionsStatus.textContent = '';
        }

        async loadBookData() {
            try {
                const response = await fetch(`assets/books/opening-book.json?ts=${Date.now()}`);
                if (!response.ok) {
                    this.bookData = { positions: {} };
                    return;
                }
                const data = await response.json();
                this.bookData = data || { positions: {} };
            } catch (err) {
                this.bookData = { positions: {} };
            }
        }

        getBookCandidatesForFen(fen) {
            if (!fen || !this.bookData || !this.bookData.positions) {
                return [];
            }
            const list = this.bookData.positions[fen];
            if (!Array.isArray(list)) {
                return [];
            }
            return list.map(item => {
                const move = (item.move || '').trim();
                const pv = Array.isArray(item.pv) ? item.pv.filter(m => /^[a-i][0-9][a-i][0-9]$/.test(m)) : [];
                const score = typeof item.score === 'number' ? item.score : null;
                const note = typeof item.note === 'string' ? item.note.trim() : '';
                return { move, pv, score, note };
            }).filter(item => /^[a-i][0-9][a-i][0-9]$/.test(item.move));
        }

        formatEngineScore(score) {
            if (typeof score !== 'number' || Number.isNaN(score)) {
                return null;
            }
            const cp = score / 100;
            return `${cp >= 0 ? '+' : ''}${cp.toFixed(2)}E`;
        }

        formatBookScore(score) {
            if (typeof score !== 'number' || Number.isNaN(score)) {
                return null;
            }
            return `${score >= 0 ? '+' : ''}${score.toFixed(2)}B`;
        }

        formatNoteHtml(noteParts) {
            const parts = [];
            if (noteParts && noteParts.book) {
                parts.push(`<span class="note-book">${noteParts.book}</span>`);
            }
            if (noteParts && noteParts.engine) {
                if (parts.length > 0) {
                    parts.push('<span class="note-sep"> </span>');
                }
                parts.push(`<span class="note-engine">${noteParts.engine}</span>`);
            }
            return parts.length > 0 ? parts.join('') : '-';
        }


        escapeHtml(text) {
            return String(text)
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;')
                .replace(/'/g, '&#39;');
        }
        renderMoveSpans(cell, notations, onClick) {
            const shown = Array.isArray(notations) ? notations : [];
            cell.innerHTML = '';
            shown.forEach((notation, idx) => {
                const step = idx + 1;
                const moveSpan = document.createElement('span');
                moveSpan.textContent = notation;
                moveSpan.className = 'move-clickable-span';
                moveSpan.style.cursor = 'pointer';
                moveSpan.style.marginRight = '4px';
                moveSpan.style.padding = '2px';
                moveSpan.style.borderRadius = '3px';
                moveSpan.dataset.step = step.toString();

                if (this.currentPVData.container === cell && this.currentPVData.activeIndex === step) {
                    moveSpan.classList.add('highlighted-move');
                    setTimeout(() => {
                        const leftPadding = 20;
                        const targetLeft = Math.max(0, moveSpan.offsetLeft - leftPadding);
                        cell.scrollTo({ left: targetLeft, behavior: 'smooth' });
                    }, 0);
                }

                moveSpan.addEventListener('click', async () => {
                    this.currentPVData = { container: cell, moves: notations, activeIndex: step, onClick };
                    // Re-render to update highlights
                    this.renderMoveSpans(cell, notations, onClick);
                    await onClick(step);
                });
                cell.appendChild(moveSpan);
            });
        }

        setupKeyboardNavigation() {
            document.addEventListener('keydown', async (e) => {
                // Ignore if typing in a text area
                if (e.target.tagName === 'TEXTAREA' || e.target.tagName === 'INPUT') return;

                if (!this.currentPVData.container || this.currentPVData.moves.length === 0) return;

                if (e.key === 'ArrowRight') {
                    if (this.currentPVData.activeIndex < this.currentPVData.moves.length) {
                        this.currentPVData.activeIndex++;
                        this.renderMoveSpans(this.currentPVData.container, this.currentPVData.moves, this.currentPVData.onClick);
                        await this.currentPVData.onClick(this.currentPVData.activeIndex);
                        e.preventDefault();
                    }
                } else if (e.key === 'ArrowLeft') {
                    if (this.currentPVData.activeIndex > 1) {
                        this.currentPVData.activeIndex--;
                        this.renderMoveSpans(this.currentPVData.container, this.currentPVData.moves, this.currentPVData.onClick);
                        await this.currentPVData.onClick(this.currentPVData.activeIndex);
                        e.preventDefault();
                    }
                }
            });
        }

        toUCIMove(fromX, fromY, toX, toY) {
            const fileFrom = String.fromCharCode(97 + fromX);
            const rankFrom = 9 - fromY;
            const fileTo = String.fromCharCode(97 + toX);
            const rankTo = 9 - toY;
            return `${fileFrom}${rankFrom}${fileTo}${rankTo}`;
        }

        getSuggestedMoveSets() {
            const engineMoves = new Set();
            const bookMoves = new Set();

            if (Array.isArray(this.latestSuggestionRows)) {
                this.latestSuggestionRows.forEach(row => {
                    if (row && row.engine && row.engine.move) {
                        engineMoves.add(row.engine.move);
                    }
                    if (row && row.book && row.book.move) {
                        bookMoves.add(row.book.move);
                    }
                });
            }

            if (bookMoves.size === 0 && Array.isArray(this.currentBookCandidates)) {
                this.currentBookCandidates.forEach(item => {
                    if (item && item.move) {
                        bookMoves.add(item.move);
                    }
                });
            }

            return { engineMoves, bookMoves };
        }

        applySuggestionHighlightStyle(marker, hasEngine, hasBook) {
            marker.style.setProperty("opacity", "1", "important");
            marker.style.setProperty("border-radius", "50%", "important");
            marker.style.setProperty("box-sizing", "border-box", "important");

            if (hasEngine && hasBook) {
                marker.style.setProperty("background", "linear-gradient(135deg, rgba(38,117,59,0.5) 0%, rgba(38,117,59,0.5) 50%, rgba(36,82,184,0.5) 50%, rgba(36,82,184,0.5) 100%)", "important");
                marker.style.setProperty("border", "3px solid #ffcc00", "important");
                marker.style.setProperty("box-shadow", "0 0 10px rgba(255,204,0,0.8), inset 0 0 5px rgba(255,204,0,0.5)", "important");
                return;
            }
            if (hasEngine) {
                marker.style.setProperty("background", "radial-gradient(circle, rgba(36,82,184,0.5) 0%, rgba(36,82,184,0.1) 70%)", "important");
                marker.style.setProperty("border", "3px solid #2452b8", "important");
                marker.style.setProperty("box-shadow", "0 0 8px rgba(36,82,184,0.7)", "important");
                return;
            }
            if (hasBook) {
                marker.style.setProperty("background", "radial-gradient(circle, rgba(38,117,59,0.5) 0%, rgba(38,117,59,0.1) 70%)", "important");
                marker.style.setProperty("border", "3px solid #26753b", "important");
                marker.style.setProperty("box-shadow", "0 0 8px rgba(38,117,59,0.7)", "important");
                return;
            }
            // Normal legal move
            marker.style.setProperty("background", "radial-gradient(circle, rgba(212,160,23,0.5) 0%, rgba(212,160,23,0.1) 60%, transparent 70%)", "important");
            marker.style.setProperty("border", "2px dashed rgba(212,160,23,0.8)", "important");
            marker.style.setProperty("box-shadow", "0 0 5px rgba(212,160,23,0.4)", "important");
        }
        async makeMove(fromX, fromY, toX, toY) {
            const moveResult = await window.XiangqiGameAPI.move(fromX, fromY, toX, toY);
            if (!moveResult) {
                console.warn(`Invalid move: (${fromX}, ${fromY}) to (${toX}, ${toY})`);
                return false;
            }
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
                // console.warn('Engine output is not a string:', data);
                if (typeof data === 'object') {
                    data = JSON.stringify(data);
                } else {
                    return;
                }
            }
            const lines = data.split('\n');

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
                            let scoreValue = parseInt(parts[scoreIndex + 2]);
                            if (this.isEvaluatingSpecificMove) {
                                scoreValue = -scoreValue;
                            }

                            move = parts[pvIndex + 1];
                            if (this.isEvaluatingSpecificMove && this.evalSpecificMoveUci) {
                                move = this.evalSpecificMoveUci;
                            }

                            const rank = multipvIndex !== -1 ? parseInt(parts[multipvIndex + 1]) : 1;
                            if (scoreType === 'mate') {
                                note = this.isEvaluatingSpecificMove ? `Mate in ${-scoreValue}` : `Mate in ${scoreValue}`;
                            } else if (scoreType === 'cp') {
                                note = `${(scoreValue / 100).toFixed(2)} points`;
                            }
                            const depth = depthIndex !== -1 ? parseInt(parts[depthIndex + 1]) : '-';
                            const nodes = nodesIndex !== -1 ? parseInt(parts[nodesIndex + 1]) : '-';
                            const time = timeIndex !== -1 ? (parseInt(parts[timeIndex + 1]) / 1000).toFixed(2) : '-';
                            pvMoves = parts.slice(pvIndex + 1);
                            pvMoves = pvMoves.filter(m => /^[a-i][0-9][a-i][0-9]$/.test(m));
                            if (this.isEvaluatingSpecificMove && this.evalSpecificMoveUci) {
                                pvMoves = [this.evalSpecificMoveUci, ...pvMoves];
                            }
                            this.pendingSuggestions.set(rank, { move, score: scoreValue, rank, note, depth, nodes, time, pv: pvMoves });
                        }
                    } else if (this.engineProtocol === 'ucci' && (line.includes('pv') || line.includes('move'))) {
                        const pvIndex = parts.indexOf('pv');
                        const moveIndex = parts.indexOf('move');
                        if (scoreIndex !== -1 && (pvIndex !== -1 || moveIndex !== -1)) {
                            scoreValue = parseInt(parts[scoreIndex + 1]);
                            if (this.isEvaluatingSpecificMove) scoreValue = -scoreValue;

                            move = pvIndex !== -1 ? parts[pvIndex + 1] : parts[moveIndex + 1];
                            if (this.isEvaluatingSpecificMove && this.evalSpecificMoveUci) {
                                move = this.evalSpecificMoveUci;
                            }

                            note = `${scoreValue} points`;
                            const depth = depthIndex !== -1 ? parseInt(parts[depthIndex + 1]) : '-';
                            const nodes = nodesIndex !== -1 ? parseInt(parts[nodesIndex + 1]) : '-';
                            const time = timeIndex !== -1 ? (parseInt(parts[timeIndex + 1]) / 1000).toFixed(2) : '-';

                            if (pvIndex !== -1) {
                                pvMoves = parts.slice(pvIndex + 1);
                                pvMoves = pvMoves.filter(m => /^[a-i][0-9][a-i][0-9]$/.test(m));
                                if (this.isEvaluatingSpecificMove && this.evalSpecificMoveUci) {
                                    pvMoves = [this.evalSpecificMoveUci, ...pvMoves];
                                }
                            } else {
                                pvMoves = [move];
                            }

                            this.pendingSuggestions.set(1, { move, score: scoreValue, rank: 1, note, depth, nodes, time, pv: pvMoves });
                        }
                    }
                } else if (line.startsWith('bestmove')) {
                    const bestMoveMatch = line.trim().match(/^bestmove\s+([^\s]+)/);
                    const engineBestMove = bestMoveMatch && bestMoveMatch[1] !== '(none)' ? bestMoveMatch[1] : null;

                    const suggestions = Array.from(this.pendingSuggestions.values()).sort((a, b) => a.rank - b.rank);
                    if (this.isEvaluatingSpecificMove) {
                        if (suggestions.length > 0) {
                            this.updateEvaluationTable(suggestions[0]);
                        } else if (engineBestMove && this.evalSpecificMoveUci) {
                            // Synthesize an evaluation row for book hits
                            const fallbackEval = {
                                move: this.evalSpecificMoveUci,
                                score: 0,
                                rank: 1,
                                note: 'Book / Instant Reply',
                                depth: 'Book',
                                nodes: '-',
                                time: '-',
                                pv: [this.evalSpecificMoveUci, engineBestMove]
                            };
                            this.updateEvaluationTable(fallbackEval);
                        } else {
                            if (this.evaluationBody) this.evaluationBody.innerHTML = `<tr><td colspan="5" style="text-align:center;">PhÃ¢n tÃ­ch khÃ´ng kháº£ dá»¥ng</td></tr>`;
                        }
                        this.isEvaluatingSpecificMove = false;
                        this.analyzeCurrentPosition();
                    } else {
                        if (suggestions.length > 0) {
                            this.updateSuggestionsTable(suggestions);
                        } else {
                            this.setSuggestionLoading(false, 'No suggestion available');
                        }
                    }
                    this.pendingSuggestions.clear();
                }
            });
        }

        async evaluateSpecificMove(toX, toY) {
            if (!this.selectedPiece) return;
            const [fromX, fromY] = this.selectedPiece;
            const moveUci = this.toUCIMove(fromX, fromY, toX, toY);
            this.evalSpecificMoveUci = moveUci;
            const moveNotation = await this.convertMoveToNotation(moveUci);

            if (this.evaluationBody) {
                this.evaluationBody.innerHTML = `<tr><td colspan="5" style="text-align:center; padding: 10px; color: #8A7355;">Đang phân tích <b>${moveNotation}</b>...</td></tr>`;
            }

            this.isEvaluatingSpecificMove = true;
            this.pendingSuggestions.clear();

            if (window.XiangqiGameAPI && window.XiangqiGameAPI.evaluateMove) {
                window.XiangqiGameAPI.evaluateMove(this.currentFen, moveUci);
            } else {
                if (this.evaluationBody) this.evaluationBody.innerHTML = `<tr><td colspan="5">API \`evaluateMove\` chưa được hỗ trợ.</td></tr>`;
                this.isEvaluatingSpecificMove = false;
            }
        }

        async updateEvaluationTable(evalData) {
            if (!this.evaluationBody) return;
            const moveNotation = await this.convertMoveToNotation(evalData.move);
            this.evaluationBody.innerHTML = '';
            const row = document.createElement('tr');

            const enginePvMoves = Array.isArray(evalData.pv) ? evalData.pv : [];
            const enginePvResult = await window.XiangqiGameAPI.formatPV(this.currentFen, enginePvMoves);
            const enginePvNotations = Array.isArray(enginePvResult.moves) ? enginePvResult.moves : [];

            let formattedScore = '-';
            if (evalData.note && evalData.note.includes('Mate in')) {
                formattedScore = `<span style="color:#d4a017;font-weight:bold">${evalData.note}</span>`;
            } else {
                formattedScore = this.formatEngineScore(evalData.score) || '-';
            }

            row.innerHTML = `
                <td><strong>${moveNotation}</strong></td>
                <td class="eval-score">${formattedScore}</td>
                <td class="eval-depth">${evalData.depth || '-'}</td>
                <td class="pv-cell eval-pv"></td>
                <td class="note-cell eval-note">${evalData.note ? evalData.note : ''} ${evalData.nodes && evalData.nodes !== '-' ? '(N: ' + evalData.nodes + ')' : ''}</td>
            `;

            const pvCell = row.querySelector('.pv-cell');
            this.renderMoveSpans(pvCell, enginePvNotations, async (step) => {
                await this.simulateToStep(-1, enginePvMoves, step);
            });

            this.evaluationBody.appendChild(row);
        }

        async updateSuggestionsTable(suggestions) {
            // mergeEngineAndBook: Kết hợp dữ liệu từ Engine (suggestions) và Book (currentBookCandidates)
            this.clearHoverHighlights();
            const fragment = document.createDocumentFragment();

            const fen = this.currentFen || await window.XiangqiGameAPI.getFen();
            // Lấy lại book để đảm bảo dữ liệu mới nhất nếu suggestions trống
            const bookCandidates = (suggestions.length === 0) ? this.currentBookCandidates : this.getBookCandidatesForFen(fen);
            this.currentBookCandidates = bookCandidates;

            const engineByMove = new Map();
            suggestions.forEach(s => {
                if (s && s.move) {
                    engineByMove.set(s.move, s);
                }
            });

            const bookByMove = new Map();
            bookCandidates.forEach(b => {
                if (b && b.move) {
                    bookByMove.set(b.move, b);
                }
            });

            const rows = [];
            for (const s of suggestions) {
                if (!s || !s.move) {
                    continue;
                }
                rows.push({ engine: s, book: bookByMove.get(s.move) || null });
            }

            for (const b of bookCandidates) {
                if (!b || !b.move || engineByMove.has(b.move)) {
                    continue;
                }
                rows.push({ engine: null, book: b });
            }

            this.latestSuggestionRows = rows;

            for (const [rowIndex, rowData] of rows.entries()) {
                const engine = rowData.engine;
                const book = rowData.book;
                const primaryMove = engine ? engine.move : (book ? book.move : null);
                if (!primaryMove) {
                    continue;
                }

                const moveNotation = await this.convertMoveToNotation(primaryMove);
                const enginePvMoves = engine && Array.isArray(engine.pv) ? engine.pv : [];
                const bookPvMoves = book && Array.isArray(book.pv) ? book.pv : [];

                const enginePvResult = await this.formatPrincipalVariation(enginePvMoves);
                const enginePvNotations = Array.isArray(enginePvResult.moves) ? enginePvResult.moves : [];

                const bookMovesForRender = bookPvMoves.length > 0 ? bookPvMoves : [primaryMove];
                const bookPvResult = await this.formatPrincipalVariation(bookMovesForRender);
                const bookNotations = Array.isArray(bookPvResult.moves) ? bookPvResult.moves : [];

                const noteParts = {
                    book: this.formatBookScore(book ? book.score : null),
                    engine: this.formatEngineScore(engine ? engine.score : null)
                };
                const descriptionText = (book && typeof book.note === 'string' && book.note.trim()) ? book.note.trim() : '-';

                const row = document.createElement('tr');
                row.dataset.rowIndex = rowIndex;
                if (!engine && book) {
                    row.classList.add('row-book-only');
                }

                row.innerHTML = `
                    <td>${moveNotation} (${primaryMove})</td>
                    <td class="note-cell">${this.formatNoteHtml(noteParts)}</td>
                    <td>${engine ? engine.rank : '-'}</td>
                    <td>${engine ? engine.depth : '-'}</td>
                    <td class="pv-cell"></td>
                    <td class="book-cell"></td>
                    <td class="desc-cell" title="${this.escapeHtml(descriptionText)}">${this.escapeHtml(descriptionText)}</td>
                `;

                const moveCell = row.querySelector('td:first-child');
                moveCell.dataset.move = primaryMove;
                moveCell.addEventListener('mouseenter', async () => {
                    const [fromX, fromY, toX, toY] = this.parseUCIMove(primaryMove);
                    await this.highlightMove(fromX, fromY, toX, toY, 'hover-move');
                });
                moveCell.addEventListener('mouseleave', () => {
                    this.clearHoverHighlights();
                });
                moveCell.addEventListener('click', async () => {
                    // Play suggestion move as a real move (same flow as board interaction).
                    // Clicking Move cell commits an actual move (not preview):
                    // - updates board
                    // - updates move history
                    // - triggers re-analysis from new position
                    if (this.currentPVIndex !== null) {
                        alert('Please reset the simulation before interacting with the board.');
                        return;
                    }
                    const [fromX, fromY, toX, toY] = this.parseUCIMove(primaryMove);
                    const moved = await window.XiangqiGameAPI.move(fromX, fromY, toX, toY);
                    if (!moved) {
                        return;
                    }
                    this.lastMovePositions = { fromX, fromY, toX, toY };
                    this.clearHighlights();
                    this.selectedPiece = null;
                    await this.syncAfterStateChange({ clearSuggestions: false });
                });

                const pvCell = row.querySelector('.pv-cell');
                this.renderMoveSpans(pvCell, enginePvNotations, async (step) => {
                    await this.simulateToStep(rowIndex, enginePvMoves, step);
                });

                const bookCell = row.querySelector('.book-cell');
                this.renderMoveSpans(bookCell, bookNotations, async (step) => {
                    await this.simulateToStep(rowIndex, bookMovesForRender, step);
                });

                fragment.appendChild(row);
            }

            this.suggestionsBody.replaceChildren(fragment);
            this.setSuggestionLoading(false, suggestions.length > 0 ? `Updated ${suggestions.length} suggestions` : 'No suggestion available');
            if (this.currentPVIndex !== null) {
                this.showResetButton();
            }
        }
        async resetSimulation() {
            // if (this.originalFen) {
            //     await window.XiangqiGameAPI.importFen(this.originalFen);
            // }
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

        async simulateToStep(rowIndex, pvMoves, step, forcedFen = null) {
            if (this.currentPVIndex !== rowIndex) {
                this.currentPVIndex = rowIndex;
                this.simulationStates = [];
                this.originalFen = null;
            }
            this.originalFen = forcedFen || await window.XiangqiGameAPI.getFen();
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
                        const coords = this.getPiecePosition(displayX, displayY, this.offsetX, this.offsetY);
                        div.style.left = `${coords.left}px`;
                        div.style.top = `${coords.top}px`;

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
        async formatPrincipalVariation(pvMoves, forcedFen = null) {
            if (!pvMoves || pvMoves.length === 0) return { moves: [], formatted: '-' };

            const originalFen = forcedFen || await window.XiangqiGameAPI.getFen();
            if (window.XiangqiGameAPI.formatPV) {
                return await window.XiangqiGameAPI.formatPV(originalFen, pvMoves);
            }

            const formattedMoves = [];
            for (const move of pvMoves) {
                const [fromX, fromY, toX, toY] = this.parseUCIMove(move);
                const notation = await window.XiangqiGameAPI.getMoveNotation(fromX, fromY, toX, toY);
                await window.XiangqiGameAPI.move(fromX, fromY, toX, toY);
                formattedMoves.push(notation);
            }

            await window.XiangqiGameAPI.importFen(originalFen);

            const result = [];
            for (let i = 0; i < formattedMoves.length; i += 2) {
                const redMove = formattedMoves[i];
                const blackMove = formattedMoves[i + 1] || '...';
                result.push(`${i / 2 + 1}. ${redMove} ${blackMove}`);
            }

            return { moves: formattedMoves, formatted: result.join(', ') };
        }
        parseUCIMove(move) {
            const fromX = move.charCodeAt(0) - 97; // 'a' = 0, 'i' = 8
            const fromY = 9 - parseInt(move[1]);   // '0' = 9, '9' = 0
            const toX = move.charCodeAt(2) - 97;
            const toY = 9 - parseInt(move[3]);
            return [fromX, fromY, toX, toY];
        }


        updateBoardDisplay() {
            const boardImage = document.getElementById("board-image");

            if (this.useImageBoard) {
                this.cellWidth = 47;
                this.cellHeight = 48;
                this.pieceSpacing = 1.07;
                this.offsetX = -24;
                this.offsetY = -24;
                this.scale = 1.0;
                this.numberSpacing = 1.05;
            } else {
                this.cellWidth = 52;
                this.cellHeight = 52;
                this.pieceSpacing = 1.0;
                this.offsetX = -24;
                this.offsetY = -24;
                this.scale = 1.0;
                this.numberSpacing = 1.0;
            }

            if (this.canvas) {
                const logicalW = this.useImageBoard ? (8 * this.cellWidth + 40) : (8 * this.cellWidth + 56);
                const logicalH = this.useImageBoard ? (9 * this.cellHeight + 40) : (9 * this.cellHeight + 56);
                const cssW = this.useImageBoard ? (8 * this.cellWidth + 70) : logicalW;
                const cssH = this.useImageBoard ? (9 * this.cellHeight + 70) : logicalH;

                this.canvas.width = logicalW * this.devicePixelRatio;
                this.canvas.height = logicalH * this.devicePixelRatio;
                this.canvas.style.width = `${cssW}px`;
                this.canvas.style.height = `${cssH}px`;
                this.ctx.setTransform(1, 0, 0, 1, 0, 0);
                this.ctx.scale(this.devicePixelRatio, this.devicePixelRatio);
            }

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

            if (window.XiangqiGameAPI && piecesContainer.innerHTML !== "") {
                this.renderPieces(this.offsetX, this.offsetY, this.scale);
            }
        }

        drawBoard() {
            if (!this.ctx || !this.canvas) {
                console.error("Cannot draw board: ctx or canvas is undefined");
                return;
            }

            const ctx = this.ctx;
            const canvas = this.canvas;

            ctx.save();
            // Clear and apply high quality settings
            ctx.clearRect(0, 0, canvas.width, canvas.height);

            // Premium background: Wooden color with smooth gradient
            const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
            gradient.addColorStop(0, "#EED8A1");
            gradient.addColorStop(0.5, "#E4C381");
            gradient.addColorStop(1, "#D6AD64");

            // Add slight rounded corners to the board background visually if needed, 
            // or just fill rect. Since the HTML container is rectangular, fill uniformly.
            ctx.fillStyle = gradient;
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            const marginX = 28;
            const marginY = 28;

            ctx.translate(marginX, marginY);

            const boardColor = "#3D2517"; // Elegant dark ink color
            ctx.strokeStyle = boardColor;
            ctx.fillStyle = boardColor;

            // Draw shadow for the outer thin border to give it depth
            ctx.shadowColor = "rgba(0, 0, 0, 0.2)";
            ctx.shadowBlur = 4;
            ctx.shadowOffsetX = 2;
            ctx.shadowOffsetY = 2;

            // Outer thick frame + inner thin line
            ctx.lineWidth = 4;
            ctx.strokeRect(-6, -6, 8 * this.cellWidth + 12, 9 * this.cellHeight + 12);

            ctx.shadowColor = "transparent"; // Reset shadow for inner lines

            ctx.lineWidth = 1.5;
            ctx.strokeRect(0, 0, 8 * this.cellWidth, 9 * this.cellHeight);

            // Grid lines
            ctx.lineWidth = 1.2;
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

            // Draw River text using horizontal clear font
            ctx.save();
            ctx.font = "bold 32px 'Microsoft YaHei', 'PingFang SC', 'SimHei', sans-serif";
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillStyle = boardColor;

            // Single horizontal line across the river
            ctx.fillText("楚 河 - 汉 界", 4 * this.cellWidth, 4.5 * this.cellHeight);

            ctx.translate(-marginX, -marginY);
            ctx.restore();
        }


        // Optional rendering of margin numbers in the DOM - no change here, handled separately
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
            const ctx = this.ctx;
            ctx.strokeStyle = "#3D2517"; // Match board ink color
            ctx.lineWidth = 1.2;

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
            const ctx = this.ctx;

            // Helper function to draw the elegant L-shaped ticks 
            const drawCrossTick = (x, y, hasLeft, hasRight) => {
                const px = x * this.cellWidth;
                const py = y * this.cellHeight;
                ctx.strokeStyle = "#3D2517"; // Match board ink
                ctx.lineWidth = 1.5;
                const len = Math.min(this.cellWidth, this.cellHeight) * 0.15; // Length of the cross arm
                const gap = 4; // Gap from the intersection

                ctx.beginPath();
                if (hasLeft) {
                    // Top-Left quadrant
                    ctx.moveTo(px - gap, py - gap - len);
                    ctx.lineTo(px - gap, py - gap);
                    ctx.lineTo(px - gap - len, py - gap);

                    // Bottom-Left quadrant
                    ctx.moveTo(px - gap, py + gap + len);
                    ctx.lineTo(px - gap, py + gap);
                    ctx.lineTo(px - gap - len, py + gap);
                }
                if (hasRight) {
                    // Top-Right quadrant
                    ctx.moveTo(px + gap, py - gap - len);
                    ctx.lineTo(px + gap, py - gap);
                    ctx.lineTo(px + gap + len, py - gap);

                    // Bottom-Right quadrant
                    ctx.moveTo(px + gap, py + gap + len);
                    ctx.lineTo(px + gap, py + gap);
                    ctx.lineTo(px + gap + len, py + gap);
                }
                ctx.stroke();
            };

            const positions = [
                // format: [x, y, hasLeftMarks, hasRightMarks]
                [0, 3, false, true], [2, 3, true, true], [4, 3, true, true], [6, 3, true, true], [8, 3, true, false],
                [0, 6, false, true], [2, 6, true, true], [4, 6, true, true], [6, 6, true, true], [8, 6, true, false],
                [1, 2, true, true], [7, 2, true, true],
                [1, 7, true, true], [7, 7, true, true]
            ];

            positions.forEach(([x, y, l, r]) => {
                drawCrossTick(x, y, l, r);
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
                        const coords = this.getPiecePosition(displayX, displayY, offsetX, offsetY);
                        div.style.left = `${coords.left}px`;
                        div.style.top = `${coords.top}px`;

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
        getPiecePosition(displayX, displayY, customOffsetX, customOffsetY) {
            if (this.useImageBoard) {
                return {
                    left: displayX * this.cellWidth * this.pieceSpacing + 23 + customOffsetX,
                    top: displayY * this.cellHeight * this.pieceSpacing + 21 + customOffsetY
                };
            }
            return {
                left: displayX * this.cellWidth + 28 + customOffsetX,
                top: displayY * this.cellHeight + 28 + customOffsetY
            };
        }

        highlightPosition(x, y, className) {
            const marker = document.createElement("div");
            marker.className = `piece ${className}`;
            marker.dataset.overlay = className || 'overlay';

            marker.style.width = `${this.cellWidth}px`;
            marker.style.height = `${this.cellHeight}px`;
            marker.style.lineHeight = `${this.cellHeight}px`;
            marker.style.pointerEvents = "none";

            const displayX = this.isFlipped ? (8 - x) : x;
            const displayY = this.isFlipped ? (9 - y) : y;
            const coords = this.getPiecePosition(displayX, displayY, this.offsetX, this.offsetY);
            marker.style.left = `${coords.left}px`;
            marker.style.top = `${coords.top}px`;

            marker.style.transform = `scale(${this.scale})`;
            marker.style.transformOrigin = "center";

            piecesContainer.appendChild(marker);
        }

        async highlightMoves(x, y, offsetX = 0, offsetY = 0, scale = 1) {
            this.clearHighlights();
            const moves = await window.XiangqiGameAPI.getLegalMoves(x, y);
            const { engineMoves, bookMoves } = this.getSuggestedMoveSets();

            moves.forEach(([mx, my]) => {
                const marker = document.createElement("div");
                marker.className = "piece highlight";

                const moveUci = this.toUCIMove(x, y, mx, my);
                const hasEngine = engineMoves.has(moveUci);
                const hasBook = bookMoves.has(moveUci);
                this.applySuggestionHighlightStyle(marker, hasEngine, hasBook);

                marker.style.width = `${this.cellWidth}px`;
                marker.style.height = `${this.cellHeight}px`;
                marker.style.lineHeight = `${this.cellHeight}px`;

                const displayX = this.isFlipped ? (8 - mx) : mx;
                const displayY = this.isFlipped ? (9 - my) : my;
                const coords = this.getPiecePosition(displayX, displayY, offsetX, offsetY);
                marker.style.left = `${coords.left}px`;
                marker.style.top = `${coords.top}px`;

                marker.style.transform = `scale(${scale})`;
                marker.style.transformOrigin = "center";

                marker.addEventListener("click", () => this.handlePieceClick(mx, my));
                marker.addEventListener("contextmenu", (e) => {
                    e.preventDefault();
                    this.evaluateSpecificMove(mx, my);
                });
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
                    if (this.isRecordingVariation) {
                        const uci = this.toUCIMove(fromX, fromY, x, y);
                        const moved = await window.XiangqiGameAPI.move(fromX, fromY, x, y, true); // true for isAnalysis
                        if (moved) {
                            this.recordedMoves.push(uci);
                            this.lastMovePositions = { fromX, fromY, toX: x, toY: y };
                            this.clearHighlights();
                            this.selectedPiece = null;
                            await this.renderPieces(this.offsetX, this.offsetY, this.scale);

                            // Update live variation display
                            if (this.liveVariationDisplay) {
                                // Use the FEN before recording started as the base for formatting
                                const result = await this.formatPrincipalVariation(this.recordedMoves, this.preRecordingFen);
                                this.liveVariationDisplay.innerHTML = '';

                                // Add a Reset button for the live display
                                const resetBtn = document.createElement('button');
                                resetBtn.textContent = 'Reset Board';
                                resetBtn.style.fontSize = '10px';
                                resetBtn.style.padding = '2px 5px';
                                resetBtn.style.marginBottom = '5px';
                                resetBtn.style.cursor = 'pointer';

                                const onClickLive = async (step) => {
                                    await this.simulateToStep(-1, this.recordedMoves, step, this.preRecordingFen);
                                };

                                resetBtn.onclick = async () => {
                                    this.currentPVIndex = null;
                                    await this.syncAfterStateChange();
                                    this.renderMoveSpans(this.liveVariationDisplay, result.moves, onClickLive);
                                };
                                this.liveVariationDisplay.appendChild(resetBtn);
                                this.liveVariationDisplay.appendChild(document.createElement('br'));

                                this.renderMoveSpans(this.liveVariationDisplay, result.moves, onClickLive);
                            }
                        }
                        return;
                    }

                    const success = await window.XiangqiGameAPI.move(fromX, fromY, x, y);
                    if (success) {
                        this.lastMovePositions = { fromX, fromY, toX: x, toY: y };
                        await this.renderPieces(this.offsetX, this.offsetY, this.scale);
                        const moveHistory = await window.XiangqiGameAPI.getMoveHistory();
                        const lastMoveEntry = moveHistory[moveHistory.length - 1];
                        this.lastMove = lastMoveEntry ? lastMoveEntry.moveNotation : null; // "R1+1"
                        this.lastMoveRaw = `${String.fromCharCode(97 + fromX)}${10 - fromY}${String.fromCharCode(97 + x)}${10 - y}`; // "b2e2"
                        await this.updateMoveHistory();
                        await window.XiangqiGameAPI.isKingInCheck(currentTurn);
                        await this.checkForCheckmate();
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
            this.clearHoverHighlights();
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
            // Render history as clickable half-moves (red/black) for quick navigation.
            const moveList = document.getElementById('move-list');
            if (!moveList) {
                console.warn('Move list element not found');
                return;
            }

            const history = await window.XiangqiGameAPI.getMoveHistory();
            const currentIndex = await window.XiangqiGameAPI.getCurrentMoveIndex();
            this.moveHistory = history.map((move) => move.moveNotation || '-');

            moveList.innerHTML = '';

            let moveNumber = 1;
            for (let i = 0; i < this.moveHistory.length; i += 2) {
                // Each history list item represents one full turn (red + black half-moves).
                const item = document.createElement('li');
                item.className = 'move-row';

                const redIndex = i;
                const blackIndex = i + 1;
                const redMove = this.moveHistory[redIndex] || '-';
                const blackMove = this.moveHistory[blackIndex] || '-';

                const numberSpan = document.createElement('span');
                numberSpan.className = 'move-no';
                numberSpan.textContent = `${moveNumber}.`;

                const redSpan = document.createElement('span');
                redSpan.className = 'move-side move-red';
                redSpan.textContent = redMove;
                if (redMove !== '-') {
                    redSpan.classList.add('move-clickable');
                    if (redIndex === currentIndex) {
                        redSpan.classList.add('move-current');
                        redSpan.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
                    }
                    redSpan.addEventListener('click', async () => {
                        await this.goToMove(redIndex);
                        this.selectedMoveIndex = redIndex;
                        if (this.moveNoteInput) {
                            this.moveNoteInput.value = (history[redIndex] && history[redIndex].note) ? history[redIndex].note : "";
                        }
                    });

                    redSpan.addEventListener('contextmenu', (e) => {
                        e.preventDefault();
                        this.selectedMoveIndex = redIndex;
                        this.showMoveContextPanel(redIndex, history[redIndex]);
                    });

                    if (history[redIndex] && history[redIndex].note) {
                        redSpan.title = history[redIndex].note;
                        redSpan.innerHTML += ' <small>📝</small>';
                    }
                }

                const blackSpan = document.createElement('span');
                blackSpan.className = 'move-side move-black';
                blackSpan.textContent = blackMove;
                if (blackMove !== '-') {
                    blackSpan.classList.add('move-clickable');
                    if (blackIndex === currentIndex) {
                        blackSpan.classList.add('move-current');
                    }
                    blackSpan.addEventListener('click', async () => {
                        await this.goToMove(blackIndex);
                        this.selectedMoveIndex = blackIndex;
                        if (this.moveNoteInput) {
                            this.moveNoteInput.value = (history[blackIndex] && history[blackIndex].note) ? history[blackIndex].note : "";
                        }
                    });

                    blackSpan.addEventListener('contextmenu', (e) => {
                        e.preventDefault();
                        this.selectedMoveIndex = blackIndex;
                        this.showMoveContextPanel(blackIndex, history[blackIndex]);
                    });

                    if (history[blackIndex] && history[blackIndex].note) {
                        blackSpan.title = history[blackIndex].note;
                        blackSpan.innerHTML += ' <small>📝</small>';
                    }
                }

                item.appendChild(numberSpan);
                item.appendChild(redSpan);
                item.appendChild(blackSpan);
                moveList.appendChild(item);
                moveNumber++;
            }
        }

        async syncAfterStateChange(options = {}) {
            const reanalyze = options.reanalyze !== false;
            const clearSuggestions = options.clearSuggestions !== false;

            this.clearHighlights();
            this.selectedPiece = null;
            this.currentPVIndex = null;
            this.simulationStates = [];
            this.originalFen = null;
            this.lastSimulatedMove = null;

            const controls = document.getElementById('simulation-controls');
            if (controls) {
                controls.remove();
            }
            document.querySelectorAll('.highlighted-move').forEach(span => {
                span.classList.remove('highlighted-move');
            });

            const history = await window.XiangqiGameAPI.getMoveHistory();
            const currentIndex = await window.XiangqiGameAPI.getCurrentMoveIndex();
            const lastMoveEntry = currentIndex >= 0 && currentIndex < history.length ? history[currentIndex] : null;

            if (lastMoveEntry) {
                this.lastMovePositions = {
                    fromX: lastMoveEntry.fromX,
                    fromY: lastMoveEntry.fromY,
                    toX: lastMoveEntry.toX,
                    toY: lastMoveEntry.toY
                };
                this.lastMove = lastMoveEntry.moveNotation || null;
                this.lastMoveRaw = `${String.fromCharCode(97 + lastMoveEntry.fromX)}${10 - lastMoveEntry.fromY}${String.fromCharCode(97 + lastMoveEntry.toX)}${10 - lastMoveEntry.toY}`;
            } else {
                this.lastMovePositions = null;
                this.lastMove = null;
                this.lastMoveRaw = null;
            }

            await this.renderPieces(this.offsetX, this.offsetY, this.scale);
            await this.updateMoveHistory();

            if (clearSuggestions) {
                this.pendingSuggestions.clear();
                this.suggestionsBody.innerHTML = '';
            }

            if (reanalyze) {
                await this.analyzeCurrentPosition();
            }
        }
        // Ham danh dau nuoc di
        async highlightMove(fromX, fromY, toX, toY, className) {
            this.clearHoverHighlights();

            // Highlight source
            const fromPiece = await window.XiangqiGameAPI.getPiece(fromX, fromY);
            if (fromPiece) {
                const pieceDiv = piecesContainer.querySelector(`[data-x="${fromX}"][data-y="${fromY}"]`);
                if (pieceDiv) pieceDiv.classList.add(className);
            } else {
                this.highlightPosition(fromX, fromY, className);
            }

            // Highlight destination (Capture or empty square)
            const toPiece = await window.XiangqiGameAPI.getPiece(toX, toY);
            if (toPiece) {
                const pieceDiv = piecesContainer.querySelector(`[data-x="${toX}"][data-y="${toY}"]`);
                if (pieceDiv) pieceDiv.classList.add(className);
            } else {
                this.highlightPosition(toX, toY, className);
            }
        }
        clearHoverHighlights() {
            document.querySelectorAll(".hover-move").forEach(el => el.classList.remove("hover-move"));
            document.querySelectorAll('.piece[data-overlay="hover-move"]').forEach(el => el.remove());
        }
        async goToMove(index) {
            // Jump board state to the selected move index from history.
            const success = await window.XiangqiGameAPI.goToMove(index);
            if (!success) {
                return;
            }
            await this.syncAfterStateChange({ clearSuggestions: false });
        }

        async updateEngineList() {
            const engineList = document.getElementById("engine-list");
            engineList.innerHTML = "";
            this.selectedEngineIndex = await window.XiangqiGameAPI.getSelectedEngineIndex();
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
                    const engineMenu = document.getElementById("engine-menu");
                    if (engineMenu) {
                        engineMenu.style.display = "none";
                    }
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


        async updateBookList() {
            const bookSelect = document.getElementById("book-select");
            if (!bookSelect) {
                return;
            }

            const result = await window.XiangqiGameAPI.getBooks();
            if (!result || !result.success) {
                bookSelect.innerHTML = '';
                const opt = document.createElement('option');
                opt.textContent = 'Cannot load books';
                opt.value = '';
                bookSelect.appendChild(opt);
                return;
            }

            const books = Array.isArray(result.books) ? result.books : [];
            this.availableBooks = books;
            const active = books.find(b => b.isActive);
            this.selectedBookPath = active ? active.path : (books[0] ? books[0].path : null);

            bookSelect.innerHTML = '';
            books.forEach((book) => {
                const opt = document.createElement('option');
                opt.value = book.path;
                opt.textContent = book.isActive ? `${book.name} (active)` : book.name;
                opt.title = book.path;
                if (book.path === this.selectedBookPath) {
                    opt.selected = true;
                }
                bookSelect.appendChild(opt);
            });

            bookSelect.onchange = () => {
                this.selectedBookPath = bookSelect.value || null;
            };
        }

        async convertSelectedBook(language) {
            if (!this.selectedBookPath) {
                alert('No book selected.');
                return;
            }

            const result = await window.XiangqiGameAPI.convertBookLanguage(this.selectedBookPath, language);
            if (!result || !result.success) {
                alert(result?.error || 'Convert failed.');
                return;
            }

            alert(result.message || 'Book converted.');
            await this.updateBookList();
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

            const bookFileInput = document.getElementById("edit-engine-bookFile");
            const browseBookBtn = document.getElementById("browse-engine-book-btn");
            const clearBookBtn = document.getElementById("clear-engine-book-btn");

            if (!modal || !overlay || !form || !cancelBtn || !nameInput || !hashInput || !multipvInput || !depthInput || !threadsInput || !skillLevelInput || !bookFileInput) {
                console.error('One or more modal elements are missing');
                alert('Error: Modal elements are missing. Please check index.html.');
                return;
            }
            nameInput.value = engine.name;
            hashInput.value = engine.options?.hash || 128;
            multipvInput.value = engine.options?.multipv || 6;
            depthInput.value = engine.options?.depth || 20;
            threadsInput.value = engine.options?.threads || 1;
            skillLevelInput.value = engine.options?.skillLevel || 20;
            bookFileInput.value = engine.options?.bookFile || "";

            browseBookBtn.onclick = async () => {
                const res = await window.XiangqiGameAPI.browseEngineBook();
                if (res && res.success) {
                    bookFileInput.value = res.filePath;
                }
            };

            clearBookBtn.onclick = () => {
                bookFileInput.value = "";
            };

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
                        skillLevel: parseInt(skillLevelInput.value),
                        bookFile: bookFileInput.value || null
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

        showMoveContextPanel(index, moveData) {
            if (!this.moveContextPanel) return;
            this.moveContextPanel.style.display = 'block';
            const notation = moveData ? moveData.moveNotation : 'Unknown';
            this.moveContextTitle.textContent = `${notation} (${index % 2 === 0 ? 'Red' : 'Black'})`;
            this.moveNoteInput.value = moveData && moveData.note ? moveData.note : '';

            // Render saved variations
            if (this.moveVariationDisplay) {
                this.moveVariationDisplay.innerHTML = '';
                if (moveData && moveData.variation && moveData.variation.length > 0) {
                    window.XiangqiGameAPI.getFenAtIndex(index).then(fen => {
                        this.formatPrincipalVariation(moveData.variation, fen).then(result => {
                            // Add a Reset button for the variation display
                            const resetBtn = document.createElement('button');
                            resetBtn.textContent = 'Reset Board';
                            resetBtn.style.fontSize = '10px';
                            resetBtn.style.padding = '2px 5px';
                            resetBtn.style.marginBottom = '5px';
                            resetBtn.style.cursor = 'pointer';

                            const onClickVariation = async (step) => {
                                await this.simulateToStep(-1, moveData.variation, step, fen);
                            };

                            resetBtn.onclick = async () => {
                                this.currentPVIndex = null;
                                await this.syncAfterStateChange();
                                this.renderMoveSpans(this.moveVariationDisplay, result.moves, onClickVariation);
                            };
                            this.moveVariationDisplay.appendChild(resetBtn);
                            this.moveVariationDisplay.appendChild(document.createElement('br'));

                            this.renderMoveSpans(this.moveVariationDisplay, result.moves, onClickVariation);
                        });
                    }).catch(err => {
                        console.error("Error getting FEN for variation:", err);
                        this.moveVariationDisplay.textContent = 'Error loading variation';
                    });
                } else {
                    this.moveVariationDisplay.textContent = '-';
                }
            }

            this.updateRecordingUI();
        }

        setupNoteEditor() {
            if (this.moveContextClose) {
                this.moveContextClose.onclick = async () => {
                    this.moveContextPanel.style.display = 'none';
                    this.currentPVIndex = null;
                    if (this.isRecordingVariation) {
                        await this.cancelVariation();
                    } else {
                        // Just restore the board to the actual current game state
                        await this.syncAfterStateChange();
                    }
                };
            }
            if (this.saveNoteBtn) {
                this.saveNoteBtn.onclick = async () => {
                    if (this.selectedMoveIndex === -1) {
                        alert("Vui lòng chọn một nước đi trong lịch sử trước.");
                        return;
                    }
                    const note = this.moveNoteInput.value;
                    const success = await window.XiangqiGameAPI.updateMoveNote(this.selectedMoveIndex, note);
                    if (success) {
                        // Refresh the main move list to show/update the note badge
                        await this.updateMoveHistory();
                        // Re-fetch history to ensure we have the latest for the panel
                        const history = await window.XiangqiGameAPI.getMoveHistory();
                        this.showMoveContextPanel(this.selectedMoveIndex, history[this.selectedMoveIndex]);
                        alert("Đã lưu ghi chú.");
                    } else {
                        alert("Không thể lưu ghi chú.");
                    }
                };
            }

            if (this.recordVariationBtn) {
                this.recordVariationBtn.onclick = () => this.toggleRecordingMode();
            }

            if (this.commitVariationBtn) {
                this.commitVariationBtn.onclick = () => this.commitVariation();
            }

            if (this.cancelVariationBtn) {
                this.cancelVariationBtn.onclick = () => this.cancelVariation();
            }
        }

        async toggleRecordingMode() {
            if (this.selectedMoveIndex === -1) {
                alert("Vui lòng chọn một nước đi để bắt đầu record biến mới.");
                return;
            }

            if (!this.isRecordingVariation) {
                // START RECORDING
                this.isRecordingVariation = true;
                this.recordedMoves = [];
                // Save state to restore if cancelled
                this.preRecordingHistory = await window.XiangqiGameAPI.getMoveHistory();
                this.preRecordingFen = await window.XiangqiGameAPI.getFen();

                // Jump to the selected move index in the engine to start from there
                await window.XiangqiGameAPI.goToMove(this.selectedMoveIndex);
                await this.syncAfterStateChange({ reanalyze: true });

                if (this.liveVariationDisplay) this.liveVariationDisplay.textContent = '-';
            } else {
                // TOGGLE OFF (defaults to cancel if not explicitly committed)
                this.cancelVariation();
            }
            this.updateRecordingUI();
        }

        updateRecordingUI() {
            if (!this.variationControls) return;
            if (this.isRecordingVariation) {
                this.variationControls.style.display = 'block';
                this.recordVariationBtn.textContent = 'Stop Recording';
                this.recordVariationBtn.classList.add('recording-active');
                if (this.moveContextPanel) this.moveContextPanel.style.borderColor = '#ffa39e';
            } else {
                this.variationControls.style.display = 'none';
                this.recordVariationBtn.textContent = 'Record Var';
                this.recordVariationBtn.classList.remove('recording-active');
                if (this.moveContextPanel) this.moveContextPanel.style.borderColor = '#ffe58f';
                if (this.liveVariationDisplay) this.liveVariationDisplay.textContent = '-';
            }
        }

        async commitVariation() {
            if (!this.isRecordingVariation) return;
            if (this.recordedMoves.length === 0) {
                alert("Chưa có nước đi mới nào được ghi lại.");
                return;
            }

            const confirmCommit = confirm(`Lưu ${this.recordedMoves.length} nước đi mới vào Biến thế của nước đi này?`);
            if (!confirmCommit) return;

            // Save locally to the move instead of merging into main history
            await window.XiangqiGameAPI.updateMoveVariation(this.selectedMoveIndex, this.recordedMoves);

            this.isRecordingVariation = false;
            this.recordedMoves = [];

            // Refresh main list to show note badge if any
            await this.updateMoveHistory();

            // Refresh panel
            const history = await window.XiangqiGameAPI.getMoveHistory();
            this.showMoveContextPanel(this.selectedMoveIndex, history[this.selectedMoveIndex]);

            this.updateRecordingUI();
            alert("Đã lưu biến thế.");
        }

        async cancelVariation() {
            if (!this.isRecordingVariation) return;

            this.isRecordingVariation = false;
            this.recordedMoves = [];

            // Restore previous state
            if (this.preRecordingFen) {
                await window.XiangqiGameAPI.importFen(this.preRecordingFen);
                // We also need to restore the history. Currently, the API doesn't have a 'setHistory'.
                // But we can reset game and replay, or just jump back if the move() calls during recording
                // were made on a "forked" state. 
                // Since our move() calls were made on the singleton, we must undo them.
                const currentHistory = await window.XiangqiGameAPI.getMoveHistory();
                const movesToUndo = currentHistory.length - this.preRecordingHistory.length;
                for (let i = 0; i < movesToUndo; i++) {
                    await window.XiangqiGameAPI.undo();
                }
            }

            await this.syncAfterStateChange();
            this.updateRecordingUI();
        }

        setupControls() {
            const controlsBtn = document.getElementById("controls-btn");
            const controlsMenu = document.getElementById("controls-menu");
            const engineBtn = document.getElementById("engine-btn");
            const engineMenu = document.getElementById("engine-menu");
            const addEngineBtn = document.getElementById("add-engine-btn");
            const engineFileInput = document.getElementById("engine-file-input");
            const bookBtn = document.getElementById("book-btn");
            const bookMenu = document.getElementById("book-menu");
            const refreshBookBtn = document.getElementById("refresh-book-btn");
            const convertBookViBtn = document.getElementById("convert-book-vi-btn");
            const convertBookEnBtn = document.getElementById("convert-book-en-btn");
            const loadBookBtn = document.getElementById("load-book-btn");

            engineBtn.addEventListener("click", () => {
                engineMenu.style.display = engineMenu.style.display === "none" ? "block" : "none";
                this.updateEngineList();
            });

            if (bookBtn && bookMenu) {
                bookBtn.addEventListener("click", async () => {
                    bookMenu.style.display = bookMenu.style.display === "none" ? "block" : "none";
                    await this.updateBookList();
                });
            }

            const closeEngineBtn = document.getElementById("close-engine-menu");
            if (closeEngineBtn) {
                closeEngineBtn.addEventListener("click", () => {
                    engineMenu.style.display = "none";
                });
            }

            const closeBookBtn = document.getElementById("close-book-menu");
            if (closeBookBtn) {
                closeBookBtn.addEventListener("click", () => {
                    bookMenu.style.display = "none";
                });
            }

            if (refreshBookBtn) {
                refreshBookBtn.addEventListener("click", async () => {
                    await this.updateBookList();
                });
            }

            if (convertBookViBtn) {
                convertBookViBtn.addEventListener("click", async () => {
                    await this.convertSelectedBook('vi');
                });
            }

            if (convertBookEnBtn) {
                convertBookEnBtn.addEventListener("click", async () => {
                    await this.convertSelectedBook('en');
                });
            }
            if (loadBookBtn) {
                loadBookBtn.addEventListener("click", async () => {
                    if (!this.selectedBookPath) {
                        alert('No book selected.');
                        return;
                    }
                    const selected = await window.XiangqiGameAPI.selectBook(this.selectedBookPath);
                    if (selected && selected.success) {
                        await this.loadBookData();
                        await this.analyzeCurrentPosition();
                        await this.updateBookList();
                    } else {
                        alert(selected?.error || 'Failed to load selected book');
                    }
                });
            }

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
            const loadSuggestionsBtn = document.getElementById("load-suggestions-btn");
            if (loadSuggestionsBtn) {
                loadSuggestionsBtn.addEventListener("click", async () => {
                    await this.analyzeCurrentPosition();
                });
            }
            controlsBtn.addEventListener("click", () => {
                controlsMenu.style.display = controlsMenu.style.display === "none" ? "block" : "none";
            });
            document.addEventListener("click", (event) => {
                if (!controlsBtn.contains(event.target) && !controlsMenu.contains(event.target)) {
                    controlsMenu.style.display = "none";
                }
            });
            const undoBtn = document.getElementById("undo-btn");
            const redoBtn = document.getElementById("redo-btn");
            const resetInitialBtn = document.getElementById("reset-initial-btn");
            const resetGameBtn = document.getElementById("reset-game-btn");
            const flipBoardBtn = document.getElementById("flip-board-btn");

            // Shared action handlers are used by both on-screen buttons and top menu.
            // do* handlers centralize side-effects so behavior stays identical
            // regardless of trigger source (button click vs native menu action).
            const doUndo = async () => {
                const success = await window.XiangqiGameAPI.undo();
                if (success) {
                    await this.syncAfterStateChange();
                    controlsMenu.style.display = "none";
                }
            };
            const doRedo = async () => {
                const success = await window.XiangqiGameAPI.redo();
                if (success) {
                    await this.syncAfterStateChange();
                    controlsMenu.style.display = "none";
                }
            };
            const doResetInitial = async () => {
                const shouldReset = confirm("Back to start position? History is kept so you can Redo moves from move 1.");
                if (!shouldReset) {
                    return;
                }
                const success = await window.XiangqiGameAPI.resetToInitial();
                if (success) {
                    await this.syncAfterStateChange();
                    controlsMenu.style.display = "none";
                }
            };
            const doResetGame = async () => {
                const shouldReset = confirm("Reset whole game? Move history and current position will be lost.");
                if (!shouldReset) {
                    return;
                }
                const success = await window.XiangqiGameAPI.resetGame();
                if (success) {
                    this.moveHistory = [];
                    await this.syncAfterStateChange();
                    controlsMenu.style.display = "none";
                }
            };
            const doFlipBoard = async () => {
                this.isFlipped = !this.isFlipped;
                window.XiangqiGameAPI.setFlipped(this.isFlipped);
                this.updateBoardDisplay();
                await this.renderPieces(this.offsetX, this.offsetY, this.scale);
                if (this.selectedPiece) {
                    const [x, y] = this.selectedPiece;
                    await this.highlightMoves(x, y, this.offsetX, this.offsetY, this.scale);
                }
                controlsMenu.style.display = "none";
            };

            if (undoBtn) undoBtn.addEventListener("click", doUndo);
            if (redoBtn) redoBtn.addEventListener("click", doRedo);
            if (resetInitialBtn) resetInitialBtn.addEventListener("click", doResetInitial);
            if (resetGameBtn) resetGameBtn.addEventListener("click", doResetGame);
            if (flipBoardBtn) flipBoardBtn.addEventListener("click", doFlipBoard);

            window.XiangqiGameAPI.on('menu-action', async (_event, action) => {
                // menu-action channel is the cross-process bridge from main menu.
                switch (action) {
                    case 'undo':
                        await doUndo();
                        break;
                    case 'redo':
                        await doRedo();
                        break;
                    case 'reset-initial':
                        await doResetInitial();
                        break;
                    case 'reset-game':
                        await doResetGame();
                        break;
                    case 'flip-board':
                        await doFlipBoard();
                        break;
                    case 'load-suggestions':
                        loadSuggestionsBtn?.click();
                        break;
                    case 'import-game':
                        importGameBtn.click();
                        break;
                    case 'export-game':
                        exportGameBtn.click();
                        break;
                    case 'import-book':
                        importBookBtn?.click();
                        break;
                    case 'open-engine-menu':
                        engineBtn.click();
                        break;
                    case 'open-book-menu':
                        bookBtn?.click();
                        break;
                    default:
                        break;
                }
            });
            const boardTypeSelect = document.getElementById("board-type");
            boardTypeSelect.addEventListener("change", () => {
                this.useImageBoard = boardTypeSelect.value === "image";
                this.updateBoardDisplay();
            });
        }
    }

    window.addEventListener('DOMContentLoaded', () => {
        new XiangqiUI();
    });
})();











































