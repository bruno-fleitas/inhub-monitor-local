import {state,setFile} from './state.js';

const $=id=>document.getElementById(id);
const nf=new Intl.NumberFormat('es-AR');
const pf=new Intl.NumberFormat('es-AR',{minimumFractionDigits:1,maximumFractionDigits:1});

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

function runTmsWorker(file,config,onProgress){
  return new Promise((resolve,reject)=>{
    const worker=new Worker('./workers/tms.worker.js',{type:'module'});
    worker.onmessage=e=>{
      const m=e.data||{};
      if(m.type==='PROGRESS') onProgress?.(m.progress||0);
      if(m.type==='RESULT'){ worker.terminate(); resolve(m.result); }
      if(m.type==='ERROR'){ worker.terminate(); reject(new Error(m.message||'Error procesando TMS')); }
    };
    worker.onerror=e=>{ worker.terminate(); reject(e.error||new Error(e.message||'Error en TMS Worker')); };
    worker.postMessage({type:'PROCESS_TMS',file,config});
  });
}

function renderSummary(results){
  const cards=[];
  for(const [siteName,data] of results){
    if(!data) continue;
    const pure=Math.max(0,data.vol-data.big-data.sb);
    const pureBase=Math.max(0,data.totalConPost-data.big-data.sb);
    const purePct=pureBase?pure/pureBase*100:0;
    cards.push(
      ['Site',siteName],
      ['Inhub c/Post',nf.format(data.totalConPost)],
      ['Inhub s/Post',nf.format(data.totalSinPost)],
      ['Voluminoso',nf.format(data.vol)],
      ['Vol. s/B/SB',`${nf.format(pure)} · ${pf.format(purePct)}%`],
      ['Bigger',nf.format(data.big)],
      ['SuperBigger',nf.format(data.sb)],
      ['MELI Air arribado',nf.format(data.meli?.arrivals||0)],
      ['MELI Air HU',nf.format(data.meli?.processed||0)]
    );
  }
  $('summaryCards').innerHTML=cards.map(([label,value])=>
    `<div class="kpi"><span>${label}</span><b>${value}</b></div>`
  ).join('');
}

$('processBtn').addEventListener('click',async()=>{
  state.config.analysisDate=$('analysisDate').value||null;
  state.config.curveStart=Number($('curveStart').value||9);

  const jobs=[];
  if(state.sites.soldati.files.tms){
    jobs.push({
      site:'Soldati',
      key:'soldati',
      file:state.sites.soldati.files.tms,
      cptStart:state.config.cptStart.soldati
    });
  }
  if(state.sites.echeverria.files.tms){
    jobs.push({
      site:'Esteban Echeverría',
      key:'echeverria',
      file:state.sites.echeverria.files.tms,
      cptStart:state.config.cptStart.echeverria
    });
  }

  if(!jobs.length){
    $('message').textContent='Cargá al menos un TMS antes de procesar.';
    return;
  }

  try{
    $('processBtn').disabled=true;
    $('engineStatus').textContent='Procesando';
    const results=[];

    for(let i=0;i<jobs.length;i++){
      const job=jobs[i];
      const base=(i/jobs.length)*100;
      const span=100/jobs.length;
      const result=await runTmsWorker(job.file,{
        selectedDate:state.config.analysisDate,
        cptStart:job.cptStart
      },p=>{
        setProgress(base+(p/100)*span,`Procesando TMS ${job.site}… ${p}%`);
      });
      state.sites[job.key].tms=result;
      results.push([job.site,result]);
    }

    renderSummary(results);
    setProgress(100,'TMS procesado en segundo plano. La interfaz permaneció disponible.');
    $('engineStatus').textContent='Motor listo';
    setTimeout(()=>$('progress').classList.add('hidden'),900);
  }catch(err){
    $('engineStatus').textContent='Error';
    $('message').textContent=err.message||String(err);
  }finally{
    $('processBtn').disabled=false;
  }
});
