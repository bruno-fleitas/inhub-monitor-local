import {state,setFile} from './state.js';

const $=id=>document.getElementById(id);

document.querySelectorAll('.nav').forEach(btn=>{
  btn.addEventListener('click',()=>{
    document.querySelectorAll('.nav').forEach(x=>x.classList.remove('active'));
    document.querySelectorAll('.view').forEach(x=>x.classList.remove('active'));
    btn.classList.add('active');
    $('view-'+btn.dataset.view).classList.add('active');
  });
});

const bindings=[
  ['tmsS','soldati','tms'],['arrS','soldati','arrivals'],['labS','soldati','labelless'],['jorS','soldati','jornales'],
  ['tmsE','echeverria','tms'],['arrE','echeverria','arrivals'],['labE','echeverria','labelless'],['jorE','echeverria','jornales']
];

for(const [id,site,type] of bindings){
  $(id).addEventListener('change',e=>{
    setFile(site,type,e.target.files?.[0]||null);
    refreshSourceStatus(site);
  });
}

function refreshSourceStatus(site){
  const target=site==='soldati'?'statusS':'statusE';
  const names=Object.values(state.sites[site].files).filter(Boolean).map(f=>f.name);
  $(target).textContent=names.length ? `${names.length} archivo(s) listo(s): ${names.join(' · ')}` : 'Sin archivos cargados.';
}

function setProgress(pct,msg){
  $('progress').classList.remove('hidden');
  $('progressBar').style.width=`${pct}%`;
  $('message').textContent=msg;
}

$('processBtn').addEventListener('click',async()=>{
  state.config.analysisDate=$('analysisDate').value||null;
  state.config.curveStart=Number($('curveStart').value||9);

  const hasAny=Object.values(state.sites).some(site=>Object.values(site.files).some(Boolean));
  if(!hasAny){
    $('message').textContent='Cargá al menos un archivo antes de procesar.';
    return;
  }

  setProgress(10,'Preparando procesamiento local…');

  // La migración de cada motor se incorpora por módulo.
  // La interfaz ya queda separada del procesamiento pesado.
  await new Promise(r=>setTimeout(r,120));
  setProgress(100,'Base modular lista. Próximo paso: conectar los parsers y workers del monitor existente.');

  setTimeout(()=>$('progress').classList.add('hidden'),600);
});
