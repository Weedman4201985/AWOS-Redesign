// ==UserScript==
// @name         CFWOS AWOS Logger Utility(Dev copy)
// @namespace    AWOS
// @version      1.0
// @description  Shared logging module for AWOS scripts
// @author       Chris
// @grant        none
// ==/UserScript==

(function () {
    'use strict';

    if (window.Logger) return;

    window.Logger = {
        log(...args) {
            console.log('🟢 %c[AWOS]', 'color: #00bfff; font-weight: bold;', ...args);
        },
        group(name, fn) {
            console.groupCollapsed(`📂 %c[AWOS] ${name}`, 'color: #00bfff; font-weight: bold;');
            try { fn(); } catch (e) {
                console.error('❌ Logger group error:', e);
            }
            console.groupEnd();
        },
        error(...args) {
            console.error('❌ %c[AWOS ERROR]', 'color: red; font-weight: bold;', ...args);
        },
        warn(...args) {
            console.warn('⚠️ %c[AWOS WARN]', 'color: orange; font-weight: bold;', ...args);
        },
        info(...args) {
            console.info('ℹ️ %c[AWOS INFO]', 'color: green; font-weight: bold;', ...args);
        },
        debug(...args) {
            if (window.AWOS_DEBUG) {
                console.debug('🐞 %c[AWOS DEBUG]', 'color: gray; font-weight: bold;', ...args);
            }
        }
    };

    Logger.log('🚀 AWOS Logger Utility v1.0 initialized');

    Logger.modules = {
        ready: {},
        queue: [],
        register(name) {
            Logger.log(`🟢 Module registered: ${name}`);
            this.ready[name] = true;

            // Check queued callbacks
            this.queue = this.queue.filter(({ deps, fn }) => {
                if (deps.every(dep => this.ready[dep])) {
                    try {
                        fn();
                    } catch (e) {
                        Logger.error(`Error running module callback for ${name}:`, e);
                    }
                    return false; // remove from queue
                }
                return true;
            });
        },
        whenReady(deps, fn) {
            if (deps.every(dep => this.ready[dep])) {
                fn();
            } else {
                this.queue.push({ deps, fn });
            }
        }
    };
})();

