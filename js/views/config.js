import { $ } from '../core/dom.js';
import { esc } from '../core/formatters.js';
import { state, names } from '../core/state.js';
import { masters, save } from '../core/config.js';
import { subca } from './subca.js';

export function masterUI() {
  let h = '';
  for (const site of ['soldati', 'echeverria'])
    h += '<div class="card"><h3>' + names[site] + '</h3><div class="master-actions"><button class="smallbtn primary" data-add="' + site + '">+ Agregar</button><button class="smallbtn ghost" data-reset="' + site + '">Restaurar</button></div><div class="scroll"><table><tr><th>SubCA</th><th>Ola</th><th>CPT</th><th>Indicador</th><th></th></tr>' + masters[site].map((x, i) => '<tr><td><input data-site="' + site + '" data-i="' + i + '" data-f="subca" value="' + esc(x.subca) + '"></td><td><input data-site="' + site + '" data-i="' + i + '" data-f="ola" value="' + esc(x.ola) + '"></td><td><input type="number" data-site="' + site + '" data-i="' + i + '" data-f="cpt" value="' + x.cpt + '"></td><td><select data-site="' + site + '" data-i="' + i + '" data-f="indicador"><option ' + (x.indicador === 'prioritario' ? 'selected' : '') + '>prioritario</option><option ' + (x.indicador === 'standard' ? 'selected' : '') + '>standard</option></select></td><td><button class="smallbtn danger" data-del="' + site + '" data-i="' + i + '">X</button></td></tr>').join('') + '</table></div></div>';
  $('configView').innerHTML = h;
  document.querySelectorAll('[data-f]').forEach(el => el.onchange = () => { const s = el.dataset.site, i = +el.dataset.i, f = el.dataset.f; masters[s][i][f] = f === 'cpt' ? Number(el.value) : el.value.trim(); save(s); subca(); });
  document.querySelectorAll('[data-del]').forEach(b => b.onclick = () => { masters[b.dataset.del].splice(+b.dataset.i, 1); save(b.dataset.del); masterUI(); subca(); });
  document.querySelectorAll('[data-add]').forEach(b => b.onclick = () => { masters[b.dataset.add].push({ subca: 'NUEVA', ola: '', cpt: 0, indicador: 'prioritario' }); save(b.dataset.add); masterUI(); });
  document.querySelectorAll('[data-reset]').forEach(b => b.onclick = () => { masters[b.dataset.reset] = structuredClone(b.dataset.reset === 'soldati' ? state.defaults.masterS : state.defaults.masterE); save(b.dataset.reset); masterUI(); subca(); });
}
