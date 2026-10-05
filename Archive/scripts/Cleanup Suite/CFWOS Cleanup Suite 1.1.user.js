// ==UserScript==
// @name         CFWOS Cleanup Suite 1.1
// @namespace    chris.awos
// @version      1.1
// @description  UI fixes and enhancements for CFWOS, including AWOS restoration
// @match        https://met.forces.gc.ca/english/airops/AWOS*
// @grant        none
// @run-at       document-idle
// ==/UserScript==

(function () {
    'use strict';

    (function waitForDependencies() {
        if (typeof jQuery === "undefined") {
            Logger.log("Waiting for jQuery...");
            setTimeout(waitForDependencies, 250);
            return;
        }

        setTimeout(() => {
            document.addEventListener("AWOSCoreReady", () => {
                Logger.log("✅ AWOSCoreReady received — running cleanup");
                CleanupSuite.run();
            });
        }, 100);
    })();

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

            /*const styledElements = Array.from(document.querySelectorAll('[style]'));
            Logger.group(`Removed inline styles from ${styledElements.length} element(s)`, () => {
            styledElements.forEach((el, i) => {
            Logger.log(`Styled Element ${i + 1}`, el);
            el.removeAttribute('style');
            });
            });*/

            Logger.log('Legacy cleanup complete ✅');
        });
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
            }, 1000);// Adjust delay if needed
        });

        legacyScriptObserver.observe(document.head, { childList: true });
        legacyScriptObserver.observe(document.body, { childList: true });

        setTimeout(() => {
            legacyScriptObserver.disconnect();
            Logger.log('🛑 Legacy script observer disconnected');

        }, 5000);
    }

    function runCleanup($, window, document) {
        "use strict";

        const debugMode = true;
        const patchReport = [];

        // ✅ Suppress ALL WET plugins
        const suppressedPlugins = [
            "wb-inview", "wb-mltmd", "wb-lbx", "wb-calevt",
            "wb-charts", "wb-twitter", "wb-zebra", "wb-txthl", "wb-toggle"
        ];
        suppressedPlugins.forEach(plugin => {
            $(document).on(`wb-init.${plugin}`, event => {
                event.stopImmediatePropagation();
                if (debugMode) Logger.log("Suppressed plugin:", plugin);
            });
        });

        if (debugMode) {
            $(document).on("wb-init", event => {
                Logger.log("Plugin initialized:", event.namespace, event.target);
            });
        }

        // ✅ Prevent jQuery UI dialog/datepicker from initializing
        $.fn.dialog = function () {
            if (debugMode) Logger.warn("dialog() suppressed");
            return this;
        };
        $.fn.datepicker = function () {
            if (debugMode) Logger.warn("datepicker() suppressed");
            return this;
        };

        // ✅ Safe Dojo widget cleanup
        if (window.dijit?.registry?.forEach) {
            dijit.registry.forEach(widget => {
                if (!widget.domNode || !widget.domNode.offsetParent) {
                    widget.destroyRecursive();
                    if (debugMode) Logger.log("Destroyed unused Dojo widget:", widget.id);
                }
            });
        }

        // ✅ Patch legacy fonts
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
        patchReport.push("✅ XHR Patch: Logging enabled for all requests");

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
            $(".wb-overlay").each(function () {
                if (!$(this).is(":visible")) {
                    $(this).remove();
                    if (debugMode) Logger.log("Removed hidden overlay:", this.id);
                }
            });
        }, 3000);

        //Migrates scripts from Core 4.0



        // ✅ Final report
        Logger.log("✅ AWOS Cleanup Suite complete");
        console.table(patchReport);
    }

    const CleanupSuite = (() => {
        const AWOSRestorer = (() => {

            function restoreTimePopups() {
                const timeElements = document.querySelectorAll('.awos-time');
                timeElements.forEach(el => {
                    el.title = el.textContent.trim();
                });
            }

            function restoreNavButtons() {
                const navContainer = document.querySelector('#report-nav');
                if (!navContainer) return;

                const prev = document.createElement('button');
                prev.textContent = 'Previous';
                prev.onclick = () => history.back();

                const next = document.createElement('button');
                next.textContent = 'Next';
                next.onclick = () => history.forward();

                navContainer.append(prev, next);
            }

            return {
                run: () => {
                    restoreTimePopups();
                    restoreNavButtons();
                    Logger.log('[AWOSRestorer] AWOS fixes applied.');
                }
            };
        })();

        function run() {
            const path = window.location.pathname;
            if (path.includes('/AWOS/')) {
                AWOSRestorer.run();
            }


            runCleanup(jQuery, window, document)
            observeLegacyScripts();
            cleanupLegacy();


            Logger.info ('[CleanupSuite] CFWOS Cleanup Suite complete.');
        }

        return { run };
    })();
})();