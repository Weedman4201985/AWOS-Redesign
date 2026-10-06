// ==UserScript==
// @name         CFWOS AWOS Core 9.0
// @version      9.0
// @description  AWOS Core 9.0
// @author       Chris
// @match        https://met.forces.gc.ca/english/airops/AWOS/*
// @match        http://localhost/english/AWOS/*
// @grant        none
// @run-at       document-start
// ==/UserScript==

(function () {

    'use strict';

    if (window.Logger) return;
    window.Logger = {
        log(...args) {
            console.log('🟢%c', 'color: #00bfff; font-weight: bold;', ...args);
        },
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
                this.log(`⏱️ [${label}] start ${this._perfTimes[label].toFixed(3)} ms`);
            }
            else if (action.toLowerCase() === 'stop') {
                const now = performance.now();
                let duration = now;

                if (this._perfTimes[label]) {
                    duration = now - this._perfTimes[label];
                    delete this._perfTimes[label];
                }
                this._perfTimes[label] = now;
                this.log(`[${label}] finished ${now.toFixed(3)} ms - took ${duration.toFixed(3)} ms`);
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
                this.log(`📍[${label}] time mark set at ${now.toFixed(3)} ms`);

            } else {
                const duration = now - this._perfTimeMarks[label];
                this.log(`📍[${label}] +${duration.toFixed(3)} ms since last time mark`);

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
    Logger.modules.register('Logger');
    Logger.info('🚀[Logger] AWOS Logger Utility initialized');

})();

const REFRESH_INTERVAL = 60;

if (localStorage.getItem('refreshEnabled') === null) {
    localStorage.setItem('refreshEnabled', 'false');
    Logger.log('[AWOS Core] Initialized refreshEnabled to false');
}

(function earlyPatch() {
    const ENABLE_INJECT_FAVICON = true
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

    // 🍪 Patch 2: Override document.cookie
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

    // 📡 Patch 3: Log all XHR requests
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


    window.getPanelKeys = getPanelKeys;

    // window.testAutoNightMode = testAutoNightMode;
    // window.simulateTimeBlock = simulateTimeBlock;

    (function Core8x() {
        Logger.perf('start', 'Core9x');
        Logger.info('✅Core9x] Loading AWOS modifications...');

        // Set cookie
        document.cookie = `metweb_settings=setting_norefresh&${REFRESH_INTERVAL}`;

        // Set UI suppression flag
        window.isReportViewer = window.self !== window.top;
        Logger.info(`[Core9x] UI Suppression: ${ window.isReportViewer ? 'ON (iframe)' : 'OFF (main window)'}`);


        window.addEventListener('DOMContentLoaded', () => {

            Logger.info('🧭[Core9x] DOM Initialization start');

            // === UI Setup ===
            interceptMouseoverPopups();

            Logger.perf('stop', 'Core9x');
            Logger.modules.register('core');
            Logger.info('🧭[Core9x] DOM fully loaded');

        });
    })();

/*

    ─────────────────────────────────────────────
     🧭 AWOS Logger Performance Legend — Core 9.x
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
   OLD Logger

        log(message, style = 'color: #00bfff; font-weight: bold;', ...args) {
          console.log(`🟢%c${message}`, style, ...args);
        },

     // NEW Logger V1

    log(...args) {
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
    },
     // NEW Logger V3
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
}

    ───────────────────────────────────────────────
    // Quick reference for testAutoNightMode(hour, minute) and
    // simulateTimeBlock(startHourUTC,endHourUTC, stepMinutes = 5, delayMs = 1000)
    //-----------------------------------------------------------------------------------------

     testAutoNightMode(HourUTC,MinuteUTC)
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
    }*/

})();