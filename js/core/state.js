/**
 * @fileoverview Global application state, site constants and UI mutable state.
 *
 * Core layer of the hexagonal architecture. Centralises the shared state tree
 * that both domain logic and view modules read from and write to.
 *
 * Exports: state, setFile, names, subcaFilters, dotExclusions
 */

/** Human-readable site names for display. */
export const names = { soldati: 'Soldati', echeverria: 'Esteban Echeverría' };

/**
 * The central application state object.
 * @type {object}
 * @property {object} sites - Per-site data (soldati, echeverria).
 * @property {object} config - Global configuration (analysisDate, curveStart, etc.).
 */
export const state = {
  sites: {
    soldati: { files: {}, tms: null, arrivals: null, labelless: null, labellessStandalone: null, jornales: null, registros: null, jornalesMeta: null, jornalesResult: null },
    echeverria: { files: {}, tms: null, arrivals: null, labelless: null, labellessStandalone: null, jornales: null, registros: null, jornalesMeta: null, jornalesResult: null }
  },
  config: {
    analysisDate: null,
    curveStart: 9,
    cptStart: { soldati: 10, echeverria: 10 },
    tenureCut1: 3,
    tenureCut2: 10,
    speedTargetTime: { soldati: '22:00', echeverria: '22:00' }
  }
};

/**
 * SubCA filter state per site (UI state, not persisted).
 * @type {object}
 */
export const subcaFilters = {
  soldati: { q: '', subca: '__ALL__', ola: '__ALL__', cpt: '__ALL__', indicador: '__ALL__' },
  echeverria: { q: '', subca: '__ALL__', ola: '__ALL__', cpt: '__ALL__', indicador: '__ALL__' }
};

/**
 * DOT exclusion maps per site (mutable, session-only state).
 * Keys are shipment IDs, values are exclusion reason strings.
 * @type {object<string, Map<string, string>>}
 */
export const dotExclusions = { soldati: new Map(), echeverria: new Map() };

/**
 * Set or clear a file reference for a given site and file type.
 * @param {string} site - Site key ('soldati' or 'echeverria').
 * @param {string} type - File type ('tms', 'arrivals', 'labelless', 'jornales', 'registros').
 * @param {File|null} file - The File object or null to clear.
 */
export function setFile(site, type, file) {
  state.sites[site].files[type] = file || null;
}
