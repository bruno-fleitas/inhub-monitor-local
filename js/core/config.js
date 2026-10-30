/**
 * @fileoverview Master configuration and HU configuration management.
 *
 * Core layer of the hexagonal architecture.
 * Handles loading and persistence of SubCA master tables (one per site) and
 * provides lazy-initialised HU configuration per site.
 *
 * Dependencies: core/state.js
 *
 * Exports: masters, initMasters, save, huConfig
 */

import { state } from './state.js';

/**
 * Master SubCA configuration tables per site.
 * Populated by {@link initMasters} from JSON config files or localStorage.
 * @type {object<string, Array<{subca:string,ola:string,cpt:number,indicador:string}>>}
 */
export const masters = { soldati: [], echeverria: [] };

/**
 * Load master SubCA tables from JSON config files (with localStorage cache).
 * Stores defaults in state.defaults for the reset button.
 * @returns {Promise<void>}
 */
export async function initMasters() {
  const [s, e] = await Promise.all([
    fetch('./js/config/masterS.json').then(r => r.json()),
    fetch('./js/config/masterE.json').then(r => r.json())
  ]);
  state.defaults = { masterS: s, masterE: e };
  const masterVersion = '2026-10-27-v2';
  if (localStorage.getItem('inhubMasterVersion') !== masterVersion) {
    localStorage.removeItem('inhubMasterS');
    localStorage.removeItem('inhubMasterE');
    localStorage.setItem('inhubMasterVersion', masterVersion);
  }
  masters.soldati = JSON.parse(localStorage.getItem('inhubMasterS') || 'null') || s;
  masters.echeverria = JSON.parse(localStorage.getItem('inhubMasterE') || 'null') || e;
}

/**
 * Persist a site's master table to localStorage.
 * @param {string} site - 'soldati' or 'echeverria'.
 */
export function save(site) {
  localStorage.setItem(site === 'soldati' ? 'inhubMasterS' : 'inhubMasterE', JSON.stringify(masters[site]));
}

/**
 * Get (or lazily create) the HU configuration object for a site.
 * Mutates state.config.hu to ensure all default fields exist.
 * @param {string} site - 'soldati' or 'echeverria'.
 * @returns {object} The HU configuration for the site.
 */
export function huConfig(site) {
  state.config.hu ??= {};
  state.config.hu[site] ??= {
    prod: 190, objective: 65, cptObjective: 99.5,
    targetTime: '05:00', activeMinutes: 10,
    huStartHour: 7, huCutoff: '', connectedMode: 'unique',
    targetPct: 65, inhubStartHour: 0
  };
  state.config.hu[site].objective ??= 65;
  state.config.hu[site].targetPct ??= 65;
  state.config.hu[site].inhubStartHour ??= 0;
  return state.config.hu[site];
}
