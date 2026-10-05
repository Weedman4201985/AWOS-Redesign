// ==UserScript==
// @name         CFWOS Cleanup Suite 4
// @namespace    chris.awos
// @version      4.0e
// @description  UI fixes and enhancements for CFWOS, including AWOS restoration
// @match        https://met.forces.gc.ca/english/airops/*
// @grant        none
// ==/UserScript==

(function () {
  'use strict';

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

              const hiddenElements = [];

              Logger.group(`🧹 Evaluating and removing hidden/empty elements`, () => {
                const hiddenElements = [];
                const candidates = document.querySelectorAll('link, meta, input, img, script');

                Logger.group('📂 Element Details', () => {
                  let count = 0;

                  candidates.forEach((el) => {
                    // Skip anything inside the top bar
                    if (el.closest('#awos-top-bar')) return;

                    // Skip font-related links
                    if (el.tagName === 'LINK' && el.href && el.href.includes('fonts')) return;

                    const style = getComputedStyle(el);
                    const isHidden = style.display === 'none' || style.visibility === 'hidden';
                    const isEmpty = el.textContent.trim() === '' && el.children.length === 0;

                    if (isHidden && isEmpty) {
                      hiddenElements.push(el);
                      count++;

                      // 🎨 Styled header line
                      console.log(
                        `%c🟢 Element ${count}: <%c${el.tagName.toLowerCase()}%c>`,
                        'color: #00bfff; font-weight: bold;',
                        'color: #ff9800; font-weight: bold;',
                        'color: #00bfff; font-weight: bold;'
                      );

                      Logger.log('Display:', style.display);
                      Logger.log('Visibility:', style.visibility);
                      Logger.log('Text Content:', el.textContent.trim());
                      Logger.log('Children:', el.children.length);
                      Logger.log('Source:', el.src || el.href || '[inline]');
                      Logger.log('Hidden:', isHidden);
                      Logger.log('Empty:', isEmpty);
                      Logger.log('✅ Marked for removal');
                    }
                  });
                });

                Logger.group(`🗑️ Removed ${hiddenElements.length} hidden empty element(s)`, () => {
                  hiddenElements.forEach((el, i) => {
                    Logger.log(`Removed Element ${i + 1}`, el);
                    el.remove();
                  });
                });
              });

              Logger.log('Legacy cleanup complete ✅');
          });
      }
    function observeAWOS() {
        return new Promise(resolve => {
          Logger.perf('start','observeAWOS');
          const mutationLog = [];
          const waitForBody = setInterval(() => {
            if (document.body) {
              clearInterval(waitForBody);

              const observer = new MutationObserver(mutations => {
                const filteredMutations = mutations.filter(mutation => {
                  const target = mutation.target;
                  return !target.closest || !target.closest('#awos-top-bar');
                });

                if (filteredMutations.length < mutations.length) {
                  Logger.log(`[observeAWOS] Skipped ${mutations.length - filteredMutations.length} top bar mutations`);
                }

                mutationLog.push(...filteredMutations);
                clearTimeout(observer._debounce);

                observer._debounce = setTimeout(() => {
                  clearTimeout(fallback); // ✅ clear fallback only when we’re resolving normally

                  Logger.group(`${mutationLog.length} mutation(s) detected`, () => {
                    Logger.group('📂 Mutation Details', () => {
                      mutationLog.forEach((mutation, index) => {
                        Logger.log(`Mutation ${index + 1} [${mutation.type}]`);
                        Logger.log('Target:', mutation.target);
                        if (mutation.addedNodes.length) Logger.log('Added Nodes:', mutation.addedNodes);
                        if (mutation.removedNodes.length) Logger.log('Removed Nodes:', mutation.removedNodes);
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
                  setTimeout(() => {
                    observer.disconnect();
                    Logger.info('[observeAWOS] Observer disconnected after delay');
                    Logger.perf('stop','observeAWOS');
                    resolve(mutationLog);
                  }, 300);
                }, 100);
              });

              observer.observe(document.body, { childList: true, subtree: true });

              // ✅ start fallback *after* observer is created
              var fallback = setTimeout(() => {
                Logger.perfTimeMark('[observeAWOS fallback] No mutations');
                Logger.perf('stop','observeAWOS');
                Logger.info('[observeAWOS] No mutations detected');
                observer.disconnect();
                resolve(mutationLog);
              }, 400); // give it a few seconds
            }
          }, 10);
        });
      }

    let layoutApplied = false;

    function runCleanup(window, document) {
        "use strict";

        if (layoutApplied) return; // ✅ Skip if already handled

        purgeHeaderFooter();
        monitorFooterResurrection();
        cleanupLegacy();

        layoutApplied = true;

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
                    Logger.log("Destroyed unused Dojo widget:", widget.id);
                }
            });
        }

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
        Logger.info("✅ AWOS Cleanup Suite complete");
      }

    return {
        run: async () => {
          await observeAWOS();
          runCleanup(window, document);
          Logger.info('[CleanupSuite] CFWOS Cleanup Suite complete.');
          Logger.modules.register('cleanup');
        },
        observeAWOS
      };

  })();

  Logger.modules.whenReady(['core'], () => {
    Logger.info("🧹 Running Cleanup Suite after Core");
    CleanupSuite.run();
  });

})();
