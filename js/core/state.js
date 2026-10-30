export const names = { soldati: 'Soldati', echeverria: 'Esteban Echeverría' };

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

export const subcaFilters = {
  soldati: { q: '', subca: '__ALL__', ola: '__ALL__', cpt: '__ALL__', indicador: '__ALL__' },
  echeverria: { q: '', subca: '__ALL__', ola: '__ALL__', cpt: '__ALL__', indicador: '__ALL__' }
};

export const dotExclusions = { soldati: new Map(), echeverria: new Map() };

export function setFile(site, type, file) {
  state.sites[site].files[type] = file || null;
}
