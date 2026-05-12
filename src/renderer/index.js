/**
 * RENDERER ENTRY POINT (src/renderer/index.js)
 * -----------------------------------------
 * Duty: Initialize the UIManager and bind it to the window for accessibility.
 */
import { UIManager } from './UIManager.js';

document.addEventListener('DOMContentLoaded', async () => {
    // 1. Initialize UIManager (The main orchestrator)
    const ui = new UIManager();

    // 2. Bind to global window for ActionManager or inline access
    window.ui = ui;

    // 3. FULL INITIALIZATION (Triggers IPC setup and syncState)
    // This is the CRITICAL STEP that fetches the initial board from the core.
    await ui.init(); 
    
    console.log('[Renderer] UI Initialization complete.');
});
