// ==UserScript==
// @name         CFWOS Floating Panel 6.2
// @namespace    chris.awos
// @version      6.2(unified panel state)
// @description  Floating AWOS detail viewer with drag, resize, and persistent state
// @match        https://met.forces.gc.ca/english/airops/AWOS/*
// @match        http://localhost/english/AWOS/*
// @grant        none
// ==/UserScript==

(function () {
    'use strict';

    const id = 'CYTR'
    const atime = getLatestHourlyTimestamp()

    const AWOS_BASE_URL = 'https://met.forces.gc.ca/english/airops/AWOS/';
    const timestamp = new Date().toISOString();
    const PanelStateManager = {
        normalize(panelType) {
            return String(panelType).replace(/-panel$/, '');
        },

        key(panelType) {
            return `awos-panel-${this.normalize(panelType)}`;
        },

        load(panelType) {
            const raw = localStorage.getItem(this.key(panelType));
            if (!raw) return null;

            try {
                return JSON.parse(raw);
            } catch (err) {
                Logger.warn(`[PanelState] Failed to load ${panelType}:`, err);
                return null;
            }
        },

        update(panelType, changes = {}) {
            const current = this.load(panelType) || {};
            const state = {
                ...current,
                ...changes
            };

            if (changes.geometry) {
                state.geometry = {
                    ...(current.geometry || {}),
                    ...changes.geometry
                };
            }

            localStorage.setItem(
                this.key(panelType),
                JSON.stringify(state)
            );

            return state;
        },

        saveGeometry(panelType, panel) {
            if (!panel) return;

            const rect = panel.getBoundingClientRect();

            this.update(panelType, {
                geometry: {
                    width: rect.width,
                    height: rect.height,
                    top: rect.top,
                    left: rect.left
                }
            });
        },

        restoreGeometry(panelType, panel) {
            if (!panel) return;

            const geometry = this.load(panelType)?.geometry;
            if (!geometry) return;

            if (geometry.width != null) panel.style.width = `${geometry.width}px`;
            if (geometry.height != null) panel.style.height = `${geometry.height}px`;
            if (geometry.top != null) panel.style.top = `${geometry.top}px`;
            if (geometry.left != null) panel.style.left = `${geometry.left}px`;
        },

        setActive(panelType, active) {
            this.update(panelType, { active });
        },

        clear(panelType) {
            localStorage.removeItem(this.key(panelType));
        }
    };

    let isDragging = false;
    let offsetX = 0;
    let offsetY = 0;

    function getCurrentUtcTimestamp() {
        const now = new Date();
        const pad = (n) => n.toString().padStart(2, '0');
        return `${now.getUTCFullYear()}${pad(now.getUTCMonth() + 1)}${pad(now.getUTCDate())}${pad(now.getUTCHours())}${pad(now.getUTCMinutes())}`;
    }
    function getLatestHourlyTimestamp() {
        const now = new Date();
        now.setUTCMinutes(0, 0, 0); // snap to top of the hour
        const pad = (n) => n.toString().padStart(2, '0');
        return `${now.getUTCFullYear()}${pad(now.getUTCMonth() + 1)}${pad(now.getUTCDate())}${pad(now.getUTCHours())}00`;
    }
    function shiftTime(atime, hours) {
        if (!atime || typeof atime !== 'string' || atime.length !== 12) {
            console.warn('[AWOS Core] Invalid atime passed to shiftTime:', atime);
            return null;
        }

        const year = atime.slice(0, 4);
        const month = atime.slice(4, 6);
        const day = atime.slice(6, 8);
        const hour = atime.slice(8, 10);
        const minute = atime.slice(10, 12);

        const date = new Date(`${year}-${month}-${day}T${hour}:${minute}:00Z`);
        date.setHours(date.getHours() + hours);

        const pad = (n) => n.toString().padStart(2, '0');
        return `${date.getUTCFullYear()}${pad(date.getUTCMonth() + 1)}${pad(date.getUTCDate())}${pad(date.getUTCHours())}${pad(date.getUTCMinutes())}`;
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

    function extractUpdatedTimestamp(rawHTML) {
        const parser = new DOMParser();
        const doc = parser.parseFromString(rawHTML, 'text/html');
        const abbr = doc.querySelector('abbr.timepopup');
        return abbr ? `Updated: ${abbr.textContent.trim()}` : '';
    }
    function createPanel(titleText = '', panelId = 'floating-panel', contentId = 'floating-panel-content') {
        if (document.getElementById(panelId)) {
            console.warn(`[Floater] Panel "${panelId}" already exists. Skipping creation.`);
            return null;
        }

        const panel = document.createElement('div');
        panel.id = panelId;
        panel.style.cssText = `
        position: fixed;
        background: #000;
        color: #0f0;
        border: 1px solid #0f0;
        font-family: monospace;
        font-size: 13px;
        box-shadow: 0 0 12px rgba(0,255,0,0.3);
        resize: none;
        z-index: 9999;
        display: flex;
        flex-direction: column;
        width: 409px;
        height: 859px;
        overflow: hidden;
      `;

        const titleBar = document.createElement('div');
        titleBar.id = `${panelId}-title`;
        titleBar.style.cssText = `
        background: #0f0;
        color: #000;
        padding: 8px 12px;
        font-weight: bold;
        cursor: move;
        display: flex;
        justify-content: space-between;
        align-items: center;
      `;

        const titleTextEl = document.createElement('span');
        titleTextEl.id = `${panelId}-title-text`;
        titleTextEl.textContent = titleText;
        titleBar.appendChild(titleTextEl);

        const closeBtn = document.createElement('button');
        closeBtn.textContent = '×';
        closeBtn.style.cssText = `
        font-size: 20px;
        border: none;
        background: transparent;
        color: #000;
        cursor: pointer;
        padding: 0 6px;
      `;

        closeBtn.onclick = () => {

            const panelType = PanelStateManager.normalize(panelId);

            PanelStateManager.saveGeometry(panelType, panel);
            PanelStateManager.setActive(panelType, false);


            if (panel._dragMouseUp) {
                document.removeEventListener('mouseup', panel._dragMouseUp);
                panel._dragMouseUp = null;
            }


            panel.remove();


            if (panelType === 'report') {
                window.__awosReportViewerSpawned = false;
            }

            Logger.info(`[Floater] ${panelId} closed and saved state cleared.`);
        };

        titleBar.appendChild(closeBtn);

        const content = document.createElement('div');
        content.id = contentId;
        content.style.cssText = `
        flex: 1;
        padding: 10px;
        overflow-y: auto;
        overscroll-behavior: contain;
        background: #000;
        color: #0f0;
      `;


        content.addEventListener('wheel', (e) => {
            e.stopPropagation();

            const canScroll = content.scrollHeight > content.clientHeight;

            if (!canScroll) {
                e.preventDefault();
            }
        }, { passive: false });

        panel.appendChild(titleBar);
        panel.appendChild(content);
        document.body.appendChild(panel);

        PanelStateManager.restoreGeometry(panelId, panel);
        clampPanelPosition(panel);
        enablePanelDragging(titleBar, panel);
        addPanelResizers(panel);

        return panel;
    }
    function addPanelResizers(panel) {
        // Edge resizers
        ['top', 'right', 'bottom', 'left'].forEach(edge => {
            const resizer = document.createElement('div');
            Object.assign(resizer.style, {
                position: 'absolute',
                zIndex: '10000',
                background: 'transparent',
                pointerEvents: 'auto',
                [edge]: '0',
                cursor: {
                    top: 'n-resize',
                    bottom: 's-resize',
                    left: 'w-resize',
                    right: 'e-resize'
                }[edge]

            });
            if (edge === 'top' || edge === 'bottom') {
                resizer.style.left = '0';
                resizer.style.width = '80%';
                resizer.style.height = '6px';
            } else {
                resizer.style.top = '0';
                resizer.style.height = '80%';
                resizer.style.width = '6px';
            }
            panel.appendChild(resizer);

            resizer.addEventListener('mousedown', (e) => {
                e.preventDefault();
                const iframe = panel.querySelector('iframe');
                if (iframe) iframe.style.pointerEvents = 'none';
                const startX = e.clientX;
                const startY = e.clientY;
                const startWidth = panel.offsetWidth;
                const startHeight = panel.offsetHeight;
                const startTop = panel.offsetTop;
                const startLeft = panel.offsetLeft;

                function onMouseMove(ev) {
                    if (edge === 'right') {
                        panel.style.width = `${startWidth + (ev.clientX - startX)}px`;
                    } else if (edge === 'bottom') {
                        panel.style.height = `${startHeight + (ev.clientY - startY)}px`;
                    } else if (edge === 'left') {
                        const newWidth = startWidth - (ev.clientX - startX);
                        const newLeft = startLeft + (ev.clientX - startX);
                        panel.style.width = `${newWidth}px`;
                        panel.style.left = `${newLeft}px`;
                    } else if (edge === 'top') {
                        const newHeight = startHeight - (ev.clientY - startY);
                        const newTop = startTop + (ev.clientY - startY);
                        panel.style.height = `${newHeight}px`;
                        panel.style.top = `${newTop}px`;
                    }
                }

                const onMouseUp = () => {
                    document.removeEventListener('mousemove', onMouseMove);
                    document.removeEventListener('mouseup', onMouseUp);

                    const iframe = panel.querySelector('iframe');
                    if (iframe) iframe.style.pointerEvents = '';

                    if (!panel || panel.offsetWidth === 0 || panel.offsetHeight === 0) return;
                    PanelStateManager.saveGeometry(panel.id, panel);
                };

                document.addEventListener('mousemove', onMouseMove);
                panel._activeMouseUp = onMouseUp; // 🧠 store it on the panel
                document.addEventListener('mouseup', onMouseUp);



            });
        });

        const cornerResizers = [
            { name: 'top-left', cursor: 'nw-resize', top: '0', left: '0' },
            { name: 'top-right', cursor: 'ne-resize', top: '0', right: '0' },
            { name: 'bottom-left', cursor: 'sw-resize', bottom: '0', left: '0' },
            { name: 'bottom-right', cursor: 'se-resize', bottom: '0', right: '0' } // already exists, but we’ll unify logic
        ];
        cornerResizers.forEach(corner => {
            const resizer = document.createElement('div');
            Object.assign(resizer.style, {
                position: 'absolute',
                width: '12px',
                height: '12px',
                cursor: corner.cursor,
                zIndex: '10001',
                background: 'transparent',
                ...corner
            });
            panel.appendChild(resizer);

            resizer.addEventListener('mousedown', (e) => {
                e.preventDefault();
                const iframe = panel.querySelector('iframe');
                if (iframe) iframe.style.pointerEvents = 'none';
                const startX = e.clientX;
                const startY = e.clientY;
                const startWidth = panel.offsetWidth;
                const startHeight = panel.offsetHeight;
                const startTop = panel.offsetTop;
                const startLeft = panel.offsetLeft;

                function onMouseMove(ev) {
                    const dx = ev.clientX - startX;
                    const dy = ev.clientY - startY;

                    if (corner.name.includes('right')) {
                        panel.style.width = `${startWidth + dx}px`;
                    }
                    if (corner.name.includes('left')) {
                        const newWidth = startWidth - dx;
                        if (newWidth > 300) {
                            panel.style.width = `${newWidth}px`;
                            panel.style.left = `${startLeft + dx}px`;
                        }
                    }
                    if (corner.name.includes('bottom')) {
                        panel.style.height = `${startHeight + dy}px`;
                    }
                    if (corner.name.includes('top')) {
                        const newHeight = startHeight - dy;
                        if (newHeight > 150) {
                            panel.style.height = `${newHeight}px`;
                            panel.style.top = `${startTop + dy}px`;
                        }
                    }
                }

                function onMouseUp() {
                    document.removeEventListener('mousemove', onMouseMove);
                    document.removeEventListener('mouseup', onMouseUp);

                    const iframe = panel.querySelector('iframe');
                    if (iframe) iframe.style.pointerEvents = '';

                    PanelStateManager.saveGeometry(panel.id, panel);
                }

                document.addEventListener('mousemove', onMouseMove);
                document.addEventListener('mouseup', onMouseUp);
            });
        });

    }
    function enablePanelDragging(titleBar, panel) {
        let isDragging = false, offsetX = 0, offsetY = 0;

        titleBar.addEventListener('mousedown', (e) => {
            isDragging = true;
            const rect = panel.getBoundingClientRect();
            offsetX = e.clientX - rect.left;
            offsetY = e.clientY - rect.top;
            document.body.style.userSelect = 'none';
        });

        document.addEventListener('mousemove', (e) => {
            if (!isDragging) return;
            panel.style.left = `${e.clientX - offsetX}px`;
            panel.style.top = `${e.clientY - offsetY}px`;
        });

        const dragMouseUp = () => {
            isDragging = false;
            document.body.style.userSelect = '';
            if (document.body.contains(panel)) {
                PanelStateManager.saveGeometry(panel.id, panel);
            }
        };

        panel._dragMouseUp = dragMouseUp;
        document.addEventListener('mouseup', dragMouseUp);
    }
    function styleButton(btn, bgColor, overrides = {}) {
        Object.assign(btn.style, {
            padding: '6px 12px',
            fontSize: '13px',
            color: '#fff',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            fontFamily: '"Segoe UI", sans-serif',
            boxShadow: 'rgba(0, 0, 0, 0.15) 0px 1px 4px',
            whiteSpace: 'nowrap',
            flex: '0 0 auto',
            background: bgColor,
            ...overrides // apply custom styles
        });
    }

    function clampPanelPosition(panel) {
        const rect = panel.getBoundingClientRect();
        const maxLeft = window.innerWidth - rect.width;
        const maxTop = window.innerHeight - rect.height;

        if (rect.left < 0) panel.style.left = '0px';
        if (rect.top < 0) panel.style.top = '0px';
        if (rect.left > maxLeft) panel.style.left = `${maxLeft}px`;
        if (rect.top > maxTop) panel.style.top = `${maxTop}px`;
    }

    function openDebugPanel() {

        const panelId = 'debug-panel';
        const contentId = 'debug-content';

        // If panel already exists, just update content
        const existingPanel = document.getElementById(panelId);

        if (existingPanel) {
            PanelStateManager.update('debug', { active: true });
            const panel = document.getElementById('debug-panel');
            const content = document.getElementById('debug-content');
            const titleBar = document.getElementById('debug-panel-title');

            if (panel && content) {

                panel.style.background = '#000';
                panel.style.color = '#0f0';
                panel.style.border = '1px solid #0f0';
                panel.style.fontFamily = 'monospace';
                panel.style.fontSize = '13px';
                panel.style.boxShadow = '0 0 12px rgba(0,255,0,0.3)';

                content.style.background = '#000';
                content.style.color = '#0f0';
                content.style.padding = '10px';
                content.style.overflowY = 'auto';

                if (titleBar) {
                    titleBar.style.background = '#0f0';
                    titleBar.style.color = '#000';
                }

            }

            updateDebugContent();

            return;
        }

        createPanel('Debug Panel','debug-panel','debug-content');
        PanelStateManager.update('debug', { active: true });
        const panel = document.getElementById('debug-panel');
        const content = document.getElementById('debug-content');
        const titleBar = document.getElementById('debug-panel-title');



        if (panel && content) {
            panel.style.background = '#000';
            panel.style.color = '#0f0';
            panel.style.border = '1px solid #0f0';
            panel.style.fontFamily = 'monospace';
            panel.style.fontSize = '13px';
            panel.style.boxShadow = '0 0 12px rgba(0,255,0,0.3)';

            content.style.background = '#000';
            content.style.color = '#0f0';
            content.style.padding = '10px';
            content.style.overflowY = 'auto';

            if (titleBar) {
                titleBar.style.background = '#0f0';
                titleBar.style.color = '#000';
            }

        }
        updateDebugContent();
    }
    function updateDebugContent() {
        const content = document.getElementById('debug-content');
        if (!content) return;

        const status = window.getAwosRefreshStatus?.() || {};
        const details = getEffectiveModeDetails();

        const {
            isDark,
            source,
            nowUTC,
            sunrise,
            sunset,
            nextChangeUTC,
            nextModeLabel,
            coords,
            autoState
        } = details;

        const timeUntilChange = nextChangeUTC
            ? `${Math.floor((nextChangeUTC - nowUTC) / 3600000)}h ${Math.floor(((nextChangeUTC - nowUTC) / 60000) % 60)}m`
            : 'n/a';

        content.innerHTML = `
        <strong>AWOS Debug Panel</strong><br><br>
        Core Version: 6.0<br>
        Refresh: ${status.enabled ? 'ON' : 'OFF'} (${status.secondsLeft}s)<br>
        Floater: ${document.querySelector('#floater-btn') ? 'Injected' : 'Missing'}<br>
        TopBar: ${window.awosTopBar ? 'Available' : 'Not Found'}<br>
        Host: ${location.hostname}<br>
        Time: ${new Date().toLocaleTimeString()}<br><br>

        <strong>🌗 Theme Mode</strong><br>
        Mode Type: ${window.awosDarkModeType}<br>
        Source: ${source}<br>
        Active: ${isDark ? '🌙 Dark' : '☀️ Light'}<br>
        Auto Enabled: ${window.awosDarkAuto ? 'Yes' : 'No'}<br>
        Auto State (if active): ${autoState !== null ? (autoState ? '🌙 Night' : '☀️ Day') : 'n/a'}<br><br>

        <strong>📍 Location</strong><br>
        ${coords ? `${coords.lat.toFixed(4)}, ${coords.lng.toFixed(4)} (Elev: ${coords.elevation}m)` : 'n/a'}<br><br>

        <strong>🌅 Sun Times</strong><br>
        Sunrise: ${sunrise ? sunrise.toISOString() : 'n/a'}<br>
        Sunset: ${sunset ? sunset.toISOString() : 'n/a'}<br><br>

        <strong>⏱️ Next Auto Change</strong><br>
        ${nextModeLabel ?? 'n/a'} in ${timeUntilChange} (${nextChangeUTC ? nextChangeUTC.toISOString() : 'n/a'})<br>
      `;
    }
    function restoreDebugPanel() {
        const state = PanelStateManager.load('debug');

        if (!state?.active) {
            Logger.info('[Debug Panel] No saved state found. Skipping restore.');
            return;
        }

        window.requestAnimationFrame(() => {
            setTimeout(() => {
                Logger.info('[Debug Panel] Restoring saved panel state.');
                openDebugPanel();
            }, 300);
        });
    }

    async function openReportViewer() {
        if (window.self !== window.top) {
            Logger.info('[Report Viewer] Skipping spawn — running inside iframe.');
            return;
        }

        if (window.__awosReportViewerSpawned) {
            console.log('[Report Viewer] Already spawned — skipping.');
            return;
        }
        window.__awosReportViewerSpawned = true;

        const localUrl = `http://localhost/english/AWOS/?id=${id}&atime=${atime}`;
        const publicUrl = `https://met.forces.gc.ca/english/airops/AWOS/?id=${id}&atime=${atime}`;
        let finalUrl = publicUrl;

        try {
            const res = await fetch(localUrl, { method: 'HEAD' });
            if (res.ok) {
                finalUrl = localUrl;
                Logger.info('[Report Viewer] Using localhost source');
            } else {
                Logger.warn('[Report Viewer] Localhost returned non-OK status, falling back');
            }
        } catch (err) {
            Logger.warn('[Report Viewer] Localhost unreachable, falling back:', err);
        }

        const viewerPanel = createPanel('AWOS Report Viewer', 'report-panel', 'report-content');
        const content = document.getElementById('report-content');
        if (!content) return;

        content.style.cssText = `
        display: flex;
        flex-direction: column;
        flex: 1;
        padding: 0;
        margin: 0;
        overflow: hidden;
      `;

        const navBar = createReportNavBar(id, atime, content, viewerPanel);
        viewerPanel.insertBefore(navBar, content);

        const iframe = document.createElement('iframe');
        iframe.src = finalUrl;
        iframe.style.cssText = `
        flex: 1;
        width: 100%;
        height: 100%;
        border: none;
      `;
        content.appendChild(iframe);

        saveReportSnapshot(viewerPanel, content, finalUrl);
        Logger.info(`AWOS Report Viewer opened to ${finalUrl}`);
    }
    function createReportNavBar(id, atime, contentEl, panelEl) {
        const nav = document.createElement('div');
        nav.style.cssText = 'display:flex;justify-content:space-between;margin-bottom:10px;';

        const prevHourBtn = document.createElement('button');
        prevHourBtn.textContent = '⟵ Previous Hour';
        prevHourBtn.onclick = () => {
            const newTime = shiftTime(atime, -1);
            loadReportInto(contentEl, id, newTime);
            atime = newTime;
        };

        const prevSpecialBtn = document.createElement('button');
        prevSpecialBtn.textContent = '⟵ Previous Special';
        prevSpecialBtn.onclick = () => {
            findPreviousSpecialReport(id, atime, (newTime, html) => {
                if (newTime) {
                    atime = newTime;
                    contentEl.innerHTML = html;
                } else {
                    contentEl.innerHTML = 'No recent special report found.';
                }
            });
        };

        const nextBtn = document.createElement('button');
        nextBtn.textContent = 'Next ⟶';
        nextBtn.onclick = () => {
            const newTime = shiftTime(atime, 2);
            loadReportInto(contentEl, id, newTime);
            atime = newTime;
        };

        const latestBtn = document.createElement('button');
        latestBtn.textContent = '🕒 Latest';
        latestBtn.onclick = () => {
            PanelStateManager.clear('report');
            window.__awosReportViewerSpawned = false;
            panelEl.remove();
            Logger.info('[Report Viewer] Report window closed and saved state cleared.');
        };

        nav.appendChild(prevHourBtn);
        nav.appendChild(prevSpecialBtn);
        nav.appendChild(nextBtn);
        nav.appendChild(latestBtn);
        return nav;
    }
    function updateReportTitleBar(updatedText, isSnapshot = false, panelId = 'report-panel') {
        const titleText = document.getElementById(`${panelId}-title-text`);
        const titleBar = document.getElementById(`${panelId}-title`);
        if (!titleText || !titleBar) return;

        titleText.textContent = `AWOS Report Viewer. last updated: ${updatedText ? ' — ' + updatedText : ''}`;
        titleBar.style.background = isSnapshot ? '#ffcc00' : '#0077cc';
        titleBar.style.color = isSnapshot ? '#000' : 'white';
        titleBar.title = isSnapshot ? 'Snapshot restored — data may be outdated' : '';
    }
    function styleReportContent(content) {
        content.style.cssText = `
            display: flex;
            flex-direction: column;
            flex: 1;
            min-height: 0;
            padding: 0;
            margin: 0;
            overflow: hidden;
            overscroll-behavior: contain;
        `;
    }
    function saveReportSnapshot(panel, content, url) {
        try {
            PanelStateManager.update('report', {
                active: true,
                url,
                timestamp: new Date().toISOString(),
                content: content.innerHTML
            });

            PanelStateManager.saveGeometry('report', panel);
            Logger.info('[Report Viewer] State saved.');
        } catch (e) {
            Logger.error('[Report Viewer] Failed to save state:', e);
        }
    }
    function restoreReportSnapshot() {
        if (window.self !== window.top) {
            Logger.info('[Report Viewer] Skipping spawn — running inside iframe.');
            return;
        }

        const state = PanelStateManager.load('report');

        if (!state?.active || !state.content) {
            Logger.info('[Report Viewer] No saved state found. Skipping restore.');
            return;
        }

        window.requestAnimationFrame(() => {
            setTimeout(() => {
                Logger.info(`[Report Viewer] Restoring saved report from ${state.timestamp || 'unknown time'}`);

                const panel = createPanel('AWOS Report Viewer', 'report-panel', 'report-content');
                if (!panel) return;

                window.__awosReportViewerSpawned = true;
                updateReportTitleBar(state.timestamp || '', true, 'report-panel');

                const content = document.getElementById('report-content');
                if (!content) return;

                styleReportContent(content);

                content.innerHTML = state.content;

                let reportUrl;
                try {
                    reportUrl = new URL(state.url || location.href, location.origin);
                } catch {
                    reportUrl = new URL(location.href);
                }

                const id = reportUrl.searchParams.get('id');
                const atime = reportUrl.searchParams.get('atime');
                const navBar = createReportNavBar(id, atime, content, panel);
                panel.insertBefore(navBar, content);
            }, 300);
        });
    }

    async function renderAwosSelectorPanel() {
        Logger.info('[AWOS Selector] Opening selector panel...');

        const panelId = 'selector-panel';
        const contentId = 'selector-content';

        const existingPanel = document.getElementById(panelId);
        if (existingPanel) {
            Logger.info('[AWOS Selector] Panel already open, refreshing content...');
            await updateAwosSelectorContent(contentId);
            return;
        }

        const panel = createPanel('AWOS Station Selector', panelId, contentId);
        if (!panel) return;

        PanelStateManager.update('selector', { active: true });

        try {
            await updateAwosSelectorContent(contentId);
        } catch (err) {
            PanelStateManager.clear('selector');
            panel.remove();
            console.error('[AWOS Selector] Failed to fetch stations:', err);
            return;
        }

        Logger.info('[AWOS Selector] Panel created successfully.');
    }
    async function extractAwosStationsFromSelectorPage() {
        const localURL = 'http://localhost/english/AWOS/';
        const publicURL = 'https://met.forces.gc.ca/english/airops/AWOS/';
        let response;

        try {
            response = await fetch(localURL, { method: 'GET', mode: 'cors' });
            if (!response.ok) throw new Error('Localhost not available');
            console.log('[AWOS Selector] Using localhost source');
        } catch (err) {
            console.warn('[AWOS Selector] Falling back to public source:', err);
            response = await fetch(publicURL);
        }

        const html = await response.text();
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');

        const checkboxes = doc.querySelectorAll('input[type="checkbox"][name="id"]');
        const stations = [];

        checkboxes.forEach(cb => {
            const icao = cb.value?.trim();
            const label = cb.nextElementSibling?.textContent?.trim();
            if (icao && /^[A-Z]{4}$/.test(icao)) {
                stations.push({
                    icao,
                    label,
                    url: `${response.url}?id=${icao}`
                });
            }
        });

        return stations;
    }
    async function updateAwosSelectorContent(contentId) {
        const content = document.getElementById(contentId);
        if (!content) return;

        content.innerHTML = ''; // Clear previous content
        const stations = await extractAwosStationsFromSelectorPage();

        stations.forEach(({ icao, label, url }) => {
            const btn = document.createElement('button');
            btn.textContent = `${icao} – ${label}`;
            styleButton(btn, '#0f0', {
                color: '#000',
                marginBottom: '4px',
                padding: '4px 8px',
                fontSize: '13px',
                fontWeight: 'normal',
                width: '100%',
                textAlign: 'left'
            });

            btn.onclick = () => window.open(url, '_blank');
            content.appendChild(btn);
        });
    }
    async function restoreSelectorPanel() {
        const state = PanelStateManager.load('selector');
        if (!state?.active) return;

        const panelId = 'selector-panel';
        const contentId = 'selector-content';

        const panel = createPanel('AWOS Station Selector', panelId, contentId);
        if (!panel) return;

        try {
            await updateAwosSelectorContent(contentId);
        } catch (err) {
            console.error('[AWOS Selector] Failed to restore stations:', err);
        }
    }


    function handleDetailClick(e) {
        const link = e.target.closest('a');
        if (!link || !link.href.includes('/AWOS/?id=') || !link.href.includes('&detail=')) return;

        e.preventDefault();
        e.stopImmediatePropagation();

        loadDetail(link.href);
    }
    function updateDetailTitleBar(updatedText, isSnapshot = false) {
        const titleText = document.getElementById('detail-title-text');
        const titleBar = document.getElementById('detail-title');
        if (!titleText || !titleBar) return;

        titleText.textContent = `AWOS Detail Viewer${updatedText ? ' — ' + updatedText : ''}`;
        titleBar.style.background = isSnapshot ? '#ffcc00' : '#0077cc';
        titleBar.style.color = isSnapshot ? '#000' : 'white';
        titleBar.title = isSnapshot ? 'Snapshot restored — data may be outdated' : '';
    }
    function stripDetailText(rawHTML) {
        const parser = new DOMParser();
        const doc = parser.parseFromString(rawHTML, 'text/html');
        const bodyText = doc.body.innerText;
        let lines = bodyText.split('\n');

        const detailIdx = lines.findIndex(line => line.startsWith('Detail -'));
        if (detailIdx > -1) lines = lines.slice(detailIdx);

        const configPatterns = [
            /^Search Back:/, /^Search from/, /^Search From Time/, /^Reset Detail/,
            /^Use\/sample every/, /^Maximum number of records/, /^Format to display/,
            /^Data type to display/, /^Detail to display/, /^Show Errored\/Malformed/,
            /^\(\s*errored\/total\):/, /^Contact us/, /^Questions or comments\?/,
            /^About/, /^Notices/, /^Canada.gc.ca/, /^Visit Canada.gc.ca/
        ];
        lines = lines.filter(line => !configPatterns.some(pattern => pattern.test(line.trim())));

        let summaryFromText = '';
        lines = lines.filter(line => {
            if (line.startsWith('Summary From')) {
                summaryFromText = line.trim();
                return false;
            }
            return !line.startsWith('Number of reports used');
        });

        lines = lines.filter(line => !line.startsWith('Updated:'));

        console.log("Summary:", summaryFromText);
        return {
            cleanedText: lines.join('\n'),
            summaryFromText // or whatever format you're using

        };
    }
    function styleCloudDetail(floaterContent, summaryFromText = '') {

        const rawText = floaterContent.textContent;
        const cloudStart = rawText.indexOf('Detail - CLD');
        if (cloudStart === -1) return;
        const cloudBlock = rawText.slice(cloudStart);
        const lines = cloudBlock.split('\n').map(line => line.trim()).filter(Boolean);
        const summaryLineIndex = lines.findIndex(line => line.startsWith('Summary From'));
        if (summaryLineIndex !== -1) {
            summaryFromText = lines[summaryLineIndex];
        }
        const summaryStart = lines.findIndex(line => line.startsWith('Summary Type'));
        const samplingLines = lines.slice(3, summaryStart);
        const summaryLines = lines.slice(summaryStart + 1);

        // Determine detail type from URL
        const detailType = new URL(window.location.href).searchParams.get('detail') || 'Cloud';

        // Create container
        const detailContainer = document.createElement('div');
        detailContainer.id = 'detail-container';

        if (summaryFromText) {
            const summaryHeader = document.createElement('div');
            summaryHeader.textContent = summaryFromText;
            summaryHeader.style.cssText = `
        font-weight: bold;
        font-size: 14px;
        margin: 12px 0 4px;
        padding: 4px 8px;
        background-color: #e8f0ff;
        border-left: 4px solid #4285f4;
      `;
            detailContainer.appendChild(summaryHeader);
        }

        // Add header to top of floater
        const floaterHeader = document.createElement('div');
        floaterHeader.textContent = `Detail – ${detailType.toUpperCase()}`;
        floaterHeader.style.cssText = `
          font-weight: bold;
          font-size: 16px;
          padding: 8px 12px;
          background-color: #f0f0f0;
          border-bottom: 1px solid #ccc;
        `;
        detailContainer.appendChild(floaterHeader);

        // Sampling Table
        const samplingTable = document.createElement('table');
        samplingTable.className = 'cloud-table';
        samplingTable.innerHTML = `
          <thead>
            <tr><th>Stn</th><th>SP</th><th>Date</th><th>Time</th>
                <th>Layer 1</th><th>Layer 2</th><th>Layer 3</th>
                <th>Layer 4</th><th>Layer 5</th></tr>
          </thead>
          <tbody>
            ${samplingLines.map(line => {
            const parts = line.match(/(\w+)?\s*(\w{2})?\s*(\d{2})\s*(\d{2}:\d{2})\s*(.*?)$/);
            if (!parts) return '';
            const [_, stn, sp, dd, time, layers] = parts;
            const layerParts = layers.trim().split(/\s+/);
            while (layerParts.length < 5) layerParts.push('');
            return `<tr>
                <td>${stn || ''}</td><td>${sp || ''}</td><td>${dd}</td><td>${time}</td>
                ${layerParts.map(l => `<td>${l}</td>`).join('')}
              </tr>`;
        }).join('')}
          </tbody>
        `;

        // Summary Table
        const summaryTable = document.createElement('table');
        summaryTable.className = 'summary-table';
        const summaryHeader = document.createElement('div');
        summaryHeader.textContent = summaryFromText || 'Hourly Summary';
        summaryHeader.style.cssText = `
          font-weight: bold;
          font-size: 14px;
          margin: 12px 0 4px;
          padding: 4px 8px;
          background-color: #e8f0ff;
          border-left: 4px solid #4285f4;
        `;
        summaryTable.innerHTML = `
          <thead>
            <tr><th>Type</th><th>Value</th><th>Unit</th><th>Stn</th><th>Date</th><th>Time</th></tr>
          </thead>
          <tbody>
            ${summaryLines.map(line => {
            const type  = line.slice(0, 18).trim();
            const value = line.slice(19, 28).trim();
            const unit  = line.slice(29, 33).trim();
            const stn   = line.slice(34, 44).trim();
            const dd    = line.slice(44, 50).trim();
            const time  = line.slice(50).trim();
            return `<tr>
                <td>${type}</td><td>${value}</td><td>${unit}</td>
                <td>${stn}</td><td>${dd}</td><td>${time}</td>
              </tr>`;
        }).join('')}
          </tbody>
        `;
        // Inject tables into container

        //blank placeholder for inital table header load
        if (summaryFromText) {
            const summaryHeader = document.createElement('div');
            detailContainer.appendChild(summaryHeader);
        }

        detailContainer.appendChild(samplingTable);
        if (summaryFromText) {
            const summaryHeader = document.createElement('div');
            summaryHeader.textContent = summaryFromText;
            summaryHeader.style.cssText = `
              font-weight: bold;
              font-size: 14px;
              margin: 12px 0 4px;
              padding: 4px 8px;
              background-color: #e8f0ff;
              border-left: 4px solid #4285f4;
            `;
            detailContainer.appendChild(summaryHeader);
        }
        detailContainer.appendChild(summaryTable);

        // Replace floater content
        floaterContent.innerHTML = '';
        floaterContent.appendChild(detailContainer);
    }
    function loadDetail(url) {
        fetch(url)
            .then(res => res.text())
            .then(html => {
                const updatedText = extractUpdatedTimestamp(html);

                PanelStateManager.update('detail', {
                    active: true,
                    timestamp: updatedText,
                    url
                });

                createPanel(updatedText, 'detail-panel', 'detail-content');
                updateDetailTitleBar(updatedText, false)

                const { cleanedText, summaryFromText } = stripDetailText(html);

                const content = document.getElementById('detail-content');


                if (content) {
                    content.innerHTML = `<pre style="white-space: pre-wrap;">${cleanedText}</pre>`;
                    styleCloudDetail(content, summaryFromText);
                    saveDetailSnapshot(content);
                }

            });

    }
    function restoreDetailSnapshot() {
        const state = PanelStateManager.load('detail');

        if (!state?.active || !state.content) {
            Logger.info('[Detail Viewer] No saved state found. Skipping restore.');
            return;
        }

        window.requestAnimationFrame(() => {
            setTimeout(() => {
                Logger.info(`[Detail Viewer] Restoring saved detail from ${state.timestamp || 'unknown time'}`);

                const panel = createPanel(
                    state.timestamp || 'AWOS Detail Viewer',
                    'detail-panel',
                    'detail-content'
                );
                if (!panel) return;

                updateDetailTitleBar(state.timestamp || '', true);

                const content = document.getElementById('detail-content');
                if (content) content.innerHTML = state.content;
            }, 300);
        });
    }
    function saveDetailSnapshot(content) {
        try {
            PanelStateManager.update('detail', {
                active: true,
                content: content.innerHTML
            });

            Logger.info('[Detail Viewer] State saved.');
        } catch (e) {
            Logger.error('[Detail Viewer] Failed to save state:', e);
        }
    }

    document.addEventListener('click', handleDetailClick);

    window.renderAwosSelectorPanel = renderAwosSelectorPanel;
    window.openDebugPanel = openDebugPanel;
    window.updateDebugContent = updateDebugContent;
    window.openReportViewer = openReportViewer;

    restoreSelectorPanel();
    restoreDebugPanel();
    restoreDetailSnapshot();
    restoreReportSnapshot();

})();
