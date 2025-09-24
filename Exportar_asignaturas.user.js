// ==UserScript==
// @name         🧲Exportar asignaturas plan de estudios
// @namespace    https://github.com/lafuenteguillermooscar-hue
// @version      1.0.0
// @description  Exporta asignaturas por año/cuatrimestre/optativas del plan de estudios UNIR (UTF-8, ; separador) con filtro visual y opción para incluir todas las optativas (adaptado al nuevo HTML 2025).
// @match        https://www.unir.net/*/*/plan-de-estudios/*
// @grant        GM_setClipboard
// @homepageURL  https://github.com/lafuenteguillermooscar-hue/att-evirtual
// @supportURL   https://github.com/lafuenteguillermooscar-hue/att-evirtual/issues
// @downloadURL  https://raw.githubusercontent.com/lafuenteguillermooscar-hue/att-evirtual/main/Exportar_asignaturas.user.js
// @updateURL    https://raw.githubusercontent.com/lafuenteguillermooscar-hue/att-evirtual/main/Exportar_asignaturas.user.js
// ==/UserScript==

(function () {
    'use strict';

    const waitForContent = setInterval(() => {
        const container = document.querySelector('accordion__wrapper');
        if (container) {
            clearInterval(waitForContent);
            addExtractButton();
        }
    }, 500);

    function addExtractButton() {
        const btn = document.createElement('button');
        btn.innerText = '🧲 Extraer asignaturas';
        Object.assign(btn.style, {
            position: 'fixed',
            top: '10px',
            right: '10px',
            zIndex: 9999,
            padding: '10px',
            background: '#4CAF50',
            color: '#fff',
            border: 'none',
            borderRadius: '5px',
            cursor: 'pointer'
        });

        btn.addEventListener('click', showCuatriModal);
        document.body.appendChild(btn);
    }

    function showCuatriModal() {
        if (document.getElementById('cuatriModalExportar')) return;

        const modal = document.createElement('div');
        modal.id = 'cuatriModalExportar';
        Object.assign(modal.style, {
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100vw',
            height: '100vh',
            background: 'rgba(0,0,0,0.35)',
            zIndex: 10000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
        });

        const style = document.createElement('style');
        style.textContent = `
        #cuatriModalExportar label.optativas-label {
            font-size: 1.1em;
            color: #444;
            user-select: none;
            cursor: pointer;
            display: flex;
            align-items: center;
            gap: 8px;
            margin: 0 auto 20px auto;
            width: fit-content;
            justify-content: center;
        }
        #cuatriModalExportar input[type="checkbox"] {
            width: 22px;
            height: 22px;
            accent-color: #a48e3b;
            margin-right: 3px;
            cursor: pointer;
            appearance: auto !important;
        }
        `;
        document.head.appendChild(style);

        const content = document.createElement('div');
        Object.assign(content.style, {
            background: '#fff',
            borderRadius: '18px',
            boxShadow: '0 4px 32px rgba(0,0,0,0.17)',
            padding: '38px 38px 30px 38px',
            minWidth: '340px',
            textAlign: 'center'
        });
        content.innerHTML = `
            <div style="font-size: 1.4em; margin-bottom: 18px;">
                ¿Qué asignaturas deseas exportar?
            </div>
            <label class="optativas-label" for="optativasCheck">
                <input type="checkbox" id="optativasCheck">
                Incluir todas las <b>optativas</b>
            </label>
            <button id="btn1Q" style="margin:8px 0 0 0; font-size:1.09em; padding:12px 22px; border-radius:12px; background:#188e3a; color:#fff; border:none; cursor:pointer; width:80%;">Solo 1° Cuatrimestre</button><br>
            <button id="btn2Q" style="margin:14px 0 0 0; font-size:1.09em; padding:12px 22px; border-radius:12px; background:#0081be; color:#fff; border:none; cursor:pointer; width:80%;">Solo 2° Cuatrimestre</button><br>
            <button id="btnTodos" style="margin:18px 0 0 0; font-size:1.09em; padding:12px 22px; border-radius:12px; background:#a48e3b; color:#fff; border:none; cursor:pointer; width:80%;">Todas las asignaturas</button><br>
            <button id="btnCancelar" style="margin:30px 0 0 0; font-size:1em; padding:9px 26px; border-radius:10px; background:#bbb; color:#222; border:none; cursor:pointer; width:60%;">Cancelar</button>
        `;

        content.querySelector('#btn1Q').onclick = () => {
            const includeOptativas = content.querySelector('#optativasCheck').checked;
            modal.remove(); style.remove();
            extractSubjects('1', includeOptativas);
        };
        content.querySelector('#btn2Q').onclick = () => {
            const includeOptativas = content.querySelector('#optativasCheck').checked;
            modal.remove(); style.remove();
            extractSubjects('2', includeOptativas);
        };
        content.querySelector('#btnTodos').onclick = () => {
            modal.remove(); style.remove();
            extractSubjects('all', false);
        };
        content.querySelector('#btnCancelar').onclick = () => {
            modal.remove(); style.remove();
        };

        modal.appendChild(content);
        document.body.appendChild(modal);
    }

    function extractSubjects(cuatriOption, includeOptativas) {
        const panels = document.querySelectorAll('accordion__wrapper');
        const data = [];

        const optativas = [];
        const otros = [];

        panels.forEach(panel => {
            const heading = panel.querySelector('summary h3 span');
            const sectionTitle = heading?.innerText.trim().toLowerCase() || '';
            const yearMatch = sectionTitle.match(/(primer|segundo|tercer|cuarto) año/i);
            const year = yearMatch ? capitalize(yearMatch[1]) : '';
            const isOptativas = sectionTitle.includes('optativas');
            const isMencion = sectionTitle.includes('mención');

            const rows = panel.querySelectorAll('table tbody tr');
            rows.forEach(row => {
                const cols = row.querySelectorAll('td');
                if (cols.length >= 3) {
                    const cuatri = detectCuatrimestre(row.closest('article.tabs__pane'));

                    // 🔧 Extraer correctamente el nombre de la asignatura
                    let nombre = '';
                    const h4 = cols[0].querySelector('h4');
                    if (h4) {
                        const link = h4.querySelector('a') || h4.querySelector('span');
                        if (link) {
                            nombre = cleanText(link.textContent || '');
                        } else {
                            nombre = cleanText(h4.textContent || '');
                        }
                    } else {
                        nombre = cleanText(cols[0].textContent || '');
                    }

                    const asignatura = {
                        Año: year,
                        Cuatrimestre: cuatri,
                        Asignatura: nombre,
                        Tipo: cleanText(cols[1].textContent || ''),
                        ECTS: cleanText(cols[2].textContent || ''),
                        Categoría: isOptativas ? 'Optativa' : (isMencion ? 'Mención' : 'Troncal')
                    };
                    if (isOptativas) {
                        optativas.push(asignatura);
                    } else {
                        otros.push(asignatura);
                    }
                }
            });
        });

        if (cuatriOption === 'all') {
            data.push(...otros, ...optativas);
        } else {
            data.push(...otros.filter(asig =>
                (cuatriOption === '1' && asig.Cuatrimestre === '1° cuatrimestre') ||
                (cuatriOption === '2' && asig.Cuatrimestre === '2° cuatrimestre')
            ));
            if (includeOptativas) data.push(...optativas);
        }

        if (!data.length) {
            alert('No se encontraron asignaturas para exportar con ese filtro.');
            return;
        }
        const csv = convertToCSV(data);
        downloadCSV(csv, 'asignaturas_unir.csv');
        copyToClipboard(csv);
        alert(`📥 Exportadas ${data.length} asignaturas a CSV y copiadas al portapapeles.`);
    }

    function detectCuatrimestre(pane) {
        if (!pane) return '';
        const id = pane.getAttribute('id') || '';
        if (id.includes('tab-0')) return '1° cuatrimestre';
        if (id.includes('tab-1')) return '2° cuatrimestre';
        return '';
    }

    function convertToCSV(data) {
        if (!data.length) return '';
        const headers = Object.keys(data[0]);
        const rows = data.map(obj =>
            headers.map(h => `"${(obj[h] || '').replace(/"/g, '""')}"`).join(';')
        );
        return [headers.join(';'), ...rows].join('\r\n');
    }

    function downloadCSV(content, filename) {
        const BOM = '\uFEFF';
        const blob = new Blob([BOM + content], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        URL.revokeObjectURL(url);
        a.remove();
    }

    function copyToClipboard(text) {
        if (typeof GM_setClipboard === 'function') {
            GM_setClipboard(text);
        } else {
            navigator.clipboard.writeText(text).catch(err => {
                console.error('Fallo al copiar al portapapeles:', err);
            });
        }
    }

    function capitalize(str) {
        return str.charAt(0).toUpperCase() + str.slice(1);
    }

    function cleanText(text) {
        return text.replace(/\s+/g, ' ').trim();
    }
})();
