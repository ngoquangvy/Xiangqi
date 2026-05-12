const { app, BrowserWindow, Menu } = require('electron');
const path = require('path');

// 1. LOAD MODULES
const DataManager = require('./src/main/DataManager');
const { MainEngine, EvalEngine } = require('./src/main/EngineAgent');
const IPCRouter = require('./src/main/IPCRouter');
const XiangqiGame = require('./src/core/XiangqiGame');

/**
 * MAIN ENTRY (main.js)
 * -------------------
 * Orchestrates the application lifecycle, window management, and modules.
 */

let mainWindow;
let dataManager;
let mainEngine;
let evalEngine;
let ipcRouter;

async function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1000,
        height: 700,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            sandbox: false,
            preload: path.join(__dirname, 'preload.js')
        }
    });

    // Surface renderer console errors in the terminal while stabilizing the UI.
    mainWindow.webContents.on('console-message', (_, level, message, line, sourceId) => {
        console.log(`[Renderer:${level}] ${message} (${sourceId}:${line})`);
    });

    // Initialize modules
    dataManager = new DataManager(app.getPath('userData'));
    mainEngine = new MainEngine();
    evalEngine = new EvalEngine();
    
    // Initialize IPCRouter to listen for UI requests
    ipcRouter = new IPCRouter(mainWindow, mainEngine, evalEngine, dataManager, XiangqiGame);
    ipcRouter.init();

    // Load Engine and Book configurations
    // Engine Bootstrap
    await dataManager.loadEngines({ name: 'Pikafish', path: '', protocol: 'uci' });
    await dataManager.loadSelectedEnginePath();
    
    if (dataManager.selectedEnginePath) {
        mainEngine.start(dataManager.selectedEnginePath);
    } else if (dataManager.engines[0] && dataManager.engines[0].path) {
        // Fallback for first run: use default engine path
        mainEngine.start(dataManager.engines[0].path);
    }
    
    // Wait until engine is ready, then apply normalized config
    mainEngine.waitUntilReady().then(() => {
        const startPath = mainEngine.process ? mainEngine.process.spawnfile : null;
        const config = dataManager.engines.find(e => e.path === startPath) || dataManager.engines[0];
        if (config) {
            mainEngine.applyConfig(dataManager.normalizeEngineConfig(config));
        }
    });

    await dataManager.loadSelectedBookPath();
    await dataManager.loadOpeningBook();

    mainWindow.loadFile('index.html');
    
    // Open DevTools only if DEBUG env is set
    if (process.env.DEBUG === 'true') {
        mainWindow.webContents.openDevTools();
    }
    
    buildMenu();
}

function buildMenu() {
    const template = [
        {
            label: 'File',
            submenu: [
                {
                    label: 'Export Game',
                    accelerator: 'CmdOrCtrl+E',
                    click: () => mainWindow.webContents.send('menu-export-game')
                },
                {
                    label: 'Import Game',
                    accelerator: 'CmdOrCtrl+I',
                    click: () => mainWindow.webContents.send('menu-import-game')
                },
                {
                    label: 'Import Book',
                    click: () => mainWindow.webContents.send('menu-import-book')
                },
                { type: 'separator' },
                {
                    label: 'Exit',
                    accelerator: 'CmdOrCtrl+Q',
                    click: () => app.quit()
                }
            ]
        },
        {
            label: 'Edit',
            submenu: [
                {
                    label: 'Undo',
                    accelerator: 'CmdOrCtrl+Z',
                    click: () => mainWindow.webContents.send('menu-undo')
                },
                {
                    label: 'Redo',
                    accelerator: 'CmdOrCtrl+Shift+Z',
                    click: () => mainWindow.webContents.send('menu-redo')
                },
                { type: 'separator' },
                {
                    label: 'Reset Position',
                    click: () => mainWindow.webContents.send('menu-reset-position')
                }
            ]
        },
        {
            label: 'Tool',
            submenu: [
                {
                    label: 'Engine Manager',
                    click: () => mainWindow.webContents.send('menu-engine-manager')
                },
                {
                    label: 'Book Manager',
                    click: () => mainWindow.webContents.send('menu-book-manager')
                }
            ]
        },
        {
            label: 'Help',
            submenu: [
                {
                    label: 'About',
                    click: () => mainWindow.webContents.send('menu-about')
                }
            ]
        }
    ];
    Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});
