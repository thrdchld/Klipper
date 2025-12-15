// ========================================
// ON-SCREEN DEBUG PANEL
// Alternative to Chrome DevTools for debugging without USB
// ========================================

class DebugPanel {
    constructor() {
        this.logs = [];
        this.maxLogs = 100;
        this.isVisible = false;
        this.init();
        this.interceptConsole();
        this.captureErrors();
    }

    init() {
        // Create debug panel HTML
        const panel = document.createElement('div');
        panel.className = 'debug-panel';
        panel.id = 'debugPanel';
        panel.innerHTML = `
            <div class="debug-header">
                <span class="debug-title">🔍 Debug Console</span>
                <div class="debug-controls">
                    <button class="debug-btn" id="debugClear">Clear</button>
                    <button class="debug-btn" id="debugCopy">Copy</button>
                    <button class="debug-btn" id="debugClose">Hide</button>
                </div>
            </div>
            <div class="debug-logs" id="debugLogs"></div>
        `;
        document.body.appendChild(panel);

        // Create toggle FAB
        const fab = document.createElement('div');
        fab.className = 'debug-toggle-fab';
        fab.id = 'debugToggleFab';
        fab.innerHTML = '🐛';
        document.body.appendChild(fab);

        // Event listeners
        document.getElementById('debugToggleFab').addEventListener('click', () => this.toggle());
        document.getElementById('debugClose').addEventListener('click', () => this.hide());
        document.getElementById('debugClear').addEventListener('click', () => this.clear());
        document.getElementById('debugCopy').addEventListener('click', () => this.copyLogs());

        this.panel = panel;
        this.logsContainer = document.getElementById('debugLogs');
    }

    interceptConsole() {
        const self = this;

        // Save original console methods
        const originalLog = console.log;
        const originalWarn = console.warn;
        const originalError = console.error;
        const originalInfo = console.info;

        // Intercept console.log
        console.log = function (...args) {
            originalLog.apply(console, args);
            self.addLog('log', args);
        };

        // Intercept console.warn
        console.warn = function (...args) {
            originalWarn.apply(console, args);
            self.addLog('warn', args);
        };

        // Intercept console.error
        console.error = function (...args) {
            originalError.apply(console, args);
            self.addLog('error', args);
        };

        // Intercept console.info
        console.info = function (...args) {
            originalInfo.apply(console, args);
            self.addLog('info', args);
        };
    }

    captureErrors() {
        // Capture uncaught errors
        window.addEventListener('error', (event) => {
            this.addLog('error', [`UNCAUGHT ERROR: ${event.message}`, `File: ${event.filename}:${event.lineno}:${event.colno}`]);
            this.show(); // Auto-show on error
        });

        // Capture unhandled promise rejections
        window.addEventListener('unhandledrejection', (event) => {
            this.addLog('error', [`UNHANDLED REJECTION: ${event.reason}`]);
            this.show(); // Auto-show on error
        });
    }

    addLog(level, args) {
        const timestamp = new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
        const message = args.map(arg => {
            if (typeof arg === 'object') {
                try {
                    return JSON.stringify(arg, null, 2);
                } catch (e) {
                    return String(arg);
                }
            }
            return String(arg);
        }).join(' ');

        this.logs.push({ timestamp, level, message });

        // Keep only last N logs
        if (this.logs.length > this.maxLogs) {
            this.logs.shift();
        }

        this.render();
    }

    render() {
        if (!this.logsContainer) return;

        this.logsContainer.innerHTML = this.logs.map(log => `
            <div class="debug-log ${log.level}">
                <span class="debug-timestamp">${log.timestamp}</span>
                <span class="debug-message">${this.escapeHtml(log.message)}</span>
            </div>
        `).join('');

        // Auto-scroll to bottom
        this.logsContainer.scrollTop = this.logsContainer.scrollHeight;
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    toggle() {
        if (this.isVisible) {
            this.hide();
        } else {
            this.show();
        }
    }

    show() {
        this.isVisible = true;
        this.panel.classList.add('visible');
    }

    hide() {
        this.isVisible = false;
        this.panel.classList.remove('visible');
    }

    clear() {
        this.logs = [];
        this.render();
    }

    copyLogs() {
        const text = this.logs.map(log =>
            `[${log.timestamp}] ${log.level.toUpperCase()}: ${log.message}`
        ).join('\n');

        // Try to copy to clipboard
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(text).then(() => {
                alert('Logs copied to clipboard!');
            }).catch(err => {
                this.fallbackCopy(text);
            });
        } else {
            this.fallbackCopy(text);
        }
    }

    fallbackCopy(text) {
        // Fallback: show logs in alert for manual copy
        const truncated = text.length > 1000 ? text.substring(0, 1000) + '\n...(truncated)' : text;
        alert('Copy these logs:\n\n' + truncated);
    }
}

// Initialize debug panel when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        window.debugPanel = new DebugPanel();
        console.log('🐛 Debug Panel initialized - tap bug icon to toggle');
    });
} else {
    window.debugPanel = new DebugPanel();
    console.log('🐛 Debug Panel initialized - tap bug icon to toggle');
}
