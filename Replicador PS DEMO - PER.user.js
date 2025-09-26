// ==UserScript==
// @name         Replicador Programación Semanal DEMO → PER (UNIR) v2.5
// @namespace    https://github.com/lafuenteguillermooscar-hue
// @version      1.0.0
// @description  Replica DEMO→PER con auto-captura de Ajax, normalización de textos, delay de 1s entre ítems y 10s antes del commit final. HUD arriba a la derecha.
// @match        https://ps.lti.unir.net/*
// @run-at       document-idle
// @grant        none
// @license      MIT
// @homepageURL  https://github.com/lafuenteguillermooscar-hue/att-evirtual
// @supportURL   https://github.com/lafuenteguillermooscar-hue/att-evirtual/issues
// @downloadURL  https://raw.githubusercontent.com/lafuenteguillermooscar-hue/att-evirtual/main/asignar-ec.user.js
// @updateURL    https://raw.githubusercontent.com/lafuenteguillermooscar-hue/att-evirtual/main/asignar-ec.user.js
// ==/UserScript==

(function () {
  'use strict';

  const STORAGE_MAP   = 'weeklyAgendaMap';
  const STORAGE_LEARN = 'weeklyAgendaLearned';
  const HUD_ID        = 'ua-hud-replicador';

  const POST_DELAY_MS     = 1000;   // 1s entre ítems
  const RETRIES           = 2;
  const RETRY_BACKOFF_MS  = 600;
  const FINAL_COMMIT_FORM = true;
  const FINAL_COMMIT_DELAY= 10000;  // 10s antes de commit

  const sleep = (ms) => new Promise(r => setTimeout(r, ms));
  const qs  = (sel, root=document) => root.querySelector(sel);
  const qsa = (sel, root=document) => Array.from(root.querySelectorAll(sel));

  const getTextFromLi = (li) => {
    const s = li.querySelector('.item');
    return ((s ? s.innerText : li.innerText) || '').replace(/\s+/g,' ').trim();
  };

  function normalizeText(txt) {
    return (txt || '')
      .replace(/p:\d+(\.\d+)?/gi, '') // quita "p:x" o "p:x.y"
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase();
  }

  const weekFromTrId = (id) => {
    const m = String(id).match(/row-week-(\d+)/);
    return m ? Number(m[1]) : null;
  };

  /* ---------------- HUD ---------------- */
  function createHUD(){
    if (qs('#'+HUD_ID)) return;
    const hud = document.createElement('div');
    hud.id = HUD_ID;
    hud.innerHTML = `
      <style>
        #${HUD_ID}{
          position:fixed; right:16px; top:16px;
          z-index:999999; width:420px; max-height:70vh;
          display:flex; flex-direction:column;
          background:linear-gradient(135deg,#202533,#2d3248);
          color:#f0f0f0; border-radius:14px;
          box-shadow:0 8px 28px rgba(0,0,0,.5);
          font:13px/1.4 system-ui,Arial; overflow:hidden;
        }
        #${HUD_ID}.min{height:40px;width:260px;}
        #${HUD_ID} .head{
          display:flex;align-items:center;gap:6px;
          padding:8px 10px;background:#282c3f;
          font-weight:600;font-size:13px;letter-spacing:.3px;
        }
        #${HUD_ID} .grow{flex:1}
        #${HUD_ID} .btn{
          background:#4a4f70;color:#fff;border:0;border-radius:8px;
          padding:5px 8px;cursor:pointer;font-size:12px;
          transition:all .2s;
        }
        #${HUD_ID} .btn:hover{background:#676e99;transform:translateY(-1px);}
        #${HUD_ID} .body{padding:8px 10px;overflow:auto;flex:1}
        #${HUD_ID} .row{display:flex;align-items:center;gap:8px;margin:4px 0;flex-wrap:wrap;}
        #${HUD_ID} .badge{padding:3px 8px;border-radius:999px;font-size:11px;background:#555}
        #${HUD_ID} .okb{background:#2e7d32}
        #${HUD_ID} .warnb{background:#f39c12;color:#000}
        #${HUD_ID} .progress-wrap{background:#333;height:10px;border-radius:99px;overflow:hidden;margin:8px 0 6px;}
        #${HUD_ID} .progress{height:100%;width:0%;background:linear-gradient(90deg,#4cafef,#9c27b0);background-size:200% 100%;animation:ua-stripes 2s linear infinite;transition:width .35s ease;}
        @keyframes ua-stripes{0%{background-position:0 0}100%{background-position:200% 0}}
        #${HUD_ID} .counter{text-align:right;font-size:12px;margin-bottom:6px;opacity:.85;}
        #${HUD_ID} .list{display:flex;flex-direction:column;gap:4px;}
        #${HUD_ID} .log{padding:4px 6px;border-radius:8px;font-size:12px;}
        #${HUD_ID} .ok{background:#2e7d32;color:#fff;}
        #${HUD_ID} .warn{background:#f9a825;color:#000;}
        #${HUD_ID} .err{background:#c62828;color:#fff;}
      </style>
      <div class="head">
        Replicador Programación
        <div class="grow"></div>
        <button class="btn" data-action="export">Export</button>
        <button class="btn" data-action="simulate">Simular</button>
        <button class="btn" data-action="import">Import</button>
        <button class="btn" data-action="clear">Clear</button>
        <button class="btn" data-action="toggle">—</button>
      </div>
      <div class="body">
        <div class="row">
          <span>Plantilla Ajax:</span>
          <span class="badge" id="ua-learn-status">no cargada</span>
        </div>
        <div class="progress-wrap"><div class="progress"></div></div>
        <div class="counter">0 / 0</div>
        <div class="list"></div>
      </div>
    `;
    document.body.appendChild(hud);

    const setLearnBadge = () => {
      const b = qs('#ua-learn-status');
      const L = loadLearned();
      b.textContent = L ? 'aprendida ✓' : 'no cargada';
      b.className = 'badge ' + (L ? 'okb' : 'warnb');
    };
    setLearnBadge();

    qs(`[data-action="toggle"]`, hud).onclick = () => hud.classList.toggle('min');
    qs(`[data-action="export"]`, hud).onclick = () => exportFromDemo();
    qs(`[data-action="simulate"]`, hud).onclick = () => simulatePER();
    qs(`[data-action="import"]`, hud).onclick = () => importToPER();
    qs(`[data-action="clear"]`, hud).onclick = () => {
      localStorage.removeItem(STORAGE_MAP);
      localStorage.removeItem(STORAGE_LEARN);
      setLearnBadge();
      logLine('Mapa y plantilla borrados', 'warn');
    };
  }
  const setProgress=(d,t)=>{ qs(`#${HUD_ID} .progress`).style.width = `${t?Math.round((d/t)*100):0}%`; qs(`#${HUD_ID} .counter`).textContent = `${d} / ${t}`; };
  const logLine=(m,k='ok')=>{ console.log('[Replicador]',m); const list=qs(`#${HUD_ID} .list`); if(!list)return; const div=document.createElement('div'); div.className=`log ${k}`; div.textContent=m; list.prepend(div); };

  /* --------- Export DEMO --------- */
  function exportFromDemo(){
    const rows = qsa('tr[id^="row-week-"]');
    let map = {}, count=0;
    rows.forEach(tr=>{
      const week = weekFromTrId(tr.id);
      const tds = qsa('td.celdassemana', tr);
      tds.forEach((td, colIndex)=>{
        const ul = qs('ul.assigmentList', td);
        if (!ul) return;
        qsa('li', ul).forEach(li=>{
          const raw  = getTextFromLi(li);
          const norm = normalizeText(raw);
          if (!norm) return;
          const type = (li.id.split('|')[1] || '');
          map[norm] = { week, colIndex, type };
          count++;
        });
      });
    });
    localStorage.setItem(STORAGE_MAP, JSON.stringify(map));
    logLine(`Exportadas ${count} asignaciones desde DEMO.`, 'ok');
    return count;
  }

  /* --------- Simular en PER --------- */
  function simulatePER(){
    const map = loadMap();
    if (!map) return logLine('No hay mapa guardado', 'err');

    const colNames = getColumnNames();
    qsa('.wai-unassigned .unassigneditem li').forEach(li=>{
      const raw  = getTextFromLi(li);
      const norm = normalizeText(raw);
      const info = map[norm];
      if (!info) { logLine(`Sin destino para "${raw}"`, 'warn'); return; }
      const { week, colIndex } = info;
      const tr = qs(`tr#row-week-${week}`);
      const td = tr ? qsa('td.celdassemana', tr)[colIndex] : null;
      const colName = colNames[colIndex] || `Columna ${colIndex}`;
      if (td) { td.style.outline='2px solid limegreen'; logLine(`🟢 "${raw}" iría a Semana ${week}, ${colName}`, 'ok'); }
      else    { logLine(`🔴 No encontré destino para "${raw}"`, 'err'); }
    });
  }

  /* --------- Auto-captura Ajax --------- */
  function loadLearned(){
    try { const raw = localStorage.getItem(STORAGE_LEARN); return raw ? JSON.parse(raw) : null; } catch(_) { return null; }
  }
  function autoCaptureTemplate(onStatus){
    let captured = false;
    const commit = (url, headers, template) => {
      if (captured || !template) return;
      const flags = detectFormatFlags(template);
      localStorage.setItem(STORAGE_LEARN, JSON.stringify({ url, headers, template, flags }));
      logLine('📡 Plantilla Ajax auto-capturada ✓', 'ok');
      captured = true; onStatus && onStatus();
    };

    // Intercept fetch
    const _fetch = window.fetch;
    window.fetch = async function(input, init){
      const url = typeof input==='string'?input:input.url;
      const method = (init && init.method || 'GET').toUpperCase();
      if (!captured && url.includes('weeklyDistributionForm') && method === 'POST'){
        let bodyTxt = typeof init.body === 'string' ? init.body : (init.body ? JSON.stringify(init.body) : '');
        let template=null; try{ template=JSON.parse(bodyTxt); }catch(_){}
        commit(url, init.headers || {}, template);
      }
      return _fetch.apply(this, arguments);
    };

    // Intercept XHR
    const _open = XMLHttpRequest.prototype.open;
    const _send = XMLHttpRequest.prototype.send;
    XMLHttpRequest.prototype.open = function(method, url){ this.__ua_url = url; this.__ua_method = method; return _open.apply(this, arguments); };
    XMLHttpRequest.prototype.send = function(body){
      if (!captured && this.__ua_url?.includes('weeklyDistributionForm') &&
          (this.__ua_method||'GET').toUpperCase()==='POST'){
        let template=null;
        if (typeof body === 'string'){ try{ template=JSON.parse(body); }catch(_){ } }
        commit(this.__ua_url, {}, template);
      }
      return _send.apply(this, arguments);
    };
  }

  /* --------- Helpers --------- */
  function detectFormatFlags(template){
    const flags = { itemHasSuffix: false, orderHasSuffix: true, originListFixed: template.hasOwnProperty('originList') };
    if (typeof template.item === 'string' && template.item.includes('|')) flags.itemHasSuffix = true;
    if (Array.isArray(template.order) && template.order.length){ flags.orderHasSuffix = !!String(template.order[0]).includes('|'); }
    return flags;
  }
  function loadMap(){ try { const raw=localStorage.getItem(STORAGE_MAP); return raw ? JSON.parse(raw) : null; } catch(_){ return null; } }
  function getColumnNames(){
    const ths = qsa('table thead th');
    return ths.slice(1).map(th => th.textContent.trim());
  }

  async function postUsingLearned(learned, overrides){
    const url = learned.url;
    const template = JSON.parse(JSON.stringify(learned.template));
    const merged = Object.assign(template, overrides);
    const headers = {}; const tplHeaders = learned.headers || {};
    try { for (const [k,v] of Object.entries(tplHeaders)) headers[k]=v; } catch(_){}
    headers['Content-Type']   = 'application/json; charset=utf-8';
    headers['Accept']         = headers['Accept'] || 'application/json, text/javascript, */*; q=0.01';
    headers['X-Requested-With']=headers['X-Requested-With']|| 'XMLHttpRequest';

    for (let i=0;i<=RETRIES;i++){
      try{
        const res = await fetch(url, { method:'POST', headers, body: JSON.stringify(merged), credentials:'include' });
        if (res.ok) return { ok:true, body:await res.text() };
        await sleep(RETRY_BACKOFF_MS*(i+1));
      }catch(_){ await sleep(RETRY_BACKOFF_MS*(i+1)); }
    }
    return { ok:false, body:'' };
  }

  /* --------- IMPORT en PER --------- */
  async function importToPER(){
    const map = loadMap();
    if (!map) return logLine('No hay mapa guardado (exporta en DEMO).', 'err');

    const learned = loadLearned();
    if (!learned) return logLine('No hay plantilla Ajax auto-capturada.', 'err');

    const flags = learned.flags || detectFormatFlags(learned.template);
    const colNames = getColumnNames();

    const unassigned = qsa('.wai-unassigned .unassigneditem li');
    const total = unassigned.length;
    let done=0, okCount=0, failCount=0;

    for (const li of unassigned) {
      const raw  = getTextFromLi(li);
      const norm = normalizeText(raw);
      const info = map[norm];
      if (!info) { logLine(`Sin destino para "${raw}"`, 'warn'); done++; setProgress(done,total); continue; }

      const { week, colIndex, type } = info;
      const tr = qs(`tr#row-week-${week}`);
      const td = tr ? qsa('td.celdassemana', tr)[colIndex] : null;
      const targetUl = td ? qs('ul.assigmentList', td) : null;
      const colName  = colNames[colIndex] || `Columna ${colIndex}`;

      if (!targetUl) { logLine(`No encontré ${colName} de semana ${week} para "${raw}"`, 'err'); failCount++; done++; setProgress(done,total); continue; }

      const baseId = li.id.split('|')[0];
      const fullId = li.id;
      const itemValue   = flags.itemHasSuffix ? fullId : baseId;

      const currentIds = qsa('li', targetUl).map(x => flags.orderHasSuffix ? x.id : x.id.split('|')[0]);
      if (!currentIds.includes(flags.orderHasSuffix ? fullId : baseId)) {
        currentIds.push(flags.orderHasSuffix ? fullId : baseId);
      }
      const order = currentIds;

      let originList = learned.template.hasOwnProperty('originList') ? learned.template.originList : 'unassigned';

      const overrides = {
        item: itemValue,
        type: type || (fullId.split('|')[1] || ''),
        changedList: targetUl.id || '',
        originList: originList,
        order: order
      };

      const { ok } = await postUsingLearned(learned, overrides);

      if (ok) {
        targetUl.appendChild(li);
        logLine(`✅ "${raw}" guardado en Semana ${week}, ${colName}`, 'ok');
        okCount++;
      } else {
        logLine(`❌ Error guardando "${raw}" (Ajax)`, 'err');
        failCount++;
      }

      done++; setProgress(done,total);
      await sleep(POST_DELAY_MS);
    }

    if (FINAL_COMMIT_FORM) {
      await sleep(FINAL_COMMIT_DELAY);
      const form = qs('form[action*="weeklyDistributionForm"]');
      if (form) { try { form.requestSubmit ? form.requestSubmit() : form.submit(); logLine('Se envió un commit del formulario tras 10s.', 'warn'); } catch(_) {} }
    }

    alert(`Import terminado.\nÉxitos: ${okCount}\nFallos: ${failCount}\nTotal: ${total}`);
  }

  /* --------- Boot --------- */
  function boot(){
    createHUD();
    autoCaptureTemplate(() => {
      const b = qs('#ua-learn-status');
      if (b) { b.textContent = 'aprendida ✓'; b.className = 'badge okb'; }
    });
  }

  if (document.readyState === 'loading') window.addEventListener('DOMContentLoaded', boot);
  else boot();

})();
