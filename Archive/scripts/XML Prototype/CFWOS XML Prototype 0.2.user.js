// ==UserScript==
// @name         CFWOS XML Prototype 0.2
// @namespace    cfwos
// @version      0.2
// @description  XML-first CFWOS prototype with normalized data model
// @match        https://met.forces.gc.ca/english/airops/AWOS/*
// @grant        none
// @run-at       document-idle
// ==/UserScript==

(async function () {
    'use strict';

    const BULLETIN_BASE = '/english/airops/Text/';
    const BULLETIN_MASK = 'XMCN64 CYTR';

    async function fetchLatestAwosXml() {
        const listUrl =
            `${BULLETIN_BASE}?mask=${encodeURIComponent(BULLETIN_MASK)}&count=15`;

        const listResponse = await fetch(listUrl);
        if (!listResponse.ok) {
            throw new Error(`Bulletin list returned HTTP ${listResponse.status}`);
        }

        const listHtml = await listResponse.text();
        const listDoc = new DOMParser().parseFromString(listHtml, 'text/html');

        const links = [...listDoc.querySelectorAll('li a[href^="?item="]')];

        if (!links.length) {
            throw new Error('No XMCN64 CYTR bulletin links found');
        }

        const latestHref = links[links.length - 1].getAttribute('href');
        const bulletinUrl = new URL(latestHref, location.origin + BULLETIN_BASE);

        const bulletinResponse = await fetch(bulletinUrl);
        if (!bulletinResponse.ok) {
            throw new Error(`Latest bulletin returned HTTP ${bulletinResponse.status}`);
        }

        const bulletinText = await bulletinResponse.text();

        const bulletinDoc = new DOMParser().parseFromString(
            bulletinText,
            'text/html'
        );

        const pageText = bulletinDoc.body.textContent;

        const xmlStart = pageText.indexOf('<?xml');

        if (xmlStart === -1) {
            throw new Error('Bulletin contained no AWOS XML');
        }

        const xmlEnd = pageText.indexOf('</awos>', xmlStart);

        if (xmlEnd === -1) {
            throw new Error('AWOS XML closing tag not found');
        }

        return pageText.slice(
            xmlStart,
            xmlEnd + '</awos>'.length
        ).trim();
    }

    function buildAwosModel(xmlText) {
        const xml = new DOMParser().parseFromString(
            xmlText,
            'application/xml'
        );

        const parseError = xml.querySelector('parsererror');

        if (parseError) {
            throw new Error('XML parser error');
        }

        const awosElement = xml.querySelector('awos');
        const stationElement = xml.querySelector('station');
        const airTempElement = xml.querySelector('airtemp');
        const temperatureElement = airTempElement?.querySelector('min1');
        const pressureElement = xml.querySelector('pressure');
        const altimeterElement = pressureElement.querySelector('altimeter');
        const qfeElement = pressureElement.querySelector('qfe');
        const qnhElement = pressureElement.querySelector('qnh');

        if (!awosElement) {
            throw new Error('No <awos> element found');
        }

        if (!stationElement) {
            throw new Error('No <station> element found');
        }

        if (!airTempElement) {
            throw new Error('No <airtemp> element found');
        }

        if (!temperatureElement) {
            throw new Error('No <airtemp><min1> value found');
        }
        if (!pressureElement) {
            throw new Error('No <pressure> element found');
        }

        if (!altimeterElement) {
            throw new Error('No <pressure><altimeter> value found');
        }

        if (!qfeElement) {
            throw new Error('No <pressure><qfe> value found');
        }

        if (!qnhElement) {
            throw new Error('No <pressure><qnh> value found');
        }

        return {
            report: {
                time: awosElement.querySelector('time')?.textContent.trim() || ''
            },

            station: {
                id: stationElement.getAttribute('id') || '',
                latitude: stationElement.getAttribute('lat') || '',
                longitude: stationElement.getAttribute('long') || ''
            },

            temperature: {
                current: {
                    value: temperatureElement.textContent.trim(),
                    units: airTempElement.getAttribute('units') || '',
                    time: temperatureElement.getAttribute('time') || ''
                }
            },

            pressure: {
                altimeter: {
                    value: altimeterElement.textContent.trim(),
                    units: altimeterElement.getAttribute('units') || '',
                    time: altimeterElement.getAttribute('time') || ''
                },

                station: {
                    value: qfeElement.textContent.trim(),
                    units: qfeElement.getAttribute('units') || '',
                    time: qfeElement.getAttribute('time') || ''
                },

                msl: {
                    value: qnhElement.textContent.trim(),
                    units: qnhElement.getAttribute('units') || '',
                    time: qnhElement.getAttribute('time') || ''
                }
            },
        };
    }

    function renderTest(awos) {
        const box = document.createElement('div');

        box.id = 'cfwos-xml-prototype';

        box.style.cssText = `
            position: fixed;
            top: 10px;
            right: 10px;
            z-index: 999999;
            background: #111;
            color: #fff;
            border: 2px solid #00ffff;
            padding: 12px 16px;
            font-family: monospace;
            font-size: 16px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.5);
        `;

        box.innerHTML = `
            <strong>CFWOS XML Prototype 0.2</strong><br>
            Report time: ${awos.report.time}<br>
            Station: ${awos.station.id}<br>
            Latitude: ${awos.station.latitude}<br>
            Longitude: ${awos.station.longitude}<br>
            Temperature: ${awos.temperature.current.value}
            °${awos.temperature.current.units}<br>
            Temperature time: ${awos.temperature.current.time}<br>
            Pressure Altimeter:
            ${awos.pressure.altimeter.value} ${awos.pressure.altimeter.units}<br>

            Station Pressure:
            ${awos.pressure.station.value} ${awos.pressure.station.units}<br>

            MSL Pressure:
            ${awos.pressure.msl.value} ${awos.pressure.msl.units}<br>
        `;

        document.body.appendChild(box);
    }

    try {
        console.log('[CFWOS XML] Fetching latest bulletin...');

        const xmlText = await fetchLatestAwosXml();

        console.log('[CFWOS XML] Raw XML retrieved');

        const awos = buildAwosModel(xmlText);

        console.log('[CFWOS XML] AWOS model:', awos);

        renderTest(awos);

    } catch (error) {
        console.error('[CFWOS XML] Prototype failed:', error);
    }
})();