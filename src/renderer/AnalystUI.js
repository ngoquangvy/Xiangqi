import { BaseView } from './BaseView.js';

/**
 * ANALYST UI (AnalystUI)
 * ---------------------------------
 * Manages the presentation of engine analysis, move evaluation, and opening book data.
 * Optimized for performance with debounced rendering to prevent UI flicker.
 */
export class AnalystUI extends BaseView {
    constructor(uiManager) {
        super();
        this.ui = uiManager;
        this.suggestionsBody = document.getElementById('suggestions-body');
        this.evaluationBody = document.getElementById('evaluation-body');
        this.engineStatus = document.getElementById('engine-status');
        
        this.pendingSuggestions = new Map();
        this.pendingEvalSuggestions = new Map();
        this.updateTimer = null;
        this.evalUpdateTimer = null;
        this.lastEvalResult = null;
        this.notationCache = new Map(); 
        this.latestSuggestionRows = []; 
        this.lastFen = ''; 
    }

    /**
     * Cache dashboard element references lazily
     */
    _dash(id) {
        if (!this._dashCache) this._dashCache = {};
        if (!this._dashCache[id]) this._dashCache[id] = document.getElementById(id);
        return this._dashCache[id];
    }

    /**
     * UPDATE ENGINE STATUS ON UI
     */
    updateStatus(status) {
        if (!this.engineStatus) return;
        
        const capStatus = status.charAt(0).toUpperCase() + status.slice(1);
        this.engineStatus.textContent = capStatus;
        
        if (status === 'searching') this.engineStatus.style.color = '#2196f3';
        else if (status === 'idle') this.engineStatus.style.color = '#4caf50';
        else if (status === 'starting') this.engineStatus.style.color = '#ff9800';
        else this.engineStatus.style.color = '#5f6368';

        this._updateDashboardStatus(status, false);
    }

    updateEvalStatus(status) {
        this._updateDashboardStatus(status, true);
    }

    async updateDashboardEngineNames() {
        const engines = await this.api.getEngines();
        const currentIndex = await this.api.getSelectedEngineIndex();
        const mainEng = engines[currentIndex];
        const mainNameEl = this._dash('dash-main-enginename');
        if (mainNameEl && mainEng) mainNameEl.textContent = '(' + mainEng.name + ')';
        else if (mainNameEl) mainNameEl.textContent = '';

        const evalPath = this.ui.evalConfig ? this.ui.evalConfig.path : '';
        const evalEng = evalPath ? engines.find(e => e.path === evalPath) : engines[currentIndex];
        const evalNameEl = this._dash('dash-eval-enginename');
        if (evalNameEl && evalEng) evalNameEl.textContent = '(' + evalEng.name + ')';
        else if (evalNameEl) evalNameEl.textContent = '';
    }

    _updateDashboardStatus(status, isEval) {
        const prefix = isEval ? 'dash-eval' : 'dash-main';
        const el = this._dash(prefix + '-status');
        if (!el) return;
        el.textContent = status.charAt(0).toUpperCase() + status.slice(1);
        el.className = 'engine-card-status ' + status;
    }

    /**
     * FORMAT SCORE (Professional coloring)
     */
    formatScoreHtml(data) {
        const score = data.engine ? data.engine.score : (data.book ? 0 : 0);
        const color = score >= 0 ? '#4caf50' : '#f44336';
        const text = data.engine ? data.engine.note : (data.book ? 'Book' : '-');
        return `<span style="color: ${color}; font-weight: bold;">${text}</span>`;
    }

    /**
     * MERGE ENGINE AND BOOK DATA
     */
    mergeEngineAndBook(suggestions, bookCandidates) {
        const engineByMove = new Map(suggestions.map(s => [s.move, s]));
        const bookByMove = new Map(bookCandidates.map(b => [b.move, b]));

        const rows = [];
        // 1. Prioritize Engine moves
        for (const s of suggestions) {
            rows.push({ engine: s, book: bookByMove.get(s.move) || null });
        }
        // 2. Add moves only in Book (not yet explored by Engine)
        for (const b of bookCandidates) {
            if (!engineByMove.has(b.move)) {
                rows.push({ engine: null, book: b });
            }
        }
        return rows;
    }

    /**
     * UPDATE MAIN SUGGESTIONS TABLE (Optimized with DocumentFragment)
     */
    async updateSuggestionsTable(suggestions, bookCandidates) {
        if (!this.suggestionsBody) return;
        
        const currentFen = this.ui.currentFen;
        
        // 1. Clear notation cache if FEN changed (avoid translating based on old board positions)
        if (this.lastFen !== currentFen) {
            // console.log(`[AnalystUI] FEN changed. Clearing notation cache.`);
            this.notationCache.clear();
            this.lastFen = currentFen;
        }

        const rows = this.mergeEngineAndBook(suggestions, bookCandidates);
        this.latestSuggestionRows = rows; // Store for future reference
        
        // 2. Initial render (uses UCI if notation cache is empty)
        this.renderRows(rows);

        // 3. Collect ALL PVs to translate — engine PV, book PV, individual moves
        //    Each PV is passed as its own array so the backend resets board state
        //    between PVs, preventing cross-PV board contamination.
        const pvGroups = [];
        rows.forEach(r => {
            if (r.engine) {
                if (r.engine.pv && r.engine.pv.length > 0) {
                    pvGroups.push(r.engine.pv);
                } else if (r.engine.move) {
                    pvGroups.push([r.engine.move]);
                }
            }
            if (r.book) {
                if (r.book.pv && r.book.pv.length > 0) {
                    pvGroups.push(r.book.pv);
                } else if (r.book.move) {
                    pvGroups.push([r.book.move]);
                }
            }
        });

        // Filter out PVs that are already fully cached
        const pvGroupsToTranslate = pvGroups.filter(pv =>
            pv.some(m => m && !this.notationCache.has(m))
        );

        if (pvGroupsToTranslate.length > 0) {
            try {
                const map = await this.api.translatePVGroups(this.ui.currentFen, pvGroupsToTranslate);
                if (map && typeof map === 'object') {
                    Object.entries(map).forEach(([uci, notation]) => {
                        this.notationCache.set(uci, notation);
                    });
                }
                this.renderRows(rows);
            } catch (e) {
                console.warn('[AnalystUI] Error translating moves:', e);
            }
        }
    }

    renderRows(rows) {
        const fragment = document.createDocumentFragment();
        rows.forEach((rowData, rowIndex) => {
            const tr = this.createSuggestionRowSync(rowData, rowIndex);
            fragment.appendChild(tr);
        });
        this.suggestionsBody.innerHTML = '';
        this.suggestionsBody.appendChild(fragment);
    }

    /**
     * CREATE TABLE ROW (Synchronous version - uses cache)
     */
    createSuggestionRowSync(data, rowIndex) {
        const tr = document.createElement('tr');
        const moveUci = data.engine ? data.engine.move : data.book.move;
        
        let moveNotation = this.notationCache.get(moveUci);
        if (moveNotation) {
            // console.log(`[Debug] UI using cache for ${moveUci}: ${moveNotation}`);
        } else {
            moveNotation = moveUci; // Fallback to UCI
        }
        
        const scoreHtml = this.formatScoreHtml(data);
        const depth = data.engine ? data.engine.depth : '-';
        
        // Principal Variation (Engine)
        let pvTitle = '';
        let pvOutput = '-';
        if (data.engine && data.engine.pv) {
            pvTitle = data.engine.pv.map(m => this.notationCache.get(m) || '...').join(' ');
            pvOutput = data.engine.pv.map((m, idx) => {
                const note = this.notationCache.get(m) || '...';
                return `<span class="pv-step" data-step="${idx + 1}">${note}</span>`;
            }).join(' ');
        }

        // Book PV (Shows branch variations from book)
        let bookPvTitle = '';
        let bookPvOutput = '-';
        if (data.book) {
            if (data.book.pv && data.book.pv.length > 0) {
                bookPvTitle = data.book.pv.map(m => this.notationCache.get(m) || '...').join(' ');
                bookPvOutput = data.book.pv.map((m, idx) => {
                    const note = this.notationCache.get(m) || '...';
                    return `<span class="pv-step" data-step="${idx + 1}">${note}</span>`;
                }).join(' ');
            } else {
                const note = this.notationCache.get(data.book.move) || '...';
                bookPvTitle = note;
                bookPvOutput = `<span class="pv-step" data-step="1">${note}</span>`;
            }
        }
        
        const description = data.book ? (data.book.note || '') : '';
        
        tr.innerHTML = `
            <td>${rowIndex + 1}</td>
            <td class="move-notation" style="cursor: pointer; color: #2196f3; font-weight: bold;">${moveNotation}</td>
            <td>${scoreHtml}</td>
            <td>${depth}</td>
            <td class="pv-cell" title="${pvTitle}">${pvOutput}</td>
            <td class="book-cell" title="${bookPvTitle}">${bookPvOutput}</td>
            <td class="description-cell" contenteditable="true" style="font-size: 11px; color: #888; outline: none; border-bottom: 1px dashed transparent;">${description}</td>
        `;

        // Highlight cell on focus for editing
        const descCell = tr.querySelector('.description-cell');
        if (descCell) {
            descCell.onfocus = () => {
                descCell.style.borderBottomColor = '#2196f3';
                descCell.style.backgroundColor = '#fff9c4';
            };
            descCell.onblur = async () => {
                descCell.style.borderBottomColor = 'transparent';
                descCell.style.backgroundColor = 'transparent';
                const newNote = descCell.textContent.trim();
                if (newNote !== description) {
                    const success = await this.api.updateBookNote(this.ui.currentFen, moveUci, newNote);
                    if (success) {
                        this.showToast('Note saved');
                        if (data.book) data.book.note = newNote;
                    } else {
                        descCell.textContent = description; // Revert on error
                        console.error('Could not save note to book.');
                    }
                }
            };
            // Save on Enter
            descCell.onkeydown = (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    descCell.blur();
                }
            };
        }

        // On move click (Execute move)
        const notationCell = tr.querySelector('.move-notation');
        if (notationCell) {
            notationCell.onclick = async () => {
                if (this.ui.isSimulating) {
                    alert('Please reset the simulation before making a move.');
                    return;
                }
                const parts = this.ui.parseUCIMove(moveUci);
                if (parts) {
                    await this.ui.makeMove(parts.fx, parts.fy, parts.tx, parts.ty);
                }
            };
            
            notationCell.onmouseenter = () => {
                this.ui.cancelBestMovePreview();
                const parts = this.ui.parseUCIMove(moveUci);
                if (parts) {
                    this.ui.highlightMove(parts.fx, parts.fy, parts.tx, parts.ty, 'hover-move');
                }
            };
            notationCell.onmouseleave = () => this.ui.clearHighlights();
        }

        const pvCell = tr.querySelector('.pv-cell');
        if (pvCell && data.engine && data.engine.pv) {
            pvCell.querySelectorAll('.pv-step').forEach(span => {
                span.onclick = async (e) => {
                    e.stopPropagation();
                    this.currentSimCell = pvCell;
                    document.querySelectorAll('.pv-step, .book-step').forEach(el => el.classList.remove('active-sim'));
                    span.classList.add('active-sim');
                    const step = parseInt(span.getAttribute('data-step'), 10);
                    await this.ui.simulateToStep(data.engine.pv, step);
                };
            });
            pvCell.onclick = async () => {
                this.currentSimCell = pvCell;
                document.querySelectorAll('.pv-step, .book-step').forEach(el => el.classList.remove('active-sim'));
                const spans = pvCell.querySelectorAll('.pv-step');
                if (spans.length > 0) spans[spans.length - 1].classList.add('active-sim');
                await this.ui.simulateToStep(data.engine.pv, data.engine.pv.length);
            };
        }

        const bookCell = tr.querySelector('.book-cell');
        if (bookCell && data.book) {
            const bookPv = data.book.pv && data.book.pv.length > 0 ? data.book.pv : [data.book.move];
            bookCell.querySelectorAll('.pv-step').forEach(span => {
                span.onclick = async (e) => {
                    e.stopPropagation();
                    this.currentSimCell = bookCell;
                    document.querySelectorAll('.pv-step, .book-step').forEach(el => el.classList.remove('active-sim'));
                    span.classList.add('active-sim');
                    const step = parseInt(span.getAttribute('data-step'), 10);
                    await this.ui.simulateToStep(bookPv, step);
                };
            });
            bookCell.onclick = async () => {
                this.currentSimCell = bookCell;
                document.querySelectorAll('.pv-step, .book-step').forEach(el => el.classList.remove('active-sim'));
                const spans = bookCell.querySelectorAll('.pv-step');
                if (spans.length > 0) spans[spans.length - 1].classList.add('active-sim');
                await this.ui.simulateToStep(bookPv, bookPv.length);
            };
        }

        return tr;
    }

    /**
     * ENGINE OUTPUT HANDLER
     */
    handleEngineOutput(data, isEval = false) {
        if (!data || typeof data !== 'string') return;
        
        // Console log raw engine output for serious tracking
        // console.log(`[AnalystUI] Engine Raw Output (${isEval ? 'EVAL' : 'MAIN'}):`, data);
        
        const lines = data.split('\n');
        for (let line of lines) {
            line = line.trim();
            if (!line.startsWith('info')) {
                if (line.startsWith('bestmove')) this.onBestMoveReceived(isEval);
                continue;
            }

            // Extract info from 'info' line (score, pv, depth, multipv)
            const parts = line.split(' ');
            const scoreIdx = parts.indexOf('score');
            const pvIdx = parts.indexOf('pv');
            if (scoreIdx === -1 || (pvIdx === -1 && parts.indexOf('move') === -1)) continue;

            const depthIdx = parts.indexOf('depth');
            const multipvIdx = parts.indexOf('multipv');
            
            const depth = depthIdx !== -1 ? parts[depthIdx + 1] : '-';
            const rank = multipvIdx !== -1 ? parseInt(parts[multipvIdx + 1]) : 1;

            let scoreValue = 0;
            let note = '';
            
            if (parts[scoreIdx + 1] === 'cp' || parts[scoreIdx + 1] === 'mate') {
                const scoreType = parts[scoreIdx + 1];
                scoreValue = parseInt(parts[scoreIdx + 2]);
                note = scoreType === 'mate' ? `Mate ${scoreValue}` : (scoreValue/100).toFixed(2);
            }

            let pvPartsIdx = pvIdx !== -1 ? pvIdx + 1 : parts.indexOf('move') + 1;
            let pv = parts.slice(pvPartsIdx).filter(m => /^[a-i][0-9][a-i][0-9]$/.test(m));
            const move = pv[0];

            if (!move) continue;

            const suggestion = { move, score: scoreValue, depth, rank, pv, note };

            this.updateDashboard(parts, depth, scoreValue, note, isEval);

            if (isEval) {
                this.pendingEvalSuggestions.set(rank, suggestion);
                this.scheduleEvalUpdate();
            } else {
                this.pendingSuggestions.set(rank, suggestion);
                this.scheduleSuggestionsUpdate();
            }
        }
    }

    /**
     * UPDATE ENGINE DASHBOARD (below board)
     */
    updateDashboard(parts, currentDepth, scoreValue, note, isEval) {
        const prefix = isEval ? 'dash-eval' : 'dash-main';
        const depthEl = this._dash(prefix + '-depth');
        const nodesEl = this._dash(prefix + '-nodes');
        const npsEl = this._dash(prefix + '-nps');
        const timeEl = this._dash(prefix + '-time');
        const hashEl = this._dash(prefix + '-hash');
        const scoreEl = this._dash(prefix + '-score');

        if (depthEl && currentDepth !== '-') depthEl.textContent = currentDepth;

        const nodesIdx = parts.indexOf('nodes');
        const npsIdx = parts.indexOf('nps');
        const timeIdx = parts.indexOf('time');
        const hashIdx = parts.indexOf('hashfull');

        if (nodesEl && nodesIdx !== -1) nodesEl.textContent = parseInt(parts[nodesIdx + 1]).toLocaleString();
        if (npsEl && npsIdx !== -1) npsEl.textContent = parseInt(parts[npsIdx + 1]).toLocaleString();
        if (timeEl && timeIdx !== -1) {
            const timeMs = parseInt(parts[timeIdx + 1]);
            timeEl.textContent = (timeMs / 1000).toFixed(1) + 's';
        }
        if (hashEl && hashIdx !== -1) {
            const hashFull = parseInt(parts[hashIdx + 1]);
            hashEl.textContent = (hashFull / 10).toFixed(1) + '%';
        }
        if (scoreEl && note) {
            scoreEl.textContent = note;
            scoreEl.style.color = (note.startsWith('Mate') || parseFloat(note) >= 0) ? '#4caf50' : '#f44336';
        }
    }

    /**
     * DEBOUNCED UPDATE FOR EVAL TABLE (Prevents flicker)
     */
    scheduleEvalUpdate() {
        if (this.evalUpdateTimer) return;
        this.evalUpdateTimer = setTimeout(async () => {
            const suggestions = Array.from(this.pendingEvalSuggestions.values())
                                    .sort((a, b) => a.rank - b.rank);
            await this.updateEvaluationTable(suggestions);
            this.evalUpdateTimer = null;
        }, 300);
    }

    scheduleSuggestionsUpdate() {
        if (this.updateTimer) return;
        this.updateTimer = setTimeout(() => {
            const suggestions = Array.from(this.pendingSuggestions.values())
                                    .sort((a, b) => a.rank - b.rank);
            this.updateSuggestionsTable(suggestions, this.ui.currentBookCandidates || []);
            this.updateTimer = null;
        }, 500); // 500ms debounce for main table stability
    }

    onBestMoveReceived(isEval) {
        if (isEval) {
            const suggestions = Array.from(this.pendingEvalSuggestions.values()).sort((a,b) => a.rank - b.rank);
            this.updateEvaluationTable(suggestions);
        } else {
            const suggestions = Array.from(this.pendingSuggestions.values()).sort((a,b) => a.rank - b.rank);
            this.updateSuggestionsTable(suggestions, this.ui.currentBookCandidates || []);
        }
    }

    getTopSuggestion() {
        return this.pendingSuggestions.get(1) || null;
    }

    clearTables() {
        this.pendingSuggestions.clear();
        this.pendingEvalSuggestions.clear();
        this.notationCache.clear();
        this.lastEvalResult = null;
        if (this.updateTimer) { clearTimeout(this.updateTimer); this.updateTimer = null; }
        if (this.evalUpdateTimer) { clearTimeout(this.evalUpdateTimer); this.evalUpdateTimer = null; }
        if (this.suggestionsBody) this.suggestionsBody.innerHTML = '<tr><td colspan="7" style="text-align:center;">Analyzing...</td></tr>';
        if (this.evaluationBody) this.evaluationBody.innerHTML = '<tr><td colspan="6" style="text-align:center;">No data available...</td></tr>';
        
        // Reset Dashboard
        const dashMetrics = ['depth', 'nodes', 'nps', 'time', 'hash', 'score'];
        ['dash-main', 'dash-eval'].forEach(prefix => {
            dashMetrics.forEach(m => {
                const el = document.getElementById(prefix + '-' + m);
                if (el) el.textContent = '-';
            });
        });
    }

    async updateEvaluationTable(suggestions) {
        if (!this.evaluationBody || suggestions.length === 0) return;
        
        // 1. Collect each PV as an independent group for correct per-PV translation
        const pvGroups = suggestions
            .filter(s => s.pv && s.pv.length > 0)
            .map(s => s.pv);
        // Also add individual 'move' entries if not covered by pv
        suggestions.forEach(s => {
            if (s.move && (!s.pv || s.pv.length === 0)) pvGroups.push([s.move]);
        });
        
        const pvGroupsToTranslate = pvGroups.filter(pv => pv.some(m => m && !this.notationCache.has(m)));

        if (pvGroupsToTranslate.length > 0) {
            try {
                const map = await this.api.translatePVGroups(this.ui.currentFen, pvGroupsToTranslate);
                if (map && typeof map === 'object') {
                    Object.entries(map).forEach(([uci, notation]) => this.notationCache.set(uci, notation));
                }
            } catch (e) { console.warn('[AnalystUI] Error translating Eval PV:', e); }
        }

        // 2. Render table
        const fragment = document.createDocumentFragment();
        suggestions.forEach((suggestion, index) => {
            const tr = document.createElement('tr');
            const moveNotation = this.notationCache.get(suggestion.move) || suggestion.move;
            const color = suggestion.score >= 0 ? '#4caf50' : '#f44336';
            
            // Translated PV string
            const pvTitle = (suggestion.pv || []).map(m => this.notationCache.get(m) || '...').join(' ');
            const pvOutput = (suggestion.pv || []).map((m, idx) => {
                const note = this.notationCache.get(m) || '...';
                return `<span class="pv-step" data-step="${idx + 1}">${note}</span>`;
            }).join(' ');

            tr.innerHTML = `
                <td style="text-align: center; font-weight: bold;">${index + 1}</td>
                <td class="move-notation" style="cursor: pointer; color: #2196f3; font-weight: bold;">${moveNotation}</td>
                <td><span style="color: ${color}; font-weight: bold;">${suggestion.note}</span></td>
                <td>${suggestion.depth}</td>
                <td class="pv-cell" style="font-size: 11px; color: #666;" title="${pvTitle}">${pvOutput}</td>
            `;

            // Make move cell execute the move
            const notationCell = tr.querySelector('.move-notation');
            if (notationCell) {
                notationCell.onclick = async () => {
                    if (this.ui.isSimulating) {
                        alert('Please reset the simulation before making a move.');
                        return;
                    }
                    const parts = this.ui.parseUCIMove(suggestion.move);
                    if (parts) {
                        await this.ui.makeMove(parts.fx, parts.fy, parts.tx, parts.ty);
                    }
                };
            }

            // Make PV cell simulate the sequence
            const pvCell = tr.querySelector('.pv-cell');
            if (pvCell && suggestion.pv) {
                pvCell.querySelectorAll('.pv-step').forEach(span => {
                    span.onclick = async (e) => {
                        e.stopPropagation();
                        this.currentSimCell = pvCell;
                        document.querySelectorAll('.pv-step, .book-step').forEach(el => el.classList.remove('active-sim'));
                        span.classList.add('active-sim');
                        const step = parseInt(span.getAttribute('data-step'), 10);
                        await this.ui.simulateToStep(suggestion.pv, step);
                    };
                });
                pvCell.onclick = async () => {
                    this.currentSimCell = pvCell;
                    document.querySelectorAll('.pv-step, .book-step').forEach(el => el.classList.remove('active-sim'));
                    const spans = pvCell.querySelectorAll('.pv-step');
                    if (spans.length > 0) spans[spans.length - 1].classList.add('active-sim');
                    await this.ui.simulateToStep(suggestion.pv, suggestion.pv.length);
                };
            }

            fragment.appendChild(tr);
        });

        this.evaluationBody.innerHTML = '';
        this.evaluationBody.appendChild(fragment);
    }

    showToast(message) {
        let toast = document.getElementById('analyst-toast');
        if (!toast) {
            toast = document.createElement('div');
            toast.id = 'analyst-toast';
            toast.style = `
                position: fixed;
                bottom: 20px;
                right: 20px;
                background: #4caf50;
                color: white;
                padding: 10px 20px;
                border-radius: 4px;
                box-shadow: 0 2px 10px rgba(0,0,0,0.2);
                z-index: 10000;
                transition: opacity 0.3s ease;
                font-size: 13px;
            `;
            document.body.appendChild(toast);
        }
        toast.textContent = message;
        toast.style.opacity = '1';
        toast.style.display = 'block';

        setTimeout(() => {
            toast.style.opacity = '0';
            setTimeout(() => { toast.style.display = 'none'; }, 300);
        }, 2000);
    }

    setActiveSimStep(step) {
        if (!this.currentSimCell) return;
        document.querySelectorAll('.pv-step, .book-step').forEach(el => el.classList.remove('active-sim'));
        const nextSpan = this.currentSimCell.querySelector(`[data-step="${step}"]`);
        if (nextSpan) {
            nextSpan.classList.add('active-sim');
        }
    }
}
