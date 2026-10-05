// ==UserScript==
// @name         CFWOS AWOS Restorer
// @namespace    chris.awos
// @version      1.0
// @description  Restores missing AWOS time popups and report navigation buttons
// @match        https://met.forces.gc.ca/english/airops/AWOS/*
// @grant        none
// @run-at       document-end
// ==/UserScript==

const AWOSRestorer = (() => {
    const Logger = {
        log: (...args) => console.log('[AWOSRestorer]', ...args),
    };

    // 1️⃣ Recreate the missing popup function
    function restoreTimePopup() {
        if (typeof window.create_time_popup === 'function') {
            Logger.log('create_time_popup already defined. Skipping.');
            return;
        }

        window.create_time_popup = function (el) {
            const epoch = parseInt(el.dataset.epochvalue, 10);
            const offset = parseInt(el.dataset.tzoffset, 10) * 60; // minutes to seconds
            const localTime = new Date((epoch + offset) * 1000).toLocaleString();

            const tooltip = document.createElement('div');
            tooltip.textContent = `Local Time: ${localTime}`;
            tooltip.style.position = 'absolute';
            tooltip.style.background = '#222';
            tooltip.style.color = '#fff';
            tooltip.style.padding = '6px 10px';
            tooltip.style.borderRadius = '6px';
            tooltip.style.fontSize = '14px';
            tooltip.style.pointerEvents = 'none';
            tooltip.style.zIndex = '9999';

            document.body.appendChild(tooltip);

            const rect = el.getBoundingClientRect();
            tooltip.style.top = `${rect.bottom + window.scrollY + 8}px`;
            tooltip.style.left = `${rect.left + window.scrollX}px`;

            setTimeout(() => tooltip.remove(), 3000);
        };

        Logger.log('create_time_popup restored.');
    }

    // 2️⃣ Restore AWOS report buttons if missing
    function restoreReportButtons() {
        const container = document.querySelectorAll('.mwconditions_tdname')[1];
        if (!container) {
            Logger.log('Report button container not found.');
            return;
        }

        const hasButtons = container.querySelector('.center .menulink');
        if (hasButtons) {
            Logger.log('Report buttons already present. Skipping.');
            return;
        }

        const urlParams = new URLSearchParams(window.location.search);
        const id = urlParams.get('id') || 'CYTR';
        const atime = urlParams.get('atime') || '202508242100';

        const html = `
            <div class="center">
                <a class="menulink" href="?id=${id}&atime=${atime}" title="Previous Hour">
                    <span class="glyphicon glyphicon-backward"></span>
                </a>
                &nbsp;&nbsp;&nbsp;
                <a class="menulink" href="?id=${id}&atime=${atime}" title="Previous Report">
                    <span class="glyphicon glyphicon-chevron-left"></span>
                </a>
                &nbsp;&nbsp;&nbsp;
                <a class="menulink" href="javascript:;" onClick="return false;" title="Next Report">
                    <span class="glyphicon glyphicon-chevron-right" style="color:silver"></span>
                </a>
                &nbsp;&nbsp;&nbsp;
                <a class="menulink" href="javascript:;" onClick="return false;" title="Next Hour">
                    <span class="glyphicon glyphicon-forward" style="color:silver"></span>
                </a>
                &nbsp;&nbsp;&nbsp;
                <a class="menulink" href="javascript:;" onClick="return false;" title="Latest Report">
                    <span class="glyphicon glyphicon-fast-forward" style="color:silver"></span>
                </a>
            </div>
        `;

        container.insertAdjacentHTML('beforeend', html);
        Logger.log('Report buttons restored.');
    }

    // 3️⃣ Run both restorers
    function run() {
        Logger.log('Running AWOSRestorer...');
        restoreTimePopup();
        restoreReportButtons();
        Logger.log('AWOSRestorer complete.');
    }

    return { run };
})();

AWOSRestorer.run();
