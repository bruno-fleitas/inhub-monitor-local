export const state = {
  sites: {
    soldati: { files:{}, tms:null, arrivals:null, labelless:null, labellessStandalone:null, jornales:null, registros:null },
    echeverria: { files:{}, tms:null, arrivals:null, labelless:null, labellessStandalone:null, jornales:null, registros:null }
  },
  config: {
    analysisDate: null,
    curveStart: 9,
    cptStart: { soldati:10, echeverria:10 },
    tenureCut1: 3,
    tenureCut2: 10,
    speedTargetTime: { soldati:'22:00', echeverria:'22:00' }
  }
};

export function setFile(site,type,file){
  state.sites[site].files[type]=file || null;
}
