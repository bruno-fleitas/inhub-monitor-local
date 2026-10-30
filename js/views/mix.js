/**
 * @fileoverview Mix/voluminous view and pie chart rendering.
 *
 * View/adapter layer of the hexagonal architecture.
 * Renders the voluminous package mix dashboard and reusable pie-chart cards.
 *
 * Dependencies: core/dom.js, core/formatters.js, core/state.js
 *
 * Exports: mix, pieCard, packagePie, vehiclePie
 */

import { $ } from '../core/dom.js';
import { nf, pf, pct, esc } from '../core/formatters.js';
import { state, names } from '../core/state.js';

/**
 * Render a reusable donut/ring pie chart card with legend.
 * @param {string} title - Card title.
 * @param {Array<[string, number]>} items - Legend items [label, value].
 * @returns {string} HTML for the pie card.
 */
export function pieCard(title, items) {
  const total = items.reduce((s, x) => s + Math.max(0, x[1]), 0);
  const colors = ['#1769aa', '#20a477', '#f3a23c', '#865ac2'];
  let cumulative = 0;
  const stops = items.map((x, i) => { const start = cumulative; cumulative += total ? Math.max(0, x[1]) / total * 100 : 0; return `${colors[i % colors.length]} ${start}% ${cumulative}%`; }).join(',');
  return `<div class="pie-card"><h3>${esc(title)}</h3><div class="pie-layout"><div class="pie-ring" style="background:${total ? `conic-gradient(${stops})` : '#dce5ef'}"><div><strong>${nf.format(total)}</strong><small>Total</small></div></div><div class="pie-legend">${items.map(([label, n], i) => `<div><span class="pie-dot" style="background:${colors[i % colors.length]}"></span><b>${esc(label)}</b><strong>${nf.format(n)}</strong><em>${pf.format(pct(n, total))}%</em></div>`).join('')}</div></div></div>`;
}

/**
 * Render the package mix pie chart from TMS data.
 * @param {object} t - TMS worker result.
 * @returns {string} HTML pie card.
 */
export function packagePie(t) {
  if (!t) return '';
  const vol = Math.max(0, t.vol - t.big - t.sb), big = t.big || 0, sb = t.sb || 0;
  return pieCard('Mix de paquetes', [
    ['Paquetería', Math.max(0, t.totalConPost - vol - big - sb)],
    ['Voluminoso', vol], ['Bigger', big], ['SuperBigger', sb]
  ]);
}

/**
 * Render the vehicle participation pie chart from arrivals data.
 * @param {object} a - Arrivals worker result.
 * @returns {string} HTML pie card.
 */
export function vehiclePie(a) {
  if (!a?.ok) return '';
  const cm = a.camionetaMeli || 0, co = a.camionetaOther ?? Math.max(0, (a.camioneta || 0) - cm);
  return pieCard('Participación de vehículos', [
    ['Semi', a.semi || 0], ['Chasis', a.chasis || 0], ['Camioneta', co], ['Camioneta MELI', cm]
  ]);
}

/**
 * Render the mix/voluminous view for all sites with TMS data.
 */
export function mix() {
  const start = state.config.curveStart;
  let h = '';
  for (const site of ['soldati', 'echeverria']) {
    const t = state.sites[site].tms;
    if (!t) continue;
    const pure = Math.max(0, t.vol - t.big - t.sb), base = Math.max(0, t.totalConPost - t.big - t.sb);
    let cv = 0, ct = 0, rows = '';
    for (let hr = start; hr <= 23; hr++) { const x = t.by[hr]; cv += x.vol; ct += x.tot; rows += `<tr><td>${hr}:00</td><td>${nf.format(x.tot)}</td><td>${nf.format(x.vol)}</td><td>${pf.format(pct(x.vol, x.tot))}%</td><td>${pf.format(pct(cv, ct))}%</td><td>${nf.format(x.big)}</td><td>${nf.format(x.sb)}</td></tr>`; }
    h += `<article class="card"><h2>${names[site]}</h2><div class="kpi-grid"><div class="kpi"><span>Voluminoso c/B+SB</span><b>${nf.format(t.vol)}</b><small>${pf.format(pct(t.vol, t.totalConPost))}%</small></div><div class="kpi"><span>Voluminoso s/B+SB</span><b>${nf.format(pure)}</b><small>${pf.format(pct(pure, base))}%</small></div><div class="kpi"><span>Bigger</span><b>${nf.format(t.big)}</b></div><div class="kpi"><span>SuperBigger</span><b>${nf.format(t.sb)}</b></div></div>${packagePie(t)}<div class="scroll"><table><tr><th>Hora</th><th>Total</th><th>Vol.</th><th>% hora</th><th>% acum.</th><th>Bigger</th><th>SB</th></tr>${rows}</table></div></article>`;
  }
  $('mixView').innerHTML = h || '<article class="card empty">Sin TMS.</article>';
}
