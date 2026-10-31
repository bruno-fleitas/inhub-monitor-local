/*--------- MONITOR DE EVENTO ---------*/

import { $ } from '../core/dom.js';
import { nf, pf, pct } from '../core/formatters.js';
import { state } from '../core/state.js';
import { huSeparateAir, huCptRows, huActiveUsers } from '../domain/tms.js';
import { masters } from '../core/config.js';

/*--------- AGGREGATE ---------*/

function aggregate() {
  let totalConPost = 0, vol = 0, big = 0, sb = 0;
  let huEtiquetado = 0, huAbierto = 0, huCerrado = 0, huPendiente = 0;
  let meliEtiquetado = 0, meliAbierto = 0, meliCerrado = 0, meliPendiente = 0;
  let fc = 0;
  const cptMap = new Map();   // CPT normales (no MELI Air)
  const veh = { chasis: 0, camioneta: 0, semi: 0, total: 0 };
  const pkgByHour = Array(24).fill(0);
  let lastTs = null;
  const start = state.config.curveStart || 9;

  for (const site of ['soldati', 'echeverria']) {
    const d = state.sites[site];
    const t = d.tms, a = d.arrivals, r = d.registros;
    fc += Number(document.getElementById(site === 'soldati' ? 'fcS' : 'fcE')?.value) || 0;

    if (t) {
      totalConPost += t.totalConPost || 0;
      vol += t.vol || 0;
      big += t.big || 0;
      sb  += t.sb  || 0;
      if (t.maxInTs && (!lastTs || t.maxInTs > lastTs)) lastTs = t.maxInTs;

      const separated = huSeparateAir(t);

      // HU normal (sin MELI Air)
      const normTot = separated.normal.hu?.totals || {};
      huEtiquetado += normTot.etiquetado || 0;
      huAbierto    += normTot.abierto    || 0;
      huCerrado    += normTot.cerrado    || 0;
      huPendiente  += normTot.pendiente  || 0;

      // MELI Air
      const meliTot = separated.meli.hu?.totals || {};
      meliEtiquetado += meliTot.etiquetado || 0;
      meliAbierto    += meliTot.abierto    || 0;
      meliCerrado    += meliTot.cerrado    || 0;
      meliPendiente  += meliTot.pendiente  || 0;

      // CPT rows normales
      for (const row of huCptRows(site, separated.normal)) {
        const k = String(row.cpt);
        if (!cptMap.has(k)) cptMap.set(k, { cpt: k, etiquetado: 0, abierto: 0, cerrado: 0, pendiente: 0 });
        const g = cptMap.get(k);
        g.etiquetado += row.etiquetado; g.abierto += row.abierto;
        g.cerrado    += row.cerrado;    g.pendiente += row.pendiente;
      }

      if (t.by) t.by.forEach((h, i) => { pkgByHour[i] += h.tot || 0; });
    }

    const src = r?.vehiclesByHour || a?.h || null;
    if (src) for (let h = 0; h < 24; h++) {
      veh.chasis    += Number(src[h]?.chasis    || 0);
      veh.camioneta += Number(src[h]?.camioneta || 0);
      veh.semi      += Number(src[h]?.semi      || 0);
      veh.total     += Number(src[h]?.veh       || 0);
    }
    if (r?.lastTs && (!lastTs || r.lastTs > lastTs)) lastTs = r.lastTs;
  }

  return {
    fc, totalConPost, vol, big, sb,
    pctVol: totalConPost ? pct(vol, totalConPost) : 0,
    huEtiquetado, huAbierto, huCerrado, huPendiente,
    huAvance: huEtiquetado ? pct(huAbierto + huCerrado, huEtiquetado) : 0,
    meliEtiquetado, meliAbierto, meliCerrado, meliPendiente,
    meliAvance: meliEtiquetado ? pct(meliAbierto + meliCerrado, meliEtiquetado) : 0,
    cptRows: [...cptMap.values()].sort((a, b) => String(a.cpt).localeCompare(String(b.cpt), 'es', { numeric: true })),
    veh, pkgByHour, lastTs, start,
    spr: veh.total > 0 ? Math.round(totalConPost / veh.total) : null
  };
}

/*--------- SVG ICONS (color OCASA #0066CC) ---------*/

const C = '#0066CC';
const ICONS = {
  proyectado:  `<svg viewBox="0 0 24 24" fill="none" stroke="${C}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="16" rx="2"/><line x1="7" y1="9" x2="17" y2="9"/><line x1="7" y1="13" x2="13" y2="13"/><polyline points="3 9 7 5 11 9"/></svg>`,
  descarga:    `<svg viewBox="0 0 24 24" fill="none" stroke="${C}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v13"/><polyline points="8 12 12 16 16 12"/><path d="M3 19h18"/></svg>`,
  voluminoso:  `<svg viewBox="0 0 24 24" fill="none" stroke="${C}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><polyline points="21 8 21 21 3 21 3 8"/><polyline points="3 8 12 3 21 8"/><line x1="12" y1="3" x2="12" y2="21"/></svg>`,
  bigger:      `<svg viewBox="0 0 24 24" fill="none" stroke="${C}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 0 0-4 0v2"/></svg>`,
  superbigger: `<svg viewBox="0 0 24 24" fill="none" stroke="${C}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg>`,
  spr:         `<svg viewBox="0 0 24 24" fill="none" stroke="${C}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="1" y="3" width="15" height="13" rx="2"/><path d="M16 8h4l3 3v5h-7V8z"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>`
};

/*--------- BARRAS ---------*/

function bars(veh) {
  const total = veh.total || 1;
  return [['Chasis', veh.chasis], ['Camioneta', veh.camioneta], ['Semi', veh.semi]]
    .filter(([, n]) => n > 0)
    .sort(([, a], [, b]) => b - a)
    .map(([label, n]) => {
      const w = pct(n, total);
      return `<div class="mon-brow">
        <span class="mon-blbl">${label}</span>
        <div class="mon-btrack"><div class="mon-bfill" style="width:${Math.max(w, 1)}%"></div></div>
        <span class="mon-bpct">${pf.format(w)}%</span>
      </div>`;
    }).join('');
}

/*--------- TABLA CORTES ---------*/

function cutRows(pkgByHour, start) {
  const total = pkgByHour.slice(start).reduce((s, v) => s + v, 0) || 1;
  const cum = h => pkgByHour.slice(start, h).reduce((s, v) => s + v, 0);
  return [14, 16, 18, 20].map(h => {
    const n = cum(h);
    return `<tr><td>Pre ${h}</td><td>${nf.format(n)}</td><td>${pf.format(pct(n, total))} %</td></tr>`;
  }).join('');
}

/*--------- TABLA CPT: normales + fila MELI Air + Total ---------*/

function buildCptTable(d) {
  // Solo CPT 0 y CPT 1
  const rows = d.cptRows.filter(r => r.cpt === '0' || r.cpt === '1' || r.cpt === 0 || r.cpt === 1);

  // totales solo de CPT 0 y CPT 1
  const normTot = rows.reduce((s, r) => ({
    etiquetado: s.etiquetado + r.etiquetado,
    abierto:    s.abierto    + r.abierto,
    cerrado:    s.cerrado    + r.cerrado,
    pendiente:  s.pendiente  + r.pendiente
  }), { etiquetado: 0, abierto: 0, cerrado: 0, pendiente: 0 });

  // total global = CPT 0 + CPT 1 + MELI Air
  const grandTot = {
    etiquetado: normTot.etiquetado + d.meliEtiquetado,
    abierto:    normTot.abierto    + d.meliAbierto,
    cerrado:    normTot.cerrado    + d.meliCerrado,
    pendiente:  normTot.pendiente  + d.meliPendiente
  };

  const tr = (lbl, r, cls = '') => {
    const shp = r.abierto + r.cerrado;
    const av  = r.etiquetado ? pct(shp, r.etiquetado) : 0;
    const avCls = av >= 65 ? 'mon-ok' : 'mon-bad';
    return `<tr class="${cls}">
      <td>${lbl}</td>
      <td>${nf.format(r.etiquetado)}</td>
      <td>${nf.format(shp)}</td>
      <td>${nf.format(r.pendiente)}</td>
      <td class="${avCls}">${pf.format(av)} %</td>
    </tr>`;
  };

  const cptNormalRows = rows.map(r => tr('CPT ' + r.cpt, r)).join('');

  const meliRow = tr('Meli Air', {
    etiquetado: d.meliEtiquetado,
    abierto:    d.meliAbierto,
    cerrado:    d.meliCerrado,
    pendiente:  d.meliPendiente
  }, 'mon-tr-meli');

  const totalRow = tr('Total', grandTot, 'mon-tr-bold');

  return cptNormalRows + meliRow + totalRow;
}

/*--------- MODAL ---------*/

let _modal = null;

export function monitorEvento() {
  const host = $('monitorView');
  if (!host) return;
  const d = aggregate();
  const anyData = d.totalConPost > 0 || d.huEtiquetado > 0;
  host.innerHTML = anyData
    ? `<button class="mon-openbtn primary">📺 Abrir Monitor de Evento</button>`
    : `<p class="muted" style="padding:20px">Procesá TMS y Arribos para ver el monitor.</p>`;
  if (anyData) host.querySelector('.mon-openbtn').onclick = () => openMonitor(d);
}

function openMonitor(d) {
  if (_modal) _modal.remove();

  const clock = d.lastTs
    ? new Date(d.lastTs).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })
    : '—';

  const huSHP = d.huAbierto + d.huCerrado;

  _modal = document.createElement('div');
  _modal.className = 'mon-overlay';
  _modal.innerHTML = `
  <div class="mon-screen">

    <!-- HEADER -->
    <div class="mon-hdr">
      <div class="mon-hdr-brand">OCASA<span class="mon-hdr-arrow">↗</span></div>
      <div class="mon-hdr-clock">${clock}</div>
      <div class="mon-hdr-title">Monitor de Evento</div>
      <button class="mon-x" title="Cerrar">✕</button>
    </div>

    <!-- KPI STRIP -->
    <div class="mon-kpis">
      <div class="mon-kpi">
        <div class="mon-kpi-icon">${ICONS.proyectado}</div>
        <div class="mon-kpi-lbl">Proyectado</div>
        <div class="mon-kpi-val">${d.fc ? nf.format(d.fc) : '—'}</div>
      </div>
      <div class="mon-kpi">
        <div class="mon-kpi-icon">${ICONS.descarga}</div>
        <div class="mon-kpi-lbl">Total descargado CPT</div>
        <div class="mon-kpi-val">${nf.format(d.totalConPost)}</div>
        ${d.fc ? `<div class="mon-kpi-sub">${pf.format(pct(d.totalConPost,d.fc))}% del proy.</div>` : ''}
      </div>
      <div class="mon-kpi mon-kpi-accent">
        <div class="mon-kpi-icon">${ICONS.voluminoso}</div>
        <div class="mon-kpi-lbl">% Voluminoso</div>
        <div class="mon-kpi-val">${pf.format(d.pctVol)} %</div>
      </div>
      <div class="mon-kpi">
        <div class="mon-kpi-icon">${ICONS.bigger}</div>
        <div class="mon-kpi-lbl">Bigger</div>
        <div class="mon-kpi-val">${nf.format(d.big)}</div>
      </div>
      <div class="mon-kpi">
        <div class="mon-kpi-icon">${ICONS.superbigger}</div>
        <div class="mon-kpi-lbl">Superbigger</div>
        <div class="mon-kpi-val">${nf.format(d.sb)}</div>
      </div>
      <div class="mon-kpi">
        <div class="mon-kpi-icon">${ICONS.spr}</div>
        <div class="mon-kpi-lbl">Prom. paq / vehículo</div>
        <div class="mon-kpi-val">${d.spr !== null ? nf.format(d.spr) : '—'}</div>
        ${d.veh.total ? `<div class="mon-kpi-sub">${nf.format(d.veh.total)} vehículos</div>` : ''}
      </div>
    </div>

    <!-- BODY: grilla 2x2 exacta igual al original -->
    <div class="mon-body">

      <!-- [1,1] Barras -->
      <div class="mon-card mon-card-bars">
        ${bars(d.veh)}
      </div>

      <!-- [1,2] Bigcards lado a lado -->
      <div class="mon-bigrow">
        <div class="mon-card mon-bigcard">
          <div class="mon-big-lbl">SHP EN HU GENERAL SIN MELI AIR</div>
          <div class="mon-big-val">${nf.format(huSHP)}</div>
        </div>
        <div class="mon-card mon-bigcard">
          <div class="mon-big-lbl">% AVANCE HU SIN MELI AIR</div>
          <div class="mon-big-val ${d.huAvance >= 65 ? 'mon-ok' : 'mon-bad'}">${pf.format(d.huAvance)} %</div>
        </div>
      </div>

      <!-- [2,1] Tabla cortes -->
      <div class="mon-card mon-card-table">
        <table class="mon-tbl">
          <thead><tr><th>Corte</th><th>Paquetes Pre</th><th>% Paquetes Pre</th></tr></thead>
          <tbody>${cutRows(d.pkgByHour, d.start)}</tbody>
        </table>
      </div>

      <!-- [2,2] Tabla CPT -->
      <div class="mon-card mon-card-table">
        <table class="mon-tbl">
          <thead>
            <tr>
              <th>Tipo CPT</th><th>Total desc. CPT</th><th>SHP en HU</th>
              <th>Pendiente HU</th><th>% Avance HU CPT</th>
            </tr>
          </thead>
          <tbody>${buildCptTable(d)}</tbody>
        </table>
      </div>

    </div>
  </div>`;

  document.body.appendChild(_modal);

  const close = () => { _modal?.remove(); _modal = null; };
  _modal.querySelector('.mon-x').onclick = close;
  _modal.addEventListener('click', e => { if (e.target === _modal) close(); });
  document.addEventListener('keydown', function esc(e) {
    if (e.key === 'Escape') { close(); document.removeEventListener('keydown', esc); }
  });
}
