// ==UserScript==
// @name         CFWOS WET Plugin Override
// @namespace    http://tampermonkey.net/
// @version      1.4
// @description  Suppress unused WET plugins
// @match        https://met.forces.gc.ca/english/airops/AWOS/*
// @grant        none
// @run-at       document-end
// ==/UserScript==

(function waitForDependencies() {
  if (typeof jQuery === "undefined") {
    console.log("Waiting for jQuery...");
    setTimeout(waitForDependencies, 250);
    return;
  }

  (function($, window, document) {
    "use strict";

    const debugMode = true;


    // ✅ Suppress unused WET plugins
    const suppressedPlugins = [
      "wb-inview", "wb-mltmd", "wb-lbx", "wb-calevt",
      "wb-charts", "wb-twitter", "wb-zebra", "wb-txthl", "wb-toggle"
    ];
    suppressedPlugins.forEach(plugin => {
      $(document).on(`wb-init.${plugin}`, function(event) {
        event.stopImmediatePropagation();
        if (debugMode) console.log("Suppressed unused plugin:", plugin);
        console.log("Suppressed plugin", { plugin });
      });
    });

    // ✅ Log all plugin init attempts
    if (debugMode) {
      $(document).on("wb-init", function(event) {
        console.log("Plugin initialized:", event.namespace, event.target);

      });
    }

    // ✅ Prevent jQuery UI dialog/datepicker from initializing
    $.fn.dialog = function() {
      if (debugMode) console.warn("dialog() suppressed");
      console.log("dialog() suppressed");
      return this;
    };
    $.fn.datepicker = function() {
      if (debugMode) console.warn("datepicker() suppressed");
      console.log("datepicker() suppressed");
      return this;
    };

    // ✅ Safe Dojo widget cleanup
    if (window.dijit && dijit.registry && typeof dijit.registry.forEach === "function") {
      dijit.registry.forEach(function(widget) {
        if (!widget.domNode || !widget.domNode.offsetParent) {
          widget.destroyRecursive();
          if (debugMode) console.log("Destroyed unused Dojo widget:", widget.id);
          }
      });
    } else {
      if (debugMode) console.log("Dojo not active or registry unavailable — skipping cleanup.");
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
      $(".wb-overlay").each(function() {
        if (!$(this).is(":visible")) {
          $(this).remove();
          if (debugMode) console.log("Removed hidden overlay:", this.id);
        }
      });
    }, 3000);

    // ✅ Visual badge to confirm script is active
    document.addEventListener("DOMContentLoaded", function() {
      const badge = document.createElement("div");
      badge.textContent = "Override Active";
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
    });

  })(jQuery, window, document);
})();
