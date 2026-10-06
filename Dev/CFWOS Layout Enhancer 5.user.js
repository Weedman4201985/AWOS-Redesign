// ==UserScript==
// @name         CFWOS Layout Enhancer 5
// @version      5(injectAllButtons update)
// @description  Restore and enhance AWOS report layout with full styling
// @author       Chris
// @match        https://met.forces.gc.ca/*
// @match        http://localhost/english/AWOS/*
// @grant        none
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
})();

const REFRESH_INTERVAL = 60;

if (localStorage.getItem('refreshEnabled') === null) {
    localStorage.setItem('refreshEnabled', 'false');
    Logger.log('[AWOS Core] Initialized refreshEnabled to false');
}

(function () {
    'use strict';

    const DEBUG_MODE = false;

    let layoutApplied = false;

    function findAwosPanel() {
        return document.querySelector('#awos, #awos-panel, .awos-report, .report-panel, main');
    }

    function forcePageReload() {
        window.onbeforeunload = null;
        window.onunload = null;
        window.location.reload();
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

    function getAwosUtcNowFromPage() {
        const m = document.body.textContent.match(/(\d{2}):(\d{2})(?::(\d{2}))?\s*UTC/);
        if (!m) return null;
        const now = new Date();
        const hh = +m[1], mm = +m[2], ss = m[3] ? +m[3] : 0;
        return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), hh, mm, ss));
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
                    isDark = false;
                    source = 'auto (no coords)';
                }
                break;

            case 'default':
            default:
                isDark = false;
                source = 'default';
        }

        window.awosDarkMode = isDark;
        window.awosModeSource = source;

        Logger.info(
            `[Mode Compute: Function] type=${modeType}, dark=${isDark}, source=${source}, auto=${window.awosDarkAuto}, autoState=${window.awosDarkAutoState ?? 'n/a'}${coords ? `, coords=${coords.lat.toFixed(4)},${coords.lng.toFixed(4)}` : ''}${overrideNowUTC ? `, testTime=${overrideNowUTC.toISOString()}` : ''}`
        );

        return isDark;
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

        badgeElement.style.background = isDark ? '#222' : '#eee';
        badgeElement.style.color = isDark ? '#eee' : '#333';
        badgeElement.style.border = isDark ? '1px solid #444' : 'none';
        badgeElement.style.transition = 'background 0.3s ease, color 0.3s ease';

        badgeElement.textContent = `Mode: ${mode} ${emoji}`;

        //Logger.info(`[Mode Badge] Updated: ${mode} ${emoji}`);
    }

    function updateNightModeButton() {
        const btn = document.querySelector('#awos-night-mode-button');
        if (!btn) return;

        const isDark = window.awosDarkMode === true;

        // Button describes what clicking it WILL DO
        btn.textContent = window.awosDarkMode
            ? '☀️ Light Mode'
            : '🌙 Night Mode';

        styleButton(
            btn,
            isDark ? '#444' : '#007bff',
            { color: '#ffffff' }

        );
    }

    function applyEnhancements(awosPanel) {
        const isDark = window.awosDarkMode;

        Object.assign(awosPanel.style, {
            backgroundColor: isDark ? '#1e1e1e' : '#f5f5dc',
            color: isDark ? '#e0e0e0' : '#222',
            padding: '20px',
            borderRadius: '10px',
            boxShadow: isDark ? '0 2px 12px rgba(0,0,0,0.5)' : '0 2px 12px rgba(0,0,0,0.15)',
            fontFamily: '"Segoe UI", sans-serif',
            lineHeight: '1.4',
            fontSize: '13px',
        });

        awosPanel.querySelectorAll('h1, h2, h3').forEach(header => {
            header.style.color = isDark ? '#ccc' : '#333';
            header.style.borderBottom = isDark ? '1px solid #555' : '1px solid #ccc';
            header.style.paddingBottom = '6px';
            header.style.marginTop = '20px';
        });

        awosPanel.querySelectorAll('table').forEach(table => {
            Object.assign(table.style, {
                backgroundColor: isDark ? '#2a2a2a' : '#fff',
                color: isDark ? '#ddd' : '#000',
                borderCollapse: 'collapse',
                width: '100%',
                marginTop: '20px',
                border: isDark ? '1px solid #444' : '1px solid #ccc',
            });

            table.querySelectorAll('th, td').forEach(cell => {
                Object.assign(cell.style, {
                    backgroundColor: isDark ? '#2c2c2c' : '#fdf6e3',
                    color: isDark ? '#eee' : '#333',
                    border: isDark ? '1px solid #555' : '1px solid #ccc',
                    padding: '8px',
                    textAlign: 'center',
                });
            });
        });
    }

    function applyDarkModeStyles(forcedMode = null, context = '', forceSource = null) {
        // Decide the mode to apply
        const isDark = forcedMode !== null ? forcedMode : window.awosDarkMode;
        window.awosDarkMode = isDark; // keep global in sync

        const awosPanel = findAwosPanel();
        const topBar = document.querySelector('#awos-top-bar');
        const buttons = topBar?.querySelectorAll('button');

        // Body styling
        Object.assign(document.body.style, {
            backgroundColor: isDark ? '#121212' : '',
            color: isDark ? '#e0e0e0' : '',
        });

        // Top bar styling
        if (topBar) {
            Object.assign(topBar.style, {
                backgroundColor: isDark ? '#1f1f1f' : '#ffffff',
                borderBottom: isDark ? '1px solid #333' : '1px solid #ccc',
                boxShadow: isDark ? '' : 'rgba(0, 0, 0, 0.05) 0px 2px 4px',
                position: 'sticky',
                top: '0',
                zIndex: '1000'
            });
        }

        // Button styling (unchanged)
        buttons?.forEach(btn => {
            const label = btn.textContent?.trim();
            // Auto-refresh button (special case: paused)
            if (label?.includes('Auto-Refresh')) {
                const refreshStatus = window.getAwosRefreshStatus?.();
                if (refreshStatus) {
                    const bgColor = refreshStatus.enabled
                        ? (isDark ? '#444' : '#0078D4')
                        : (isDark ? '#996600' : '#ffef08');
                    const textColor = refreshStatus.enabled
                        ? '#ffffff'
                        : (isDark ? '#f0f0f0' : '#000000');
                    styleButton(btn, bgColor, { color: textColor });
                }
                return;
            }

            // Debug button — preserve layout, change colors
            if (label === '🧪 Debug') {
                const bgColor = isDark ? '#000000' : '#000000'; // Keep black background
                const textColor = isDark ? '#00ff00' : '#00ff00'; // Always green
                styleButton(btn, bgColor, {
                    color: textColor,
                    fontFamily: 'monospace'
                });
                return;
            }

            // Reset Floater — preserve layout, change background
            if (label === '🧹 Reset Floater') {
                const bgColor = isDark ? '#8B0000' : '#cc0000';
                styleButton(btn, bgColor, {
                    color: '#ffffff'
                });
                return;
            }

            // Report Viewer — standard theme-aware styling
            if (label === '📊 Report Viewer') {
                styleButton(btn); // Uses theme-aware background and white text
                return;
            }

            // New Stations button
            const newStationsBtn = document.querySelector('#base_id');
            if (newStationsBtn) {
                styleButton(newStationsBtn, getUnifiedButtonColor(), {
                    marginLeft: '24px',
                    margin: '0 auto',
                    display: 'block',
                    textAlign: 'center',
                    boxSizing: 'border-box',
                    flex: 'none'
                });
                if(DEBUG_MODE) {
                    newStationsBtn.style.border = '3px dashed red';
                };
            }

            // Default styling for all other buttons
            styleButton(btn); // Uses theme-aware background and white text
        });

        // AWOS panel styling
        if (awosPanel) {
            applyEnhancements(awosPanel);
        } else {
            Logger.warn('⚠️ AWOS panel not found — dark mode styling skipped');
        }

        // Determine source
        let source;
        if (forceSource) {
            source = forceSource;
        } else {
            switch (window.awosDarkModeType) {
                case 'light':
                case 'dark':
                    source = 'via Manual Toggle';
                    break;
                case 'auto':
                    source = 'via Auto Switch';
                    break;
                case 'default':
                default:
                    source = 'via Default Mode';
            }
        }

        const prefix = context ? `[${context}] ` : '';

        Logger.info(
            isDark
                ? `${prefix}🌙 Dark mode is ON (${source}) — applying dark styles`
                : `${prefix}☀️ Dark mode is OFF (${source})`
        );
    }

    function setupTopBar() {

        if (window.awosSuppressUI) {
            Logger.log('[AWOS Core] Top bar injection suppressed.');
            return null;
        }

        let topBar = document.querySelector('#awos-top-bar');
        const title = document.querySelector('main h1');
        const modeBadge = document.createElement('div');
        const topRow = document.createElement('div');
        const topLeftZone = document.createElement('div');
        const topCenterZone = document.createElement('div');
        const topRightZone = document.createElement('div');
        const bottomRow = document.createElement('div');
        const bottomCenterZone = document.createElement('div');
        const bottomLeftZone = document.createElement('div');
        const bottomRightZone = document.createElement('div');


        if (!topBar) {

            topBar = document.createElement('div');

            topBar.id = 'awos-top-bar';
            modeBadge.id = 'awos-mode-indicator';
            topRow.id = 'awos-top-row';
            topCenterZone.id = 'awos-top-center-zone';
            topLeftZone.id = 'awos-top-left-zone';
            topRightZone.id = 'awos-top-right-zone';
            bottomRow.id = 'awos-bottom-row';
            bottomCenterZone.id = 'awos-bottom-center-zone';
            bottomLeftZone.id = 'awos-bottom-left-zone';
            bottomRightZone.id = 'awos-bottom-right-zone';

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

            if (title) {

                title.style.margin = '0';
                title.style.marginLeft = '7px';
                title.style.borderBottom = 'none';
                title.style.color = '#333';
                title.style.fontSize = '22px';
                title.style.fontWeight = 'bold';
                title.style.textAlign = 'center';
                title.style.width = 'auto';
                title.style.flex = '0 0 auto';

            }

            modeBadge.style.cssText = `

                padding: 4px 8px;
                font-size: 12px;
                border-radius: 4px;
                font-family: "Segoe UI", sans-serif;
                box-shadow: rgba(0, 0, 0, 0.1) 0px 1px 3px;
                transition: background 0.3s ease, color 0.3s ease;

	          `;

            topRow.style.cssText = `

                  display: flex;
                  justify-content: space-between;
                  align-items: center;
                  width: 100%;

            `;


            topCenterZone.style.cssText = `

                  display: flex;
                  justify-content: center;
                  align-items: center;
                  width: 20%;

            `;


            bottomRow.style.cssText = `

                  display: flex;
                  justify-content: space-between;
                  align-items: center;
                  gap: 10px;

            `;

            bottomCenterZone.style.cssText = `

                  display: flex;
                  flex-direction: column;
                  align-items: center;
                  width: 20%;

            `;

            topLeftZone.style.cssText = 'display: flex; gap: 10px; justify-content: flex-start; width: 30%; padding: 8px;';
            topRightZone.style.cssText = 'display: flex; gap: 10px; justify-content: flex-end; width: 30%; padding: 8px;';
            bottomLeftZone.style.cssText = 'display: flex; gap: 10px; justify-content: flex-start; width: 30%; padding: 8px;';
            bottomRightZone.style.cssText = 'display: flex; gap: 10px; justify-content: flex-end; width: 30%; padding: 8px;';

            if(DEBUG_MODE) {

                topCenterZone.style.border = '3px dashed red';
                topLeftZone.style.border = '3px dashed red';
                topRightZone.style.border = '3px dashed red';
                bottomCenterZone.style.border = '3px dashed blue';
                bottomLeftZone.style.border = '3px dashed blue';
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

    function injectAllButtons() {

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

                Logger.info(`[Layout Enhancer] Auto-refresh ${refreshEnabled ? 'enabled' : 'disabled'} by user`);
                updateButtonLabel();

                if (wasDisabled && refreshEnabled) {
                    Logger.info(`[Layout Enhancer] Auto-refresh re-enabled — refreshing immediately`);
                    forcePageReload();
                }
            });

            zone.appendChild(toggleBtn);
            Logger.info(`[Layout Enhancer] Auto-Refresh button successfully added to ${side}`);
            updateButtonLabel();

            setInterval(() => {
                if (refreshEnabled) {
                    secondsLeft--;
                    if (secondsLeft <= 0) {
                        Logger.log(`[Layout Enhancer] Auto-refresh triggered at ${new Date().toLocaleTimeString()}`);
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

            Logger.info(`[Layout Enhancer] Auto-refresh module initialized.`);
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
                    window.awosDarkAutoState = isNightAuto;

                    if (window.awosDarkModeType === 'auto') {
                        applyDarkModeStyles(window.awosDarkMode);
                    }

                    iconSymbol = isNightAuto ? '🌙' : '☀️';
                    const nextTransition = isNightAuto ? sunrise : sunset;
                    const timeStr = nextTransition.toUTCString().slice(17, 22);
                    tooltipText = `${iconSymbol} until ${timeStr} UTC`;
                }

                icon.textContent = window.awosDarkAuto ? iconSymbol : '⛔';
                icon.title = tooltipText;
                updateModeIndicator(modeBadge);
                updateNightModeButton();

            }
            window.updateVisuals = updateVisuals;

            // Handle checkbox toggle
            checkbox.onchange = () => {
                const enabled = checkbox.checked;
                window.awosDarkAuto = enabled;
                localStorage.setItem('awosDarkAuto', enabled ? 'on' : 'off');
                Logger.info(`[injectNightModeAutoToggle] Auto dark mode checkbox is now ${enabled ? 'ON' : 'OFF'}`);

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
                updateModeIndicator(
                    document.querySelector('#awos-mode-indicator')
                );
                //updateDebugContent();
                updateVisuals();
                updateNightModeButton();
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
            Logger.info(`[Layout Enhancer] Auto Day/Night mode checkbox successfully added to ${side}`);

        }

        function injectNightModeButton(side = 'topRight') {

            const zone = getTopBarZone(side);
            const btn = document.createElement('button');
            btn.id = 'awos-night-mode-button';

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
                updateNightModeButton();
            };

            zone.appendChild(btn);
            Logger.info(`[Layout Enhancer] Day/Night mode button successfully added to ${side}`);
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
                    console.warn('[Layout Enhancer] openReportViewer() is not available.');
                }
            });

            zone.appendChild(viewerBtn);
            Logger.info(`[Layout Enhancer] Report Viewer button successfully added to ${side}`);
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
            Logger.info(`[Layout Enhancer] Debug button successfully added to ${side}`)
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
            Logger.info(`[Layout Enhancer] Reset Floater button successfully added to ${side}`);
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
            newStationsBtn.style.position = 'relative';
            newStationsBtn.style.left = '4px';

            styleButton(newStationsBtn);

            if(DEBUG_MODE) {
                newStationsBtn.style.border = '3px dashed red';
            };

            newStationsBtn.onclick = () => {
                Logger.info('[injectNewStationsButton] Opening AWOS Selector Panel...');
                window.renderAwosSelectorPanel();
            };

            zone.appendChild(newStationsBtn);
            Logger.info(`[Layout Enhancer] New Stations button successfully added to ${side}`);

        }

        injectAutoRefreshToggle('bottomLeft');
        injectNightModeAutoToggle('topRight');
        injectNightModeButton('topRight');
        injectReportViewerButton('bottomRight');
        injectDebugButton('topLeft');
        injectResetFloaterButton('topLeft');
        injectNewStationsButton('bottomCenter');

        Logger.info("[injectAllButtons] All Buttons injected successfully");

    }

    window.getStationCoordinatesFromPage = getStationCoordinatesFromPage;
    window.getSunTimes = getSunTimes;
    window.getAwosUtcNowFromPage = getAwosUtcNowFromPage;
    window.styleButton = styleButton

    Logger.modules.whenReady(['core'], () => {

        Logger.modules.whenReady(['cleanup'], () => {

            if (layoutApplied) return; // <-- prevent double-run
            let attempts = 0;
            const maxAttempts = 20;
            const interval = 100;
            const tryEnhance = () => {
                if (layoutApplied)
                    return; // <-- prevent re-entry mid-loop

                const awosPanel = findAwosPanel();

                if (awosPanel) {

                    Logger.info('🎨 Running Layout Enhancer after Cleanup');

                    // === Theme Initialization ===
                    const validModes = ['default', 'light', 'dark', 'auto'];
                    const storedMode = localStorage.getItem('awosDarkModeType');

                    window.awosDarkModeType =
                        validModes.includes(storedMode)
                            ? storedMode
                            : 'default';

                    if (!storedMode) {
                        localStorage.setItem(
                            'awosDarkModeType',
                            window.awosDarkModeType
                        );
                    }

                    const autoPref = localStorage.getItem('awosDarkAuto');
                    window.awosDarkAuto = autoPref === 'on';

                    computeEffectiveMode();

                    if (!window.isReportViewer) {
                        setupTopBar();
                        injectAllButtons();
                        applyDarkModeStyles(window.awosDarkMode,
                            'Initial Dark Mode check',
                            `via ${window.awosModeSource || 'Boot'}`);
                        updateNightModeButton();
                    }

                    updateNightModeButton();

                    // If an override is active, force the source to Manual Toggle
                    let initialSource = null;
                    switch (window.awosDarkModeType) {
                        case 'light':
                        case 'dark':
                            initialSource = 'via Manual Toggle';
                            break;
                        case 'auto':
                            initialSource = 'via Auto Switch';
                            break;
                        case 'default':
                        default:
                            initialSource = 'via Default Mode';
                    }

                    applyEnhancements(awosPanel);

                    layoutApplied = true; // <-- mark as done
                    Logger.modules.register('layout');
                    return;
                }
                attempts++;
                if (attempts <= maxAttempts) {
                    setTimeout(tryEnhance, interval);
                } else {
                    Logger.warn('⚠️ AWOS container not found after cleanup (tried 2s). Skipping layout.');
                }
            };
            tryEnhance();
        });

    });

})();