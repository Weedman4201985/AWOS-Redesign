// ==UserScript==
// @name         CFWOS Floating Panel 6.0
// @namespace    chris.awos
// @version      6.0e(createPanel Split)
// @description  Floating AWOS detail viewer with drag, resize, and persistent state
// @match        https://met.forces.gc.ca/english/airops/AWOS/*
// @grant        none
// @run-at       document-idle
// ==/UserScript==

(function () {
    'use strict';

    function getPanelKeys(panelType) {
      return {
        urlKey: `${panelType}-url`,
        snapshotKey: `${panelType}-snapshot`,
        timestampKey: `${panelType}-timestamp`,
        positionKey: `${panelType}-position`,
        sizeKey: `${panelType}-size`
      };
    }
    window.getPanelKeys = getPanelKeys;
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

    const id = 'CYTR'
    const atime = getLatestHourlyTimestamp()

    const AWOS_BASE_URL = 'https://met.forces.gc.ca/english/airops/AWOS/';
    const timestamp = new Date().toISOString();

    let isDragging = false;
    let offsetX = 0;
    let offsetY = 0;

    function saveFloaterSize(panel, panelId) {
      const rect = panel.getBoundingClientRect();
      const clampedWidth = Math.min(rect.width, window.innerWidth - rect.left);
      const clampedHeight = Math.min(rect.height, window.innerHeight - rect.top);

      const { sizeKey } = getPanelKeys(panelId);
      localStorage.setItem(sizeKey, JSON.stringify({
        width: `${clampedWidth}px`,
        height: `${clampedHeight}px`
      }));
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
    /*function enablePanelSnapshotSaving(panel, panelType) {
      const { snapshotKey } = getPanelKeys(panelType);

      panel.addEventListener('mouseup', () => {
        const rect = panel.getBoundingClientRect();
        const snapshot = {
          width: rect.width,
          height: rect.height,
          left: rect.left,
          top: rect.top
        };
        localStorage.setItem(snapshotKey, JSON.stringify(snapshot));
      });
    }*/
    function enablePanelSnapshotSaving(panel, panelType) {
      const { snapshotKey } = getPanelKeys(panelType);

      const snapshotMouseUp = () => {
        if (!document.body.contains(panel)) return;
        const rect = panel.getBoundingClientRect();
        const snapshot = {
          width: rect.width,
          height: rect.height,
          left: rect.left,
          top: rect.top
        };
        localStorage.setItem(snapshotKey, JSON.stringify(snapshot));
      };

      panel._snapshotMouseUp = snapshotMouseUp;
      panel.addEventListener('mouseup', snapshotMouseUp);
    }
    function restorePanelSnapshot(panel, panelId) {
        const { snapshotKey } = getPanelKeys(panelId);
        const snapshot = JSON.parse(localStorage.getItem(snapshotKey));
        if (!snapshot) return;

        if (snapshot.width) panel.style.width = `${snapshot.width}px`;
        if (snapshot.height) panel.style.height = `${snapshot.height}px`;
        if (snapshot.top) panel.style.top = snapshot.top;
        if (snapshot.left) panel.style.left = snapshot.left;
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

                  if (!panel || panel.offsetWidth === 0 || panel.offsetHeight === 0) return;

                  const { snapshotKey } = getPanelKeys(panel.id);
                  localStorage.setItem(snapshotKey, JSON.stringify({
                    width: panel.offsetWidth,
                    height: panel.offsetHeight,
                    top: panel.style.top,
                    left: panel.style.left
                  }));
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
                    const { snapshotKey } = getPanelKeys(panel.id);

                    document.removeEventListener('mousemove', onMouseMove);
                    document.removeEventListener('mouseup', onMouseUp);
                    localStorage.setItem(snapshotKey, JSON.stringify({
                        width: panel.offsetWidth,
                        height: panel.offsetHeight,
                        top: panel.style.top,
                        left: panel.style.left
                    }));
                }

                document.addEventListener('mousemove', onMouseMove);
                document.addEventListener('mouseup', onMouseUp);
            });
        });

    }
    /*function enablePanelDragging(titleBar, panel) {
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

      document.addEventListener('mouseup', () => {
        isDragging = false;
        document.body.style.userSelect = '';
        const { snapshotKey } = getPanelKeys(panel.id);
        localStorage.setItem(snapshotKey, JSON.stringify({
            width: panel.offsetWidth,
            height: panel.offsetHeight,
            top: panel.style.top,
            left: panel.style.left
        }));
      });
    }*/
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
        const { snapshotKey } = getPanelKeys(panel.id);
        if (document.body.contains(panel)) {
          localStorage.setItem(snapshotKey, JSON.stringify({
            width: panel.offsetWidth,
            height: panel.offsetHeight,
            top: panel.style.top,
            left: panel.style.left
          }));
        }
      };

      panel._dragMouseUp = dragMouseUp;
      document.addEventListener('mouseup', dragMouseUp);
    }

    function createPanel(titleText = '', panelId = 'floating-panel', contentId = 'floating-panel-content') {
      if (document.getElementById(panelId)) {
        console.warn(`[Floater] Panel "${panelId}" already exists. Skipping creation.`);
        return;
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

      const { snapshotKey } = getPanelKeys(panelId);
      const snapshot = localStorage.getItem(snapshotKey);

      if (snapshot) {
        const { width, height, top, left } = JSON.parse(snapshot);
        if (width) panel.style.width = typeof width === 'number' ? `${width}px` : width;
        if (height) panel.style.height = typeof height === 'number' ? `${height}px` : height;
        if (top) panel.style.top = top;
        if (left) panel.style.left = left;
      }


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

      let titleTextEl = document.getElementById(`${panelId}-title-text`);
      if (!titleTextEl) {
        titleTextEl = document.createElement('span');
        titleTextEl.id = `${panelId}-title-text`;
        titleBar.appendChild(titleTextEl);
      }
      titleTextEl.textContent = titleText;

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
        if (panel._dragMouseUp) {
          document.removeEventListener('mouseup', panel._dragMouseUp);
          panel._dragMouseUp = null;
        }
        if (panel._snapshotMouseUp) {
          panel.removeEventListener('mouseup', panel._snapshotMouseUp);
          panel._snapshotMouseUp = null;
        }

        panel.remove();

        const panelType = panelId.replace(/-panel$/, '');
        const { snapshotKey, urlKey, timestampKey, positionKey, sizeKey } = getPanelKeys(panelType);

        [snapshotKey, urlKey, timestampKey, positionKey, sizeKey].forEach(key => localStorage.removeItem(key));


        if (panelType === 'debug') {
          ['debug-snapshot', 'debug-active', 'debug-style'].forEach(key => localStorage.removeItem(key));
        }


        if (panelType === 'report') {
          window.__awosReportViewerSpawned = false;
          localStorage.removeItem('report-html');
          localStorage.removeItem('report-active');
        }

        if (panelId === 'selector-panel') {
            localStorage.removeItem('selector-active');
        }


        Logger.info(`[Floater] ${panelId} closed and snapshot cleared.`);
      };

      titleBar.appendChild(closeBtn);

      const content = document.createElement('div');
      content.id = contentId;
      content.style.cssText = `
        flex: 1;
        padding: 10px;
        overflow-y: auto;
        background: #000;
        color: #0f0;
      `;

      panel.appendChild(titleBar);
      panel.appendChild(content);
      document.body.appendChild(panel);

      enablePanelSnapshotSaving(panel, panelId);
      restorePanelSnapshot(panel, panelId);
      clampPanelPosition(panel);
      enablePanelDragging(titleBar, panel);
      addPanelResizers(panel);

      return panel;
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
    function forcePageReload() {
          window.onbeforeunload = null;
          window.onunload = null;
          window.location.reload(); // ✅ standard reload
          //location.href = location.href;
    }
    function extractUpdatedTimestamp(rawHTML) {
        const parser = new DOMParser();
        const doc = parser.parseFromString(rawHTML, 'text/html');
        const abbr = doc.querySelector('abbr.timepopup');
        return abbr ? `Updated: ${abbr.textContent.trim()}` : '';
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

    async function extractAwosStationsFromSelectorPage() {
        const response = await fetch('https://met.forces.gc.ca/english/airops/AWOS/');
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
                    url: `https://met.forces.gc.ca/english/airops/AWOS/?id=${icao}`
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
    async function renderAwosSelectorPanel() {
        Logger.info('[AWOS Selector] Opening selector panel...');

        const panelId = 'selector-panel';
        const contentId = 'selector-content';

        // If already open, just refresh content
        const existingPanel = document.getElementById(panelId);
        if (existingPanel) {
            Logger.info('[AWOS Selector] Panel already open, refreshing content...');
            updateAwosSelectorContent(contentId);
            return;
        }

        let stations;
        try {
            stations = await extractAwosStationsFromSelectorPage();
        } catch (err) {
            console.error('[AWOS Selector] Failed to fetch stations:', err);
            return;
        }

        // Create panel with proper IDs
        const panel = createPanel('AWOS Station Selector', panelId, contentId);
        panel.style.cssText += `
            width: 408px;
            height: 859px;
            max-height: 859px;
            resize: none;
        `;

        localStorage.setItem('selector-active', 'true');

        const content = document.getElementById(contentId);
        if (!content) {
            console.error('[AWOS Selector] Content area not found in panel.');
            return;
        }
        content.style.overflowY = 'auto';

        // Add station buttons
        stations.forEach(({ icao, label, url }) => {
            const btn = document.createElement('button');
            btn.textContent = `${icao} – ${label}`;
            styleButton(btn, '#0078D4', {
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


        // Enable v6 features
        restorePanelSnapshot(panel, 'selector');
        enablePanelSnapshotSaving(panel, 'selector');
        addPanelResizers(panel);


        Logger.info('[AWOS Selector] Panel created successfully.');
    }
    async function restoreSelectorPanel() {
      const isActive = localStorage.getItem('selector-active') === 'true';
      if (!isActive) return;

      const panelId = 'selector-panel';
      const contentId = 'selector-content';

      const stations = await extractAwosStationsFromSelectorPage();
      const panel = createPanel('AWOS Station Selector', panelId, contentId);

      restorePanelSnapshot(panel, 'selector');
      enablePanelSnapshotSaving(panel, 'selector');
      addPanelResizers(panel);

      const rect = panel.getBoundingClientRect();
      const maxLeft = window.innerWidth - rect.width;
      const maxTop = window.innerHeight - rect.height;

      if (rect.left < 0 || rect.left > maxLeft) panel.style.left = '50px';
      if (rect.top < 0 || rect.top > maxTop) panel.style.top = '50px';

      stations.forEach(({ icao, label, url }) => {
          const btn = document.createElement('button');
          btn.textContent = `${icao} – ${label}`;
          styleButton(btn, '#0078D4', {
              marginBottom: '4px',
              padding: '4px 8px',
              fontSize: '13px',
              fontWeight: 'normal',
              width: '100%',
              textAlign: 'left'
          });

          btn.onclick = () => window.open(url, '_blank');
          panel.appendChild(btn);
      });
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

        const { snapshotKey, urlKey, timestampKey, positionKey, sizeKey } = getPanelKeys(panelEl);

        [snapshotKey, urlKey, timestampKey, positionKey, sizeKey].forEach(key => localStorage.removeItem(key));

        window.__awosReportViewerSpawned = false;
        localStorage.removeItem('report-html');
        localStorage.removeItem('report-active');

        panelEl.remove();
        Logger.info('[Report Viewer] Report window closed. Snapshot and keys deleted.');
      };

      nav.appendChild(prevHourBtn);
      nav.appendChild(prevSpecialBtn);
      nav.appendChild(nextBtn);
      nav.appendChild(latestBtn);
      return nav;
    }
    function saveReportSnapshot(panel, content, url) {
      const { urlKey, timestampKey } = getPanelKeys('report');
      try {
        localStorage.setItem(urlKey, url);
        localStorage.setItem(timestampKey, new Date().toISOString());
        localStorage.setItem('report-html', content.innerHTML); // optional if you want to keep HTML snapshot
        enablePanelSnapshotSaving(panel, 'report'); // ✅ new snapshot logic
        Logger.info('[Report Viewer] Snapshot saved.');
      } catch (e) {
        Logger.error('[Report Viewer] Failed to save snapshot:', e);
      }
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
    function restoreReportSnapshot() {
      if (window.self !== window.top) {
        Logger.info('[Report Viewer] Skipping spawn — running inside iframe.');
        return;
      }

      const { snapshotKey, timestampKey } = getPanelKeys('report');
      const snapshotHTML = localStorage.getItem('report-html'); // optional
      const restoredTimestamp = localStorage.getItem(timestampKey) || '';

      if (!snapshotHTML) {
        Logger.info('[Report Viewer] No snapshot found in localStorage. Skipping restore.');
        return;
      }

      window.requestAnimationFrame(() => {
        setTimeout(() => {
          Logger.info(`[Report Viewer] Restoring snapshot from ${restoredTimestamp}`);
          const panel = createPanel('AWOS Report Viewer', 'report-panel', 'report-content');
          restorePanelSnapshot(panel, 'report'); // ✅ new restore logic
          updateReportTitleBar(restoredTimestamp, true, 'report-panel');

          const content = document.getElementById('report-content');
          if (content) {
            content.innerHTML = snapshotHTML;
            const urlParams = new URLSearchParams(location.search);
            const id = urlParams.get('id');
            const atime = urlParams.get('atime');
            const navBar = createReportNavBar(id, atime, content, panel);
            panel.insertBefore(navBar, content);
          }
        }, 300);
      });
    }
    function openReportViewer() {
      if (window.self !== window.top) {
        Logger.info('[Report Viewer] Skipping spawn — running inside iframe.');
        return;
      }

      if (window.__awosReportViewerSpawned) {
        console.log('[Report Viewer] Already spawned — skipping.');
        return;
      }
      window.__awosReportViewerSpawned = true;

      const url = `https://met.forces.gc.ca/english/airops/AWOS/?id=${id}&atime=${atime}`;
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
      localStorage.setItem('report-active', 'true');

      const iframe = document.createElement('iframe');
      iframe.src = url;
      iframe.style.cssText = `
        flex: 1;
        width: 100%;
        height: 100%;
        border: none;
      `;
      content.appendChild(iframe);

      saveReportSnapshot(viewerPanel, content, url);
      Logger.info(`AWOS Report Viewer opened to ${url}`);
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
    function openDebugPanel() {

        const panelId = 'debug-panel';
        const contentId = 'debug-content';

        // If panel already exists, just update content
        const existingPanel = document.getElementById(panelId);

        if (existingPanel) {
            localStorage.setItem('debug-active', 'true');
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
        localStorage.setItem('debug-active', 'true');
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
    function restoreDebugPanel() {
      const isActive = localStorage.getItem('debug-active') === 'true';
      const { snapshotKey, timestampKey } = getPanelKeys('debug');
      const snapshot = localStorage.getItem('debug-panel-snapshot');

      const restoredTimestamp = localStorage.getItem(timestampKey) || '';

      if (!isActive || !snapshot) {
        Logger.info('[Debug Panel] No snapshot found in localStorage. Skipping restore.');
        return;
      }
      window.requestAnimationFrame(() => {
        setTimeout(() => {
          Logger.info(`[Debug Panel] Restoring snapshot from ${restoredTimestamp}`);
          openDebugPanel(); // sets up styles and content

          const panel = document.getElementById('debug-panel');
          if (!panel) return;

          try {
            const { width, height, top, left } = JSON.parse(snapshot);
            if (width) panel.style.width = typeof width === 'number' ? `${width}px` : width;
            if (height) panel.style.height = typeof height === 'number' ? `${height}px` : height;
            if (top) panel.style.top = top;
            if (left) panel.style.left = left;
          } catch (err) {
            console.warn('[Debug Panel] Failed to parse snapshot:', err);
          }
        }, 300);
      });
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
    function saveDetailSnapshot(content) {
        try {
            const { snapshotKey } = getPanelKeys('detail');
            localStorage.setItem(snapshotKey, content.innerHTML);
            Logger.info('Snapshot saved.');
        } catch (e) {
            Logger.error('[Detail Viewer] Failed to save snapshot:', e);
        }
    }
    function restoreDetailSnapshot() {
        const { snapshotKey } = getPanelKeys('detail');
        const snapshot = localStorage.getItem(snapshotKey);
        const { timestampKey } = getPanelKeys('detail');
        const restoredTimestamp = localStorage.getItem(timestampKey) || '';
        if (!snapshot) {
            Logger.info('[Detail Viewer] No floater snapshot found in localStorage. Skipping restore.');
            return;
        }

        window.requestAnimationFrame(() => {
            setTimeout(() => {
                Logger.info(`[Detail Viewer] Restoring floater from ${restoredTimestamp}`);
                createPanel(restoredTimestamp, 'detail-panel', 'detail-content');
                updateDetailTitleBar(restoredTimestamp, true)
                const content = document.getElementById('detail-content');
                if (content) content.innerHTML = snapshot;
            }, 300);
        });
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
                const { timestampKey } = getPanelKeys('detail');
                localStorage.setItem(timestampKey, updatedText);

                createPanel(updatedText, 'detail-panel', 'detail-content');
                updateDetailTitleBar(updatedText, false)

                const { cleanedText, summaryFromText } = stripDetailText(html);

                const content = document.getElementById('detail-content');


                if (content) {
                    content.innerHTML = `<pre style="white-space: pre-wrap;">${cleanedText}</pre>`;
                    styleCloudDetail(content, summaryFromText);
                    saveDetailSnapshot(content);
                }
                const { urlKey } = getPanelKeys('detail');
                localStorage.setItem(urlKey, url);

            });

    }


    function handleDetailClick(e) {
        const link = e.target.closest('a');
        if (!link || !link.href.includes('/AWOS/?id=') || !link.href.includes('&detail=')) return;

        e.preventDefault();
        e.stopImmediatePropagation();

        loadDetail(link.href);
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
