![AWOS Scripts Logo](logo.png)

# 🛰️ AWOS Scripts / CFWOS

A browser-side enhancement suite for the Canadian Forces AWOS (Automated Weather Observing System) interface.

CFWOS is built as a set of **vanilla JavaScript userscripts**. The scripts are injected into the existing AWOS webpage by a compatible userscript manager, where they clean up the legacy interface, rebuild the presentation layer, add persistent tools and floating panels, and expose additional diagnostic functionality.

The scripts **do not replace or modify the AWOS source application on the server**. They operate locally in the browser against the page that has already been loaded.

Because the project is browser-injected JavaScript rather than a native desktop application, it is designed to be **cross-browser and cross-OS**. There are no Windows-, Linux-, or macOS-specific runtime components in the active userscript stack.

> **Recommended userscript manager:** Violentmonkey.  
> Other compatible userscript managers may also work, depending on browser support.

---

## ✨ What CFWOS Does

The current CFWOS stack turns the legacy AWOS webpage into a much more usable operational interface while preserving the underlying AWOS data and backend services.

Current capabilities include:

- Legacy page cleanup and removal of unnecessary government/WET interface chrome
- Rebuilt AWOS layout and top control bar
- Light, dark, and automatic day/night themes
- Station-aware automatic theme switching using station coordinates and calculated sunrise/sunset
- Manual theme override controls
- Auto-refresh control with visible countdown
- Station selection tools
- Floating report, detail, selector, and debug panels
- Dragging and resizing of floating panels
- Persistent panel position, size, and state through `localStorage`
- Historical/report viewing tools
- Custom handling of AWOS detail links
- Custom hover-time tooltips
- Shared logging, module readiness, and performance instrumentation
- Browser-side cleanup of legacy WET, jQuery UI, and Dojo behavior that interferes with the redesigned interface
- Experimental direct access to the raw AWOS XML bulletin stream

---

## 📦 Current Script Set

### ✅ Main CFWOS Stack

| Script | Current Role |
|---|---|
| **CFWOS AWOS Core 8.4** | Startup, shared logger/module system, early browser patches, common helpers, tooltip interception, and main-page/report-viewer context detection. |
| **CFWOS Cleanup Suite 4** | Removes legacy page chrome and unused elements, suppresses unwanted WET/jQuery/Dojo behavior, and prepares the page for the custom layout. |
| **CFWOS Layout Enhancer 4.2** | Owns the redesigned AWOS presentation layer, top bar, theme system, auto-refresh UI, station controls, and button injection. |
| **CFWOS Floating Panel 6.1** | Provides reusable draggable/resizable floating panels for reports, station selection, debug information, and AWOS detail views. |

### 🧪 Experimental / Research

| Script | Purpose |
|---|---|
| **CFWOS XML Prototype 0.3 (station selection)** | Experimental XML-first data path. Fetches the latest station-specific `XMCN64` bulletin, extracts embedded AWOS XML, builds a normalized JavaScript model, verifies station identity, and renders a diagnostic test view. |

The XML prototype is **not required for the normal CFWOS interface**. It exists as a working proof that the authenticated AWOS page can directly consume the raw AWOS bulletin stream without needing a separate Node, Flask, or Python backend.

---

## 🧱 Current Architecture

The main scripts are deliberately separated by responsibility:

```text
Official AWOS page
       │
       ▼
CFWOS AWOS Core
  ├─ Logger / module readiness
  ├─ Early browser patches
  ├─ Shared helpers
  └─ Main-page vs embedded-view detection
       │
       ▼
CFWOS Cleanup Suite
  ├─ Remove legacy page chrome
  ├─ Suppress unwanted legacy plugins
  └─ Prepare the DOM for the redesign
       │
       ▼
CFWOS Layout Enhancer
  ├─ Rebuild layout
  ├─ Create top control bar
  ├─ Light / Dark / Auto theme logic
  ├─ Auto-refresh controls
  └─ Launch buttons for CFWOS tools
       │
       ▼
CFWOS Floating Panel
  ├─ Report Viewer
  ├─ Station Selector
  ├─ Debug Panel
  └─ Detail Viewer
```

The scripts communicate through a small set of shared browser globals and the Core module-readiness system.

### Recommended load order

1. `CFWOS AWOS Core`
2. `CFWOS Cleanup Suite`
3. `CFWOS Layout Enhancer`
4. `CFWOS Floating Panel`

The XML prototype should be treated separately while it remains experimental.

---

## 🧠 Script Details

### CFWOS AWOS Core 8.4

Core has been reduced to the functionality that belongs in the system foundation rather than carrying UI and cleanup responsibilities.

Its current responsibilities include:

- Creating the shared `Logger`
- Module registration and dependency readiness
- Performance timing and diagnostic collection
- Early document-start patches
- AWOS refresh-cookie override
- Dummy favicon injection
- XHR request logging
- Shared floating-panel key generation
- Custom AWOS hover-time handling
- Detecting whether the script is running in the main AWOS page or inside an embedded report viewer

Core registers itself as ready after `DOMContentLoaded`, allowing dependent scripts to continue in a controlled order.

---

### CFWOS Cleanup Suite 4

Cleanup runs after Core and focuses entirely on removing or suppressing legacy webpage behavior that is no longer wanted.

Current cleanup work includes:

- Removing government/WET header and footer elements
- Removing skip links and empty legacy containers
- Watching briefly for footer elements that reappear and removing them again
- Evaluating hidden/empty legacy elements
- Suppressing selected WET plugin initialization
- Preventing unwanted jQuery UI dialog and datepicker initialization
- Cleaning unused Dojo/Dijit widgets where possible
- Applying small compatibility fixes to legacy styles
- Removing unused hidden overlays
- Waiting for the AWOS DOM to settle before performing the main cleanup pass

Once complete, Cleanup registers the `cleanup` module so Layout can begin.

---

### CFWOS Layout Enhancer 4.2

Layout Enhancer owns the visible CFWOS interface.

It currently provides:

- The custom two-row AWOS top bar
- AWOS title placement
- Theme-aware button styling
- Light and dark presentation
- Manual Night/Light switching
- Automatic day/night mode
- Station-coordinate parsing from the current AWOS page
- Sunrise/sunset calculation
- Current AWOS UTC-time detection
- Mode status indicator
- Auto-refresh toggle and countdown
- Cross-window refresh state broadcasting
- New Stations button
- Report Viewer button
- Debug button
- Floating-panel reset button
- Full AWOS layout/restyling pass

Theme state and user preferences are persisted through browser `localStorage`.

---

### CFWOS Floating Panel 6.1

Floating Panel provides the reusable window system used by the interactive CFWOS tools.

Current capabilities include:

- Draggable floating panels
- Edge and corner resizing
- Screen-boundary clamping
- Persistent panel size and position
- Persistent snapshots using `localStorage`
- Close/reset behavior
- AWOS Station Selector panel
- Report Viewer
- Historical report state restoration
- Report navigation controls
- Debug panel
- AWOS detail viewer
- Interception of AWOS detail links so detail content opens in the custom panel
- Cloud-detail styling
- Restoration of open panels after page reload

The Layout Enhancer supplies the launch buttons; Floating Panel supplies the actual tools behind them.

---

## 🌙 Theme System

CFWOS supports several presentation states:

- **Default** — original/light site behavior
- **Light** — manually forced light mode
- **Dark** — manually forced dark mode
- **Auto** — determines light or dark mode using the selected station and calculated sunrise/sunset

The current station coordinates and elevation are read from the AWOS page. CFWOS then determines the effective theme using AWOS UTC time and the calculated solar transition times.

Manual switching can override the automatic state while preserving the user's previous mode preference.

---

## 🔄 Auto Refresh

The Layout Enhancer provides its own refresh control rather than relying on the legacy page refresh behavior.

The control includes:

- ON/OFF state
- Visible countdown
- Persistent preference
- Immediate reload when auto-refresh is re-enabled
- `BroadcastChannel` synchronization between related browser contexts

The current refresh interval is **60 seconds**.

---

## 🪟 Persistent UI State

CFWOS uses browser `localStorage` for interface state rather than external files or platform-specific storage.

Persisted values include items such as:

- Theme mode and automatic theme preference
- Auto-refresh preference
- Floating-panel positions
- Floating-panel sizes
- Panel snapshots
- Report-viewer state
- Debug-panel state
- Station-selector state

This is one of the reasons the project remains portable across operating systems.

---

## 🧪 XML-First Prototype

The XML prototype explores a future data path that bypasses the legacy presentation DOM for live weather values.

The current prototype:

1. Reads the current station ID from the AWOS URL.
2. Builds the appropriate `XMCN64 <station>` bulletin mask.
3. Fetches the station bulletin list from the authenticated AWOS site.
4. Selects the latest bulletin.
5. Extracts the embedded `<awos>` XML.
6. Parses the XML with `DOMParser`.
7. Verifies that the XML station matches the page station.
8. Builds a JavaScript AWOS model.
9. Renders a small diagnostic test panel.

The current model includes:

- Report time
- Station identity
- Station coordinates/elevation metadata
- 1-minute air temperature
- Altimeter
- Station pressure / QFE
- Raw QNH field
- Sky condition

This work is intentionally kept separate from the main CFWOS stack while the data model is still being researched and validated.

---

## 🌐 Browser and OS Compatibility

CFWOS is written in vanilla browser JavaScript and runs through a userscript manager.

The active scripts do not depend on:

- Node.js
- Python
- Flask
- PowerShell
- Native executables
- OS-specific filesystem paths
- Compiled libraries

That makes the same userscript approach portable across **Windows, Linux, and macOS**, provided the browser and userscript manager support the web APIs used by the scripts.

The main project is developed around modern Firefox/Chromium-class browsers.

---

## 🛠️ Installation

### Recommended method

1. Install a compatible userscript manager such as **Violentmonkey**.
2. Import the current CFWOS userscript files.
3. Enable the four main scripts.
4. Keep them in the recommended order:
   1. Core
   2. Cleanup
   3. Layout Enhancer
   4. Floating Panel
5. Open the AWOS page normally.

The main CFWOS scripts support both the operational HTTPS AWOS path and the localhost AWOS development path used during development.

### XML prototype

Install/enable the XML prototype separately only when testing the XML-first data work.

---

## 🧰 Development Philosophy

CFWOS is being actively simplified rather than expanded for its own sake.

The current cleanup/rebuild work follows a few practical rules:

- One component, one job
- Understand behavior before changing it
- Remove code that performs work with no useful effect
- Preserve working behavior while responsibilities are separated
- Make one change, test it, then continue
- Prefer browser-native functionality over unnecessary dependencies

The project has evolved from a collection of layered browser fixes into a more deliberate modular system, while remaining compatible with the existing AWOS site.

---

## 📁 Repository Notes

Older versions of CFWOS used separate logger scripts and earlier generations of Core, Layout Enhancer, Cleanup Suite, and Floating Panel.

Those versions are now historical references only. The current working stack is the set documented above.

During active development, a file name may temporarily lag behind the version declared inside its userscript metadata. The `@name` / `@version` block in the script should be treated as the authoritative development version.

---

## 📌 License

MIT License — use, modify, and share in accordance with the license terms.

---

## 🙋‍♂️ Author

Created and maintained by **Chris**.

Issues, testing notes, and improvements can be tracked through the repository.
