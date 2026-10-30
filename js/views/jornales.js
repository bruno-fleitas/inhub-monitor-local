/**
 * @fileoverview Jornales (staffing) view: KPIs, detail modal and analysis runner.
 *
 * View/adapter layer of the hexagonal architecture.
 * Renders jornales tenure KPIs per site, a clickable detail modal with per-record
 * data, and orchestrates the jornales analysis via the persistent worker.
 *
 * Dependencies: core/dom.js, core/formatters.js, core/state.js,
 *              core/workers.js
 *
 * Exports: jornales, runJ
 */

import { $ } from '../core/dom.js';
import { nf, pf, pct, esc } from '../core/formatters.js';
import { state, names } from '../core/state.js';
import { calcJ } from '../core/workers.js';

/**
 * Run jornales analysis for both sites based on UI inputs.
 * Reads day, gerencia and tenure cutoffs from DOM inputs.
 * @returns {Promise<void>}
 */
export async function runJ() {
  const day = $('jorDate').value || state.config.analysisDate || state.sites.soldati.jornalesMeta?.latestDate || state.sites.echeverria.jornalesMeta?.latestDate;
  if (!day) return;
  const ger = $('jorGer').value || '__ALL__', d1 = Math.max(0, +$('jorD1').value || 3), d2 = Math.max(d1 + 1, +$('jorD2').value || 10);
  for (const site of ['soldati', 'echeverria']) state.sites[site].jornalesResult = await calcJ(site, day, ger, d1, d2);
  renderAll();
}

/**
 * Render a jornales KPI button that opens the detail modal on click.
 * @param {string} site - 'soldati' or 'echeverria'.
 * @param {string} filter - Filter key for the detail modal ('all', 'today', 'a', 'b', 'c').
 * @param {string} label - KPI label.
 * @param {number} value - KPI value.
 * @param {string} [small] - Optional small text.
 * @returns {string} HTML for the KPI button.
 */
function jorKpi(site, filter, label, value, small = '') {
  return `<button class="kpi jor-kpi" data-jor-site="${site}" data-jor-filter="${filter}"><span>${label}</span><b>${nf.format(value)}</b>${small ? `<small>${small}</small>` : ''}<em>Ver detalle</em></button>`;
}

/**
 * Render the jornales view for all sites with results.
 */
export function jornales() {
  let h = '<div class="grid two">', any = false;
  for (const site of ['soldati', 'echeverria']) {
    const q = state.sites[site].jornalesResult;
    if (!q) continue;
    any = true;
    h += `<div class="card"><h2>${names[site]}</h2><div class="kpi-grid">${jorKpi(site, 'all', 'Jornales', q.total)}${jorKpi(site, 'today', 'Nuevos hoy', q.newToday)}${jorKpi(site, 'a', `Nuevo -${q.d1}`, q.a, pf.format(pct(q.a, q.total)) + '%')}${jorKpi(site, 'b', `Nuevo ${q.d1 + 1}-${q.d2}`, q.b, pf.format(pct(q.b, q.total)) + '%')}${jorKpi(site, 'c', 'Antiguo', q.c, pf.format(pct(q.c, q.total)) + '%')}</div></div>`;
  }
  h += '</div>';
  $('jornalesView').innerHTML = any ? h : '<div class="empty">Cargá Jornales y analizá.</div>';
  bindJorDetails();
}

/**
 * Show a detail modal with filtered jornales records for a site.
 * @param {string} site - 'soldati' or 'echeverria'.
 * @param {string} filter - 'all', 'today', 'a', 'b', 'c'.
 */
function showJorDetail(site, filter) {
  const q = state.sites[site].jornalesResult;
  if (!q) return;
  let rows = (q.details || []).filter(x => x.days >= 0);
  if (filter === 'today') rows = rows.filter(x => x.days === 0);
  if (filter === 'a') rows = rows.filter(x => x.days >= 0 && x.days <= q.d1);
  if (filter === 'b') rows = rows.filter(x => x.days > q.d1 && x.days <= q.d2);
  if (filter === 'c') rows = rows.filter(x => x.days > q.d2);
  const title = filter === 'all' ? 'Todos los jornales' : filter === 'today' ? 'Nuevos hoy' : filter === 'a' ? `Nuevo -${q.d1}` : filter === 'b' ? `Nuevo ${q.d1 + 1}-${q.d2}` : 'Antiguos';
  const body = `<div class="jor-detail-head"><div><b>${names[site]} · ${title}</b><small>Jornada ${q.day} · ${nf.format(rows.length)} registros</small></div><button class="jor-close">×</button></div><div class="jor-table-wrap"><table class="hu-table compact"><tr><th>CUIL</th><th>Nombre</th><th>Ingreso grabado</th><th>Jornada</th><th>Días hábiles</th><th>Categoría</th><th>Gerencia</th></tr>${rows.map(x => `<tr><td>${esc(x.id)}</td><td>${esc(x.name || '-')}</td><td>${esc(x.recorded || '-')}</td><td>${esc(x.journey)}</td><td>${x.days}</td><td>${esc(x.category)}</td><td>${esc(x.ger || '-')}</td></tr>`).join('')}</table></div>`;
  let m = document.getElementById('jorDetailModal');
  if (!m) { m = document.createElement('div'); m.id = 'jorDetailModal'; m.className = 'jor-modal'; m.innerHTML = '<div class="jor-modal-box"></div>'; document.body.appendChild(m); }
  m.querySelector('.jor-modal-box').innerHTML = body;
  m.classList.add('open');
  m.querySelector('.jor-close').onclick = () => m.classList.remove('open');
  m.onclick = e => { if (e.target === m) m.classList.remove('open'); };
}

/** Bind jornales KPI click handlers to open the detail modal. */
function bindJorDetails() {
  document.querySelectorAll('[data-jor-site]').forEach(b => b.onclick = () => showJorDetail(b.dataset.jorSite, b.dataset.jorFilter));
}

// ── Import renderAll lazily to avoid circular dependency ──
let renderAll = () => {};
/**
 * Set the renderAll callback (called from app.js after initial render).
 * @param {function} fn - The renderAll function.
 */
export function setRenderAll(fn) { renderAll = fn; }
