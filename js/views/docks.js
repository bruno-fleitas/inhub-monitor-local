import { $ } from '../core/dom.js';
import { nf, pf, pct, esc } from '../core/formatters.js';
import { state, names } from '../core/state.js';
import { onceWorker } from '../core/workers.js?v=20261111-tms-1';

const dockFilters = {soldati:{start:'00:00',job:null},echeverria:{start:'00:00',job:null}};
function dockFilterData(site,t){
  const f=dockFilters[site];if(f.start==='00:00')return {rows:t.docks||[],loading:false};
  const file=state.sites[site].files.tms,date=state.config.analysisDate;
  if(!file)return {rows:[],error:'No hay TMS disponible para aplicar el filtro.'};
  if(f.job?.t===t&&f.job.file===file&&f.job.date===date&&f.job.start===f.start)return f.job;
  const job={t,file,date,start:f.start,rows:[],loading:true};f.job=job;
  onceWorker('./workers/docks-filter.worker.js?v=20261117-docks-start-1',{type:'FILTER_DOCKS',file,config:{date,start:f.start}}).then(rows=>{job.rows=rows;job.loading=false}).catch(e=>{job.error=e.message;job.loading=false}).finally(()=>{if(f.job===job&&state.sites[site].tms===t&&state.sites[site].files.tms===file)dockDashboard()});
  return job;
}

export function dockDashboard() {
  let html = '';
  for (const site of ['soldati', 'echeverria']) {
    const t = state.sites[site].tms; if (!t) continue;
    const key = 'dockThreshold_' + site;
    const threshold = Number(state.config[key] ?? localStorage.getItem('inhub_' + key) ?? 40);
    const filter=dockFilters[site], result=dockFilterData(site,t);
    const docks = result.rows.map(x => ({ ...x, n: Number(x.dock), hours: (x.last - x.first) / 3600000 })).filter(x => x.count > 0);
    const first = docks.length ? Math.min(...docks.map(x => x.first)) : null, last = docks.length ? Math.max(...docks.map(x => x.last)) : null;
    const total = docks.reduce((n, x) => n + x.count, 0), hours = first === null ? 0 : (last - first) / 3600000;
    const clock = ms => new Date(ms).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
    const velocity = (n, h) => h > 0 ? nf.format(Math.round(n / h)) : '—';
    const groupSummary = (label, items) => {
      const count = items.reduce((n, x) => n + x.count, 0), a = items.length ? Math.min(...items.map(x => x.first)) : null, b = items.length ? Math.max(...items.map(x => x.last)) : null, mins = a === null ? 0 : (b - a) / 60000;
      return '<div class="dock-summary dock-group-summary"><div><span>' + label + ' · paquetes</span><b>' + nf.format(count) + '</b></div><div><span>Docks activos</span><b>' + nf.format(items.length) + '</b></div><div><span>Velocidad pza/min</span><b>' + (mins > 0 ? pf.format(count / mins) : '—') + '</b></div><div><span>Velocidad pza/h</span><b>' + (mins > 0 ? nf.format(Math.round(count * 60 / mins)) : '—') + '</b></div><div><span>Primer / último bipeo</span><b>' + (a !== null ? clock(a) + ' / ' + clock(b) : '—') + '</b></div></div>';
    };
    const camionetas = docks.filter(x => Number.isFinite(x.n) && x.n >= threshold), chasis = docks.filter(x => Number.isFinite(x.n) && x.n < threshold);
    const tiles = items => items.length ? '<div class="dock-tiles">' + items.sort((a, b) => a.n - b.n).map(x => {
      const users = Object.entries(x.users || {}).sort((a, b) => b[1] - a[1]);
      const tip = users.length ? users.map(([u, n]) => u + ' · ' + nf.format(n) + ' bipeos').join(' | ') : 'Sin usuario Inbound informado';
      return `<div class="dock-tile" tabindex="0" title="${esc(tip)}"><div class="dock-num">DOCK ${esc(x.dock)}</div><strong>${velocity(x.count, x.hours)} <small>pza/h</small></strong><div class="dock-speed">${x.hours > 0 ? pf.format(x.count / (x.hours * 60)) : '—'} pza/min</div><div class="dock-qty">${nf.format(x.count)} paquetes · ${users.length} usuarios</div><div class="dock-tooltip"><b>Usuarios en dársena</b>${users.length ? users.map(([u, n]) => `<span>${esc(u)} · ${nf.format(n)} bipeos</span>`).join('') : '<span>Sin usuario Inbound informado</span>'}<span>Primer bipeo: ${clock(x.first)}</span><span>Último bipeo: ${clock(x.last)}</span></div></div>`;
    }).join('') + '</div>' : '<p class="muted">Sin docks registrados para esta categoría.</p>';
    html += `<article class="card"><h2>${names[site]} · Productividad por dársena</h2><div class="dock-toolbar"><label>Desde dock N.º se considera Camioneta <input class="dock-limit" data-dock-site="${site}" type="number" min="0" step="1" value="${threshold}"></label><small>Dock ${threshold} y superiores: Camionetas · inferiores: Chasis. Se configura por site.</small><label>Inicio de bipeo <input type="time" data-dock-start="${site}" value="${filter.start}"></label><button type="button" class="smallbtn primary" data-dock-apply="${site}">Aplicar horario</button><button type="button" class="smallbtn ghost" data-dock-reset="${site}">Desde 00:00</button><small>Filtro de bipeos Inbound desde la hora elegida · independiente por site.</small></div>
    ${result.loading ? '<p class="muted" role="status">Recalculando dársenas desde '+esc(filter.start)+'…</p>' : result.error ? '<p class="alertbox" role="alert">'+esc(result.error)+' · Volvé a aplicar el horario.</p>' : '<p class="muted">Bipeos desde '+esc(filter.start)+' · velocidades entre primer y último bipeo incluido.</p>'}
    ${result.loading||result.error ? '' : `
    <div class="dock-summary"><div><span>Paquetes bipeados</span><b>${nf.format(total)}</b></div><div><span>Velocidad general / hora</span><b>${velocity(total, hours)}</b></div><div><span>Velocidad general / minuto</span><b>${hours > 0 ? pf.format(total / (hours * 60)) : '—'}</b></div><div><span>Docks con actividad</span><b>${nf.format(docks.length)}</b></div><div><span>Primer / último bipeo</span><b>${first !== null ? clock(first) + ' / ' + clock(last) : '—'}</b></div></div>
    <h3>Camionetas · ${camionetas.length} docks</h3>${groupSummary('Camionetas', camionetas)}${tiles(camionetas)}
    <h3>Chasis · ${chasis.length} docks</h3>${groupSummary('Chasis', chasis)}${tiles(chasis)}
    ${docks.some(x => !Number.isFinite(x.n)) ? '<p class="muted">Existen docks con identificadores no numéricos que no se pueden clasificar por el umbral.</p>' : ''}
    <p class="muted">Velocidades calculadas entre primer y último bipeo TMS, incluyendo pausas. La velocidad general usa el intervalo global; no es la suma de velocidades individuales. Los usuarios son los identificados en Inbound User ID, no necesariamente quienes están conectados ahora.</p>`}</article>`;
  }
  $('docksView').innerHTML = html || '<article class="card empty">Procesá un TMS para visualizar las dársenas.</article>';
  document.querySelectorAll('[data-dock-apply],[data-dock-reset]').forEach(btn=>btn.onclick=()=>{
    const site=btn.dataset.dockApply||btn.dataset.dockReset, f=dockFilters[site];
    const start=btn.dataset.dockReset?'00:00':document.querySelector('[data-dock-start="'+site+'"]')?.value;
    if(!/^([01]\d|2[0-3]):[0-5]\d$/.test(start||'')){alert('Ingresá una hora válida.');return}
    f.start=start;f.job=null;dockDashboard();
  });
  document.querySelectorAll('.dock-limit').forEach(el => el.onchange = () => {
    const n = Number(el.value);
    if (!Number.isFinite(n) || n < 0) return;
    state.config['dockThreshold_' + el.dataset.dockSite] = n;
    localStorage.setItem('inhub_dockThreshold_' + el.dataset.dockSite, String(n));
    dockDashboard();
  });
}
