import { state } from './state.js';
import { $ } from './dom.js';
import { names } from './state.js';
import { huConfig } from './config.js';

const jworkers = {};

export const jready = { soldati: false, echeverria: false };

export function onceWorker(url, payload, onp) {
  return new Promise((res, rej) => {
    const w = new Worker(url);
    w.onmessage = e => {
      const m = e.data || {};
      if (m.type === 'PROGRESS') onp?.(m.progress || 0);
      if (m.type === 'RESULT') { w.terminate(); res(m.result); }
      if (m.type === 'ERROR') { w.terminate(); rej(new Error(m.message)); }
    };
    w.onerror = e => { w.terminate(); rej(new Error(e.message || 'Worker error')); };
    w.postMessage(payload);
  });
}

/*--------- WORKERS ONE-SHOT (TMS, ARRIBOS, REGISTROS, LABELLESS) ---------*/

const TMS_URL = './workers/tms.worker.js?v=20261029-dot-1';
const REG_URL = './workers/registros.worker.js?v=20261028-types-hourly-1';

export const runT = (site, onp) => state.sites[site].files.tms
  ? onceWorker(TMS_URL, {
      type: 'PROCESS_TMS',
      file: state.sites[site].files.tms,
      labFile: state.sites[site].files.labelless || null,
      config: {
        selectedDate: state.config.analysisDate,
        cptStart: state.config.cptStart[site],
        huStartHour: huConfig(site).huStartHour ?? 7,
        huCutoff: huConfig(site).huCutoff || null
      }
    }, onp)
  : Promise.resolve(null);

export const runA = (site, onp) => state.sites[site].files.arrivals
  ? onceWorker('./workers/arrivals.worker.js', { type: 'PROCESS_ARRIVALS', file: state.sites[site].files.arrivals, day: state.config.analysisDate }, onp)
  : Promise.resolve(null);

export const runR = (site, onp) => state.sites[site].files.registros
  ? onceWorker(REG_URL, { type: 'PROCESS_REGISTROS', file: state.sites[site].files.registros, day: state.config.analysisDate }, onp)
  : Promise.resolve(null);

export const runL = (site, onp) => state.sites[site].files.labelless
  ? onceWorker('./workers/labelless.worker.js', { type: 'PROCESS_LAB', file: state.sites[site].files.labelless }, onp)
  : Promise.resolve(null);

/*--------- WORKER JORNALES (PERSISTENTE) ---------*/

export function jw(site) {
  return jworkers[site] || (jworkers[site] = new Worker('./workers/jornales.worker.js'));
}

export function loadJ(site, file) {
  jready[site] = false;
  const w = jw(site);
  return new Promise((res, rej) => {
    const h = e => {
      const m = e.data || {};
      if (m.type === 'LOADED') {
        w.removeEventListener('message', h);
        jready[site] = true;
        state.sites[site].jornalesMeta = m.meta;
        fillGer();
        $('message').textContent = `Jornales ${names[site]} indexados: ${new Intl.NumberFormat('es-AR').format(m.meta.records)} registros.`;
        res(m.meta);
      } else if (m.type === 'ERROR') {
        w.removeEventListener('message', h);
        rej(new Error(m.message));
      }
    };
    w.addEventListener('message', h);
    w.postMessage({ type: 'LOAD_JORNALES', file });
  });
}

export function calcJ(site, day, ger, d1, d2) {
  if (!jready[site]) return Promise.resolve(null);
  const w = jw(site);
  return new Promise((res, rej) => {
    const h = e => {
      const m = e.data || {};
      if (m.type === 'ANALYSIS') { w.removeEventListener('message', h); res(m.result); }
      else if (m.type === 'ERROR') { w.removeEventListener('message', h); rej(new Error(m.message)); }
    };
    w.addEventListener('message', h);
    w.postMessage({ type: 'ANALYZE_JORNALES', day, ger, d1, d2 });
  });
}

export function fillGer() {
  const s = new Set();
  for (const site of ['soldati', 'echeverria'])
    for (const g of state.sites[site].jornalesMeta?.gerencias || [])
      s.add(g);
  $('jorGer').innerHTML = '<option value="__ALL__">Todas</option>' + [...s].sort().map(x => `<option>${x}</option>`).join('');
  const op = [...s].find(x => x.toLowerCase() === 'opsemli');
  if (op) $('jorGer').value = op;
}

/*--------- PROGRESO Y ESTADO DE ARCHIVOS ---------*/

export function progress(p, msg) {
  $('progress').classList.remove('hidden');
  $('progressBar').style.width = Math.max(0, Math.min(100, p)) + '%';
  $('message').textContent = msg;
}

export function status(site) {
  const id = site === 'soldati' ? 'statusS' : 'statusE';
  const a = Object.entries(state.sites[site].files).filter(([, f]) => f).map(([k, f]) => k + ': ' + f.name);
  $(id).textContent = a.length ? a.join(' · ') : 'Sin archivos cargados.';
}
