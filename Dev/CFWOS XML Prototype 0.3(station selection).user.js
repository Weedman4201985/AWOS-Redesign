// ==UserScript==
// @name         CFWOS XML Prototype 0.3
// @namespace    cfwos
// @version      0.3
// @description  XML-first CFWOS prototype with station selection
// @match        https://met.forces.gc.ca/english/airops/AWOS/*
// @grant        none
// @run-at       document-idle
// ==/UserScript==

(async function () {
    'use strict';

    const BULLETIN_BASE = '/english/airops/Text/';

    function getCurrentStationId() {
        const params = new URLSearchParams(window.location.search);
        const stationId = params.get('id');

        if (!stationId) {
            throw new Error('No station ID found in page URL');
        }

        return stationId.toUpperCase();
    }

    function getStationMetadataFromPage() {
        const stationBlock =
            document.querySelector('.mwconditions_temperature');

        if (!stationBlock) {
            return {
                id: null,
                latitude: null,
                longitude: null,
                elevationFeet: null,
                elevationMetres: null
            };
        }

        const text = stationBlock.textContent
            .replace(/\s+/g, ' ')
            .trim();

        const stationIdMatch = text.match(/^([A-Z]{4})\b/);

        const latitudeMatch = text.match(
            /(\d{1,2})'(\d{2})'(\d{2})([NS])/i
        );

        const longitudeMatch = text.match(
            /(\d{1,3})'(\d{2})'(\d{2})([EW])/i
        );

        const elevationFeetMatch =
            text.match(/(\d+(?:\.\d+)?)ft/i);

        const elevationMetresMatch =
            text.match(/(\d+(?:\.\d+)?)m/i);

        const latitude = latitudeMatch
            ? latitudeMatch[0]
            : null;

        const longitude = longitudeMatch
            ? longitudeMatch[0]
            : null;

        return {
            id: stationIdMatch
                ? stationIdMatch[1]
                : null,

            latitude,
            longitude,

            elevationFeet: elevationFeetMatch
                ? elevationFeetMatch[1]
                : null,

            elevationMetres: elevationMetresMatch
                ? elevationMetresMatch[1]
                : null
        };
    }

    async function fetchLatestAwosXml() {
        const stationId = getCurrentStationId();
        const bulletinMask = `XMCN64 ${stationId}`;

        console.log('[CFWOS XML] Current station:', stationId);

        const listUrl =
            `${BULLETIN_BASE}?mask=${encodeURIComponent(bulletinMask)}&count=15`;

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
        const skyElement = xml.querySelector('sky');
        const pageMetadata = getStationMetadataFromPage();

        console.log('[CFWOS XML] Parsed page metadata:', pageMetadata);

        const xmlStationId = stationElement?.getAttribute('id')?.toUpperCase() || null;

        const pageStationId = pageMetadata.id?.toUpperCase() || null;

        if (!awosElement) {
            throw new Error('No <awos> element found');
        }

        console.log(
            `[CFWOS XML] Station verification: page=${pageStationId}, XML=${xmlStationId}`
        );

        if (
            pageStationId &&
            xmlStationId &&
            pageStationId !== xmlStationId
        ) {
            throw new Error(
                `Station mismatch: page=${pageStationId}, XML=${xmlStationId}`
            );
        }

        return {

            report: {
                time: awosElement.querySelector('time')?.textContent.trim() || ''
            },

            station: {
                id: pageStationId,

                latitude: pageMetadata.latitude,
                longitude: pageMetadata.longitude,

                elevation: {
                    feet: pageMetadata.elevationFeet,
                    metres: pageMetadata.elevationMetres
                }
            },

            temperature: {
                current: temperatureElement ? {
                    value: temperatureElement.textContent.trim(),
                    units: airTempElement.getAttribute('units') || '',
                    time: temperatureElement.getAttribute('time') || ''
                } : null
            },

            pressure: {
                altimeter: altimeterElement ? {
                    value: altimeterElement.textContent.trim(),
                    units: altimeterElement.getAttribute('units') || '',
                    time: altimeterElement.getAttribute('time') || ''
                } : null,

                station: qfeElement ? {
                    value: qfeElement.textContent.trim(),
                    units: qfeElement.getAttribute('units') || '',
                    time: qfeElement.getAttribute('time') || ''
                } : null,

                qnh: qnhElement ? {
                    value: qnhElement.textContent.trim(),
                    units: qnhElement.getAttribute('units') || '',
                    time: qnhElement.getAttribute('time') || ''
                } : null
            },

            sky: {
                condition: skyElement
                  ? skyElement.textContent.trim()
                  : null
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
            Temperature time: ${awos.temperature.current.time ?? 'N/A'}<br>
            Station: ${awos.station.id ?? "N/A"}<br>
            Latitude: ${awos.station.latitude ?? "N/A"}<br>
            Longitude: ${awos.station.longitude ?? "N/A"}<br>
            Elevation: ${awos.station.elevation.feet} ft / ${awos.station.elevation.metres} m<br>

            Temperature:
            ${awos.temperature.current
                ? `${awos.temperature.current.value} °${awos.temperature.current.units}`
                : 'N/A'} <br>

            Pressure Altimeter:
            ${awos.pressure.altimeter
                ? `${awos.pressure.altimeter.value} ${awos.pressure.altimeter.units}`
                : 'N/A'} <br>

            Station Pressure:
            ${awos.pressure.station
                ? `${awos.pressure.station.value} ${awos.pressure.station.units}`
                : 'N/A'} <br>

            QNH:
            ${awos.pressure.qnh
                ? `${awos.pressure.qnh.value} ${awos.pressure.qnh.units}`
                : 'N/A'} <br>

            Sky Condition:
            ${awos.sky.condition ?? "N/A"}<br>
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