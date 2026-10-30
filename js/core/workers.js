/**
 * @fileoverview Worker orchestration and progress/status UI helpers.
 *
 * Core layer of the hexagonal architecture.
 * Wraps Web Worker creation (one-shot and persistent) behind a clean async API.
 * Also provides progress bar and file-status DOM updates used during processing.
 *
 * Dependencies: core/state.js, core/dom.js
 *
 * Exports: onceWorker, runT, runA, runR, runL, jw, loadJ, calcJ, fillGer, jready, progress, status
 */

import { state } from './state.js';
import { $ } from './dom.js';
import { names } from './state.js';
import { huConfig } from './config.js';

/** Jornales worker instances (persistent, reused across analyses). */
const jworkers = {};

/** Jornales ready state per site. */
export const jready = { soldati: false, echeverria: false };

/**
 * Run a one-shot worker: post a message, resolve on RESULT, reject on ERROR.
 * Reports progress via callback.
 * @param {string} url - Worker script URL.
 * @param {*} payload - Message to post to the worker.
 * @param {function(number):void} [onp] - Progress callback.
 * @returns {Promise<*>} The worker result.
 */
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

/** @private Worker URL constants with cache-busting version strings. */
const TMS_URL = './workers/tms.worker.js?v=20261029-dot-1';
const REG_URL = './workers/registros.worker.js?v=20261028-types-hourly-1';

/**
 * Process TMS file via worker.
 * @param {string} site - 'soldati' or 'echeverria'.
 * @param {function(number):void} [onp] - Progress callback.
 * @returns {Promise<object|null>} TMS result or null if no file.
 */
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

/**
 * Process arrivals file via worker.
 * @param {string} site - 'soldati' or 'echeverria'.
 * @param {function(number):void} [onp] - Progress callback.
 * @returns {Promise<object|null>} Arrivals result or null.
 */
export const runA = (site, onp) => state.sites[site].files.arrivals
  ? onceWorker('./workers/arrivals.worker.js', { type: 'PROCESS_ARRIVALS', file: state.sites[site].files.arrivals, day: state.config.analysisDate }, onp)
  : Promise.resolve(null);

/**
 * Process registros (Easy Docking) file via worker.
 * @param {string} site - 'soldati' or 'echeverria'.
 * @param {function(number):void} [onp] - Progress callback.
 * @returns {Promise<object|null>} Registros result or null.
 */
export const runR = (site, onp) => state.sites[site].files.registros
  ? onceWorker(REG_URL, { type: 'PROCESS_REGISTROS', file: state.sites[site].files.registros, day: state.config.analysisDate }, onp)
  : Promise.resolve(null);

/**
 * Process labelless file via worker (standalone count).
 * @param {string} site - 'soldati' or 'echeverria'.
 * @param {function(number):void} [onp] - Progress callback.
 * @returns {Promise<object|null>} Labelless result or null.
 */
export const runL = (site, onp) => state.sites[site].files.labelless
  ? onceWorker('./workers/labelless.worker.js', { type: 'PROCESS_LAB', file: state.sites[site].files.labelless }, onp)
  : Promise.resolve(null);

/**
 * Get or create the persistent jornales worker for a site.
 * @param {string} site - 'soldati' or 'echeverria'.
 * @returns {Worker} The jornales worker.
 */
export function jw(site) {
  return jworkers[site] || (jworkers[site] = new Worker('./workers/jornales.worker.js'));
}

/**
 * Load a jornales file into the persistent worker (indexing phase).
 * @param {string} site - 'soldati' or 'echeverria'.
 * @param {File} file - The jornales Excel/CSV file.
 * @returns {Promise<object>} Metadata about indexed records.
 */
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

/**
 * Run jornales analysis for a day/gerencia/ranges via the persistent worker.
 * @param {string} site - 'soldati' or 'echeverria'.
 * @param {string} day - Date string "YYYY-MM-DD".
 * @param {string} ger - Gerencia filter or '__ALL__'.
 * @param {number} d1 - First tenure cut in days.
 * @param {number} d2 - Second tenure cut in days.
 * @returns {Promise<object|null>} Analysis result or null if not ready.
 */
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

/**
 * Populate the gerencia dropdown from jornales metadata across sites.
 */
export function fillGer() {
  const s = new Set();
  for (const site of ['soldati', 'echeverria'])
    for (const g of state.sites[site].jornalesMeta?.gerencias || [])
      s.add(g);
  $('jorGer').innerHTML = '<option value="__ALL__">Todas</option>' + [...s].sort().map(x => `<option>${x}</option>`).join('');
  const op = [...s].find(x => x.toLowerCase() === 'opsemli');
  if (op) $('jorGer').value = op;
}

/**
 * Update the progress bar and message text.
 * @param {number} p - Progress percentage (0–100).
 * @param {string} msg - Status message.
 */
export function progress(p, msg) {
  $('progress').classList.remove('hidden');
  $('progressBar').style.width = Math.max(0, Math.min(100, p)) + '%';
  $('message').textContent = msg;
}

/**
 * Update the file status text for a site.
 * @param {string} site - 'soldati' or 'echeverria'.
 */
export function status(site) {
  const id = site === 'soldati' ? 'statusS' : 'statusE';
  const a = Object.entries(state.sites[site].files).filter(([, f]) => f).map(([k, f]) => k + ': ' + f.name);
  $(id).textContent = a.length ? a.join(' · ') : 'Sin archivos cargados.';
}
