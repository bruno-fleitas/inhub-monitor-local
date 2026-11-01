import { $ } from '../core/dom.js';

export function injectUI() {
  for (const [site, suf] of [['soldati', 'S'], ['echeverria', 'E']]) {
    const grid = $('status' + suf).closest('article').querySelector('.source-grid');
    grid.insertAdjacentHTML('afterbegin', `<label>Proyectado 09:00<input id="fc${suf}" type="number" placeholder="Ej. 119000"></label><label>Inicio s/Post CPT<select id="cpt${suf}"><option>8</option><option>9</option><option selected>10</option><option>11</option><option>12</option></select></label>`);
  }
  $('processBtn').insertAdjacentHTML('afterend', ' <button id="exportBtn" class="ghost">Exportar consolidado CSV</button> <button id="pptBtn" class="primary">Exportar PowerPoint</button>');
  $('view-jornales').innerHTML = '<article class="card"><h2>Dotación / Jornales</h2><div class="toolbar"><label>Fecha<input id="jorDate" type="date"></label><label>Gerencia<select id="jorGer"><option value="__ALL__">Todas</option></select></label><label>Primer rango hasta<input id="jorD1" type="number" value="3" min="0"></label><label>Segundo rango hasta<input id="jorD2" type="number" value="10" min="1"></label><button id="jorRun" class="primary">Analizar Jornales</button></div><div id="jornalesView" class="empty">Cargá uno o ambos históricos.</div></article>';
  $('view-mail').innerHTML = '<article class="card"><div class="toolbar"><button id="copyRich" class="primary">Copiar mail con formato</button><button id="copyPlain" class="secondary">Copiar texto</button></div><div id="mailView" class="mail-preview"><div class="empty">Procesá archivos.</div></div></article>';
  $('view-reporte').innerHTML = '<article class="card"><div class="report-head"><div><h2>Resumen gerencial de jornada</h2><p>Se arma automáticamente con los módulos que estén cargados. No exige tener ambos sites ni todas las fuentes.</p></div><button id="pptBtn2" class="primary">Exportar PowerPoint</button></div><div id="reportView" class="report-preview"><div class="empty">Procesá uno o más archivos.</div></div></article>';
}
