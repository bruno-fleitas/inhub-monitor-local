import { $ } from '../core/dom.js';
import { nf, pf, pct } from '../core/formatters.js';
import { state, names } from '../core/state.js';
import { huConfig } from '../core/config.js';
import { hoursUntil } from '../core/time.js';
import { tmsHourlyVelocity } from '../domain/tms.js';
import { cut, cuts } from '../domain/arrivals.js';

export function speedPanel(site) {
  const d = state.sites[site], r = d.registros, t = d.tms, fc = Number($(site === 'soldati' ? 'fcS' : 'fcE')?.value) || 0;
  if (!r && !t && !d.arrivals) return '';
  const target = state.config.speedTargetTime?.[site] || '22:00';
  const lastTs = r?.lastTs || t?.maxInTs || null;
  const arrived = r?.packages ?? d.arrivals?.totalShip ?? 0;
  const bipeado = t?.totalConPost ?? 0;
  const hrs = hoursUntil(lastTs, target);
  const required = (fc && hrs > 0) ? Math.max(0, fc - bipeado) / hrs : 0;
  const real = tmsHourlyVelocity(t);
  const diff = arrived - bipeado, pend = fc ? fc - bipeado : 0;
  const last = lastTs ? new Date(lastTs).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }) : '-';
  return `<div class="speed-panel">
    <div class="speed-head"><h3>Velocidad Inhub / Descarga</h3><label>Hora objetivo<input type="time" data-speed-target="${site}" value="${target}"></label></div>
    <table class="speed-table">
      <tr><td>Últ. actualización</td><td>${last}</td><td></td></tr>
      <tr><td>Proyectado</td><td>${fc ? nf.format(fc) : '-'}</td><td>-</td></tr>
      <tr><td>Arribado</td><td>${nf.format(arrived)}</td><td>${fc ? pf.format(pct(arrived, fc)) + '%' : '-'}</td></tr>
      <tr><td>Bipeado</td><td>${nf.format(bipeado)}</td><td>${fc ? pf.format(pct(bipeado, fc)) + '%' : '-'}</td></tr>
      <tr><td>Arribado - Bipeado</td><td class="${diff < 0 ? 'negnum' : 'posnum'}">${diff > 0 ? '+' : ''}${nf.format(diff)}</td><td>${fc ? pf.format(pct(diff, fc)) + '%' : '-'}</td></tr>
      <tr><td>Proyectado - Bipeado</td><td>${fc ? nf.format(pend) : '-'}</td><td>${fc ? pf.format(pct(pend, fc)) + '%' : '-'}</td></tr>
      <tr><td>Velocidad real descarga</td><td><b>${real == null ? '-' : nf.format(Math.round(real))}</b></td><td>pza/h</td></tr>
      <tr><td>Velocidad necesaria a ${target}</td><td class="${real != null && real >= required ? 'speed-ok' : 'speed-bad'}"><b>${fc ? nf.format(Math.ceil(required)) : '-'}</b></td><td>pza/h</td></tr>
      <tr><td>Brecha velocidad</td><td class="${real != null && real - required >= 0 ? 'speed-ok' : 'speed-bad'}"><b>${fc ? (real - required >= 0 ? '+' : '') + nf.format(Math.round(real - required)) : '-'}</b></td><td>pza/h</td></tr>
    </table>
    <div class="speed-note">Registros: solo CHOFER informado · TIPO DE OPERACION = Descarga · Accion = add · se excluyen horas 01 y 02.</div>
  </div>`;
}

export function huInhubMini(site) {
  const d = state.sites[site], t = d.tms, r = d.registros, a = d.arrivals;
  const fc = Number($(site === 'soldati' ? 'fcS' : 'fcE')?.value) || 0;
  const startHour = Math.max(0, Math.min(23, Number(huConfig(site).inhubStartHour ?? 0)));
  const arrivalStart = Math.max(0, Math.min(23, Number(huConfig(site).arrivalStartHour ?? startHour)));
  const arrived = r?.byHour?.length ? r.byHour.reduce((sum, qty, h) => sum + (h >= arrivalStart ? Number(qty || 0) : 0), 0) : (r?.packages ?? a?.totalShip ?? null);
  const bipeado = t ? (t.by?.length ? t.by.reduce((sum, h, i) => sum + (i >= startHour ? Number(h.tot || 0) : 0), 0) : t.totalConPost) : null;
  const last = t?.maxInTs || r?.lastTs || null;
  const clock = last ? new Date(last).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }) : '—';
  const target = state.config.speedTargetTime?.[site] || '22:00';
  const remaining = hoursUntil(last, target);
  const hourly = fc && bipeado !== null && remaining > 0 ? Math.max(0, fc - bipeado) / remaining : null;
  const velocity = tmsHourlyVelocity(t);
  const val = n => n === null ? '—' : nf.format(Math.round(n));
  const percentage = n => fc && n !== null ? pf.format(pct(n, fc)) + '%' : '—';
  const row = (name, n, p) => '<tr><td>' + name + '</td><td>' + val(n) + '</td><td>' + p + '</td></tr>';
  return '<div class="hu-inhub-mini"><h3>Resumen Inhub · Descarga</h3><div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin:8px 0"><label>Inicio arribado <select data-arrival-start="' + site + '">' + Array.from({ length: 24 }, (_, h) => '<option value="' + h + '" ' + (h === arrivalStart ? 'selected' : '') + '>' + String(h).padStart(2, '0') + ':00</option>').join('') + '</select></label><button type="button" class="smallbtn primary" data-arrival-apply="' + site + '">Aplicar arribado</button><small>Independiente del inicio de Inhub y HU</small></div><small>Inicio Inhub: ' + String(startHour).padStart(2, '0') + ':00 · Bipeado filtrado por hora de Inbound Date Included.</small><div class="hu-inhub-time">Últ. actualización <b>' + clock + '</b></div><table class="hu-table compact"><tr><th>Indicador</th><th>Piezas</th><th>% proy.</th></tr>' +
    row('Proyectado', fc || null, fc ? '100,0%' : '—') +
    row('Arribado', arrived, percentage(arrived)) +
    row('Bipeado Inhub', bipeado, percentage(bipeado)) +
    row('Arribado − Bipeado', arrived !== null && bipeado !== null ? arrived - bipeado : null, arrived !== null && bipeado !== null ? percentage(arrived - bipeado) : '—') +
    row('Descarga x hora necesaria (hasta ' + target + ')', Number.isFinite(hourly) ? hourly : null, Number.isFinite(hourly) ? percentage(hourly) : '—') +
    row('Proyectado − Bipeado', fc && bipeado !== null ? fc - bipeado : null, fc && bipeado !== null ? percentage(fc - bipeado) : '—') +
    row('Velocidad real (pza/h)', velocity, '—') + '</table><small>Arribado: ' + (r ? 'Reporte de registros' : a ? 'Arribos' : 'sin fuente') + ' · Bipeado: TMS Inbound Date Included · velocidad: TMS (piezas de la hora actual / minutos desde HH:00). Los datos no disponibles se muestran como —.</small></div>';
}

function bindSpeedTargets() {
  document.querySelectorAll('[data-speed-target]').forEach(el => el.onchange = () => {
    state.config.speedTargetTime[el.dataset.speedTarget] = el.value || '22:00';
    operation();
  });
}

export function operation() {
  const start = state.config.curveStart;
  let h = '', any = false;
  for (const site of ['soldati', 'echeverria']) {
    const d = state.sites[site];
    if (!d.tms && !d.arrivals && !d.registros && !d.labellessStandalone && !d.jornalesResult) continue;
    any = true;
    h += `<article class="card"><h2>${names[site]}</h2>`;
    if (d.tms) h += `<div class="kpi-grid"><div class="kpi"><span>Inhub</span><b>${nf.format(d.tms.totalConPost)}</b></div><div class="kpi"><span>MELI Air % HU</span><b>${pf.format(pct(d.tms.meli.processed, d.tms.meli.arrivals))}%</b></div>${d.files.labelless ? `<div class="kpi"><span>Labelless % HU</span><b>${pf.format(pct(d.tms.labelless.processed, d.tms.labelless.arrived))}%</b></div>` : ''}</div>`;
    h += speedPanel(site);
    if (d.arrivals) h += `<h3>Arribos</h3><div class="kpi-grid"><div class="kpi"><span>Vehículos</span><b>${nf.format(d.arrivals.veh)}</b></div><div class="kpi"><span>Paquetes</span><b>${nf.format(d.arrivals.totalShip)}</b></div><div class="kpi"><span>% Semi</span><b>${pf.format(pct(d.arrivals.semi, d.arrivals.veh))}%</b></div><div class="kpi"><span>% Chasis</span><b>${pf.format(pct(d.arrivals.chasis, d.arrivals.veh))}%</b></div><div class="kpi"><span>% Camioneta</span><b>${pf.format(pct(d.arrivals.camionetaOther ?? d.arrivals.camioneta, d.arrivals.veh))}%</b></div><div class="kpi"><span>% Camioneta MELI</span><b>${pf.format(pct(d.arrivals.camionetaMeli || 0, d.arrivals.veh))}%</b></div></div><div class="cols"><div><h4>Cortes paquetes</h4>${cuts(d.arrivals, start, 'packages')}</div><div><h4>Cortes vehículos</h4>${cuts(d.arrivals, start, 'vehicles')}</div></div>`;
    h += '</article>';
  }
  $('operationView').innerHTML = any ? h : '<article class="card empty">Sin datos.</article>';
  bindSpeedTargets();
}
