// ==UserScript==
// @name         CFWOS AWOS Layout Enhancer 2.0
// @namespace    http://tampermonkey.net/
// @version      2.0
// @description  Restore and enhance AWOS report layout with full styling
// @author       Chris
// @match        https://met.forces.gc.ca/english/airops/*
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    const applyEnhancements = (awosPanel) => {
        if (!awosPanel) {
            console.warn("⚠️ AWOS panel not found");
            return;
        }

        console.log("🎯 Layout Enhancer running after Core cleanup");

        Object.assign(awosPanel.style, {
            backgroundColor: '#f5f5dc',
            color: '#222',
            padding: '24px',
            borderRadius: '10px',
            boxShadow: '0 2px 12px rgba(0,0,0,0.15)',
            fontFamily: '"Segoe UI", sans-serif',
            lineHeight: '1.6',
        });

        const headers = awosPanel.querySelectorAll('h1, h2, h3');
        headers.forEach(header => {
            header.style.color = '#333';
            header.style.borderBottom = '1px solid #ccc';
            header.style.paddingBottom = '6px';
            header.style.marginTop = '20px';
        });

        const tables = awosPanel.querySelectorAll('table');
        tables.forEach(table => {
            Object.assign(table.style, {
                backgroundColor: '#fff',
                color: '#000',
                borderCollapse: 'collapse',
                width: '100%',
                marginTop: '20px',
                border: '1px solid #ccc',
            });

            const cells = table.querySelectorAll('th, td');
            cells.forEach(cell => {
                Object.assign(cell.style, {
                    backgroundColor: '#fdf6e3',
                    color: '#333',
                    border: '1px solid #ccc',
                    padding: '8px',
                    textAlign: 'center',
                });
            });
        });

        const styleTag = document.createElement('style');
        styleTag.textContent = `
            @media (max-width: 768px) {
                #awos, .awos-report, .report-panel, main {
                    padding: 12px !important;
                }

                table {
                    font-size: 14px !important;
                }

                h1, h2, h3 {
                    font-size: 1.2em !important;
                }
            }
        `;
        document.head.appendChild(styleTag);
    };

    // 🕵️ Listen for Core script's cleanup completion
    window.addEventListener('AWOSCoreCleanupComplete', () => {
        const awosPanel = document.querySelector('#awos, .awos-report, .report-panel, main');
        applyEnhancements(awosPanel);
    });
})();



