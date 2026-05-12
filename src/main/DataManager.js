const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');

/**
 * DATA MANAGER (DataManager)
 * --------------------------------
 * Acts as the application's librarian.
 * Responsible for file I/O, PGN parsing, FEN management, and Opening Books.
 */
class DataManager {
    constructor(userDataPath) {
        this.userDataPath = userDataPath;
        this.enginesFile = path.join(this.userDataPath, 'engines.json');
        this.engineSelectionFile = path.join(this.userDataPath, 'engine-selection.json');
        this.bookSelectionFile = path.join(this.userDataPath, 'book-selection.json');
        
        this.engines = [];
        this.selectedEnginePath = null;
        this.selectedBookPath = null;
        this.externalBooks = []; // External books
        this.currentBookPath = path.join(__dirname, '../../assets/books/opening-book.json');
    }

    /**
     * NORMALIZE ENGINE CONFIG (Giao lưu chuẩn hóa)
     * Ensures every engine record has a complete set of fields for authoritative applyConfig.
     * @param {object} eng - Raw or incomplete engine object
     * @returns {object} Normalized engine object
     */
    normalizeEngineConfig(eng) {
        if (!eng) return null;
        return {
            name:     eng.name     || 'Unnamed Engine',
            path:     eng.path     || '',
            protocol: eng.protocol || 'uci',
            hash:     parseInt(eng.hash)    || 128,
            threads:  parseInt(eng.threads) || 1,
            depth:    parseInt(eng.depth)   || 20,
            multiPV:  parseInt(eng.multiPV) || 3,
            bookFile: eng.bookFile || ''
        };
    }

    // --- ENGINE CONFIGURATION MANAGEMENT ---

    async loadEngines(defaultEngine) {
        try {
            if (fsSync.existsSync(this.enginesFile)) {
                const data = await fs.readFile(this.enginesFile, 'utf8');
                const rawEngines = JSON.parse(data.replace(/^\uFEFF/, ''));
                this.engines = rawEngines.map(e => this.normalizeEngineConfig(e));
            } else {
                this.engines = [this.normalizeEngineConfig(defaultEngine)];
                await this.saveEngines();
            }
        } catch (err) {
            this.engines = [this.normalizeEngineConfig(defaultEngine)];
        }
    }

    async saveEngines() {
        await fs.writeFile(this.enginesFile, JSON.stringify(this.engines, null, 2), 'utf8');
    }

    async loadSelectedEnginePath() {
        if (fsSync.existsSync(this.engineSelectionFile)) {
            try {
                const data = await fs.readFile(this.engineSelectionFile, 'utf8');
                const parsed = JSON.parse(data.replace(/^\uFEFF/, ''));
                this.selectedEnginePath = parsed.selectedEnginePath || null;
            } catch (e) { this.selectedEnginePath = null; }
        }
    }

    async saveSelectedEnginePath(path) {
        this.selectedEnginePath = path;
        await fs.writeFile(this.engineSelectionFile, JSON.stringify({ selectedEnginePath: path }, null, 2), 'utf8');
    }

    async updateEngineConfig(index, config) {
        if (this.engines[index]) {
            // Apply updates and re-normalize to ensure all fields are present
            this.engines[index] = this.normalizeEngineConfig({ ...this.engines[index], ...config });
            await this.saveEngines();
            return true;
        }
        return false;
    }

    async loadSelectedBookPath() {
        if (fsSync.existsSync(this.bookSelectionFile)) {
            try {
                const data = await fs.readFile(this.bookSelectionFile, 'utf8');
                const parsed = JSON.parse(data.replace(/^\uFEFF/, ''));
                this.selectedBookPath = parsed.selectedBookPath || null;
            } catch (e) { this.selectedBookPath = null; }
        }
    }

    async saveSelectedBookPath(path) {
        this.selectedBookPath = path;
        await fs.writeFile(this.bookSelectionFile, JSON.stringify({ selectedBookPath: path }, null, 2), 'utf8');
    }

    async addEngine(engine) {
        this.engines.push(this.normalizeEngineConfig(engine));
        await this.saveEngines();
    }

    async removeEngine(index) {
        if (this.engines[index]) {
            this.engines.splice(index, 1);
            await this.saveEngines();
            return true;
        }
        return false;
    }

    // --- PGN PROCESSING AND BOOK CONVERSION ---

    stripPgnNoise(raw) {
        if (!raw || typeof raw !== 'string') return '';
        let text = raw.replace(/^\uFEFF/, '');
        text = text.replace(/\[[^\]]*\]/g, ' '); 
        text = text.replace(/\{[^}]*\}/g, ' '); 
        text = text.replace(/;[^\n\r]*/g, ' '); 
        text = text.replace(/\(/g, ' ( ').replace(/\)/g, ' ) ');
        return text;
    }

    /**
     * Convert PGN Token (e.g., Cannon 2 move 5) to ICCS (h2e2)
     */
    parsePgnTokenToIccs(t, g, turn) {
        if (/^[a-i][0-9][a-i][0-9]$/i.test(t)) return t.toLowerCase();
        t = t.replace(/[+?!#x]/g, '');
        if (t.length < 2 || t.length > 4) return null;
        let dest = t.slice(-2);
        if (!/^[a-i][0-9]$/.test(dest)) return null;
        let toX = dest.charCodeAt(0) - 97;
        let toY = 9 - parseInt(dest[1], 10);
        let type = t.length > 2 ? t[0].toLowerCase() : 'p';
        let color = turn % 2 === 0 ? 'red' : 'black';
        
        // Piece name map for lookup
        let typeMap = color === 'red' 
            ? { 'h': '\u99ac', 'r': '\u8eca', 'c': '\u70ae', 'e': '\u76f8', 'a': '\u4ed5', 'k': '\u5e25', 'p': '\u5175' }
            : { 'h': '\u99ac', 'r': '\u8eca', 'c': '\u70ae', 'e': '\u8c61', 'a': '\u58eb', 'k': '\u5c07', 'p': '\u5352' };
        
        let pName = typeMap[type];
        if (!pName) return null;

        let fromFile = (t.length === 4 && /[a-i]/.test(t[1])) ? t[1].charCodeAt(0) - 97 : null;

        let found = null;
        for (let y = 0; y < 10; y++) {
            for (let x = 0; x < 9; x++) {
                let p = g.board[y][x];
                if (p && p.color === color && p.name === pName && (fromFile === null || x === fromFile)) {
                    let moves = g.getLegalMoves(x, y);
                    if (moves.some(m => m[0] === toX && m[1] === toY)) {
                        if (found) return null; // Duplicate piece found, ambiguous
                        found = { fx: x, fy: y };
                    }
                }
            }
        }
        return found ? (String.fromCharCode(97 + found.fx) + (9 - found.fy) + dest) : null;
    }

    extractIccsGamesFromPgn(raw, XiangqiGameClass) {
        const text = this.stripPgnNoise(raw);
        const tokens = text.split(/\s+/).filter(Boolean);
        const games = [];
        let current = [];
        let g = new XiangqiGameClass();
        g.setupInitialPosition();
        let turn = 0;
        let stateHistory = [{ fen: g.exportFen() }];
        const stack = [];

        for (const token of tokens) {
            if (token === '(') {
                if (current.length > 0) {
                    stack.push({
                        current: [...current],
                        stateHistory: [...stateHistory],
                        turn,
                        fen: g.exportFen()
                    });
                    const branchTurn = current.length - 1;
                    current = current.slice(0, branchTurn);
                    turn = branchTurn;
                    g.importFen(stateHistory[turn].fen);
                    stateHistory = stateHistory.slice(0, turn + 1);
                }
                continue;
            }
            if (token === ')') {
                if (current.length > 0) games.push([...current]);
                if (stack.length > 0) {
                    let restored = stack.pop();
                    current = restored.current;
                    stateHistory = restored.stateHistory;
                    turn = restored.turn;
                    g.importFen(restored.fen);
                }
                continue;
            }
            if (/^(1-0|0-1|1\/2-1\/2|\*)$/i.test(token)) {
                if (current.length > 0) games.push([...current]);
                current = [];
                g = new XiangqiGameClass();
                g.setupInitialPosition();
                turn = 0;
                stateHistory = [{ fen: g.exportFen() }];
                stack.length = 0;
                continue;
            }
            if (/^\d+\.(\.\.)?$/.test(token)) continue;

            const iccs = this.parsePgnTokenToIccs(token, g, turn);
            if (iccs) {
                current.push(iccs);
                const fx = iccs.charCodeAt(0) - 97;
                const fy = 9 - parseInt(iccs[1]);
                const tx = iccs.charCodeAt(2) - 97;
                const ty = 9 - parseInt(iccs[3]);
                g.move(fx, fy, tx, ty);
                turn++;
                stateHistory.push({ fen: g.exportFen() });
            }
        }
        if (current.length > 0) games.push(current);
        return games;
    }

    // --- OPENING BOOK MANAGEMENT (BOOK) ---

    async loadOpeningBook(customPath) {
        const bookPath = customPath || this.selectedBookPath || path.join(__dirname, '../../assets/books/opening-book.json');
        this.currentBookPath = bookPath;
        if (customPath) {
            console.log(`[DataManager] Loading custom book: ${bookPath}`);
            await this.saveSelectedBookPath(customPath);
        }
        try {
            if (fsSync.existsSync(bookPath)) {
                const ext = path.extname(bookPath).toLowerCase();
                if (ext !== '.json') {
                    console.warn(`[DataManager] WARNING: Runtime book loader currently supports JSON only. Skipping ${path.basename(bookPath)}.`);
                    this.openingBook = { positions: {} };
                    return false;
                }
                const data = await fs.readFile(bookPath, 'utf8');
                this.openingBook = JSON.parse(data.replace(/^\uFEFF/, ''));
                console.log(`[DataManager] SUCCESS: Opening book loaded from ${path.basename(bookPath)} (${Object.keys(this.openingBook.positions || {}).length} positions).`);
                return true;
            } else {
                console.warn(`[DataManager] WARNING: Book file not found at ${bookPath}`);
                this.openingBook = { positions: {} };
                return false;
            }
        } catch (err) {
            console.error(`[DataManager] ERROR loading book:`, err);
            this.openingBook = { positions: {} };
            return false;
        } finally {
            // Always load the external books list if not already cached
            const extBooksFile = path.join(this.userDataPath, 'external-books.json');
            if (fsSync.existsSync(extBooksFile)) {
                try {
                    const data = await fs.readFile(extBooksFile, 'utf8');
                    this.externalBooks = JSON.parse(data.replace(/^\uFEFF/, ''));
                } catch (e) {}
            }
        }
    }

    async addExternalBook(filePath) {
        if (!this.externalBooks.includes(filePath)) {
            this.externalBooks.push(filePath);
            const extBooksFile = path.join(this.userDataPath, 'external-books.json');
            await fs.writeFile(extBooksFile, JSON.stringify(this.externalBooks, null, 2), 'utf8');
        }
    }

    async getExternalBooks() {
        return this.externalBooks;
    }

    /**
     * GET MOVE CANDIDATES FROM BOOK BASED ON FEN
     * Returns an array of { move, count, pv, score, note } objects
     */
    getBookCandidates(fen) {
        if (!this.openingBook || !this.openingBook.positions) {
            console.warn('[DataManager] getBookCandidates: Book not initialized.');
            return [];
        }
        const entry = this.openingBook.positions[fen];
        if (!entry) {
            // console.log(`[DataManager] No candidates for FEN: ${fen}`);
            return [];
        }
        
        // console.log(`[DataManager] Found ${Array.isArray(entry) ? entry.length : Object.keys(entry).length} candidates for current position.`);
        
        // If already an array (normalized), return directly
        if (Array.isArray(entry)) return entry;

        // If an object (raw data), convert to array
        return Object.entries(entry).map(([uci, data]) => ({
            move: uci,
            count: data.count || 0,
            pv: data.pv || [],
            score: data.score || 0,
            note: data.note || ''
        }));
    }

    /**
     * UPDATE NOTE FOR A MOVE IN THE BOOK
     */
    async updateBookNote(fen, move, note) {
        if (!this.openingBook || !this.openingBook.positions || !this.openingBook.positions[fen]) return false;
        
        let found = false;
        const entry = this.openingBook.positions[fen];

        if (Array.isArray(entry)) {
            const m = entry.find(i => i.move === move);
            if (m) {
                m.note = note;
                found = true;
            }
        } else if (entry[move]) {
            entry[move].note = note;
            found = true;
        }

        if (found) {
            await fs.writeFile(this.currentBookPath, JSON.stringify(this.openingBook, null, 2), 'utf8');
            return true;
        }
        return false;
    }

    convertPgnToOpeningBook(rawPgn, XiangqiGameClass, options = {}) {
        const maxPly = options.maxPly || 24;
        const games = this.extractIccsGamesFromPgn(rawPgn, XiangqiGameClass);
        const positions = {};

        for (const gameMoves of games) {
            const sim = new XiangqiGameClass();
            for (let ply = 0; ply < Math.min(maxPly, gameMoves.length); ply++) {
                const fen = sim.exportFen();
                const uci = gameMoves[ply];
                if (!positions[fen]) positions[fen] = {};
                if (!positions[fen][uci]) positions[fen][uci] = { count: 0, pv: gameMoves.slice(ply, ply + 6) };
                positions[fen][uci].count++;
                
                const fx = uci.charCodeAt(0) - 97;
                const fy = 9 - parseInt(uci[1]);
                const tx = uci.charCodeAt(2) - 97;
                const ty = 9 - parseInt(uci[3]);
                if (!sim.move(fx, fy, tx, ty)) break;
            }
        }

        const normalized = {};
        for (const fen in positions) {
            const moves = Object.entries(positions[fen]).sort((a, b) => b[1].count - a[1].count).slice(0, 10);
            const max = moves[0][1].count;
            normalized[fen] = moves.map(([move, data]) => ({
                move, score: Number((data.count / max).toFixed(2)), note: `PGN freq ${data.count}`, pv: data.pv
            }));
        }
        return { 
            book: { meta: { name: 'PGN Converted', generatedAt: new Date().toISOString() }, positions: normalized },
            stats: { positions: Object.keys(normalized).length }
        };
    }
}

module.exports = DataManager;
