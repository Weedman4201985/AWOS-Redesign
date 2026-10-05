// ==UserScript==
// @name         CFWOS AWOS Core 5.0(Dev copy)
// @version      5.0d
// @description  Unified script combining Core and Logger functionality
// @author       Chris
// @match        http://localhost/english/*
// @match        https://met.forces.gc.ca/*
// @run-at       document-start
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
  console.log("Logger script loaded at", performance.now());
  Logger.log('🚀 AWOS Logger Utility v1.0 initialized');
})();

(function () {
    'use strict';
    console.log("Core script loaded at", performance.now());
    if (!window.create_time_popup) {
        window.create_time_popup = function () {
            // Silent fallback or log
            Logger.log('[AWOS] Stub: create_time_popup called before real definition');
        };
    }

    let layoutApplied = false;
    const mutationLog = [];

    (function setupAutoRefreshToggle() {
        const STORAGE_KEY = 'awosAutoRefreshEnabled';
        const REFRESH_INTERVAL = 60; // seconds
        let refreshEnabled = localStorage.getItem(STORAGE_KEY) !== 'false'; // default to true
        let secondsLeft = REFRESH_INTERVAL;

        const waitForBody = setInterval(() => {
            if (document.body) {
                clearInterval(waitForBody);

                Logger.log(`[AWOS Core] Auto-refresh module initialized. Current state: ${refreshEnabled ? 'ON' : 'OFF'}`);

                // Create top bar container if it doesn't exist
                let topBar = document.querySelector('#awos-top-bar');
                if (!topBar) {
                    topBar = document.createElement('div');
                    topBar.id = 'awos-top-bar';
                    topBar.style.cssText = `
                        position: sticky;
                        top: 0;
                        z-index: 1000;
                        display: flex;
                        justify-content: flex-end;
                        align-items: center;
                        padding: 10px;
                        background: #f8f8f8;
                        border-bottom: 1px solid #ccc;
                    `;
                    document.body.prepend(topBar);
                }

                // Create toggle button
                const toggleBtn = document.createElement('button');
                toggleBtn.style.cssText = `
                    padding: 8px 12px;
                    background: ${refreshEnabled ? '#0078D4' : '#555'};
                    color: #fff;
                    border: none;
                    border-radius: 6px;
                    cursor: pointer;
                    font-size: 14px;
                    font-family: "Segoe UI", sans-serif;
                    box-shadow: 0 2px 6px rgba(0,0,0,0.2);
                    margin-left: auto;
                `;

                function updateButtonLabel() {
                    toggleBtn.textContent = `⏳ Auto-Refresh: ${refreshEnabled ? 'ON' : 'OFF'} (${secondsLeft}s)`;
                }

                toggleBtn.addEventListener('click', () => {
                    const wasDisabled = !refreshEnabled;
                    refreshEnabled = !refreshEnabled;
                    localStorage.setItem(STORAGE_KEY, refreshEnabled);
                    toggleBtn.style.background = refreshEnabled ? '#0078D4' : '#555';
                    Logger.log(`[AWOS Core] Auto-refresh ${refreshEnabled ? 'enabled' : 'disabled'} by user`);
                    updateButtonLabel();

                    if (wasDisabled && refreshEnabled) {
                        Logger.log(`[AWOS Core] Auto-refresh re-enabled — refreshing immediately`);
                        forcePageReload();

                    }
                });

                topBar.appendChild(toggleBtn);
                updateButtonLabel();

                // Countdown loop
                setInterval(() => {
                    if (refreshEnabled) {
                        secondsLeft--;
                        if (secondsLeft <= 0) {
                            Logger.log(`[AWOS Core] Auto-refresh triggered at ${new Date().toLocaleTimeString()}`);
                            forcePageReload();
                        }
                    } else {
                        secondsLeft = REFRESH_INTERVAL; // reset if disabled
                    }
                    updateButtonLabel();
                }, 1000); // every second
            }
        }, 10);
        // At the very end of setupAutoRefreshToggle() closure
        window.getAwosRefreshStatus = function () {
            return {
                enabled: refreshEnabled,
                secondsLeft: secondsLeft
            };
        };

        // Allow modal to trigger parent refresh
        window.triggerAwosRefresh = () => {
            forcePageReload();
        };

        // Live updates to any listeners
        const bc = new BroadcastChannel('awos-refresh-sync');
        setInterval(() => {
            bc.postMessage({
                enabled: refreshEnabled,
                secondsLeft
            });
        }, 1000);


    })();

    (function waitForHeadAndInjectFavicon() {
        const inject = () => {
            const link = document.createElement('link');
            link.rel = 'icon';
            link.type = 'image/png';
            link.href = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8Xw8AAoMBgZkKXnUAAAAASUVORK5CYII=';
            document.head.appendChild(link);
            Logger.log('[AWOS Core] Dummy favicon injected safely');
        };

        const interval = setInterval(() => {
            if (document.head) {
                clearInterval(interval);
                inject();
            }
        }, 10);
    })();

    function forcePageReload() {
        window.onbeforeunload = null;
        window.onunload = null;
        location.href = location.href;
    }

    function injectResetFloaterButton() {
        const refreshBtn = document.querySelector('button, input[type="button"], a[href*="refresh"]');
        if (!refreshBtn || !refreshBtn.parentElement) return;

        const resetBtn = document.createElement('button');
        resetBtn.textContent = '🧹 Reset Floater';
        resetBtn.style.marginLeft = '10px';
        resetBtn.style.padding = '4px 8px';
        resetBtn.style.fontSize = '12px';
        resetBtn.style.cursor = 'pointer';
        resetBtn.style.background = '#cc0000';
        resetBtn.style.color = '#fff';
        resetBtn.style.border = '1px solid #900';
        resetBtn.style.borderRadius = '4px';

        resetBtn.onclick = () => {
            const confirmReset = confirm('Are you sure you want to reset the floater?\nThis will clear its position, size, and last viewed detail.');
            if (!confirmReset) return;

            localStorage.removeItem('awos-panel-position');
            localStorage.removeItem('awos-panel-size');
            localStorage.removeItem('awos-last-detail-url');
            localStorage.removeItem('awos-last-panel-snapshot');
            localStorage.removeItem('awos-last-timestamp');
            location.reload();
        };

        refreshBtn.parentElement.appendChild(resetBtn);
    }

    window.create_time_popup = function (el) {
        const epoch = parseInt(el.dataset.epochvalue, 10);
        const offset = parseInt(el.dataset.tzoffset, 10) * 60; // minutes to seconds
        const localTime = new Date((epoch + offset) * 1000).toLocaleString();

        const tooltip = document.createElement('div');
        tooltip.textContent = `Local Time: ${localTime}`;
        tooltip.style.position = 'absolute';
        tooltip.style.background = '#222';
        tooltip.style.color = '#fff';
        tooltip.style.padding = '6px 10px';
        tooltip.style.borderRadius = '6px';
        tooltip.style.fontSize = '14px';
        tooltip.style.pointerEvents = 'none';
        tooltip.style.zIndex = '9999';

        document.body.appendChild(tooltip);

        const rect = el.getBoundingClientRect();
        tooltip.style.top = `${rect.bottom + window.scrollY + 8}px`;
        tooltip.style.left = `${rect.left + window.scrollX}px`;

        setTimeout(() => tooltip.remove(), 1500);
    };

    function findAllMouseoverElements() {
        const elements = Array.from(document.querySelectorAll('[onmouseover]'));
        Logger.log(`[findAllMouseoverElements] Found ${elements.length} elements with onmouseover`);
        return elements;
    }

    function patchLegacyMouseoverHandlers() {
        const elements = findAllMouseoverElements();

        elements.forEach(el => {
            const handler = el.getAttribute('onmouseover');

            if (handler?.includes('create_time_popup')) {
                Logger.log(`[patchLegacyMouseoverHandlers] Rewiring popup for element:`, el);

                // Remove the inline handler to prevent ReferenceError
                el.removeAttribute('onmouseover');

                // Attach a safe event listener
                el.addEventListener('mouseover', () => {
                    if (typeof window.create_time_popup === 'function') {
                        window.create_time_popup(el);
                    } else {
                        Logger.log('[patchLegacyMouseoverHandlers] create_time_popup not yet defined');
                    }
                });
            }
        });

        Logger.log(`[patchLegacyMouseoverHandlers] Patched ${elements.length} mouseover elements`);
    }

    window.addEventListener('DOMContentLoaded', () => {
        injectResetFloaterButton();
        patchLegacyMouseoverHandlers();
        document.dispatchEvent(new Event("CoreReady"));
        Logger.log('🧭 DOM fully loaded');

    });
    Logger.log('✅ Starting AWOS cleanup...');


})();
