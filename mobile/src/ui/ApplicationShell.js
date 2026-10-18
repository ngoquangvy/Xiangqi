// Screen navigation is transient. Returning from Settings never restores engine
// activity unless Analysis is visible; OS foreground events are a separate gate.
export class ApplicationShell {
    constructor(element, analysis, workspace) {
        this.element = element; this.analysis = analysis; this.workspace = workspace;
        this.screen = 'home'; this.returnScreen = 'home';
        this.get('open-analysis').onclick = () => this.show('analysis');
        this.get('open-settings').onclick = () => this.settings();
        this.get('workspace-home').onclick = () => this.back();
        this.get('workspace-settings').onclick = () => this.settings();
        this.get('settings-back').onclick = () => this.show(this.returnScreen);
        this.show('home');
    }
    get(id) { return this.element.querySelector(`#${id}`); }
    settings() { this.returnScreen = this.screen; this.show('settings'); }
    show(screen) {
        if (!['home', 'analysis', 'settings'].includes(screen)) return;
        this.screen = screen;
        this.element.dataset.screen = screen;
        this.get('screen-home').hidden = screen !== 'home';
        this.get('panel-settings').hidden = screen !== 'settings';
        for (const child of this.element.children) {
            const global = ['screen-home', 'panel-settings', 'confirm-dialog', 'toast'].includes(child.id);
            child.inert = !global && screen !== 'analysis';
        }
        this.analysis.setEnabled(screen === 'analysis');
        this.element.scrollTop = 0;
        const target = screen === 'home' ? 'open-analysis' : screen === 'settings' ? 'settings-back' : 'workspace-home';
        this.get(target).focus({ preventScroll: true });
    }
    back() {
        if (this.screen === 'settings') { this.show(this.returnScreen); return true; }
        if (this.screen === 'analysis') {
            if (!this.workspace.back()) this.show('home');
            return true;
        }
        return false;
    }
}
