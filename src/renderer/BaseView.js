/**
 * BASE CLASS: BaseView
 * ------------------------
 * Parent class for all UI components.
 * Provides shared utilities to subclasses to prevent redundancy.
 */
export class BaseView {
    constructor() {
        // All views use the global API to communicate with Main Process
        this.api = window.XiangqiGameAPI;
    }

    /**
     * Common utility to show/hide a DOM element
     */
    toggleElement(id, visible) {
        const el = document.getElementById(id);
        if (el) {
            el.style.display = visible ? 'block' : 'none';
        }
    }

    /**
     * Utility to clear a Table's contents
     */
    clearTable(tbodyId, emptyMessage = 'No data available') {
        const tbody = document.getElementById(tbodyId);
        if (tbody) {
            tbody.innerHTML = `<tr><td colspan="10" style="text-align:center; padding:10px;">${emptyMessage}</td></tr>`;
        }
    }
}
