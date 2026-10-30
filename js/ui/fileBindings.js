/**
 * @fileoverview File input bindings: connect file inputs to state and workers.
 *
 * UI infrastructure layer of the hexagonal architecture.
 * Binds onchange handlers on file input elements to update state, show status,
 * and trigger jornales loading when a jornales file is selected.
 *
 * Dependencies: core/state.js, core/workers.js
 *
 * Exports: initFileBindings
 */

import { setFile, state } from '../core/state.js';
import { status, loadJ } from '../core/workers.js';
import { $ } from '../core/dom.js';

/**
 * Bind all file input elements to their handlers.
 * Each input updates the state, shows file status, and for jornales files,
 * triggers the async loadJ indexing phase.
 */
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
