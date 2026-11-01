import { $ } from '../core/dom.js';
import { nf, pf, pct, esc } from '../core/formatters.js';
import { state, names } from '../core/state.js';
import { huSeparateAir } from '../domain/tms.js';
import { universe } from '../domain/arrivals.js';

/*--------- CONTROLES DE RANGO HORARIO ---------*/

function curveHourRange(site) {
  const v = state.config.curveHourRanges?.[site] || {};
  const from = Number.isInteger(v.from) ? v.from : Math.max(0, Math.min(23, Number(state.config.curveStart ?? 9)));
  const to = Number.isInteger(v.to) ? v.to : (from + 23) % 24;
  return { from, to, hours: Array.from({ length: (to - from + 24) % 24 + 1 }, (_, i) => (from + i) % 24) };
}

function curveRangeControls(site) {
  const { from, to } = curveHourRange(site);
  const opts = selected => Array.from({ length: 24 }, (_, h) => '<option value="' + h + '"' + (h === selected ? ' selected' : '') + '>' + String(h).padStart(2, '0') + ':00</option>').join('');
  return '<div class="toolbar curve-range" data-curve-range="' + site + '"><strong>Rango horario ED / TMS / vehículos / SPR</strong><label>Desde <select data-range-from>' + opts(from) + '</select></label><label>Hasta <select data-range-to>' + opts(to) + '</select></label><button class="primary" data-apply-curve-range="' + site + '">Aplicar rango</button><button class="secondary" data-reset-curve-range="' + site + '">Restablecer</button></div>';
}

function bindCurveRanges() {
  document.querySelectorAll('[data-apply-curve-range]').forEach(btn => btn.onclick = () => {
    const site = btn.dataset.applyCurveRange, el = document.querySelector('[data-curve-range="' + site + '"]');
    state.config.curveHourRanges ??= {};
    state.config.curveHourRanges[site] = { from: Number(el.querySelector('[data-range-from]').value), to: Number(el.querySelector('[data-range-to]').value) };
    curves();
  });
  document.querySelectorAll('[data-reset-curve-range]').forEach(btn => btn.onclick = () => {
    const site = btn.dataset.resetCurveRange;
    if (state.config.curveHourRanges) delete state.config.curveHourRanges[site];
    curves();
  });
}

/*--------- MATRIZ ED / TMS ---------*/

function operationalHourMatrix(site) {
  const d = state.sites[site], ed = d.registros?.byHour || null, tms = d.tms?.by || null, arr = d.arrivals?.h || d.registros?.vehiclesByHour || null;
  if (!ed && !tms && !arr) return '';
  const hours = curveHourRange(site).hours;
  const values = { ed: [], tms: [], acum: [], share: [], spr: [], vehicles: [] };
  let totalED = 0, totalTMS = 0, totalVeh = 0, acc = 0;
  for (const h of hours) {
    const e = ed ? Number(ed[h] || 0) : null, v = arr ? Number(arr[h]?.veh || 0) : null, n = tms ? Number(tms[h]?.tot || 0) : null;
    totalED += e || 0; totalTMS += n || 0; totalVeh += v || 0;
    values.ed.push(e); values.tms.push(n); values.vehicles.push(v);
    if (n !== null) acc += n;
    values.acum.push(n === null ? null : acc);
    values.spr.push(e !== null && v !== null && v > 0 ? e / v : null);
  }
  let cumulativeED = 0;
  for (const e of values.ed) { if (e !== null) cumulativeED += e; values.share.push(e === null ? null : cumulativeED); }
  const fmt = x => x === null ? '—' : nf.format(Math.round(x));
  const pctFmt = x => x === null ? '—' : x.toLocaleString('es-AR', { minimumFractionDigits: 1, maximumFractionDigits: 2 }) + '%';
  const definitions = [
    ['ED · descargado', 'ed', fmt, totalED, !!ed],
    ['TMS · Inhub', 'tms', fmt, totalTMS, !!tms],
    ['ACUM · TMS', 'acum', fmt, totalTMS, !!tms],
    ['% ED acumulado', 'share', x => pctFmt(totalED ? x / totalED * 100 : null), totalED ? 100 : null, !!ed]
  ];
  return '<section class="hour-matrix"><h3>Control horario · ED / TMS</h3><p class="muted">ACUM · TMS y % ED son acumulados continuos desde la hora inicial configurada. El SPR se presenta en el cuadro de vehículos.</p><div class="hour-matrix-scroll"><table><thead><tr><th>Indicador</th>' + hours.map(h => '<th>' + String(h).padStart(2, '0') + ':00</th>').join('') + '<th>TOTAL</th></tr></thead><tbody>' + definitions.map(([label, key, format, total, available]) => '<tr><th>' + label + '</th>' + hours.map((h, i) => '<td>' + (available ? format(values[key][i]) : '—') + '</td>').join('') + '<td class="matrix-total">' + (available ? (key === 'share' ? pctFmt(total) : key === 'spr' ? total === null ? '—' : total.toLocaleString('es-AR', { maximumFractionDigits: 1 }) : fmt(total)) : '—') + '</td></tr>').join('') + '</tbody></table></div></section>';
}

/*--------- MATRIZ VEHICULOS Y SPR ---------*/

function vehicleSprMatrix(site) {
  const d = state.sites[site], a = d.arrivals, r = d.registros;
  const hours = curveHourRange(site).hours;
  const ed = r?.byHour || null, vehicles = a?.h || r?.vehiclesByHour || null;
  if (!ed && !vehicles) return '';
  const vehValues = hours.map(h => vehicles ? Number(vehicles[h]?.veh || 0) : null);
  const edValues = hours.map(h => ed ? Number(ed[h] || 0) : null);
  const sprValues = hours.map((h, i) => vehValues[i] > 0 && edValues[i] !== null ? edValues[i] / vehValues[i] : null);
  const vTotal = vehValues.reduce((n, x) => n + (x || 0), 0), eTotal = edValues.reduce((n, x) => n + (x || 0), 0);
  const fmt = x => x === null ? '—' : nf.format(Math.round(x));
  const spr = x => x === null ? '—' : x.toLocaleString('es-AR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  const rows = [['Vehículos recibidos', vehValues, fmt, vehicles ? fmt(vTotal) : '—'], ['Paquetes ED', edValues, fmt, ed ? fmt(eTotal) : '—'], ['SPR · pza/veh.', sprValues, spr, vehicles && ed && vTotal ? spr(eTotal / vTotal) : '—']];
  const sourceHours = r?.vehiclesByHour || a?.h || null;
  const typeRows = [['Chasis', 'chasis'], ['Camioneta (incluye MELI)', 'camioneta'], ['Semi', 'semi']];
  const typeMatrix = sourceHours ? '<div class="hour-matrix-scroll" style="margin-top:12px"><table><thead><tr><th>Vehículo / indicador</th>' + hours.map(h => '<th>' + String(h).padStart(2, '0') + ':00</th>').join('') + '<th>TOTAL</th></tr></thead><tbody>' + typeRows.map(([label, key]) => {
    const hourly = hours.map(h => Number(sourceHours[h]?.[key] || 0)); const sum = hourly.reduce((n, x) => n + x, 0);
    let running = 0; const cumulative = hourly.map(x => (running += x));
    const share = cumulative.map(x => sum ? x / sum * 100 : null);
    const pieces = r?.packagesByTypeHour?.[key];
    const hourlySpr = hours.map((h, i) => pieces && hourly[i] > 0 ? Number(pieces[h] || 0) / hourly[i] : null);
    const totalPieces = pieces ? hours.reduce((n, h) => n + Number(pieces[h] || 0), 0) : null;
    const cells = (label, vals, format, total) => '<tr><th>' + label + '</th>' + vals.map(x => '<td>' + format(x) + '</td>').join('') + '<td class="matrix-total">' + total + '</td></tr>';
    return cells(label + ' · arribados', hourly, fmt, fmt(sum)) + cells(label + ' · acumulado', cumulative, fmt, fmt(sum)) + cells(label + ' · % acumulado', share, x => x === null ? '—' : pf.format(x) + '%', sum ? '100,0%' : '—') + cells(label + ' · SPR', hourlySpr, spr, totalPieces !== null && sum ? spr(totalPieces / sum) : '—');
  }).join('') + '</tbody></table></div><p class="muted">Camioneta MELI se incluye en Camioneta. % acumulado = vehículos acumulados del tipo ÷ total de ese tipo en el rango. SPR por tipo = piezas ED asignadas a ese tipo ÷ vehículos del mismo tipo; si no hay desglose de piezas, se muestra —.</p>' : '';
  return '<section class="hour-matrix vehicle-spr-matrix"><h3>Vehículos y SPR por hora</h3><p class="muted">Vehículos: Arribos o registros únicos de Easy Docking (si no hay Arribos). Paquetes: reporte ED. SPR = paquetes ED / vehículos de la misma hora. Sin vehículos disponibles se muestra —; no se usan estimaciones.</p><div class="hour-matrix-scroll"><table><thead><tr><th>Indicador</th>' + hours.map(h => '<th>' + String(h).padStart(2, '0') + ':00</th>').join('') + '<th>TOTAL</th></tr></thead><tbody>' + rows.map(([label, values, format, total]) => '<tr><th>' + label + '</th>' + values.map(x => '<td>' + format(x) + '</td>').join('') + '<td class="matrix-total">' + total + '</td></tr>').join('') + '</tbody></table></div>' + typeMatrix + '</section>';
}

/*--------- DISTRIBUCION DE VEHICULOS ---------*/

function vehicleDistribution(site) {
  const d = state.sites[site], v = d.registros?.vehicleTypes;
  if (!v) return d.arrivals ? vehiclePieFromArrivals(d.arrivals) : '';
  const items = [['Chasis', 'chasis', '#28cda0'], ['Camioneta', 'camioneta', '#ffad18'], ['Semi', 'semi', '#58a6ff'], ['Otros', 'otro', '#9b8bc9']].map(([label, key, color]) => ({ label, color, veh: v[key]?.veh || 0, packages: v[key]?.packages || 0 })).filter(x => x.veh || x.packages);
  const total = items.reduce((a, x) => a + x.veh, 0), packages = items.reduce((a, x) => a + x.packages, 0);
  if (!total) return '';
  let acc = 0; const gradient = items.filter(x => x.veh).map(x => { const from = acc; acc += x.veh / total * 100; return x.color + ' ' + from + '% ' + acc + '%'; }).join(',');
  const labels = items.filter(x => x.veh).map(x => {
    const angle = (items.filter(y => y.veh).slice(0, items.indexOf(x)).reduce((n, y) => n + y.veh, 0) + x.veh / 2) / total * Math.PI * 2 - Math.PI / 2;
    const px = 50 + 36 * Math.cos(angle), py = 50 + 36 * Math.sin(angle), right = Math.cos(angle) >= 0;
    const x2 = 50 + 49 * Math.cos(angle), y2 = 50 + 49 * Math.sin(angle);
    const x3 = right ? 96 : 4; const y3 = Math.max(8, Math.min(92, y2));
    return '<div class="vehicle-dist-label" style="--label-color:' + x.color + ';left:' + x3 + '%;top:' + y3 + '%;transform:translate(' + (right ? '0' : '-100%') + ',-50%)"><b>' + nf.format(x.veh) + '</b><span>' + (x.veh / total * 100).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + '%</span></div><svg class="vehicle-dist-leader" viewBox="0 0 100 100" preserveAspectRatio="none"><path d="M ' + px + ' ' + py + ' L ' + x2 + ' ' + y2 + ' L ' + x3 + ' ' + y3 + '" stroke="' + x.color + '" stroke-width=".5" fill="none" vector-effect="non-scaling-stroke"/><circle cx="' + px + '" cy="' + py + '" r="1" fill="' + x.color + '"/></svg>';
  }).join('');
  return '<section class="vehicle-dist"><div class="vehicle-dist-heading"><div><h3>Distribución por tipo de vehículo</h3><p class="muted">Vehículos y paquetes recibidos por tipo · Easy Docking</p></div><div class="vehicle-dist-summary"><b>' + nf.format(total) + '</b> vehículos <span>·</span> <b>' + nf.format(packages) + '</b> piezas</div></div><div class="vehicle-dist-layout"><div class="vehicle-dist-chart"><div class="vehicle-dist-pie" style="background:conic-gradient(' + gradient + ')"><div>' + nf.format(total) + '<small>vehículos</small></div></div>' + labels + '</div><div class="vehicle-dist-cards">' + items.map(x => '<div class="vehicle-dist-card" style="--vehicle-color:' + x.color + '"><div class="vehicle-dist-card-top"><b><i></i>' + x.label + '</b><strong>' + (x.veh / total * 100).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + '%</strong></div><div class="vehicle-dist-card-stats"><span>VEHÍCULOS <b>' + nf.format(x.veh) + '</b></span><span>PIEZAS RECIBIDAS <b>' + nf.format(x.packages) + '</b><em>' + (packages ? x.packages / packages * 100 : 0).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + '% de piezas</em></span></div></div>').join('') + '<div class="vehicle-dist-total">TOTAL · ' + nf.format(total) + ' vehículos · ' + nf.format(packages) + ' piezas</div></div></div></section>';
}

function vehiclePieFromArrivals(a) {
  if (!a?.ok) return '';
  const cm = a.camionetaMeli || 0, co = a.camionetaOther ?? Math.max(0, (a.camioneta || 0) - cm);
  const items = [['Semi', a.semi || 0, '#1769aa'], ['Chasis', a.chasis || 0, '#20a477'], ['Camioneta', co, '#f3a23c'], ['Camioneta MELI', cm, '#865ac2']];
  const total = items.reduce((s, x) => s + Math.max(0, x[1]), 0);
  if (!total) return '';
  const colors = items.map(x => x[2]);
  let cumulative = 0;
  const stops = items.map((x, i) => { const start = cumulative; cumulative += total ? Math.max(0, x[1]) / total * 100 : 0; return colors[i] + ' ' + start + '% ' + cumulative + '%'; }).join(',');
  return '<section class="vehicle-dist"><div class="vehicle-dist-heading"><div><h3>Distribución por tipo de vehículo</h3><p class="muted">Participación de vehículos · Arribos</p></div></div><div class="vehicle-dist-layout"><div class="vehicle-dist-chart"><div class="vehicle-dist-pie" style="background:conic-gradient(' + stops + ')"><div>' + nf.format(total) + '<small>vehículos</small></div></div></div><div class="vehicle-dist-cards">' + items.filter(x => x[1] > 0).map(x => '<div class="vehicle-dist-card" style="--vehicle-color:' + x[2] + '"><div class="vehicle-dist-card-top"><b><i></i>' + x[0] + '</b><strong>' + pf.format(pct(x[1], total)) + '%</strong></div><div class="vehicle-dist-card-stats"><span>VEHÍCULOS <b>' + nf.format(x[1]) + '</b></span></div></div>').join('') + '</div></div></section>';
}

/*--------- CURVA ARRIBADO VS TMS ---------*/

function flowCurve(d, start) {
  if (!d.tms || !d.registros) return '';
  const rows = []; let arAc = 0, inAc = 0;
  for (let h = start; h < 24; h++) { const ar = d.registros.byHour?.[h] || 0, inh = d.tms.by?.[h]?.tot || 0; arAc += ar; inAc += inh; rows.push({ h, ar, inh, arAc, inAc }); }
  const max = Math.max(1, ...rows.flatMap(x => [x.ar, x.inh]));
  const W = Math.max(900, rows.length * 85), H = 290, left = 40, right = 36, top = 35, bottom = 48, plotW = W - left - right, plotH = H - top - bottom;
  const xx = i => left + (rows.length === 1 ? 0.5 : i / (rows.length - 1)) * plotW;
  const yy = n => top + plotH - (n / max) * plotH;
  const points = key => rows.map((x, i) => xx(i) + ',' + yy(x[key])).join(' ');
  const series = (key, color, shift) => rows.map((x, i) => {
    const xPos = xx(i), yPos = yy(x[key]), textY = Math.max(12, Math.min(H - bottom - 12, yPos + shift));
    return '<circle cx="' + xPos + '" cy="' + yPos + '" r="3.5" fill="' + color + '" stroke="#101e34" stroke-width="1.5"><title>' + String(x.h).padStart(2, '0') + ':00 · ' + (key === 'ar' ? 'ED' : 'TMS') + ': ' + nf.format(x[key]) + '</title></circle><text x="' + xPos + '" y="' + textY + '" text-anchor="middle" font-size="10" font-weight="700" fill="' + color + '">' + nf.format(x[key]) + '</text>';
  }).join(' ');
  const labels = rows.map((x, i) => '<text x="' + xx(i) + '" y="' + (H - 17) + '" text-anchor="middle" font-size="11" fill="#a6b9d6">' + String(x.h).padStart(2, '0') + ':00</text>').join(' ');
  return '<div class="flow-curve"><div class="flow-title"><div><h3>Arribado vs Ingresado TMS por hora</h3><small>ED = Reporte de Registros · TMS = Inbound Date Included. Valores visibles en cada punto.</small></div><div class="flow-legend"><span class="flow-arr">● Arribado ED</span><span class="flow-in">● Ingresado TMS</span></div></div><div class="flow-point-scroll"><svg class="flow-point-svg" viewBox="0 0 ' + W + ' ' + H + '" width="' + W + '" height="' + H + '" role="img" aria-label="Curva horaria de arribado e ingresado con cantidades en cada punto"><line x1="' + left + '" y1="' + (top + plotH) + '" x2="' + (W - right) + '" y2="' + (top + plotH) + '" stroke="#64748b"/><polyline points="' + points('ar') + '" fill="none" stroke="#2996ee" stroke-width="2.5"/><polyline points="' + points('inh') + '" fill="none" stroke="#20a783" stroke-width="2.5"/>' + series('ar', '#55b6ff', -12) + series('inh', '#43d5aa', 18) + labels + '</svg></div><div class="scroll"><table><tr><th>Hora</th><th>Arribado ED</th><th>Ingresado TMS</th><th>Brecha hora</th><th>Arribado acum.</th><th>TMS acum.</th><th>Brecha acum.</th></tr>' + rows.map(x => '<tr><td>' + String(x.h).padStart(2, '0') + ':00</td><td>' + nf.format(x.ar) + '</td><td>' + nf.format(x.inh) + '</td><td>' + nf.format(x.ar - x.inh) + '</td><td>' + nf.format(x.arAc) + '</td><td>' + nf.format(x.inAc) + '</td><td>' + nf.format(x.arAc - x.inAc) + '</td></tr>').join('') + '</table></div></div>';
}

/*--------- TABLAS HU Y ARRIBOS ---------*/

function huHourlyTable(t) {
  const vals = (t.hu?.byHour || []).map((v, h) => ({ h, v })).filter(x => x.v > 0);
  if (!vals.length) return '<div class="hu-empty">Sin bipeos HU por hora para la fecha seleccionada.</div>';
  const total = vals.reduce((s, x) => s + x.v, 0), prom = (total + total) / (vals.length + 1), max = Math.max(...vals.map(x => x.v), 1);
  return '<div class="hu-bipe-grid"><div><table class="hu-table compact"><tr><th>Hora</th><th>HU / piezas</th></tr>' + vals.map(x => '<tr><td>' + x.h + '</td><td>' + nf.format(x.v) + '</td></tr>').join('') + '<tr class="total"><td>Total general</td><td>' + nf.format(total) + '</td></tr></table></div><div><div class="hu-prom"><span>Promedio produc. total</span><b>' + nf.format(Math.round(prom)) + '</b></div></div></div><div class="hu-bars">' + vals.map(x => '<div class="hu-bar-item"><span>' + x.h + '</span><div class="hu-bar-track"><i style="height:' + Math.max(3, pct(x.v, max)) + '%"></i></div><b>' + nf.format(x.v) + '</b></div>').join('') + '</div>';
}

function arrTable(a, start) {
  const u = universe(a, start); let cp = 0, cv = 0, r = '';
  for (let h = start; h <= 23; h++) { cp += a.h[h].ship; cv += a.h[h].veh; r += '<tr><td>' + h + ':00</td><td>' + nf.format(a.h[h].ship) + '</td><td>' + nf.format(cp) + '</td><td>' + pf.format(pct(cp, u.packages)) + '%</td><td>' + nf.format(a.h[h].veh) + '</td><td>' + nf.format(cv) + '</td><td>' + pf.format(pct(cv, u.vehicles)) + '%</td></tr>'; }
  return '<div class="scroll"><table><tr><th>Hora</th><th>Paquetes</th><th>Paq. acum.</th><th>% paq.</th><th>Veh.</th><th>Veh. acum.</th><th>% veh.</th></tr>' + r + '</table></div>';
}

function vehicleShareTable(a) {
  if (!a?.ok) return '';
  const cm = a.camionetaMeli || 0, co = a.camionetaOther ?? Math.max(0, (a.camioneta || 0) - cm);
  const rows = [['Semi', a.semi || 0], ['Chasis', a.chasis || 0], ['Camioneta', co], ['Camioneta MELI', cm]];
  return '<div class="vehicle-share"><h4>Participación por tipo de unidad</h4><table><tr><th>Unidad</th><th>Q</th><th>%</th></tr>' + rows.map(([u, n]) => '<tr><td>' + u + '</td><td>' + nf.format(n) + '</td><td>' + pf.format(pct(n, a.veh)) + '%</td></tr>').join('') + '<tr><td><b>Total vehículos</b></td><td><b>' + nf.format(a.veh) + '</b></td><td><b>100,0%</b></td></tr></table></div>';
}

export function curves() {
  const start = state.config.curveStart;
  let h = '';
  for (const site of ['soldati', 'echeverria']) {
    const d = state.sites[site];
    if (!d.tms && !d.arrivals && !d.registros) continue;
    h += '<article class="card curves-site"><h2>' + names[site] + '</h2>' +
      curveRangeControls(site) +
      '<div class="curves-matrices">' + operationalHourMatrix(site) + vehicleSprMatrix(site) + '</div>' +
      vehicleDistribution(site) +
      flowCurve(d, curveHourRange(site).from) +
      (d.tms?.hu ? '<section class="hu-hourly-moved"><h3>Bipeo HU por hora · ' + names[site] + '</h3>' + huHourlyTable(huSeparateAir(d.tms).normal) + '</section>' : '') +
      (d.arrivals ? '<section class="curves-arrivals"><h3>Detalle de arribos · ' + names[site] + '</h3>' + arrTable(d.arrivals, start) + vehicleShareTable(d.arrivals) + '</section>' : '') +
      '</article>';
  }
  $('curvesView').innerHTML = h || '<article class="card empty">Sin datos.</article>';
  bindCurveRanges();
}
