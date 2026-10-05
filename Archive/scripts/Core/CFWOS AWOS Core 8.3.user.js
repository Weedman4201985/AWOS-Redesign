// ==UserScript==
// @name         CFWOS AWOS Core 8.3
// @version      8.3e(Dark mode update)
// @description  Edge Browser benchmark. Works best on edge
// @author       Chris
// @match        https://met.forces.gc.ca/english/airops/AWOS/*
// @grant        none
// @run-at       document-start
// ==/UserScript==
/*
───────────────────────────────────────────────
🧭 CFWOS AWOS Core 8.x — System Flow Spec
───────────────────────────────────────────────

🚀 Phase 0 — Logger Core IIFE (first code to run)

  ** Critical dependency **
    All other scripts (Core logic, Cleanup Suite, Layout Enhancer, etc.)
    assume Logger exists. If this IIFE fails, the entire AWOS stack fails.
  ** Critical dependency **


  - Self-contained IIFE at very top of Core file
  - Defines global Logger object with:
    • Logger.info(), Logger.warn(), Logger.error()
    • Logger.log()
    • Logger.group()
    • Logger.perf()
    • Logger.perfWrap()
    • Logger.perfMark()
    • Logger.modules.register()
                    .whenReady()
  📢 Logging details:
    • Logger.info(): lifecycle milestones (UI suppression, injections, registry)
    • Logger.log(): detailed, granular debug/info (XHR, cookie access, mutation summaries)
    • Logger.warn(): duplicate module registration, skipped mutations
    • Logger.error():
    • Logger.group(): grouped console output
    • Logger.perf('start'/'stop', label): perf timing spans
    • Logger.perfWrap(fn, label): wraps a function with perf timing
    • Logger.perfMark(label): drop a named checkpoint
    • Logger.modules.register(name): Registers modules
                    .whenReady(deps, fn) listens for registered modules

  📦 Module system
    - register('core') after DOM ready
    - Other modules listen via Logger.modules.whenReady(['core'], ...)
    - Cleanup Suite signals completion by register('cleanup')
    - register() ignores duplicate names; whenReady() dedupes queued callbacks

🚀 Phase 1 — Early patch phase
  - Runs before DOMContentLoaded
  - waitForHeadAndInjectFavicon(): injects dummy favicon
  - patchZoom(): replaces CSS zoom with transform: scale
  - Optional patches: font block, cookie override, XHR logging
  - Logs patch summary via Logger

🧠 Phase 2 — DOM/UI setup (DOMContentLoaded)
- setupTopBar():
  • Creates manual top bar container with id #awos-top-bar
  • Defines “zones” (e.g., topLeft, topRight) for button placement
  • Appends to DOM early so observers can filter it out
- interceptMouseoverPopups(), findAllMouseoverElements(): UI helpers for AWOS hover elements
- Conditional UI suppression:
  • window.awosSuppressUI = (window.self !== window.top)
  • If suppressed: skip all UI injections
  • If not suppressed: inject full UI suite

📦 UI Injection Suite (if not suppressed)
1) **Auto-Refresh Toggle** (injectAutoRefreshToggle)
   - Persistent text node label (no DOM bloat)
   - setInterval tick every 1000 ms updates countdown
   - BroadcastChannel 'awos-refresh-sync' broadcasts {enabled, secondsLeft}
   - forcePageReload() when countdown hits 0 or on re-enable
   - Countdown mutations excluded from Cleanup observer via #awos-top-bar filter
2) **Report Viewer Button**
   - Opens stored AWOS report snapshots from localStorage
   - Restores state into viewer panel
3) **Debug Button**
   - Toggles debug logging and/or UI overlays
   - May expose extra Logger output for dev mode
4) **New Stations Button**
   - Opens station management UI
   - Allows adding/removing monitored stations
5) **Reset Floater Button**
   - Clears floater position/state from localStorage
   - Forces reinitialization on next load
- removeLegacyScripts() runs after UI injection to strip old AWOS scripts/styles

───────────────────────────────────────────────
*/
(function () {

      /*

      ─────────────────────────────────────────────
       🧭 AWOS Logger Performance Legend — Core 8.x
      ─────────────────────────────────────────────

      Logger.perf('start', 'Label')     // Start stopwatch
      Logger.perf('stop', 'Label')      // Stop and log elapsed time

      Logger.perfWrap(fn, 'Label')      // Wrap function with perf timing

      FUNCTION/METHOD EXAMPLE
      const timedFn = Logger.perfWrap(myFunction, 'MyFunction');
      timedFn();

      Wrap it in an arrow function
      Logger.perfWrap(() => runCleanup(window, document), 'runCleanup()')();

      IIFE EXAMPLE:
      Logger.perfWrap(function Core8x() {...}, 'Core8x')();

      Logger.perfMark('Label')          // Drop a named checkpoint.
                                        // Logs +Δ(delta) since last mark

      Logger.perfMark('AWOS Init');   // Start of checkpoint
      Logger.perfMark('AWOS Init');   // End of checkpoint.

      🟢 Output:
      ⏱️ [Label] start 123.456
      🟢 [Label] finished — took 87.123 ms
      📍 [Label] +120.500 ms since last mark

      ─────────────────────────────────────────────
*/

  'use strict';

  if (window.Logger) return;

  window.Logger = {

    /*log(...args) {
      console.log('🟢%c', 'color: #00bfff; font-weight: bold;', ...args);
    },*/  // OLD Logger

    /*log(message, style = 'color: #00bfff; font-weight: bold;', ...args) {
      console.log(`🟢%c${message}`, style, ...args);
    },*/ // NEW Logger V1

    /*log(...args) {
      const defaultStyle = 'color: #00bfff; font-weight: bold;';

      // If first arg is a string and second arg is a style string, use it
      if (typeof args[0] === 'string' && typeof args[1] === 'string' && /[:;]/.test(args[1])) {
        const [message, style, ...rest] = args;
        console.log(`%c${message}`, style, ...rest);
      } else {
        // Otherwise, apply default style to first string and pass the rest
        const [message, ...rest] = args;
        if (typeof message === 'string') {
          console.log(`%c${message}`, defaultStyle, ...rest);
        } else {
          // If first arg isn’t a string, just log everything normally
          console.log(...args);
        }
      }
    },*/ // NEW Logger.log V3

    log(...args) {
      let style = 'color: #00bfff; font-weight: bold;';
      let message = args[0];
      let rest = args.slice(1);

      // If second arg is a string and looks like a CSS style, treat it as style
      if (typeof rest[0] === 'string' && /[:;]/.test(rest[0])) {
        style = rest[0];
        args = rest.slice(1);

      }

      console.log(`🟢%c ${message}`, style, ...args);

    }, // NEW Logger V4

    group(name, fn) {
      console.groupCollapsed(`📂%c[Group] ${name}`, 'color: #00bfff; font-weight: bold;');
      try { fn(); } catch (e) {
        console.error('[Logger.group] ❌ group error:', e);
      }
      console.groupEnd();
    },
    error(...args) {
      console.error('%c[ERROR] ❌', 'color: red; font-weight: bold;', ...args);
    },
    warn(...args) {
      console.warn('%c[WARN] ⚠️', 'color: orange; font-weight: bold;', ...args);
    },
    info(...args) {
      console.info('%c[INFO] ℹ️', 'color: green; font-weight: bold;', ...args);
    },
    debug(...args) {
      if (window.AWOS_DEBUG) {
        console.debug('%c[DEBUG] 🐞', 'color: gray; font-weight: bold;', ...args);
      }
    },
    perf(action = 'start', overrideLabel = null, defaultLabel = 'Script', ...args) {
      let label = overrideLabel || defaultLabel;

      // Only try to auto-detect if no override provided
      if (!overrideLabel) {
        try {
          const err = new Error();
          const stackLines = err.stack.split('\n');

          // stackLines[0] = "Error"
          // stackLines[1] = "    at Logger.perf ..."
          // stackLines[2] = "    at FunctionName ..." or "    at Object.methodName ..."
          const callerLine = stackLines[2] || '';
          const match = callerLine.match(/at\s+(.*?)\s*\(/);
          if (match && match[1]) {
            label = match[1].trim();
          }
        } catch {
          // ignore, fallback to defaultLabel
        }
      }

      this._perfTimes = this._perfTimes || {};

      if (action.toLowerCase() === 'start') {
        this._perfTimes[label] = performance.now();
        this.log(`⏱️ [${label}] start ${this._perfTimes[label].toFixed(3)} ms`, 'color: limegreen; font-weight: bold;');
      }
      else if (action.toLowerCase() === 'stop') {
        const now = performance.now();
        let duration = now;

        if (this._perfTimes[label]) {
          duration = now - this._perfTimes[label];
          delete this._perfTimes[label];
        }
        this._perfTimes[label] = now;
        this.log(`[${label}] finished ${now.toFixed(3)} ms - took ${duration.toFixed(3)} ms`, 'color: red; font-weight: bold;');
      }
      else {
        this.warn(`[Logger.perf] Unknown action "${action}". Use "start" or "stop".`);
      }
    },
    perfWrap(fn, overrideLabel = null) {
      if (typeof fn !== 'function') {
        this.warn('[Logger.perfWrap] First argument must be a function');
        return;
      }
      const label = overrideLabel || fn.name || 'anonymous';
      return (...args) => {
        this.perf('start', label);
        const result = fn.apply(this, args);
        if (result instanceof Promise) {
          return result.finally(() => this.perf('stop', label));
        }
        this.perf('stop', label);
        return result;
      };
    },
    perfTimeMark(label) {
      this._perfTimeMarks = this._perfTimeMarks || {};
      const now = performance.now();
      if (!this._perfTimeMarks[label]) {
        this._perfTimeMarks[label] = now;
        this.log(`📍[${label}] time mark set at ${now.toFixed(3)} ms`, 'color: gold; font-weight: bold;');

      } else {
        const duration = now - this._perfTimeMarks[label];
        this.log(`📍[${label}] +${duration.toFixed(3)} ms since last time mark`, 'color: gold; font-weight: bold;');

        this._perfTimeMarks[label] = now;
      }
    }

  };
  Logger.modules = {
    ready: {},
    queue: [],
    register(name) {
      if (this.ready[name]) {
        Logger.warn(`[Logger.Module.register] "${name}" already registered — ignoring duplicate.`);
        return;
      }
      this.ready[name] = true;
      Logger.log(`[Logger.Module.Ready] Module registered: ${name}`);

      if (this.queue[name]) {
        this.queue[name].forEach(cb => cb());
        delete this.queue[name];
      }
      // Check queued callbacks
      this.queue = this.queue.filter(({ deps, fn }) => {
        if (deps.every(dep => this.ready[dep])) {
          try {
            fn();
          } catch (e) {
            Logger.error(`[Logger.modules.queue] Error running module callback for ${name}:`, e);
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

  // --- Perf table collector ---
  const perfRecords = [];

  // Wrap existing perf
  const _origPerf = Logger.perf;
  Logger.perf = function (action = 'start', overrideLabel = null, defaultLabel = 'Script') {
    // Call the original logic (keeps auto-label + console output)
    _origPerf.call(this, action, overrideLabel, defaultLabel);

    // Also record for summary table
    const label = overrideLabel || defaultLabel;
    if (action.toLowerCase() === 'start') {
      perfRecords.push({ type: 'perf', label, start: performance.now(), end: null, duration: null });
    } else if (action.toLowerCase() === 'stop') {
      const rec = [...perfRecords].reverse().find(r => r.type === 'perf' && r.label === label && r.end === null);
      if (rec) {
        rec.end = performance.now();
        rec.duration = rec.end - rec.start;
      }
    }
  };

  // Wrap existing perfWrap
  const _origPerfWrap = Logger.perfWrap;
  Logger.perfWrap = function (fn, overrideLabel = null) {
    const label = overrideLabel || fn.name || 'anonymous';
    return _origPerfWrap.call(this, function (...args) {
      const start = performance.now();
      perfRecords.push({ type: 'perfWrap', label, start, end: null, duration: null });
      try {
        return fn.apply(this, args);
      } finally {
        const end = performance.now();
        const rec = [...perfRecords].reverse().find(r => r.type === 'perfWrap' && r.label === label && r.end === null);
        if (rec) {
          rec.end = end;
          rec.duration = rec.end - rec.start;
        }
      }
    }, label);
  };

  // Wrap existing perfMark
  const _origPerfTimeMark = Logger.perfTimeMark;
  Logger.perfTimeMark = function (label) {
    _origPerfTimeMark.call(this, label); // keep console output
    perfRecords.push({ type: 'perfTimeMark', label, time: performance.now() });
  };

  // Dump table after everything has loaded
  Logger.modules.whenReady(['core', 'cleanup', 'layout'], () => {
    Logger.info("📊[Logger.modules.whenReady] Dumping performance table after page load");

    if (perfRecords.length) {
      const filtered = perfRecords.filter((rec, idx, arr) => {
        if (rec.type === 'perf') {
          return !arr.some(r =>
            r.type === 'perfWrap' &&
            r.label === rec.label &&
            Math.abs((r.start || 0) - (rec.start || 0)) < 1
          );
        }
        return true;
      });

      const sorted = [...filtered].sort((a, b) => {
        const aTime = a.type === 'perfTimeMark' ? a.time : a.start;
        const bTime = b.type === 'perfTimeMark' ? b.time : b.start;
        return (aTime || 0) - (bTime || 0);
      });

      console.table(sorted.map(r => ({
        Type: r.type,
        Label: r.label,
        Start: r.start?.toFixed?.(2) || '',
        End: r.end?.toFixed?.(2) || '',
        Duration: r.duration ? r.duration.toFixed(2) + ' ms' : '',
        Time: r.type === 'perfTimeMark'
          ? r.time.toFixed(2) + ' ms'
          : ''
      })));
    }
  });

  Logger.info('🚀[Logger] AWOS Logger Utility v1.0 initialized');
  Logger.modules.register('logger');

})();

const REFRESH_INTERVAL = 60;
let suiteResponded = false;
if (localStorage.getItem('refreshEnabled') === null) {
    localStorage.setItem('refreshEnabled', 'false');
    Logger.log('[AWOS Core] Initialized refreshEnabled to false');
}

(function earlyPatch() {

  const ENABLE_INJECT_FAVICON = true
  const ENABLE_ZOOM_FIX = true;
  const ENABLE_FONT_BLOCK = true
  const ENABLE_COOKIE_OVERRIDE = true;
  const ENABLE_XHR_LOGGING = true;

  const earlyPatchReport = [];

  // 💉 Patch 1: Inject Favicon
  function waitForHeadAndInjectFavicon() {
        const inject = () => {
            const link = document.createElement('link');
            link.rel = 'icon';
            link.type = 'image/png';
            link.href = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8Xw8AAoMBgZkKXnUAAAAASUVORK5CYII=';
            document.head.appendChild(link);
            Logger.info('[AWOS Core] Dummy favicon injected safely');
        };
        const interval = setInterval(() => {
            if (document.head) {
              clearInterval(interval);
              inject();
            }
        }, 10);
          earlyPatchReport.push('💉 Favicon injection successfull');
    }

  // 🔍 Patch 2: Replace 'zoom' with 'transform: scale'
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

  // 🧼 Patch 3: Block legacy fonts
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

  // 🍪 Patch 4: Override document.cookie
  function overrideCookie() {
        try {
          Object.defineProperty(document, 'cookie', {
            configurable: true,
            get: function () {
              Logger.info('[Cookie Patch] Accessed cookies');
              return `metweb_settings=setting_norefresh&${REFRESH_INTERVAL}`;
            },
            set: function (val) {
              Logger.info('[Cookie Patch] Blocked cookie set:', val);
            }
          });

          earlyPatchReport.push('✅ Cookie Patch: Getter/setter overridden, REFRESH_INTERVAL set');
        } catch (e) {
          Logger.warn('[Cookie Patch] Failed to override document.cookie:', e);
          earlyPatchReport.push('⚠️ Cookie Patch: Override failed');
      }
    }

  // 📡 Patch 5: Log all XHR requests
  function logXHR() {
      const originalOpen = XMLHttpRequest.prototype.open;
      XMLHttpRequest.prototype.open = function (...args) {
          Logger.log('[XHR Patch] Request:', args);
          return originalOpen.apply(this, args);
      };
      const originalSend = XMLHttpRequest.prototype.send;
      XMLHttpRequest.prototype.send = function (...args) {
          if (this.async === false) {
              Logger.warn('[XHR Patch] ⚠️ Synchronous XHR detected:', this);
          }
          return originalSend.apply(this, args);
      };
      earlyPatchReport.push('✅ XHR Patch: Logging enabled for all requests');
  }

  // ✅ Final report
  Logger.info('⚙️ Running early Patches...');

  if (ENABLE_COOKIE_OVERRIDE) overrideCookie();
  if (ENABLE_INJECT_FAVICON) waitForHeadAndInjectFavicon();
  if (ENABLE_ZOOM_FIX) patchZoom();
  if (ENABLE_FONT_BLOCK) blockLegacyFonts();
  if (ENABLE_XHR_LOGGING) logXHR();

  Logger.group('📊 Patch Table', () => {
    console.table(earlyPatchReport);
  });

  Logger.info('✅ Early patch is complete and table generated');

})();

(function () {
  'use strict';

  const DEBUG_MODE = false;
  function getPanelKeys(panelType) {
      return {
        urlKey: `${panelType}-url`,
        snapshotKey: `${panelType}-snapshot`,
        timestampKey: `${panelType}-timestamp`,
        positionKey: `${panelType}-position`,
        sizeKey: `${panelType}-size`
      };
    }
  function injectFakeRefreshMeta(intervalSeconds = 60) {
      let meta = document.querySelector('meta[http-equiv="refresh"]');
      if (!meta) {
        meta = document.createElement('meta');
        meta.setAttribute('http-equiv', 'refresh');
        document.head.appendChild(meta);
      }
      meta.setAttribute('content', `${intervalSeconds}`);
    }
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
          window.location.reload(); // ✅ standard reload
          //location.href = location.href;
    }
  function getSunTimes(date, lat, lng, elevationMeters = 0) {
      const D2R = Math.PI / 180, R2D = 180 / Math.PI;
      const zenith = 90.833 - (0.0347 * (elevationMeters / 1000));

      function calc(isRise) {
        const N = Math.floor((Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()) - Date.UTC(date.getUTCFullYear(), 0, 0)) / 86400000);
        const lngHour = lng / 15;
        const t = N + ((isRise ? 6 : 18) - lngHour) / 24;

        const M = 0.9856 * t - 3.289;
        let L = M + 1.916 * Math.sin(D2R * M) + 0.020 * Math.sin(2 * D2R * M) + 282.634;
        L = (L + 360) % 360;

        let RA = R2D * Math.atan(0.91764 * Math.tan(D2R * L));
        RA = (RA + 360) % 360;
        const Lq = Math.floor(L / 90) * 90, RAq = Math.floor(RA / 90) * 90;
        RA = (RA + Lq - RAq) / 15;

        const sinDec = 0.39782 * Math.sin(D2R * L);
        const cosDec = Math.cos(Math.asin(sinDec));
        const cosH = (Math.cos(D2R * zenith) - sinDec * Math.sin(D2R * lat)) / (cosDec * Math.cos(D2R * lat));
        if (cosH > 1 || cosH < -1) return null;

        const H = (isRise ? 360 - R2D * Math.acos(cosH) : R2D * Math.acos(cosH)) / 15;
        const T = H + RA - 0.06571 * t - 6.622;
        const UT = (T - lngHour + 24) % 24;

        const hr = Math.floor(UT);
        const min = Math.round((UT - hr) * 60);
        return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), hr + (min === 60 ? 1 : 0), (min === 60 ? 0 : min), 0));
      }

      return { sunrise: calc(true), sunset: calc(false) };
    }
  function getLatestHourlyTimestamp() {
      const now = new Date();
      now.setUTCMinutes(0, 0, 0); // snap to top of the hour
      const pad = (n) => n.toString().padStart(2, '0');
      return `${now.getUTCFullYear()}${pad(now.getUTCMonth() + 1)}${pad(now.getUTCDate())}${pad(now.getUTCHours())}00`;
    }

  function computeEffectiveMode(options = {}) {
      const { nowUTC: overrideNowUTC } = options;
      const modeType = window.awosDarkModeType;
      let isDark = false;
      let source = 'default';
      let coords = null;

      switch (modeType) {
        case 'dark':
          isDark = true;
          source = 'manual';
          break;

        case 'light':
          isDark = false;
          source = 'manual';
          break;

        case 'auto':
          coords = getStationCoordinatesFromPage();
          if (coords) {
            const { sunrise, sunset } = getSunTimes(new Date(), coords.lat, coords.lng, coords.elevation);
            const nowUTC = overrideNowUTC || getAwosUtcNowFromPage() || new Date();
            window.awosDarkAutoState = (nowUTC >= sunset) || (nowUTC < sunrise);
            isDark = window.awosDarkAutoState;
            source = 'auto';
          } else {
            window.awosDarkAutoState = null;
            isDark = false; // fallback
            source = 'auto (no coords)';
          }
          break;

        case 'default':
        default:
          isDark = false; // site default
          source = 'default';
      }

      window.awosDarkMode = isDark;
      window.awosModeSource = source;

      Logger.info(
        `[Mode Compute: Function] type=${modeType}, dark=${isDark}, source=${source}, auto=${window.awosDarkAuto}, autoState=${window.awosDarkAutoState ?? 'n/a'}${coords ? `, coords=${coords.lat.toFixed(4)},${coords.lng.toFixed(4)}` : ''}${overrideNowUTC ? `, testTime=${overrideNowUTC.toISOString()}` : ''}`
      );

      return isDark;
}
  function getEffectiveModeDetails(options = {}) {
      const { nowUTC: overrideNowUTC } = options;
      const modeType = window.awosDarkModeType;
      const coords = getStationCoordinatesFromPage();
      const nowUTC = overrideNowUTC || getAwosUtcNowFromPage() || new Date();

      let sunrise = null, sunset = null, isDark = false, source = 'default';
      let nextChangeUTC = null, nextModeLabel = null;
      let autoState = null;

      if (coords) {
        const sunTimes = getSunTimes(new Date(), coords.lat, coords.lng, coords.elevation);
        sunrise = sunTimes.sunrise;
        sunset = sunTimes.sunset;

        autoState = (nowUTC >= sunset) || (nowUTC < sunrise);

        if (autoState) {
          nextChangeUTC = (nowUTC < sunrise) ? sunrise : new Date(sunrise.getTime() + 86400000);
          nextModeLabel = '☀️ Light Mode';
        } else {
          nextChangeUTC = sunset;
          nextModeLabel = '🌙 Dark Mode';
        }
      }

      switch (modeType) {
        case 'dark':
          isDark = true;
          source = 'manual';
          break;
        case 'light':
          isDark = false;
          source = 'manual';
          break;
        case 'auto':
          isDark = autoState ?? false;
          source = coords ? 'auto' : 'auto (no coords)';
          break;
        case 'default':
        default:
          isDark = false;
          source = 'default';
      }

      return {
        isDark,
        source,
        nowUTC,
        sunrise,
        sunset,
        nextChangeUTC,
        nextModeLabel,
        coords,
        autoState
      };
    }

  function extractAwosStations() {
      const checkboxes = document.querySelectorAll('input[type="checkbox"][name="id"]');
      const stations = [];

      checkboxes.forEach(cb => {
        const icao = cb.value?.trim();
        const label = cb.nextElementSibling?.textContent?.trim();
        if (icao && /^[A-Z]{4}$/.test(icao)) {
          stations.push({
            icao,
            label,
            url: `https://met.forces.gc.ca/english/airops/AWOS/?id=${icao}`
          });
        }
      });

      return stations;
    }
  function getStationCoordinatesFromPage() {
      const el = document.querySelector('.mwconditions_temperature');
      if (!el) return null;

      const text = el.textContent.trim();

      const icaoMatch = text.match(/^([A-Z]{4})\s*-/);
      const icao = icaoMatch ? icaoMatch[1] : '????';

      const coordMatch = text.match(/(\d{2})'(\d{2})'(\d{2})N\s+(\d{2,3})'(\d{2})'(\d{2})W/);
      if (!coordMatch) return null;

      const lat = +coordMatch[1] + coordMatch[2] / 60 + coordMatch[3] / 3600;
      const lng = -(+coordMatch[4] + coordMatch[5] / 60 + coordMatch[6] / 3600);

      const elevMatch = text.match(/(\d+(?:\.\d+)?)m/);
      const elevation = elevMatch ? +elevMatch[1] : 0;

      return { icao, lat, lng, elevation };
    }
  function getAwosUtcNowFromPage() {
      const m = document.body.textContent.match(/(\d{2}):(\d{2})(?::(\d{2}))?\s*UTC/);
      if (!m) return null;
      const now = new Date();
      const hh = +m[1], mm = +m[2], ss = m[3] ? +m[3] : 0;
      return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), hh, mm, ss));
    }

  function toggleDarkMode() {
    const wasAutoOn = window.awosDarkAuto;
    const prevAutoState = window.awosDarkAutoState;

    // Decide new mode type based on click
    if (wasAutoOn) {
      if (!window.awosDarkMode === prevAutoState) {
        window.awosDarkModeType = 'auto'; // clear override
      } else {
        window.awosDarkModeType = !window.awosDarkMode ? 'dark' : 'light'; // set override
      }
    } else {
      window.awosDarkModeType = !window.awosDarkMode ? 'dark' : 'light';
    }

    localStorage.setItem('awosDarkModeType', window.awosDarkModeType);

    // Recompute final mode
    computeEffectiveMode();

    // Decide source label for logging
    let sourceLabel = 'via Manual Toggle';
    if (wasAutoOn && window.awosDarkModeType !== 'auto') {
      sourceLabel = 'via Manual Override — Auto Switch Overridden';
    } else if (wasAutoOn && window.awosDarkModeType === 'auto') {
      sourceLabel = 'via Manual Toggle — Override Cleared';
    }

    Logger.modules.whenReady(['core', 'cleanup', 'layout'], () => {
      if (typeof applyDarkModeStyles === 'function') {
        applyDarkModeStyles(window.awosDarkMode, 'Manual Toggle', sourceLabel);
      } else {
        Logger.warn('⚠️ applyDarkModeStyles not available when toggling dark mode');
      }
    });
  }
  function applyAutoNightModeIfNeeded(options = {}) {
      if (!window.awosDarkAuto) return;

      const isManualOverride = ['light', 'dark'].includes(window.awosDarkModeType);
      if (isManualOverride) {
        Logger.info(`[Auto Switch] Skipped — manual override active (${window.awosDarkMode ? '🌙 Dark' : '☀️ Light'})`);
        return;
      }

      // Compute using unified logic
      computeEffectiveMode(options);

      // Apply the computed mode
      applyDarkModeStyles(window.awosDarkMode, 'Auto Switch', `via ${window.awosModeSource}`);
      Logger.info(`[Auto Switch] Theme applied: ${window.awosDarkMode ? '🌙 Dark' : '☀️ Light'}`);

      // Detailed log if coords available
      const coords = getStationCoordinatesFromPage();
      if (coords && window.awosDarkModeType === 'auto') {
        const { sunrise, sunset } = getSunTimes(new Date(), coords.lat, coords.lng, coords.elevation);
        const nowUTC = options.nowUTC || getAwosUtcNowFromPage() || new Date();

        Logger.group(`[AWOS Core] Auto theme details: ${coords.icao}`, () => {
          Logger.log(`  🎨 Effective Mode: ${window.awosDarkMode ? '🌙 Dark' : '☀️ Light'} (${window.awosModeSource})`);
          Logger.log(`  📍 Location: ${coords.lat.toFixed(4)}, ${coords.lng.toFixed(4)} | Elev: ${coords.elevation}m`);
          Logger.log(`  ⏱️ Now UTC: ${nowUTC.toISOString()}`);
          Logger.log(`  🌅 Sunrise: ${sunrise.toISOString()}`);
          Logger.log(`  🌇 Sunset:  ${sunset.toISOString()}`);

          let nextChange, nextMode;
          if (window.awosDarkAutoState) {
            nextChange = (nowUTC < sunrise) ? sunrise : new Date(sunrise.getTime() + 86400000);
            nextMode = '☀️ Light Mode';
          } else {
            nextChange = sunset;
            nextMode = '🌙 Dark Mode';
          }

          const diffMs = nextChange - nowUTC;
          const diffH = Math.max(0, Math.floor(diffMs / 3600000));
          const diffM = Math.max(0, Math.floor((diffMs / 60000) % 60));
          Logger.log(`  🔄 Next change (auto): ${nextMode} in ${diffH}h ${diffM}m (at ${nextChange.toISOString()})`);
        });
      }
    }
  function updateModeIndicator(badgeElement) {
      if (!badgeElement) {
        Logger.warn('⚠️ Mode badge not found — cannot update label');
        return;
      }

      const mode = typeof window.awosDarkModeType === 'string' ? window.awosDarkModeType : 'default';
      const isDark = window.awosDarkMode === true;
      const isAuto = mode === 'auto';

      const emojiMap = {
        default: '☀️',
        light: '☀️',
        dark: '🌙',
        auto: isDark ? '🌙' : '☀️'
      };

      const emoji = emojiMap[mode] || '❓';
      badgeElement.textContent = `Mode: ${mode} ${emoji}`;
      Logger.info(`[Mode Badge] Updated: ${mode} ${emoji}`);

      // Apply theme-aware styling
      badgeElement.style.background = isDark ? '#222' : '#eee';
      badgeElement.style.color = isDark ? '#eee' : '#333';
      badgeElement.style.border = isDark ? '1px solid #444' : 'none';
      badgeElement.style.transition = 'background 0.3s ease, color 0.3s ease';
    }

  // Quick reference for testAutoNightMode(hour, minute) and
  // simulateTimeBlock(startHourUTC,endHourUTC, stepMinutes = 5, delayMs = 1000)
  //-----------------------------------------------------------------------------------------

  /* testAutoNightMode(HourUTC,MinuteUTC)
      -simulate an immediate time change to the HR and MIN (UTC) specififed
          EG: testAutoNightMode(10,11);
            -sets the page time to 10:11UTC

    testAutoNightMode();
      -use live AWOS UTC time. Useful for testing the actual AWOS time auto mode

    simulateTimeBlock(startHourUTC, endHourUTC, stepMinutes, delayMs)
      -simulate a time block for dawn-dusk and dusk-dawn transitions
        EG:simulateTimeBlock(10,11,5,1000)
          - sets a time block from 1000UTC-1100UTC
          - checks the auto switch flags in 5 minute steps
          - with each step lasting 1 sec(1000ms)
  */

  function testAutoNightMode(hour, minute) {
      const coords = getStationCoordinatesFromPage();
      if (!coords) return console.warn('No station data parsed');

      let mockNowUTC = null;
      if (typeof hour === 'number' && typeof minute === 'number') {
        const base = new Date();
        mockNowUTC = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth(), base.getUTCDate(), hour, minute, 0));
      }

      const prevModeType = window.awosDarkModeType;
      window.awosDarkModeType = 'auto';

      // Compute using simulated or real time
      computeEffectiveMode({ nowUTC: mockNowUTC });

      if (typeof applyDarkModeStyles === 'function') {
        applyDarkModeStyles(window.awosDarkMode, 'Test Auto Mode', `via ${window.awosModeSource}`);
      }

      // Detailed log
      const { sunrise, sunset } = getSunTimes(new Date(), coords.lat, coords.lng, coords.elevation);
      const nowUTC = mockNowUTC || getAwosUtcNowFromPage() || new Date();

      Logger.group(`[AWOS Core] Auto theme test: ${coords.icao}`, () => {
        Logger.log(`  🎨 Effective Mode: ${window.awosDarkMode ? '🌙 Dark' : '☀️ Light'} (${window.awosModeSource})`);
        Logger.log(`  📍 Location: ${coords.lat.toFixed(4)}, ${coords.lng.toFixed(4)} | Elev: ${coords.elevation}m`);
        Logger.log(`  ⏱️ Now UTC: ${nowUTC.toISOString()}`);
        Logger.log(`  🌅 Sunrise: ${sunrise.toISOString()}`);
        Logger.log(`  🌇 Sunset:  ${sunset.toISOString()}`);
      });

      window.awosDarkModeType = prevModeType;
    }
  function simulateTimeBlock(startHourUTC, endHourUTC, stepMinutes = 5, delayMs = 1000) {
      const coords = getStationCoordinatesFromPage();
      if (!coords) {
        Logger.warn('⚠️ No coordinates available — cannot simulate');
        return;
      }

      let currentHour = startHourUTC;
      let currentMinute = 0;

      const interval = setInterval(() => {
        const simulatedUTC = new Date(Date.UTC(2025, 8, 9, currentHour, currentMinute));
        const details = getEffectiveModeDetails({ nowUTC: simulatedUTC });

        window.awosDarkMode = details.isDark;
        window.awosModeSource = 'Simulated';
        window.awosDarkAutoState = details.autoState;

        applyDarkModeStyles(details.isDark, 'Simulated Time Block', `Simulated ${simulatedUTC.toISOString()}`);
        updateDebugContent(details);
        updateModeIndicator(document.querySelector('#mode-badge'));
        updateVisuals();

        Logger.info(`[Simulated] ${simulatedUTC.toISOString()} → ${details.isDark ? '🌙 Dark' : '☀️ Light'} (autoState=${details.autoState})`);

        currentMinute += stepMinutes;
        if (currentMinute >= 60) {
          currentMinute = 0;
          currentHour++;
        }

        if (currentHour > endHourUTC) {
          clearInterval(interval);
          Logger.info('✅ Simulation complete');
        }
      }, delayMs);
    }

  function getUnifiedButtonColor() {
      return window.awosDarkMode ? '#444' : '#0078D4'; // Slate or blue
    }
  function styleButton(btn, bgColor, overrides = {}) {
      const background = bgColor ?? getUnifiedButtonColor();
      const defaultTextColor = '#ffffff';

      Object.assign(btn.style, {
        padding: '6px 12px',
        fontSize: '13px',
        border: 'none',
        borderRadius: '4px',
        cursor: 'pointer',
        fontFamily: '"Segoe UI", sans-serif',
        boxShadow: 'rgba(0, 0, 0, 0.15) 0px 1px 4px',
        whiteSpace: 'nowrap',
        flex: '0 0 auto',
        background,
        color: overrides.color ?? defaultTextColor,
        ...overrides
      });
    }

  function setupTopBar() {

      if (window.awosSuppressUI) {
        Logger.log('[AWOS Core] Top bar injection suppressed.');
        return null;
      }

      let topBar = document.querySelector('#awos-top-bar');

      if (!topBar) {
        topBar = document.createElement('div');
        topBar.id = 'awos-top-bar';
        topBar.style.cssText = `
          position: sticky;
          top: 0;
          z-index: 1000;
          display: flex;
          flex-direction: column;
          align-items: stretch;
          padding: 10px;
          background: #f8f8f8;
          border-bottom: 1px solid #ccc;
          gap: 8px;
        `;

        if (topBar) {
          topBar.style.fontFamily = '"Segoe UI", sans-serif';
        }

        const title = document.querySelector('main h1');
        if (title) {
          title.style.margin = '0';
          title.style.marginLeft = '4px'; // Try 4px, 6px, or 8px depending on your eye test
          title.style.borderBottom = 'none';
          title.style.color = '#333';
          title.style.fontSize = '20px';
          title.style.fontWeight = 'bold';
          title.style.textAlign = 'center';
          title.style.width = 'auto';
          title.style.flex = '0 0 auto';
        }

        const modeBadge = document.createElement('div');
        modeBadge.id = 'awos-mode-indicator';
        modeBadge.style.cssText = `
        padding: 4px 8px;
        font-size: 12px;
        border-radius: 4px;
        font-family: "Segoe UI", sans-serif;
        box-shadow: rgba(0, 0, 0, 0.1) 0px 1px 3px;
        transition: background 0.3s ease, color 0.3s ease;
      `;


        const topRow = document.createElement('div');
        topRow.id = 'awos-top-row';
        topRow.style.cssText = `
          display: flex;
          justify-content: space-between;
          align-items: center;
        `;

        const bottomRow = document.createElement('div');
        bottomRow.id = 'awos-bottom-row';
        bottomRow.style.cssText = `
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 10px;
        `;

        const topCenterZone = document.createElement('div');
        topCenterZone.id = 'awos-top-center-zone';
        topCenterZone.style.cssText = `
          display: flex;
          justify-content: center;
          align-items: center;
          width: 18%;
        `;
        if(DEBUG_MODE) {
          topCenterZone.style.border = '3px dashed red';
        };

        const topLeftZone = document.createElement('div');
        topLeftZone.id = 'awos-top-left-zone';
        topLeftZone.style.cssText = 'display: flex; gap: 10px; justify-content: flex-start; width: 33%;';
        if (DEBUG_MODE) {
          topLeftZone.style.border = '3px dashed red';
        };

        const topRightZone = document.createElement('div');
        topRightZone.id = 'awos-top-right-zone';
        topRightZone.style.cssText = 'display: flex; gap: 10px; justify-content: flex-end; width: 33%;';
        if (DEBUG_MODE) {
          topRightZone.style.border = '3px dashed red';
        };

        const bottomCenterZone = document.createElement('div');
        bottomCenterZone.id = 'awos-bottom-center-zone';
        bottomCenterZone.style.cssText = `
          display: flex;
          flex-direction: column;
          align-items: center;
          width: 33%;
        `;
        if (DEBUG_MODE){
          bottomCenterZone.style.border = '3px dashed blue';
        };

        const bottomLeftZone = document.createElement('div');
        bottomLeftZone.id = 'awos-bottom-left-zone';
        bottomLeftZone.style.cssText = 'display: flex; gap: 10px; justify-content: flex-start; width: 33%;';
        if (DEBUG_MODE){
          bottomLeftZone.style.border = '3px dashed blue';
        }

        const bottomRightZone = document.createElement('div');
        bottomRightZone.id = 'awos-bottom-right-zone';
        bottomRightZone.style.cssText = 'display: flex; gap: 10px; justify-content: flex-end; width: 33%;';
        if (DEBUG_MODE){
          bottomRightZone.style.border = '3px dashed blue';
        };

        topRow.appendChild(topLeftZone);
        topCenterZone.appendChild(title);
        topRow.appendChild(topCenterZone);
        topRow.appendChild(topRightZone);

        bottomRow.appendChild(bottomLeftZone);
        bottomRow.appendChild(bottomCenterZone);
        bottomRow.appendChild(bottomRightZone);

        topBar.appendChild(topRow);
        topBar.appendChild(bottomRow);

        document.body.prepend(topBar);
      }

      return topBar;
    }
  function getTopBarZone(side = 'bottomRight') {
      const zones = {

        topLeft: document.querySelector('#awos-top-left-zone'),
        topCenter: document.querySelector('#awos-top-center-zone'),
        topRight: document.querySelector('#awos-top-right-zone'),

        bottomLeft: document.querySelector('#awos-bottom-left-zone'),
        bottomCenter: document.querySelector('#awos-bottom-center-zone'),
        bottomRight: document.querySelector('#awos-bottom-right-zone')

      };
      return zones[side] || zones.right;
    }

  function injectAutoRefreshToggle(side = 'bottomLeft') {
      const STORAGE_KEY = 'awosAutoRefreshEnabled';
      let refreshEnabled = localStorage.getItem(STORAGE_KEY) !== 'false';
      let secondsLeft = REFRESH_INTERVAL;

      const zone = getTopBarZone(side);
      const toggleBtn = document.createElement('button');

      // Create a persistent text node for the label
      const labelNode = document.createTextNode('');
      toggleBtn.appendChild(labelNode);

      function updateButtonLabel() {
        labelNode.nodeValue = `⏳ Auto-Refresh: ${refreshEnabled ? 'ON' : 'OFF'} (${secondsLeft}s)`;

        const isDark = window.awosDarkMode;
        let bgColor, textColor;

        if (refreshEnabled) {
          bgColor = isDark ? '#444' : '#0078D4';       // Slate for dark, blue for light
          textColor = '#ffffff';
        } else {
          bgColor = isDark ? '#996600' : '#ffef08';    // Amber for dark, yellow for light
          textColor = isDark ? '#f0f0f0' : '#000000';
        }

        styleButton(toggleBtn, bgColor, { color: textColor });
      }


      toggleBtn.addEventListener('click', () => {
        const wasDisabled = !refreshEnabled;
        refreshEnabled = !refreshEnabled;
        localStorage.setItem(STORAGE_KEY, refreshEnabled);

        Logger.info(`[AWOS Core] Auto-refresh ${refreshEnabled ? 'enabled' : 'disabled'} by user`);
        updateButtonLabel();

        if (wasDisabled && refreshEnabled) {
          Logger.info(`[AWOS Core] Auto-refresh re-enabled — refreshing immediately`);
          forcePageReload();
        }
      });

      zone.appendChild(toggleBtn);
      Logger.info(`Auto-Refresh button successfully added to ${side}`);
      updateButtonLabel();

      setInterval(() => {
        if (refreshEnabled) {
          secondsLeft--;
          if (secondsLeft <= 0) {
            Logger.log(`[AWOS Core] Auto-refresh triggered at ${new Date().toLocaleTimeString()}`);
            forcePageReload();
          }
        } else {
          secondsLeft = REFRESH_INTERVAL;
        }
        updateButtonLabel();
      }, 1000);

      window.getAwosRefreshStatus = () => ({ enabled: refreshEnabled, secondsLeft });
      window.triggerAwosRefresh = () => forcePageReload();

      const bc = new BroadcastChannel('awos-refresh-sync');
      setInterval(() => {
        bc.postMessage({ enabled: refreshEnabled, secondsLeft });
      }, 1000);

      Logger.info(`Auto-refresh module initialized. Current state: ${refreshEnabled ? 'ON' : 'OFF'}`);
    }
  function injectReportViewerButton(side = 'bottomRight') {
      const zone = getTopBarZone(side);
      const viewerBtn = document.createElement('button');
      viewerBtn.textContent = '📊 Report Viewer';

      // Use unified styling
      styleButton(viewerBtn); // Automatically applies theme-aware background and white text

      viewerBtn.addEventListener('click', () => {
        if (typeof window.openReportViewer === 'function') {
          window.openReportViewer();
        } else {
          console.warn('[AWOS Core] openReportViewer() is not available.');
        }
      });

      zone.appendChild(viewerBtn);
      Logger.info(`Report Viewer button successfully added to ${side}`);
    }
  function injectDebugButton(side = 'topLeft') {
      const zone = getTopBarZone(side);
      const debugBtn = document.createElement('button');
      debugBtn.textContent = '🧪 Debug';

      styleButton(debugBtn, '#000', {
        color: '#00ff00',
        fontFamily: 'monospace'
      });

      debugBtn.addEventListener('click', () => {

        if (typeof window.openDebugPanel === 'function') {
          window.openDebugPanel();
        } else {
          console.warn('[AWOS Core] openDebugPanel() is not available.');
        }

      });

      zone.appendChild(debugBtn);
      Logger.info(`Debug button successfully added to ${side}`)
    }
  function injectResetFloaterButton(side = 'topLeft') {
      const zone = getTopBarZone(side);
      const resetBtn = document.createElement('button');
      resetBtn.textContent = '🧹 Reset Floater';

      styleButton(resetBtn, '#cc0000', {
        color: '#ffffff'
      });


      resetBtn.onclick = () => {
        const confirmReset = confirm('Are you sure you want to reset the floater?\nThis will clear its position, size, and ALL Snapshots.');
        if (!confirmReset) return;

        // Remove all known panel types
        const panelTypes = ['detail', 'report', 'debug','selector-panel'];
        panelTypes.forEach(type => {
          const { snapshotKey, urlKey, timestampKey, positionKey, sizeKey } = getPanelKeys(type);
          [snapshotKey, urlKey, timestampKey, positionKey, sizeKey].forEach(key => localStorage.removeItem(key));
        });

        // Clear legacy/global keys
        [
          'last-detail-url',
          'last-panel-snapshot',
          'last-timestamp',
          'debug-snapshot',
          'debug-active',
          'debug-style',
          'report-html',
          'report-active',
          'selector-active',
          'detail-panel-snapshot',
          'debug-panel-snapshot',
          'debug-panel-size',
          'report-panel-snapshot'


        ].forEach(key => localStorage.removeItem(key));

        // Reset spawn flags
        window.__awosReportViewerSpawned = false;

        // Reload the page to apply reset
        location.reload();
      };

      zone.appendChild(resetBtn);
      Logger.info(`Reset Floater button successfully added to ${side}`);
    }
  function injectNewStationsButton(side = 'bottomCenter') {
        const zone = getTopBarZone(side);
        const newStationsBtn = document.querySelector('#base_id');

        if (!newStationsBtn) {
            Logger.warn('[injectNewStationsButton] Could not find #base_id button to modify.');
            return;
        }

        newStationsBtn.textContent = 'New Stations';
        newStationsBtn.className = 'awos-btn';

        if(DEBUG_MODE) {
          newStationsBtn.style.border = '3px dashed red';
        };

        let attempts = 0;
        const maxAttempts = 20; // retry for ~5 seconds at 250ms intervals

        function bindWhenReady() {
            if (typeof window.renderAwosSelectorPanel === 'function') {
                newStationsBtn.onclick = () => {
                    Logger.info('[injectNewStationsButton] Opening AWOS Selector Panel...');
                    window.renderAwosSelectorPanel();
                };

            } else if (attempts < maxAttempts) {
                attempts++;
                setTimeout(bindWhenReady, 250);
            } else {
                Logger.warn('[injectNewStationsButton] renderAwosSelectorPanel not found after waiting.');
            }
        }

        bindWhenReady();
        zone.appendChild(newStationsBtn);
        Logger.info(`[injectNewStationsButton] New Stations button successfully added to ${side}`);
    }
  function injectNightModeButton(side = 'topRight') {
      const zone = getTopBarZone(side);
      const btn = document.createElement('button');
      btn.textContent = '🌙 Night Mode';

      // Initial styling based on current theme
      styleButton(btn, window.awosDarkMode ? '#444' : '#007bff', { color: '#ffffff' });

      btn.onclick = () => {
        const wasAutoOn = window.awosDarkAuto;
        const prevAutoState = window.awosDarkAutoState; // true for dark, false for light

        // Flip the mode
        const isDark = !window.awosDarkMode;
        window.awosDarkMode = isDark;

        // Update mode type
        if (wasAutoOn) {
          // If toggled to match auto state, clear override
          if (isDark === prevAutoState) {
            window.awosDarkModeType = 'auto';
            localStorage.setItem('awosDarkModeType', 'auto');
          } else {
            window.awosDarkModeType = isDark ? 'dark' : 'light';
            localStorage.setItem('awosDarkModeType', window.awosDarkModeType);
          }
        } else {
          window.awosDarkModeType = isDark ? 'dark' : 'light';
          localStorage.setItem('awosDarkModeType', window.awosDarkModeType);
        }

        // Decide source label
        let sourceLabel = 'via Manual Toggle';
        if (wasAutoOn && window.awosDarkModeType !== 'auto') {
          sourceLabel = 'via Manual Override — Auto Switch Overridden';
        } else if (wasAutoOn && window.awosDarkModeType === 'auto') {
          sourceLabel = 'via Manual Toggle — Override Cleared';
        }

        applyDarkModeStyles(isDark, 'Manual Toggle', sourceLabel);
        updateModeIndicator(document.querySelector('#awos-mode-indicator'));
        styleButton(btn, isDark ? '#444' : '#007bff', { color: '#ffffff' });
      };


      zone.appendChild(btn);
    }
  function injectNightModeAutoToggle(side = 'topRight') {
      const zone = getTopBarZone(side);
      Object.assign(zone.style, {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      });

      // Create wrapper for checkbox + icon
      const autoToggleWrapper = document.createElement('div');
      Object.assign(autoToggleWrapper.style, {
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        flex: '1'
      });

      // Create label and checkbox
      const label = document.createElement('label');
      Object.assign(label.style, {
        display: 'flex',
        alignItems: 'center',
        cursor: 'pointer'
      });
      label.title = 'Auto-switch based on sunset/sunrise';

      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.style.marginRight = '4px';

      const icon = document.createElement('span');
      icon.id = 'auto-toggle-icon';
      icon.style.fontSize = '16px';

      // Create mode badge
      const modeBadge = document.createElement('div');
      modeBadge.id = 'awos-mode-indicator';
      modeBadge.title = 'Current theme mode';
      modeBadge.style.cssText = `
        padding: 4px 8px;
        background: #eee;
        color: #333;
        font-size: 12px;
        border-radius: 4px;
        font-family: "Segoe UI", sans-serif;
        box-shadow: rgba(0, 0, 0, 0.1) 0px 1px 3px;
      `;

      // Initialize state from localStorage
      const isEnabled = localStorage.getItem('awosDarkAuto') === 'on';
      window.awosDarkAuto = isEnabled;
      checkbox.checked = isEnabled;

      function updateVisuals() {
        const coords = getStationCoordinatesFromPage();
        const nowUTC = getAwosUtcNowFromPage() || new Date();

        let iconSymbol = '⛔';
        let tooltipText = 'Disabled';

        if (window.awosDarkAuto && coords) {
          const { sunrise, sunset } = getSunTimes(new Date(), coords.lat, coords.lng, coords.elevation);
          const isNightAuto = (nowUTC >= sunset) || (nowUTC < sunrise);

          iconSymbol = isNightAuto ? '🌙' : '☀️';
          const nextTransition = isNightAuto ? sunrise : sunset;
          const timeStr = nextTransition.toUTCString().slice(17, 22);
          tooltipText = `${iconSymbol} until ${timeStr} UTC`;
        }

        icon.textContent = window.awosDarkAuto ? iconSymbol : '⛔';
        icon.title = tooltipText;
        updateModeIndicator(modeBadge);
      }
      window.updateVisuals = updateVisuals;

      // Handle checkbox toggle
      checkbox.onchange = () => {
        const enabled = checkbox.checked;
        window.awosDarkAuto = enabled;
        localStorage.setItem('awosDarkAuto', enabled ? 'on' : 'off');
        Logger.info(`[AWOS Core] Auto dark mode checkbox is now ${enabled ? 'ON' : 'OFF'}`);

        // Save current manual mode before switching to auto
        if (!enabled) {
          const lastManual = localStorage.getItem('awosLastManualMode') || 'default';
          window.awosDarkModeType = lastManual;
          localStorage.setItem('awosDarkModeType', lastManual);
        } else {
          localStorage.setItem('awosLastManualMode', window.awosDarkModeType);
          window.awosDarkModeType = 'auto';
          localStorage.setItem('awosDarkModeType', 'auto');
        }
        computeEffectiveMode();
        applyDarkModeStyles(window.awosDarkMode, 'Auto Toggle', `via ${window.awosModeSource}`);
        updateModeIndicator(document.querySelector('#mode-badge'));
        updateDebugContent();
        updateVisuals();
      };

      // Initial render
      updateVisuals();
      setInterval(updateVisuals, 60 * 1000);

      // Assemble DOM
      label.appendChild(checkbox);
      label.appendChild(icon);
      autoToggleWrapper.appendChild(label);
      zone.appendChild(autoToggleWrapper);
      zone.appendChild(modeBadge);
    }

  function findAllMouseoverElements() {
      const elements = Array.from(document.querySelectorAll('[onmouseover]'));
      Logger.info(`[findAllMouseoverElements] Found ${elements.length} elements with onmouseover`);
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
  function removeLegacyScripts() {
      const legacyScripts = Array.from(document.querySelectorAll('script')).filter(isLegacyScript);

      Logger.group(`🧨 Removed ${legacyScripts.length} legacy script(s)`, () => {
        legacyScripts.forEach((script, i) => {
          Logger.log(`Legacy Script ${i + 1}`, script.src || '[inline script]');
          script.remove();
        });
      });
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
  function waitForsetupTopBar(callback) {
      const interval = setInterval(() => {
        if (typeof setupTopBar === 'function') {
          clearInterval(interval);
          callback();
        }
      }, 50);
    }

  window.styleButton = styleButton;
  window.getUnifiedButtonColor = getUnifiedButtonColor;
  window.testAutoNightMode = testAutoNightMode;
  window.updateModeIndicator = updateModeIndicator;
  window.getSunTimes = getSunTimes;
  window.getEffectiveModeDetails = getEffectiveModeDetails;
  window.simulateTimeBlock = simulateTimeBlock;


  (function Core8x() {
      Logger.perf('start', 'Core8x');
      Logger.info('✅[Core8x] Loading AWOS modifications...');

      // Set cookie and UI suppression flag
      document.cookie = `metweb_settings=setting_norefresh&${REFRESH_INTERVAL}`;
      window.awosSuppressUI = window.self !== window.top;
      Logger.info(`[Core8x] UI Suppression: ${window.awosSuppressUI ? 'ON (iframe)' : 'OFF (main window)'}`);

      window.addEventListener('DOMContentLoaded', () => {
        Logger.info('🧭[Core8x] DOM fully loaded');

        // === Theme Initialization ===
        const validModes = ['default', 'light', 'dark', 'auto'];
        const storedMode = localStorage.getItem('awosDarkModeType');
        window.awosDarkModeType = validModes.includes(storedMode) ? storedMode : 'default';
        if (!storedMode) localStorage.setItem('awosDarkModeType', window.awosDarkModeType);

        const autoPref = localStorage.getItem('awosDarkAuto');
        window.awosDarkAuto = autoPref === 'on';

        Logger.modules.whenReady(['layout'], () => {
          computeEffectiveMode();
          updateModeIndicator(document.querySelector('#awos-mode-indicator'));
          Logger.info(
            `[Mode Compute: Core8x] appliedMode=${window.awosDarkModeType}, dark=${window.awosDarkMode}, source=${window.awosModeSource}, auto=${window.awosDarkAuto}, autoState=${window.awosDarkAutoState ?? 'n/a'}`
          );

          if (typeof applyDarkModeStyles === 'function') {
            applyDarkModeStyles(window.awosDarkMode, 'Initial Load', `via ${window.awosModeSource || 'Boot'}`);
            //applyAutoNightModeIfNeeded();
          } else {
            Logger.warn('⚠️ applyDarkModeStyles not available — skipping theme application');
          }
        });

        // === UI Setup ===
        setupTopBar();
        interceptMouseoverPopups();

        if (!window.awosSuppressUI) {
          injectAutoRefreshToggle('bottomLeft');
          injectNewStationsButton('bottomCenter');
          injectReportViewerButton('bottomRight');
          injectDebugButton('topLeft');
          injectResetFloaterButton('topLeft');
          injectNightModeAutoToggle('topRight');
          injectNightModeButton('topRight');

          removeLegacyScripts();
        }

        Logger.perf('stop', 'Core8x');
        Logger.modules.register('core');
      });
    })();

})();