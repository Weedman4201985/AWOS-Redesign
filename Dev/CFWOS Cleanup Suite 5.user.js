// ==UserScript==
// @name         CFWOS Cleanup Suite 5(Legacy script edition)
// @namespace    chris.awos
// @version      5(Legacy Script Edition)
// @description  UI fixes and enhancements for CFWOS, including AWOS restoration
// @match        https://met.forces.gc.ca/english/airops/*
// @match        http://localhost/english/AWOS/*
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

        function isLegacyScript(script) {
            const src = script.src || '';
            return [
                'wet-boew/jquery.min.js',
                'jquery-ui.min.js',
                'jquery.ui.touch-punch.min.js',
                'jquery-ui-slider-pips.js',
                'wet-boew/js/wet-boew.min.js',
                'common_jquery.js',
                'wet-boew/js/i18n/en.min.js'
            ].some(fragment => src.includes(fragment));
        }

        function cleanupLegacy() {

            Logger.group('Legacy plugin and bloat cleanup', () => {

                const legacyScripts = Array.from(document.querySelectorAll('script')).filter(isLegacyScript);

                Logger.group(`🧨 Removed ${legacyScripts.length} legacy script(s)`, () => {

                    legacyScripts.forEach((script, i) => {

                        Logger.log(`Legacy Script ${i + 1}`, script.src || '[inline script]');

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
                }, true);
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

                runCleanup(window, document);

                Logger.info('[CleanupSuite] 🧹 CFWOS Cleanup Suite complete.');
                Logger.modules.register('cleanup');
            },
        };

    })();

    Logger.modules.whenReady(['core'], () => {
        Logger.info("[CleanupSuite] 🧹 Running Cleanup Suite after Core");
        CleanupSuite.run();

    });

})();
