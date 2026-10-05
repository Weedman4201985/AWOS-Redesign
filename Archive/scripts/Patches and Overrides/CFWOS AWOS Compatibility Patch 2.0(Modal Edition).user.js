// ==UserScript==
// @name         CFWOS AWOS Compatibility Patch 2.0(Modal Edition)
// @namespace    http://your.namespace/here
// @version      2.0
// @description  Patch legacy quirks and log diagnostics for AWOS layout
// @author       Chris
// @match        https://met.forces.gc.ca/english/airops/*
// @grant        document-idle
// ==/UserScript==

(function () {
    'use strict';

   // if (location.search.includes('&detail=')) {
   //   return; // stop loading the rest of the script entirely
   // }

   function isDetailModal() {
      return location.search.includes('detail=');
    }

    console.log('🟢 CFWOS AWOS Compatibility Patch is initializing...');

    const ENABLE_ZOOM_FIX = true;
    const ENABLE_FONT_BLOCK = true;
    const ENABLE_COOKIE_OVERRIDE = true;
    const ENABLE_XHR_LOGGING = true;

    const patchReport = [];

    function onReady(fn) {
        if (isDetailModal()) return;

        if (document.readyState !== 'loading') fn();
        else document.addEventListener('DOMContentLoaded', fn);
    }

    // 🔍 Patch 1: Replace 'zoom' with 'transform: scale'
    function patchZoom() {
        const zoomElements = [...document.querySelectorAll('*')].filter(el => el.style.zoom);
        if (zoomElements.length === 0) {
            patchReport.push('🔕 Zoom Patch: No elements found using "zoom"');
            return;
        }

        zoomElements.forEach(el => {
            const zoomValue = el.style.zoom;
            el.style.transform = `scale(${zoomValue})`;
            el.style.transformOrigin = 'top left';
            el.style.zoom = '';
            console.log(`[Zoom Patch] Applied scale(${zoomValue}) to`, el);
        });

        patchReport.push(`✅ Zoom Patch: Applied to ${zoomElements.length} element(s)`);
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
            patchReport.push('🔕 Font Patch: No legacy fonts found');
        } else {
            patchReport.push(`✅ Font Patch: Replaced ${patchedCount} legacy font reference(s)`);
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
        patchReport.push('✅ Cookie Patch: Getter/setter overridden');
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

        patchReport.push('✅ XHR Patch: Logging enabled for all requests');
    }

    // 🚀 Run patches after short delay
    onReady(() => {
        setTimeout(() => {
            console.log('⚙️ Running AWOS Compatibility Patches...');
            if (ENABLE_ZOOM_FIX) patchZoom();
            if (ENABLE_FONT_BLOCK) blockLegacyFonts();
            if (ENABLE_COOKIE_OVERRIDE) overrideCookie();
            if (ENABLE_XHR_LOGGING) logXHR();

            console.log('✅ AWOS Compatibility Patch is complete');
            console.table(patchReport);
        }, 1000); // Delay to ensure styles are loaded
    });
})();
