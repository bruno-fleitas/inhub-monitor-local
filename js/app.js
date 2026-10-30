/**
 * @fileoverview Application entry point and composition root.
 *
 * This is the only script loaded by index.html. It imports and wires together
 * all modules of the hexagonal architecture:
 *
 *   core/       — shared infrastructure (state, formatters, workers, config, time, dom)
 *   domain/     — pure business logic (tms, arrivals, jornales, storage)
 *   views/      — UI rendering functions (one per dashboard view)
 *   ui/         — UI infrastructure (navigation, file bindings, dynamic DOM injection)
 *   workers/    — Web Workers (unchanged, consumed via core/workers.js)
 *
 * Responsibilities:
 *   1. Inject dynamic UI elements and bind navigation/file inputs.
 *   2. Provide the global `renderAll()` function that re-renders all views.
 *   3. Bind the main "Procesar" button to orchestrate worker execution.
 *   4. Bind export/PPT/jornales/date buttons.
 *   5. Load master config and perform initial render.
 *
 * @module app
 */

// ── Core ──
import { state, dotExclusions } from './core/state.js';
import { $ } from './core/dom.js';
import { nf } from './core/formatters.js';
import { initMasters } from './core/config.js';
import { runT, runA, runR, runL, progress, status, jready } from './core/workers.js';

// ── Domain (re-export for views that need lazy injection) ──

// ── Views ──
import { summary } from './views/summary.js';
import { operation } from './views/operation.js';
import { huControl, setRenderAll as setHuRenderAll, setRunT } from './views/huControl.js';
import { curves } from './views/curves.js';
import { mix } from './views/mix.js';
import { subca } from './views/subca.js';
import { jornales, runJ, setRenderAll as setJorRenderAll } from './views/jornales.js';
import { mail, bindMailCopy } from './views/mail.js';
import { reportPreview, doPpt, exportCsv } from './views/report.js';
import { dockDashboard } from './views/docks.js';
import { planVsReal } from './views/planVsReal.js';
import { huGoalView } from './views/huGoal.js';
import { masterUI } from './views/config.js';

// ── UI ──
import { injectUI } from './ui/injectUI.js';
import { initNav } from './ui/nav.js';
import { initFileBindings } from './ui/fileBindings.js';

/**
 * Re-render all dashboard views. Called after processing, config changes,
 * and worker recomputation.
 */
function renderAll() {
  summary();
  operation();
  huControl();
  curves();
  huGoalView();
  planVsReal();
  dockDashboard();
  mix();
  subca();
  jornales();
  mail();
  reportPreview();
}

// Inject lazy renderAll and runT into views that need them (breaks circular deps)
setHuRenderAll(renderAll);
setRunT(runT);
setJorRenderAll(renderAll);

// ── Initialise UI ──
injectUI();
initNav();
initFileBindings();

// ── Bind action buttons ──
$('jorRun').onclick = runJ;
$('analysisDate').onchange = () => { $('jorDate').value = $('analysisDate').value; };
bindMailCopy();

$('exportBtn').onclick = exportCsv;
$('pptBtn').onclick = () => doPpt($('pptBtn'));
$('pptBtn2').onclick = () => doPpt($('pptBtn2'));

// ── Main process button ──
const siteNames = { soldati: 'Soldati', echeverria: 'Esteban Echeverría' };

$('processBtn').onclick = async () => {
  const anyFile = ['soldati', 'echeverria'].some(site => Object.values(state.sites[site].files).some(Boolean));
  if (!anyFile) { $('message').textContent = 'Cargá al menos un archivo.'; return; }
  state.config.analysisDate = $('analysisDate').value || null;
  state.config.curveStart = +$('curveStart').value || 9;
  state.config.cptStart.soldati = +$('cptS').value || 10;
  state.config.cptStart.echeverria = +$('cptE').value || 10;
  if ($('jorDate')) $('jorDate').value = state.config.analysisDate || $('jorDate').value;
  for (const site of ['soldati', 'echeverria']) dotExclusions[site].clear();
  const jobs = [];
  for (const site of ['soldati', 'echeverria']) {
    if (state.sites[site].files.tms) jobs.push([site, 'tms']);
    if (state.sites[site].files.arrivals) jobs.push([site, 'arr']);
    if (state.sites[site].files.registros) jobs.push([site, 'reg']);
    if (state.sites[site].files.labelless) jobs.push([site, 'lab']);
  }
  try {
    $('processBtn').disabled = true; $('engineStatus').textContent = 'Procesando'; let i = 0;
    for (const [site, type] of jobs) {
      const span = 100 / Math.max(1, jobs.length), base = i * span;
      if (type === 'tms') state.sites[site].tms = await runT(site, p => progress(base + p / 100 * span, `Procesando TMS ${siteNames[site]}… ${p}%`));
      else if (type === 'arr') state.sites[site].arrivals = await runA(site, p => progress(base + p / 100 * span, `Procesando Arribos ${siteNames[site]}…`));
      else if (type === 'reg') state.sites[site].registros = await runR(site, p => progress(base + p / 100 * span, `Procesando registros ${siteNames[site]}…`));
      else if (type === 'lab') state.sites[site].labellessStandalone = await runL(site, p => progress(base + p / 100 * span, `Procesando Labelless ${siteNames[site]}…`));
      i++;
    }
    if (jready.soldati || jready.echeverria) await runJ(); else renderAll();
    progress(100, 'Todo lo cargado fue procesado.'); $('engineStatus').textContent = 'Motor listo'; setTimeout(() => $('progress').classList.add('hidden'), 800);
  } catch (e) { $('engineStatus').textContent = 'Error'; $('message').textContent = 'Error: ' + e.message; }
  finally { $('processBtn').disabled = false; }
};

// ── Boot ──
await initMasters();
masterUI();
renderAll();
