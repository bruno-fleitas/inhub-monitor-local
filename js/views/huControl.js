/**
 * @fileoverview Control HU dashboard: HU tracking, DOT monitor, user modals.
 *
 * View/adapter layer of the hexagonal architecture.
 * Renders the full HU (Hub Unit) control dashboard per site, including:
 * - KPI panels with etiquetado/abierto/cerrado/pendiente
 * - CPT tracking tables with active user counts
 * - MELI Air panels (compact and detailed)
 * - DOT (Dispatch On Time) monitor with exclusion controls
 * - User activity modals
 * - HU productivity tables
 *
 * Dependencies: core/dom.js, core/formatters.js, core/state.js, core/config.js,
 *              core/time.js, domain/tms.js
 *
 * Exports: huControl
 */

import { $ } from '../core/dom.js';
import { nf, pf, pct, esc, huPercent2 } from '../core/formatters.js';
import { state, names, dotExclusions } from '../core/state.js';
import { huConfig } from '../core/config.js';
import {
  huCptRows, huActiveUsers, huSeparateAir, huPct, huTone,
  huCptTracking, dotTarget, dotData, dotExport, dotVisibleRows
} from '../domain/tms.js';
import { huInhubMini } from './operation.js';

/** Render a user count button that opens a modal on click. */
function huUserButton(list, label) {
  const n = list?.length || 0; if (!n) return '<span class="user-zero">0</span>';
  const payload = encodeURIComponent(JSON.stringify(list.map(x => ({ user: x.user, last: x.last, cpt: x.cpt }))));
  return '<button type="button" class="user-link" data-user-list="' + payload + '" data-user-label="' + esc(label) + '">' + nf.format(n) + '</button>';
}

/** Bind user modal click handlers. */
function bindHuUserClicks() {
  document.querySelectorAll('[data-user-list]').forEach(btn => btn.onclick = e => {
    e.preventDefault(); e.stopPropagation();
    let list = []; try { list = JSON.parse(decodeURIComponent(btn.dataset.userList || '')); } catch { }
    const rows = list.map(x => '<tr><td>' + esc(x.user) + '</td><td>' + (x.cpt == null ? '-' : esc(x.cpt)) + '</td><td>' + (x.last ? new Date(x.last).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }) : '-') + '</td></tr>').join('');
    const modal = document.createElement('div'); modal.className = 'user-modal';
    modal.innerHTML = '<div class="user-modal-card"><div class="user-modal-head"><div><h3>' + esc(btn.dataset.userLabel || 'Usuarios conectados') + '</h3><small>' + nf.format(list.length) + ' ' + (list.some(x => x.cpt != null) ? 'registros por CPT' : 'usuarios únicos') + ' según la ventana configurada</small></div><button type="button" class="user-close">×</button></div><div class="user-modal-body"><table class="hu-table compact"><tr><th>Usuario</th><th>CPT</th><th>Última actividad</th></tr>' + (rows || '<tr><td colspan="3">Sin usuarios activos.</td></tr>') + '</table></div></div>';
    document.body.appendChild(modal);
    const close = () => modal.remove(); modal.querySelector('.user-close').onclick = close; modal.onclick = ev => { if (ev.target === modal) close(); };
    document.addEventListener('keydown', function escClose(ev) { if (ev.key === 'Escape') { close(); document.removeEventListener('keydown', escClose); } });
  });
}

/** Render the MELI Air panel (compact or detailed mode). */
function huAirPanel(site, t, detailMode = false) {
  const x = huSeparateAir(t).meli, tot = x.hu.totals, progress = tot.etiquetado ? pct(tot.abierto + tot.cerrado, tot.etiquetado) : 0;
  const airUsers = [...new Map(huActiveUsers(site, x).map(u => [u.user, { user: u.user, last: u.last }])).values()];
  if (!detailMode) return '<section class="hu-air-compact"><h3>Armado de HU · MELI Air</h3><table class="hu-table"><tr><th>CPT</th><th>Etiquetado</th><th>HU-Abierto</th><th>HU-Cerrado</th><th>Pend. HU</th><th>% Avance</th><th>Users activos</th></tr><tr class="hu-air-row"><td>00:00</td><td>' + nf.format(tot.etiquetado) + '</td><td>' + nf.format(tot.abierto) + '</td><td>' + nf.format(tot.cerrado) + '</td><td>' + nf.format(tot.pendiente) + '</td><td><span class="hu-pill ' + huTone(progress, huConfig(site).objective) + '">' + huPercent2(progress) + '%</span></td><td>' + huUserButton(airUsers, 'MELI Air · conectados') + '</td></tr></table></section>';
  return '<section class="hu-air-panel"><h3>MELI AIR · Detalle por SubCA</h3><div class="hu-scroll"><table class="hu-table"><tr><th>SubCA</th><th>Etiquetado</th><th>Abierto</th><th>Cerrado</th><th>Pendiente</th><th>Avance</th><th>Conectados</th></tr>' + x.hu.subca.map(g => '<tr><td>' + esc(g.subca) + '</td><td>' + nf.format(g.etiquetado) + '</td><td>' + nf.format(g.abierto) + '</td><td>' + nf.format(g.cerrado) + '</td><td>' + nf.format(g.pendiente) + '</td><td>' + huPercent2(g.etiquetado ? pct(g.abierto + g.cerrado, g.etiquetado) : 0) + '%</td><td>' + huUserButton(airUsers.filter(u => huActiveUsers(site, x).some(a => a.user === u.user && String(a.subca).toUpperCase() === String(g.subca).toUpperCase())), g.subca + ' · conectados') + '</td></tr>').join('') + '</table></div></section>';
}

/** Render the HU productivity table (top users by event count). */
function huProductivity(t) {
  const rows = (t.hu?.userStats || []).slice(0, 12);
  if (!rows.length) return '<div class="hu-empty">Sin usuarios HU detectados.</div>';
  return '<table class="hu-table compact"><tr><th>Usuario HU</th><th>Piezas / eventos</th><th>Última actividad</th></tr>' + rows.map(x => '<tr><td>' + esc(x.user) + '</td><td>' + nf.format(x.count) + '</td><td>' + (x.last ? new Date(x.last).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' }) : '-') + '</td></tr>').join('') + '</table>';
}

/** Render the CPT/SubCA tracking table with expandable details. */
function huTrackingTable(site, t) {
  const groups = huCptTracking(site, t);
  if (!groups.length) return '<div class="hu-empty">Sin información por CPT/SubCA.</div>';
  return '<div class="cpt-track">' + groups.map(g => '<details class="cpt-group" open><summary><span class="cpt-name">CPT ' + esc(g.cpt) + '</span><span>' + g.subcas.length + ' SubCA</span><span>' + nf.format(g.etiquetado) + ' piezas</span><span>' + pf.format(g.avance) + '% avance</span><span>' + huUserButton(g.userList, 'CPT ' + g.cpt + ' · usuarios conectados') + '</span><span>' + nf.format(g.finalizado) + ' fin. · ' + nf.format(g.enDespacho) + ' desp. · ' + nf.format(g.despachado) + ' sal.</span><span class="hu-pill ' + huTone(g.avance, 99.5) + '">' + nf.format(g.pendiente) + ' pend.</span></summary><div class="hu-scroll cpt-sub-scroll"><table class="hu-table compact"><tr><th>SubCA</th><th>Ola</th><th>Indicador</th><th>Etiquetado</th><th>HU Abierto</th><th>HU Cerrado</th><th>Pendiente</th><th>% Avance</th><th>Conectados</th><th>HU Finalizado</th><th>En despacho</th><th>Despachado</th></tr>' + g.subcas.map(r => '<tr><td>' + esc(r.subca) + '</td><td>' + esc(r.ola || '-') + '</td><td>' + esc(r.indicador || '-') + '</td><td>' + nf.format(r.etiquetado) + '</td><td>' + nf.format(r.abierto) + '</td><td>' + nf.format(r.cerrado) + '</td><td class="hu-pend">' + nf.format(r.pendiente) + '</td><td><span class="hu-pill ' + huTone(r.avance, 99.5) + '">' + pf.format(r.avance) + '%</span></td><td>' + huUserButton(r.userList, r.subca + ' · usuarios conectados') + '</td><td>' + nf.format(r.finalizado) + '</td><td>' + nf.format(r.enDespacho) + '</td><td>' + nf.format(r.despachado) + '</td></tr>').join('') + '</table></div></details>').join('') + '</div>';
}

/** Render the DOT monitor panel. */
function dotMonitor(site, t) {
  const cfg = dotTarget(site), d = dotData(site, t), v = d.total, visible = dotVisibleRows(site, d), fmt = ts => ts == null ? '—' : new Date(ts).toLocaleString('es-AR');
  const options = (vals, selected) => vals.map(v2 => '<option value="' + esc(v2) + '"' + (v2 === selected ? ' selected' : '') + '>' + esc(v2 === 'all' ? 'Todos' : v2) + '</option>').join('');
  const subcas = [...new Set(d.rows.map(x => x.subca))].sort(), cpts = [...new Set(d.rows.map(x => x.cpt).filter(Boolean))].sort((a, b) => Number(a) - Number(b));
  const dotPercent = new Intl.NumberFormat('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const huGroups = new Map(); for (const x of d.rows) { if (x.kind !== 'delay' || !String(x.hu || '').trim()) continue; const id = String(x.hu).trim(); if (!huGroups.has(id)) huGroups.set(id, { hu: id, items: [], excluded: 0 }); const g = huGroups.get(id); g.items.push(x); if (x.exclusion) g.excluded++; }
  const grouped = [...huGroups.values()].filter(g => g.items.length > 1).sort((a, b) => b.items.length - a.items.length);
  const kpi = (label, value) => '<div><span>' + label + '</span><b>' + value + '</b></div>';
  return '<section class="dot-panel"><div class="hu-section-title"><div><h3>Dispatch On Time · DOT</h3><div class="hu-note">Ingresos de D-1: 00:00–23:59:59 · CPT del día D: 00:00–13:00. Desestimaciones temporales.</div></div><label>Fecha DOT <input type="date" data-dot-field="date" data-site="' + site + '" value="' + esc(cfg.date) + '"></label></div><div class="hu-note">Jornada de ingreso: ' + esc(d.sourceDate) + ' · Fecha de cumplimiento: ' + esc(d.date) + (d.hasDispatchField ? '' : ' · ADVERTENCIA: falta Dispatch Date Finished en CSV') + '</div><div class="hu-status-strip">' + kpi('DOT original', d.bruto == null ? 'Sin evaluados' : dotPercent.format(d.bruto) + '%') + kpi('DOT ajustado', d.ajustado == null ? 'Sin evaluados' : dotPercent.format(d.ajustado) + '%') + kpi('ON TIME', nf.format(v.onTime)) + kpi('DELAY', nf.format(v.delay)) + kpi('Desestimados', nf.format(v.excluded)) + kpi('CPT futuro', nf.format(v.pending)) + kpi('Sin CPT', nf.format(d.missing.length)) + '</div><div class="hu-note" style="margin:12px 0">DOT original = ON TIME / (ON TIME + DELAY). DOT ajustado = ON TIME / (ON TIME + DELAY - desestimados). Los pendientes y Sin CPT no entran en el porcentaje.</div><div class="hu-head-actions" style="display:flex;gap:10px;flex-wrap:wrap;margin:14px 0"><label>Estado <select data-dot-field="kind" data-site="' + site + '">' + options(['all', 'onTime', 'delay', 'pending', 'sinCpt'], cfg.kind || 'all') + '</select></label><label>SubCA <select data-dot-field="subcaFilter" data-site="' + site + '">' + options(['all', ...subcas], cfg.subcaFilter || 'all') + '</select></label><label>CPT <select data-dot-field="cptFilter" data-site="' + site + '">' + options(['all', ...cpts], cfg.cptFilter || 'all') + '</select></label><label>Buscar <input data-dot-field="search" data-site="' + site + '" value="' + esc(cfg.search || '') + '" placeholder="Shipment / HU / SubCA"></label><button type="button" data-dot-export="' + site + '">Exportar detalle (Excel / CSV)</button></div><div class="hu-note" style="margin-top:16px"><strong>Desvíos agrupados por HU</strong> · Solo HU con 2 o más shipments DELAY. La acción masiva incluye todos los DELAY de esa HU, aunque no estén visibles por filtros.</div><div class="hu-scroll"><table class="hu-table compact"><tr><th>Número HU</th><th>Shipments DELAY</th><th>Desestimados</th><th>Motivo masivo</th><th>Acciones</th></tr>' + grouped.map(g => '<tr><td>' + esc(g.hu) + '</td><td>' + nf.format(g.items.length) + '</td><td>' + nf.format(g.excluded) + '</td><td><select data-dot-hu-reason="' + site + '" data-hu="' + esc(g.hu) + '"><option value="Sistema">Desvío de sistema</option><option value="LH-VEHICULOS">LH – Vehículos</option></select></td><td><button type="button" data-dot-hu-action="exclude" data-site="' + site + '" data-hu="' + esc(g.hu) + '">Desestimar HU</button> <button type="button" data-dot-hu-action="restore" data-site="' + site + '" data-hu="' + esc(g.hu) + '">Contabilizar HU</button></td></tr>').join('') + (!grouped.length ? '<tr><td colspan="5">No hay HU con múltiples desvíos.</td></tr>' : '') + '</table></div><div class="hu-note">Mostrando ' + nf.format(Math.min(visible.length, 500)) + ' de ' + nf.format(visible.length) + ' shipments filtrados. La exportación incluye todos los filtrados.</div><div class="hu-scroll"><table class="hu-table compact"><thead><tr><th>Shipment ID</th><th>Ingreso</th><th>SubCA</th><th>CPT</th><th>Límite</th><th>Despacho</th><th>Estado</th><th>Atraso (min)</th><th>Desestimar</th><th>Motivo</th></tr></thead><tbody>' + visible.slice(0, 500).map(x => '<tr><td>' + esc(x.shipment) + '</td><td>' + esc(fmt(x.inTs)) + '</td><td>' + esc(x.subca || '—') + '</td><td>' + esc(x.cpt || '—') + '</td><td>' + esc(fmt(x.deadline)) + '</td><td>' + esc(fmt(x.dispatchTs)) + '</td><td>' + esc(x.kind === 'sinCpt' ? 'SIN CPT' : x.kind === 'onTime' ? 'ON TIME' : x.kind === 'pending' ? 'PENDIENTE' : 'DELAY') + '</td><td>' + esc(x.minutes ?? '—') + '</td><td>' + (x.kind === 'delay' ? '<input type="checkbox" data-dot-exclude="' + site + '" data-shipment="' + esc(x.shipment) + '"' + (x.exclusion ? ' checked' : '') + '>' : '—') + '</td><td>' + (x.kind === 'delay' ? '<select data-dot-reason="' + site + '" data-shipment="' + esc(x.shipment) + '"><option value="">Sin desestimar</option>' + [['Sistema', 'Desvío de sistema'], ['LH-VEHICULOS', 'LH – Vehículos']].map(([val, lbl]) => '<option value="' + val + '"' + (x.exclusion === val ? ' selected' : '') + '>' + lbl + '</option>').join('') + '</select>' : '—') + '</td></tr>').join('') + (!visible.length ? '<tr><td colspan="10">Sin envíos para los filtros seleccionados.</td></tr>' : '') + '</tbody></table></div><div class="hu-note" style="margin-top:16px"><strong>SubCA sin CPT configurado</strong> · Revisar y completar la configuración de CPT correspondiente.</div><div class="hu-scroll"><table class="hu-table compact"><tr><th>SubCA</th><th>Shipments sin CPT</th></tr>' + [...d.missing.reduce((m, x) => (m.set(x.subca, (m.get(x.subca) || 0) + 1), m), new Map()).entries()].sort((a, b) => b[1] - a[1]).map(([sub, n]) => '<tr><td>' + esc(sub || 'SIN SUBCA') + '</td><td>' + nf.format(n) + '</td></tr>').join('') + (!d.missing.length ? '<tr><td colspan="2">Sin SubCA pendientes de CPT.</td></tr>' : '') + '</table></div><div class="hu-note" style="margin-top:16px"><strong>Auditoría por CPT y SubCA</strong></div><div class="hu-scroll"><table class="hu-table compact"><tr><th>CPT</th><th>SubCA</th><th>Ingresados</th><th>ON TIME</th><th>DELAY</th><th>Pendientes</th><th>Desestimados</th></tr>' + d.groups.map(g => '<tr><td>' + esc(g.cpt) + '</td><td>' + esc(g.subca) + '</td><td>' + nf.format(g.total) + '</td><td>' + nf.format(g.onTime) + '</td><td>' + nf.format(g.delay) + '</td><td>' + nf.format(g.pending) + '</td><td>' + nf.format(g.excluded) + '</td></tr>').join('') + '</table></div><div class="hu-note" style="margin-top:16px"><strong>DOT especial de fin de semana</strong> · Cronograma de SubCA viernes/sábado y domingo/lunes pendiente de configuración. No se aplican reglas supuestas.</div></section>';
}

/** Bind DOT monitor control handlers. */
function bindDotControls() {
  document.querySelectorAll('[data-dot-field]').forEach(el => el.onchange = () => { dotTarget(el.dataset.site)[el.dataset.dotField] = el.value; huControl(); });
  document.querySelectorAll('[data-dot-hu-action]').forEach(btn => btn.onclick = () => {
    const site = btn.dataset.site, hu = btn.dataset.hu, action = btn.dataset.dotHuAction, t = state.sites[site].tms; if (!t) return;
    const d = dotData(site, t); const items = d.rows.filter(x => x.kind === 'delay' && String(x.hu || '').trim() === hu);
    const select = [...document.querySelectorAll('[data-dot-hu-reason]')].find(x => x.dataset.dotHuReason === site && x.dataset.hu === hu);
    const reason = select?.value || 'Sistema';
    for (const x of items) { if (action === 'exclude') dotExclusions[site].set(String(x.shipment), reason); else dotExclusions[site].delete(String(x.shipment)); }
    huControl();
  });
  document.querySelectorAll('[data-dot-export]').forEach(el => el.onclick = () => dotExport(el.dataset.dotExport));
  document.querySelectorAll('[data-dot-exclude]').forEach(el => el.onchange = () => {
    const site = el.dataset.dotExclude, id = el.dataset.shipment, sel = [...document.querySelectorAll('[data-dot-reason]')].find(x => x.dataset.dotReason === site && x.dataset.shipment === id);
    if (el.checked) { const reason = sel?.value || 'Sistema'; dotExclusions[site].set(id, reason); } else dotExclusions[site].delete(id); huControl();
  });
  document.querySelectorAll('[data-dot-reason]').forEach(el => el.onchange = () => { const site = el.dataset.dotReason, id = el.dataset.shipment; if (el.value) dotExclusions[site].set(id, el.value); else dotExclusions[site].delete(id); huControl(); });
}

/** Render the full HU dashboard for a site. */
function huDashboard(site, originalT) {
  const t = huSeparateAir(originalT).normal;
  const cfg = huConfig(site), tot = t.hu?.totals || { etiquetado: 0, abierto: 0, cerrado: 0, pendiente: 0 };
  const avance = tot.etiquetado ? pct(tot.abierto + tot.cerrado, tot.etiquetado) : 0;
  const rows = huCptRows(site, t), activeUsers = huActiveUsers(site, t), uniqueConnected = new Set(activeUsers.map(x => x.user)).size, duplicateConnected = rows.reduce((sum, x) => sum + x.users.size, 0), active = cfg.connectedMode === 'byCpt' ? duplicateConnected : uniqueConnected;
  const hours = hoursToTarget(t.hu?.maxOutTs, cfg.targetTime), prod = Math.max(1, Number(cfg.prod) || 190);
  const goalPct = Math.max(0, Math.min(100, Number(cfg.targetPct ?? 65))), forecast = Number($(site === 'soldati' ? 'fcS' : 'fcE')?.value) || 0, goalPieces = forecast > 0 ? Math.ceil(forecast * goalPct / 100) : null, remainingGoal = goalPieces === null ? null : Math.max(0, goalPieces - tot.abierto - tot.cerrado);
  const pph = remainingGoal === null ? null : hours > 0 ? remainingGoal / hours : null, need = pph === null ? null : Math.ceil(pph / prod), realProd = active * prod, capacity = realProd * hours, gap = need === null ? null : active - need;
  const bad = rows.filter(x => huPct(x) < cfg.cptObjective);
  const update = t.hu?.maxOutTs ? new Date(t.hu.maxOutTs).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }) : '-';
  return '<section class="hu-dashboard" data-hu-site="' + site + '"><div class="hu-head"><div><span class="hu-brand">OCASA</span><h2>' + names[site] + ' · Control HU</h2><small>Última actualización HU <b>' + update + '</b> · conectados = actividad dentro de los últimos ' + cfg.activeMinutes + ' min</small></div><div class="hu-head-actions"><label>Corte de análisis (opcional)<input type="time" data-hucutoff="' + site + '" value="' + (cfg.huCutoff || '') + '"></label><button class="smallbtn primary" data-cutapply="' + site + '">Aplicar corte</button><button class="smallbtn" data-cutclear="' + site + '">Limpiar corte</button><label>Inicio HU (base Inhub TMS)<select data-hustart="' + site + '">' + Array.from({ length: 24 }, (_, i) => '<option value="' + i + '" ' + (i == (cfg.huStartHour ?? 7) ? 'selected' : '') + '>' + String(i).padStart(2, '0') + ':00</option>').join('') + '</select></label><button class="smallbtn primary" data-huapply="' + site + '">Aplicar horario</button><label>Inicio Inhub<select data-inhubstart="' + site + '">' + Array.from({ length: 24 }, (_, i) => '<option value="' + i + '" ' + (i == (cfg.inhubStartHour ?? 0) ? 'selected' : '') + '>' + String(i).padStart(2, '0') + ':00</option>').join('') + '</select></label><button class="smallbtn primary" data-inhubapply="' + site + '">Aplicar Inhub</button><label>Hora objetivo<input type="time" data-hucfg="targetTime" data-site="' + site + '" value="' + cfg.targetTime + '"></label><label>Objetivo avance %<input type="number" min="0" max="100" step="0.1" data-hucfg="targetPct" data-site="' + site + '" value="' + cfg.targetPct + '"></label><label>Prod. objetivo pza/h<input type="number" data-hucfg="prod" data-site="' + site + '" value="' + cfg.prod + '"></label><label>Verde desde %<input type="number" min="0" max="100" step="0.1" data-hucfg="objective" data-site="' + site + '" value="' + cfg.objective + '"></label><label>Obj. cierre CPT %<input type="number" step="0.1" data-hucfg="cptObjective" data-site="' + site + '" value="' + cfg.cptObjective + '"></label><label>Conteo conectados<select data-hucfg="connectedMode" data-site="' + site + '"><option value="unique" ' + (cfg.connectedMode !== 'byCpt' ? 'selected' : '') + '>Sin duplicados</option><option value="byCpt" ' + (cfg.connectedMode === 'byCpt' ? 'selected' : '') + '>Con duplicados (por CPT)</option></select></label><label>Ventana conectados (min)<input type="number" min="1" max="120" step="1" data-hucfg="activeMinutes" data-site="' + site + '" value="' + cfg.activeMinutes + '"></label></div></div>' + (cfg.huCutoff ? '<p class="hu-cutoff-notice">Filtro Inhub hasta ' + cfg.huCutoff + ' · los estados HU reflejan la descarga TMS cargada, no una reconstrucción histórica exacta.</p>' : '') + '<div class="hu-status-strip"><div><span>Última actualización</span><b>' + update + '</b></div><div><span>Hora objetivo</span><b>' + cfg.targetTime + '</b></div><div><span>Tiempo restante</span><b>' + fmtDuration(hours) + '</b></div><div><span>Conectados ' + (cfg.connectedMode === 'byCpt' ? 'por CPT (con duplicados)' : 'únicos') + '</span><b>' + nf.format(active) + '</b><small>Únicos: ' + nf.format(uniqueConnected) + ' · Por CPT: ' + nf.format(duplicateConnected) + '</small></div><div><span>Necesarios para ' + pf.format(goalPct) + '%</span><b>' + (need === null ? 'Sin proyectado' : nf.format(need)) + '</b></div><div class="' + (gap !== null && gap >= 0 ? 'gap-good' : 'gap-bad') + '"><span>Brecha</span><b>' + (gap === null ? '—' : (gap > 0 ? '+' : '') + nf.format(gap)) + '</b></div></div><div class="hu-layout"><div class="hu-left"><div class="hu-kpi-panel"><table class="hu-summary"><tr><td>TOTAL Piezas</td><td>' + nf.format(tot.etiquetado) + '</td></tr><tr><td>Piezas con HU Abierto</td><td>' + nf.format(tot.abierto) + '</td></tr><tr><td>Piezas HU Cerrado</td><td>' + nf.format(tot.cerrado) + '</td></tr><tr><td>Piezas Pendientes de HU</td><td>' + nf.format(tot.pendiente) + '</td></tr></table><div class="hu-big ' + huTone(avance, cfg.objective) + '">' + huPercent2(avance) + '%</div></div>' + huAirPanel(site, originalT, false) + '<div class="hu-titlebar">CONTROL - CPT / XD</div><h3>Armado de HU · General (sin MELI Air)</h3><div class="hu-scroll hu-cpt-full"><table class="hu-table"><tr><th>CPT</th><th>Etiquetado</th><th>HU-Abierto</th><th>HU-Cerrado</th><th>Pend. HU</th><th>% Avance</th><th>% Share</th><th>Users activos</th></tr>' + rows.map(x => { const a = huPct(x); return '<tr><td>' + x.cpt + '</td><td>' + nf.format(x.etiquetado) + '</td><td>' + nf.format(x.abierto) + '</td><td>' + nf.format(x.cerrado) + '</td><td class="hu-pend">' + nf.format(x.pendiente) + '</td><td><span class="hu-pill ' + huTone(a, cfg.objective) + '">' + huPercent2(a) + '%</span></td><td>' + huPercent2(tot.etiquetado ? pct(x.etiquetado, tot.etiquetado) : 0) + '%</td><td>' + huUserButton([...x.users].map(user => ({ user, last: (huActiveUsers(site, t).find(a => a.user === user)?.last || null) })), 'CPT ' + x.cpt + ' · conectados') + '</td></tr>'; }).join('') + '<tr class="total"><td>Total</td><td>' + nf.format(tot.etiquetado) + '</td><td>' + nf.format(tot.abierto) + '</td><td>' + nf.format(tot.cerrado) + '</td><td>' + nf.format(tot.pendiente) + '</td><td>' + huPercent2(avance) + '%</td><td>100,00%</td><td>' + huUserButton(cfg.connectedMode === 'byCpt' ? rows.flatMap(x => [...x.users].map(user => ({ user, last: activeUsers.find(a => a.user === user)?.last || null, cpt: x.cpt }))) : [...new Map(activeUsers.map(a => [a.user, { user: a.user, last: a.last }])).values()], cfg.connectedMode === 'byCpt' ? 'Total · conectados por CPT' : 'Total · conectados únicos') + '</td></tr></table></div></div><div class="hu-right"><h3>Datos operativos</h3><div class="hu-ops"><table class="hu-table op"><tr><td>total</td><td>' + nf.format(tot.etiquetado) + '</td></tr><tr><td>objetivo ' + pf.format(goalPct) + '% a las ' + cfg.targetTime + '</td><td>' + (goalPieces === null ? 'Cargar proyectado' : nf.format(goalPieces)) + '</td></tr><tr><td>piezas faltantes para objetivo</td><td>' + (remainingGoal === null ? '-' : nf.format(remainingGoal)) + '</td></tr><tr><td>piezas procesadas</td><td>' + nf.format(tot.abierto + tot.cerrado) + '</td></tr><tr><td>HU cerrado</td><td>' + nf.format(tot.cerrado) + '</td></tr><tr><td>pendiente total HU</td><td>' + nf.format(tot.pendiente) + '</td></tr><tr><td>hs restantes</td><td>' + fmtDuration(hours) + '</td></tr><tr><td>pza x hs neces</td><td>' + (pph === null ? '-' : nf.format(Math.ceil(pph))) + '</td></tr><tr><td>usuarios HU necesarios</td><td class="hu-need">' + (need === null ? '-' : nf.format(need)) + '</td></tr><tr><td>conectados reales</td><td>' + nf.format(active) + '</td></tr><tr><td>brecha</td><td class="' + (gap >= 0 ? 'gap-good-cell' : 'gap-bad-cell') + '">' + (gap > 0 ? '+' : '') + nf.format(gap) + '</td></tr><tr><td>producción real/h</td><td>' + nf.format(realProd) + '</td></tr><tr><td>capacidad hasta ' + cfg.targetTime + '</td><td>' + nf.format(Math.round(capacity)) + '</td></tr></table></div>' + huInhubMini(site) + '</div></div>' + huAirPanel(site, originalT, true) + '<div class="hu-tracking-block"><h3>Seguimiento por CPT y SubCA</h3><div class="hu-note">Avance, pendientes y conectados activos por cada SubCA dentro de su CPT.</div>' + huTrackingTable(site, t) + '</div>' + dotMonitor(site, originalT) + '<div class="hu-bottom-grid"><div><h3>Auditoría CPT · objetivo ' + pf.format(cfg.cptObjective) + '%</h3><div class="hu-scroll"><table class="hu-table compact"><tr><th>CPT</th><th>Avance</th><th>Pendiente</th><th>Estado</th></tr>' + rows.map(x => { const a = huPct(x), ok = a >= cfg.cptObjective; return '<tr><td>' + x.cpt + '</td><td>' + huPercent2(a) + '%</td><td>' + nf.format(x.pendiente) + '</td><td><span class="hu-pill ' + (ok ? 'hu-good' : a >= 95 ? 'hu-warn' : 'hu-bad') + '">' + (ok ? 'CUMPLE' : 'PENDIENTE') + '</span></td></tr>'; }).join('') + '</table></div><div class="hu-note">' + (bad.length ? bad.length + ' CPT debajo del objetivo final' : 'Todos los CPT cumplen el objetivo final') + '.</div></div><div><h3>Productividad HU · Top usuarios</h3><div class="hu-scroll">' + huProductivity(t) + '</div></div></div></section>';
}

/** Bind HU config input change handlers. */
function bindHuControls() {
  document.querySelectorAll('[data-hucfg]').forEach(el => el.onchange = () => {
    const site = el.dataset.site, k = el.dataset.hucfg;
    huConfig(site)[k] = k === 'targetTime' || k === 'connectedMode' ? el.value : Number(el.value);
    huControl();
  });
}

// Lazy import to break circular dependency with app.js
let renderAll = () => {};
/**
 * Set the renderAll callback (called from app.js).
 * @param {function} fn
 */
export function setRenderAll(fn) { renderAll = fn; }

// Lazy import for runT to avoid circular dependency with core/workers.js
let runT = null;
/**
 * Set the runT worker function (called from app.js).
 * @param {function} fn
 */
export function setRunT(fn) { runT = fn; }

/**
 * Render the HU control dashboard for both sites.
 * Also binds all HU, DOT and user modal handlers.
 */
export function huControl() {
  for (const [site, id] of [['soldati', 'huViewSoldati'], ['echeverria', 'huViewEcheverria']]) {
    const t = state.sites[site].tms;
    const target = $(id); if (!target) { console.warn('Control HU: contenedor no encontrado:', id); continue; }
    target.innerHTML = t?.hu ? huDashboard(site, t) : '<div class="card empty">Procesá el TMS de ' + names[site] + ' para ver su Control HU.</div>';
  }
  bindHuControls();
  document.querySelectorAll('[data-arrival-apply]').forEach(b => b.onclick = () => { const site = b.dataset.arrivalApply, sel = document.querySelector('[data-arrival-start="' + site + '"]'); if (!sel) return; huConfig(site).arrivalStartHour = Number(sel.value); huControl(); });
  document.querySelectorAll('[data-inhubapply]').forEach(b => b.onclick = () => { const site = b.dataset.inhubapply, sel = document.querySelector('[data-inhubstart="' + site + '"]'); if (!sel) return; huConfig(site).inhubStartHour = Number(sel.value); huControl(); });
  document.querySelectorAll('[data-huapply]').forEach(b => b.onclick = async () => {
    const site = b.dataset.huapply, sel = document.querySelector('[data-hustart="' + site + '"]'); if (!sel) return; huConfig(site).huStartHour = Number(sel.value);
    if (!state.sites[site].files.tms) return;
    const prev = b.textContent; b.disabled = true; b.textContent = 'Recalculando...';
    try { state.sites[site].tms = await runT(site); renderAll(); }
    catch (e) { alert('No se pudo recalcular el Control HU: ' + e.message); b.disabled = false; b.textContent = prev; }
  });
  document.querySelectorAll('[data-cutapply],[data-cutclear]').forEach(b => b.onclick = async () => {
    const site = b.dataset.cutapply || b.dataset.cutclear, clear = !!b.dataset.cutclear;
    const input = document.querySelector('[data-hucutoff="' + site + '"]');
    const next = clear ? '' : (input?.value || '');
    if (!clear && !/^([01]\d|2[0-3]):[0-5]\d$/.test(next)) { alert('Seleccioná una hora válida.'); return; }
    huConfig(site).huCutoff = next; b.disabled = true; b.textContent = 'Recalculando...';
    try { state.sites[site].tms = await runT(site); renderAll(); }
    catch (e) { alert('Error al aplicar corte: ' + e.message); b.disabled = false; b.textContent = clear ? 'Limpiar corte' : 'Aplicar corte'; }
  });
  bindHuUserClicks();
  bindDotControls();
}
