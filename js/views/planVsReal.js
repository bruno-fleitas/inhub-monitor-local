import { $ } from '../core/dom.js';
import { nf, pf, huPercent2 } from '../core/formatters.js';
import { state, names } from '../core/state.js';


function parsePastedPlan(raw) {
  const lines=String(raw).replace(/^\uFEFF/,'').split(/\r?\n/).filter(l=>l.trim());
  const plan={}; let count=0;
  for(const [i,line] of lines.entries()){
    const cols=(line.includes('\t')?line.split('\t'):line.includes(';')?line.split(';'):line.split(/\s+/)).map(x=>x.trim());
    if(i===0 && /^hora$/i.test(cols[0])){
      if(cols.length!==4 || cols.slice(1).map(x=>x.toLowerCase()).join('|')!=='camioneta|chasis|semi')throw Error('Encabezados esperados: Hora, Camioneta, Chasis, Semi.');
      continue;
    }
    if(cols.length!==4)throw Error('Fila '+(i+1)+': copiá exactamente cuatro columnas (C a F).');
    const m=cols[0].match(/^(\d{1,2})(?::00(?::00)?)?$/);
    if(!m||+m[1]<9||+m[1]>23)throw Error('Fila '+(i+1)+': hora inválida; se admite 09:00 a 23:00.');
    const h=+m[1];
    if(Object.prototype.hasOwnProperty.call(plan,h))throw Error('Hora duplicada: '+h+':00.');
    if(!cols.slice(1).every(x=>/^\d+$/.test(x)&&Number.isSafeInteger(Number(x))))throw Error('Fila '+(i+1)+': las cantidades deben ser enteros no negativos, sin celdas vacías.');
    plan[h]={camioneta:Number(cols[1]),chasis:Number(cols[2]),semi:Number(cols[3])};count++;
  }
  if(!count)throw Error('Pegá al menos una fila de planificación.');
  return {plan,count,total:Object.values(plan).reduce((s,x)=>s+x.camioneta+x.chasis+x.semi,0)};
}

export function planVsReal() {
  const host = $('planView'); if (!host) return;
  const hours = Array.from({ length: 15 }, (_, i) => i + 9);
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
    const chart = '<svg viewBox="0 0 830 235" role="img" aria-label="Líneas de vehículos planificados y reales por hora" style="width:100%;max-height:270px;background:#111d30;border-radius:12px"><line x1="30" y1="180" x2="810" y2="180" stroke="#6d7b91"/><polyline fill="none" stroke="#f5a623" stroke-width="3" points="' + pts('pt') + '"/><polyline fill="none" stroke="#3bc8ba" stroke-width="3" points="' + pts('rt') + '"/>' + hourRows.map((x, i) => '<text x="' + (35 + i * 53) + '" y="201" fill="#e4edf8" font-size="12" text-anchor="middle">' + String(x.hour).padStart(2, '0') + '</text>').join('') + '<g font-size="10" font-weight="700" text-anchor="middle">' + hourRows.map((x, i) => '<text x="' + (35 + i * 53) + '" y="' + Math.max(12, 174 - (x.pt / max) * 155) + '" fill="#ffbc53">' + x.pt + '</text><text x="' + (35 + i * 53) + '" y="' + Math.min(177, 193 - (x.rt / max) * 155) + '" fill="#6ce4d6">' + x.rt + '</text>').join('') + '</g></svg>';
    html += '<section class="plan-site" data-plan-site="' + site + '"><h3>' + names[site] + '</h3><p class="muted">Editá el plan por hora. El real se actualiza desde Arribos. Camioneta incluye Camioneta MELI.</p><div class="plan-import" style="margin:12px 0;padding:12px;border:1px solid #93a9c2;border-radius:8px"><strong>Importar planificación desde Excel / Sheets</strong><p class="muted">Copiá C:F de una sola fecha: Hora, Camioneta, Chasis, Semi. Se reemplaza el plan de este site; los horarios no pegados quedan en cero.</p><textarea data-plan-paste="' + site + '" rows="5" style="width:100%;box-sizing:border-box;font:inherit" placeholder="Hora    Camioneta    Chasis    Semi"></textarea><div class="toolbar"><button type="button" class="primary" data-import-plan="' + site + '">Importar planificación</button><span role="status" data-plan-import-status="' + site + '"></span></div></div><div class="kpi-grid"><div class="kpi"><span>Plan</span><b>' + fmt(totals.plan) + '</b></div><div class="kpi"><span>Real</span><b>' + (vehicleHours ? fmt(totals.real) : 'Sin arribos') + '</b></div><div class="kpi"><span>Diferencia</span><b>' + (vehicleHours ? fmt(totals.real - totals.plan) : '—') + '</b></div><div class="kpi"><span>Cumplimiento</span><b>' + (vehicleHours && totals.plan ? huPercent2(100 * totals.real / totals.plan) + '%' : '—') + '</b></div></div><div class="plan-chart"><div class="plan-legend"><span style="color:#f5a623">● Plan</span> <span style="color:#3bc8ba">● Real</span></div>' + chart + '</div><div class="plan-table-wrap"><table class="hu-table plan-table"><thead><tr><th rowspan="2">Hora</th><th colspan="4">Plan editable</th><th colspan="4">Real automático</th><th rowspan="2">Diferencia</th></tr><tr>' + types.map(x => '<th>' + x[1] + '</th>').join('') + '<th>Total</th>' + types.map(x => '<th>' + x[1] + '</th>').join('') + '<th>Total</th></tr></thead><tbody>' + hourRows.map(x => '<tr><td>' + String(x.hour).padStart(2, '0') + ':00</td>' + types.map(([key]) => '<td><input class="plan-cell" type="number" min="0" step="1" data-hour="' + x.hour + '" data-type="' + key + '" value="' + x.p[key] + '"></td>').join('') + '<td><b>' + fmt(x.pt) + '</b></td>' + types.map(([key]) => '<td>' + (vehicleHours ? fmt(x.real[key]) : '—') + '</td>').join('') + '<td><b>' + (vehicleHours ? fmt(x.rt) : '—') + '</b></td><td>' + (vehicleHours ? fmt(x.rt - x.pt) : '—') + '</td></tr>').join('') + '<tr class="total"><td>Total</td>' + types.map(([key]) => '<td>' + fmt(hourRows.reduce((n, x) => n + x.p[key], 0)) + '</td>').join('') + '<td>' + fmt(totals.plan) + '</td>' + types.map(([key]) => '<td>' + (vehicleHours ? fmt(hourRows.reduce((n, x) => n + x.real[key], 0)) : '—') + '</td>').join('') + '<td>' + (vehicleHours ? fmt(totals.real) : '—') + '</td><td>' + (vehicleHours ? fmt(totals.real - totals.plan) : '—') + '</td></tr></tbody></table></div><div class="toolbar"><button class="primary" data-save-plan="' + site + '">Guardar plan y actualizar gráfico</button><button class="secondary" data-clear-plan="' + site + '">Limpiar plan</button></div></section>';
  }
  host.innerHTML = html;
  host.querySelectorAll('[data-import-plan]').forEach(btn => btn.onclick = () => {
    const site=btn.dataset.importPlan, section=btn.closest('[data-plan-site]');
    const status=section.querySelector('[data-plan-import-status]');
    try {
      const parsed=parsePastedPlan(section.querySelector('[data-plan-paste]').value);
      if(!window.confirm('Importar '+parsed.count+' horarios y '+nf.format(parsed.total)+' vehículos para '+names[site]+'? Se reemplazará su plan actual; los horarios faltantes quedarán en cero.'))return;
      localStorage.setItem(storeKey(site),JSON.stringify(parsed.plan));
      planVsReal();
      const next=host.querySelector('[data-plan-import-status="'+site+'"]');
      if(next){next.textContent='Plan importado: '+parsed.count+' horarios · '+nf.format(parsed.total)+' vehículos.';next.style.color='#15803d'}
    } catch(e){status.textContent=e.message;status.style.color='#dc2626'}
  });
  host.querySelectorAll('[data-save-plan]').forEach(btn => btn.onclick = () => {
    const site = btn.dataset.savePlan, section = host.querySelector('[data-plan-site="' + site + '"]'), plan = {};
    section.querySelectorAll('.plan-cell').forEach(input => { const hour = input.dataset.hour; plan[hour] ??= {}; plan[hour][input.dataset.type] = Math.max(0, Math.floor(Number(input.value) || 0)); });
    localStorage.setItem(storeKey(site), JSON.stringify(plan)); planVsReal();
  });
  host.querySelectorAll('[data-clear-plan]').forEach(btn => btn.onclick = () => { localStorage.removeItem(storeKey(btn.dataset.clearPlan)); planVsReal(); });
}
