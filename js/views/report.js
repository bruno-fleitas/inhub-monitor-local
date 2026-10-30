import { $ } from '../core/dom.js';
import { nf, pf, pct, esc } from '../core/formatters.js';
import { state, names } from '../core/state.js';
import { huConfig } from '../core/config.js';
import { hoursUntil, hoursToTarget } from '../core/time.js';
import { huCptRows, huActiveUsers, huSeparateAir, huPct, dotData, dotTarget } from '../domain/tms.js';
import { cut } from '../domain/arrivals.js';

function reportSiteData(site) {
  const d = state.sites[site], t = d.tms, a = d.arrivals, q = d.jornalesResult, r = d.registros, lab = d.files.labelless ? (t?.labelless || d.labellessStandalone) : null, fc = Number($(site === 'soldati' ? 'fcS' : 'fcE')?.value) || 0;
  if (!t && !a && !q && !r && !lab) return null;
  const pure = t ? Math.max(0, t.vol - t.big - t.sb) : 0, base = t ? Math.max(0, t.totalConPost - t.big - t.sb) : 0;
  let hu = null;
  if (t?.hu) {
    const normal = huSeparateAir(t).normal, z = normal.hu.totals || {}, hc = huConfig(site), users = huActiveUsers(site, normal), cpts = huCptRows(site, normal), active = hc.connectedMode === 'byCpt' ? cpts.reduce((s, x) => s + x.users.size, 0) : new Set(users.map(x => x.user)).size, hrs = hoursToTarget(normal.hu.maxOutTs, hc.targetTime), remaining = fc > 0 ? Math.max(0, Math.ceil(fc * Number(hc.targetPct ?? 65) / 100) - z.abierto - z.cerrado) : null, need = remaining === null || hrs <= 0 ? null : Math.ceil(remaining / hrs / Math.max(1, hc.prod));
    hu = { ...z, avance: z.etiquetado ? pct(z.abierto + z.cerrado, z.etiquetado) : 0, active, need, gap: need === null ? null : active - need, target: hc.targetTime, cpts: cpts.map(x => ({ ...x, avance: huPct(x) })) };
  }
  const target = state.config.speedTargetTime?.[site] || '22:00', last = r?.lastTs || t?.maxInTs || null, hrs = hoursUntil(last, target), req = fc && t && hrs > 0 ? Math.max(0, fc - t.totalConPost) / hrs : 0;
  return { site, name: names[site], fc, t, a, q, r, lab, pure, base, hu, speed: { target, real: r?.currentSpeed ?? null, required: req || null, last } };
}

function reportData() {
  return ['soldati', 'echeverria'].map(reportSiteData).filter(Boolean);
}

function reportAlerts(x) {
  const out = [];
  if (x.t && x.fc) { const p = pct(x.t.totalConPost, x.fc); out.push('Inhub ' + pf.format(p) + '% del proyectado.'); }
  if (x.hu) {
    out.push('HU ' + pf.format(x.hu.avance) + '% · ' + nf.format(x.hu.pendiente) + ' pendientes · brecha de dotación ' + (x.hu.gap >= 0 ? '+' : '') + nf.format(x.hu.gap) + '.');
    const bad = x.hu.cpts.filter(z => z.avance < huConfig(x.site).cptObjective).sort((a, b) => a.avance - b.avance).slice(0, 3);
    if (bad.length) out.push('CPT comprometidos: ' + bad.map(z => z.cpt + ' (' + pf.format(z.avance) + '%)').join(', ') + '.');
  }
  if (x.t) {
    const dd = dotData(x.site, x.t), tt = dd.groups.reduce((a, g) => { a.total += g.total; a.onTime += g.onTime; return a; }, { total: 0, onTime: 0 }), v = tt.total ? pct(tt.onTime, tt.total) : 0;
    out.push('DOT ' + pf.format(v) + '% vs objetivo ' + pf.format(dotTarget(x.site).objective) + '% (' + (v - dotTarget(x.site).objective >= 0 ? '+' : '') + pf.format(v - dotTarget(x.site).objective) + ' pp).');
  }
  if (x.speed.real != null && x.speed.required != null) out.push('Velocidad real ' + nf.format(Math.round(x.speed.real)) + ' vs necesaria ' + nf.format(Math.ceil(x.speed.required)) + ' pza/h.');
  return out;
}

export function reportPreview() {
  const data = reportData(), host = $('reportView'); if (!host) return;
  if (!data.length) { host.innerHTML = '<div class="empty">Procesá uno o más archivos para generar el reporte.</div>'; return; }
  const percent = n => pf.format(n) + '%';
  const getPlan = (site, type, fallback = 0) => { const raw = localStorage.getItem('inhubReportPlan_' + site + '_' + type); return raw === null ? fallback : Math.max(0, Number(raw) || 0); };
  const windows = [['pre14', 14], ['pre16', 16], ['pre17', 17], ['pre18', 18], ['post20', 20]];
  const reportRange = site => { const rawA = localStorage.getItem('inhubReportRangeFrom_' + site), rawB = localStorage.getItem('inhubReportRangeTo_' + site), a = rawA === null ? 9 : Number(rawA), b = rawB === null ? 22 : Number(rawB); return { from: Number.isInteger(a) && a >= 0 && a <= 23 ? a : 9, to: Number.isInteger(b) && b >= 0 && b <= 23 ? b : 22 }; };
  const hourOptions = selected => Array.from({ length: 24 }, (_, h) => '<option value="' + h + '"' + (h === selected ? ' selected' : '') + '>' + String(h).padStart(2, '0') + ':00</option>').join('');
  const getStart = site => { const raw = localStorage.getItem('inhubReportStart_' + site); const n = raw === null ? 9 : Number(raw); return Number.isInteger(n) && n >= 0 && n <= 13 ? n : 9; };
  const hourCount = (series, limit, kind, startHour) => { if (!series) return null; const hours = kind === 'post' ? Array.from({ length: 13 }, (_, i) => (20 + i) % 24) : Array.from({ length: Math.max(0, limit - startHour) }, (_, i) => i + startHour); return hours.reduce((sum, h) => sum + (Number(series[h]?.veh ?? series[h] ?? 0) || 0), 0); };
  host.innerHTML = '<div class="report-sites">' + data.map(x => {
    const r = x.r, t = x.t, hu = x.hu, source = r?.vehiclesByHour || x.a?.h;
    const vehicleTypes = [['Chasis', 'chasis'], ['Camioneta', 'camioneta'], ['Semi', 'semi']];
    const vehTotals = vehicleTypes.map(([label, key]) => ({ label, n: source ? source.reduce((sum, h) => sum + Number(h?.[key] || 0), 0) : 0 }));
    const vehSum = source ? source.reduce((sum, h) => sum + Number(h?.veh || 0), 0) : 0;
    const ed = r?.byHour || null, projected = x.fc;
    const packagePlan = getPlan(x.site, 'packages', projected);
    const startHour = getStart(x.site);
    const range = reportRange(x.site);
    const rangeHours = Array.from({ length: (range.to - range.from + 24) % 24 + 1 }, (_, i) => (range.from + i) % 24);
    const vehiclePlan = vehSum;
    const pure = t ? Math.max(0, t.vol - t.big - t.sb) : null;
    const cards = [];
    const add = (label, value, detail = '') => cards.push('<div class="report-kpi"><span>' + label + '</span><b>' + value + '</b>' + (detail ? '<small>' + detail + '</small>' : '') + '</div>');
    add('Total vehículos ingresados', source ? nf.format(vehSum) : '—');
    if (t) { add('Inhub', nf.format(t.totalConPost), packagePlan ? percent(pct(t.totalConPost, packagePlan)) + ' del proyectado' : ''); add('Voluminoso sin B/SB', percent(pct(pure, t.totalConPost))); add('Voluminoso con B/SB', percent(pct(t.vol, t.totalConPost))); }
    if (hu) add('Avance HU', percent(hu.avance), nf.format(hu.pendiente) + ' pendientes');
    if (r || x.a) add('SPR general', r?.vehicles && r?.packages ? nf.format(Math.round(r.packages / r.vehicles)) + ' pza/veh.' : '—', 'Paquetes ED / vehículos de Registros');
    if (source) vehTotals.forEach(v => add(v.label, nf.format(v.n), percent(pct(v.n, vehSum)) + ' de ' + nf.format(vehSum) + ' vehículos'));
    const huTable = hu ? '<div class="report-detail"><h4>Armado de HU · General (sin MELI Air)</h4><div class="hour-matrix-scroll"><table class="report-compact-table"><thead><tr><th>CPT</th><th>Etiquetado</th><th>HU abierto</th><th>HU cerrado</th><th>Pend. HU</th><th>% Avance</th><th>% Share</th><th>Users activos</th></tr></thead><tbody>' + hu.cpts.map(c => '<tr><td>' + esc(c.cpt) + '</td><td>' + nf.format(c.etiquetado) + '</td><td>' + nf.format(c.abierto) + '</td><td>' + nf.format(c.cerrado) + '</td><td>' + nf.format(c.pendiente) + '</td><td>' + percent(c.avance) + '</td><td>' + percent(pct(c.etiquetado, hu.etiquetado)) + '</td><td>' + c.users.size + '</td></tr>').join('') + '<tr><th>Total</th><th>' + nf.format(hu.etiquetado) + '</th><th>' + nf.format(hu.abierto) + '</th><th>' + nf.format(hu.cerrado) + '</th><th>' + nf.format(hu.pendiente) + '</th><th>' + percent(hu.avance) + '</th><th>100%</th><th>' + hu.active + '</th></tr></tbody></table></div></div>' : '';
    const table = (title, series, plan, type) => { if (!series) return '<div class="report-detail"><h4>' + title + '</h4><p class="muted">Cargá los datos correspondientes para ver los cortes.</p></div>'; return '<div class="report-detail"><h4>' + title + '</h4><table class="report-compact-table"><thead><tr><th>Corte</th><th>Ingresado</th><th>' + (type === 'vehicles' ? '% del total' : '% del proyectado') + '</th></tr></thead><tbody>' + windows.map(([label, h]) => { const n = hourCount(series, h, label === 'post20' ? 'post' : 'pre', startHour); return '<tr><th>' + label + '</th><td>' + nf.format(n) + '</td><td>' + (plan > 0 ? percent(pct(n, plan)) : (type === 'vehicles' ? 'Sin vehículos' : 'Definir proyectado')) + '</td></tr>'; }).join('') + '</tbody></table></div>'; };
    const hourly = (title, series, key) => { if (!series) return ''; let accum = 0; const vals = rangeHours.map(h => { const item = series[h]; const n = Number(key === 'veh' ? item?.veh : key === 'packages' ? item : item?.[key]) || 0; accum += n; return { h, n, accum }; }); const total = accum; return '<div class="report-detail"><h4>' + title + ' · ' + String(range.from).padStart(2, '0') + ':00 a ' + String(range.to).padStart(2, '0') + ':59</h4><div class="hour-matrix-scroll"><table class="report-compact-table"><thead><tr><th>Hora</th><th>Ingresado</th><th>Acumulado</th><th>% del rango</th></tr></thead><tbody>' + vals.map(v => '<tr><td>' + String(v.h).padStart(2, '0') + ':00</td><td>' + nf.format(v.n) + '</td><td>' + nf.format(v.accum) + '</td><td>' + (total ? percent(pct(v.accum, total)) : '—') + '</td></tr>').join('') + '<tr><th>TOTAL</th><th>' + nf.format(total) + '</th><th>' + nf.format(total) + '</th><th>' + (total ? '100%' : '—') + '</th></tr></tbody></table></div></div>'; };
    const plans = '<div class="report-detail"><h4>Base de cálculo · cortes horarios</h4><div style="display:flex;flex-wrap:wrap;gap:16px;align-items:end"><label class="report-projection">Proyectado paquetes <input type="number" min="0" step="1" data-report-plan="packages" data-report-site="' + x.site + '" value="' + (packagePlan || '') + '" placeholder="Ingresar paquetes"></label><div class="report-projection"><span>Total real de vehículos</span><strong>' + (source ? nf.format(vehSum) : 'Sin datos') + '</strong></div><label class="report-projection">Inicio PRE <select data-report-start="' + x.site + '">' + Array.from({ length: 14 }, (_, h) => '<option value="' + h + '"' + (h === startHour ? ' selected' : '') + '>' + String(h).padStart(2, '0') + ':00</option>').join('') + '</select></label></div><small>PRE: acumulado desde las ' + String(startHour).padStart(2, '0') + ':00 hasta antes del horario indicado. POST20: desde las 20:00 hasta antes de las 09:00 del día siguiente. Paquetes ÷ proyectado; vehículos ÷ total real.</small></div>';
    const rangePanel = '<div class="report-detail"><h4>Curvas por rango horario · Registros descarga</h4><div style="display:flex;flex-wrap:wrap;gap:14px;align-items:end;justify-content:center"><label class="report-projection">Desde <select data-report-range-from="' + x.site + '">' + hourOptions(range.from) + '</select></label><label class="report-projection">Hasta <select data-report-range-to="' + x.site + '">' + hourOptions(range.to) + '</select></label></div><small>Acumulados y porcentajes calculados sobre el total del rango seleccionado. Los cortes PRE y POST20 anteriores conservan su propia definición.</small></div>';
    const typeTables = source ? [['Chasis', 'chasis'], ['Camioneta', 'camioneta'], ['Semi', 'semi']].map(([label, key]) => hourly('Vehículos ' + label, source, key)).join('') : '';
    return '<section class="report-site"><h3>' + x.name + '</h3>' + plans + '<div class="report-kpis">' + cards.join('') + '</div>' + table('Paquetes · Registros descarga', ed, packagePlan, 'packages') + table('Vehículos · Arribos', source, vehiclePlan, 'vehicles') + rangePanel + hourly('Paquetes ED · hora y acumulado', ed, 'packages') + hourly('Vehículos · hora y acumulado', source, 'veh') + typeTables + huTable + '</section>';
  }).join('') + '</div>';
  host.querySelectorAll('[data-report-range-from], [data-report-range-to]').forEach(el => el.addEventListener('change', () => { const site = el.dataset.reportRangeFrom || el.dataset.reportRangeTo; localStorage.setItem('inhubReportRange' + (el.dataset.reportRangeFrom ? 'From_' : 'To_') + site, el.value); reportPreview(); }));
  host.querySelectorAll('[data-report-start]').forEach(input => input.addEventListener('change', () => { localStorage.setItem('inhubReportStart_' + input.dataset.reportStart, input.value); reportPreview(); }));
  host.querySelectorAll('[data-report-plan]').forEach(input => input.addEventListener('change', () => { const n = Number(input.value); if (!Number.isFinite(n) || n < 0) { alert('Ingresá un proyectado válido.'); return; } localStorage.setItem('inhubReportPlan_' + input.dataset.reportSite + '_' + input.dataset.reportPlan, String(n)); reportPreview(); }));
}

// ── PowerPoint export ──

let pptPromise = null;

function loadPptx() {
  if (window.PptxGenJS) return Promise.resolve();
  if (pptPromise) return pptPromise;
  pptPromise = new Promise((ok, ko) => {
    const urls = ['https://cdn.jsdelivr.net/npm/pptxgenjs@4.0.1/dist/pptxgen.bundle.js', 'https://cdnjs.cloudflare.com/ajax/libs/pptxgenjs/3.12.0/pptxgen.bundle.js'];
    let i = 0; const next = () => { if (i >= urls.length) return ko(new Error('No se pudo cargar el generador PowerPoint.')); const s = document.createElement('script'); s.src = urls[i++]; s.onload = () => window.PptxGenJS ? ok() : next(); s.onerror = next; document.head.appendChild(s); }; next();
  });
  return pptPromise;
}

export async function exportPpt() {
  const data = reportData(); if (!data.length) throw new Error('No hay resultados procesados para exportar.');
  await loadPptx(); const p = new PptxGenJS(); p.layout = 'LAYOUT_WIDE'; p.author = 'OCASA'; p.company = 'OCASA'; p.subject = 'Resumen operativo Inhub'; p.title = 'Resumen de jornada Inhub';
  const C = { navy: '132238', blue: '1F5E8C', cyan: '27A7C7', orange: 'F59E0B', green: '159A68', red: 'C94848', ink: '1C2734', muted: '667085', pale: 'F4F7FA', white: 'FFFFFF', line: 'D9E2EC' };
  const addText = (s, txt, x, y, w, h, opt = {}) => s.addText(String(txt ?? ''), { x, y, w, h, fontFace: 'Aptos', fontSize: opt.size || 12, bold: !!opt.bold, color: opt.color || C.ink, margin: 0, breakLine: false, valign: opt.valign || 'mid', align: opt.align || 'center', fit: 'shrink' });
  const chrome = (title, sub = '') => { const s = p.addSlide(); s.background = { color: C.white }; s.addShape(p.ShapeType.rect, { x: 0, y: 0, w: 13.333, h: .18, fill: { color: C.cyan }, line: { color: C.cyan } }); addText(s, title, .55, .38, 9.8, .48, { size: 25, bold: true, color: C.navy }); if (sub) addText(s, sub, .55, .92, 11.8, .32, { size: 10, color: C.muted }); addText(s, 'INHUB · Resumen operativo', 10.65, .42, 2.1, .3, { size: 9, bold: true, color: C.blue, align: 'right' }); return s; };
  const card = (s, x, y, w, label, val, sub = '') => { s.addShape(p.ShapeType.roundRect, { x, y, w, h: 1.12, rectRadius: .08, fill: { color: C.pale }, line: { color: C.line, width: 1 } }); addText(s, label, x + .14, y + .12, w - .28, .22, { size: 9, color: C.muted }); addText(s, val, x + .14, y + .38, w - .28, .38, { size: 20, bold: true, color: C.navy }); if (sub) addText(s, sub, x + .14, y + .82, w - .28, .18, { size: 8, color: C.muted }); };
  const date = state.config.analysisDate || new Date().toLocaleDateString('es-AR');
  { const s = p.addSlide(); s.background = { color: C.navy }; addText(s, 'INFORME GERENCIAL', .75, 1.55, 7.8, .55, { size: 30, bold: true, color: C.white }); addText(s, 'RESUMEN DE JORNADA INHUB', .75, 2.15, 10.8, .7, { size: 34, bold: true, color: C.cyan }); addText(s, date + ' · Soldati / Esteban Echeverría', .78, 3.05, 8, .35, { size: 15, color: 'D8E5EF' }); addText(s, 'Generado desde Inhub Monitor Local', .78, 6.55, 5, .3, { size: 10, color: 'AFC4D5' }); }
  for (const x of data) {
    { const s = chrome(x.name + ' · Resumen ejecutivo', 'Estado general de la jornada con la información disponible.');
      const cards = []; if (x.t) cards.push(['Inhub', nf.format(x.t.totalConPost), x.fc ? pf.format(pct(x.t.totalConPost, x.fc)) + '% forecast' : ''], ['Voluminoso', pf.format(pct(x.t.vol, x.t.totalConPost)) + '%', 'c/Bigger + SuperBigger']); if (x.hu) cards.push(['Avance HU', pf.format(x.hu.avance) + '%', nf.format(x.hu.pendiente) + ' pendientes'], ['Conectados / necesarios', x.hu.active + ' / ' + x.hu.need, 'brecha ' + (x.hu.gap >= 0 ? '+' : '') + x.hu.gap]); if (x.speed.real != null) cards.push(['Velocidad real', nf.format(Math.round(x.speed.real)) + ' pza/h', x.speed.required != null ? 'necesaria ' + nf.format(Math.ceil(x.speed.required)) : '']); if (x.q) cards.push(['Jornales', nf.format(x.q.total), pf.format(pct(x.q.c, x.q.total)) + '% antiguos']);
      cards.slice(0, 6).forEach((z, i) => card(s, .55 + (i % 3) * 4.18, 1.55 + Math.floor(i / 3) * 1.42, 3.82, ...z));
      addText(s, 'Alertas / lectura ejecutiva', .65, 4.65, 4, .3, { size: 14, bold: true, color: C.blue }); addText(s, reportAlerts(x).map(v => '• ' + v).join('\n'), .65, 5.02, 11.9, 1.45, { size: 12, color: C.ink, valign: 'top' });
    }
    if (x.t) { const s = chrome(x.name + ' · Mix y especiales', 'Composición del Inhub y cumplimiento de flujos especiales.'); const vals = [['Vol. c/B+SB', nf.format(x.t.vol), pf.format(pct(x.t.vol, x.t.totalConPost)) + '%'], ['Vol. s/B+SB', nf.format(x.pure), pf.format(pct(x.pure, x.base)) + '%'], ['Bigger', nf.format(x.t.big), ''], ['SuperBigger', nf.format(x.t.sb), ''], ['MELI Air', pf.format(pct(x.t.meli.processed, x.t.meli.arrivals)) + '%', nf.format(x.t.meli.processed) + ' / ' + nf.format(x.t.meli.arrivals)], ['Labelless', x.lab?.processed != null ? pf.format(pct(x.lab.processed, x.lab.arrived)) + '%' : '-', x.lab?.processed != null ? nf.format(x.lab.processed) + ' / ' + nf.format(x.lab.arrived) : 'sin cruce']]; vals.forEach((z, i) => card(s, .55 + (i % 3) * 4.18, 1.55 + Math.floor(i / 3) * 1.48, 3.82, ...z)); }
    if (x.hu) { const s = chrome(x.name + ' · Control HU', 'Objetivo ' + x.hu.target + ' · seguimiento de CPT y recursos.'); [['Etiquetado', x.hu.etiquetado], ['HU abierto', x.hu.abierto], ['HU cerrado', x.hu.cerrado], ['Pendiente', x.hu.pendiente]].forEach((z, i) => card(s, .55 + i * 3.12, 1.45, 2.82, z[0], nf.format(z[1]))); addText(s, 'CPT con menor avance', .6, 3.0, 4, .3, { size: 14, bold: true, color: C.blue }); const bad = x.hu.cpts.slice().sort((a, b) => a.avance - b.avance).slice(0, 8); const rows = [[{ text: 'CPT', options: { bold: true } }, { text: 'Avance', options: { bold: true } }, { text: 'Pendiente', options: { bold: true } }, { text: 'Conectados', options: { bold: true } }], ...bad.map(z => [String(z.cpt), pf.format(z.avance) + '%', nf.format(z.pendiente), String(z.users.size)])]; s.addTable(rows, { x: .6, y: 3.42, w: 7.0, h: 2.7, border: { type: 'solid', color: C.line, pt: 1 }, fontFace: 'Aptos', fontSize: 10, color: C.ink, fill: C.white, margin: .06, rowH: .3 }); card(s, 8.15, 3.42, 2.0, 'Conectados', x.hu.active); card(s, 10.35, 3.42, 2.0, 'Necesarios', x.hu.need); card(s, 8.15, 4.82, 4.2, 'Brecha', (x.hu.gap >= 0 ? '+' : '') + x.hu.gap, x.hu.gap >= 0 ? 'capacidad suficiente' : 'requiere refuerzo'); }
    if (x.a || x.r) { const s = chrome(x.name + ' · Arribos y velocidad', 'Seguimiento de descarga e ingreso al Inhub.'); if (x.a) { card(s, .55, 1.5, 2.8, 'Vehículos', nf.format(x.a.veh)); card(s, 3.55, 1.5, 2.8, 'Paquetes arribos', nf.format(x.a.totalShip)); card(s, 6.55, 1.5, 2.8, 'Pre 20 paquetes', pf.format(cut(x.a, state.config.curveStart, 20, 'packages')) + '%'); card(s, 9.55, 1.5, 2.8, 'Post 20 paquetes', pf.format(100 - cut(x.a, state.config.curveStart, 20, 'packages')) + '%'); } if (x.r) { card(s, .55, 3.15, 3.6, 'Velocidad real', nf.format(Math.round(x.speed.real || 0)) + ' pza/h'); card(s, 4.35, 3.15, 3.6, 'Necesaria a ' + x.speed.target, x.speed.required != null ? nf.format(Math.ceil(x.speed.required)) + ' pza/h' : '-'); card(s, 8.15, 3.15, 4.2, 'Brecha velocidad', x.speed.required != null ? (Math.round(x.speed.real - x.speed.required) >= 0 ? '+' : '') + nf.format(Math.round(x.speed.real - x.speed.required)) + ' pza/h' : '-'); } }
    if (x.q) { const s = chrome(x.name + ' · Dotación / Jornales', 'Composición de antigüedad de la dotación analizada.'); [['Jornales', x.q.total, ''], ['Nuevo -' + x.q.d1, x.q.a, pf.format(pct(x.q.a, x.q.total)) + '%'], ['Nuevo ' + (x.q.d1 + 1) + '-' + x.q.d2, x.q.b, pf.format(pct(x.q.b, x.q.total)) + '%'], ['Antiguo', x.q.c, pf.format(pct(x.q.c, x.q.total)) + '%']].forEach((z, i) => card(s, .7 + i * 3.05, 1.7, 2.75, z[0], nf.format(z[1]), z[2])); }
  }
  const d = new Date(), p2 = n => String(n).padStart(2, '0'), name = 'Resumen_Inhub_' + (state.config.analysisDate || d.getFullYear() + '-' + p2(d.getMonth() + 1) + '-' + p2(d.getDate())) + '_' + p2(d.getHours()) + p2(d.getMinutes()) + '.pptx';
  await p.writeFile({ fileName: name }); return name;
}

export async function doPpt(btn) {
  const old = btn.textContent; btn.disabled = true; btn.textContent = 'Generando…';
  try { const name = await exportPpt(); $('message').textContent = 'PowerPoint generado: ' + name; }
  catch (e) { $('message').textContent = 'No se pudo generar el PowerPoint: ' + e.message; }
  finally { btn.disabled = false; btn.textContent = old; }
}

export function exportCsv() {
  const rows = [];
  for (const site of ['soldati', 'echeverria']) {
    const d = state.sites[site], t = d.tms, a = d.arrivals, q = d.jornalesResult;
    if (!t && !a && !q) continue;
    rows.push({ Site: names[site], Fecha: state.config.analysisDate || '', Inhub: t?.totalConPost ?? '', Inhub_s_Post: t?.totalSinPost ?? '', Voluminoso: t?.vol ?? '', Bigger: t?.big ?? '', SuperBigger: t?.sb ?? '', MELI_Air: t?.meli?.arrivals ?? '', Labelless: t?.labelless?.arrived ?? '', Vehiculos: a?.veh ?? '', Paquetes: a?.totalShip ?? '', Jornales: q?.total ?? '', Nuevo_1: q?.a ?? '', Nuevo_2: q?.b ?? '', Antiguo: q?.c ?? '' });
  }
  const csv = [Object.keys(rows[0] || {}).join(';'), ...rows.map(r => Object.values(r).join(';'))].join('\n');
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv' }), a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = 'Consolidado_Inhub_' + (state.config.analysisDate || 'sin_fecha') + '.csv'; a.click(); URL.revokeObjectURL(a.href);
}
