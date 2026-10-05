// ==UserScript==
// @name         CFWOS Layout Enhancer 4.0
// @version      4.0e(Dark mode update)
// @description  Restore and enhance AWOS report layout with full styling
// @author       Chris
// @match        https://met.forces.gc.ca/*
// @grant        none
// ==/UserScript==

(function () {
  'use strict';

  const DEBUG_MODE = false;
  let layoutApplied = false;

  function findAwosPanel() {
    return document.querySelector('#awos, #awos-panel, .awos-report, .report-panel, main');
  }
  function applyEnhancements(awosPanel) {
    const isDark = window.awosDarkMode;

    Object.assign(awosPanel.style, {
      backgroundColor: isDark ? '#1e1e1e' : '#f5f5dc',
      color: isDark ? '#e0e0e0' : '#222',
      padding: '24px',
      borderRadius: '10px',
      boxShadow: isDark ? '0 2px 12px rgba(0,0,0,0.5)' : '0 2px 12px rgba(0,0,0,0.15)',
      fontFamily: '"Segoe UI", sans-serif',
      lineHeight: '1.6',
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

  window.applyDarkModeStyles = applyDarkModeStyles;
  Logger.modules.whenReady(['core'], () => {
    Logger.modules.whenReady(['cleanup'], () => {
      if (layoutApplied) return; // <-- prevent double-run
      let attempts = 0;
      const maxAttempts = 20;
      const interval = 100;
      const tryEnhance = () => {
        if (layoutApplied) return; // <-- prevent re-entry mid-loop
        const awosPanel = findAwosPanel();
        if (awosPanel) {
          Logger.info('🎨 Running Layout Enhancer after Cleanup');
          applyEnhancements(awosPanel);
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
          applyDarkModeStyles(null, 'Initial Button State', initialSource);
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

