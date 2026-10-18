import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';
import { AppStore } from './state/AppStore.js';
import { GameStorage } from './storage/GameStorage.js';
import { createStorageBackend } from './storage/platform.js';
import { MobileApp } from './ui/MobileApp.js';
import { getText } from './ui/strings.js';
import { AnalysisController } from './analysis/AnalysisController.js';
import { nativeAnalysis } from './analysis/native.js';
import { AnalysisView } from './ui/AnalysisView.js';
import { ApplicationShell } from './ui/ApplicationShell.js';
import './styles/app.css';
import '../../styles/chess-theme.css';

async function start() {
    const storage = new GameStorage(await createStorageBackend());
    const store = new AppStore(storage);
    const element = document.getElementById('mobile-app');
    const ui = new MobileApp(element, store);
    const analysis = new AnalysisController(store, nativeAnalysis(), { enabled: false });
    const analysisView = new AnalysisView(element, store, analysis);
    const shell = new ApplicationShell(element, analysis, ui);
    // Native back dismisses a dialog/preview/sheet first; committed moves are already saved.
    if (Capacitor.getPlatform() === 'android') App.addListener('backButton', () => {
        if (!shell.back()) App.exitApp();
    }).catch(error => console.error('[Native back]', error));
    const lifecycle = Capacitor.isNativePlatform() ? await App.addListener('appStateChange', state => analysis.setForeground(state.isActive)) : null;
    if (Capacitor.isNativePlatform()) analysis.setForeground((await App.getState()).isActive);
    window.addEventListener('pagehide', () => { analysisView.destroy(); analysis.destroy(); ui.destroy(); lifecycle?.remove(); }, { once: true });
}
start().catch(error => {
    console.error('[Mobile startup]', error);
    document.getElementById('save-status').textContent = getText(document.documentElement.lang).startupError;
});
