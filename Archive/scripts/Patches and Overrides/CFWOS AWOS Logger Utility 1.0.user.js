// ==UserScript==
// @name         CFWOS AWOS Logger Utility 1.0
// @namespace    AWOS
// @version      1.0
// @description  Shared logging module for AWOS scripts
// @author       Chris
// @grant        none
// ==/UserScript==

(function () {
  'use strict';

  // Prevent overwriting if already defined
  if (window.Logger) return;

  window.Logger = {
    log(...args) {
      console.log('%c[AWOS]', 'color: #00bfff; font-weight: bold;', ...args);
    },
    group(name, fn) {
      console.groupCollapsed(`%c[AWOS] ${name}`, 'color: #00bfff; font-weight: bold;');
      try {
        fn();
      } catch (e) {
        console.error('Logger group error:', e);
      }
      console.groupEnd();
    },
    error(...args) {
      console.error('%c[AWOS ERROR]', 'color: red; font-weight: bold;', ...args);
    },
    warn(...args) {
      console.warn('%c[AWOS WARN]', 'color: orange; font-weight: bold;', ...args);
    },
    info(...args) {
      console.info('%c[AWOS INFO]', 'color: green; font-weight: bold;', ...args);
    }
  };

  Logger.log('AWOS Logger Utility v1.0 initialized');
})();

(function () {
    'use strict';

    if (window.Logger) return;

    const mutationLog = [];
    let layoutDispatched = false;

    window.Logger = {
        log: (...args) => console.log('🟢', ...args),
        group: (label, fn) => {
            console.groupCollapsed(`📂 ${label}`);
            try { fn(); } catch (e) { console.error('Logger group error:', e); }
            console.groupEnd();
        },
        observeMutations: function () {
            const observer = new MutationObserver(mutations => {
                mutations.forEach(mutation => mutationLog.push(mutation));

                clearTimeout(observer._debounce);
                observer._debounce = setTimeout(() => {
                    const awosPanel = document.querySelector('#awos, .awos-report, .report-panel, main');
                    if (awosPanel && !layoutDispatched) {
                        Logger.group(`${mutationLog.length} mutation(s) detected`, () => {
                            mutationLog.forEach((mutation, index) => {
                                Logger.group(`Mutation ${index + 1} [${mutation.type}]`, () => {
                                    Logger.log('Target', mutation.target);
                                    if (mutation.addedNodes.length) Logger.log('Added Nodes', mutation.addedNodes);
                                    if (mutation.removedNodes.length) Logger.log('Removed Nodes', mutation.removedNodes);
                                });
                            });
                        });

                        window.__awosCleanupDispatched = true;
                        layoutDispatched = true;
                        window.dispatchEvent(new CustomEvent('AWOSCoreCleanupComplete'));
                        Logger.log('📢 AWOSCoreCleanupComplete dispatched');

                        setTimeout(() => {
                            observer.disconnect();
                            Logger.log('Observer disconnected after delay');
                        }, 3000);
                    }
                }, 100);
            });

            observer.observe(document.body, { childList: true, subtree: true });
            Logger.log('AWOS MutationObserver initialized');
        }
    };

    Logger.log('AWOS Logger Utility v1.0 initialized');
})();

