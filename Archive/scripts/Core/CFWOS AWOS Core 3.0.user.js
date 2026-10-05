// ==UserScript==
// @name         CFWOS AWOS Core 3.0
// @namespace    chris.awos
// @version      3.0
// @description  Layout cleanup, refresh toggle, script stripping — no modal logic
// @match        https://met.forces.gc.ca/english/airops/AWOS/*
// @grant        none
// @run-at       document-start
// @inject-into  content
// ==/UserScript==


(function () {
    'use strict';

    let layoutApplied = false;
    const mutationLog = [];
    const Logger = window.Logger || {
        log: (...args) => console.log('🟢', ...args),
        group: (label, fn) => {
            console.groupCollapsed(`📂 ${label}`);
            try { fn(); } catch (e) { console.error('Logger group error:', e); }
            console.groupEnd();
        },
        warn: (...args) => console.warn('⚠️', ...args),
        error: (...args) => console.error('❌', ...args),
        info: (...args) => console.info('ℹ️', ...args)
    };

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

    function findAllMouseoverElements() {
        const elements = Array.from(document.querySelectorAll('[onmouseover]'));
        Logger.log(`[findAllMouseoverElements] Found ${elements.length} elements with onmouseover`);
        return elements;
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

    function cleanupLegacy() {
        Logger.group('Legacy plugin and bloat cleanup', () => {
            const configScripts = Array.from(document.querySelectorAll('script')).filter(script =>
                script.innerText.includes('djConfig')
            );
            Logger.group(`Removed ${configScripts.length} legacy config script(s)`, () => {
                configScripts.forEach((script, i) => {
                    Logger.log(`Config Script ${i + 1}`, script);
                    script.remove();
                });
            });

            const hiddenElements = Array.from(document.querySelectorAll('link, meta, input, img, script')).filter(el => {
                const style = getComputedStyle(el);
                return (
                    (style.display === 'none' || style.visibility === 'hidden') &&
                    el.textContent.trim() === '' &&
                    el.children.length === 0
                );
            });
            Logger.group(`Removed ${hiddenElements.length} hidden empty element(s)`, () => {
                hiddenElements.forEach((el, i) => {
                    Logger.log(`Hidden Element ${i + 1}`, el);
                    el.remove();
                });
            });

            const styledElements = Array.from(document.querySelectorAll('[style]'));
            Logger.group(`Removed inline styles from ${styledElements.length} element(s)`, () => {
                styledElements.forEach((el, i) => {
                    Logger.log(`Styled Element ${i + 1}`, el);
                    el.removeAttribute('style');
                });
            });

            Logger.log('Legacy cleanup complete ✅');
        });
    }

    function interceptMouseoverPopups() {
        const elements = findAllMouseoverElements();

        elements.forEach((el, index) => {
            const originalHandler = el.getAttribute('onmouseover');
            el.removeAttribute('onmouseover');

            el.addEventListener('mouseenter', () => {
                Logger.log(`[interceptMouseoverPopups] Mouseover intercepted on element #${index}`);
                showTooltip(el, originalHandler);
            });
        });
    }

    function showTooltip(el, handlerCode) {
        const tooltip = document.createElement('div');
        tooltip.textContent = `Legacy mouseover: ${handlerCode}`;
        tooltip.style.position = 'absolute';
        tooltip.style.background = '#333';
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

        setTimeout(() => {
            tooltip.remove();
        }, 3000);
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
      }, 10000);
    }

    function observeAWOS() {
      const waitForBody = setInterval(() => {
        if (document.body) {
          clearInterval(waitForBody);

          const observer = new MutationObserver(mutations => {
            mutations.forEach(mutation => mutationLog.push(mutation));
            clearTimeout(observer._debounce);

            observer._debounce = setTimeout(() => {
              const awosPanel = document.querySelector('#awos, .awos-report, .report-panel, main');

              if (awosPanel && !layoutApplied) {
                const mutationSummary = { attributes: 0, childList: 0, subtree: 0, characterData: 0 };
                mutations.forEach(mutation => { mutationSummary[mutation.type]++; });

                Logger.group(`${mutationLog.length} mutation(s) detected`, () => {
                  Logger.log('🧬 Mutation Type Breakdown:', mutationSummary);
                  mutationLog.forEach((mutation, index) => {
                    Logger.group(`Mutation ${index + 1} [${mutation.type}]`, () => {
                      Logger.log('Target', mutation.target);
                      if (mutation.addedNodes.length) Logger.log('Added Nodes', mutation.addedNodes);
                      if (mutation.removedNodes.length) Logger.log('Removed Nodes', mutation.removedNodes);
                    });
                  });
                });

                if (mutationLog.length > 100) {
                  Logger.group('⚠️ Mutation Spike Alert', () => {
                    Logger.warn(`Spike detected: ${mutationLog.length} mutations`);
                    Logger.log(`Timestamp: ${new Date().toISOString()}`);
                    Logger.log('Sample mutated nodes:');
                    mutationLog.slice(0, 5).forEach((mutation, i) => {
                      Logger.log(`Mutation ${i + 1}:`, mutation.target);
                    });
                  });
                }

                Logger.log('Running full header/footer purge and layout cleanup...');

                cleanupLegacy();
                purgeHeaderFooter();
                monitorFooterResurrection();
                interceptMouseoverPopups();

                if (!window.__awosCleanupDispatched) {
                  window.__awosCleanupDispatched = true;
                  const event = new CustomEvent('AWOSCoreCleanupComplete');
                  window.dispatchEvent(event);
                  console.log('📢 Layout Enhancer dispatched successfully');
                }

                layoutApplied = true;

                setTimeout(() => {
                  observer.disconnect();
                  Logger.log('Observer disconnected after delay');
                }, 3000);
              }
            }, 100);
          });

          observer.observe(document.body, { childList: true, subtree: true });
          observeLegacyScripts();
        }
      }, 10);
    }

    window.addEventListener('DOMContentLoaded', () => {
      injectResetFloaterButton();
      Logger.log('🧭 DOM fully loaded');

    });

    if (location.search.includes('&detail=')) {
      Logger.log('✅ Starting AWOS cleanup on detail page');
      observeAWOS(); // Optional: monitor for script resurrection
      return; // Skip layout/modal logic
    }

    if (window.self !== window.top) {
      console.log('✅ Running inside iframe');
    }

    Logger.log('✅ Starting AWOS cleanup...');

    observeAWOS();

})();