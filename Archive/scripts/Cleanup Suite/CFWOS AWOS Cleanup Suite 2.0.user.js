// ==UserScript==
// @name         CFWOS AWOS Cleanup Suite 2.0
// @namespace    http://tampermonkey.net/
// @version      2.0
// @description  Suppress unused WET plugins and patch legacy AWOS quirks
// @match        https://met.forces.gc.ca/english/airops/AWOS/*
// @grant        none
// @run-at       document-end
// ==/UserScript==

(function () {
  'use strict';

  (function waitForDependencies() {
    if (typeof jQuery === "undefined") {
      console.log("Waiting for jQuery...");
      setTimeout(waitForDependencies, 250);
      return;
    }

    document.addEventListener("AWOSCoreReady", () => {
      console.log("✅ AWOSCoreReady received — running cleanup");
      runCleanup(jQuery, window, document);
    });
  })();

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

  function runCleanup($, window, document) {
    "use strict";

    const debugMode = true;
    const patchReport = [];

    // ✅ Suppress unused WET plugins
    const suppressedPlugins = [
      "wb-inview", "wb-mltmd", "wb-lbx", "wb-calevt",
      "wb-charts", "wb-twitter", "wb-zebra", "wb-txthl", "wb-toggle"
    ];
    suppressedPlugins.forEach(plugin => {
      $(document).on(`wb-init.${plugin}`, event => {
        event.stopImmediatePropagation();
        if (debugMode) console.log("Suppressed plugin:", plugin);
      });
    });

    if (debugMode) {
      $(document).on("wb-init", event => {
        console.log("Plugin initialized:", event.namespace, event.target);
      });
    }

    // ✅ Prevent jQuery UI dialog/datepicker from initializing
    $.fn.dialog = function () {
      if (debugMode) console.warn("dialog() suppressed");
      return this;
    };
    $.fn.datepicker = function () {
      if (debugMode) console.warn("datepicker() suppressed");
      return this;
    };

    // ✅ Safe Dojo widget cleanup
    if (window.dijit?.registry?.forEach) {
      dijit.registry.forEach(widget => {
        if (!widget.domNode || !widget.domNode.offsetParent) {
          widget.destroyRecursive();
          if (debugMode) console.log("Destroyed unused Dojo widget:", widget.id);
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
                if (debugMode) console.log(`[Font Patch] Replaced ${font}`);
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
        if (debugMode) console.log(`[Zoom Patch] Applied scale(${zoomValue}) to`, el);
      });
      patchReport.push(`✅ Zoom Patch: Applied to ${zoomElements.length} element(s)`);
    } else {
      patchReport.push("🔕 Zoom Patch: No elements found using 'zoom'");
    }

    // ✅ Override document.cookie
    Object.defineProperty(document, "cookie", {
      get: () => {
        if (debugMode) console.log("[Cookie Patch] Accessed cookies");
        return "";
      },
      set: val => {
        if (debugMode) console.log("[Cookie Patch] Blocked cookie set:", val);
      }
    });
    patchReport.push("✅ Cookie Patch: Getter/setter overridden");

    // ✅ Log all XHR requests
    const originalOpen = XMLHttpRequest.prototype.open;
    XMLHttpRequest.prototype.open = function (...args) {
      if (debugMode) console.log("[XHR Patch] Request:", args);
      return originalOpen.apply(this, args);
    };
    const originalSend = XMLHttpRequest.prototype.send;
    XMLHttpRequest.prototype.send = function (...args) {
      if (!this.async) {
        console.warn("[XHR Patch] ⚠️ Synchronous XHR detected:", this);
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
          if (debugMode) console.log("Removed hidden overlay:", this.id);
        }
      });
    }, 3000);

    //Migrates scripts from Core 4.0
    cleanupLegacy();

    /*// ✅ Visual badge
    const badge = document.createElement("div");
    badge.textContent = "AWOS Cleanup Active";
    badge.style.cssText = `
      position: fixed;
      bottom: 10px;
      right: 10px;
      background: #222;
      color: #fff;
      padding: 5px 10px;
      font-size: 12px;
      z-index: 9999;
      border-radius: 4px;
      box-shadow: 0 0 5px rgba(0,0,0,0.3);
    `;
    document.body.appendChild(badge);
*/
    // ✅ Final report
    console.log("✅ AWOS Cleanup Suite complete");
    console.table(patchReport);
  }

})();