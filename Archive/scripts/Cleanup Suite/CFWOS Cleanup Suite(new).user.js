// ==UserScript==
// @name         CFWOS Cleanup Suite
// @namespace    chris.awos
// @version      1.1d
// @description  UI fixes and enhancements for CFWOS, including AWOS restoration
// @match        http://localhost/english/AWOS/*
// @match        https://met.forces.gc.ca/english/airops/*
// @grant        none
// @run-at       document-idle
// ==/UserScript==


(function () {
    'use strict';

    (function waitForDependencies() {
        const waitForBody = setInterval(() => {
            if (document.body) {
                clearInterval(waitForBody);
                Logger.log("✅ Body detected — starting CleanupSuite");
                Logger.log("Cleanup script started at", performance.now());
                CleanupSuite.run();
            }
        }, 50);
    })();

    const CleanupSuite = (() => {

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
                script.innerText.includes('djConfig','dojo','wet-boew','jquery')
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

            Logger.log('Legacy cleanup complete ✅');
        });
    }

      function observeAWOS() {
          return new Promise(resolve => {
              const mutationLog = [];
              let layoutApplied = false;

              const waitForBody = setInterval(() => {
                  if (document.body) {
                      clearInterval(waitForBody);

                      const observer = new MutationObserver(mutations => {
                          mutations.forEach(mutation => mutationLog.push(mutation));
                          clearTimeout(observer._debounce);

                          observer._debounce = setTimeout(() => {
                              const awosPanel = document.querySelector('#awos, .awos-report, .report-panel, main');

                              if (awosPanel && !layoutApplied) {
                                  const mutationSummary = {
                                      attributes: 0,
                                      childList: 0,
                                      subtree: 0,
                                      characterData: 0
                                  };

                                  mutations.forEach(mutation => {
                                      mutationSummary[mutation.type]++;
                                  });

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

                                  purgeHeaderFooter();
                                  monitorFooterResurrection();
                                  cleanupLegacy();

                                  if (!window.__awosCleanupDispatched) {
                                      window.__awosCleanupDispatched = true;
                                      const event = new CustomEvent('AWOSCoreCleanupComplete');
                                      window.dispatchEvent(event);
                                      Logger.log('📢 Layout Enhancer dispatched successfully');



                                  }

                                  layoutApplied = true;

                                  setTimeout(() => {
                                      observer.disconnect();
                                      Logger.log('observeAWOS Observer disconnected after delay');
                                      resolve(); // ✅ Signal that observation and cleanup are complete
                                  }, 250);
                              }
                          }, 100);
                      });

                      observer.observe(document.body, { childList: true, subtree: true });
                  }
              }, 10);
          });
      }

      function runCleanup(window, document) {
        "use strict";

        const debugMode = true;
        //const patchReport = [];

        // ✅ Suppress ALL WET plugins
        const suppressedPlugins = [
            "wb-inview", "wb-mltmd", "wb-lbx", "wb-calevt",
            "wb-charts", "wb-twitter", "wb-zebra", "wb-txthl", "wb-toggle"
        ];

        suppressedPlugins.forEach(plugin => {
            document.addEventListener(`wb-init.${plugin}`, event => {
                event.stopImmediatePropagation();
                Logger.log("Suppressed plugin:", plugin);
            }, true); // useCapture = true to mimic jQuery's delegated binding
        });
        document.addEventListener("wb-init", event => {
            Logger.log("Plugin initialized:", event.namespace, event.target);
        }, true);

        // ✅ Prevent jQuery UI dialog/datepicker from initializing
        if (window.jQuery?.fn) {
            window.jQuery.fn.dialog = function () {
                Logger.warn("dialog() suppressed");
                return this;
            };
            window.jQuery.fn.datepicker = function () {
                Logger.warn("datepicker() suppressed");
                return this;
            };
        }


        // ✅ Safe Dojo widget cleanup
        if (window.dijit?.registry?.forEach) {
            dijit.registry.forEach(widget => {
                if (!widget.domNode || !widget.domNode.offsetParent) {
                    widget.destroyRecursive();
                    if (debugMode) Logger.log("Destroyed unused Dojo widget:", widget.id);
                }
            });
        }

        /*// ✅ Patch legacy fonts
        const fontKeywords = ["Wingdings", "Webdings", "Symbol"];
        let fontPatchCount = 0;
        [...document.styleSheets].forEach(sheet => {
            try {
                [...sheet.cssRules].forEach(rule => {
                    if (rule.style?.fontFamily) {
                        fontKeywords.forEach(font => {
                            if (rule.style.fontFamily.includes(font)) {
                                rule.style.fontFamily = "sans-serif";
                                fontPatchCount++;
                                if (debugMode) Logger.log(`[Font Patch] Replaced ${font}`);
                            }
                        });
                    }
                });
            } catch (e) {}
        });
        patchReport.push(
            fontPatchCount === 0
                ? "🔕 Font Patch: No legacy fonts found"
                : `✅ Font Patch: Replaced ${fontPatchCount} legacy font reference(s)`
        );

        // ✅ Patch zoom styles
        const zoomElements = [...document.querySelectorAll("*")].filter(el => el.style.zoom);
        if (zoomElements.length > 0) {
            zoomElements.forEach(el => {
                const zoomValue = el.style.zoom;
                el.style.transform = `scale(${zoomValue})`;
                el.style.transformOrigin = "top left";
                el.style.zoom = "";
                if (debugMode) Logger.log(`[Zoom Patch] Applied scale(${zoomValue}) to`, el);
            });
            patchReport.push(`✅ Zoom Patch: Applied to ${zoomElements.length} element(s)`);
        } else {
            patchReport.push("🔕 Zoom Patch: No elements found using 'zoom'");
        }

        // ✅ Override document.cookie
        try {
            Object.defineProperty(document, 'cookie', {
                configurable: true,
                get: function () {
                    Logger.log('[Cookie Patch] Accessed cookies');
                    return '';
                },
                set: function (val) {
                    Logger.log('[Cookie Patch] Blocked cookie set:', val);
                }
            });
            patchReport.push('✅ Cookie Patch: Getter/setter overridden');
        } catch (err) {
            Logger.warn('[Cookie Patch] Could not override document.cookie:', err.message);
            patchReport.push('⚠️ Cookie Patch: Override failed');
        }

        // ✅ Log all XHR requests
        const originalOpen = XMLHttpRequest.prototype.open;
        XMLHttpRequest.prototype.open = function (...args) {
            if (debugMode) Logger.log("[XHR Patch] Request:", args);
            return originalOpen.apply(this, args);
        };
        const originalSend = XMLHttpRequest.prototype.send;
        XMLHttpRequest.prototype.send = function (...args) {
            if (!this.async) {
                Logger.warn("[XHR Patch] ⚠️ Synchronous XHR detected:", this);
            }
            return originalSend.apply(this, args);
        };
        patchReport.push("✅ XHR Patch: Logging enabled for all requests");*/

        // ✅ Patch legacy styles
        const style = document.createElement("style");
        style.textContent = `
        .wb-zebra tr:nth-child(even) { background: none !important; }
        [data-wb-lbx] { display: none !important; }
        table.wb-tables { border-collapse: collapse; width: 100%; }
      `;
        document.head.appendChild(style);

        // ✅ Cleanup hidden overlays
        setTimeout(() => {
            document.querySelectorAll('.wb-overlay').forEach(el => {
                if (el.offsetParent === null) {
                    el.remove();
                    Logger.log("Removed hidden overlay:", el.id);
                }
            });
        }, 3000);

        // ✅ Final report
        Logger.log("✅ AWOS Cleanup Suite complete");
        //console.table(patchReport);
    }

      return {
          run: async () => {

              await observeAWOS();

              runCleanup(window, document);
              Logger.log("Cleanup script finished", performance.now());

              Logger.info('[CleanupSuite] CFWOS Cleanup Suite complete.');

              window.dispatchEvent(new CustomEvent('CleanupSuiteComplete', {
                  detail: { timestamp: window.__suiteResponded }
              }));

          },
          observeAWOS: () => {
              observeAWOS();
          }
      };
  })();
})();
