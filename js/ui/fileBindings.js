import { setFile, state } from '../core/state.js';
import { status, loadJ } from '../core/workers.js';
import { $ } from '../core/dom.js';

export function initFileBindings() {
  const bindings = [
    ['tmsS', 'soldati', 'tms'], ['arrS', 'soldati', 'arrivals'], ['labS', 'soldati', 'labelless'],
    ['jorS', 'soldati', 'jornales'], ['regS', 'soldati', 'registros'],
    ['tmsE', 'echeverria', 'tms'], ['arrE', 'echeverria', 'arrivals'], ['labE', 'echeverria', 'labelless'],
    ['jorE', 'echeverria', 'jornales'], ['regE', 'echeverria', 'registros']
  ];
  for (const [id, site, type] of bindings)
    $(id).onchange = async e => {
      const f = e.target.files?.[0] || null;
      setFile(site, type, f);
      status(site);
      if (type === 'jornales' && f) await loadJ(site, f);
    };
}
