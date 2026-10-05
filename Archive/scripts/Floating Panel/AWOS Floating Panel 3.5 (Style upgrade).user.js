// ==UserScript==
// @name         AWOS Floating Panel 3.5 (Style upgrade)
// @namespace    chris.awos
// @version      3.5
// @description  Floating AWOS detail viewer with drag, resize, and persistent state
// @match        https://met.forces.gc.ca/english/airops/AWOS/*
// @grant        none
// ==/UserScript==

(function () {
  'use strict';

  const PANEL_ID = 'awos-floating-panel';
  const CONTENT_ID = 'awos-panel-content';
  const CLOSE_ID = 'awos-panel-close';
  const STORAGE_URL_KEY = 'awos-last-detail-url';
  const STORAGE_SNAPSHOT_KEY = 'awos-last-panel-snapshot';
  const STORAGE_TIMESTAMP_KEY = 'awos-last-timestamp';
  const STORAGE_POSITION_KEY = 'awos-panel-position';
  const STORAGE_SIZE_KEY = 'awos-panel-size';

  let isDragging = false;
  let offsetX = 0;
  let offsetY = 0;

  function createPanel(updatedText = '') {
    if (document.getElementById(PANEL_ID)) return;

    const panel = document.createElement('div');
    panel.id = PANEL_ID;
    Object.assign(panel.style, {
      position: 'fixed',
      background: '#fff',
      border: '1px solid #ccc',
      boxShadow: '0 0 10px rgba(0,0,0,0.3)',
      zIndex: '9999',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'auto',
      minWidth: '300px',
      minHeight: '150px',
      padding: '10px'
    });

    // Restore position and size
    const savedPos = JSON.parse(localStorage.getItem(STORAGE_POSITION_KEY));
    const savedSize = JSON.parse(localStorage.getItem(STORAGE_SIZE_KEY));
    panel.style.top = savedPos?.top || '20px';
    panel.style.left = savedPos?.left || '20px';
    panel.style.width = savedSize?.width || '400px';
    panel.style.height = savedSize?.height || '600px';

    // Title bar
    const titleBar = document.createElement('div');
    titleBar.id = 'awos-panel-title';
    Object.assign(titleBar.style, {
      background: '#0077cc',
      color: 'white',
      padding: '6px 10px',
      fontWeight: 'bold',
      display: 'flex',
      flexWrap: 'nowrap',
      overflow: 'hidden',
      justifyContent: 'space-between',
      alignItems: 'center',
      cursor: 'move'
    });

    const titleText = document.createElement('span');
    titleText.id = 'awos-panel-title-text';
    titleText.textContent = `AWOS Detail Viewer${updatedText ? ' — ' + updatedText : ''}`;

    // Close button
    const closeBtn = document.createElement('button');
    closeBtn.id = CLOSE_ID;
    closeBtn.textContent = '×';
    Object.assign(closeBtn.style, {
      fontSize: '20px',
      border: 'none',
      background: 'transparent',
      color: 'white',
      cursor: 'pointer',
      marginLeft: 'auto', // Pushes it to the right
      padding: '0 6px',
      lineHeight: '1',
      display: 'inline-block'
    });
    closeBtn.onclick = () => {
      panel.remove();
      localStorage.removeItem(STORAGE_URL_KEY);
      localStorage.removeItem(STORAGE_SNAPSHOT_KEY);
      localStorage.removeItem(STORAGE_TIMESTAMP_KEY);
      console.log('Floater closed and snapshot cleared.');
    };

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
      localStorage.setItem(STORAGE_POSITION_KEY, JSON.stringify({
        top: panel.style.top,
        left: panel.style.left
      }));
    });

    document.addEventListener('mouseup', () => {
      isDragging = false;
      document.body.style.userSelect = '';
    });

    // Content area
    const content = document.createElement('div');
    content.id = CONTENT_ID;
    Object.assign(content.style, {
      flex: '1',
      overflowY: 'auto',
      padding: '10px'
    });

    const style = document.createElement('style');
    style.textContent = `
      #awos-floating-panel {
        font-family: Arial, sans-serif;
        font-size: 15px;
        color: #333;
      }

      #awos-detail-container {
        border: 2px solid #0077cc;
        padding: 12px;
        margin: 10px 0;
        background-color: #f9f9f9;
        font-family: monospace;
        font-size: 0.85em;
        overflow-x: auto;
      }

      .awos-detail-header {
        font-weight: bold;
        font-size: 1.1em;
        margin-bottom: 8px;
        color: #0055aa;
      }

      .awos-cloud-table,
      .awos-summary-table {
        width: 100%;
        border-collapse: collapse;
        margin-bottom: 16px;
      }

      th, td {
        border: 1px solid #ccc;
        padding: 4px 6px;
        text-align: center;
      }

      .awos-cloud-table thead {
        background-color: #f0f0f0;
      }

      .awos-summary-table thead {
        background-color: #e0e0ff;
      }

      .awos-detail-header {
      font-weight: bold;
      font-size: 1.1em;
      margin-bottom: 10px;
      color: #0055aa;
    }

    .awos-detail-container table {
      border-collapse: collapse;
      margin-bottom: 20px;
      width: 100%;
    }

    .awos-detail-container th, .awos-detail-container td {
      border: 1px solid #ccc;
      padding: 4px 8px;
      text-align: left;
    }

    `;

    document.head.appendChild(style); // ✅ Correctly injects styles
    document.body.appendChild(panel); // ✅ Adds your floating panel


    panel.appendChild(titleBar);
    titleBar.appendChild(titleText);
    titleBar.appendChild(closeBtn);
    panel.appendChild(content);


   /* document.head.appendChild(style); // ✅ Injects styles into the page
    document.body.appendChild(panel); // ✅ Adds your floating panel*/



    //Restore Block
    setTimeout(() => {
      const floaterSnapshot = JSON.parse(localStorage.getItem('floaterSnapshot'));
      if (floaterSnapshot) {
        const { savedWidth, savedHeight, windowHeight } = floaterSnapshot;

        const safeHeight = Math.min(savedHeight, window.innerHeight - 50);
        panel.style.width = `${savedWidth}px`;
        panel.style.height = `${safeHeight}px`;

        panel.style.maxHeight = `${window.innerHeight - 50}px`;
        panel.style.overflow = 'hidden';


        // Optional: restore position if saved
        if (floaterSnapshot.left !== undefined && floaterSnapshot.top !== undefined) {
          panel.style.left = `${floaterSnapshot.left}px`;
          panel.style.top = `${floaterSnapshot.top}px`;
          panel.style.position = 'fixed';
        }
      }

     const savedSize = localStorage.getItem(STORAGE_SIZE_KEY);
        if (savedSize) {
          try {
            const { width, height } = JSON.parse(savedSize);
            const safeHeight = Math.min(parseInt(height), window.innerHeight - 50);
            panel.style.width = width;
            panel.style.height = `${safeHeight}px`;


            // Delay logging until panel is styled
            requestAnimationFrame(() => {
              const rect = panel.getBoundingClientRect();
              console.log('Restoring floater size:', {
                savedWidth: width,
                savedHeight: height,
                computedWidth: rect.width,
                computedHeight: rect.height,
                windowHeight: window.innerHeight
              });
            });
          } catch (e) {
            console.warn('Invalid size data:', e);
          }
        }

    }, 0);

    // Save Block on mouseup
    panel.addEventListener('mouseup', () => {
      if (document.body.contains(panel)) {
        const rect = panel.getBoundingClientRect();
        const floaterSnapshot = {
          styleWidth: panel.style.width,
          styleHeight: panel.style.height,
          computedWidth: rect.width,
          computedHeight: rect.height,
          windowHeight: window.innerHeight,
          savedWidth: rect.width,
          savedHeight: rect.height,
          left: rect.left,
          top: rect.top
        };

        // Clamp to viewport
        const clampedWidth = Math.min(rect.width, window.innerWidth - rect.left);
        const clampedHeight = Math.min(rect.height, window.innerHeight - rect.top);

        console.log('Saving floater size:', {
          clampedWidth,
          clampedHeight,
          windowHeight: window.innerHeight
        });

        localStorage.setItem('floaterSnapshot', JSON.stringify(floaterSnapshot));
        localStorage.setItem(STORAGE_SIZE_KEY, JSON.stringify({
          width: `${clampedWidth}px`,
          height: `${clampedHeight}px`
        }));
      }
    });

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
        resizer.style.width = '100%';
        resizer.style.height = '6px';
      } else {
        resizer.style.top = '0';
        resizer.style.height = '100%';
        resizer.style.width = '6px';
      }
      panel.appendChild(resizer);

      resizer.addEventListener('mousedown', (e) => {
        e.preventDefault();
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

        function onMouseUp() {
          document.removeEventListener('mousemove', onMouseMove);
          document.removeEventListener('mouseup', onMouseUp);
          document.removeEventListener('mouseup', saveFloaterSizeOnce);
        }
        document.addEventListener('mousemove', onMouseMove);
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
          localStorage.setItem(STORAGE_SIZE_KEY, JSON.stringify({
            width: panel.offsetWidth,
            height: panel.offsetHeight
          }));
          localStorage.setItem(STORAGE_POSITION_KEY, JSON.stringify({
            top: panel.style.top,
            left: panel.style.left
          }));
        }

        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
      });
    });

  }

  function updateTitleBar(updatedText, isSnapshot = false) {
    const titleText = document.getElementById('awos-panel-title-text');
    const titleBar = document.getElementById('awos-panel-title');
    if (!titleText || !titleBar) return;

    titleText.textContent = `AWOS Detail Viewer${updatedText ? ' — ' + updatedText : ''}`;
    titleBar.style.background = isSnapshot ? '#ffcc00' : '#0077cc';
    titleBar.style.color = isSnapshot ? '#000' : 'white';
    titleBar.title = isSnapshot ? 'Snapshot restored — data may be outdated' : '';
  }

  function saveFloaterSizeOnce() {
    const rect = panel.getBoundingClientRect();
    const clampedWidth = Math.min(rect.width, window.innerWidth - rect.left);
    const clampedHeight = Math.min(rect.height, window.innerHeight - rect.top);

    panel.style.width = `${clampedWidth}px`;
    panel.style.height = `${clampedHeight}px`;

    localStorage.setItem(STORAGE_SIZE_KEY, JSON.stringify({
      width: `${clampedWidth}px`,
      height: `${clampedHeight}px`
    }));

    document.removeEventListener('mouseup', saveFloaterSizeOnce);
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

    const summaryRegex = /^(Number of reports used|Summary From)/;
    lines = lines.filter(line => !summaryRegex.test(line));
    lines = lines.filter(line => !line.startsWith('Updated:'));

    return lines.join('\n');
  }

  function parseSummaryLine(line) {
      const tokens = line.trim().split(/\s+/);
      if (tokens.length === 0) return null;

      const typeTokens = [];
      let i = 0;
      while (i < tokens.length && !['feet', 'n/a'].includes(tokens[i]) && isNaN(tokens[i])) {
        typeTokens.push(tokens[i]);
        i++;
      }

      const type = typeTokens.join(' ');
      const value = tokens[i] || '';
      const unit = tokens[i + 1] || '';
      const stn = tokens[i + 2] || '';
      const dd = tokens[i + 3] || '';
      const time = tokens[i + 4] || '';

      return { type, value, unit, stn, dd, time };
    }

  function styleCloudDetail(rawText) {
    const rawString = String(rawText);
    const cloudStart = rawString.indexOf('Detail - CLD');
    const cloudBlock = rawString.slice(cloudStart);


    const lines = cloudBlock.split('\n').map(line => line.trim()).filter(line => line);

    const detailContainer = document.createElement('div');
    detailContainer.className = 'awos-detail-container';

    // Preserve header
    const headerLine = lines[0];
    const header = document.createElement('div');
    header.className = 'awos-detail-header';
    header.textContent = headerLine;
    detailContainer.appendChild(header);

    // Parse cloud data
    const cloudLines = lines.filter(line => /^CYTR/.test(line));
    const cloudTable = document.createElement('table');
    const cloudHead = cloudTable.createTHead();
    const cloudBody = cloudTable.createTBody();

    const cloudHeaderRow = ['Station', 'SP', 'Day', 'Time', 'Layer 1', 'Layer 2', 'Layer 3', 'Layer 4', 'Layer 5'];
    const headRow = cloudHead.insertRow();
    cloudHeaderRow.forEach(text => {
      const th = document.createElement('th');
      th.textContent = text;
      headRow.appendChild(th);
    });

    cloudLines.forEach(line => {
      const tokens = line.split(/\s+/);
      const station = tokens[0];
      const spFlag = tokens[1] === 'SP' ? 'SP' : '';
      const day = spFlag ? tokens[2] : tokens[1];
      const time = spFlag ? tokens[3] : tokens[2];
      const layers = tokens.slice(spFlag ? 4 : 3);
      while (layers.length < 5) layers.push('');
      const row = cloudBody.insertRow();
      [station, spFlag, day, time, ...layers].forEach(cell => {
        const td = row.insertCell();
        td.textContent = cell;
      });
    });

    detailContainer.appendChild(cloudTable);

    // Parse summary block
    const summaryStart = lines.findIndex(line => line.startsWith('Summary Type'));
    const summaryLines = lines.slice(summaryStart + 2).filter(line => line && !line.startsWith('Reset Detail'));

    const summaryTable = document.createElement('table');
    const summaryHead = summaryTable.createTHead();
    const summaryBody = summaryTable.createTBody();

    const summaryHeaderRow = ['Type', 'Value', 'Unit', 'Station', 'Day', 'Time'];
    const summaryHeadRow = summaryHead.insertRow();
    summaryHeaderRow.forEach(text => {
      const th = document.createElement('th');
      th.textContent = text;
      summaryHeadRow.appendChild(th);
    });

    summaryLines.forEach(line => {
      const tokens = line.split(/\s+/);
      if (tokens.length === 0) return;

      const typeTokens = [];
      let i = 0;
      while (i < tokens.length && !['feet', 'n/a'].includes(tokens[i]) && isNaN(tokens[i])) {
        typeTokens.push(tokens[i]);
        i++;
      }

      const type = typeTokens.join(' ');
      const value = tokens[i] || '';
      const unit = tokens[i + 1] || '';
      const stn = tokens[i + 2] || '';
      const dd = tokens[i + 3] || '';
      const time = tokens[i + 4] || '';

      const row = summaryBody.insertRow();
      [type, value, unit, stn, dd, time].forEach(cell => {
        const td = row.insertCell();
        td.textContent = cell;
      });
    });

    detailContainer.appendChild(summaryTable);
    floaterContent.innerHTML = '';
    floaterContent.appendChild(detailContainer);
  }


  function extractUpdatedTimestamp(rawHTML) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(rawHTML, 'text/html');
    const abbr = doc.querySelector('abbr.timepopup');
    return abbr ? `Updated: ${abbr.textContent.trim()}` : '';
  }

  function saveSnapshot(content) {
    try {
      localStorage.setItem(STORAGE_SNAPSHOT_KEY, content.innerHTML);
      console.log('Snapshot saved.');
    } catch (e) {
      console.error('Failed to save snapshot:', e);
    }
  }

  function restoreSnapshot() {
    const snapshot = localStorage.getItem(STORAGE_SNAPSHOT_KEY);
    const restoredTimestamp = localStorage.getItem(STORAGE_TIMESTAMP_KEY) || '';
    if (!snapshot) {
      console.warn('No floater snapshot found in localStorage. Skipping restore.');
      return;
    }

    window.requestAnimationFrame(() => {
      setTimeout(() => {
        console.log('Restoring floater from snapshot...');
        createPanel(restoredTimestamp);
        updateTitleBar(restoredTimestamp, true)
        const content = document.getElementById(CONTENT_ID);
        if (content) content.innerHTML = snapshot;
      }, 300);
    });
  }

  function loadDetail(url) {
    fetch(url)
      .then(res => res.text())
      .then(html => {
        const updatedText = extractUpdatedTimestamp(html);
        localStorage.setItem(STORAGE_TIMESTAMP_KEY, updatedText);

        createPanel(updatedText);
        updateTitleBar(updatedText, false)

        /*console.log(document.querySelector('#awos-detail-container'));
        console.log(document.querySelector('.awos-cloud-table'));
        console.log(document.querySelector('.awos-summary-table'));*/


        const stripped = stripDetailText(html);
        const content = document.getElementById(CONTENT_ID);

        if (content) {
          content.innerHTML = `<pre style="white-space: pre-wrap;">${stripped}</pre>`;
          styleCloudDetail(content);
          saveSnapshot(content);
        }
        localStorage.setItem(STORAGE_URL_KEY, url);
      });

  }

  function handleClick(e) {
    const link = e.target.closest('a');
    if (!link || !link.href.includes('/AWOS/?id=') || !link.href.includes('&detail=')) return;

    e.preventDefault();
    e.stopImmediatePropagation();

    loadDetail(link.href);
  }

  document.addEventListener('click', handleClick);
  restoreSnapshot();
  })();

