export const state = {
  sites: {
    soldati: { files:{}, tms:null, arrivals:null, labelless:null, jornales:null },
    echeverria: { files:{}, tms:null, arrivals:null, labelless:null, jornales:null }
  },
  config: {
    analysisDate: null,
    curveStart: 9,
    cptStart: { soldati:10, echeverria:10 },
    tenureCut1: 3,
    tenureCut2: 10
  }
};

export function setFile(site,type,file){
  state.sites[site].files[type]=file || null;
}
