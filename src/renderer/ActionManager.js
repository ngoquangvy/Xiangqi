import { BaseView } from './BaseView.js';

/**
 * ACTION MANAGER (ActionManager)
 * -----------------------------------
 * Orchestrates UI interactions and binds events to top bar menus, panels, and modals.
 */
export class ActionManager extends BaseView {
    constructor(uiManager) {
        super();
        this.ui = uiManager;
    }

    init() {
        console.log('ActionManager: Initializing UI listeners...');
        this.setupTopMenus();
        this.setupBoardActions();
        this.setupEngineControls();
        this.setupEvalControls();
        this.setupBookControls();
        this.setupModals();
        this.setupElectronMenu();
        
        // Populate engine lists on startup
        this.renderEngineList();
    }

    /**
     * 1. TOP BAR MENU SETUP (File, Edit, Tool, Help)
     */
    setupTopMenus() {
        const menus = [
            { btn: 'file-btn', menu: 'file-menu' },
            { btn: 'edit-btn', menu: 'edit-menu' },
            { btn: 'tool-btn', menu: 'tool-menu' },
            { btn: 'help-btn', menu: 'help-menu' }
        ];

        menus.forEach(item => {
            const btn = document.getElementById(item.btn);
            const menu = document.getElementById(item.menu);
            if (btn && menu) {
                btn.onclick = (e) => {
                    e.stopPropagation();
                    const isHidden = menu.style.display !== 'block';
                    menus.forEach(m => {
                        const otherMenu = document.getElementById(m.menu);
                        if (otherMenu) otherMenu.style.display = 'none';
                    });
                    menu.style.display = isHidden ? 'block' : 'none';
                };
            }
        });

        document.addEventListener('click', () => {
            menus.forEach(m => {
                const menu = document.getElementById(m.menu);
                if (menu) menu.style.display = 'none';
            });
        });

        const engineBtn = document.getElementById('engine-btn');
        if (engineBtn) {
            engineBtn.onclick = () => {
                const panel = document.getElementById('engine-menu');
                if (panel) panel.style.display = 'block';
                this.renderEngineList();
            };
        }

        const bookBtn = document.getElementById('book-btn');
        if (bookBtn) {
            bookBtn.onclick = () => {
                const panel = document.getElementById('book-menu');
                if (panel) panel.style.display = 'block';
                this.loadBookList();
            };
        }

        const undoBtnTop = document.getElementById('undo-btn-top');
        if (undoBtnTop) undoBtnTop.onclick = () => this.ui.undo();

        const redoBtnTop = document.getElementById('redo-btn-top');
        if (redoBtnTop) redoBtnTop.onclick = () => this.ui.redo();

        const resetBtnTop = document.getElementById('reset-initial-btn-top');
        if (resetBtnTop) {
            resetBtnTop.onclick = async () => {
                await this.api.resetToInitial();
                await this.ui.syncState();
            };
        }

        const exitBtn = document.getElementById('exit-btn');
        if (exitBtn) {
            exitBtn.onclick = () => this.api.exitApp();
        }

        const aboutBtn = document.getElementById('about-btn');
        if (aboutBtn) {
            aboutBtn.onclick = () => alert('Xiangqi Analyst Tool v2.0');
        }

        ['close-engine-menu', 'close-book-menu'].forEach(id => {
            const btn = document.getElementById(id);
            if (btn) {
                btn.onclick = () => {
                    const panel = btn.closest('.floating-panel');
                    if (panel) panel.style.display = 'none';
                };
            }
        });
    }

    /**
     * 2. BOARD ACTION BUTTONS (Undo, Redo, Reset, Flip)
     */
    setupBoardActions() {
        const studyToggle = document.getElementById('study-mode-toggle');
        if (studyToggle) {
            studyToggle.addEventListener('change', (e) => {
                this.ui.setStudyMode(e.target.checked);
            });
        }

        const actions = {
            'undo-btn': () => this.ui.undo(),
            'redo-btn': () => this.ui.redo(),
            'reset-initial-btn': async () => {
                await this.api.resetToInitial();
                await this.ui.syncState();
            },
            'reset-game-btn': async () => {
                if (confirm('Start a new game?')) {
                    await this.api.resetGame();
                    await this.ui.syncState();
                }
            },
            'flip-board-btn': () => {
                this.ui.boardRenderer.isFlipped = !this.ui.boardRenderer.isFlipped;
                this.api.setFlipped(this.ui.boardRenderer.isFlipped);
                this.ui.syncState();
            }
        };

        Object.entries(actions).forEach(([id, fn]) => {
            const btn = document.getElementById(id);
            if (btn) btn.onclick = fn;
        });

        const boardSelect = document.getElementById('board-type');
        if (boardSelect) {
            boardSelect.onchange = (e) => {
                const isImage = e.target.value === 'image';
                document.getElementById('boardCanvas').style.display = isImage ? 'none' : 'block';
                document.getElementById('board-image').style.display = isImage ? 'block' : 'none';
                this.ui.syncState();
            };
        }
    }

    /**
     * 3. MAIN ENGINE CONTROLS
     */
    setupEngineControls() {
        const loadBtn = document.getElementById('load-suggestions-btn');
        if (loadBtn) loadBtn.onclick = () => this.ui.syncState();

        const controlBtn = document.getElementById('engine-control-btn');
        if (controlBtn) {
            controlBtn.onclick = () => {
                const newState = !this.ui.isEnginePaused;
                this.ui.setEnginePause(newState);
            };
        }

        const addBtn = document.getElementById('add-engine-btn');
        if (addBtn) {
            addBtn.onclick = async () => {
                const path = await this.api.browseFile([{ name: 'Executables', extensions: ['exe'] }]);
                if (path) {
                    await this.api.addEngine(path);
                    this.renderEngineList();
                }
            };
        }

        // --- ENGINE EDIT MODAL LOGIC ---
        const modal = document.getElementById('edit-engine-modal');
        const form = document.getElementById('edit-engine-form');
        const cancelBtn = document.getElementById('cancel-edit-engine');
        const browseBookBtn = document.getElementById('browse-engine-book-btn');
        const clearBookBtn = document.getElementById('clear-engine-book-btn');

        if (cancelBtn) {
            cancelBtn.onclick = () => {
                modal.classList.remove('show');
                const overlay = document.getElementById('modal-overlay');
                if (overlay) {
                    overlay.classList.remove('show');
                    overlay.style.display = 'none';
                }
                setTimeout(() => { modal.style.display = 'none'; }, 300);
            };
        }

        if (browseBookBtn) {
            browseBookBtn.onclick = async () => {
                const path = await this.api.browseFile([{ name: 'Opening Books', extensions: ['xob', 'bin'] }]);
                if (path) document.getElementById('edit-engine-bookFile').value = path;
            };
        }

        if (clearBookBtn) {
            clearBookBtn.onclick = () => document.getElementById('edit-engine-bookFile').value = '';
        }

        if (form) {
            form.onsubmit = async (e) => {
                e.preventDefault();
                const index = parseInt(form.dataset.engineIndex);
                const config = {
                    name: document.getElementById('edit-engine-name').value,
                    hash: parseInt(document.getElementById('edit-engine-hash').value),
                    threads: parseInt(document.getElementById('edit-engine-threads').value),
                    depth: parseInt(document.getElementById('edit-engine-depth').value),
                    multiPV: parseInt(document.getElementById('edit-engine-multipv')?.value || 3),
                    bookFile: document.getElementById('edit-engine-bookFile').value
                };
                await this.api.updateEngineConfig(index, config);
                modal.classList.remove('show');
                const overlay = document.getElementById('modal-overlay');
                if (overlay) {
                    overlay.classList.remove('show');
                    overlay.style.display = 'none';
                }
                setTimeout(() => { modal.style.display = 'none'; }, 300);
                this.renderEngineList();
            };
        }
    }

    /**
     * 3.1 EVAL ENGINE CONFIGURATION
     */
    setupEvalControls() {
        const engineSelect = document.getElementById('eval-engine-select');
        const depthInput = document.getElementById('eval-depth-input');
        const multipvInput = document.getElementById('eval-multipv-input');

        if (engineSelect) {
            engineSelect.onchange = async (e) => {
                const newPath = e.target.value;
                const engines = await this.api.getEngines();
                const newEng = engines.find(eng => eng.path === newPath);
                
                const updates = { path: newPath };
                
                // inheritance rules (Phase E4)
                if (newEng && !this.ui.isEvalMultiPVOverridden) {
                    updates.multiPV = newEng.multiPV || 3;
                    const multipvInput = document.getElementById('eval-multipv-input');
                    if (multipvInput) multipvInput.value = updates.multiPV;
                }
                
                this.ui.updateEvalConfig(updates);
            };
        }

        if (depthInput) {
            depthInput.onchange = (e) => {
                this.ui.updateEvalConfig({ depth: parseInt(e.target.value) || 20 });
            };
        }

        if (multipvInput) {
            multipvInput.onchange = (e) => {
                this.ui.isEvalMultiPVOverridden = true;
                this.ui.updateEvalConfig({ multiPV: parseInt(e.target.value) || 1 });
            };
        }
    }

    async openEditEngineModal(index) {
        const engines = await this.api.getEngines();
        const eng = engines[index];
        if (!eng) return;

        const modal = document.getElementById('edit-engine-modal');
        const form = document.getElementById('edit-engine-form');
        form.dataset.engineIndex = index;

        document.getElementById('edit-engine-name').value = eng.name || '';
        document.getElementById('edit-engine-hash').value = eng.hash || 128;
        document.getElementById('edit-engine-threads').value = eng.threads || 1;
        document.getElementById('edit-engine-depth').value = eng.depth || 20;
        document.getElementById('edit-engine-bookFile').value = eng.bookFile || '';

        const overlay = document.getElementById('modal-overlay');
        if (overlay) {
            overlay.style.display = 'block';
            setTimeout(() => overlay.classList.add('show'), 10);
        }
        modal.style.display = 'block';
        setTimeout(() => modal.classList.add('show'), 10);
    }

    async renderEngineList() {
        const list = document.getElementById('engine-list');
        if (!list) return;
        const engines = await this.api.getEngines();
        const currentIndex = await this.api.getSelectedEngineIndex();
        
        list.innerHTML = ''; // Clear list first
        
        engines.forEach((eng, idx) => {
            const item = document.createElement('div');
            item.className = `engine-item ${idx === currentIndex ? 'active' : ''}`;
            item.style.cssText = `margin: 5px 0; padding: 10px; border: 1px solid #eee; display: flex; justify-content: space-between; align-items: center; border-radius: 4px; background: ${idx === currentIndex ? '#e6f7ff' : 'white'};`;
            
            const nameSpan = document.createElement('span');
            nameSpan.style.cssText = 'cursor: pointer; flex: 1; font-weight: 500;';
            nameSpan.textContent = `${eng.name} ${idx === currentIndex ? '(Active)' : ''}`;
            nameSpan.onclick = () => this.selectEngine(idx);
            
            const actionsDiv = document.createElement('div');
            actionsDiv.style.display = 'flex';
            actionsDiv.style.gap = '5px';
            
            const editBtn = document.createElement('button');
            editBtn.textContent = 'Edit';
            editBtn.style.cssText = 'color: #1890ff; border: none; background: transparent; cursor: pointer; font-size: 12px;';
            editBtn.onclick = () => this.openEditEngineModal(idx);
            
            const delBtn = document.createElement('button');
            delBtn.textContent = 'Del';
            delBtn.style.cssText = 'color: #ff4d4f; border: none; background: transparent; cursor: pointer; font-size: 12px;';
            delBtn.onclick = () => this.removeEngine(idx);
            
            actionsDiv.appendChild(editBtn);
            actionsDiv.appendChild(delBtn);
            item.appendChild(nameSpan);
            item.appendChild(actionsDiv);
            list.appendChild(item);
        });

        // Update Eval Engine dropdown & Inherit MultiPV
        const evalSelect = document.getElementById('eval-engine-select');
        if (evalSelect) {
            const currentEng = engines[currentIndex];
            const currentEvalPath = this.ui.evalConfig.path || (currentEng ? currentEng.path : '');
            evalSelect.innerHTML = engines.map(eng => `
                <option value="${eng.path}" ${eng.path === currentEvalPath ? 'selected' : ''}>${eng.name}</option>
            `).join('');
            
            if (currentEng) {
                // Path inheritance
                if (!this.ui.evalConfig.path) this.ui.evalConfig.path = currentEng.path;
                
                // MultiPV inheritance (if not explicitly overridden by user in panel)
                if (!this.ui.isEvalMultiPVOverridden) {
                    this.ui.evalConfig.multiPV = currentEng.multiPV || 3;
                    const multipvInput = document.getElementById('eval-multipv-input');
                    if (multipvInput) multipvInput.value = this.ui.evalConfig.multiPV;
                }
            }
        }
    }

    async selectEngine(index) {
        const success = await this.api.selectEngine(index);
        if (!success) {
            console.error(`[ActionManager] Failed to switch to engine at index ${index}`);
            return;
        }
        
        // Removed manual unpause. 
        // The UIManager scheduler now handles resumption automatically 
        // while respecting the isEnginePaused and isStudyMode states.
        
        this.renderEngineList();
    }

    async removeEngine(index) {
        if (confirm('Remove this engine?')) {
            await this.api.removeEngine(index);
            this.renderEngineList();
        }
    }

    /**
     * 4. OPENING BOOK CONTROLS
     */
    setupBookControls() {
        const browseBookBtn = document.getElementById('browse-book-btn');
        if (browseBookBtn) {
            browseBookBtn.onclick = async () => {
                const path = await this.api.browseFile([{ name: 'Opening Books', extensions: ['json', 'xob', 'pgn'] }]);
                if (path) {
                    const result = await this.api.importBookFile(path);
                    if (result.success) {
                        this.loadBookList();
                        alert('Book added successfully!');
                    } else {
                        alert('Error: ' + result.error);
                    }
                }
            };
        }

        const refreshBtn = document.getElementById('refresh-book-btn');
        if (refreshBtn) refreshBtn.onclick = () => this.loadBookList();

        const loadBookBtn = document.getElementById('load-book-btn');
        if (loadBookBtn) {
            loadBookBtn.onclick = async () => {
                const select = document.getElementById('book-select');
                if (select && select.value) {
                    await this.api.selectBook(select.value);
                    this.ui.syncState();
                    alert('Book loaded successfully!');
                }
            };
        }
        this.loadBookList();
    }

    async loadBookList() {
        const select = document.getElementById('book-select');
        if (!select) return;
        const books = await this.api.getBooks();
        const currentPath = await this.api.getCurrentBookPath();
        
        select.innerHTML = books.map(path => {
            const name = path.split(/[\\/]/).pop();
            const isSelected = path === currentPath;
            return `<option value="${path}" ${isSelected ? 'selected' : ''}>${name}</option>`;
        }).join('');
    }

    /**
     * 5. ELECTRON NATIVE MENU INTEGRATION
     */
    setupElectronMenu() {
        if (!window.ipcRenderer) return;
        
        // File menu
        window.ipcRenderer.on('menu-export-game', () => {
            const exportBtn = document.getElementById('export-game-btn');
            if (exportBtn) exportBtn.click();
        });
        
        window.ipcRenderer.on('menu-import-game', () => {
            const importGameInput = document.getElementById('import-game-file');
            if (importGameInput) importGameInput.click();
        });
        
        window.ipcRenderer.on('menu-import-book', () => {
            const importBookInput = document.getElementById('import-book-file');
            if (importBookInput) importBookInput.click();
        });
        
        // Edit menu
        window.ipcRenderer.on('menu-undo', () => this.ui.undo());
        window.ipcRenderer.on('menu-redo', () => this.ui.redo());
        window.ipcRenderer.on('menu-reset-position', async () => {
            await this.api.resetToInitial();
            await this.ui.syncState();
        });
        
        // Tool menu
        window.ipcRenderer.on('menu-engine-manager', () => {
            const panel = document.getElementById('engine-menu');
            if (panel) panel.style.display = 'block';
            this.renderEngineList();
        });
        
        window.ipcRenderer.on('menu-book-manager', () => {
            const panel = document.getElementById('book-menu');
            if (panel) panel.style.display = 'block';
            this.loadBookList();
        });
        
        // Help menu
        window.ipcRenderer.on('menu-about', () => {
            alert('Xiangqi Analyst Tool v2.0');
        });
    }

    /**
     * 6. MODALS & OTHER UTILITIES
     */
    setupModals() {
        const exportBtn = document.getElementById('export-game-btn');
        if (exportBtn) {
            exportBtn.onclick = async () => {
                const data = await this.api.exportGame();
                const blob = new Blob([data], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = 'game.json';
                a.click();
            };
        }
        const importGameBtn = document.getElementById('import-game-btn');
        const importGameInput = document.getElementById('import-game-file');
        if (importGameBtn && importGameInput) {
            importGameBtn.onclick = () => importGameInput.click();
            importGameInput.onchange = async (e) => {
                const file = e.target.files[0];
                if (file) {
                    const reader = new FileReader();
                    reader.onload = async (ev) => {
                        await this.api.importGame(ev.target.result);
                        this.ui.syncState();
                    };
                    reader.readAsText(file);
                }
            };
        }
    }

    /**
     * 7. MOVE CONTEXT MENU (Notes / Variations)
     */
    showMoveContext(index, move) {
        this.ui.showMoveContext(index, move);
    }

    /**
     * Update the Pause/Resume button text
     * @param {boolean} paused 
     */
    updatePauseButton(paused) {
        const controlBtn = document.getElementById('engine-control-btn');
        if (controlBtn) {
            controlBtn.textContent = paused ? 'Resume' : 'Pause';
        }
    }
}
