const { spawn } = require('child_process');
const { EventEmitter } = require('events');
const IPC = require('../shared/ipcChannels');

/**
 * 1. BASE CLASS: BaseEngine
 * ----------------------------
 * Responsibility: Manage the underlying engine process (spawn, stdin, stdout).
 * Emits: 'output', 'status'.
 * Does not communicate with the UI directly.
 */
class BaseEngine extends EventEmitter {
    constructor(name) {
        super();
        this.name = name;
        this.process = null;
        this.intentionalKill = false;
        this.protocol = 'uci';
        this.status = 'stopped'; // Standard vocabulary: stopped, starting, idle, searching, error
        this.config = null;
    }

    setStatus(newStatus) {
        if (this.status === newStatus) return;
        this.status = newStatus;
        this.emit('status', newStatus);
    }

    start(enginePath) {
        this.kill(); // Ensure previous is dead and listeners detached

        try {
            console.log(`[${this.name}] Starting process: ${enginePath}`);
            const currentProcess = spawn(enginePath);
            this.process = currentProcess;
            this.intentionalKill = false;
            this.setStatus('starting');

            this.process.stdout.on('data', (data) => {
                this.handleRawOutput(data.toString());
            });

            this.process.on('close', (code) => {
                if (this.process === currentProcess && !this.intentionalKill) {
                    console.log(`[${this.name}] Process closed with code ${code}`);
                    this.setStatus('stopped');
                    this.emit('error', `Engine ${this.name} stopped (exit code: ${code})`);
                }
            });

            this.process.on('error', (err) => {
                if (this.process === currentProcess) {
                    console.error(`[${this.name}] Process error:`, err);
                    this.setStatus('error');
                    this.emit('error', `Engine ${this.name} internal error: ${err.message}`);
                }
            });

            // --- Handshake ---
            this.sendCommand('uci');
            this.sendCommand('isready');

        } catch (err) {
            console.error(`[${this.name}] Error starting engine:`, err);
            this.setStatus('error');
            this.emit('error', `Failed to start ${this.name}: ${err.message}`);
        }
    }

    /**
     * Helper to wait until engine completes handshake (readyok)
     */
    waitUntilReady() {
        return new Promise((resolve) => {
            if (this.status === 'idle') {
                resolve();
                return;
            }
            const onStatus = (status) => {
                if (status === 'idle') {
                    this.removeListener('status', onStatus);
                    resolve();
                } else if (status === 'stopped' || status === 'error') {
                    this.removeListener('status', onStatus);
                    resolve(); 
                }
            };
            this.on('status', onStatus);
        });
    }

    sendCommand(command) {
        if (this.process && this.process.stdin && !this.process.killed) {
            this.process.stdin.write(command + '\n');
        }
    }

    handleRawOutput(data) {
        const lines = data.split('\n');
        lines.forEach(line => {
            const trimmed = line.trim();
            if (trimmed) {
                this.onLineReceived(trimmed);
            }
        });
    }

    onLineReceived(line) {
        // UCI Handshake completion check
        if (line === 'readyok') {
            this.setStatus('idle');
        }
        this.emit('output', line);
    }

    /**
     * Apply a config object to the engine via setoption commands.
     * Persistent settings: Hash, Threads, MultiPV, BookFile.
     * depth and other search limits are handled in analyze().
     */
    applyConfig(config) {
        if (!config) return;
        this.config = config; 
        if (config.hash    != null) this.sendCommand(`setoption name Hash value ${config.hash}`);
        if (config.threads != null) this.sendCommand(`setoption name Threads value ${config.threads}`);
        if (config.multiPV != null) this.sendCommand(`setoption name MultiPV value ${config.multiPV}`);
        if (config.bookFile)        this.sendCommand(`setoption name BookFile value ${config.bookFile}`);
        
        console.log(`[${this.name}] Config applied: Hash=${config.hash} Threads=${config.threads} MultiPV=${config.multiPV} Book=${config.bookFile ? 'Yes' : 'No'}`);
    }

    stop() {
        if (this.status === 'searching') {
            this.sendCommand('stop');
            this.setStatus('idle');
        }
    }

    kill() {
        if (this.process) {
            console.log(`[${this.name}] Killing process...`);
            this.intentionalKill = true;
            
            // Detach listeners
            this.process.stdout.removeAllListeners('data');
            this.process.removeAllListeners('close');
            this.process.removeAllListeners('error');
            
            this.process.kill();
            this.process = null;
            this.setStatus('stopped');
        }
    }
}

/**
 * 2. SUBCLASS: MainEngine (Agent 1 & 2)
 */
class MainEngine extends BaseEngine {
    constructor() {
        super('Main Engine');
    }

    analyze(fen) {
        if (this.status !== 'idle' && this.status !== 'searching') {
            console.warn(`[${this.name}] Cannot analyze, status is ${this.status}`);
            return;
        }
        this.stop();
        this.sendCommand(`position fen ${fen}`);
        const depth = this.config ? this.config.depth : null;
        if (depth && depth > 0) {
            this.sendCommand(`go depth ${depth}`);
        } else {
            this.sendCommand('go infinite');
        }
        this.setStatus('searching');
    }
}

/**
 * 3. SUBCLASS: EvalEngine (Agent 3)
 */
class EvalEngine extends BaseEngine {
    constructor() {
        super('Eval Engine');
    }

    analyze(fen, depth = 15) {
        if (this.status !== 'idle' && this.status !== 'searching') {
            console.warn(`[${this.name}] Cannot analyze, status is ${this.status}`);
            return;
        }
        this.stop();
        this.sendCommand(`position fen ${fen}`);
        this.sendCommand(`go depth ${depth}`);
        this.setStatus('searching');
    }
}

module.exports = { MainEngine, EvalEngine };
