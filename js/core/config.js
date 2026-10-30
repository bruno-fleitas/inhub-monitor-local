import { state } from './state.js';

export const masters = { soldati: [], echeverria: [] };

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

export function save(site) {
  localStorage.setItem(site === 'soldati' ? 'inhubMasterS' : 'inhubMasterE', JSON.stringify(masters[site]));
}

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
