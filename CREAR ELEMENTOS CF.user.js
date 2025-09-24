// ==UserScript==
// @name         CREAR ELEMENTOS CF EXAMEN FINAL Y PRACTICAS
// @namespace    https://github.com/lafuenteguillermooscar-hue
// @namespace    mf.tools
// @version      1.0.0
// @description  Panel liviano y compacto con 2 variantes (Examenes Finales / Prácticas). Editor dinámico de ítems, progreso, logs, toasts, persistencia por variante. Modo "anclado fuera" para ganar espacio visual. Sin escaneos pesados en segundo plano.
// @author       MF
// @match        https://calificaciones.lti.unir.net/*
// @grant        GM_addStyle
// @run-at       document-idle
// @license      MIT
// @homepageURL  https://github.com/lafuenteguillermooscar-hue/att-evirtual
// @supportURL   https://github.com/lafuenteguillermooscar-hue/att-evirtual/issues
// @downloadURL  https://raw.githubusercontent.com/lafuenteguillermooscar-hue/att-evirtual/main/CREAR ELEMENTOS CF.user.js
// @updateURL    https://raw.githubusercontent.com/lafuenteguillermooscar-hue/att-evirtual/main/CREAR ELEMENTOS CF.user.js
// ==/UserScript==
(function () {
  'use strict';

  /************* VARIANTES — SOLO ESTAS DOS *************/
  const VARIANTS = {
    'Examenes Finales': [
      { titulo: 'Examen Final Ordinaria', puntos: '10', tipoItem: 'Docuware', categoria: 'Examen Final', convocatoria: 'Ordinaria' },
      { titulo: 'Examen Final Extraordinaria', puntos: '10', tipoItem: 'Docuware', categoria: 'Examen Final', convocatoria: 'Extraordinaria' },
    ],
    'Prácticas': [
      { titulo: 'Memoria de Practicas Conv. Ordinaria', puntos: '10', tipoItem: 'Memoria de prácticas', categoria: 'Memoria Final', convocatoria: 'Ordinaria' },
      { titulo: 'Memoria de Practicas Conv. Extraordinaria', puntos: '10', tipoItem: 'Memoria de práctica', categoria: 'Memoria Final', convocatoria: 'Extraordinaria' },
      { titulo: 'Informe de Evaluacion Tutor Externo', puntos: '10', tipoItem: 'Informe de evaluación de prácticas', categoria: 'Informe del Tutor', convocatoria: 'Sin asignar' },
    ],
  };
  const DEFAULT_PRESET = 'Examenes Finales';

  /************* ACTIVACIÓN *************/
  const ACTIVATION = { ltiHost: 'calificaciones.lti.unir.net' };
  function isOnLTIHost(){ return location.host.includes(ACTIVATION.ltiHost); }

  /************* PRESET por URL (?cfef_preset=Nombre) o nombre del script [Perfil: Nombre] *************/
  function detectPresetName() {
    try {
      const urlp = new URLSearchParams(location.search).get('cfef_preset');
      if (urlp && VARIANTS[urlp]) return urlp;
    } catch {}
    try {
      const nm = (typeof GM_info !== 'undefined' && GM_info?.script?.name) ? String(GM_info.script.name) : '';
      const m = nm.match(/\[perfil:\s*([^\]]+)\]/i);
      if (m && VARIANTS[m[1]]) return m[1];
    } catch {}
    return DEFAULT_PRESET;
  }

  const presetName = detectPresetName();

  /************* PERSISTENCIA (por variante) *************/
  const BASE_LS_KEY = 'mf_cfef_ui_2variants_v24';
  const LS_KEY = `${BASE_LS_KEY}:${presetName}`;

  const DEFAULT_SETTINGS = {
    items: deepClone(VARIANTS[presetName]),
    preset: presetName,
    ui: { x: null, y: null, compact: false, outboard: true }, // por defecto más discreto y “fuera”
    theme: { grad1: '#22d3ee', grad2: '#4ade80' },
    behavior: { autoCompactOnRun: false, clickWaitMs: 550, reopenWaitMs: 350 },
  };
  const SETTINGS = loadSettings();

  /************* Utils *************/
  function deepClone(o){ try{ return structuredClone(o); }catch{ return JSON.parse(JSON.stringify(o)); } }
  function deepMerge(base, extra){
    for (const k of Object.keys(extra || {})){
      if (extra[k] && typeof extra[k]==='object' && !Array.isArray(extra[k])) {
        if (!base[k] || typeof base[k]!=='object') base[k] = {};
        deepMerge(base[k], extra[k]);
      } else { base[k] = extra[k]; }
    }
  }
  function loadSettings(){
    try {
      const raw = JSON.parse(localStorage.getItem(LS_KEY) || '{}');
      const merged = deepClone(DEFAULT_SETTINGS);
      deepMerge(merged, raw);
      // Asegura items válidos del preset actual
      if (!Array.isArray(merged.items) || !merged.items.length) merged.items = deepClone(VARIANTS[presetName]);
      merged.preset = presetName;
      return merged;
    } catch { return deepClone(DEFAULT_SETTINGS); }
  }
  function saveSettings(){ localStorage.setItem(LS_KEY, JSON.stringify(SETTINGS)); }

  /************* Estilos — compactos + “anclado fuera” *************/
  GM_addStyle(`
    :root {
      --mf-bg: rgba(17, 24, 39, .94);
      --mf-stroke: rgba(148, 163, 184, .22);
      --mf-fg: #e5e7eb;
      --mf-muted: #94a3b8;
      --mf-ok: #22c55e;
      --mf-warn: #f59e0b;
      --mf-err: #ef4444;
      --mf-grad1: ${SETTINGS.theme.grad1};
      --mf-grad2: ${SETTINGS.theme.grad2};
      --mf-shadow: 0 14px 36px rgba(2, 6, 23, .42), inset 0 1px 0 rgba(255,255,255,.06);
      --mf-width: 300px;            /* más chico */
      --mf-min-width: 220px;
      --mf-pad: 8px;                /* paddings contenidos */
      --mf-font: 12.5px;            /* tipografía más chica */
      --mf-edge-offset: -10px;      /* cuánto “asoma” al estar fuera */
      --mf-handle-w: 16px;          /* ancho de la pestaña visible en modo fuera */
    }
    @media (prefers-color-scheme: light) {
      :root { --mf-bg: rgba(255,255,255,.95); --mf-fg:#0f172a; --mf-muted:#334155; --mf-stroke: rgba(15, 23, 42, .12); --mf-shadow: 0 14px 36px rgba(15,23,42,.18), inset 0 1px 0 rgba(255,255,255,.9); }
    }

    #mf-cfef {
      position: fixed; z-index: 2147483646; right: 16px; bottom: 16px; width: var(--mf-width); min-width: var(--mf-min-width);
      backdrop-filter: blur(8px);
      background: var(--mf-bg); color: var(--mf-fg); border: 1px solid var(--mf-stroke); border-radius: 14px; box-shadow: var(--mf-shadow);
      font-family: system-ui, -apple-system, Segoe UI, Roboto, Ubuntu, "Helvetica Neue", Arial, "Noto Sans";
      overflow: hidden; user-select: none; font-size: var(--mf-font);
      transition: box-shadow .2s ease, transform .2s ease, width .2s ease, height .2s ease;
    }
    #mf-cfef.dragging { transform: scale(0.985); box-shadow: 0 10px 28px rgba(0,0,0,.25); }

    /* Modo fuera: el panel queda parcialmente fuera del viewport y aparece una pestaña/handle para abrirlo/cerrarlo */
    #mf-cfef.outboard { right: var(--mf-edge-offset); }
    #mf-cfef .handle {
      position: absolute; top: 50%; right: 100%; transform: translateY(-50%);
      width: var(--mf-handle-w); height: 72px; border-radius: 8px 0 0 8px;
      background: linear-gradient(135deg, var(--mf-grad1), var(--mf-grad2)); color:#0b1220;
      display:grid; place-items:center; font-weight:800; cursor:pointer; box-shadow: 0 6px 18px rgba(0,0,0,.22);
      user-select: none;
    }
    #mf-cfef .handle span { writing-mode: vertical-rl; transform: rotate(180deg); font-size: 10px; letter-spacing: .3px; }

    #mf-cfef.min { width: var(--mf-min-width); }
    #mf-cfef.min .log, #mf-cfef.min .pg, #mf-cfef.min .settings { display: none !important; }

    #mf-cfef .hdr {
      display: flex; align-items: center; gap: 8px; padding: var(--mf-pad) calc(var(--mf-pad) + 2px); cursor: move;
      background: linear-gradient(180deg, rgba(255,255,255,.06), rgba(0,0,0,.03));
      border-bottom: 1px solid var(--mf-stroke);
    }
    #mf-cfef .logo {
      width: 18px; height: 18px; display: grid; place-items:center; border-radius: 8px;
      background: radial-gradient(circle at 30% 30%, rgba(255,255,255,.35), transparent 60%),
                  linear-gradient(135deg, var(--mf-grad1), var(--mf-grad2));
      color: #0b1220; font-weight: 800; font-size: 12px;
    }
    #mf-cfef .title { font-weight: 800; font-size: 12.5px; letter-spacing: .2px; line-height: 1.1; }
    #mf-cfef .sub { font-size: 10.5px; color: var(--mf-muted); margin-top: 1px; }

    #mf-cfef .hdr-actions { margin-left: auto; display: flex; align-items: center; gap: 6px; }
    #mf-cfef .chip {
      font-size: 10.5px; padding: 2px 6px; border-radius: 999px; border: 1px solid var(--mf-stroke);
      background: rgba(255,255,255,.05);
    }
    #mf-cfef .iconbtn {
      display:inline-flex; align-items:center; justify-content:center; width:24px; height:24px;
      border-radius:8px; border:1px solid var(--mf-stroke); background:rgba(255,255,255,.03);
      cursor:pointer; transition: transform .08s ease, background .15s; font-size: 12px;
    }
    #mf-cfef .iconbtn:hover { background: rgba(255,255,255,.10); transform: translateY(-1px); }
    #mf-cfef .iconbtn:active{ transform: translateY(0); }

    #mf-cfef .body { padding: var(--mf-pad); display:flex; flex-direction:column; gap:6px; }
    #mf-cfef .controls { display: flex; gap: 6px; align-items:center; flex-wrap: wrap; }
    #mf-cfef button.primary {
      cursor: pointer; border-radius: 10px; border: 0; color: #0b1220; font-weight: 800;
      padding: 8px 10px; font-size: 12px;
      background: linear-gradient(135deg, var(--mf-grad1), var(--mf-grad2));
      box-shadow: 0 10px 24px rgba(34,211,238,.22);
      transition: transform .08s ease, filter .15s;
    }
    #mf-cfef button.primary:hover { filter: brightness(1.05); transform: translateY(-1px); }
    #mf-cfef button.primary:active{ transform: translateY(0); }

    #mf-cfef button.secondary {
      cursor: pointer; border-radius: 8px; border: 1px solid var(--mf-stroke);
      background: rgba(255,255,255,.06); color: inherit; padding: 6px 8px; font-size: 12px;
      transition: transform .08s ease, background .15s;
    }
    #mf-cfef button.secondary:hover { background: rgba(255,255,255,.10); }
    #mf-cfef button.secondary:active{ transform: translateY(1px); }

    #mf-cfef .pg { height: 8px; background: rgba(255,255,255,.08); border-radius: 999px; overflow: hidden; border: 1px solid var(--mf-stroke); }
    #mf-cfef .bar { height: 100%; width: 0%; background: linear-gradient(90deg, var(--mf-grad1), var(--mf-grad2)); transition: width .35s ease; }

    #mf-cfef .log { max-height: 200px; overflow: auto; padding: 4px 0 0; font-size: 12px; line-height: 1.4; }
    #mf-cfef .log p { margin: 0 0 4px; padding: 0 6px; }
    #mf-cfef .ok   { color: var(--mf-ok); }
    #mf-cfef .warn { color: var(--mf-warn); }
    #mf-cfef .err  { color: var(--mf-err); }
    #mf-cfef .muted{ color: var(--mf-muted); }

    #mf-cfef .settings { display:none; gap:8px; border-top:1px solid var(--mf-stroke); padding: var(--mf-pad); }
    #mf-cfef .settings.show{ display:grid; grid-template-columns: 1fr; }
    #mf-cfef .field { display:flex; flex-direction:column; gap:4px; }
    #mf-cfef .field label { font-size:11px; color: var(--mf-muted); }
    #mf-cfef .input, #mf-cfef .select {
      width:100%; border-radius:8px; padding:6px 8px; color:var(--mf-fg); background:rgba(255,255,255,.05); border:1px solid var(--mf-stroke); outline:none; font-size: 12px;
    }
    #mf-cfef .row { display:flex; gap:6px; align-items:center; flex-wrap:wrap; }
    #mf-cfef .mini-badge { font-size: 10.5px; padding: 2px 6px; border-radius: 999px; border: 1px solid var(--mf-stroke); background: rgba(255,255,255,.05); }

    /* Editor dinámico de ítems (compacto) */
    #items-rows .head, #items-rows .row { display:grid; grid-template-columns: 1.4fr .5fr .8fr .9fr .9fr 26px; gap:6px; align-items:center; }
    #items-rows .head { font-size: 11px; opacity:.8; }
    #items-rows .del { width:26px; height:26px; border-radius:7px; border:1px solid var(--mf-stroke); background:rgba(255,255,255,.04); cursor:pointer; }
    #items-rows .del:hover{ background: rgba(255,255,255,.1); }
    #add-item { margin-top: 4px; }

    /* Toast */
    #mf-toast {
      position: fixed; z-index: 2147483647; left: 50%; bottom: 22px; transform: translateX(-50%) translateY(6px);
      background: rgba(30,41,59,.97); color:#fff; padding: 8px 12px; border-radius: 10px;
      border: 1px solid rgba(255,255,255,.10); box-shadow: 0 10px 22px rgba(0,0,0,.35);
      font: 12px/1.35 system-ui,-apple-system,Segoe UI,Roboto,Ubuntu; opacity: 0; transition: opacity .2s, transform .2s;
      display:flex; gap:8px; align-items:center; pointer-events:none;
    }
    #mf-toast.show { opacity: 1; transform: translateX(-50%) translateY(0); }
    #mf-toast.error { background: rgba(127,29,29,.95); }
    #mf-toast .ico { width:14px; height:14px; }
  `);

  /************* Helpers ligeros *************/
  const normalize = (s) => (s ?? '').toString().normalize('NFD').replace(/\p{Diacritic}/gu, '').replace(/\s+/g, ' ').trim().toLowerCase();
  const isVisible = (elem) => {
    if (!elem || !(elem instanceof Element)) return false;
    const cs = getComputedStyle(elem);
    if (cs.visibility === 'hidden' || cs.display === 'none' || cs.opacity === '0') return false;
    const r = elem.getBoundingClientRect(); return r.width > 0 && r.height > 0;
  };
  async function sleep(ms){ return new Promise(r=>setTimeout(r, ms)); }
  function escapeAttr(s){ return String(s??'').replaceAll('"','&quot;'); }
  function clampInt(v, min, max, dflt){ const n = parseInt(v,10); if (Number.isFinite(n)) return Math.max(min, Math.min(max, n)); return dflt; }
  function saneItem(i){
    return {
      titulo: String(i.titulo||'').trim() || 'Sin título',
      puntos: String(i.puntos||'').trim() || '10',
      tipoItem: String(i.tipoItem||'').trim() || 'Docuware',
      categoria: String(i.categoria||'').trim() || 'Examen Final',
      convocatoria: String(i.convocatoria||'').trim() || 'Ordinaria',
    };
  }

  // Búsqueda de controles (solo durante el flujo)
  function docsToScan() {
    const list = [document];
    document.querySelectorAll('iframe').forEach(ifr => { try { if (ifr.contentDocument) list.push(ifr.contentDocument); } catch {} });
    return list;
  }
  function allClickables(root = document) {
    return Array.from(root.querySelectorAll(`button, a, [role="button"], input[type="button"], input[type="submit"], .btn, .button`)).filter(isVisible);
  }
  function matchText(el, rx) {
    const t = normalize(el.innerText || el.textContent || el.value || '');
    return rx.test(t);
  }
  function findByText(rx, root = document) {
    const pool = allClickables(root);
    let cand = pool.find(el => matchText(el, rx));
    if (cand) return cand;
    cand = pool.find(el => rx.test(normalize(el.getAttribute('aria-label') || el.getAttribute('title') || '')));
    if (cand) return cand;
    const containers = Array.from(root.querySelectorAll('*')).filter(isVisible);
    cand = containers.find(el => matchText(el, rx) && (el.closest('button,a,[role="button"],.btn,.button') || el));
    return cand ? (cand.closest('button,a,[role="button"],.btn,.button') || cand) : null;
  }
  function waitFor(fn, timeoutMs = 10000, intervalMs = 150) {
    return new Promise((resolve, reject) => {
      const t0 = performance.now();
      const timer = setInterval(() => {
        let res; try { res = fn(); } catch(e) {}
        if (res) { clearInterval(timer); resolve(res); return; }
        if (performance.now() - t0 > timeoutMs) { clearInterval(timer); reject(new Error('timeout')); }
      }, intervalMs);
    });
  }
  async function clickEl(el, waitAfterMs){ el.scrollIntoView({ behavior: 'smooth', block: 'center' }); await sleep(150); el.click(); await sleep(waitAfterMs); }
  async function clickByText(rx, timeoutMs, waitAfterMs) {
    const dlist = docsToScan();
    let found = null; const t0 = performance.now();
    while (!found && performance.now() - t0 < timeoutMs) {
      for (const d of dlist) { found = findByText(rx, d); if (found) break; }
      if (!found) await sleep(120);
    }
    if (!found) throw new Error('timeout');
    await clickEl(found, waitAfterMs); return true;
  }
  function firstVisible(root, selector) {
    return Array.from(root.querySelectorAll(selector)).find(isVisible) || null;
  }
  function setInputValue(input, value) {
    input.focus(); input.value = value;
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
    return true;
  }
  function selectByVisibleText(select, wantedText) {
    const want = normalize(wantedText); let hit = false;
    for (const opt of select.options) { const t = normalize(opt.textContent || ''); if (t === want) { opt.selected = true; hit = true; break; } }
    if (!hit) { for (const opt of select.options) { const t = normalize(opt.textContent || ''); if (t.includes(want)) { opt.selected = true; hit = true; break; } } }
    if (hit) { select.dispatchEvent(new Event('input', { bubbles: true })); select.dispatchEvent(new Event('change', { bubbles: true })); }
    return hit;
  }
  function findControlByLabel(root, labelRegex, prefer = 'input|textarea|select') {
    const labels = Array.from(root.querySelectorAll('label')).filter(isVisible);
    const label = labels.find(l => labelRegex.test(normalize(l.innerText || '')));
    if (label) {
      const forId = label.getAttribute('for');
      if (forId) { const byFor = root.querySelector('#' + CSS.escape(forId)); if (byFor && isVisible(byFor)) return byFor; }
      const cont = label.closest('div, li, fieldset, .form-group, .fitem') || label.parentElement;
      if (cont) { const ctrl = firstVisible(cont, prefer.split('|').join(',')); if (ctrl) return ctrl; }
    }
    const cand = Array.from(root.querySelectorAll('input, textarea, select')).filter(isVisible);
    const rx = labelRegex;
    return cand.find(c => rx.test(normalize(c.getAttribute('name') || '')) || rx.test(normalize(c.id || ''))) || null;
  }

  /************* Abrir “Añadir → Ítem de calificación” *************/
  const RX_ADD_ITEM_DIRECT = /(anad(ir|e)|agreg(ar|a)|add|nuevo)\s*(.*)?(item|ítem|elemento)s?\s*(de)?\s*calificaci(?:o|on|ón)/i;
  const RX_ADD_BUTTON = /(anadir|añadir|agregar|add|\+|\+\s*agregar|\+\s*anadir|\+\s*añadir)/i;
  const RX_GRADE_ITEM_OPT = /(item|ítem|elemento)s?\s*(de)?\s*calificaci(?:o|on|ón)|grade\s*item/i;

  async function openAddGradeItem() {
    const clickWait = SETTINGS.behavior.clickWaitMs, reopenWait = SETTINGS.behavior.reopenWaitMs;
    try {
      log('[open-add] Buscando opción directa…','muted');
      await clickByText(RX_ADD_ITEM_DIRECT, 4500, clickWait + 120);
      log('[open-add] Clic directo OK.','ok');
      return true;
    } catch {}

    log('[open-add] Abriendo menú “Añadir/Agregar/＋”…','muted');
    await clickByText(RX_ADD_BUTTON, 6000, reopenWait).catch(()=>{});
    await sleep(reopenWait);

    try {
      log('[open-add] Buscando “Ítem/Elemento de calificación”…','muted');
      await clickByText(RX_GRADE_ITEM_OPT, 6000, clickWait + 120);
      log('[open-add] Opción del menú OK.','ok');
      return true;
    } catch {
      const roots = docsToScan();
      for (const d of roots) {
        const maybe = Array.from(d.querySelectorAll('a,button')).find(el => {
          const t = normalize(el.title || el.getAttribute('aria-label') || '');
          return /(anadir|añadir|agregar|add).*calificaci/.test(t);
        });
        if (maybe) { await clickEl(maybe, clickWait + 120); log('[open-add] Heurística title/aria OK.','ok'); return true; }
      }
      throw new Error('timeout');
    }
  }

  /************* Form y guardado *************/
  function findAddForm() {
    const roots = docsToScan();
    const allForms = roots.flatMap(r => Array.from(r.querySelectorAll('form'))).filter(isVisible);
    const scoreForm = (f) => {
      let s = 0; const txt = normalize(f.innerText || '');
      if (/anad(?!\b).*elemento.*calificaci|añad(?!\b).*elemento.*calificaci|agreg(?!\b).*elemento.*calificaci/.test(txt)) s += 3;
      if (/titulo/i.test(txt)) s += 1; if (/valor.*puntos/i.test(txt)) s += 1; if (/tipo.*(item|ítem)/i.test(txt)) s += 1;
      if (/categoria/i.test(txt)) s += 1; if (/convocatoria/i.test(txt)) s += 1;
      return s;
    };
    allForms.sort((a,b)=>scoreForm(b)-scoreForm(a));
    return allForms[0] || null;
  }

  async function fillFormOnce(payload) {
    const form = await waitFor(() => findAddForm(), 10000).catch(() => null);
    if (!form) throw new Error('No encontré el formulario de “Añadir elemento de calificación”.');

    const tituloCtrl = findControlByLabel(form, /titulo/i, 'input|textarea');
    if (!tituloCtrl) throw new Error('No encontré el campo “Título”.');
    setInputValue(tituloCtrl, payload.titulo);

    const puntosCtrl = findControlByLabel(form, /valor.*puntos/i, 'input');
    if (!puntosCtrl) throw new Error('No encontré el campo “Valor en puntos”.');
    setInputValue(puntosCtrl, payload.puntos);

    const tipoCtrl = findControlByLabel(form, /tipo.*(item|ítem)/i, 'select');
    if (!tipoCtrl || !selectByVisibleText(tipoCtrl, payload.tipoItem)) { throw new Error('No pude seleccionar “Tipo de ítem”.'); }

    const catCtrl = findControlByLabel(form, /categoria/i, 'select');
    if (!catCtrl || !selectByVisibleText(catCtrl, payload.categoria)) { throw new Error('No pude seleccionar “Categoría”.'); }

    const convCtrl = findControlByLabel(form, /convocatoria/i, 'select');
    if (!convCtrl || !selectByVisibleText(convCtrl, payload.convocatoria)) { throw new Error('No pude seleccionar “Convocatoria”.'); }

    const btnGuardar =
      findByText(/(guardar cambios|guardar|crear|aceptar|save|submit)/i, form) ||
      findByText(/(guardar cambios|guardar|crear|aceptar|save|submit)/i, document) ||
      firstVisible(form, 'button[type="submit"], input[type="submit"]');
    if (!btnGuardar) throw new Error('No encontré botón de “Guardar/Crear/Aceptar”.');

    await clickEl(btnGuardar, SETTINGS.behavior.clickWaitMs + 120);

    const formRef = form;
    await waitFor(() => !document.contains(formRef) || !isVisible(formRef), 12000).catch(() => {});
    await sleep(SETTINGS.behavior.reopenWaitMs);
  }

  /************* Panel + toasts *************/
  let panel, logBox, bar, btnStart, btnStop, btnMin, btnGear, btnPin, settingsBox, selPreset, itemsRows;
  let running = false;

  function svg(name, w=16, h=16){
    if (name==='gear') return `<svg viewBox="0 0 24 24" width="${w}" height="${h}" fill="none"><path d="M12 8.5a3.5 3.5 0 1 1 0 7 3.5 3.5 0 0 1 0-7Zm8.5 3 1.2 2.1-1.5 2.6-2.4-.3a7.8 7.8 0 0 1-1.4 1.4l.3 2.4-2.6 1.5-2.1-1.2-2.1 1.2-2.6-1.5.3-2.4a7.8 7.8 0 0 1-1.4-1.4l-2.4.3-1.5-2.6L3.5 11.5 2.3 9.4l1.5-2.6 2.4.3c.4-.5.9-1 1.4-1.4l-.3-2.4L10.3.8l2.1 1.2 2.1-1.2 2.6 1.5-.3 2.4c.5.4 1 .9 1.4 1.4l2.4-.3 1.5 2.6-1.2 2.1Z" stroke="currentColor" stroke-opacity=".9"/></svg>`;
    if (name==='min') return `<svg viewBox="0 0 24 24" width="${w}" height="${h}" fill="none"><path d="M5 12h14" stroke="currentColor" stroke-width="2"/></svg>`;
    if (name==='pin') return `<svg viewBox="0 0 24 24" width="${w}" height="${h}" fill="none"><path d="M14 3l7 7-3 3-7-7M3 21l6-6" stroke="currentColor" stroke-width="2"/></svg>`;
    if (name==='run') return `<svg viewBox="0 0 24 24" width="${w}" height="${h}" fill="currentColor"><path d="M8 5l10 7-10 7V5z"/></svg>`;
    if (name==='plus') return `<svg viewBox="0 0 24 24" width="${w}" height="${h}" fill="none"><path d="M12 5v14M5 12h14" stroke="currentColor" stroke-width="2"/></svg>`;
    if (name==='trash')return `<svg viewBox="0 0 24 24" width="${w}" height="${h}" fill="none"><path d="M6 7h12m-9 0v12m6-12v12M5 7l1 14h12l1-14M9 7V5h6v2" stroke="currentColor" stroke-width="2"/></svg>`;
    if (name==='check')return `<svg viewBox="0 0 24 24" width="${w}" height="${h}" fill="none"><path d="M20 6 9 17l-5-5" stroke="currentColor" stroke-width="2"/></svg>`;
    if (name==='warn') return `<svg viewBox="0 0 24 24" width="${w}" height="${h}" fill="none"><path d="M12 2l10 20H2L12 2Zm0 14v2m0-8v4" stroke="currentColor" stroke-width="2"/></svg>`;
    return '';
  }

  function createPanel() {
    if (panel && document.body.contains(panel)) return;

    panel = document.createElement('div');
    panel.id = 'mf-cfef';
    panel.innerHTML = `
      <div class="handle" title="Mostrar/Ocultar panel"><span>CF</span></div>
      <div class="hdr" id="mf-drag">
        <div class="logo">✓</div>
        <div>
          <div class="title">CF → Examen Final</div>
          <div class="sub">Variante: <b id="mf-preset-name">${escapeAttr(SETTINGS.preset)}</b></div>
        </div>
        <div class="hdr-actions">
          <span class="chip" id="mf-status">Listo</span>
          <button class="iconbtn" id="mf-pin" title="Anclar fuera / dentro">${svg('pin')}</button>
          <button class="iconbtn" id="mf-gear" title="Ajustes">${svg('gear')}</button>
          <button class="iconbtn" id="mf-min" title="Compactar/Expandir">${svg('min')}</button>
        </div>
      </div>
      <div class="body">
        <div class="controls">
          <button class="primary" id="mf-start" title="Crear ítems de la variante">${svg('run',16,16)}&nbsp;Iniciar</button>
          <button class="secondary" id="mf-stop">Detener</button>
          <span class="mini-badge">Contexto: LTI</span>
        </div>
        <div class="pg"><div class="bar" id="mf-bar"></div></div>
        <div class="log" id="mf-log"></div>
      </div>

      <div class="settings" id="mf-settings">
        <div class="field">
          <label>Variante</label>
          <div class="row">
            <select class="select" id="set-preset"></select>
            <button class="secondary" id="mf-loadpreset">Cargar</button>
          </div>
          <small class="muted">También podés fijarla por URL (?cfef_preset=Nombre) o en el nombre del script con [Perfil: Nombre].</small>
        </div>

        <div class="field">
          <label>Ítems de la variante (podés editar / añadir / borrar)</label>
          <div class="row head">
            <div><b>Título</b></div><div><b>Pts</b></div><div><b>Tipo</b></div><div><b>Categoría</b></div><div><b>Convoc.</b></div><div></div>
          </div>
          <div id="items-rows"></div>
          <button class="secondary" id="add-item">${svg('plus',14,14)}&nbsp;Añadir ítem</button>
          <div class="row" style="justify-content:flex-end;margin-top:4px;">
            <button class="primary" id="mf-saveitems">${svg('check')}&nbsp;Guardar ítems</button>
            <button class="secondary" id="mf-revert">${svg('warn')}&nbsp;Restaurar de la variante</button>
          </div>
        </div>

        <div class="row">
          <div class="field" style="flex:1;">
            <label>Colores de acento</label>
            <div class="row">
              <input type="color" class="input" id="set-grad1" value="${SETTINGS.theme.grad1}" style="max-width:110px;">
              <input type="color" class="input" id="set-grad2" value="${SETTINGS.theme.grad2}" style="max-width:110px;">
            </div>
          </div>
          <div class="field" style="flex:2;">
            <label>Comportamiento</label>
            <div class="row">
              <label><input type="checkbox" id="set-autoc" ${SETTINGS.behavior.autoCompactOnRun?'checked':''}> Compactar al iniciar</label>
              <label>Espera click (ms) <input type="number" min="200" max="2000" step="50" class="input" id="set-clickwait" value="${SETTINGS.behavior.clickWaitMs}" style="max-width:110px;"></label>
            </div>
          </div>
        </div>

        <div class="row" style="justify-content:flex-end;">
          <button class="primary" id="mf-savecfg">${svg('check')}&nbsp;Guardar ajustes</button>
          <button class="secondary" id="mf-resetcfg">${svg('warn')}&nbsp;Restablecer</button>
        </div>
      </div>
    `;
    document.documentElement.appendChild(panel);

    // refs
    logBox = panel.querySelector('#mf-log');
    bar = panel.querySelector('#mf-bar');
    btnStart = panel.querySelector('#mf-start');
    btnStop = panel.querySelector('#mf-stop');
    btnMin = panel.querySelector('#mf-min');
    btnGear = panel.querySelector('#mf-gear');
    btnPin = panel.querySelector('#mf-pin');
    settingsBox = panel.querySelector('#mf-settings');
    selPreset = panel.querySelector('#set-preset');
    itemsRows = panel.querySelector('#items-rows');

    // Presets en selector (solo 2)
    Object.keys(VARIANTS).forEach(name=>{
      const opt=document.createElement('option'); opt.value=name; opt.textContent=name;
      if (name === SETTINGS.preset) opt.selected = true;
      selPreset.appendChild(opt);
    });

    // Posición persistente + modo anclado fuera
    if (SETTINGS.ui.x!=null && SETTINGS.ui.y!=null) {
      panel.style.left = SETTINGS.ui.x+'px';
      panel.style.top = SETTINGS.ui.y+'px';
      panel.style.right = 'auto';
      panel.style.bottom = 'auto';
    }
    panel.classList.toggle('min', !!SETTINGS.ui.compact);
    panel.classList.toggle('outboard', !!SETTINGS.ui.outboard);

    // Handle para mostrar/ocultar “fuera”
    const handle = panel.querySelector('.handle');
    handle.addEventListener('click', ()=>{
      // si está fuera, traerlo adentro temporalmente
      const out = panel.classList.contains('outboard');
      panel.classList.toggle('outboard', !out);
      SETTINGS.ui.outboard = !out; saveSettings();
    });

    // Drag
    const drag = panel.querySelector('#mf-drag');
    let offX=0, offY=0, dragging=false;
    drag.addEventListener('mousedown', (e) => {
      dragging=true; panel.classList.add('dragging');
      const r = panel.getBoundingClientRect();
      offX = e.clientX - r.left; offY = e.clientY - r.top;
      e.preventDefault();
    });
    document.addEventListener('mousemove', (e) => {
      if (!dragging) return;
      const x = Math.max(8, Math.min(window.innerWidth - panel.offsetWidth - 8, e.clientX - offX));
      const y = Math.max(8, Math.min(window.innerHeight - panel.offsetHeight - 8, e.clientY - offY));
      panel.style.left = x+'px'; panel.style.top = y+'px';
      panel.style.right = 'auto'; panel.style.bottom = 'auto';
    }, { passive:true });
    document.addEventListener('mouseup', () => {
      if (dragging){
        dragging=false; panel.classList.remove('dragging');
        const r = panel.getBoundingClientRect();
        SETTINGS.ui.x = r.left; SETTINGS.ui.y = r.top; saveSettings();
      }
    });

    // Acciones UI
    btnStart.addEventListener('click', () => {
      if (SETTINGS.behavior.autoCompactOnRun) toggleCompact(true);
      if (!running) runFlow().catch(e=>{ log(String(e.message||e),'err'); setStatus('Error','err'); toast('Hubo un error. Revisá los logs.', 'error'); });
    });
    btnStop.addEventListener('click', () => { running = false; setStatus('Pausado'); log('Detenido por el usuario.', 'warn'); toast('Proceso detenido.'); });
    btnMin.addEventListener('click', () => toggleCompact());
    btnGear.addEventListener('click', () => settingsBox.classList.toggle('show'));
    btnPin.addEventListener('click', () => { panel.classList.toggle('outboard'); SETTINGS.ui.outboard = panel.classList.contains('outboard'); saveSettings(); });

    // Guardar ítems
    panel.querySelector('#mf-saveitems').addEventListener('click', ()=>{
      SETTINGS.items = readItemsFields().map(saneItem);
      SETTINGS.preset = selPreset.value;
      panel.querySelector('#mf-preset-name').textContent = SETTINGS.preset;
      saveSettings();
      toast('Ítems guardados'); log('Ítems guardados.', 'ok');
    });

    // Restaurar ítems desde la variante base
    panel.querySelector('#mf-revert').addEventListener('click', ()=>{
      const chosen = selPreset.value;
      const base = VARIANTS[chosen] ? deepClone(VARIANTS[chosen]) : deepClone(VARIANTS[DEFAULT_PRESET]);
      renderItemsEditor(base);
      toast('Campos restaurados desde la variante base');
    });

    // Añadir ítem
    panel.querySelector('#add-item').addEventListener('click', ()=>{
      const arr = readItemsFields();
      arr.push({ titulo:'', puntos:'', tipoItem:'', categoria:'', convocatoria:'' });
      renderItemsEditor(arr);
    });

    // Cargar otra variante (sin guardar aún)
    panel.querySelector('#mf-loadpreset').addEventListener('click', ()=>{
      const chosen = selPreset.value;
      const base = VARIANTS[chosen] ? deepClone(VARIANTS[chosen]) : deepClone(VARIANTS[DEFAULT_PRESET]);
      renderItemsEditor(base);
      panel.querySelector('#mf-preset-name').textContent = chosen;
      toast(`Variante cargada: ${chosen}`);
    });

    // Ajustes generales
    const el = (id)=>panel.querySelector(id);
    el('#mf-savecfg').addEventListener('click', ()=>{
      SETTINGS.theme.grad1 = el('#set-grad1').value || SETTINGS.theme.grad1;
      SETTINGS.theme.grad2 = el('#set-grad2').value || SETTINGS.theme.grad2;
      document.documentElement.style.setProperty('--mf-grad1', SETTINGS.theme.grad1);
      document.documentElement.style.setProperty('--mf-grad2', SETTINGS.theme.grad2);

      SETTINGS.behavior.autoCompactOnRun = el('#set-autoc').checked;
      SETTINGS.behavior.clickWaitMs = clampInt(el('#set-clickwait').value, 200, 2000, SETTINGS.behavior.clickWaitMs);
      saveSettings();
      toast('Ajustes guardados'); log('Ajustes guardados.', 'ok');
    });

    el('#mf-resetcfg').addEventListener('click', ()=>{
      const chosen = selPreset.value;
      const reset = {
        items: deepClone(VARIANTS[chosen]),
        preset: chosen,
        ui: { x: null, y: null, compact: false, outboard: true },
        theme: { grad1: '#22d3ee', grad2: '#4ade80' },
        behavior: { autoCompactOnRun: false, clickWaitMs: 550, reopenWaitMs: 350 },
      };
      Object.keys(SETTINGS).forEach(k=>delete SETTINGS[k]);
      deepMerge(SETTINGS, reset);
      saveSettings();
      renderItemsEditor(SETTINGS.items);
      el('#set-grad1').value = SETTINGS.theme.grad1;
      el('#set-grad2').value = SETTINGS.theme.grad2;
      document.documentElement.style.setProperty('--mf-grad1', SETTINGS.theme.grad1);
      document.documentElement.style.setProperty('--mf-grad2', SETTINGS.theme.grad2);
      el('#set-autoc').checked = SETTINGS.behavior.autoCompactOnRun;
      el('#set-clickwait').value = SETTINGS.behavior.clickWaitMs;
      panel.classList.toggle('min', !!SETTINGS.ui.compact);
      panel.classList.toggle('outboard', !!SETTINGS.ui.outboard);
      toast('Ajustes restablecidos'); log('Ajustes restablecidos.', 'warn');
    });

    // Inicializa editor con SETTINGS actuales
    renderItemsEditor(SETTINGS.items);

    // Mensaje inicial
    setStatus('Listo','neutral');
    log(`Variante activa: ${SETTINGS.preset}. Podés pulsar “Iniciar”.`, 'ok');
  }

  function renderItemsEditor(items){
    itemsRows.innerHTML = '';
    (items||[]).forEach((it, idx)=>{
      const row = document.createElement('div'); row.className = 'row';
      row.innerHTML = `
        <input class="input t"  placeholder="Título"      value="${escapeAttr(it.titulo||'')}">
        <input class="input p"  placeholder="Pts"         value="${escapeAttr(it.puntos||'')}">
        <input class="input ti" placeholder="Tipo ítem"   value="${escapeAttr(it.tipoItem||'')}">
        <input class="input c"  placeholder="Categoría"   value="${escapeAttr(it.categoria||'')}">
        <input class="input v"  placeholder="Convocatoria"value="${escapeAttr(it.convocatoria||'')}">
        <button class="del" title="Eliminar">${svg('trash',14,14)}</button>
      `;
      row.querySelector('.del').addEventListener('click', ()=>{
        const arr = readItemsFields().filter((_,i)=>i!==idx);
        renderItemsEditor(arr);
      });
      itemsRows.appendChild(row);
    });
  }
  function readItemsFields(){
    const rows = Array.from(itemsRows.querySelectorAll('.row'));
    return rows.map(r=>({
      titulo: r.querySelector('.t')?.value ?? '',
      puntos: r.querySelector('.p')?.value ?? '',
      tipoItem: r.querySelector('.ti')?.value ?? '',
      categoria: r.querySelector('.c')?.value ?? '',
      convocatoria: r.querySelector('.v')?.value ?? '',
    }));
  }

  function setProgressDone(){ if (bar) bar.style.width = '100%'; }
  function setProgress(i, total) {
    const pct = Math.max(0, Math.min(100, Math.round((i/total)*100)));
    if (bar) bar.style.width = pct + '%';
  }
  function log(msg, cls = '') {
    if (!logBox) return;
    const p = document.createElement('p');
    p.className = cls;
    p.textContent = msg;
    logBox.appendChild(p);
    logBox.scrollTop = logBox.scrollHeight;
  }
  function setStatus(text, kind='neutral') {
    const chip = panel?.querySelector('#mf-status');
    if (!chip) return;
    chip.textContent = text;
    chip.style.borderColor = 'var(--mf-stroke)';
    if (kind==='ok') chip.style.color = 'var(--mf-ok)';
    if (kind==='warn') chip.style.color = 'var(--mf-warn)';
    if (kind==='err') chip.style.color = 'var(--mf-err)';
    if (kind==='neutral') chip.style.color = 'var(--mf-muted)';
  }
  function toggleCompact(force){
    const will = typeof force==='boolean' ? force : !panel.classList.contains('min');
    panel.classList.toggle('min', will);
    SETTINGS.ui.compact = will; saveSettings();
  }

  // Toasts
  let toastEl;
  function toast(msg, type='info'){
    if (!toastEl){
      toastEl = document.createElement('div');
      toastEl.id = 'mf-toast';
      toastEl.innerHTML = `<svg class="ico" viewBox="0 0 24 24" fill="none"><path d="M12 2l10 20H2L12 2Zm0 14v2m0-8v4" stroke="white" stroke-width="1.6"/></svg><span class="t"></span>`;
      document.body.appendChild(toastEl);
    }
    toastEl.className = type==='error' || type==='err' ? 'error' : '';
    toastEl.querySelector('.t').textContent = msg;
    toastEl.classList.add('show');
    clearTimeout(toastEl._t);
    toastEl._t = setTimeout(()=>toastEl.classList.remove('show'), 2800);
  }

  /************* Activación *************/
  if (isOnLTIHost()) {
    if (document.readyState === 'complete' || document.readyState === 'interactive') {
      createPanel();
    } else {
      window.addEventListener('DOMContentLoaded', createPanel, { once:true });
    }
  }

  /************* Flujo principal *************/
  async function runFlow() {
    running = true;
    setStatus('En ejecución…','ok');
    const ITEMS = (readItemsFields().length ? readItemsFields() : SETTINGS.items).map(saneItem);
    const totalSteps = 2 + ITEMS.length * 2;
    let prog = 0; setProgress(prog, totalSteps);
    log(`— Iniciando (variante: ${SETTINGS.preset})…`, 'muted');

    try {
      await openAddGradeItem();
      prog++; setProgress(prog, totalSteps);
    } catch (e) {
      log('[open-add] no encontrado: timeout', 'err');
      setStatus('Fallo al abrir “Añadir”','err'); toast('No pude abrir “Añadir”.', 'error');
      running = false; return;
    }

    for (let idx=0; idx<ITEMS.length; idx++){
      if (!running) break;
      const payload = ITEMS[idx];
      log(`— Rellenando: ${payload.titulo}`, 'muted');

      await fillFormOnce(payload).then(()=>{
        log(`✓ Creado: ${payload.titulo}`, 'ok');
        setStatus('Ítem creado','ok');
        toast(`Creado: ${payload.titulo}`);
      }).catch(err=>{
        log(`✗ Error creando ${payload.titulo}: ${err.message||err}`, 'err');
        setStatus('Error al crear','err');
        toast(`Error en: ${payload.titulo}`, 'error');
      });

      if (idx < ITEMS.length-1) {
        try { await openAddGradeItem(); }
        catch(e) { log('No pude reabrir “Añadir…”.', 'err'); break; }
      }
      prog += 2; setProgress(prog, totalSteps);
      await sleep(SETTINGS.behavior.reopenWaitMs + 250);
    }

    running = false;
    setProgressDone();
    setStatus('Listo','neutral');
    log('— Secuencia finalizada.', 'muted');
    if (SETTINGS.ui.compact) toast('Finalizado.');
  }

  // Aplicar acentos al vuelo
  document.documentElement.style.setProperty('--mf-grad1', SETTINGS.theme.grad1);
  document.documentElement.style.setProperty('--mf-grad2', SETTINGS.theme.grad2);
})();
