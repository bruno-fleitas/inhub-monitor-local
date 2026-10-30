/**
 * @fileoverview Executive summary view.
 *
 * View/adapter layer of the hexagonal architecture.
 * Renders the top-level KPI summary cards for each site with available data.
 *
 * Dependencies: core/dom.js, core/formatters.js, core/state.js
 *
 * Exports: summary
 */

import { $ } from '../core/dom.js';
import { nf, pf, pct } from '../core/formatters.js';
import { state, names } from '../core/state.js';

/**
 * Render the executive summary cards for all sites with data.
 * Displays TMS, labelless, arrivals, registros and jornales KPIs.
 */
export function summary() {
  let h = '<div class="summary-sites">', any = false;
  for (const site of ['soldati', 'echeverria']) {
    const d = state.sites[site], t = d.tms, lab = d.files.labelless ? (t?.labelless || d.labellessStandalone) : null;
    if (!t && !d.arrivals && !d.jornalesResult && !d.registros && !lab) continue;
    any = true;
    const fc = Number($(site === 'soldati' ? 'fcS' : 'fcE').value) || 0;
    const pure = t ? Math.max(0, t.vol - t.big - t.sb) : 0, base = t ? Math.max(0, t.totalConPost - t.big - t.sb) : 0;
    h += `<section class="site-summary"><h2>${names[site]}</h2><div class="site-kpis">
      ${t ? `
      <div class="kpi"><span>Proyectado 09:00</span><b>${fc ? nf.format(fc) : '-'}</b></div>
      <div class="kpi"><span>Inhub c/Post</span><b>${nf.format(t.totalConPost)}</b></div>
      <div class="kpi"><span>Inhub s/Post</span><b>${nf.format(t.totalSinPost)}</b></div>
      <div class="kpi"><span>Voluminoso c/B+SB</span><b>${nf.format(t.vol)}</b><small>${pf.format(pct(t.vol, t.totalConPost))}%</small></div>
      <div class="kpi"><span>Voluminoso s/B+SB</span><b>${nf.format(pure)}</b><small>${pf.format(pct(pure, base))}%</small></div>
      <div class="kpi"><span>Bigger</span><b>${nf.format(t.big)}</b></div>
      <div class="kpi"><span>SuperBigger</span><b>${nf.format(t.sb)}</b></div>
      <div class="kpi"><span>MELI Air</span><b>${nf.format(t.meli.arrivals)}</b><small>HU ${nf.format(t.meli.processed)} · ${pf.format(pct(t.meli.processed, t.meli.arrivals))}%</small></div>
      ` : ''}
      ${lab ? `<div class="kpi"><span>Labelless</span><b>${nf.format(lab.arrived ?? lab.supplied ?? 0)}</b><small>${lab.processed != null ? 'HU ' + nf.format(lab.processed) + ' · ' + pf.format(pct(lab.processed, lab.arrived)) + '%' : 'Cargados ' + nf.format(lab.supplied || 0)}</small></div>` : ''}
      ${d.arrivals ? `<div class="kpi"><span>Vehículos</span><b>${nf.format(d.arrivals.veh)}</b><small>${nf.format(d.arrivals.totalShip)} paquetes</small></div>` : ''}
      ${d.registros ? `<div class="kpi"><span>Velocidad descarga</span><b>${nf.format(Math.round(d.registros.currentSpeed || 0))}</b><small>${nf.format(d.registros.packages || 0)} arribados · pza/h actual</small></div>` : ''}
      ${d.jornalesResult ? `<div class="kpi"><span>Jornales</span><b>${nf.format(d.jornalesResult.total)}</b></div>` : ''}
    </div></section>`;
  }
  h += '</div>';
  $('summaryCards').innerHTML = any ? h : '<div class="empty">Procesá archivos.</div>';
}
