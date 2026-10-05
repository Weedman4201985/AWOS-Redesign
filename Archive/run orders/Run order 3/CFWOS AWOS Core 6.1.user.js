// ==UserScript==
// @name         CFWOS AWOS Core 6.1
// @version      6.1d
// @description  Debugging update
// @author       Chris
// @match        https://met.forces.gc.ca/english/airops/AWOS/*
// @match        http://localhost/english/AWOS/*
// @grant        none
// @run-at       document-start

// ==/UserScript==

(function () {
  'use strict';
  console.log("Logger script started", performance.now());
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
  Logger.log('🚀 AWOS Logger Utility v1.0 initialized');
  Logger.log("Logger script finished", performance.now());
})();

(function () {
    'use strict';
    Logger.log("Core script started", performance.now());

    let suiteResponded = false;



    window.addEventListener('CleanupSuiteComplete', () => {
        suiteResponded = true;
    });

    if (localStorage.getItem('refreshEnabled') === null) {
        localStorage.setItem('refreshEnabled', 'false');
        console.log('[AWOS Core] Initialized refreshEnabled to false');
    }


    (function earlyPatch() {

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

                    function waitForTopBar(callback) {
                        const interval = setInterval(() => {
                            const topBar = document.getElementById('awos-top-bar');
                            if (topBar) {
                                clearInterval(interval);
                                callback(topBar);
                            }
                        }, 50);
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

                    waitForTopBar((topBar) => {
                        const debugBtn = document.createElement('button');
                        debugBtn.textContent = '🧪 Debug';
                        debugBtn.style.cssText = `
                            margin-left: 10px;
                            padding: 6px 10px;
                            background: #444;
                            color: #0f0;
                            border: none;
                            border-radius: 4px;
                            cursor: pointer;
                            font-size: 12px;
                            font-family: monospace;
                        `;
                        debugBtn.addEventListener('click', () => {
                            if (typeof window.openDebugPanel === 'function') {
                                window.openDebugPanel();
                            } else {
                                console.warn('[AWOS Core] openDebugPanel() is not available.');
                            }
                        });
                        console.log('[AWOS Core] Waiting for top bar to inject debug button...');

                        topBar.appendChild(debugBtn);

                        console.log('[AWOS Core] Debug button injected into top bar.');
                    });

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

        function disableAwosAutoRefresh() {
          document.querySelectorAll('meta[http-equiv="refresh"]').forEach(m => m.remove());

          window.location.reload = () => console.log('[AWOS] reload blocked');
          window.location.replace = () => console.log('[AWOS] replace blocked');

          const realSetTimeout = window.setTimeout;
          const realSetInterval = window.setInterval;

          window.setTimeout = function(fn, delay, ...args) {
            if (typeof fn === 'string' && /reload|replace/i.test(fn)) return 0;
            return realSetTimeout(fn, delay, ...args);
          };
          window.setInterval = function(fn, delay, ...args) {
            if (typeof fn === 'string' && /reload|replace/i.test(fn)) return 0;
            return realSetInterval(fn, delay, ...args);
          };

          for (let i = 0; i < 1000; i++) {
            clearTimeout(i);
            clearInterval(i);
          }
        }

        function forcePageReload() {
          window.onbeforeunload = null;
          window.onunload = null;
          location.href = location.href;
        }

        const ENABLE_ZOOM_FIX = true;
        const ENABLE_FONT_BLOCK = true;
        const ENABLE_COOKIE_OVERRIDE = true;
        const ENABLE_XHR_LOGGING = true;

        const earlyPatchReport = [];

        // 🔍 Patch 1: Replace 'zoom' with 'transform: scale'
        function patchZoom() {
            const zoomElements = [...document.querySelectorAll('*')].filter(el => el.style.zoom);
            if (zoomElements.length === 0) {
                earlyPatchReport.push('🔕 Zoom Patch: No elements found using "zoom"');
                return;
            }

            zoomElements.forEach(el => {
                const zoomValue = el.style.zoom;
                el.style.transform = `scale(${zoomValue})`;
                el.style.transformOrigin = 'top left';
                el.style.zoom = '';
                console.log(`[Zoom Patch] Applied scale(${zoomValue}) to`, el);
            });

            earlyPatchReport.push(`✅ Zoom Patch: Applied to ${zoomElements.length} element(s)`);
        }

        // 🧼 Patch 2: Block legacy fonts
        function blockLegacyFonts() {
            const fontKeywords = ['Wingdings', 'Webdings', 'Symbol'];
            let patchedCount = 0;

            [...document.styleSheets].forEach(sheet => {
                try {
                    [...sheet.cssRules].forEach(rule => {
                        if (rule.style?.fontFamily) {
                            fontKeywords.forEach(font => {
                                if (rule.style.fontFamily.includes(font)) {
                                    rule.style.fontFamily = 'sans-serif';
                                    patchedCount++;
                                    console.log(`[Font Patch] Replaced ${font} with sans-serif`);
                                }
                            });
                        }
                    });
                } catch (e) {
                    // Cross-origin stylesheet
                }
            });

            if (patchedCount === 0) {
                earlyPatchReport.push('🔕 Font Patch: No legacy fonts found');
            } else {
                earlyPatchReport.push(`✅ Font Patch: Replaced ${patchedCount} legacy font reference(s)`);
            }
        }

        // 🍪 Patch 3: Override document.cookie
        function overrideCookie() {
            Object.defineProperty(document, 'cookie', {
                get: function () {
                    console.log('[Cookie Patch] Accessed cookies');
                    return '';
                },
                set: function (val) {
                    console.log('[Cookie Patch] Blocked cookie set:', val);
                }
            });
            earlyPatchReport.push('✅ Cookie Patch: Getter/setter overridden');
        }

        // 📡 Patch 4: Log all XHR requests
        function logXHR() {
            const originalOpen = XMLHttpRequest.prototype.open;
            XMLHttpRequest.prototype.open = function (...args) {
                console.log('[XHR Patch] Request:', args);
                return originalOpen.apply(this, args);
            };

            const originalSend = XMLHttpRequest.prototype.send;
            XMLHttpRequest.prototype.send = function (...args) {
                if (this.async === false) {
                    console.warn('[XHR Patch] ⚠️ Synchronous XHR detected:', this);
                }
                return originalSend.apply(this, args);
            };

            earlyPatchReport.push('✅ XHR Patch: Logging enabled for all requests');
        }

        // ✅ Final report
        setTimeout(() => {
              console.log('⚙️ Running early Patches...');

                  if (ENABLE_ZOOM_FIX) patchZoom();
                  if (ENABLE_FONT_BLOCK) blockLegacyFonts();
                  if (ENABLE_COOKIE_OVERRIDE) overrideCookie();
                  if (ENABLE_XHR_LOGGING) logXHR();

                  console.log('✅ Early patch is complete');
                  console.log("Patch finished", performance.now());
                  console.table(earlyPatchReport);

            }, 100);

       })();

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
    function purgeHeaderFooter() {

        Logger.group('Removing header and footer elements', () => {
            const selectors = [
                '#wb-lng', '#gcwu-sig', '#gcwu-gmap', '#gcwu-bnr', '#wb-srch', '#wb-bc',
                '#wb-sm', '#wb-sttl', '#wb-info', '#wb-sec', '#wb-bar', '#wb-glb-mn', '#wb-cont',
                'header', '#wb-nav', '#wb-foot', '#gcwu-foot', '#gcwu-date-mod', '#wb-srch-footer',
                '#wb-info-footer', '#wb-tphp', '#wb-dtmd', '#wb-ftr', 'footer'
            ];

            selectors.forEach(sel => {
                const el = document.querySelector(sel);
                if (el) {
                    Logger.log(`Removing ${sel}`, el);
                    el.remove();
                }
            });

            document.querySelectorAll('#wb-tphp a, .skip-links a').forEach(link => {
                const text = link.textContent.trim().toLowerCase();
                if (text.includes('skip to content') || text.includes('skip to institutional links')) {
                    Logger.log('Removing skip link', link);
                    link.remove();
                }
            });

            document.querySelectorAll('header, footer').forEach(el => {
                if (el.innerHTML.trim() === '') {
                    Logger.log('Removing empty container', el);
                    el.remove();
                }
            });
        });

    }
    function monitorFooterResurrection() {

        const interval = setInterval(() => {
            const footer = document.querySelector('footer, #wb-foot, #gcwu-foot');
            if (footer) {
                Logger.log('Footer reappeared — removing again', footer);
                footer.remove();
            }
        }, 500);
        setTimeout(() => clearInterval(interval), 5000);

    }

    function findAllMouseoverElements() {
      const elements = Array.from(document.querySelectorAll('[onmouseover]'));
      Logger.log(`[findAllMouseoverElements] Found ${elements.length} elements with onmouseover`);
      return elements;
    }
    function interceptMouseoverPopups() {
        const elements = findAllMouseoverElements();

        elements.forEach((el, index) => {
            const originalHandler = el.getAttribute('onmouseover');
            el.removeAttribute('onmouseover');

            let tooltip = null;
            let showTimer = null;
            let hideTimer = null;

            const handleMouseMove = (e) => {
                if (tooltip) {
                    const mouseX = e.clientX + window.scrollX;
                    const mouseY = e.clientY + window.scrollY;
                    tooltip.style.top = `${mouseY + 12}px`;
                    tooltip.style.left = `${mouseX + 12}px`;
                }
            };

            const showTooltip = (e) => {
                Logger.log(`[interceptMouseoverPopups] Pointer entered element #${index}`);
                clearTimeout(hideTimer);

                if (tooltip) {
                    tooltip.remove();
                    tooltip = null;
                    document.removeEventListener('mousemove', handleMouseMove);
                }

                showTimer = setTimeout(() => {
                    tooltip = createTooltip(el);
                    document.body.appendChild(tooltip);
                    document.addEventListener('mousemove', handleMouseMove);
                }, 100);
            };

            const hideTooltip = () => {
                clearTimeout(showTimer);

                if (tooltip) {
                    hideTimer = setTimeout(() => {
                        tooltip.remove();
                        tooltip = null;
                        document.removeEventListener('mousemove', handleMouseMove);
                    }, 2000);
                }
            };

            el.addEventListener('pointerenter', showTooltip);
            el.addEventListener('pointerleave', hideTooltip);
        });
    }
    function createTooltip(el) {
        const epoch = parseInt(el.dataset.epochvalue, 10);
        const offset = parseInt(el.dataset.tzoffset, 10) * 60; // minutes to seconds
        const adjustedTime = new Date((epoch + offset) * 1000);

        const estTime = new Intl.DateTimeFormat('en-US', {
            timeZone: 'America/New_York',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: true
        }).format(adjustedTime);

        const tooltip = document.createElement('div');
        tooltip.textContent = `EST Time: ${estTime}`;
        tooltip.style.position = 'absolute';
        tooltip.style.background = '#222';
        tooltip.style.color = '#fff';
        tooltip.style.padding = '6px 10px';
        tooltip.style.borderRadius = '6px';
        tooltip.style.fontSize = '14px';
        tooltip.style.pointerEvents = 'none';
        tooltip.style.zIndex = '9999';

        return tooltip;
    }

    function observeLegacyScripts() {

      const removedScripts = [];
      let logTimeout;

      const legacyScriptObserver = new MutationObserver(mutations => {
        mutations.forEach(mutation => {
            mutation.addedNodes.forEach(node => {
                if (
                    node.tagName === 'SCRIPT' &&
                    node.src &&
                    /dojo|wet-boew|jquery/.test(node.src)
                ) {
                    removedScripts.push(node);
                    node.remove();
                }
            });
        });

        // Debounce logging to group multiple removals
        clearTimeout(logTimeout);
        logTimeout = setTimeout(() => {
            if (removedScripts.length > 0) {
                Logger.group(`📂 Removed ${removedScripts.length} legacy script(s) on-the-fly`, () => {
                    removedScripts.forEach((script, i) => {
                        Logger.log(`🧨 Legacy Script ${i + 1}`, script.src);
                    });
                });
                removedScripts.length = 0;
            }
        }, 100); // Adjust delay if needed

    });

    legacyScriptObserver.observe(document.head, { childList: true });
    legacyScriptObserver.observe(document.body, { childList: true });

      setTimeout(() => {
        legacyScriptObserver.disconnect();
        Logger.log('🛑 Legacy script observer disconnected');

      }, 1000);
    }
    function purgeLegacyScriptsSafely() {
      const check = () => {
          if (window.jQuery) {
              observeLegacyScripts(); // your original removal logic
          } else {
              setTimeout(check, 10);
          }
      };
      check();
    }

    function runMinimalPatch() {
      document.querySelectorAll('*').forEach(el => {
          if (el.style.zoom) {
              el.style.transform = `scale(${el.style.zoom})`;
              el.style.transformOrigin = 'top left';
              el.style.zoom = '';
          }
      });

      document.cookie = ''; // Block cookie writes
      const xhrOpen = XMLHttpRequest.prototype.open;
      XMLHttpRequest.prototype.open = function(method, url) {
          console.log(`[Core 6.0] XHR: ${method} ${url}`);
          return xhrOpen.apply(this, arguments);
      };
  }

    setTimeout(() => {
        if (!suiteResponded) {
            console.warn('[Core 6.0] Cleanup Suite did not respond. Running fallback patch.');
            runMinimalPatch();
        }
    }, 2000);

    function triggerCleanupSuite() {
      window.dispatchEvent(new CustomEvent('CoreReady', { detail: { timestamp: Date.now() } }));
  }

    function waitForBody(callback) {
      if (document.body) {
          callback();
      } else {
          const interval = setInterval(() => {
              if (document.body) {
                  clearInterval(interval);
                  callback();
              }
          }, 10);
      }
  }

    function waitForLayout(callback) {
        const interval = setInterval(() => {
            const panel = document.querySelector('#awos, .report-panel, main');
            if (panel) {
                clearInterval(interval);
                callback();
            }
        }, 50);
    }

    (function Core60() {

      Logger.log('✅ Starting AWOS Core...');

      waitForBody(() => {
        observeLegacyScripts()  // Now runs early, but safely
      });

      window.addEventListener('DOMContentLoaded', () => {
          waitForLayout(() => {
            injectResetFloaterButton();  // Now runs early, but safely
          });
          interceptMouseoverPopups();
          Logger.log("Core script finished", performance.now());
          document.dispatchEvent(new Event("CoreReady"));
          triggerCleanupSuite();
          Logger.log('🧭 DOM fully loaded');
          console.log('[Storage] Auto-refresh state:', localStorage.getItem('refreshEnabled'));
      });
  })();

})();