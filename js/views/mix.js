import { $ } from '../core/dom.js';
import { nf, pf, pct, esc } from '../core/formatters.js';
import { state, names } from '../core/state.js';

export function pieCard(title, items) {
  const total = items.reduce((s, x) => s + Math.max(0, x[1]), 0);
  const colors = ['#1769aa', '#20a477', '#f3a23c', '#865ac2'];
  let cumulative = 0;
  const stops = items.map((x, i) => { const start = cumulative; cumulative += total ? Math.max(0, x[1]) / total * 100 : 0; return `${colors[i % colors.length]} ${start}% ${cumulative}%`; }).join(',');
  return `<div class="pie-card"><h3>${esc(title)}</h3><div class="pie-layout"><div class="pie-ring" style="background:${total ? `conic-gradient(${stops})` : '#dce5ef'}"><div><strong>${nf.format(total)}</strong><small>Total</small></div></div><div class="pie-legend">${items.map(([label, n], i) => `<div><span class="pie-dot" style="background:${colors[i % colors.length]}"></span><b>${esc(label)}</b><strong>${nf.format(n)}</strong><em>${pf.format(pct(n, total))}%</em></div>`).join('')}</div></div></div>`;
}

export function packagePie(t) {
  if (!t) return '';
  const vol = Math.max(0, t.vol - t.big - t.sb), big = t.big || 0, sb = t.sb || 0;
  return pieCard('Mix de paquetes', [
    ['Paquetería', Math.max(0, t.totalConPost - vol - big - sb)],
    ['Voluminoso', vol], ['Bigger', big], ['SuperBigger', sb]
  ]);
}

export function vehiclePie(a) {
  if (!a?.ok) return '';
  const cm = a.camionetaMeli || 0, co = a.camionetaOther ?? Math.max(0, (a.camioneta || 0) - cm);
  return pieCard('Participación de vehículos', [
    ['Semi', a.semi || 0], ['Chasis', a.chasis || 0], ['Camioneta', co], ['Camioneta MELI', cm]
  ]);
}

export function mix() {
  const container = $('mixView');
  const starts = state.config.mixStart ??= { soldati: 9, echeverria: 9 };
  let html = '';
  for (const site of ['soldati', 'echeverria']) {
    const t = state.sites[site].tms;
    if (!t?.by) continue;
    const saved = Number(starts[site]);
    const start = Number.isInteger(saved) && saved >= 0 && saved <= 23 ? saved : 9;
    const by = t.by;
    const total = { tot: 0, vol: 0, big: 0, sb: 0 };
    let rows = '';
    let cumulative = { tot: 0, vol: 0, big: 0, sb: 0 };
    for (let hr = start; hr < 24; hr++) {
      const x = by[hr] || {};
      const n = { tot: Number(x.tot) || 0, vol: Number(x.vol) || 0, big: Number(x.big) || 0, sb: Number(x.sb) || 0 };
      for (const key of Object.keys(total)) { total[key] += n[key]; cumulative[key] += n[key]; }
      const pureHour = Math.max(0, n.vol - n.big - n.sb);
      rows += `<tr><td>${String(hr).padStart(2, '0')}:00</td><td>${nf.format(pureHour)}</td><td>${nf.format(n.tot)}</td><td>${pf.format(pct(pureHour, n.tot))}%</td><td>${pf.format(pct(Math.max(0, cumulative.vol - cumulative.big - cumulative.sb), cumulative.tot))}%</td><td>${nf.format(n.big)}</td><td>${nf.format(n.sb)}</td></tr>`;
    }
    const pure = Math.max(0, total.vol - total.big - total.sb);
    const packages = Math.max(0, total.tot - total.vol);
    const opts = Array.from({ length: 24 }, (_, h) => `<option value="${h}"${h === start ? ' selected' : ''}>${String(h).padStart(2, '0')}:00</option>`).join('');
    html += `<article class="card"><h2>${names[site]}</h2>
      <div style="display:flex;gap:12px;align-items:center;flex-wrap:wrap;margin:10px 0 14px">
        <label>Tomar ingresos desde <select data-mix-start="${site}">${opts}</select></label>
        <span class="muted">Hasta 23:59 · Base: ${nf.format(total.tot)} paquetes TMS</span>
      </div>
      <div class="kpi-grid">
        <div class="kpi"><span>Voluminoso con Bigger + SuperBigger</span><b>${nf.format(total.vol)}</b><small>${pf.format(pct(total.vol, total.tot))}% del total</small></div>
        <div class="kpi"><span>Voluminoso sin Bigger / SuperBigger</span><b>${nf.format(pure)}</b><small>${pf.format(pct(pure, total.tot))}% del total</small></div>
        <div class="kpi"><span>Bigger</span><b>${nf.format(total.big)}</b><small>${pf.format(pct(total.big, total.tot))}% del total</small></div>
        <div class="kpi"><span>SuperBigger</span><b>${nf.format(total.sb)}</b><small>${pf.format(pct(total.sb, total.tot))}% del total</small></div>
      </div>
      ${pieCard('Mix de paquetes · desde ' + String(start).padStart(2, '0') + ':00', [['Paquetería', packages], ['Voluminoso', pure], ['Bigger', total.big], ['SuperBigger', total.sb]])}
      <div class="scroll mix-hourly"><table><tr><th>Hora</th><th>Vol.</th><th>Total</th><th>% hora</th><th>% acum.</th><th>Bigger</th><th>SuperBigger</th></tr>${rows}<tr class="mix-total"><td>Total</td><td>${nf.format(pure)}</td><td>${nf.format(total.tot)}</td><td>${pf.format(pct(pure, total.tot))}%</td><td>${pf.format(pct(pure, total.tot))}%</td><td>${nf.format(total.big)}</td><td>${nf.format(total.sb)}</td></tr></table></div>
      <p class="muted">Los porcentajes usan siempre como denominador el total de paquetes del período. Las cuatro categorías del gráfico son excluyentes. La categoría «Voluminoso con B/SB» es un subtotal informativo y no se suma nuevamente al Mix.</p>
    </article>`;
  }
  container.innerHTML = html || '<article class="card empty">Sin TMS.</article>';
  container.querySelectorAll('[data-mix-start]').forEach(select => select.addEventListener('change', () => {
    starts[select.dataset.mixStart] = Number(select.value);
    mix();
  }));
}
