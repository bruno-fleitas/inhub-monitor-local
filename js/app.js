import {state,setFile} from './state.js';
const $=id=>document.getElementById(id),nf=new Intl.NumberFormat('es-AR'),pf=new Intl.NumberFormat('es-AR',{minimumFractionDigits:1,maximumFractionDigits:1});
const pct=(a,b)=>b?a/b*100:0,esc=s=>String(s??'').replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[m]));
const names={soldati:'Soldati',echeverria:'Esteban Echeverría'};let masters={soldati:[],echeverria:[]},jworkers={},jready={soldati:false,echeverria:false};const subcaFilters={soldati:{q:'',subca:'__ALL__',ola:'__ALL__',cpt:'__ALL__',indicador:'__ALL__'},echeverria:{q:'',subca:'__ALL__',ola:'__ALL__',cpt:'__ALL__',indicador:'__ALL__'}};

function injectUI(){
 for(const [site,suf] of [['soldati','S'],['echeverria','E']]){const grid=$('status'+suf).closest('article').querySelector('.source-grid');grid.insertAdjacentHTML('afterbegin',`<label>Proyectado 09:00<input id="fc${suf}" type="number" placeholder="Ej. 119000"></label><label>Inicio s/Post CPT<select id="cpt${suf}"><option>8</option><option>9</option><option selected>10</option><option>11</option><option>12</option></select></label>`)}
 $('processBtn').insertAdjacentHTML('afterend',' <button id="exportBtn" class="ghost">Exportar consolidado CSV</button> <button id="pptBtn" class="primary">Exportar PowerPoint</button>');
 $('view-jornales').innerHTML=`<article class="card"><h2>Dotación / Jornales</h2><div class="toolbar"><label>Fecha<input id="jorDate" type="date"></label><label>Gerencia<select id="jorGer"><option value="__ALL__">Todas</option></select></label><label>Primer rango hasta<input id="jorD1" type="number" value="3" min="0"></label><label>Segundo rango hasta<input id="jorD2" type="number" value="10" min="1"></label><button id="jorRun" class="primary">Analizar Jornales</button></div><div id="jornalesView" class="empty">Cargá uno o ambos históricos.</div></article>`;
 $('view-mail').innerHTML=`<article class="card"><div class="toolbar"><button id="copyRich" class="primary">Copiar mail con formato</button><button id="copyPlain" class="secondary">Copiar texto</button></div><div id="mailView" class="mail-preview"><div class="empty">Procesá archivos.</div></div></article>`;
 $('view-reporte').innerHTML=`<article class="card"><div class="report-head"><div><h2>Resumen gerencial de jornada</h2><p>Se arma automáticamente con los módulos que estén cargados. No exige tener ambos sites ni todas las fuentes.</p></div><button id="pptBtn2" class="primary">Exportar PowerPoint</button></div><div id="reportView" class="report-preview"><div class="empty">Procesá uno o más archivos.</div></div></article>`;
}
injectUI();

document.querySelectorAll('.nav').forEach(b=>b.onclick=()=>{document.querySelectorAll('.nav').forEach(x=>x.classList.remove('active'));document.querySelectorAll('.view').forEach(x=>x.classList.remove('active'));b.classList.add('active');$('view-'+b.dataset.view).classList.add('active')});

const bindings=[['tmsS','soldati','tms'],['arrS','soldati','arrivals'],['labS','soldati','labelless'],['jorS','soldati','jornales'],['regS','soldati','registros'],['tmsE','echeverria','tms'],['arrE','echeverria','arrivals'],['labE','echeverria','labelless'],['jorE','echeverria','jornales'],['regE','echeverria','registros']];
for(const [id,site,type] of bindings)$(id).onchange=async e=>{const f=e.target.files?.[0]||null;setFile(site,type,f);status(site);if(type==='jornales'&&f)await loadJ(site,f)};
function status(site){const id=site==='soldati'?'statusS':'statusE',a=Object.entries(state.sites[site].files).filter(([,f])=>f).map(([k,f])=>k+': '+f.name);$(id).textContent=a.length?a.join(' · '):'Sin archivos cargados.'}
function progress(p,msg){$('progress').classList.remove('hidden');$('progressBar').style.width=Math.max(0,Math.min(100,p))+'%';$('message').textContent=msg}
function onceWorker(url,payload,onp){return new Promise((res,rej)=>{const w=new Worker(url);w.onmessage=e=>{const m=e.data||{};if(m.type==='PROGRESS')onp?.(m.progress||0);if(m.type==='RESULT'){w.terminate();res(m.result)}if(m.type==='ERROR'){w.terminate();rej(new Error(m.message))}};w.onerror=e=>{w.terminate();rej(new Error(e.message||'Worker error'))};w.postMessage(payload)})}
const runT=(site,onp)=>state.sites[site].files.tms?onceWorker('./workers/tms.worker.js',{type:'PROCESS_TMS',file:state.sites[site].files.tms,labFile:state.sites[site].files.labelless||null,config:{selectedDate:state.config.analysisDate,cptStart:state.config.cptStart[site],huStartHour:huConfig(site).huStartHour??7,huCutoff:huConfig(site).huCutoff||null}},onp):Promise.resolve(null);
const runA=(site,onp)=>state.sites[site].files.arrivals?onceWorker('./workers/arrivals.worker.js',{type:'PROCESS_ARRIVALS',file:state.sites[site].files.arrivals,day:state.config.analysisDate},onp):Promise.resolve(null);
const runR=(site,onp)=>state.sites[site].files.registros?onceWorker('./workers/registros.worker.js',{type:'PROCESS_REGISTROS',file:state.sites[site].files.registros,day:state.config.analysisDate},onp):Promise.resolve(null);
const runL=(site,onp)=>state.sites[site].files.labelless?onceWorker('./workers/labelless.worker.js',{type:'PROCESS_LAB',file:state.sites[site].files.labelless},onp):Promise.resolve(null);

function jw(site){return jworkers[site]||(jworkers[site]=new Worker('./workers/jornales.worker.js'))}
function loadJ(site,file){jready[site]=false;const w=jw(site);return new Promise((res,rej)=>{const h=e=>{const m=e.data||{};if(m.type==='LOADED'){w.removeEventListener('message',h);jready[site]=true;state.sites[site].jornalesMeta=m.meta;fillGer();$('message').textContent=`Jornales ${names[site]} indexados: ${nf.format(m.meta.records)} registros.`;res(m.meta)}else if(m.type==='ERROR'){w.removeEventListener('message',h);rej(new Error(m.message))}};w.addEventListener('message',h);w.postMessage({type:'LOAD_JORNALES',file})})}
function calcJ(site,day,ger,d1,d2){if(!jready[site])return Promise.resolve(null);const w=jw(site);return new Promise((res,rej)=>{const h=e=>{const m=e.data||{};if(m.type==='ANALYSIS'){w.removeEventListener('message',h);res(m.result)}else if(m.type==='ERROR'){w.removeEventListener('message',h);rej(new Error(m.message))}};w.addEventListener('message',h);w.postMessage({type:'ANALYZE_JORNALES',day,ger,d1,d2})})}
function fillGer(){const s=new Set();for(const site of ['soldati','echeverria'])for(const g of state.sites[site].jornalesMeta?.gerencias||[])s.add(g);$('jorGer').innerHTML='<option value="__ALL__">Todas</option>'+[...s].sort().map(x=>`<option>${esc(x)}</option>`).join('');const op=[...s].find(x=>x.toLowerCase()==='opsemli');if(op)$('jorGer').value=op}

const universe=(a,start)=>{let packages=0,vehicles=0;if(a?.ok)for(let h=start;h<=23;h++){packages+=a.h[h].ship;vehicles+=a.h[h].veh}return{packages,vehicles}};
function hoursUntil(lastTs,target){
  if(!lastTs)return 0;
  const d=new Date(lastTs),[hh,mm]=String(target||'22:00').split(':').map(Number),t=new Date(d);
  t.setHours(hh||0,mm||0,0,0);if(t<=d)t.setDate(t.getDate()+1);
  return Math.max(0,(t-d)/3600000);
}
function speedPanel(site){
  const d=state.sites[site],r=d.registros,t=d.tms,fc=Number($(site==='soldati'?'fcS':'fcE')?.value)||0;
  if(!r&&!t&&!d.arrivals)return '';
  const target=state.config.speedTargetTime?.[site]||'22:00';
  const lastTs=r?.lastTs||t?.maxInTs||null;
  const arrived=r?.packages ?? d.arrivals?.totalShip ?? 0;
  const bipeado=t?.totalConPost ?? 0;
  const hrs=hoursUntil(lastTs,target);
  const required=(fc&&hrs>0)?Math.max(0,fc-bipeado)/hrs:0;
  const real=tmsHourlyVelocity(t);
  const diff=arrived-bipeado,pend=fc?fc-bipeado:0;
  const last=lastTs?new Date(lastTs).toLocaleTimeString('es-AR',{hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false}):'-';
  return `<div class="speed-panel">
    <div class="speed-head"><h3>Velocidad Inhub / Descarga</h3><label>Hora objetivo<input type="time" data-speed-target="${site}" value="${target}"></label></div>
    <table class="speed-table">
      <tr><td>Últ. actualización</td><td>${last}</td><td></td></tr>
      <tr><td>Proyectado</td><td>${fc?nf.format(fc):'-'}</td><td>-</td></tr>
      <tr><td>Arribado</td><td>${nf.format(arrived)}</td><td>${fc?pf.format(pct(arrived,fc))+'%':'-'}</td></tr>
      <tr><td>Bipeado</td><td>${nf.format(bipeado)}</td><td>${fc?pf.format(pct(bipeado,fc))+'%':'-'}</td></tr>
      <tr><td>Arribado - Bipeado</td><td class="${diff<0?'negnum':'posnum'}">${diff>0?'+':''}${nf.format(diff)}</td><td>${fc?pf.format(pct(diff,fc))+'%':'-'}</td></tr>
      <tr><td>Proyectado - Bipeado</td><td>${fc?nf.format(pend):'-'}</td><td>${fc?pf.format(pct(pend,fc))+'%':'-'}</td></tr>
      <tr><td>Velocidad real descarga</td><td><b>${real==null?'-':nf.format(Math.round(real))}</b></td><td>pza/h</td></tr>
      <tr><td>Velocidad necesaria a ${target}</td><td class="${real!=null&&real>=required?'speed-ok':'speed-bad'}"><b>${fc?nf.format(Math.ceil(required)):'-'}</b></td><td>pza/h</td></tr>
      <tr><td>Brecha velocidad</td><td class="${real!=null&&real-required>=0?'speed-ok':'speed-bad'}"><b>${fc?(real-required>=0?'+':'')+nf.format(Math.round(real-required)):'-'}</b></td><td>pza/h</td></tr>
    </table>
    <div class="speed-note">Registros: solo CHOFER informado · TIPO DE OPERACION = Descarga · Accion = add · se excluyen horas 01 y 02.</div>
  </div>`;
}
// Misma regla que BUSCARV(HORA(W4);BF:BH;3;0): piezas TMS de la hora / minutos desde HH:00.
function tmsHourlyVelocity(t){
 if(!t?.by?.length||!Number.isFinite(t.maxInTs))return null;
 const dt=new Date(t.maxInTs),h=dt.getHours(),start=new Date(dt);start.setMinutes(0,0,0);
 const minutes=(dt-start)/60000,qty=Number(t.by[h]?.tot||0);
 return minutes>0?qty*60/minutes:null;
}
function huInhubMini(site){
 const d=state.sites[site],t=d.tms,r=d.registros,a=d.arrivals;
 const fc=Number($(site==='soldati'?'fcS':'fcE')?.value)||0;
 const startHour=Math.max(0,Math.min(23,Number(huConfig(site).inhubStartHour??0)));
 const arrivalStart=Math.max(0,Math.min(23,Number(huConfig(site).arrivalStartHour??startHour)));
 const arrived=r?.byHour?.length?r.byHour.reduce((sum,qty,h)=>sum+(h>=arrivalStart?Number(qty||0):0),0):(r?.packages??a?.totalShip??null);
 const bipeado=t?(t.by?.length?t.by.reduce((sum,h,i)=>sum+(i>=startHour?Number(h.tot||0):0),0):t.totalConPost):null;
 const last=t?.maxInTs||r?.lastTs||null;
 const clock=last?new Date(last).toLocaleTimeString('es-AR',{hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false}):'—';
 const target=state.config.speedTargetTime?.[site]||'22:00';
 const remaining=hoursUntil(last,target);
 const hourly=fc&&bipeado!==null&&remaining>0?Math.max(0,fc-bipeado)/remaining:null;
 const velocity=tmsHourlyVelocity(t);
 const val=n=>n===null?'—':nf.format(Math.round(n));
 const percentage=n=>fc&&n!==null?pf.format(pct(n,fc))+'%':'—';
 const row=(name,n,p)=>'<tr><td>'+name+'</td><td>'+val(n)+'</td><td>'+p+'</td></tr>';
 return '<div class="hu-inhub-mini"><h3>Resumen Inhub · Descarga</h3><div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin:8px 0"><label>Inicio arribado <select data-arrival-start="'+site+'">'+Array.from({length:24},(_,h)=>'<option value="'+h+'" '+(h===arrivalStart?'selected':'')+'>'+String(h).padStart(2,'0')+':00</option>').join('')+'</select></label><button type="button" class="smallbtn primary" data-arrival-apply="'+site+'">Aplicar arribado</button><small>Independiente del inicio de Inhub y HU</small></div><small>Inicio Inhub: '+String(startHour).padStart(2,'0')+':00 · Bipeado filtrado por hora de Inbound Date Included.</small><div class="hu-inhub-time">Últ. actualización <b>'+clock+'</b></div><table class="hu-table compact"><tr><th>Indicador</th><th>Piezas</th><th>% proy.</th></tr>'+
 row('Proyectado',fc||null,fc?'100,0%':'—')+
 row('Arribado',arrived,percentage(arrived))+
 row('Bipeado Inhub',bipeado,percentage(bipeado))+
 row('Arribado − Bipeado',arrived!==null&&bipeado!==null?arrived-bipeado:null,arrived!==null&&bipeado!==null?percentage(arrived-bipeado):'—')+
 row('Descarga x hora necesaria (hasta '+target+')',Number.isFinite(hourly)?hourly:null,Number.isFinite(hourly)?percentage(hourly):'—')+
 row('Proyectado − Bipeado',fc&&bipeado!==null?fc-bipeado:null,fc&&bipeado!==null?percentage(fc-bipeado):'—')+
 row('Velocidad real (pza/h)',velocity,'—')+'</table><small>Arribado: '+(r?'Reporte de registros':a?'Arribos':'sin fuente')+' · Bipeado: TMS Inbound Date Included · velocidad: TMS (piezas de la hora actual / minutos desde HH:00). Los datos no disponibles se muestran como —.</small></div>';
}
function bindSpeedTargets(){
  document.querySelectorAll('[data-speed-target]').forEach(el=>el.onchange=()=>{
    state.config.speedTargetTime[el.dataset.speedTarget]=el.value||'22:00';
    operation();
  });
}
function cut(a,start,c,type){const u=universe(a,start)[type];let x=0;if(a?.ok)for(let h=start;h<c&&h<=23;h++)x+=a.h[h][type==='packages'?'ship':'veh'];return pct(x,u)}
function tmsTable(t,start){let cv=0,ct=0,r='';for(let h=start;h<=23;h++){const x=t.by[h];cv+=x.vol;ct+=x.tot;r+=`<tr><td>${h}:00</td><td>${nf.format(x.tot)}</td><td>${nf.format(x.vol)}</td><td>${pf.format(pct(x.vol,x.tot))}%</td><td>${pf.format(pct(cv,ct))}%</td><td>${nf.format(x.big)}</td><td>${nf.format(x.sb)}</td></tr>`}return `<div class="scroll"><table><tr><th>Hora</th><th>Total</th><th>Vol.</th><th>% hora</th><th>% acum.</th><th>Bigger</th><th>SB</th></tr>${r}</table></div>`}
function arrTable(a,start){const u=universe(a,start);let cp=0,cv=0,r='';for(let h=start;h<=23;h++){cp+=a.h[h].ship;cv+=a.h[h].veh;r+=`<tr><td>${h}:00</td><td>${nf.format(a.h[h].ship)}</td><td>${nf.format(cp)}</td><td>${pf.format(pct(cp,u.packages))}%</td><td>${nf.format(a.h[h].veh)}</td><td>${nf.format(cv)}</td><td>${pf.format(pct(cv,u.vehicles))}%</td></tr>`}return `<div class="scroll"><table><tr><th>Hora</th><th>Paquetes</th><th>Paq. acum.</th><th>% paq.</th><th>Veh.</th><th>Veh. acum.</th><th>% veh.</th></tr>${r}</table></div>`}
function bars(rows,key,start){const mx=Math.max(1,...rows.slice(start).map(x=>x[key]||0));return '<div class="chart">'+Array.from({length:24-start},(_,i)=>i+start).map(h=>`<div class="barrow"><span class="barlabel">${h}:00</span><div class="bartrack"><div class="barfill" style="width:${pct(rows[h][key]||0,mx)}%"></div></div><span class="barvalue">${nf.format(rows[h][key]||0)}</span></div>`).join('')+'</div>'}


function dockDashboard(){
 let html='';
 for(const site of ['soldati','echeverria']){
 const t=state.sites[site].tms;if(!t)continue;
 const key='dockThreshold_'+site;
 const threshold=Number(state.config[key]??localStorage.getItem('inhub_'+key)??40);
 const docks=(t.docks||[]).map(x=>({...x,n:Number(x.dock),hours:(x.last-x.first)/3600000})).filter(x=>x.count>0);
 const first=docks.length?Math.min(...docks.map(x=>x.first)):null,last=docks.length?Math.max(...docks.map(x=>x.last)):null;
 const total=docks.reduce((n,x)=>n+x.count,0),hours=first===null?0:(last-first)/3600000;
 const clock=ms=>new Date(ms).toLocaleTimeString('es-AR',{hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false});
 const velocity=(n,h)=>h>0?nf.format(Math.round(n/h)):'—';
 const groupSummary=(label,items)=>{const count=items.reduce((n,x)=>n+x.count,0),a=items.length?Math.min(...items.map(x=>x.first)):null,b=items.length?Math.max(...items.map(x=>x.last)):null,mins=a===null?0:(b-a)/60000;return '<div class="dock-summary dock-group-summary"><div><span>'+label+' · paquetes</span><b>'+nf.format(count)+'</b></div><div><span>Docks activos</span><b>'+nf.format(items.length)+'</b></div><div><span>Velocidad pza/min</span><b>'+(mins>0?pf.format(count/mins):'—')+'</b></div><div><span>Velocidad pza/h</span><b>'+(mins>0?nf.format(Math.round(count*60/mins)):'—')+'</b></div><div><span>Primer / último bipeo</span><b>'+(a!==null?clock(a)+' / '+clock(b):'—')+'</b></div></div>'};
 const camionetas=docks.filter(x=>Number.isFinite(x.n)&&x.n>=threshold),chasis=docks.filter(x=>Number.isFinite(x.n)&&x.n<threshold);
 const tiles=(items)=>items.length?'<div class="dock-tiles">'+items.sort((a,b)=>a.n-b.n).map(x=>{
 const users=Object.entries(x.users||{}).sort((a,b)=>b[1]-a[1]);
 const tip=users.length?users.map(([u,n])=>u+' · '+nf.format(n)+' bipeos').join(' | '):'Sin usuario Inbound informado';
 return `<div class="dock-tile" tabindex="0" title="${esc(tip)}"><div class="dock-num">DOCK ${esc(x.dock)}</div><strong>${velocity(x.count,x.hours)} <small>pza/h</small></strong><div class="dock-speed">${x.hours>0?pf.format(x.count/(x.hours*60)):'—'} pza/min</div><div class="dock-qty">${nf.format(x.count)} paquetes · ${users.length} usuarios</div><div class="dock-tooltip"><b>Usuarios en dársena</b>${users.length?users.map(([u,n])=>`<span>${esc(u)} · ${nf.format(n)} bipeos</span>`).join(''):'<span>Sin usuario Inbound informado</span>'}<span>Primer bipeo: ${clock(x.first)}</span><span>Último bipeo: ${clock(x.last)}</span></div></div>`;
 }).join('')+'</div>':'<p class="muted">Sin docks registrados para esta categoría.</p>';
 html+=`<article class="card"><h2>${names[site]} · Productividad por dársena</h2><div class="dock-toolbar"><label>Desde dock N.º se considera Camioneta <input class="dock-limit" data-dock-site="${site}" type="number" min="0" step="1" value="${threshold}"></label><small>Dock ${threshold} y superiores: Camionetas · inferiores: Chasis. Se configura por site.</small></div>
 <div class="dock-summary"><div><span>Paquetes bipeados</span><b>${nf.format(total)}</b></div><div><span>Velocidad general / hora</span><b>${velocity(total,hours)}</b></div><div><span>Velocidad general / minuto</span><b>${hours>0?pf.format(total/(hours*60)):'—'}</b></div><div><span>Docks con actividad</span><b>${nf.format(docks.length)}</b></div><div><span>Primer / último bipeo</span><b>${first!==null?clock(first)+' / '+clock(last):'—'}</b></div></div>
 <h3>Camionetas · ${camionetas.length} docks</h3>${groupSummary("Camionetas",camionetas)}${tiles(camionetas)}
 <h3>Chasis · ${chasis.length} docks</h3>${groupSummary("Chasis",chasis)}${tiles(chasis)}
 ${docks.some(x=>!Number.isFinite(x.n))?'<p class="muted">Existen docks con identificadores no numéricos que no se pueden clasificar por el umbral.</p>':''}
 <p class="muted">Velocidades calculadas entre primer y último bipeo TMS, incluyendo pausas. La velocidad general usa el intervalo global; no es la suma de velocidades individuales. Los usuarios son los identificados en Inbound User ID, no necesariamente quienes están conectados ahora.</p></article>`;
 }
 $('docksView').innerHTML=html||'<article class="card empty">Procesá un TMS para visualizar las dársenas.</article>';
 document.querySelectorAll('.dock-limit').forEach(el=>el.onchange=()=>{const n=Number(el.value);if(!Number.isFinite(n)||n<0)return;state.config['dockThreshold_'+el.dataset.dockSite]=n;localStorage.setItem('inhub_dockThreshold_'+el.dataset.dockSite,String(n));dockDashboard()});
}

function renderAll(){summary();operation();huControl();curves();huGoalView();planVsReal();dockDashboard();mix();subca();jornales();mail();reportPreview()}
function summary(){
  let h='<div class="summary-sites">',any=false;
  for(const site of ['soldati','echeverria']){
    const d=state.sites[site],t=d.tms,lab=d.files.labelless?(t?.labelless||d.labellessStandalone):null;
    if(!t&&!d.arrivals&&!d.jornalesResult&&!d.registros&&!lab)continue;
    any=true;
    const fc=Number($(site==='soldati'?'fcS':'fcE').value)||0;
    const pure=t?Math.max(0,t.vol-t.big-t.sb):0,base=t?Math.max(0,t.totalConPost-t.big-t.sb):0;
    h+=`<section class="site-summary"><h2>${names[site]}</h2><div class="site-kpis">
      ${t?`
      <div class="kpi"><span>Proyectado 09:00</span><b>${fc?nf.format(fc):'-'}</b></div>
      <div class="kpi"><span>Inhub c/Post</span><b>${nf.format(t.totalConPost)}</b></div>
      <div class="kpi"><span>Inhub s/Post</span><b>${nf.format(t.totalSinPost)}</b></div>
      <div class="kpi"><span>Voluminoso c/B+SB</span><b>${nf.format(t.vol)}</b><small>${pf.format(pct(t.vol,t.totalConPost))}%</small></div>
      <div class="kpi"><span>Voluminoso s/B+SB</span><b>${nf.format(pure)}</b><small>${pf.format(pct(pure,base))}%</small></div>
      <div class="kpi"><span>Bigger</span><b>${nf.format(t.big)}</b></div>
      <div class="kpi"><span>SuperBigger</span><b>${nf.format(t.sb)}</b></div>
      <div class="kpi"><span>MELI Air</span><b>${nf.format(t.meli.arrivals)}</b><small>HU ${nf.format(t.meli.processed)} · ${pf.format(pct(t.meli.processed,t.meli.arrivals))}%</small></div>
      `:''}
      ${lab?`<div class="kpi"><span>Labelless</span><b>${nf.format(lab.arrived??lab.supplied??0)}</b><small>${lab.processed!=null?'HU '+nf.format(lab.processed)+' · '+pf.format(pct(lab.processed,lab.arrived))+'%':'Cargados '+nf.format(lab.supplied||0)}</small></div>`:''}
      ${d.arrivals?`<div class="kpi"><span>Vehículos</span><b>${nf.format(d.arrivals.veh)}</b><small>${nf.format(d.arrivals.totalShip)} paquetes</small></div>`:''}
      ${d.registros?`<div class="kpi"><span>Velocidad descarga</span><b>${nf.format(Math.round(d.registros.currentSpeed||0))}</b><small>${nf.format(d.registros.packages||0)} arribados · pza/h actual</small></div>`:''}
      ${d.jornalesResult?`<div class="kpi"><span>Jornales</span><b>${nf.format(d.jornalesResult.total)}</b></div>`:''}
    </div></section>`;
  }
  h+='</div>';$('summaryCards').innerHTML=any?h:'<div class="empty">Procesá archivos.</div>';
}function operation(){
  const start=state.config.curveStart;let h='',any=false;
  for(const site of ['soldati','echeverria']){
    const d=state.sites[site];if(!d.tms&&!d.arrivals&&!d.registros&&!d.labellessStandalone&&!d.jornalesResult)continue;any=true;
    h+=`<article class="card"><h2>${names[site]}</h2>`;
    if(d.tms)h+=`<div class="kpi-grid"><div class="kpi"><span>Inhub</span><b>${nf.format(d.tms.totalConPost)}</b></div><div class="kpi"><span>MELI Air % HU</span><b>${pf.format(pct(d.tms.meli.processed,d.tms.meli.arrivals))}%</b></div>${d.files.labelless?`<div class="kpi"><span>Labelless % HU</span><b>${pf.format(pct(d.tms.labelless.processed,d.tms.labelless.arrived))}%</b></div>`:''}</div>`;
    h+=speedPanel(site);
    if(d.arrivals)h+=`<h3>Arribos</h3><div class="kpi-grid"><div class="kpi"><span>Vehículos</span><b>${nf.format(d.arrivals.veh)}</b></div><div class="kpi"><span>Paquetes</span><b>${nf.format(d.arrivals.totalShip)}</b></div><div class="kpi"><span>% Semi</span><b>${pf.format(pct(d.arrivals.semi,d.arrivals.veh))}%</b></div><div class="kpi"><span>% Chasis</span><b>${pf.format(pct(d.arrivals.chasis,d.arrivals.veh))}%</b></div><div class="kpi"><span>% Camioneta</span><b>${pf.format(pct(d.arrivals.camionetaOther??d.arrivals.camioneta,d.arrivals.veh))}%</b></div><div class="kpi"><span>% Camioneta MELI</span><b>${pf.format(pct(d.arrivals.camionetaMeli||0,d.arrivals.veh))}%</b></div></div><div class="cols"><div><h4>Cortes paquetes</h4>${cuts(d.arrivals,start,'packages')}</div><div><h4>Cortes vehículos</h4>${cuts(d.arrivals,start,'vehicles')}</div></div>`;
    h+='</article>';
  }
  $('operationView').innerHTML=any?h:'<article class="card empty">Sin datos.</article>';bindSpeedTargets();
}function cuts(a,start,type){return '<table><tr><th>Corte</th><th>%</th></tr>'+[16,18,20].map(c=>`<tr><td>Pre ${c}</td><td>${pf.format(cut(a,start,c,type))}%</td></tr>`).join('')+`<tr><td>Post 20</td><td>${pf.format(100-cut(a,start,20,type))}%</td></tr></table>`}
function flowCurve(d,start){
 if(!d.tms||!d.registros)return '';
 const rows=[];let arAc=0,inAc=0;
 for(let h=start;h<24;h++){const ar=d.registros.byHour?.[h]||0,inh=d.tms.by?.[h]?.tot||0;arAc+=ar;inAc+=inh;rows.push({h,ar,inh,arAc,inAc})}
 const max=Math.max(1,...rows.flatMap(x=>[x.ar,x.inh]));
 const W=Math.max(900,rows.length*85),H=290,left=40,right=36,top=35,bottom=48,plotW=W-left-right,plotH=H-top-bottom;
 const xx=i=>left+(rows.length===1?0.5:i/(rows.length-1))*plotW;
 const yy=n=>top+plotH-(n/max)*plotH;
 const points=key=>rows.map((x,i)=>xx(i)+','+yy(x[key])).join(' ');
 const series=(key,color,shift)=>rows.map((x,i)=>{
  const xPos=xx(i),yPos=yy(x[key]),textY=Math.max(12,Math.min(H-bottom-12,yPos+shift));
  return '<circle cx="'+xPos+'" cy="'+yPos+'" r="3.5" fill="'+color+'" stroke="#101e34" stroke-width="1.5"><title>'+String(x.h).padStart(2,'0')+':00 · '+(key==='ar'?'ED':'TMS')+': '+nf.format(x[key])+'</title></circle><text x="'+xPos+'" y="'+textY+'" text-anchor="middle" font-size="10" font-weight="700" fill="'+color+'">'+nf.format(x[key])+'</text>';
 }).join('');
 const labels=rows.map((x,i)=>'<text x="'+xx(i)+'" y="'+(H-17)+'" text-anchor="middle" font-size="11" fill="#a6b9d6">'+String(x.h).padStart(2,'0')+':00</text>').join('');
 return '<div class="flow-curve"><div class="flow-title"><div><h3>Arribado vs Ingresado TMS por hora</h3><small>ED = Reporte de Registros · TMS = Inbound Date Included. Valores visibles en cada punto.</small></div><div class="flow-legend"><span class="flow-arr">● Arribado ED</span><span class="flow-in">● Ingresado TMS</span></div></div><div class="flow-point-scroll"><svg class="flow-point-svg" viewBox="0 0 '+W+' '+H+'" width="'+W+'" height="'+H+'" role="img" aria-label="Curva horaria de arribado e ingresado con cantidades en cada punto"><line x1="'+left+'" y1="'+(top+plotH)+'" x2="'+(W-right)+'" y2="'+(top+plotH)+'" stroke="#64748b"/><polyline points="'+points('ar')+'" fill="none" stroke="#2996ee" stroke-width="2.5"/><polyline points="'+points('inh')+'" fill="none" stroke="#20a783" stroke-width="2.5"/>'+series('ar','#55b6ff',-12)+series('inh','#43d5aa',18)+labels+'</svg></div><div class="scroll"><table><tr><th>Hora</th><th>Arribado ED</th><th>Ingresado TMS</th><th>Brecha hora</th><th>Arribado acum.</th><th>TMS acum.</th><th>Brecha acum.</th></tr>'+rows.map(x=>'<tr><td>'+String(x.h).padStart(2,'0')+':00</td><td>'+nf.format(x.ar)+'</td><td>'+nf.format(x.inh)+'</td><td>'+nf.format(x.ar-x.inh)+'</td><td>'+nf.format(x.arAc)+'</td><td>'+nf.format(x.inAc)+'</td><td>'+nf.format(x.arAc-x.inAc)+'</td></tr>').join('')+'</table></div></div>';
}
function dockProductivity(t){
 if(!t?.docks?.length)return '';
 const rows=t.docks.map(x=>{const hours=(x.last-x.first)/3600000;return{...x,hours,rate:hours>0?x.count/hours:null}}).sort((a,b)=>b.count-a.count);
 const clock=x=>new Date(x).toLocaleTimeString('es-AR',{hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false});
 return `<div class="flow-curve"><h3>Productividad por dock · TMS</h3><p class="muted">Velocidad = paquetes bipeados / tiempo entre primer y último Inbound Date Included del dock. No representa necesariamente tiempo activo continuo.</p><div class="scroll"><table><tr><th>Dock</th><th>Paquetes</th><th>Primer bipeo</th><th>Último bipeo</th><th>Duración</th><th>Productividad (pza/h)</th></tr>${rows.map(x=>`<tr><td>${esc(x.dock)}</td><td>${nf.format(x.count)}</td><td>${clock(x.first)}</td><td>${clock(x.last)}</td><td>${x.hours>0?pf.format(x.hours)+' h':'—'}</td><td><b>${x.rate!==null?nf.format(Math.round(x.rate)):'No calculable'}</b></td></tr>`).join('')}</table></div></div>`;
}


function huHourlyGoalPlan(site){
 const t=state.sites[site].tms;if(!t?.hu)return '<p class="muted">Procesá TMS para ver el avance HU.</p>';
 const cfg=huConfig(site),forecast=Number($(site==='soldati'?'fcS':'fcE')?.value)||0;
 if(!forecast)return '<p class="muted">Cargá el proyectado de '+names[site]+' para calcular el objetivo HU.</p>';
 const pctGoal=Math.max(0,Math.min(100,Number(cfg.targetPct??65)));
 const goal=Math.ceil(forecast*pctGoal/100),tot=huSeparateAir(t).normal.hu.totals,processed=tot.abierto+tot.cerrado;
 const max=t.hu.maxOutTs,now=max?new Date(max):new Date();
 const [th,tm]=String(cfg.targetTime||'22:00').split(':').map(Number);
 const startHour=Math.max(0,Math.min(23,Number(cfg.huStartHour??7)));
 const start=new Date(now);start.setHours(startHour,0,0,0);
 if(start>now)start.setDate(start.getDate()-1);
 const end=new Date(start);end.setHours(th||0,tm||0,0,0);if(end<=start)end.setDate(end.getDate()+1);
 const duration=(end-start)/3600000;
 const hourly=t.hu.byHour||[],air=t.meli?.by||{};
 const rows=[];
 for(let cursor=new Date(start);cursor<end&&rows.length<30;cursor.setHours(cursor.getHours()+1)){
  const next=new Date(Math.min(cursor.getTime()+3600000,end.getTime()));
  const h=cursor.getHours(),hours=(next-cursor)/3600000;
  const raw=Number(hourly[h]||0),meli=Number(air[h]?.proc||0);
  const real=cursor<=now?Math.max(0,raw-meli):null;
  rows.push({h,stamp:new Date(cursor),hours,real});
 }
 const fmt=n=>nf.format(Math.round(n));
 const completed=rows.filter(x=>x.real!==null),historical=completed.reduce((v,x)=>v+x.real,0);
 // Reconcile the hourly series with the authoritative HU processed total.
 const prior=Math.max(0,processed-historical);
 let cumulative=prior;
 rows.forEach((x,i)=>{
  const remainingHours=rows.slice(i).reduce((sum,y)=>sum+y.hours,0);
  const missing=Math.max(0,goal-cumulative);
  x.targetHour=remainingHours>0?missing*x.hours/remainingHours:0;
  x.targetAccum=Math.round(cumulative+x.targetHour);
  x.before=cumulative;
  if(x.real!==null)cumulative+=x.real;
  x.actualAccum=x.real===null?null:cumulative;
  x.diff=x.real===null?null:x.real-Math.round(x.targetHour);
  x.remainingAfter=x.real===null?null:Math.max(0,goal-cumulative);
 });
 const nextRow=rows.find(x=>x.real===null);
 const remainingNow=Math.max(0,goal-processed);
 const remainingTime=rows.filter(x=>x.real===null).reduce((sum,x)=>sum+x.hours,0);
 const currentRequired=remainingTime>0?Math.ceil(remainingNow/remainingTime):0;
 const chart=(title,keyA,keyB,labelA,labelB,accum)=>{
  const peak=Math.max(1,...rows.map(x=>Math.max(x[keyA]||0,x[keyB]||0)))*1.12;
  const xy=(i,v)=>[52+i*760/Math.max(1,rows.length-1),205-(v||0)/peak*175];
  const line=key=>rows.filter(x=>x[key]!==null).map(x=>xy(rows.indexOf(x),x[key]).join(',')).join(' ');
  const labels=rows.map((x,i)=>{const [px]=xy(i,0);return '<text x="'+px+'" y="232" fill="#c9d6e8" font-size="12" text-anchor="middle">'+String(x.h).padStart(2,'0')+'</text>'}).join('');
  const dots=key=>rows.filter(x=>x[key]!==null).map(x=>{const [px,py]=xy(rows.indexOf(x),x[key]);return '<circle cx="'+px+'" cy="'+py+'" r="3" fill="'+(key===keyA?'#ffbf66':'#43d6b0')+'"/><text x="'+px+'" y="'+Math.max(12,py+(key===keyA?-9:17))+'" font-size="10" fill="'+(key===keyA?'#ffbf66':'#43d6b0')+'" text-anchor="middle">'+fmt(x[key])+'</text>'}).join('');
  return '<div class="flow-curve"><h3>'+title+'</h3><p class="muted"><span style="color:#ffbf66">● '+labelA+'</span> &nbsp; <span style="color:#43d6b0">● '+labelB+'</span></p><div class="plan-chart"><svg viewBox="0 0 860 250" style="width:100%;background:#111d30;border-radius:12px"><line x1="42" y1="205" x2="830" y2="205" stroke="#64748b"/><polyline points="'+line(keyA)+'" fill="none" stroke="#ffbf66" stroke-width="3"/><polyline points="'+line(keyB)+'" fill="none" stroke="#43d6b0" stroke-width="3"/>'+labels+dots(keyA)+dots(keyB)+'</svg></div></div>';
 };
 return '<div class="kpi-grid"><div class="kpi"><span>Proyectado</span><b>'+fmt(forecast)+'</b></div><div class="kpi"><span>Objetivo '+huPercent2(pctGoal)+'%</span><b>'+fmt(goal)+'</b></div><div class="kpi"><span>HU procesado (sin MELI Air)</span><b>'+fmt(processed)+'</b></div><div class="kpi"><span>Faltan para objetivo</span><b>'+fmt(Math.max(0,goal-processed))+'</b></div></div>'+
 '<div class="kpi-grid"><div class="kpi"><span>Faltante actual</span><b>'+fmt(remainingNow)+'</b></div><div class="kpi"><span>Ritmo necesario desde ahora</span><b>'+(remainingTime?fmt(currentRequired)+' pza/h':'Sin horas restantes')+'</b></div></div>'+
 '<p class="muted">Objetivo dinámico: en cada hora se redistribuye el faltante entre las horas restantes. Las horas anteriores se reconstruyen con el TMS cargado; no son metas históricas guardadas. MELI Air excluido. La tabla permite ver la recuperación hora por hora.</p>'+
 chart('Producción HU por hora · objetivo vs real','targetHour','real','Objetivo por hora','Real por hora')+
 chart('Avance HU acumulado · objetivo vs real','targetAccum','actualAccum','Meta acumulada','Real acumulado')+
 '<div class="plan-table-wrap"><table class="hu-table plan-table"><tr><th>Hora</th><th>Objetivo dinámico / hora</th><th>HU real / hora</th><th>Diferencia / hora</th><th>Meta al finalizar hora</th><th>Real acumulado</th><th>Faltante después</th></tr>'+rows.map(x=>'<tr><td>'+String(x.h).padStart(2,'0')+':00</td><td>'+fmt(x.targetHour)+'</td><td>'+(x.real===null?'Pendiente':fmt(x.real))+'</td><td>'+(x.diff===null?'—':(x.diff>0?'+':'')+fmt(x.diff))+'</td><td>'+fmt(x.targetAccum)+'</td><td>'+(x.actualAccum===null?'—':fmt(x.actualAccum))+'</td><td>'+(x.remainingAfter===null?'—':fmt(x.remainingAfter))+'</td></tr>').join('')+'</table></div>'+
 (prior?'<p class="muted">Nota de conciliación: '+fmt(prior)+' piezas procesadas del total HU no están distribuidas en las horas visibles. Se incorporan solo al acumulado real inicial, no a la producción horaria.</p>':'');
}

function planVsReal(){
 const host=$('planView');if(!host)return;
 const hours=Array.from({length:14},(_,i)=>i+9);
 const types=[['camioneta','Camioneta'],['chasis','Chasis'],['semi','Semi']];
 const storeKey=site=>'inhub_vehicle_plan_'+site;
 let html='';
 for(const site of ['soldati','echeverria']){
  let saved={};try{saved=JSON.parse(localStorage.getItem(storeKey(site))||'{}')||{}}catch{}
  const siteData=state.sites[site],a=siteData.arrivals,vehicleHours=a?.h||siteData.registros?.vehiclesByHour||null;
  const totals={plan:0,real:0},hourRows=[];
  for(const hour of hours){
   const p={},real={};for(const [key] of types){p[key]=Math.max(0,Number(saved[hour]?.[key])||0);real[key]=Number(vehicleHours?.[hour]?.[key])||0}
   const pt=Object.values(p).reduce((x,y)=>x+y,0),rt=Object.values(real).reduce((x,y)=>x+y,0);
   totals.plan+=pt;totals.real+=rt;hourRows.push({hour,p,real,pt,rt});
  }
  const fmt=v=>nf.format(v);
  const max=Math.max(1,...hourRows.flatMap(x=>[x.pt,x.rt]));
  const pts=key=>hourRows.map((x,i)=>[35+i*53,180-(x[key]/max)*155].join(',')).join(' ');
  const chart='<svg viewBox="0 0 790 235" role="img" aria-label="Líneas de vehículos planificados y reales por hora" style="width:100%;max-height:270px;background:#111d30;border-radius:12px"><line x1="30" y1="180" x2="755" y2="180" stroke="#6d7b91"/><polyline fill="none" stroke="#f5a623" stroke-width="3" points="'+pts('pt')+'"/><polyline fill="none" stroke="#3bc8ba" stroke-width="3" points="'+pts('rt')+'"/>'+hourRows.map((x,i)=>'<text x="'+(35+i*53)+'" y="201" fill="#e4edf8" font-size="12" text-anchor="middle">'+String(x.hour).padStart(2,'0')+'</text>').join('')+'<g font-size="10" font-weight="700" text-anchor="middle">'+hourRows.map((x,i)=>'<text x="'+(35+i*53)+'" y="'+Math.max(12,174-(x.pt/max)*155)+'" fill="#ffbc53">'+x.pt+'</text><text x="'+(35+i*53)+'" y="'+Math.min(177,193-(x.rt/max)*155)+'" fill="#6ce4d6">'+x.rt+'</text>').join('')+'</g></svg>';
  html+='<section class="plan-site" data-plan-site="'+site+'"><h3>'+names[site]+'</h3><p class="muted">Editá el plan por hora. El real se actualiza desde Arribos. Camioneta incluye Camioneta MELI.</p><div class="kpi-grid"><div class="kpi"><span>Plan</span><b>'+fmt(totals.plan)+'</b></div><div class="kpi"><span>Real</span><b>'+ (vehicleHours?fmt(totals.real):'Sin arribos')+'</b></div><div class="kpi"><span>Diferencia</span><b>'+(vehicleHours?fmt(totals.real-totals.plan):'—')+'</b></div><div class="kpi"><span>Cumplimiento</span><b>'+(vehicleHours&&totals.plan?huPercent2(100*totals.real/totals.plan)+'%':'—')+'</b></div></div><div class="plan-chart"><div class="plan-legend"><span style="color:#f5a623">● Plan</span> <span style="color:#3bc8ba">● Real</span></div>'+chart+'</div><div class="plan-table-wrap"><table class="hu-table plan-table"><thead><tr><th rowspan="2">Hora</th><th colspan="4">Plan editable</th><th colspan="4">Real automático</th><th rowspan="2">Diferencia</th></tr><tr>'+types.map(x=>'<th>'+x[1]+'</th>').join('')+'<th>Total</th>'+types.map(x=>'<th>'+x[1]+'</th>').join('')+'<th>Total</th></tr></thead><tbody>'+hourRows.map(x=>'<tr><td>'+String(x.hour).padStart(2,'0')+':00</td>'+types.map(([key])=>'<td><input class="plan-cell" type="number" min="0" step="1" data-hour="'+x.hour+'" data-type="'+key+'" value="'+x.p[key]+'"></td>').join('')+'<td><b>'+fmt(x.pt)+'</b></td>'+types.map(([key])=>'<td>'+ (vehicleHours?fmt(x.real[key]):'—')+'</td>').join('')+'<td><b>'+(vehicleHours?fmt(x.rt):'—')+'</b></td><td>'+(vehicleHours?fmt(x.rt-x.pt):'—')+'</td></tr>').join('')+'<tr class="total"><td>Total</td>'+types.map(([key])=>'<td>'+fmt(hourRows.reduce((n,x)=>n+x.p[key],0))+'</td>').join('')+'<td>'+fmt(totals.plan)+'</td>'+types.map(([key])=>'<td>'+(vehicleHours?fmt(hourRows.reduce((n,x)=>n+x.real[key],0)):'—')+'</td>').join('')+'<td>'+(vehicleHours?fmt(totals.real):'—')+'</td><td>'+(vehicleHours?fmt(totals.real-totals.plan):'—')+'</td></tr></tbody></table></div><div class="toolbar"><button class="primary" data-save-plan="'+site+'">Guardar plan y actualizar gráfico</button><button class="secondary" data-clear-plan="'+site+'">Limpiar plan</button></div></section>';
 }
 host.innerHTML=html;
 host.querySelectorAll('[data-save-plan]').forEach(btn=>btn.onclick=()=>{
  const site=btn.dataset.savePlan,section=host.querySelector('[data-plan-site="'+site+'"]'),plan={};
  section.querySelectorAll('.plan-cell').forEach(input=>{const hour=input.dataset.hour;plan[hour]??={};plan[hour][input.dataset.type]=Math.max(0,Math.floor(Number(input.value)||0))});
  localStorage.setItem(storeKey(site),JSON.stringify(plan));planVsReal();
 });
 host.querySelectorAll('[data-clear-plan]').forEach(btn=>btn.onclick=()=>{localStorage.removeItem(storeKey(btn.dataset.clearPlan));planVsReal()});
}

function curveHourRange(site){
 const v=state.config.curveHourRanges?.[site]||{};
 const from=Number.isInteger(v.from)?v.from:Math.max(0,Math.min(23,Number(state.config.curveStart??9)));
 const to=Number.isInteger(v.to)?v.to:(from+23)%24;
 return {from,to,hours:Array.from({length:(to-from+24)%24+1},(_,i)=>(from+i)%24)};
}
function curveRangeControls(site){
 const {from,to}=curveHourRange(site);
 const opts=selected=>Array.from({length:24},(_,h)=>'<option value="'+h+'"'+(h===selected?' selected':'')+'>'+String(h).padStart(2,'0')+':00</option>').join('');
 return '<div class="toolbar curve-range" data-curve-range="'+site+'"><strong>Rango horario ED / TMS / vehículos / SPR</strong><label>Desde <select data-range-from>'+opts(from)+'</select></label><label>Hasta <select data-range-to>'+opts(to)+'</select></label><button class="primary" data-apply-curve-range="'+site+'">Aplicar rango</button><button class="secondary" data-reset-curve-range="'+site+'">Restablecer</button></div>';
}
function bindCurveRanges(){
 document.querySelectorAll('[data-apply-curve-range]').forEach(btn=>btn.onclick=()=>{
  const site=btn.dataset.applyCurveRange,el=document.querySelector('[data-curve-range="'+site+'"]');
  state.config.curveHourRanges??={};
  state.config.curveHourRanges[site]={from:Number(el.querySelector('[data-range-from]').value),to:Number(el.querySelector('[data-range-to]').value)};
  curves();
 });
 document.querySelectorAll('[data-reset-curve-range]').forEach(btn=>btn.onclick=()=>{
  const site=btn.dataset.resetCurveRange;
  if(state.config.curveHourRanges)delete state.config.curveHourRanges[site];
  curves();
 });
}
function operationalHourMatrix(site){
 const d=state.sites[site],ed=d.registros?.byHour||null,tms=d.tms?.by||null,arr=d.arrivals?.h||d.registros?.vehiclesByHour||null;
 if(!ed&&!tms&&!arr)return '';
 const start=Math.max(0,Math.min(23,Number(state.config.curveStart??9)));
 const hours=curveHourRange(site).hours;
 const values={ed:[],tms:[],acum:[],share:[],spr:[],vehicles:[]};
 let totalED=0,totalTMS=0,totalVeh=0,acc=0;
 for(const h of hours){
  const e=ed?Number(ed[h]||0):null,v=arr?Number(arr[h]?.veh||0):null,n=tms?Number(tms[h]?.tot||0):null;
  totalED+=e||0;totalTMS+=n||0;totalVeh+=v||0;
  values.ed.push(e);values.tms.push(n);values.vehicles.push(v);
  if(n!==null)acc+=n;
  values.acum.push(n===null?null:acc);
  values.spr.push(e!==null&&v!==null&&v>0?e/v:null);
 }
 let cumulativeED=0;
 for(const e of values.ed){if(e!==null)cumulativeED+=e;values.share.push(e===null?null:cumulativeED)}
 const fmt=x=>x===null?'—':nf.format(Math.round(x));
 const pctFmt=x=>x===null?'—':x.toLocaleString('es-AR',{minimumFractionDigits:1,maximumFractionDigits:2})+'%';
 const definitions=[
  ['ED · descargado','ed',fmt,totalED,!!ed],
  ['TMS · Inhub','tms',fmt,totalTMS,!!tms],
  ['ACUM · TMS','acum',fmt,totalTMS,!!tms],
  ['% ED acumulado','share',x=>pctFmt(totalED?x/totalED*100:null),totalED?100:null,!!ed]
 ];
 return '<section class="hour-matrix"><h3>Control horario · ED / TMS / SPR</h3><p class="muted">SPR = paquetes ED ÷ vehículos de Arribos. ACUM y % ED son acumulados continuos desde la hora inicial configurada. El SPR total usa paquetes y vehículos totales, no el promedio de los SPR horarios.</p><div class="hour-matrix-scroll"><table><thead><tr><th>Indicador</th>'+hours.map(h=>'<th>'+String(h).padStart(2,'0')+':00</th>').join('')+'<th>TOTAL</th></tr></thead><tbody>'+definitions.map(([label,key,format,total,available])=>'<tr><th>'+label+'</th>'+hours.map((h,i)=>'<td>'+(available?format(values[key][i]):'—')+'</td>').join('')+'<td class="matrix-total">'+(available?(key==='share'?pctFmt(total):key==='spr'?total===null?'—':total.toLocaleString('es-AR',{maximumFractionDigits:1}):fmt(total)):'—')+'</td></tr>').join('')+'</tbody></table></div></section>';
}
function vehicleSprMatrix(site){
 const d=state.sites[site],a=d.arrivals,r=d.registros;
 const start=Math.max(0,Math.min(23,Number(state.config.curveStart??9)));
 const hours=curveHourRange(site).hours;
 const ed=r?.byHour||null,vehicles=a?.h||r?.vehiclesByHour||null;
 if(!ed&&!vehicles)return '';
 const vehValues=hours.map(h=>vehicles?Number(vehicles[h]?.veh||0):null);
 const edValues=hours.map(h=>ed?Number(ed[h]||0):null);
 const sprValues=hours.map((h,i)=>vehValues[i]>0&&edValues[i]!==null?edValues[i]/vehValues[i]:null);
 const vTotal=vehValues.reduce((n,x)=>n+(x||0),0),eTotal=edValues.reduce((n,x)=>n+(x||0),0);
 const fmt=x=>x===null?'—':nf.format(Math.round(x));
 const spr=x=>x===null?'—':x.toLocaleString('es-AR',{minimumFractionDigits:1,maximumFractionDigits:1});
 const rows=[['Vehículos recibidos',vehValues,fmt,vehicles?fmt(vTotal):'—'],['Paquetes ED',edValues,fmt,ed?fmt(eTotal):'—'],['SPR · pza/veh.',sprValues,spr,vehicles&&ed&&vTotal?spr(eTotal/vTotal):'—']];
 return '<section class="hour-matrix vehicle-spr-matrix"><h3>Vehículos y SPR por hora</h3><p class="muted">Vehículos: Arribos o registros únicos de Easy Docking (si no hay Arribos). Paquetes: reporte ED. SPR = paquetes ED / vehículos de la misma hora. Sin vehículos disponibles se muestra —; no se usan estimaciones.</p><div class="hour-matrix-scroll"><table><thead><tr><th>Indicador</th>'+hours.map(h=>'<th>'+String(h).padStart(2,'0')+':00</th>').join('')+'<th>TOTAL</th></tr></thead><tbody>'+rows.map(([label,values,format,total])=>'<tr><th>'+label+'</th>'+values.map(x=>'<td>'+format(x)+'</td>').join('')+'<td class="matrix-total">'+total+'</td></tr>').join('')+'</tbody></table></div></section>';
}
function huGoalView(){const host=$('huplanView');if(!host)return;host.innerHTML=['soldati','echeverria'].map(site=>'<section class="plan-site"><h3>'+names[site]+'</h3>'+huHourlyGoalPlan(site)+'</section>').join('')}
function curves(){
 const start=state.config.curveStart;
 let h='';
 for(const site of ['soldati','echeverria']){
  const d=state.sites[site];
  if(!d.tms&&!d.arrivals&&!d.registros)continue;
  h+=`<article class="card curves-site"><h2>${names[site]}</h2>
  ${curveRangeControls(site)}
  <div class="curves-matrices">${operationalHourMatrix(site)}${vehicleSprMatrix(site)}</div>
  ${vehicleDistribution(site)}
  ${flowCurve(d,curveHourRange(site).from)}
  ${d.tms?.hu?`<section class="hu-hourly-moved"><h3>Bipeo HU por hora · ${names[site]}</h3>${huHourlyTable(huSeparateAir(d.tms).normal)}</section>`:""}
  ${d.arrivals?`<section class="curves-arrivals"><h3>Detalle de arribos · ${names[site]}</h3>${arrTable(d.arrivals,start)}${vehicleShareTable(d.arrivals)}</section>`:""}
  </article>`;
 }
 $('curvesView').innerHTML=h||'<article class="card empty">Sin datos.</article>';
 bindCurveRanges();
}

function mix(){const start=state.config.curveStart;let h='';for(const site of ['soldati','echeverria']){const t=state.sites[site].tms;if(!t)continue;const pure=Math.max(0,t.vol-t.big-t.sb),base=Math.max(0,t.totalConPost-t.big-t.sb);h+=`<article class="card"><h2>${names[site]}</h2><div class="kpi-grid"><div class="kpi"><span>Voluminoso c/B+SB</span><b>${nf.format(t.vol)}</b><small>${pf.format(pct(t.vol,t.totalConPost))}%</small></div><div class="kpi"><span>Voluminoso s/B+SB</span><b>${nf.format(pure)}</b><small>${pf.format(pct(pure,base))}%</small></div><div class="kpi"><span>Bigger</span><b>${nf.format(t.big)}</b></div><div class="kpi"><span>SuperBigger</span><b>${nf.format(t.sb)}</b></div></div>${packagePie(t)}${tmsTable(t,start)}</article>`} $('mixView').innerHTML=h||'<article class="card empty">Sin TMS.</article>'}

function cfg(site){const t=state.sites[site].tms;if(!t)return null;const mp=new Map(masters[site].map(x=>[String(x.subca).trim().toUpperCase(),x]));const groups=t.subcaGroups.map(g=>{const x=mp.get(String(g.subca).trim().toUpperCase());return{...g,ola:x?.ola||'',cpt:x?.cpt??'',indicador:x?.indicador||''}});return{total:t.totalConPost,groups,unknown:groups.filter(g=>g.subca!=='SIN SUBCA'&&!mp.has(String(g.subca).trim().toUpperCase()))}}
function cpts(s){const m=new Map();for(const g of s.groups){const k=g.cpt===''?'SIN CONFIG':String(g.cpt);if(!m.has(k))m.set(k,{cpt:k,total:0,vol:0,big:0,sb:0,subcas:new Set()});const x=m.get(k);x.total+=g.total;x.vol+=g.vol;x.big+=g.big;x.sb+=g.sb;x.subcas.add(g.subca)}return[...m.values()]}
function uniq(a){return [...new Set(a.filter(x=>x!==''&&x!=null))].sort((a,b)=>String(a).localeCompare(String(b),'es',{numeric:true}))}
function optionList(values,current){return '<option value="__ALL__">Todos</option>'+values.map(v=>`<option value="${esc(v)}" ${String(v)===String(current)?'selected':''}>${esc(v)}</option>`).join('')}
function applySubFilters(site,s){
  const f=subcaFilters[site];
  return s.groups.filter(g=>{
    const q=String(f.q||'').toLowerCase().trim();
    if(q && ![g.subca,g.ola,g.cpt,g.indicador].some(v=>String(v??'').toLowerCase().includes(q))) return false;
    if(f.subca!=='__ALL__' && String(g.subca)!==String(f.subca)) return false;
    if(f.ola!=='__ALL__' && String(g.ola)!==String(f.ola)) return false;
    if(f.cpt!=='__ALL__' && String(g.cpt)!==String(f.cpt)) return false;
    if(f.indicador!=='__ALL__' && String(g.indicador)!==String(f.indicador)) return false;
    return true;
  });
}
function subFilterBar(site,s){
  const f=subcaFilters[site];
  return `<div class="subca-filters">
    <label>Buscar<input data-sf-site="${site}" data-sf="q" value="${esc(f.q)}" placeholder="SubCA, ola, CPT..."></label>
    <label>SubCA<select data-sf-site="${site}" data-sf="subca">${optionList(uniq(s.groups.map(g=>g.subca)),f.subca)}</select></label>
    <label>Ola<select data-sf-site="${site}" data-sf="ola">${optionList(uniq(s.groups.map(g=>g.ola||'-')),f.ola)}</select></label>
    <label>CPT<select data-sf-site="${site}" data-sf="cpt">${optionList(uniq(s.groups.map(g=>g.cpt===''?'-':g.cpt)),f.cpt)}</select></label>
    <label>Indicador<select data-sf-site="${site}" data-sf="indicador">${optionList(uniq(s.groups.map(g=>g.indicador||'-')),f.indicador)}</select></label>
    <button class="smallbtn ghost" data-sf-clear="${site}">Limpiar filtros</button>
  </div>`;
}
function bindSubFilters(){
  document.querySelectorAll('[data-sf-site]').forEach(el=>{
    const evt=el.tagName==='INPUT'?'input':'change';
    el.addEventListener(evt,()=>{const s=el.dataset.sfSite,k=el.dataset.sf;subcaFilters[s][k]=el.value;subca()});
  });
  document.querySelectorAll('[data-sf-clear]').forEach(b=>b.onclick=()=>{subcaFilters[b.dataset.sfClear]={q:'',subca:'__ALL__',ola:'__ALL__',cpt:'__ALL__',indicador:'__ALL__'};subca()});
}
function subca(){
  let h='';
  for(const site of ['soldati','echeverria']){
    const s=cfg(site);if(!s)continue;
    const filtered=applySubFilters(site,s);
    const view={...s,groups:filtered,total:filtered.reduce((n,g)=>n+g.total,0)};
    const cs=cpts(view),top=filtered.slice().sort((a,b)=>b.total-a.total).slice(0,10),topv=filtered.slice().sort((a,b)=>b.vol-a.vol).slice(0,10),topp=filtered.slice().sort((a,b)=>pct(b.vol,b.total)-pct(a.vol,a.total)).slice(0,10);
    h+=`<article class="card"><h2>${names[site]}</h2>${subFilterBar(site,s)}
      <div class="filter-summary">Mostrando <b>${filtered.length}</b> de <b>${s.groups.length}</b> SubCA · <b>${nf.format(view.total)}</b> piezas filtradas</div>
      ${s.unknown.length?`<div class="alertbox"><b>SubCA sin configurar:</b> ${s.unknown.map(x=>esc(x.subca)+' ('+nf.format(x.total)+')').join(' · ')}</div>`:''}
      <div class="rank-grid">${rank('Top 10 SubCA por carga',top,x=>x.total)}${rank('Top 10 SubCA voluminosos',topv,x=>x.vol)}${rank('Top 10 SubCA % voluminoso',topp,x=>pct(x.vol,x.total))}${rank('Top 10 CPT por carga',cs.slice().sort((a,b)=>b.total-a.total).slice(0,10),x=>x.total,'cpt')}</div>
      <h3>Participación por SubCA</h3>${subTable(view)}
      <h3>Participación por CPT</h3>${cptTable(view,cs)}
    </article>`;
  }
  $('subcaView').innerHTML=h||'<article class="card empty">Sin TMS.</article>';
  bindSubFilters();
}
function rank(title,a,v,n='subca'){return `<div class="rank-card"><h4>${title}</h4><table>${a.map((x,i)=>`<tr><td>${i+1}. ${esc(x[n])}</td><td>${pf.format(v(x))}</td></tr>`).join('')}</table></div>`}
function subTable(s){return `<div class="scroll"><table><tr><th>SubCA</th><th>Ola</th><th>CPT</th><th>Indicador</th><th>Piezas</th><th>% part.</th><th>Vol.</th><th>% Vol.</th><th>Bigger</th><th>SB</th></tr>${s.groups.slice().sort((a,b)=>b.total-a.total).map(g=>`<tr><td>${esc(g.subca)}</td><td>${esc(g.ola||'-')}</td><td>${g.cpt===''?'-':g.cpt}</td><td>${esc(g.indicador||'-')}</td><td>${nf.format(g.total)}</td><td>${pf.format(pct(g.total,s.total))}%</td><td>${nf.format(g.vol)}</td><td>${pf.format(pct(g.vol,g.total))}%</td><td>${nf.format(g.big)}</td><td>${nf.format(g.sb)}</td></tr>`).join('')}</table></div>`}
function cptTable(s,cs){return `<div class="scroll"><table><tr><th>CPT</th><th>Piezas</th><th>% part.</th><th>Vol.</th><th>% Vol.</th><th>Bigger</th><th>SB</th><th>Q SubCA</th></tr>${cs.map(x=>`<tr><td>${x.cpt}</td><td>${nf.format(x.total)}</td><td>${pf.format(pct(x.total,s.total))}%</td><td>${nf.format(x.vol)}</td><td>${pf.format(pct(x.vol,x.total))}%</td><td>${nf.format(x.big)}</td><td>${nf.format(x.sb)}</td><td>${x.subcas.size}</td></tr>`).join('')}</table></div>`}
function pieCard(title,items){
 const total=items.reduce((s,x)=>s+Math.max(0,x[1]),0);
 const colors=['#1769aa','#20a477','#f3a23c','#865ac2'];
 let cumulative=0;
 const stops=items.map((x,i)=>{const start=cumulative;cumulative+=total?Math.max(0,x[1])/total*100:0;return `${colors[i%colors.length]} ${start}% ${cumulative}%`}).join(',');
 return `<div class="pie-card"><h3>${esc(title)}</h3><div class="pie-layout"><div class="pie-ring" style="background:${total?`conic-gradient(${stops})`:'#dce5ef'}"><div><strong>${nf.format(total)}</strong><small>Total</small></div></div><div class="pie-legend">${items.map(([label,n],i)=>`<div><span class="pie-dot" style="background:${colors[i%colors.length]}"></span><b>${esc(label)}</b><strong>${nf.format(n)}</strong><em>${pf.format(pct(n,total))}%</em></div>`).join('')}</div></div></div>`;
}
function vehicleDistribution(site){
 const d=state.sites[site],v=d.registros?.vehicleTypes;
 if(!v)return d.arrivals?vehiclePie(d.arrivals):'';
 const items=[['Chasis','chasis','#28cda0'],['Camioneta','camioneta','#ffad18'],['Semi','semi','#58a6ff'],['Otros','otro','#9b8bc9']].map(([label,key,color])=>({label,color,veh:v[key]?.veh||0,packages:v[key]?.packages||0})).filter(x=>x.veh||x.packages);
 const total=items.reduce((a,x)=>a+x.veh,0),packages=items.reduce((a,x)=>a+x.packages,0);
 if(!total)return '';
 let acc=0;const gradient=items.filter(x=>x.veh).map(x=>{const from=acc;acc+=x.veh/total*100;return x.color+' '+from+'% '+acc+'%'}).join(',');
 const labels=items.filter(x=>x.veh).map(x=>{
   const angle=(items.filter(y=>y.veh).slice(0,items.indexOf(x)).reduce((n,y)=>n+y.veh,0)+x.veh/2)/total*Math.PI*2-Math.PI/2;
   const px=50+36*Math.cos(angle),py=50+36*Math.sin(angle),right=Math.cos(angle)>=0;
   const x2=50+49*Math.cos(angle),y2=50+49*Math.sin(angle);
   const x3=right?96:4;
   const y3=Math.max(8,Math.min(92,y2));
   return '<div class="vehicle-dist-label" style="--label-color:'+x.color+';left:'+x3+'%;top:'+y3+'%;transform:translate('+(right?'0':'-100%')+',-50%)"><b>'+nf.format(x.veh)+'</b><span>'+huPercent2(x.veh/total*100)+'%</span></div><svg class="vehicle-dist-leader" viewBox="0 0 100 100" preserveAspectRatio="none"><path d="M '+px+' '+py+' L '+x2+' '+y2+' L '+x3+' '+y3+'" stroke="'+x.color+'" stroke-width=".5" fill="none" vector-effect="non-scaling-stroke"/><circle cx="'+px+'" cy="'+py+'" r="1" fill="'+x.color+'"/></svg>';
 }).join('');
 return '<section class="vehicle-dist"><div class="vehicle-dist-heading"><div><h3>Distribución por tipo de vehículo</h3><p class="muted">Vehículos y paquetes recibidos por tipo · Easy Docking</p></div><div class="vehicle-dist-summary"><b>'+nf.format(total)+'</b> vehículos <span>·</span> <b>'+nf.format(packages)+'</b> piezas</div></div><div class="vehicle-dist-layout"><div class="vehicle-dist-chart"><div class="vehicle-dist-pie" style="background:conic-gradient('+gradient+')"><div>'+nf.format(total)+'<small>vehículos</small></div></div>'+labels+'</div><div class="vehicle-dist-cards">'+items.map(x=>'<div class="vehicle-dist-card" style="--vehicle-color:'+x.color+'"><div class="vehicle-dist-card-top"><b><i></i>'+x.label+'</b><strong>'+huPercent2(x.veh/total*100)+'%</strong></div><div class="vehicle-dist-card-stats"><span>VEHÍCULOS <b>'+nf.format(x.veh)+'</b></span><span>PIEZAS RECIBIDAS <b>'+nf.format(x.packages)+'</b><em>'+huPercent2(packages?x.packages/packages*100:0)+'% de piezas</em></span></div></div>').join('')+'<div class="vehicle-dist-total">TOTAL · '+nf.format(total)+' vehículos · '+nf.format(packages)+' piezas</div></div></div></section>';
}
function vehiclePie(a){if(!a?.ok)return '';const cm=a.camionetaMeli||0,co=a.camionetaOther??Math.max(0,(a.camioneta||0)-cm);return pieCard('Participación de vehículos',[['Semi',a.semi||0],['Chasis',a.chasis||0],['Camioneta',co],['Camioneta MELI',cm]])}
function packagePie(t){if(!t)return '';const vol=Math.max(0,t.vol-t.big-t.sb),big=t.big||0,sb=t.sb||0;return pieCard('Mix de paquetes',[['Paquetería',Math.max(0,t.totalConPost-vol-big-sb)],['Voluminoso',vol],['Bigger',big],['SuperBigger',sb]])}
function vehicleShareTable(a){
  if(!a?.ok)return '';
  const cm=a.camionetaMeli||0,co=a.camionetaOther??Math.max(0,(a.camioneta||0)-cm);
  const rows=[
    ['Semi',a.semi||0],['Chasis',a.chasis||0],['Camioneta',co],['Camioneta MELI',cm]
  ];
  return `<div class="vehicle-share"><h4>Participación por tipo de unidad</h4><table><tr><th>Unidad</th><th>Q</th><th>%</th></tr>${rows.map(([u,n])=>`<tr><td>${u}</td><td>${nf.format(n)}</td><td>${pf.format(pct(n,a.veh))}%</td></tr>`).join('')}<tr><td><b>Total vehículos</b></td><td><b>${nf.format(a.veh)}</b></td><td><b>100,0%</b></td></tr></table></div>`}

function huConfig(site){
  state.config.hu ??= {};
  state.config.hu[site] ??= {prod:190,objective:65,cptObjective:99.5,targetTime:'05:00',activeMinutes:10,huStartHour:7,huCutoff:'',connectedMode:'unique'};
  state.config.hu[site].objective ??= 65;
  state.config.hu[site].targetPct ??= 65;
  state.config.hu[site].inhubStartHour ??= 0;
  return state.config.hu[site];
}
function huCptRows(site,t){
  const mp=new Map(masters[site].map(x=>[String(x.subca).trim().toUpperCase(),x]));
  const m=new Map();
  for(const g of t.hu?.subca||[]){
    const cfg=mp.get(String(g.subca).trim().toUpperCase()),cpt=cfg?.cpt??'SIN CONFIG';
    if(!m.has(String(cpt)))m.set(String(cpt),{cpt,etiquetado:0,abierto:0,cerrado:0,pendiente:0,subcas:0,users:new Set()});
    const x=m.get(String(cpt));x.etiquetado+=g.etiquetado;x.abierto+=g.abierto;x.cerrado+=g.cerrado;x.pendiente+=g.pendiente;x.subcas++;
  }
  for(const a of huActiveUsers(site,t)){
    const cfg=mp.get(String(a.subca).trim().toUpperCase()),cpt=cfg?.cpt??'SIN CONFIG';
    const x=m.get(String(cpt)); if(x)x.users.add(a.user);
  }
  return [...m.values()].sort((a,b)=>String(a.cpt).localeCompare(String(b.cpt),'es',{numeric:true}));
}
const huPercent2=v=>Number(v||0).toLocaleString('es-AR',{minimumFractionDigits:2,maximumFractionDigits:2});
function huPct(x){return x.etiquetado?pct(x.abierto+x.cerrado,x.etiquetado):0}
function huTone(v,obj){return v>=obj?'hu-good':'hu-bad'}
function huActiveUsers(site,t){const cfg=huConfig(site),mins=Math.max(1,Number(cfg.activeMinutes)||10),max=t.hu?.maxOutTs;if(max==null)return[];const src=t.hu?.userActivity||t.hu?.activeUsers||[];return src.filter(x=>max-x.last<mins*60000)}
function hoursToTarget(lastTs,targetTime){
  if(!lastTs)return 0;
  const d=new Date(lastTs),[hh,mm]=String(targetTime||'05:00').split(':').map(Number);
  const target=new Date(d);target.setHours(hh||0,mm||0,0,0);
  if(target<=d)target.setDate(target.getDate()+1);
  return Math.max(0,(target-d)/3600000);
}
function fmtDuration(hours){
  if(!isFinite(hours)||hours<0)return '-';
  const total=Math.round(hours*60),h=Math.floor(total/60),m=total%60;
  return m?`${h} h ${String(m).padStart(2,'0')} min`:`${h} h`;
}
function huHourlyTable(t){
  const vals=(t.hu?.byHour||[]).map((v,h)=>({h,v})).filter(x=>x.v>0);
  if(!vals.length)return '<div class="hu-empty">Sin bipeos HU por hora para la fecha seleccionada.</div>';
  const total=vals.reduce((s,x)=>s+x.v,0),prom=(total+total)/(vals.length+1),max=Math.max(...vals.map(x=>x.v),1);
  return `<div class="hu-bipe-grid"><div><table class="hu-table compact"><tr><th>Hora</th><th>HU / piezas</th></tr>${vals.map(x=>`<tr><td>${x.h}</td><td>${nf.format(x.v)}</td></tr>`).join('')}<tr class="total"><td>Total general</td><td>${nf.format(total)}</td></tr></table></div><div><div class="hu-prom"><span>Promedio produc. total</span><b>${nf.format(Math.round(prom))}</b></div></div></div><div class="hu-bars">${vals.map(x=>`<div class="hu-bar-item"><span>${x.h}</span><div class="hu-bar-track"><i style="height:${Math.max(3,pct(x.v,max))}%"></i></div><b>${nf.format(x.v)}</b></div>`).join('')}</div>`;
}
function huProductivity(t){
  const rows=(t.hu?.userStats||[]).slice(0,12);
  if(!rows.length)return '<div class="hu-empty">Sin usuarios HU detectados.</div>';
  return `<table class="hu-table compact"><tr><th>Usuario HU</th><th>Piezas / eventos</th><th>Última actividad</th></tr>${rows.map(x=>`<tr><td>${esc(x.user)}</td><td>${nf.format(x.count)}</td><td>${x.last?new Date(x.last).toLocaleTimeString('es-AR',{hour:'2-digit',minute:'2-digit'}):'-'}</td></tr>`).join('')}</table>`;
}
function huSeparateAir(t){
 const air=g=>/_A$/i.test(String(g.subca||'').trim());
 const split=flag=>(t.hu?.subca||[]).filter(g=>air(g)===flag);
 const total=rows=>rows.reduce((a,g)=>{for(const k of ['etiquetado','abierto','cerrado','pendiente'])a[k]+=Number(g[k]||0);return a},{etiquetado:0,abierto:0,cerrado:0,pendiente:0});
 const normal=split(false),meli=split(true);
 return {normal:{...t,hu:{...t.hu,subca:normal,totals:total(normal),userActivity:(t.hu.userActivity||[]).filter(x=>!air(x))}},meli:{...t,hu:{...t.hu,subca:meli,totals:total(meli),userActivity:(t.hu.userActivity||[]).filter(air)} }};
}
function huAirPanel(site,t,detailMode=false){
 const x=huSeparateAir(t).meli,tot=x.hu.totals,progress=tot.etiquetado?pct(tot.abierto+tot.cerrado,tot.etiquetado):0;
 const airUsers=[...new Map(huActiveUsers(site,x).map(u=>[u.user,{user:u.user,last:u.last}])).values()];
 if(!detailMode)return `<section class="hu-air-compact"><h3>Armado de HU · MELI Air</h3><table class="hu-table"><tr><th>CPT</th><th>Etiquetado</th><th>HU-Abierto</th><th>HU-Cerrado</th><th>Pend. HU</th><th>% Avance</th><th>Users activos</th></tr><tr class="hu-air-row"><td>00:00</td><td>${nf.format(tot.etiquetado)}</td><td>${nf.format(tot.abierto)}</td><td>${nf.format(tot.cerrado)}</td><td>${nf.format(tot.pendiente)}</td><td><span class="hu-pill ${huTone(progress,huConfig(site).objective)}">${huPercent2(progress)}%</span></td><td>${huUserButton(airUsers,'MELI Air · conectados')}</td></tr></table></section>`;
 return `<section class="hu-air-panel"><h3>MELI AIR · Detalle por SubCA</h3><div class="hu-scroll"><table class="hu-table"><tr><th>SubCA</th><th>Etiquetado</th><th>Abierto</th><th>Cerrado</th><th>Pendiente</th><th>Avance</th><th>Conectados</th></tr>${x.hu.subca.map(g=>`<tr><td>${esc(g.subca)}</td><td>${nf.format(g.etiquetado)}</td><td>${nf.format(g.abierto)}</td><td>${nf.format(g.cerrado)}</td><td>${nf.format(g.pendiente)}</td><td>${huPercent2(g.etiquetado?pct(g.abierto+g.cerrado,g.etiquetado):0)}%</td><td>${huUserButton(airUsers.filter(u=>huActiveUsers(site,x).some(a=>a.user===u.user&&String(a.subca).toUpperCase()===String(g.subca).toUpperCase())),g.subca+' · conectados')}</td></tr>`).join('')}</table></div></section>`;
}
function huDashboard(site,originalT){
  const t=huSeparateAir(originalT).normal;
  const cfg=huConfig(site),tot=t.hu?.totals||{etiquetado:0,abierto:0,cerrado:0,pendiente:0};
  const avance=tot.etiquetado?pct(tot.abierto+tot.cerrado,tot.etiquetado):0;
  const rows=huCptRows(site,t),activeUsers=huActiveUsers(site,t),uniqueConnected=new Set(activeUsers.map(x=>x.user)).size,duplicateConnected=rows.reduce((sum,x)=>sum+x.users.size,0),active=cfg.connectedMode==='byCpt'?duplicateConnected:uniqueConnected;
  const hours=hoursToTarget(t.hu?.maxOutTs,cfg.targetTime),prod=Math.max(1,Number(cfg.prod)||190);
  const goalPct=Math.max(0,Math.min(100,Number(cfg.targetPct??65))),forecast=Number($(site==='soldati'?'fcS':'fcE')?.value)||0,goalPieces=forecast>0?Math.ceil(forecast*goalPct/100):null,remainingGoal=goalPieces===null?null:Math.max(0,goalPieces-tot.abierto-tot.cerrado);
  const pph=remainingGoal===null?null:hours>0?remainingGoal/hours:null,need=pph===null?null:Math.ceil(pph/prod),realProd=active*prod,capacity=realProd*hours,gap=need===null?null:active-need;
  const bad=rows.filter(x=>huPct(x)<cfg.cptObjective);
  const update=t.hu?.maxOutTs?new Date(t.hu.maxOutTs).toLocaleTimeString('es-AR',{hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false}):'-';
  return `<section class="hu-dashboard" data-hu-site="${site}">
    <div class="hu-head">
      <div><span class="hu-brand">OCASA</span><h2>${names[site]} · Control HU</h2><small>Última actualización HU <b>${update}</b> · conectados = actividad dentro de los últimos ${cfg.activeMinutes} min</small></div>
      <div class="hu-head-actions"><label>Corte de análisis (opcional)<input type="time" data-hucutoff="${site}" value="${cfg.huCutoff||''}"></label><button class="smallbtn primary" data-cutapply="${site}">Aplicar corte</button><button class="smallbtn" data-cutclear="${site}">Limpiar corte</button><label>Inicio HU (base Inhub TMS)<select data-hustart="${site}">${Array.from({length:24},(_,i)=>`<option value="${i}" ${i===(cfg.huStartHour??7)?'selected':''}>${String(i).padStart(2,'0')}:00</option>`).join('')}</select></label><button class="smallbtn primary" data-huapply="${site}">Aplicar horario</button><label>Inicio Inhub<select data-inhubstart="${site}">${Array.from({length:24},(_,i)=>`<option value="${i}" ${i===(cfg.inhubStartHour??0)?'selected':''}>${String(i).padStart(2,'0')}:00</option>`).join('')}</select></label><button class="smallbtn primary" data-inhubapply="${site}">Aplicar Inhub</button>
        <label>Hora objetivo<input type="time" data-hucfg="targetTime" data-site="${site}" value="${cfg.targetTime}"></label>
        <label>Objetivo avance %<input type="number" min="0" max="100" step="0.1" data-hucfg="targetPct" data-site="${site}" value="${cfg.targetPct}"></label><label>Prod. objetivo pza/h<input type="number" data-hucfg="prod" data-site="${site}" value="${cfg.prod}"></label>
        <label>Verde desde %<input type="number" min="0" max="100" step="0.1" data-hucfg="objective" data-site="${site}" value="${cfg.objective}"></label><label>Obj. cierre CPT %<input type="number" step="0.1" data-hucfg="cptObjective" data-site="${site}" value="${cfg.cptObjective}"></label><label>Conteo conectados<select data-hucfg="connectedMode" data-site="${site}"><option value="unique" ${cfg.connectedMode!=='byCpt'?'selected':''}>Sin duplicados</option><option value="byCpt" ${cfg.connectedMode==='byCpt'?'selected':''}>Con duplicados (por CPT)</option></select></label><label>Ventana conectados (min)<input type="number" min="1" max="120" step="1" data-hucfg="activeMinutes" data-site="${site}" value="${cfg.activeMinutes}"></label>
      </div>
    </div>
    ${cfg.huCutoff?`<p class="hu-cutoff-notice">Filtro Inhub hasta ${cfg.huCutoff} · los estados HU reflejan la descarga TMS cargada, no una reconstrucción histórica exacta.</p>`:''}<div class="hu-status-strip">
      <div><span>Última actualización</span><b>${update}</b></div>
      <div><span>Hora objetivo</span><b>${cfg.targetTime}</b></div>
      <div><span>Tiempo restante</span><b>${fmtDuration(hours)}</b></div>
      <div><span>Conectados ${cfg.connectedMode==='byCpt'?'por CPT (con duplicados)':'únicos'}</span><b>${nf.format(active)}</b><small>Únicos: ${nf.format(uniqueConnected)} · Por CPT: ${nf.format(duplicateConnected)}</small></div>
      <div><span>Necesarios para ${pf.format(goalPct)}%</span><b>${need===null?'Sin proyectado':nf.format(need)}</b></div>
      <div class="${gap!==null&&gap>=0?'gap-good':'gap-bad'}"><span>Brecha</span><b>${gap===null?'—':(gap>0?'+':'')+nf.format(gap)}</b></div>
    </div>
    <div class="hu-layout">
      <div class="hu-left">
        <div class="hu-kpi-panel">
          <table class="hu-summary"><tr><td>TOTAL Piezas</td><td>${nf.format(tot.etiquetado)}</td></tr><tr><td>Piezas con HU Abierto</td><td>${nf.format(tot.abierto)}</td></tr><tr><td>Piezas HU Cerrado</td><td>${nf.format(tot.cerrado)}</td></tr><tr><td>Piezas Pendientes de HU</td><td>${nf.format(tot.pendiente)}</td></tr></table>
          <div class="hu-big ${huTone(avance,cfg.objective)}">${huPercent2(avance)}%</div>
        </div>
        ${huAirPanel(site,originalT,false)}
        <div class="hu-titlebar">CONTROL - CPT / XD</div>
        <h3>Armado de HU · General (sin MELI Air)</h3>
        <div class="hu-scroll hu-cpt-full"><table class="hu-table"><tr><th>CPT</th><th>Etiquetado</th><th>HU-Abierto</th><th>HU-Cerrado</th><th>Pend. HU</th><th>% Avance</th><th>% Share</th><th>Users activos</th></tr>
        ${rows.map(x=>{const a=huPct(x);return `<tr><td>${x.cpt}</td><td>${nf.format(x.etiquetado)}</td><td>${nf.format(x.abierto)}</td><td>${nf.format(x.cerrado)}</td><td class="hu-pend">${nf.format(x.pendiente)}</td><td><span class="hu-pill ${huTone(a,cfg.objective)}">${huPercent2(a)}%</span></td><td>${huPercent2(tot.etiquetado?pct(x.etiquetado,tot.etiquetado):0)}%</td><td>${huUserButton([...x.users].map(user=>({user,last:(huActiveUsers(site,t).find(a=>a.user===user)?.last||null)})),'CPT '+x.cpt+' · conectados')}</td></tr>`}).join('')}
        <tr class="total"><td>Total</td><td>${nf.format(tot.etiquetado)}</td><td>${nf.format(tot.abierto)}</td><td>${nf.format(tot.cerrado)}</td><td>${nf.format(tot.pendiente)}</td><td>${huPercent2(avance)}%</td><td>100,00%</td><td>${huUserButton(cfg.connectedMode==='byCpt'?rows.flatMap(x=>[...x.users].map(user=>({user,last:activeUsers.find(a=>a.user===user)?.last||null,cpt:x.cpt}))):[...new Map(activeUsers.map(a=>[a.user,{user:a.user,last:a.last}])).values()],cfg.connectedMode==='byCpt'?'Total · conectados por CPT':'Total · conectados únicos')}</td></tr></table></div>
      </div>
      <div class="hu-right">
        <h3>Datos operativos</h3>
        <div class="hu-ops"><table class="hu-table op">
          <tr><td>total</td><td>${nf.format(tot.etiquetado)}</td></tr>
          <tr><td>objetivo ${pf.format(goalPct)}% a las ${cfg.targetTime}</td><td>${goalPieces===null?'Cargar proyectado':nf.format(goalPieces)}</td></tr><tr><td>piezas faltantes para objetivo</td><td>${remainingGoal===null?'-':nf.format(remainingGoal)}</td></tr>
          <tr><td>piezas procesadas</td><td>${nf.format(tot.abierto+tot.cerrado)}</td></tr>
          <tr><td>HU cerrado</td><td>${nf.format(tot.cerrado)}</td></tr>
          <tr><td>pendiente total HU</td><td>${nf.format(tot.pendiente)}</td></tr>
          <tr><td>hs restantes</td><td>${fmtDuration(hours)}</td></tr>
          <tr><td>pza x hs neces</td><td>${pph===null?'-':nf.format(Math.ceil(pph))}</td></tr>
          <tr><td>usuarios HU necesarios</td><td class="hu-need">${need===null?'-':nf.format(need)}</td></tr>
          <tr><td>conectados reales</td><td>${nf.format(active)}</td></tr>
          <tr><td>brecha</td><td class="${gap>=0?'gap-good-cell':'gap-bad-cell'}">${gap>0?'+':''}${nf.format(gap)}</td></tr>
          <tr><td>producción real/h</td><td>${nf.format(realProd)}</td></tr>
          <tr><td>capacidad hasta ${cfg.targetTime}</td><td>${nf.format(Math.round(capacity))}</td></tr>
        </table></div>
        ${huInhubMini(site)}
      </div>
    </div>
    ${huAirPanel(site,originalT,true)}
    <div class="hu-tracking-block"><h3>Seguimiento por CPT y SubCA</h3><div class="hu-note">Avance, pendientes y conectados activos por cada SubCA dentro de su CPT.</div>${huTrackingTable(site,t)}</div>
    ${dotMonitor(site,originalT)}
    <div class="hu-bottom-grid">
      <div><h3>Auditoría CPT · objetivo ${pf.format(cfg.cptObjective)}%</h3><div class="hu-scroll"><table class="hu-table compact"><tr><th>CPT</th><th>Avance</th><th>Pendiente</th><th>Estado</th></tr>${rows.map(x=>{const a=huPct(x),ok=a>=cfg.cptObjective;return `<tr><td>${x.cpt}</td><td>${huPercent2(a)}%</td><td>${nf.format(x.pendiente)}</td><td><span class="hu-pill ${ok?'hu-good':a>=95?'hu-warn':'hu-bad'}">${ok?'CUMPLE':'PENDIENTE'}</span></td></tr>`}).join('')}</table></div><div class="hu-note">${bad.length?bad.length+' CPT debajo del objetivo final':'Todos los CPT cumplen el objetivo final'}.</div></div>
      <div><h3>Productividad HU · Top usuarios</h3><div class="hu-scroll">${huProductivity(t)}</div></div>
    </div>
  </section>`;
}
function bindHuControls(){
  document.querySelectorAll('[data-hucfg]').forEach(el=>el.onchange=()=>{
    const site=el.dataset.site,k=el.dataset.hucfg;
    huConfig(site)[k]=k==='targetTime'||k==='connectedMode'?el.value:Number(el.value);
    huControl();
  });
}

function huDetailRows(site,t){
  const mp=new Map(masters[site].map(x=>[String(x.subca).trim().toUpperCase(),x]));
  const activeBySub=new Map();
  for(const a of huActiveUsers(site,t)){
    const k=String(a.subca||'SIN SUBCA');
    if(!activeBySub.has(k))activeBySub.set(k,new Map());
    const m=activeBySub.get(k),prev=m.get(a.user);if(!prev||a.last>prev.last)m.set(a.user,{user:a.user,last:a.last});
  }
  return (t.hu?.subca||[]).map(g=>{
    const cfg=mp.get(String(g.subca).trim().toUpperCase())||{};
    return {
      ...g,
      finalizado:g.finalizado||0,
      enDespacho:g.enDespacho||0,
      despachado:g.despachado||0,
      ola:cfg.ola||'',
      cpt:cfg.cpt??'SIN CONFIG',
      indicador:cfg.indicador||'',
      userList:[...(activeBySub.get(String(g.subca))?.values()||[])].sort((a,b)=>String(a.user).localeCompare(String(b.user),'es')),
      users:activeBySub.get(String(g.subca))?.size||0,
      avance:g.etiquetado?pct(g.abierto+g.cerrado,g.etiquetado):0
    };
  }).sort((a,b)=>String(a.cpt).localeCompare(String(b.cpt),'es',{numeric:true})||b.etiquetado-a.etiquetado);
}
function huCptTracking(site,t){
  const rows=huDetailRows(site,t),groups=new Map();
  for(const r of rows){
    const k=String(r.cpt);
    if(!groups.has(k))groups.set(k,{cpt:r.cpt,etiquetado:0,abierto:0,cerrado:0,pendiente:0,finalizado:0,enDespacho:0,despachado:0,userMap:new Map(),users:0,subcas:[]});
    const g=groups.get(k);
    g.etiquetado+=r.etiquetado;g.abierto+=r.abierto;g.cerrado+=r.cerrado;g.pendiente+=r.pendiente;g.finalizado+=r.finalizado;g.enDespacho+=r.enDespacho;g.despachado+=r.despachado;for(const u of r.userList||[]){const p=g.userMap.get(u.user);if(!p||u.last>p.last)g.userMap.set(u.user,u)}g.users=g.userMap.size;g.subcas.push(r);
  }
  return [...groups.values()].map(g=>({...g,userList:[...g.userMap.values()].sort((a,b)=>String(a.user).localeCompare(String(b.user),'es')),avance:g.etiquetado?pct(g.abierto+g.cerrado,g.etiquetado):0}))
    .sort((a,b)=>String(a.cpt).localeCompare(String(b.cpt),'es',{numeric:true}));
}
function huUserButton(list,label){
  const n=list?.length||0;if(!n)return '<span class="user-zero">0</span>';
  const payload=encodeURIComponent(JSON.stringify(list.map(x=>({user:x.user,last:x.last,cpt:x.cpt}))));
  return `<button type="button" class="user-link" data-user-list="${payload}" data-user-label="${esc(label)}">${nf.format(n)}</button>`;
}
function bindHuUserClicks(){
  document.querySelectorAll('[data-user-list]').forEach(btn=>btn.onclick=e=>{
    e.preventDefault();e.stopPropagation();
    let list=[];try{list=JSON.parse(decodeURIComponent(btn.dataset.userList||''))}catch{}
    const rows=list.map(x=>`<tr><td>${esc(x.user)}</td><td>${x.cpt==null?'-':esc(x.cpt)}</td><td>${x.last?new Date(x.last).toLocaleTimeString('es-AR',{hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false}):'-'}</td></tr>`).join('');
    const modal=document.createElement('div');modal.className='user-modal';
    modal.innerHTML=`<div class="user-modal-card"><div class="user-modal-head"><div><h3>${esc(btn.dataset.userLabel||'Usuarios conectados')}</h3><small>${nf.format(list.length)} ${list.some(x=>x.cpt!=null)?'registros por CPT':'usuarios únicos'} según la ventana configurada</small></div><button type="button" class="user-close">×</button></div><div class="user-modal-body"><table class="hu-table compact"><tr><th>Usuario</th><th>CPT</th><th>Última actividad</th></tr>${rows||'<tr><td colspan="3">Sin usuarios activos.</td></tr>'}</table></div></div>`;
    document.body.appendChild(modal);
    const close=()=>modal.remove();modal.querySelector('.user-close').onclick=close;modal.onclick=ev=>{if(ev.target===modal)close()};document.addEventListener('keydown',function escClose(ev){if(ev.key==='Escape'){close();document.removeEventListener('keydown',escClose)}});
  });
}
function huTrackingTable(site,t){
  const groups=huCptTracking(site,t);
  if(!groups.length)return '<div class="hu-empty">Sin información por CPT/SubCA.</div>';
  return `<div class="cpt-track">${groups.map(g=>`
    <details class="cpt-group" open>
      <summary>
        <span class="cpt-name">CPT ${esc(g.cpt)}</span>
        <span>${g.subcas.length} SubCA</span>
        <span>${nf.format(g.etiquetado)} piezas</span>
        <span>${pf.format(g.avance)}% avance</span>
        <span>${huUserButton(g.userList,'CPT '+g.cpt+' · usuarios conectados')}</span>
        <span>${nf.format(g.finalizado)} fin. · ${nf.format(g.enDespacho)} desp. · ${nf.format(g.despachado)} sal.</span>
        <span class="hu-pill ${huTone(g.avance,99.5)}">${nf.format(g.pendiente)} pend.</span>
      </summary>
      <div class="hu-scroll cpt-sub-scroll"><table class="hu-table compact">
        <tr><th>SubCA</th><th>Ola</th><th>Indicador</th><th>Etiquetado</th><th>HU Abierto</th><th>HU Cerrado</th><th>Pendiente</th><th>% Avance</th><th>Conectados</th><th>HU Finalizado</th><th>En despacho</th><th>Despachado</th></tr>
        ${g.subcas.map(r=>`<tr>
          <td>${esc(r.subca)}</td><td>${esc(r.ola||'-')}</td><td>${esc(r.indicador||'-')}</td>
          <td>${nf.format(r.etiquetado)}</td><td>${nf.format(r.abierto)}</td><td>${nf.format(r.cerrado)}</td>
          <td class="hu-pend">${nf.format(r.pendiente)}</td>
          <td><span class="hu-pill ${huTone(r.avance,99.5)}">${pf.format(r.avance)}%</span></td>
          <td>${huUserButton(r.userList,r.subca+' · usuarios conectados')}</td><td>${nf.format(r.finalizado)}</td><td>${nf.format(r.enDespacho)}</td><td>${nf.format(r.despachado)}</td>
        </tr>`).join('')}
      </table></div>
    </details>`).join('')}</div>`;
}

function dotTarget(site){state.config.dot??={};const c=state.config.dot[site]??={};if(c.objective==null)c.objective=99.55;if(c.start==null)c.start='09:00';if(c.end==null)c.end='13:00';if(c.status==null)c.status='all';if(c.subca==null)c.subca='all';if(c.excludeAir==null)c.excludeAir=false;if(c.detail==null)c.detail='subca';return c}
function dotDay(ts){const d=new Date(ts);return [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-')}
function dotTime(day,time,plus=0){if(!day||!time)return null;const [y,m,d]=day.split('-').map(Number),[h,min]=time.split(':').map(Number);return new Date(y,m-1,d+plus,h,min||0,0).getTime()}
function dotCptTime(day,cpt){if(!day||cpt==null)return null;const raw=String(cpt).trim();const m=raw.match(/^(\d{1,2})(?::(\d{2}))?/);if(!m)return null;const h=+m[1],min=+(m[2]||0);if(h>23)return null;return dotTime(day,String(h).padStart(2,'0')+':'+String(min).padStart(2,'0'),h<9?1:0)}
function dotData(site,t){
 const cfg=dotTarget(site),src=t.dotRows||[],master=new Map(masters[site].map(x=>[String(x.subca).trim().toUpperCase(),x]));
 const statuses=[...new Set(src.map(x=>x.status).filter(Boolean))].sort(),subcas=[...new Set(src.map(x=>x.subca).filter(Boolean))].sort();
 const reference=state.config.analysisDate||null,base=reference|| (src.find(x=>x.inTs!=null)?dotDay(src.find(x=>x.inTs!=null).inTs):null);
 const start=dotTime(base,cfg.start),end=dotTime(base,cfg.end,1),latest=Math.max(0,t.maxInTs||0,t.hu?.maxOutTs||0,...src.filter(x=>x.dispatchTs!=null).map(x=>x.dispatchTs));
 const now=latest||Date.now(),groups=new Map(),huMap=new Map();let missingMaster=0;
 for(const x of src){
  if(x.inTs==null||start==null||x.inTs<start||x.inTs>end)continue;
  const zone=String(x.subca||'').trim(),status=String(x.status||'').trim();
  if(cfg.excludeAir&&/_A$/i.test(zone))continue;
  if(cfg.status!=='all'&&status!==cfg.status)continue;
  if(cfg.subca!=='all'&&zone!==cfg.subca)continue;
  const m=master.get(zone.toUpperCase());if(!m){missingMaster++;continue}
  const deadline=dotCptTime(base,m.cpt);if(deadline==null){missingMaster++;continue}
  const cpt=String(m.cpt),key=cpt+'|'+zone;
  if(!groups.has(key))groups.set(key,{cpt,subca:zone,total:0,onTime:0,delay:0,deviation:0,pending:0,shipments:[]});
  const g=groups.get(key);g.total++;
  const kind=x.dispatchTs!=null?(x.dispatchTs<=deadline?'onTime':'delay'):(now>=deadline?'deviation':'pending');g[kind]++;
  if(kind==='pending'||kind==='deviation'){
   const item={shipment:x.shipment,hu:x.hu,subca:zone,cpt,status,kind};
   g.shipments.push(item);
   if(x.hu){const hk=x.hu+'|'+zone+'|'+cpt;if(!huMap.has(hk))huMap.set(hk,{hu:x.hu,subca:zone,cpt,pending:0,deviation:0,shipments:[]});const h=huMap.get(hk);h[kind]++;h.shipments.push(item)}
  }
 }
 const rows=[...groups.values()],cptMap=new Map(),total={total:0,onTime:0,delay:0,deviation:0,pending:0};
 for(const g of rows){for(const k of Object.keys(total))total[k]+=g[k];if(!cptMap.has(g.cpt))cptMap.set(g.cpt,{cpt:g.cpt,total:0,onTime:0,delay:0,deviation:0,pending:0,subcas:[]});const c=cptMap.get(g.cpt);for(const k of Object.keys(total))c[k]+=g[k];c.subcas.push(g)}
 const cpts=[...cptMap.values()].sort((a,b)=>Number(a.cpt)-Number(b.cpt));return{rows,cpts,total,hus:[...huMap.values()],statuses,subcas,missingMaster,base,latest,hasDispatchField:t.dotHasDispatchField!==false,objective:Number(cfg.objective)||99.55};
}
function dotMonitor(site,t){
 const cfg=dotTarget(site),d=dotData(site,t),v=d.total,den=v.onTime+v.delay+v.deviation,score=den?100*v.onTime/den:null;
 const opts=(values,selected)=>values.map(x=>'<option value="'+esc(x)+'" '+(selected===x?'selected':'')+'>'+esc(x==='all'?'Todos':x)+'</option>').join('');
 const details=cfg.detail==='hu'?d.hus.map(x=>({label:x.hu,subca:x.subca,cpt:x.cpt,pending:x.pending,deviation:x.deviation,shipments:x.shipments})):cfg.detail==='cpt'?d.cpts.map(x=>({label:'CPT '+x.cpt,subca:x.subcas.length+' SubCA',cpt:x.cpt,pending:x.pending,deviation:x.deviation,shipments:x.subcas.flatMap(z=>z.shipments)})):d.rows.map(x=>({label:x.subca,subca:x.subca,cpt:x.cpt,pending:x.pending,deviation:x.deviation,shipments:x.shipments}));
 const filtered=details.filter(x=>x.shipments.length);
 return '<section class="dot-panel"><div class="hu-section-title"><div><h3>Dispatch On Time · DOT</h3><div class="hu-note">Ingresos Inhub de la jornada · despacho real: Dispatch Date Finished. CPT de madrugada corresponde al día siguiente.</div></div><label>Objetivo DOT %<input type="number" min="0" max="100" step="0.01" data-dot-objective="'+site+'" value="'+cfg.objective+'"></label></div>'+
 '<div class="hu-head-actions" style="display:flex;gap:12px;flex-wrap:wrap;margin:12px 0">'+
 '<label>Inicio Inhub <input type="time" data-dot-filter="start" data-site="'+site+'" value="'+cfg.start+'"></label>'+
 '<label>Fin jornada (+1 día) <input type="time" data-dot-filter="end" data-site="'+site+'" value="'+cfg.end+'"></label>'+
 '<label>Hub Status <select data-dot-filter="status" data-site="'+site+'">'+opts(['all',...d.statuses],cfg.status)+'</select></label>'+
 '<label>Labeling Zone / SubCA <select data-dot-filter="subca" data-site="'+site+'">'+opts(['all',...d.subcas],cfg.subca)+'</select></label>'+
 '<label>Excluir MELI Air <input type="checkbox" data-dot-filter="excludeAir" data-site="'+site+'" '+(cfg.excludeAir?'checked':'')+'></label></div>'+
 '<div class="hu-note">Jornada: '+esc(d.base||'sin fecha')+' · Corte de datos: '+(d.latest?new Date(d.latest).toLocaleString('es-AR'):'sin registros')+(d.missingMaster?' · '+nf.format(d.missingMaster)+' registros sin CPT configurado':'')+(!d.hasDispatchField?' · ADVERTENCIA: falta Dispatch Date Finished en el CSV':'')+'</div>'+
 '<div class="hu-status-strip">'+[['DOT',score==null?'Sin datos':pf.format(score)+'%'],['Ingresados',nf.format(v.total)],['On Time',nf.format(v.onTime)],['Delay',nf.format(v.delay)],['Desvío',nf.format(v.deviation)],['Pendiente sin vencer',nf.format(v.pending)],['Despachado / ingresado',v.total?pf.format(100*(v.onTime+v.delay)/v.total)+'%':'-']].map(x=>'<div><span>'+x[0]+'</span><b>'+x[1]+'</b></div>').join('')+'</div>'+
 '<div class="hu-head-actions" style="margin:16px 0"><label>Ver pendientes <select data-dot-filter="detail" data-site="'+site+'">'+opts(['subca','hu','cpt'],cfg.detail)+'</select></label></div>'+
 '<div class="hu-scroll"><table class="hu-table compact"><tr><th>SubCA / HU / CPT</th><th>SubCA</th><th>CPT</th><th>Pendientes</th><th>Desvíos</th><th>Ver</th></tr>'+
 filtered.map((x,i)=>'<tr><td>'+esc(x.label)+'</td><td>'+esc(x.subca)+'</td><td>'+esc(x.cpt)+'</td><td>'+nf.format(x.pending)+'</td><td>'+nf.format(x.deviation)+'</td><td><button type="button" data-dot-detail="'+i+'" data-site="'+site+'">Ver envíos</button></td></tr>').join('')+
 (!filtered.length?'<tr><td colspan="6">Sin pendientes para estos filtros.</td></tr>':'')+'</table></div>'+
 '<div class="cpt-track">'+d.cpts.map(c=>'<details class="cpt-group"><summary><span class="cpt-name">CPT '+esc(c.cpt)+'</span><span>'+nf.format(c.total)+' ingresados</span><span>'+nf.format(c.onTime)+' On Time</span><span>'+nf.format(c.delay)+' Delay</span><span>'+nf.format(c.deviation)+' Desvío</span><span>'+nf.format(c.pending)+' pendientes</span></summary><div class="hu-scroll"><table class="hu-table compact"><tr><th>SubCA</th><th>Ingresados</th><th>On Time</th><th>Delay</th><th>Desvío</th><th>Pendiente</th></tr>'+c.subcas.map(z=>'<tr><td>'+esc(z.subca)+'</td><td>'+nf.format(z.total)+'</td><td>'+nf.format(z.onTime)+'</td><td>'+nf.format(z.delay)+'</td><td>'+nf.format(z.deviation)+'</td><td>'+nf.format(z.pending)+'</td></tr>').join('')+'</table></div></details>').join('')+'</div></section>';
}
function bindDotControls(){
 document.querySelectorAll('[data-dot-objective]').forEach(el=>el.onchange=()=>{dotTarget(el.dataset.dotObjective).objective=Math.max(0,Math.min(100,Number(el.value)||99.55));huControl()});
 document.querySelectorAll('[data-dot-filter]').forEach(el=>el.onchange=()=>{dotTarget(el.dataset.site)[el.dataset.dotFilter]=el.type==='checkbox'?el.checked:el.value;huControl()});
 document.querySelectorAll('[data-dot-detail]').forEach(btn=>btn.onclick=()=>{
 const site=btn.dataset.site,cfg=dotTarget(site),d=dotData(site,state.sites[site].tms);
 const data=cfg.detail==='hu'?d.hus.map(x=>({label:x.hu,shipments:x.shipments})):cfg.detail==='cpt'?d.cpts.map(x=>({label:'CPT '+x.cpt,shipments:x.subcas.flatMap(z=>z.shipments)})):d.rows.map(x=>({label:x.subca,shipments:x.shipments}));
 const selected=data.filter(x=>x.shipments.length),entry=selected[Number(btn.dataset.dotDetail)];if(!entry)return;
 const modal=document.createElement('div');modal.className='user-modal';
 modal.innerHTML='<div class="user-modal-card" style="max-width:1050px"><div class="user-modal-head"><div><h3>'+esc(entry.label)+' · pendientes de despacho</h3><small>'+nf.format(entry.shipments.length)+' envíos · máximo 1.000 en vista previa</small></div><button type="button" class="user-close">×</button></div><div class="user-modal-body"><table class="hu-table compact"><tr><th>Shipment ID</th><th>Outbound ID / HU</th><th>SubCA</th><th>CPT</th><th>Hub Status</th><th>DOT</th></tr>'+entry.shipments.slice(0,1000).map(x=>'<tr><td>'+esc(x.shipment)+'</td><td>'+esc(x.hu||'-')+'</td><td>'+esc(x.subca)+'</td><td>'+esc(x.cpt)+'</td><td>'+esc(x.status)+'</td><td>'+(x.kind==='deviation'?'Desvío':'Pendiente')+'</td></tr>').join('')+'</table></div></div>';
 document.body.appendChild(modal);modal.querySelector('.user-close').onclick=()=>modal.remove();modal.onclick=e=>{if(e.target===modal)modal.remove()};
 });
}
function huControl(){
  for(const [site,id] of [['soldati','huViewSoldati'],['echeverria','huViewEcheverria']]){
    const t=state.sites[site].tms;
    $(id).innerHTML=t?.hu?huDashboard(site,t):'<div class="card empty">Procesá el TMS de '+names[site]+' para ver su Control HU.</div>';
  }
  bindHuControls();
  document.querySelectorAll('[data-arrival-apply]').forEach(b=>b.onclick=()=>{const site=b.dataset.arrivalApply,sel=document.querySelector(`[data-arrival-start="${site}"]`);if(!sel)return;huConfig(site).arrivalStartHour=Number(sel.value);huControl();});
  document.querySelectorAll('[data-inhubapply]').forEach(b=>b.onclick=()=>{const site=b.dataset.inhubapply,sel=document.querySelector(`[data-inhubstart="${site}"]`);if(!sel)return;huConfig(site).inhubStartHour=Number(sel.value);huControl();});
  document.querySelectorAll('[data-huapply]').forEach(b=>b.onclick=async()=>{const site=b.dataset.huapply,sel=document.querySelector(`[data-hustart="${site}"]`);if(!sel)return;huConfig(site).huStartHour=Number(sel.value);if(!state.sites[site].files.tms)return;const prev=b.textContent;b.disabled=true;b.textContent='Recalculando...';try{state.sites[site].tms=await runT(site);renderAll()}catch(e){alert('No se pudo recalcular el Control HU: '+e.message);b.disabled=false;b.textContent=prev}});
  document.querySelectorAll('[data-cutapply],[data-cutclear]').forEach(b=>b.onclick=async()=>{
    const site=b.dataset.cutapply||b.dataset.cutclear,clear=!!b.dataset.cutclear;
    const input=document.querySelector(`[data-hucutoff="${site}"]`);
    const next=clear?'':(input?.value||'');
    if(!clear&&!/^([01]\d|2[0-3]):[0-5]\d$/.test(next)){alert('Seleccioná una hora válida.');return}
    huConfig(site).huCutoff=next;
    b.disabled=true;b.textContent='Recalculando...';
    try{state.sites[site].tms=await runT(site);renderAll()}
    catch(e){alert('Error al aplicar corte: '+e.message);b.disabled=false;b.textContent=clear?'Limpiar corte':'Aplicar corte'}
  });
  bindHuUserClicks();
  bindDotControls();
}

async function initMasters(){const[s,e]=await Promise.all([fetch('./js/config/masterS.json').then(r=>r.json()),fetch('./js/config/masterE.json').then(r=>r.json())]);state.defaults={masterS:s,masterE:e};const masterVersion='2026-10-27-v2';if(localStorage.getItem('inhubMasterVersion')!==masterVersion){localStorage.removeItem('inhubMasterS');localStorage.removeItem('inhubMasterE');localStorage.setItem('inhubMasterVersion',masterVersion)}masters.soldati=JSON.parse(localStorage.getItem('inhubMasterS')||'null')||s;masters.echeverria=JSON.parse(localStorage.getItem('inhubMasterE')||'null')||e;masterUI()}
function masterUI(){let h='';for(const site of ['soldati','echeverria'])h+=`<div class="card"><h3>${names[site]}</h3><div class="master-actions"><button class="smallbtn primary" data-add="${site}">+ Agregar</button><button class="smallbtn ghost" data-reset="${site}">Restaurar</button></div><div class="scroll"><table><tr><th>SubCA</th><th>Ola</th><th>CPT</th><th>Indicador</th><th></th></tr>${masters[site].map((x,i)=>`<tr><td><input data-site="${site}" data-i="${i}" data-f="subca" value="${esc(x.subca)}"></td><td><input data-site="${site}" data-i="${i}" data-f="ola" value="${esc(x.ola)}"></td><td><input type="number" data-site="${site}" data-i="${i}" data-f="cpt" value="${x.cpt}"></td><td><select data-site="${site}" data-i="${i}" data-f="indicador"><option ${x.indicador==='prioritario'?'selected':''}>prioritario</option><option ${x.indicador==='standard'?'selected':''}>standard</option></select></td><td><button class="smallbtn danger" data-del="${site}" data-i="${i}">X</button></td></tr>`).join('')}</table></div></div>`; $('configView').innerHTML=h;document.querySelectorAll('[data-f]').forEach(el=>el.onchange=()=>{const s=el.dataset.site,i=+el.dataset.i,f=el.dataset.f;masters[s][i][f]=f==='cpt'?Number(el.value):el.value.trim();save(s);subca()});document.querySelectorAll('[data-del]').forEach(b=>b.onclick=()=>{masters[b.dataset.del].splice(+b.dataset.i,1);save(b.dataset.del);masterUI();subca()});document.querySelectorAll('[data-add]').forEach(b=>b.onclick=()=>{masters[b.dataset.add].push({subca:'NUEVA',ola:'',cpt:0,indicador:'prioritario'});save(b.dataset.add);masterUI()});document.querySelectorAll('[data-reset]').forEach(b=>b.onclick=()=>{masters[b.dataset.reset]=structuredClone(b.dataset.reset==='soldati'?state.defaults.masterS:state.defaults.masterE);save(b.dataset.reset);masterUI();subca()})}
function save(site){localStorage.setItem(site==='soldati'?'inhubMasterS':'inhubMasterE',JSON.stringify(masters[site]))}

async function runJ(){const day=$('jorDate').value||state.config.analysisDate||state.sites.soldati.jornalesMeta?.latestDate||state.sites.echeverria.jornalesMeta?.latestDate;if(!day)return;const ger=$('jorGer').value||'__ALL__',d1=Math.max(0,+$('jorD1').value||3),d2=Math.max(d1+1,+$('jorD2').value||10);for(const site of ['soldati','echeverria'])state.sites[site].jornalesResult=await calcJ(site,day,ger,d1,d2);renderAll()}
function jorKpi(site,filter,label,value,small=''){return `<button class="kpi jor-kpi" data-jor-site="${site}" data-jor-filter="${filter}"><span>${label}</span><b>${nf.format(value)}</b>${small?`<small>${small}</small>`:''}<em>Ver detalle</em></button>`}
function jornales(){let h='<div class="grid two">',any=false;for(const site of ['soldati','echeverria']){const q=state.sites[site].jornalesResult;if(!q)continue;any=true;h+=`<div class="card"><h2>${names[site]}</h2><div class="kpi-grid">${jorKpi(site,'all','Jornales',q.total)}${jorKpi(site,'today','Nuevos hoy',q.newToday)}${jorKpi(site,'a',`Nuevo -${q.d1}`,q.a,pf.format(pct(q.a,q.total))+'%')}${jorKpi(site,'b',`Nuevo ${q.d1+1}-${q.d2}`,q.b,pf.format(pct(q.b,q.total))+'%')}${jorKpi(site,'c','Antiguo',q.c,pf.format(pct(q.c,q.total))+'%')}</div></div>`}h+='</div>';$('jornalesView').innerHTML=any?h:'<div class="empty">Cargá Jornales y analizá.</div>';bindJorDetails()}
function showJorDetail(site,filter){const q=state.sites[site].jornalesResult;if(!q)return;let rows=(q.details||[]).filter(x=>x.days>=0);if(filter==='today')rows=rows.filter(x=>x.days===0);if(filter==='a')rows=rows.filter(x=>x.days>=0&&x.days<=q.d1);if(filter==='b')rows=rows.filter(x=>x.days>q.d1&&x.days<=q.d2);if(filter==='c')rows=rows.filter(x=>x.days>q.d2);const title=filter==='all'?'Todos los jornales':filter==='today'?'Nuevos hoy':filter==='a'?`Nuevo -${q.d1}`:filter==='b'?`Nuevo ${q.d1+1}-${q.d2}`:'Antiguos';const body=`<div class="jor-detail-head"><div><b>${names[site]} · ${title}</b><small>Jornada ${q.day} · ${nf.format(rows.length)} registros</small></div><button class="jor-close">×</button></div><div class="jor-table-wrap"><table class="hu-table compact"><tr><th>CUIL</th><th>Nombre</th><th>Ingreso grabado</th><th>Jornada</th><th>Días hábiles</th><th>Categoría</th><th>Gerencia</th></tr>${rows.map(x=>`<tr><td>${esc(x.id)}</td><td>${esc(x.name||'-')}</td><td>${esc(x.recorded||'-')}</td><td>${esc(x.journey)}</td><td>${x.days}</td><td>${esc(x.category)}</td><td>${esc(x.ger||'-')}</td></tr>`).join('')}</table></div>`;let m=document.getElementById('jorDetailModal');if(!m){m=document.createElement('div');m.id='jorDetailModal';m.className='jor-modal';m.innerHTML='<div class="jor-modal-box"></div>';document.body.appendChild(m)}m.querySelector('.jor-modal-box').innerHTML=body;m.classList.add('open');m.querySelector('.jor-close').onclick=()=>m.classList.remove('open');m.onclick=e=>{if(e.target===m)m.classList.remove('open')}}
function bindJorDetails(){document.querySelectorAll('[data-jor-site]').forEach(b=>b.onclick=()=>showJorDetail(b.dataset.jorSite,b.dataset.jorFilter))}
$('jorRun').onclick=runJ;$('analysisDate').onchange=()=>{$('jorDate').value=$('analysisDate').value};

function mailHTML(){
 let h='<div class="mail-sheet"><p>Estimados,</p><p>Les comparto un breve resumen operativo de ambos sites:</p>';
 for(const site of ['soldati','echeverria']){
  const d=state.sites[site],t=d.tms,a=d.arrivals,q=d.jornalesResult,r=d.registros,lab=d.files.labelless?(t?.labelless||d.labellessStandalone):null;
  if(!t&&!a&&!q&&!r&&!lab)continue;
  const fc=Number($(site==='soldati'?'fcS':'fcE')?.value)||0;
  h+=`<h2>➤ ${names[site].toUpperCase()}</h2>`;
  if(t){
   const pure=Math.max(0,t.vol-t.big-t.sb),base=Math.max(0,t.totalConPost-t.big-t.sb),ht=t.hu?.totals,ha=ht?.etiquetado?pct(ht.abierto+ht.cerrado,ht.etiquetado):0;
   h+=`<h3>INHUB</h3><p>• Proyectado 09:00 hs: ${fc?nf.format(fc):'No informado'}</p><p>• Real Inhub c/Post CPT: ${nf.format(t.totalConPost)}${fc?' | '+pf.format(pct(t.totalConPost,fc))+'%':''}</p><p>• Real Inhub s/Post CPT: ${nf.format(t.totalSinPost)}</p>
   <h3>MIX OPERATIVO</h3><p>• Voluminoso c/Bigger + SuperBigger: ${nf.format(t.vol)} | ${pf.format(pct(t.vol,t.totalConPost))}%</p><p>• Voluminoso s/Bigger + SuperBigger: ${nf.format(pure)} | ${pf.format(pct(pure,base))}%</p><p>• Bigger: ${nf.format(t.big)}</p><p>• SuperBigger: ${nf.format(t.sb)}</p><p>• MELI Air: ${nf.format(t.meli.arrivals)} arribados · ${nf.format(t.meli.processed)} HU · ${pf.format(pct(t.meli.processed,t.meli.arrivals))}%</p>`;
   if(lab?.processed!=null)h+=`<p>• Labelless: ${nf.format(lab.arrived)} arribados · ${nf.format(lab.processed)} HU · ${pf.format(pct(lab.processed,lab.arrived))}%</p>`;
   if(ht){const hc=huConfig(site),act=new Set(huActiveUsers(site,t).map(x=>x.user)).size,hrs=hoursToTarget(t.hu?.maxOutTs,hc.targetTime),need=hrs>0?Math.ceil((ht.pendiente/hrs)/Math.max(1,hc.prod)):0;h+=`<h3>CONTROL HU</h3><p>• Etiquetado: ${nf.format(ht.etiquetado)} · HU abierto: ${nf.format(ht.abierto)} · HU cerrado: ${nf.format(ht.cerrado)} · Pendiente: ${nf.format(ht.pendiente)}</p><p>• Avance: ${pf.format(ha)}% · Conectados: ${nf.format(act)} · Necesarios: ${nf.format(need)} · Brecha: ${act-need>=0?'+':''}${nf.format(act-need)} · Objetivo: ${hc.targetTime}</p>`;}
  }
  if(r||t){const target=state.config.speedTargetTime?.[site]||'22:00',last=r?.lastTs||t?.maxInTs||null,hrs=hoursUntil(last,target),b=t?.totalConPost||0,req=fc&&hrs>0?Math.max(0,fc-b)/hrs:0;h+=`<h3>VELOCIDAD</h3><p>• Velocidad real descarga: ${r?nf.format(Math.round(r.currentSpeed||0))+' pza/h':'No disponible'}</p><p>• Velocidad necesaria a ${target}: ${fc&&t?nf.format(Math.ceil(req))+' pza/h':'No disponible'}</p>`;}
  if(a)h+=`<h3>ARRIBOS</h3><p>• Vehículos: ${nf.format(a.veh)} · Paquetes: ${nf.format(a.totalShip)}</p><p>• Semi ${pf.format(pct(a.semi,a.veh))}% · Chasis ${pf.format(pct(a.chasis,a.veh))}% · Camioneta ${pf.format(pct(a.camionetaOther??a.camioneta,a.veh))}% · Camioneta MELI ${pf.format(pct(a.camionetaMeli||0,a.veh))}%</p><p>• Paquetes: Pre16 ${pf.format(cut(a,state.config.curveStart,16,'packages'))}% · Pre18 ${pf.format(cut(a,state.config.curveStart,18,'packages'))}% · Pre20 ${pf.format(cut(a,state.config.curveStart,20,'packages'))}% · Post20 ${pf.format(100-cut(a,state.config.curveStart,20,'packages'))}%</p><p>• Vehículos: Pre16 ${pf.format(cut(a,state.config.curveStart,16,'vehicles'))}% · Pre18 ${pf.format(cut(a,state.config.curveStart,18,'vehicles'))}% · Pre20 ${pf.format(cut(a,state.config.curveStart,20,'vehicles'))}% · Post20 ${pf.format(100-cut(a,state.config.curveStart,20,'vehicles'))}%</p>`;
  if(q)h+=`<h3>DOTACIÓN / JORNALES</h3><p>• Jornales: ${nf.format(q.total)} · Nuevo -${q.d1}: ${nf.format(q.a)} (${pf.format(pct(q.a,q.total))}%) · Nuevo ${q.d1+1}-${q.d2}: ${nf.format(q.b)} (${pf.format(pct(q.b,q.total))}%) · Antiguo: ${nf.format(q.c)} (${pf.format(pct(q.c,q.total))}%)</p>`;
 }
 return h+'<p>Cualquier consulta quedo a disposición.<br>Saludos</p></div>';
}
function mail(){$('mailView').innerHTML=mailHTML()}
$('copyRich').onclick=async()=>{const html=mailHTML(),d=document.createElement('div');d.innerHTML=html;const plain=d.innerText;try{await navigator.clipboard.write([new ClipboardItem({'text/html':new Blob([html],{type:'text/html'}),'text/plain':new Blob([plain],{type:'text/plain'})})])}catch{await navigator.clipboard.writeText(plain)}};
$('copyPlain').onclick=async()=>{const d=document.createElement('div');d.innerHTML=mailHTML();await navigator.clipboard.writeText(d.innerText)};


function reportSiteData(site){
 const d=state.sites[site],t=d.tms,a=d.arrivals,q=d.jornalesResult,r=d.registros,lab=d.files.labelless?(t?.labelless||d.labellessStandalone):null,fc=Number($(site==='soldati'?'fcS':'fcE')?.value)||0;
 if(!t&&!a&&!q&&!r&&!lab)return null;
 const pure=t?Math.max(0,t.vol-t.big-t.sb):0,base=t?Math.max(0,t.totalConPost-t.big-t.sb):0;
 let hu=null;if(t?.hu){const normal=huSeparateAir(t).normal,z=normal.hu.totals||{},hc=huConfig(site),users=huActiveUsers(site,normal),cpts=huCptRows(site,normal),active=hc.connectedMode==='byCpt'?cpts.reduce((s,x)=>s+x.users.size,0):new Set(users.map(x=>x.user)).size,hrs=hoursToTarget(normal.hu.maxOutTs,hc.targetTime),remaining=fc>0?Math.max(0,Math.ceil(fc*Number(hc.targetPct??65)/100)-z.abierto-z.cerrado):null,need=remaining===null||hrs<=0?null:Math.ceil(remaining/hrs/Math.max(1,hc.prod));hu={...z,avance:z.etiquetado?pct(z.abierto+z.cerrado,z.etiquetado):0,active,need,gap:need===null?null:active-need,target:hc.targetTime,cpts:cpts.map(x=>({...x,avance:huPct(x)}))};}
 const target=state.config.speedTargetTime?.[site]||'22:00',last=r?.lastTs||t?.maxInTs||null,hrs=hoursUntil(last,target),req=fc&&t&&hrs>0?Math.max(0,fc-t.totalConPost)/hrs:0;
 return{site,name:names[site],fc,t,a,q,r,lab,pure,base,hu,speed:{target,real:r?.currentSpeed??null,required:req||null,last}};
}
function reportData(){return ['soldati','echeverria'].map(reportSiteData).filter(Boolean)}
function reportAlerts(x){
 const out=[];
 if(x.t&&x.fc){const p=pct(x.t.totalConPost,x.fc);out.push(`Inhub ${pf.format(p)}% del proyectado.`)}
 if(x.hu){out.push(`HU ${pf.format(x.hu.avance)}% · ${nf.format(x.hu.pendiente)} pendientes · brecha de dotación ${x.hu.gap>=0?'+':''}${nf.format(x.hu.gap)}.`);const bad=x.hu.cpts.filter(z=>z.avance<huConfig(x.site).cptObjective).sort((a,b)=>a.avance-b.avance).slice(0,3);if(bad.length)out.push(`CPT comprometidos: ${bad.map(z=>z.cpt+' ('+pf.format(z.avance)+'%)').join(', ')}.`)}
 if(x.t){const dd=dotData(x.site,x.t),tt=dd.cpts.reduce((a,g)=>{a.total+=g.total;a.onTime+=g.onTime;return a},{total:0,onTime:0}),v=tt.total?pct(tt.onTime,tt.total):0;out.push(`DOT ${pf.format(v)}% vs objetivo ${pf.format(dd.objective)}% (${v-dd.objective>=0?'+':''}${pf.format(v-dd.objective)} pp).`)}
 if(x.speed.real!=null&&x.speed.required!=null)out.push(`Velocidad real ${nf.format(Math.round(x.speed.real))} vs necesaria ${nf.format(Math.ceil(x.speed.required))} pza/h.`);
 return out;
}
function reportPreview(){
 const data=reportData();if(!$('reportView'))return;
 if(!data.length){$('reportView').innerHTML='<div class="empty">Procesá uno o más archivos para generar el reporte.</div>';return}
 $('reportView').innerHTML=`<div class="report-sites">${data.map(x=>`<section class="report-site"><h3>${x.name}</h3><div class="report-kpis">
 ${x.t?`<div><span>Inhub</span><b>${nf.format(x.t.totalConPost)}</b><small>${x.fc?pf.format(pct(x.t.totalConPost,x.fc))+'% forecast':''}</small></div><div><span>Voluminoso</span><b>${pf.format(pct(x.t.vol,x.t.totalConPost))}%</b><small>c/B+SB</small></div><div><span>MELI Air HU</span><b>${pf.format(pct(x.t.meli.processed,x.t.meli.arrivals))}%</b></div>`:''}
 ${x.lab?.processed!=null?`<div><span>Labelless HU</span><b>${pf.format(pct(x.lab.processed,x.lab.arrived))}%</b></div>`:''}
 ${x.hu?`<div><span>Avance HU</span><b>${pf.format(x.hu.avance)}%</b><small>${nf.format(x.hu.pendiente)} pendientes</small></div><div><span>Conectados / necesarios</span><b>${x.hu.active} / ${x.hu.need}</b><small>brecha ${x.hu.gap>=0?'+':''}${x.hu.gap}</small></div>`:''}
 ${x.speed.real!=null?`<div><span>Velocidad descarga</span><b>${nf.format(Math.round(x.speed.real))}</b><small>pza/h</small></div>`:''}
 ${x.a?`<div><span>Vehículos</span><b>${nf.format(x.a.veh)}</b><small>${nf.format(x.a.totalShip)} paquetes</small></div>`:''}
 ${x.q?`<div><span>Jornales</span><b>${nf.format(x.q.total)}</b><small>${pf.format(pct(x.q.c,x.q.total))}% antiguos</small></div>`:''}
 </div><div class="report-alerts">${reportAlerts(x).map(v=>'<p>• '+esc(v)+'</p>').join('')}</div></section>`).join('')}</div>`;
}
let pptPromise=null;
function loadPptx(){
 if(window.PptxGenJS)return Promise.resolve();
 if(pptPromise)return pptPromise;
 pptPromise=new Promise((ok,ko)=>{const urls=['https://cdn.jsdelivr.net/npm/pptxgenjs@4.0.1/dist/pptxgen.bundle.js','https://cdnjs.cloudflare.com/ajax/libs/pptxgenjs/3.12.0/pptxgen.bundle.js'];let i=0;const next=()=>{if(i>=urls.length)return ko(new Error('No se pudo cargar el generador PowerPoint. Revisá la conexión.'));const s=document.createElement('script');s.src=urls[i++];s.onload=()=>window.PptxGenJS?ok():next();s.onerror=next;document.head.appendChild(s)};next()});
 return pptPromise;
}
async function exportPpt(){
 const data=reportData();if(!data.length)throw new Error('No hay resultados procesados para exportar.');
 await loadPptx();const p=new PptxGenJS();p.layout='LAYOUT_WIDE';p.author='OCASA';p.company='OCASA';p.subject='Resumen operativo Inhub';p.title='Resumen de jornada Inhub';
 const C={navy:'132238',blue:'1F5E8C',cyan:'27A7C7',orange:'F59E0B',green:'159A68',red:'C94848',ink:'1C2734',muted:'667085',pale:'F4F7FA',white:'FFFFFF',line:'D9E2EC'};
 const addText=(s,txt,x,y,w,h,opt={})=>s.addText(String(txt??''),{x,y,w,h,fontFace:'Aptos',fontSize:opt.size||12,bold:!!opt.bold,color:opt.color||C.ink,margin:0,breakLine:false,valign:opt.valign||'mid',align:opt.align||'center',fit:'shrink'});
 const chrome=(title,sub='')=>{const s=p.addSlide();s.background={color:C.white};s.addShape(p.ShapeType.rect,{x:0,y:0,w:13.333,h:.18,fill:{color:C.cyan},line:{color:C.cyan}});addText(s,title,.55,.38,9.8,.48,{size:25,bold:true,color:C.navy});if(sub)addText(s,sub,.55,.92,11.8,.32,{size:10,color:C.muted});addText(s,'INHUB · Resumen operativo',10.65,.42,2.1,.3,{size:9,bold:true,color:C.blue,align:'right'});return s};
 const card=(s,x,y,w,label,val,sub='')=>{s.addShape(p.ShapeType.roundRect,{x,y,w,h:1.12,rectRadius:.08,fill:{color:C.pale},line:{color:C.line,width:1}});addText(s,label,x+.14,y+.12,w-.28,.22,{size:9,color:C.muted});addText(s,val,x+.14,y+.38,w-.28,.38,{size:20,bold:true,color:C.navy});if(sub)addText(s,sub,x+.14,y+.82,w-.28,.18,{size:8,color:C.muted})};
 const date=state.config.analysisDate||new Date().toLocaleDateString('es-AR');
 {const s=p.addSlide();s.background={color:C.navy};addText(s,'INFORME GERENCIAL',.75,1.55,7.8,.55,{size:30,bold:true,color:C.white});addText(s,'RESUMEN DE JORNADA INHUB',.75,2.15,10.8,.7,{size:34,bold:true,color:C.cyan});addText(s,`${date} · Soldati / Esteban Echeverría`,.78,3.05,8,.35,{size:15,color:'D8E5EF'});addText(s,'Generado desde Inhub Monitor Local',.78,6.55,5,.3,{size:10,color:'AFC4D5'});}
 for(const x of data){
  {const s=chrome(`${x.name} · Resumen ejecutivo`,'Estado general de la jornada con la información disponible.');
   const cards=[];if(x.t)cards.push(['Inhub',nf.format(x.t.totalConPost),x.fc?pf.format(pct(x.t.totalConPost,x.fc))+'% forecast':''],['Voluminoso',pf.format(pct(x.t.vol,x.t.totalConPost))+'%','c/Bigger + SuperBigger']);if(x.hu)cards.push(['Avance HU',pf.format(x.hu.avance)+'%',nf.format(x.hu.pendiente)+' pendientes'],['Conectados / necesarios',x.hu.active+' / '+x.hu.need,'brecha '+(x.hu.gap>=0?'+':'')+x.hu.gap]);if(x.speed.real!=null)cards.push(['Velocidad real',nf.format(Math.round(x.speed.real))+' pza/h',x.speed.required!=null?'necesaria '+nf.format(Math.ceil(x.speed.required)):'']);if(x.q)cards.push(['Jornales',nf.format(x.q.total),pf.format(pct(x.q.c,x.q.total))+'% antiguos']);
   cards.slice(0,6).forEach((z,i)=>card(s,.55+(i%3)*4.18,1.55+Math.floor(i/3)*1.42,3.82,...z));
   addText(s,'Alertas / lectura ejecutiva',.65,4.65,4,.3,{size:14,bold:true,color:C.blue});addText(s,reportAlerts(x).map(v=>'• '+v).join('\n'),.65,5.02,11.9,1.45,{size:12,color:C.ink,valign:'top'});
  }
  if(x.t){const s=chrome(`${x.name} · Mix y especiales`,'Composición del Inhub y cumplimiento de flujos especiales.');const vals=[['Vol. c/B+SB',nf.format(x.t.vol),pf.format(pct(x.t.vol,x.t.totalConPost))+'%'],['Vol. s/B+SB',nf.format(x.pure),pf.format(pct(x.pure,x.base))+'%'],['Bigger',nf.format(x.t.big),''],['SuperBigger',nf.format(x.t.sb),''],['MELI Air',pf.format(pct(x.t.meli.processed,x.t.meli.arrivals))+'%',nf.format(x.t.meli.processed)+' / '+nf.format(x.t.meli.arrivals)],['Labelless',x.lab?.processed!=null?pf.format(pct(x.lab.processed,x.lab.arrived))+'%':'-',x.lab?.processed!=null?nf.format(x.lab.processed)+' / '+nf.format(x.lab.arrived):'sin cruce']];vals.forEach((z,i)=>card(s,.55+(i%3)*4.18,1.55+Math.floor(i/3)*1.48,3.82,...z));}
  if(x.hu){const s=chrome(`${x.name} · Control HU`,`Objetivo ${x.hu.target} · seguimiento de CPT y recursos.`);[['Etiquetado',x.hu.etiquetado],['HU abierto',x.hu.abierto],['HU cerrado',x.hu.cerrado],['Pendiente',x.hu.pendiente]].forEach((z,i)=>card(s,.55+i*3.12,1.45,2.82,z[0],nf.format(z[1])));addText(s,'CPT con menor avance',.6,3.0,4,.3,{size:14,bold:true,color:C.blue});const bad=x.hu.cpts.slice().sort((a,b)=>a.avance-b.avance).slice(0,8);const rows=[[{text:'CPT',options:{bold:true}},{text:'Avance',options:{bold:true}},{text:'Pendiente',options:{bold:true}},{text:'Conectados',options:{bold:true}}],...bad.map(z=>[String(z.cpt),pf.format(z.avance)+'%',nf.format(z.pendiente),String(z.users.size)])];s.addTable(rows,{x:.6,y:3.42,w:7.0,h:2.7,border:{type:'solid',color:C.line,pt:1},fontFace:'Aptos',fontSize:10,color:C.ink,fill:C.white,margin:.06,rowH:.3});card(s,8.15,3.42,2.0,'Conectados',x.hu.active);card(s,10.35,3.42,2.0,'Necesarios',x.hu.need);card(s,8.15,4.82,4.2,'Brecha',`${x.hu.gap>=0?'+':''}${x.hu.gap}`,x.hu.gap>=0?'capacidad suficiente':'requiere refuerzo');}
  if(x.a||x.r){const s=chrome(`${x.name} · Arribos y velocidad`,'Seguimiento de descarga e ingreso al Inhub.');if(x.a){card(s,.55,1.5,2.8,'Vehículos',nf.format(x.a.veh));card(s,3.55,1.5,2.8,'Paquetes arribos',nf.format(x.a.totalShip));card(s,6.55,1.5,2.8,'Pre 20 paquetes',pf.format(cut(x.a,state.config.curveStart,20,'packages'))+'%');card(s,9.55,1.5,2.8,'Post 20 paquetes',pf.format(100-cut(x.a,state.config.curveStart,20,'packages'))+'%');}if(x.r){card(s,.55,3.15,3.6,'Velocidad real',nf.format(Math.round(x.speed.real||0))+' pza/h');card(s,4.35,3.15,3.6,`Necesaria a ${x.speed.target}`,x.speed.required!=null?nf.format(Math.ceil(x.speed.required))+' pza/h':'-');card(s,8.15,3.15,4.2,'Brecha velocidad',x.speed.required!=null?(Math.round(x.speed.real-x.speed.required)>=0?'+':'')+nf.format(Math.round(x.speed.real-x.speed.required))+' pza/h':'-');}}
  if(x.q){const s=chrome(`${x.name} · Dotación / Jornales`,'Composición de antigüedad de la dotación analizada.');[['Jornales',x.q.total,''],[`Nuevo -${x.q.d1}`,x.q.a,pf.format(pct(x.q.a,x.q.total))+'%'],[`Nuevo ${x.q.d1+1}-${x.q.d2}`,x.q.b,pf.format(pct(x.q.b,x.q.total))+'%'],['Antiguo',x.q.c,pf.format(pct(x.q.c,x.q.total))+'%']].forEach((z,i)=>card(s,.7+i*3.05,1.7,2.75,z[0],nf.format(z[1]),z[2]));}
 }
 const d=new Date(),p2=n=>String(n).padStart(2,'0'),name=`Resumen_Inhub_${state.config.analysisDate||d.getFullYear()+'-'+p2(d.getMonth()+1)+'-'+p2(d.getDate())}_${p2(d.getHours())}${p2(d.getMinutes())}.pptx`;
 await p.writeFile({fileName:name});return name;
}
async function doPpt(btn){const old=btn.textContent;btn.disabled=true;btn.textContent='Generando…';try{const name=await exportPpt();$('message').textContent='PowerPoint generado: '+name}catch(e){$('message').textContent='No se pudo generar el PowerPoint: '+e.message}finally{btn.disabled=false;btn.textContent=old}}
$('exportBtn').onclick=()=>{const rows=[];for(const site of ['soldati','echeverria']){const d=state.sites[site],t=d.tms,a=d.arrivals,q=d.jornalesResult;if(!t&&!a&&!q)continue;rows.push({Site:names[site],Fecha:state.config.analysisDate||'',Inhub:t?.totalConPost??'',Inhub_s_Post:t?.totalSinPost??'',Voluminoso:t?.vol??'',Bigger:t?.big??'',SuperBigger:t?.sb??'',MELI_Air:t?.meli?.arrivals??'',Labelless:t?.labelless?.arrived??'',Vehiculos:a?.veh??'',Paquetes:a?.totalShip??'',Jornales:q?.total??'',Nuevo_1:q?.a??'',Nuevo_2:q?.b??'',Antiguo:q?.c??''})}const csv=[Object.keys(rows[0]||{}).join(';'),...rows.map(r=>Object.values(r).join(';'))].join('\n'),blob=new Blob(['\uFEFF'+csv],{type:'text/csv'}),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`Consolidado_Inhub_${state.config.analysisDate||'sin_fecha'}.csv`;a.click();URL.revokeObjectURL(a.href)};

$('pptBtn').onclick=()=>doPpt($('pptBtn'));$('pptBtn2').onclick=()=>doPpt($('pptBtn2'));

$('processBtn').onclick=async()=>{
  const anyFile=['soldati','echeverria'].some(site=>Object.values(state.sites[site].files).some(Boolean));
  if(!anyFile){$('message').textContent='Cargá al menos un archivo.';return;}
  state.config.analysisDate=$('analysisDate').value||null;
  state.config.curveStart=+$('curveStart').value||9;state.config.cptStart.soldati=+$('cptS').value||10;state.config.cptStart.echeverria=+$('cptE').value||10;
  if($('jorDate'))$('jorDate').value=state.config.analysisDate||$('jorDate').value;
  const jobs=[];
  for(const site of ['soldati','echeverria']){
    if(state.sites[site].files.tms)jobs.push([site,'tms']);
    if(state.sites[site].files.arrivals)jobs.push([site,'arr']);
    if(state.sites[site].files.registros)jobs.push([site,'reg']);
    if(state.sites[site].files.labelless)jobs.push([site,'lab']);
  }
  try{
    $('processBtn').disabled=true;$('engineStatus').textContent='Procesando';let i=0;
    for(const [site,type] of jobs){
      const span=100/Math.max(1,jobs.length),base=i*span;
      if(type==='tms')state.sites[site].tms=await runT(site,p=>progress(base+p/100*span,`Procesando TMS ${names[site]}… ${p}%`));
      else if(type==='arr')state.sites[site].arrivals=await runA(site,p=>progress(base+p/100*span,`Procesando Arribos ${names[site]}…`));
      else if(type==='reg')state.sites[site].registros=await runR(site,p=>progress(base+p/100*span,`Procesando registros ${names[site]}…`));
      else if(type==='lab')state.sites[site].labellessStandalone=await runL(site,p=>progress(base+p/100*span,`Procesando Labelless ${names[site]}…`));
      i++;
    }
    if(jready.soldati||jready.echeverria)await runJ();else renderAll();
    progress(100,'Todo lo cargado fue procesado.');$('engineStatus').textContent='Motor listo';setTimeout(()=>$('progress').classList.add('hidden'),800);
  }catch(e){$('engineStatus').textContent='Error';$('message').textContent='Error: '+e.message}
  finally{$('processBtn').disabled=false}
};

await initMasters();renderAll();