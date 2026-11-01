import { $ } from '../core/dom.js';
import { nf, pf, pct, huPercent2 } from '../core/formatters.js';
import { state, names } from '../core/state.js';
import { huConfig } from '../core/config.js';
import { huSeparateAir } from '../domain/tms.js';

function huHourlyGoalPlan(site) {
  const t = state.sites[site].tms; if (!t?.hu) return '<p class="muted">Procesá TMS para ver el avance HU.</p>';
  const cfg = huConfig(site), forecast = Number($(site === 'soldati' ? 'fcS' : 'fcE')?.value) || 0;
  if (!forecast) return '<p class="muted">Cargá el proyectado de ' + names[site] + ' para calcular el objetivo HU.</p>';
  const pctGoal = Math.max(0, Math.min(100, Number(cfg.targetPct ?? 65)));
  const goal = Math.ceil(forecast * pctGoal / 100), tot = huSeparateAir(t).normal.hu.totals, processed = tot.abierto + tot.cerrado;
  const max = t.hu.maxOutTs, now = max ? new Date(max) : new Date();
  const [th, tm] = String(cfg.targetTime || '22:00').split(':').map(Number);
  const startHour = Math.max(0, Math.min(23, Number(cfg.huStartHour ?? 7)));
  const start = new Date(now); start.setHours(startHour, 0, 0, 0);
  if (start > now) start.setDate(start.getDate() - 1);
  const end = new Date(start); end.setHours(th || 0, tm || 0, 0, 0); if (end <= start) end.setDate(end.getDate() + 1);
  const duration = (end - start) / 3600000;
  const hourly = t.hu.byHour || [], air = t.meli?.by || {};
  const rows = [];
  for (let cursor = new Date(start); cursor < end && rows.length < 30; cursor.setHours(cursor.getHours() + 1)) {
    const next = new Date(Math.min(cursor.getTime() + 3600000, end.getTime()));
    const h = cursor.getHours(), hours = (next - cursor) / 3600000;
    const raw = Number(hourly[h] || 0), meli = Number(air[h]?.proc || 0);
    const real = cursor <= now ? Math.max(0, raw - meli) : null;
    rows.push({ h, stamp: new Date(cursor), hours, real });
  }
  const fmt = n => nf.format(Math.round(n));
  const completed = rows.filter(x => x.real !== null), historical = completed.reduce((v, x) => v + x.real, 0);
  const prior = Math.max(0, processed - historical);
  let cumulative = prior;
  rows.forEach((x, i) => {
    const remainingHours = rows.slice(i).reduce((sum, y) => sum + y.hours, 0);
    const missing = Math.max(0, goal - cumulative);
    x.targetHour = remainingHours > 0 ? missing * x.hours / remainingHours : 0;
    x.targetAccum = Math.round(cumulative + x.targetHour);
    x.before = cumulative;
    if (x.real !== null) cumulative += x.real;
    x.actualAccum = x.real === null ? null : cumulative;
    x.diff = x.real === null ? null : x.real - Math.round(x.targetHour);
    x.remainingAfter = x.real === null ? null : Math.max(0, goal - cumulative);
  });
  const remainingNow = Math.max(0, goal - processed);
  const remainingTime = rows.filter(x => x.real === null).reduce((sum, x) => sum + x.hours, 0);
  const currentRequired = remainingTime > 0 ? Math.ceil(remainingNow / remainingTime) : 0;
  const chart = (title, keyA, keyB, labelA, labelB) => {
    const peak = Math.max(1, ...rows.map(x => Math.max(x[keyA] || 0, x[keyB] || 0))) * 1.12;
    const xy = (i, v) => [52 + i * 760 / Math.max(1, rows.length - 1), 205 - (v || 0) / peak * 175];
    const line = key => rows.filter(x => x[key] !== null).map(x => xy(rows.indexOf(x), x[key]).join(',')).join(' ');
    const labels = rows.map((x, i) => { const [px] = xy(i, 0); return '<text x="' + px + '" y="232" fill="#c9d6e8" font-size="12" text-anchor="middle">' + String(x.h).padStart(2, '0') + '</text>'; }).join('');
    const dots = key => rows.filter(x => x[key] !== null).map(x => { const [px, py] = xy(rows.indexOf(x), x[key]); return '<circle cx="' + px + '" cy="' + py + '" r="3" fill="' + (key === keyA ? '#ffbf66' : '#43d6b0') + '"/><text x="' + px + '" y="' + Math.max(12, py + (key === keyA ? -9 : 17)) + '" font-size="10" fill="' + (key === keyA ? '#ffbf66' : '#43d6b0') + '" text-anchor="middle">' + fmt(x[key]) + '</text>'; }).join(' ');
    return '<div class="flow-curve"><h3>' + title + '</h3><p class="muted"><span style="color:#ffbf66">● ' + labelA + '</span> &nbsp; <span style="color:#43d6b0">● ' + labelB + '</span></p><div class="plan-chart"><svg viewBox="0 0 860 250" style="width:100%;background:#111d30;border-radius:12px"><line x1="42" y1="205" x2="830" y2="205" stroke="#64748b"/><polyline points="' + line(keyA) + '" fill="none" stroke="#ffbf66" stroke-width="3"/><polyline points="' + line(keyB) + '" fill="none" stroke="#43d6b0" stroke-width="3"/>' + labels + dots(keyA) + dots(keyB) + '</svg></div></div>';
  };
  return '<div class="kpi-grid"><div class="kpi"><span>Proyectado</span><b>' + fmt(forecast) + '</b></div><div class="kpi"><span>Objetivo ' + huPercent2(pctGoal) + '%</span><b>' + fmt(goal) + '</b></div><div class="kpi"><span>HU procesado (sin MELI Air)</span><b>' + fmt(processed) + '</b></div><div class="kpi"><span>Faltan para objetivo</span><b>' + fmt(Math.max(0, goal - processed)) + '</b></div></div><div class="kpi-grid"><div class="kpi"><span>Faltante actual</span><b>' + fmt(remainingNow) + '</b></div><div class="kpi"><span>Ritmo necesario desde ahora</span><b>' + (remainingTime ? fmt(currentRequired) + ' pza/h' : 'Sin horas restantes') + '</b></div></div><p class="muted">Objetivo dinámico: en cada hora se redistribuye el faltante entre las horas restantes. Las horas anteriores se reconstruyen con el TMS cargado; no son metas históricas guardadas. MELI Air excluido. La tabla permite ver la recuperación hora por hora.</p>' + chart('Producción HU por hora · objetivo vs real', 'targetHour', 'real', 'Objetivo por hora', 'Real por hora') + chart('Avance HU acumulado · objetivo vs real', 'targetAccum', 'actualAccum', 'Meta acumulada', 'Real acumulado') + '<div class="plan-table-wrap"><table class="hu-table plan-table"><tr><th>Hora</th><th>Objetivo dinámico / hora</th><th>HU real / hora</th><th>Diferencia / hora</th><th>Meta al finalizar hora</th><th>Real acumulado</th><th>Faltante después</th></tr>' + rows.map(x => '<tr><td>' + String(x.h).padStart(2, '0') + ':00</td><td>' + fmt(x.targetHour) + '</td><td>' + (x.real === null ? 'Pendiente' : fmt(x.real)) + '</td><td>' + (x.diff === null ? '—' : (x.diff > 0 ? '+' : '') + fmt(x.diff)) + '</td><td>' + fmt(x.targetAccum) + '</td><td>' + (x.actualAccum === null ? '—' : fmt(x.actualAccum)) + '</td><td>' + (x.remainingAfter === null ? '—' : fmt(x.remainingAfter)) + '</td></tr>').join('') + '</table></div>' + (prior ? '<p class="muted">Nota de conciliación: ' + fmt(prior) + ' piezas procesadas del total HU no están distribuidas en las horas visibles. Se incorporan solo al acumulado real inicial, no a la producción horaria.</p>' : '');
}

export function huGoalView() {
  const host = $('huplanView'); if (!host) return;
  host.innerHTML = ['soldati', 'echeverria'].map(site => '<section class="plan-site"><h3>' + names[site] + '</h3>' + huHourlyGoalPlan(site) + '</section>').join('');
}
