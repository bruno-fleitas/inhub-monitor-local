import { $ } from '../core/dom.js';
import { nf, pf, pct } from '../core/formatters.js';
import { state, names } from '../core/state.js';
import { huConfig } from '../core/config.js';
import { hoursUntil, hoursToTarget } from '../core/time.js';
import { huActiveUsers } from '../domain/tms.js';
import { cut } from '../domain/arrivals.js';

export function mailHTML() {
  let h = '<div class="mail-sheet"><p>Estimados,</p><p>Les comparto un breve resumen operativo de ambos sites:</p>';
  for (const site of ['soldati', 'echeverria']) {
    const d = state.sites[site], t = d.tms, a = d.arrivals, q = d.jornalesResult, r = d.registros, lab = d.files.labelless ? (t?.labelless || d.labellessStandalone) : null;
    if (!t && !a && !q && !r && !lab) continue;
    const fc = Number($(site === 'soldati' ? 'fcS' : 'fcE')?.value) || 0;
    h += `<h2>➤ ${names[site].toUpperCase()}</h2>`;
    if (t) {
      const pure = Math.max(0, t.vol - t.big - t.sb), base = Math.max(0, t.totalConPost - t.big - t.sb), ht = t.hu?.totals, ha = ht?.etiquetado ? pct(ht.abierto + ht.cerrado, ht.etiquetado) : 0;
      h += `<h3>INHUB</h3><p>• Proyectado 09:00 hs: ${fc ? nf.format(fc) : 'No informado'}</p><p>• Real Inhub c/Post CPT: ${nf.format(t.totalConPost)}${fc ? ' | ' + pf.format(pct(t.totalConPost, fc)) + '%' : ''}</p><p>• Real Inhub s/Post CPT: ${nf.format(t.totalSinPost)}</p>
      <h3>MIX OPERATIVO</h3><p>• Voluminoso c/Bigger + SuperBigger: ${nf.format(t.vol)} | ${pf.format(pct(t.vol, t.totalConPost))}%</p><p>• Voluminoso s/Bigger + SuperBigger: ${nf.format(pure)} | ${pf.format(pct(pure, base))}%</p><p>• Bigger: ${nf.format(t.big)}</p><p>• SuperBigger: ${nf.format(t.sb)}</p><p>• MELI Air: ${nf.format(t.meli.arrivals)} arribados · ${nf.format(t.meli.processed)} HU · ${pf.format(pct(t.meli.processed, t.meli.arrivals))}%</p>`;
      if (lab?.processed != null) h += `<p>• Labelless: ${nf.format(lab.arrived)} arribados · ${nf.format(lab.processed)} HU · ${pf.format(pct(lab.processed, lab.arrived))}%</p>`;
      if (ht) {
        const hc = huConfig(site), act = new Set(huActiveUsers(site, t).map(x => x.user)).size, hrs = hoursToTarget(t.hu?.maxOutTs, hc.targetTime), need = hrs > 0 ? Math.ceil((ht.pendiente / hrs) / Math.max(1, hc.prod)) : 0;
        h += `<h3>CONTROL HU</h3><p>• Etiquetado: ${nf.format(ht.etiquetado)} · HU abierto: ${nf.format(ht.abierto)} · HU cerrado: ${nf.format(ht.cerrado)} · Pendiente: ${nf.format(ht.pendiente)}</p><p>• Avance: ${pf.format(ha)}% · Conectados: ${nf.format(act)} · Necesarios: ${nf.format(need)} · Brecha: ${act - need >= 0 ? '+' : ''}${nf.format(act - need)} · Objetivo: ${hc.targetTime}</p>`;
      }
    }
    if (r || t) { const target = state.config.speedTargetTime?.[site] || '22:00', last = r?.lastTs || t?.maxInTs || null, hrs = hoursUntil(last, target), b = t?.totalConPost || 0, req = fc && hrs > 0 ? Math.max(0, fc - b) / hrs : 0; h += `<h3>VELOCIDAD</h3><p>• Velocidad real descarga: ${r ? nf.format(Math.round(r.currentSpeed || 0)) + ' pza/h' : 'No disponible'}</p><p>• Velocidad necesaria a ${target}: ${fc && t ? nf.format(Math.ceil(req)) + ' pza/h' : 'No disponible'}</p>`; }
    if (a) h += `<h3>ARRIBOS</h3><p>• Vehículos: ${nf.format(a.veh)} · Paquetes: ${nf.format(a.totalShip)}</p><p>• Semi ${pf.format(pct(a.semi, a.veh))}% · Chasis ${pf.format(pct(a.chasis, a.veh))}% · Camioneta ${pf.format(pct(a.camionetaOther ?? a.camioneta, a.veh))}% · Camioneta MELI ${pf.format(pct(a.camionetaMeli || 0, a.veh))}%</p><p>• Paquetes: Pre16 ${pf.format(cut(a, state.config.curveStart, 16, 'packages'))}% · Pre18 ${pf.format(cut(a, state.config.curveStart, 18, 'packages'))}% · Pre20 ${pf.format(cut(a, state.config.curveStart, 20, 'packages'))}% · Post20 ${pf.format(100 - cut(a, state.config.curveStart, 20, 'packages'))}%</p><p>• Vehículos: Pre16 ${pf.format(cut(a, state.config.curveStart, 16, 'vehicles'))}% · Pre18 ${pf.format(cut(a, state.config.curveStart, 18, 'vehicles'))}% · Pre20 ${pf.format(cut(a, state.config.curveStart, 20, 'vehicles'))}% · Post20 ${pf.format(100 - cut(a, state.config.curveStart, 20, 'vehicles'))}%</p>`;
    if (q) h += `<h3>DOTACIÓN / JORNALES</h3><p>• Jornales: ${nf.format(q.total)} · Nuevo -${q.d1}: ${nf.format(q.a)} (${pf.format(pct(q.a, q.total))}%) · Nuevo ${q.d1 + 1}-${q.d2}: ${nf.format(q.b)} (${pf.format(pct(q.b, q.total))}%) · Antiguo: ${nf.format(q.c)} (${pf.format(pct(q.c, q.total))}%)</p>`;
  }
  return h + '<p>Cualquier consulta quedo a disposición.<br>Saludos</p></div>';
}

export function mail() {
  $('mailView').innerHTML = mailHTML();
}

export function bindMailCopy() {
  $('copyRich').onclick = async () => {
    const html = mailHTML(), d = document.createElement('div'); d.innerHTML = html; const plain = d.innerText;
    try { await navigator.clipboard.write([new ClipboardItem({ 'text/html': new Blob([html], { type: 'text/html' }), 'text/plain': new Blob([plain], { type: 'text/plain' }) })]); }
    catch { await navigator.clipboard.writeText(plain); }
  };
  $('copyPlain').onclick = async () => { const d = document.createElement('div'); d.innerHTML = mailHTML(); await navigator.clipboard.writeText(d.innerText); };
}
