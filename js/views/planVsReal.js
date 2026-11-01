import { $ } from '../core/dom.js';
import { nf, pf, huPercent2 } from '../core/formatters.js';
import { state, names } from '../core/state.js';

export function planVsReal() {
  const host = $('planView'); if (!host) return;
  const hours = Array.from({ length: 14 }, (_, i) => i + 9);
  const types = [['camioneta', 'Camioneta'], ['chasis', 'Chasis'], ['semi', 'Semi']];
  const storeKey = site => 'inhub_vehicle_plan_' + site;
  let html = '';
  for (const site of ['soldati', 'echeverria']) {
    let saved = {}; try { saved = JSON.parse(localStorage.getItem(storeKey(site)) || '{}') || {}; } catch { }
    const siteData = state.sites[site], a = siteData.arrivals, vehicleHours = a?.h || siteData.registros?.vehiclesByHour || null;
    const totals = { plan: 0, real: 0 }, hourRows = [];
    for (const hour of hours) {
      const p = {}, real = {};
      for (const [key] of types) { p[key] = Math.max(0, Number(saved[hour]?.[key]) || 0); real[key] = Number(vehicleHours?.[hour]?.[key]) || 0; }
      const pt = Object.values(p).reduce((x, y) => x + y, 0), rt = Object.values(real).reduce((x, y) => x + y, 0);
      totals.plan += pt; totals.real += rt; hourRows.push({ hour, p, real, pt, rt });
    }
    const fmt = v => nf.format(v);
    const max = Math.max(1, ...hourRows.flatMap(x => [x.pt, x.rt]));
    const pts = key => hourRows.map((x, i) => [35 + i * 53, 180 - (x[key] / max) * 155].join(',')).join(' ');
    const chart = '<svg viewBox="0 0 790 235" role="img" aria-label="Líneas de vehículos planificados y reales por hora" style="width:100%;max-height:270px;background:#111d30;border-radius:12px"><line x1="30" y1="180" x2="755" y2="180" stroke="#6d7b91"/><polyline fill="none" stroke="#f5a623" stroke-width="3" points="' + pts('pt') + '"/><polyline fill="none" stroke="#3bc8ba" stroke-width="3" points="' + pts('rt') + '"/>' + hourRows.map((x, i) => '<text x="' + (35 + i * 53) + '" y="201" fill="#e4edf8" font-size="12" text-anchor="middle">' + String(x.hour).padStart(2, '0') + '</text>').join('') + '<g font-size="10" font-weight="700" text-anchor="middle">' + hourRows.map((x, i) => '<text x="' + (35 + i * 53) + '" y="' + Math.max(12, 174 - (x.pt / max) * 155) + '" fill="#ffbc53">' + x.pt + '</text><text x="' + (35 + i * 53) + '" y="' + Math.min(177, 193 - (x.rt / max) * 155) + '" fill="#6ce4d6">' + x.rt + '</text>').join('') + '</g></svg>';
    html += '<section class="plan-site" data-plan-site="' + site + '"><h3>' + names[site] + '</h3><p class="muted">Editá el plan por hora. El real se actualiza desde Arribos. Camioneta incluye Camioneta MELI.</p><div class="kpi-grid"><div class="kpi"><span>Plan</span><b>' + fmt(totals.plan) + '</b></div><div class="kpi"><span>Real</span><b>' + (vehicleHours ? fmt(totals.real) : 'Sin arribos') + '</b></div><div class="kpi"><span>Diferencia</span><b>' + (vehicleHours ? fmt(totals.real - totals.plan) : '—') + '</b></div><div class="kpi"><span>Cumplimiento</span><b>' + (vehicleHours && totals.plan ? huPercent2(100 * totals.real / totals.plan) + '%' : '—') + '</b></div></div><div class="plan-chart"><div class="plan-legend"><span style="color:#f5a623">● Plan</span> <span style="color:#3bc8ba">● Real</span></div>' + chart + '</div><div class="plan-table-wrap"><table class="hu-table plan-table"><thead><tr><th rowspan="2">Hora</th><th colspan="4">Plan editable</th><th colspan="4">Real automático</th><th rowspan="2">Diferencia</th></tr><tr>' + types.map(x => '<th>' + x[1] + '</th>').join('') + '<th>Total</th>' + types.map(x => '<th>' + x[1] + '</th>').join('') + '<th>Total</th></tr></thead><tbody>' + hourRows.map(x => '<tr><td>' + String(x.hour).padStart(2, '0') + ':00</td>' + types.map(([key]) => '<td><input class="plan-cell" type="number" min="0" step="1" data-hour="' + x.hour + '" data-type="' + key + '" value="' + x.p[key] + '"></td>').join('') + '<td><b>' + fmt(x.pt) + '</b></td>' + types.map(([key]) => '<td>' + (vehicleHours ? fmt(x.real[key]) : '—') + '</td>').join('') + '<td><b>' + (vehicleHours ? fmt(x.rt) : '—') + '</b></td><td>' + (vehicleHours ? fmt(x.rt - x.pt) : '—') + '</td></tr>').join('') + '<tr class="total"><td>Total</td>' + types.map(([key]) => '<td>' + fmt(hourRows.reduce((n, x) => n + x.p[key], 0)) + '</td>').join('') + '<td>' + fmt(totals.plan) + '</td>' + types.map(([key]) => '<td>' + (vehicleHours ? fmt(hourRows.reduce((n, x) => n + x.real[key], 0)) : '—') + '</td>').join('') + '<td>' + (vehicleHours ? fmt(totals.real) : '—') + '</td><td>' + (vehicleHours ? fmt(totals.real - totals.plan) : '—') + '</td></tr></tbody></table></div><div class="toolbar"><button class="primary" data-save-plan="' + site + '">Guardar plan y actualizar gráfico</button><button class="secondary" data-clear-plan="' + site + '">Limpiar plan</button></div></section>';
  }
  host.innerHTML = html;
  host.querySelectorAll('[data-save-plan]').forEach(btn => btn.onclick = () => {
    const site = btn.dataset.savePlan, section = host.querySelector('[data-plan-site="' + site + '"]'), plan = {};
    section.querySelectorAll('.plan-cell').forEach(input => { const hour = input.dataset.hour; plan[hour] ??= {}; plan[hour][input.dataset.type] = Math.max(0, Math.floor(Number(input.value) || 0)); });
    localStorage.setItem(storeKey(site), JSON.stringify(plan)); planVsReal();
  });
  host.querySelectorAll('[data-clear-plan]').forEach(btn => btn.onclick = () => { localStorage.removeItem(storeKey(btn.dataset.clearPlan)); planVsReal(); });
}
