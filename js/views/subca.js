import { $ } from '../core/dom.js';
import { nf, pf, pct, esc } from '../core/formatters.js';
import { state, names, subcaFilters } from '../core/state.js';
import { masters } from '../core/config.js';

function cfg(site) {
  const t = state.sites[site].tms;
  if (!t) return null;
  const mp = new Map(masters[site].map(x => [String(x.subca).trim().toUpperCase(), x]));
  const groups = t.subcaGroups.map(g => {
    const x = mp.get(String(g.subca).trim().toUpperCase());
    return { ...g, ola: x?.ola || '', cpt: x?.cpt ?? '', indicador: x?.indicador || '' };
  });
  return { total: t.totalConPost, groups, unknown: groups.filter(g => g.subca !== 'SIN SUBCA' && !mp.has(String(g.subca).trim().toUpperCase())) };
}

function cpts(s) {
  const m = new Map();
  for (const g of s.groups) {
    const k = g.cpt === '' ? 'SIN CONFIG' : String(g.cpt);
    if (!m.has(k)) m.set(k, { cpt: k, total: 0, vol: 0, big: 0, sb: 0, subcas: new Set() });
    const x = m.get(k);
    x.total += g.total; x.vol += g.vol; x.big += g.big; x.sb += g.sb; x.subcas.add(g.subca);
  }
  return [...m.values()];
}

function uniq(a) {
  return [...new Set(a.filter(x => x !== '' && x != null))].sort((a, b) => String(a).localeCompare(String(b), 'es', { numeric: true }));
}

function optionList(values, current) {
  return '<option value="__ALL__">Todos</option>' + values.map(v => `<option value="${esc(v)}" ${String(v) === String(current) ? 'selected' : ''}>${esc(v)}</option>`).join('');
}

function applySubFilters(site, s) {
  const f = subcaFilters[site];
  return s.groups.filter(g => {
    const q = String(f.q || '').toLowerCase().trim();
    if (q && ![g.subca, g.ola, g.cpt, g.indicador].some(v => String(v ?? '').toLowerCase().includes(q))) return false;
    if (f.subca !== '__ALL__' && String(g.subca) !== String(f.subca)) return false;
    if (f.ola !== '__ALL__' && String(g.ola) !== String(f.ola)) return false;
    if (f.cpt !== '__ALL__' && String(g.cpt) !== String(f.cpt)) return false;
    if (f.indicador !== '__ALL__' && String(g.indicador) !== String(f.indicador)) return false;
    return true;
  });
}

function subFilterBar(site, s) {
  const f = subcaFilters[site];
  return `<div class="subca-filters">
    <label>Buscar<input data-sf-site="${site}" data-sf="q" value="${esc(f.q)}" placeholder="SubCA, ola, CPT..."></label>
    <label>SubCA<select data-sf-site="${site}" data-sf="subca">${optionList(uniq(s.groups.map(g => g.subca)), f.subca)}</select></label>
    <label>Ola<select data-sf-site="${site}" data-sf="ola">${optionList(uniq(s.groups.map(g => g.ola || '-')), f.ola)}</select></label>
    <label>CPT<select data-sf-site="${site}" data-sf="cpt">${optionList(uniq(s.groups.map(g => g.cpt === '' ? '-' : g.cpt)), f.cpt)}</select></label>
    <label>Indicador<select data-sf-site="${site}" data-sf="indicador">${optionList(uniq(s.groups.map(g => g.indicador || '-')), f.indicador)}</select></label>
    <button class="smallbtn ghost" data-sf-clear="${site}">Limpiar filtros</button>
  </div>`;
}

function bindSubFilters() {
  document.querySelectorAll('[data-sf-site]').forEach(el => {
    const evt = el.tagName === 'INPUT' ? 'input' : 'change';
    el.addEventListener(evt, () => { const s = el.dataset.sfSite, k = el.dataset.sf; subcaFilters[s][k] = el.value; subca(); });
  });
  document.querySelectorAll('[data-sf-clear]').forEach(b => b.onclick = () => { subcaFilters[b.dataset.sfClear] = { q: '', subca: '__ALL__', ola: '__ALL__', cpt: '__ALL__', indicador: '__ALL__' }; subca(); });
}

function rank(title, a, v, n = 'subca') {
  return `<div class="rank-card"><h4>${title}</h4><table>${a.map((x, i) => `<tr><td>${i + 1}. ${esc(x[n])}</td><td>${pf.format(v(x))}</td></tr>`).join('')}</table></div>`;
}

function subTable(s) {
  return `<div class="scroll"><table><tr><th>SubCA</th><th>Ola</th><th>CPT</th><th>Indicador</th><th>Piezas</th><th>% part.</th><th>Vol.</th><th>% Vol.</th><th>Bigger</th><th>SB</th></tr>${s.groups.slice().sort((a, b) => b.total - a.total).map(g => `<tr><td>${esc(g.subca)}</td><td>${esc(g.ola || '-')}</td><td>${g.cpt === '' ? '-' : g.cpt}</td><td>${esc(g.indicador || '-')}</td><td>${nf.format(g.total)}</td><td>${pf.format(pct(g.total, s.total))}%</td><td>${nf.format(g.vol)}</td><td>${pf.format(pct(g.vol, g.total))}%</td><td>${nf.format(g.big)}</td><td>${nf.format(g.sb)}</td></tr>`).join('')}</table></div>`;
}

function cptTable(s, cs) {
  return `<div class="scroll"><table><tr><th>CPT</th><th>Piezas</th><th>% part.</th><th>Vol.</th><th>% Vol.</th><th>Bigger</th><th>SB</th><th>Q SubCA</th></tr>${cs.map(x => `<tr><td>${x.cpt}</td><td>${nf.format(x.total)}</td><td>${pf.format(pct(x.total, s.total))}%</td><td>${nf.format(x.vol)}</td><td>${pf.format(pct(x.vol, x.total))}%</td><td>${nf.format(x.big)}</td><td>${nf.format(x.sb)}</td><td>${x.subcas.size}</td></tr>`).join('')}</table></div>`;
}

export function subca() {
  let h = '';
  for (const site of ['soldati', 'echeverria']) {
    const s = cfg(site); if (!s) continue;
    const filtered = applySubFilters(site, s);
    const view = { ...s, groups: filtered, total: filtered.reduce((n, g) => n + g.total, 0) };
    const cs = cpts(view), top = filtered.slice().sort((a, b) => b.total - a.total).slice(0, 10), topv = filtered.slice().sort((a, b) => b.vol - a.vol).slice(0, 10), topp = filtered.slice().sort((a, b) => pct(b.vol, b.total) - pct(a.vol, a.total)).slice(0, 10);
    h += `<article class="card"><h2>${names[site]}</h2>${subFilterBar(site, s)}
      <div class="filter-summary">Mostrando <b>${filtered.length}</b> de <b>${s.groups.length}</b> SubCA · <b>${nf.format(view.total)}</b> piezas filtradas</div>
      ${s.unknown.length ? `<div class="alertbox"><b>SubCA sin configurar:</b> ${s.unknown.map(x => esc(x.subca) + ' (' + nf.format(x.total) + ')').join(' · ')}</div>` : ''}
      <div class="rank-grid">${rank('Top 10 SubCA por carga', top, x => x.total)}${rank('Top 10 SubCA voluminosos', topv, x => x.vol)}${rank('Top 10 SubCA % voluminoso', topp, x => pct(x.vol, x.total))}${rank('Top 10 CPT por carga', cs.slice().sort((a, b) => b.total - a.total).slice(0, 10), x => x.total, 'cpt')}</div>
      <h3>Participación por SubCA</h3>${subTable(view)}
      <h3>Participación por CPT</h3>${cptTable(view, cs)}
    </article>`;
  }
  $('subcaView').innerHTML = h || '<article class="card empty">Sin TMS.</article>';
  bindSubFilters();
}
