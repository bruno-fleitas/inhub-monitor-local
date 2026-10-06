import {state,setFile} from './state.js';
const $=id=>document.getElementById(id),nf=new Intl.NumberFormat('es-AR'),pf=new Intl.NumberFormat('es-AR',{minimumFractionDigits:1,maximumFractionDigits:1});
const pct=(a,b)=>b?a/b*100:0,esc=s=>String(s??'').replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[m]));
const names={soldati:'Soldati',echeverria:'Esteban Echeverría'};let masters={soldati:[],echeverria:[]},jworkers={},jready={soldati:false,echeverria:false};const subcaFilters={soldati:{q:'',subca:'__ALL__',ola:'__ALL__',cpt:'__ALL__',indicador:'__ALL__'},echeverria:{q:'',subca:'__ALL__',ola:'__ALL__',cpt:'__ALL__',indicador:'__ALL__'}};

function injectUI(){
 for(const [site,suf] of [['soldati','S'],['echeverria','E']]){const grid=$('status'+suf).closest('article').querySelector('.source-grid');grid.insertAdjacentHTML('afterbegin',`<label>Proyectado 09:00<input id="fc${suf}" type="number" placeholder="Ej. 119000"></label><label>Inicio s/Post CPT<select id="cpt${suf}"><option>8</option><option>9</option><option selected>10</option><option>11</option><option>12</option></select></label>`)}
 $('processBtn').insertAdjacentHTML('afterend',' <button id="exportBtn" class="ghost">Exportar consolidado CSV</button>');
 $('view-jornales').innerHTML=`<article class="card"><h2>Dotación / Jornales</h2><div class="toolbar"><label>Fecha<input id="jorDate" type="date"></label><label>Gerencia<select id="jorGer"><option value="__ALL__">Todas</option></select></label><label>Primer rango hasta<input id="jorD1" type="number" value="3" min="0"></label><label>Segundo rango hasta<input id="jorD2" type="number" value="10" min="1"></label><button id="jorRun" class="primary">Analizar Jornales</button></div><div id="jornalesView" class="empty">Cargá uno o ambos históricos.</div></article>`;
 $('view-mail').innerHTML=`<article class="card"><div class="toolbar"><button id="copyRich" class="primary">Copiar mail con formato</button><button id="copyPlain" class="secondary">Copiar texto</button></div><div id="mailView" class="mail-preview"><div class="empty">Procesá archivos.</div></div></article>`;
}
injectUI();

document.querySelectorAll('.nav').forEach(b=>b.onclick=()=>{document.querySelectorAll('.nav').forEach(x=>x.classList.remove('active'));document.querySelectorAll('.view').forEach(x=>x.classList.remove('active'));b.classList.add('active');$('view-'+b.dataset.view).classList.add('active')});

const bindings=[['tmsS','soldati','tms'],['arrS','soldati','arrivals'],['labS','soldati','labelless'],['jorS','soldati','jornales'],['regS','soldati','registros'],['tmsE','echeverria','tms'],['arrE','echeverria','arrivals'],['labE','echeverria','labelless'],['jorE','echeverria','jornales'],['regE','echeverria','registros']];
for(const [id,site,type] of bindings)$(id).onchange=async e=>{const f=e.target.files?.[0]||null;setFile(site,type,f);status(site);if(type==='jornales'&&f)await loadJ(site,f)};
function status(site){const id=site==='soldati'?'statusS':'statusE',a=Object.entries(state.sites[site].files).filter(([,f])=>f).map(([k,f])=>k+': '+f.name);$(id).textContent=a.length?a.join(' · '):'Sin archivos cargados.'}
function progress(p,msg){$('progress').classList.remove('hidden');$('progressBar').style.width=Math.max(0,Math.min(100,p))+'%';$('message').textContent=msg}
function onceWorker(url,payload,onp){return new Promise((res,rej)=>{const w=new Worker(url);w.onmessage=e=>{const m=e.data||{};if(m.type==='PROGRESS')onp?.(m.progress||0);if(m.type==='RESULT'){w.terminate();res(m.result)}if(m.type==='ERROR'){w.terminate();rej(new Error(m.message))}};w.onerror=e=>{w.terminate();rej(new Error(e.message||'Worker error'))};w.postMessage(payload)})}
const runT=(site,onp)=>state.sites[site].files.tms?onceWorker('./workers/tms.worker.js',{type:'PROCESS_TMS',file:state.sites[site].files.tms,labFile:state.sites[site].files.labelless||null,config:{selectedDate:state.config.analysisDate,cptStart:state.config.cptStart[site]}},onp):Promise.resolve(null);
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
  const real=r?.currentSpeed||0;
  const diff=arrived-bipeado,pend=fc?fc-bipeado:0;
  const last=lastTs?new Date(lastTs).toLocaleTimeString('es-AR',{hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false}):'-';
  return `<div class="speed-panel">
    <div class="speed-head"><h3>Velocidad Inhub / Descarga</h3><label>Hora objetivo<input type="time" data-speed-target="${site}" value="${target}"></label></div>
    <table class="speed-table">
      <tr><td>Últ. actualización</td><td>${last}</td><td></td></tr>
      <tr><td>Proyectado</td><td>${fc?nf.format(fc):'-'}</td><td>${fc?'100,0%':'-'}</td></tr>
      <tr><td>Arribado</td><td>${nf.format(arrived)}</td><td>${fc?pf.format(pct(arrived,fc))+'%':'-'}</td></tr>
      <tr><td>Bipeado</td><td>${nf.format(bipeado)}</td><td>${fc?pf.format(pct(bipeado,fc))+'%':'-'}</td></tr>
      <tr><td>Arribado - Bipeado</td><td class="${diff<0?'negnum':'posnum'}">${diff>0?'+':''}${nf.format(diff)}</td><td>${fc?pf.format(pct(diff,fc))+'%':'-'}</td></tr>
      <tr><td>Proyectado - Bipeado</td><td>${fc?nf.format(pend):'-'}</td><td>${fc?pf.format(pct(pend,fc))+'%':'-'}</td></tr>
      <tr><td>Velocidad real descarga</td><td><b>${nf.format(Math.round(real))}</b></td><td>pza/h</td></tr>
      <tr><td>Velocidad necesaria a ${target}</td><td class="${real>=required?'speed-ok':'speed-bad'}"><b>${fc?nf.format(Math.ceil(required)):'-'}</b></td><td>pza/h</td></tr>
      <tr><td>Brecha velocidad</td><td class="${real-required>=0?'speed-ok':'speed-bad'}"><b>${fc?(real-required>=0?'+':'')+nf.format(Math.round(real-required)):'-'}</b></td><td>pza/h</td></tr>
    </table>
    <div class="speed-note">Registros: solo CHOFER informado · TIPO DE OPERACION = Descarga · Accion = add · se excluyen horas 01 y 02.</div>
  </div>`;
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

function renderAll(){summary();operation();huControl();curves();mix();subca();jornales();mail()}
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
function curves(){const start=state.config.curveStart;let h='';for(const site of ['soldati','echeverria']){const d=state.sites[site];if(!d.tms&&!d.arrivals)continue;h+=`<article class="card"><h2>${names[site]}</h2><div class="cols">${d.arrivals?`<div><h3>Arribos</h3>${arrTable(d.arrivals,start)}${vehicleShareTable(d.arrivals)}<h4>Paquetes por hora</h4>${bars(d.arrivals.h,'ship',start)}</div>`:''}${d.tms?`<div><h3>TMS / Voluminoso</h3>${tmsTable(d.tms,start)}<h4>Inhub por hora</h4>${bars(d.tms.by,'tot',start)}</div>`:''}</div></article>`} $('curvesView').innerHTML=h||'<article class="card empty">Sin datos.</article>'}
function mix(){const start=state.config.curveStart;let h='';for(const site of ['soldati','echeverria']){const t=state.sites[site].tms;if(!t)continue;const pure=Math.max(0,t.vol-t.big-t.sb),base=Math.max(0,t.totalConPost-t.big-t.sb);h+=`<article class="card"><h2>${names[site]}</h2><div class="kpi-grid"><div class="kpi"><span>Voluminoso c/B+SB</span><b>${nf.format(t.vol)}</b><small>${pf.format(pct(t.vol,t.totalConPost))}%</small></div><div class="kpi"><span>Voluminoso s/B+SB</span><b>${nf.format(pure)}</b><small>${pf.format(pct(pure,base))}%</small></div><div class="kpi"><span>Bigger</span><b>${nf.format(t.big)}</b></div><div class="kpi"><span>SuperBigger</span><b>${nf.format(t.sb)}</b></div></div>${tmsTable(t,start)}</article>`} $('mixView').innerHTML=h||'<article class="card empty">Sin TMS.</article>'}

function cfg(site){const t=state.sites[site].tms;if(!t)return null;const mp=new Map(masters[site].map(x=>[String(x.subca).toLowerCase(),x]));const groups=t.subcaGroups.map(g=>{const x=mp.get(String(g.subca).toLowerCase());return{...g,ola:x?.ola||'',cpt:x?.cpt??'',indicador:x?.indicador||''}});return{total:t.totalConPost,groups,unknown:groups.filter(g=>g.subca!=='SIN SUBCA'&&!mp.has(String(g.subca).toLowerCase()))}}
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
function vehicleShareTable(a){
  if(!a?.ok)return '';
  const cm=a.camionetaMeli||0,co=a.camionetaOther??Math.max(0,(a.camioneta||0)-cm);
  const rows=[
    ['Semi',a.semi||0],['Chasis',a.chasis||0],['Camioneta',co],['Camioneta MELI',cm]
  ];
  return `<div class="vehicle-share"><h4>Participación por tipo de unidad</h4><table><tr><th>Unidad</th><th>Q</th><th>%</th></tr>${rows.map(([u,n])=>`<tr><td>${u}</td><td>${nf.format(n)}</td><td>${pf.format(pct(n,a.veh))}%</td></tr>`).join('')}<tr><td><b>Total vehículos</b></td><td><b>${nf.format(a.veh)}</b></td><td><b>100,0%</b></td></tr></table></div>`}

function huConfig(site){
  state.config.hu ??= {};
  state.config.hu[site] ??= {prod:190,objective:65,cptObjective:99.5,targetTime:'05:00'};
  return state.config.hu[site];
}
function huCptRows(site,t){
  const mp=new Map(masters[site].map(x=>[String(x.subca).toLowerCase(),x]));
  const m=new Map();
  for(const g of t.hu?.subca||[]){
    const cfg=mp.get(String(g.subca).toLowerCase()),cpt=cfg?.cpt??'SIN CONFIG';
    if(!m.has(String(cpt)))m.set(String(cpt),{cpt,etiquetado:0,abierto:0,cerrado:0,pendiente:0,subcas:0,users:new Set()});
    const x=m.get(String(cpt));x.etiquetado+=g.etiquetado;x.abierto+=g.abierto;x.cerrado+=g.cerrado;x.pendiente+=g.pendiente;x.subcas++;
  }
  for(const a of t.hu?.activeUsers||[]){
    const cfg=mp.get(String(a.subca).toLowerCase()),cpt=cfg?.cpt??'SIN CONFIG';
    const x=m.get(String(cpt)); if(x)x.users.add(a.user);
  }
  return [...m.values()].sort((a,b)=>String(a.cpt).localeCompare(String(b.cpt),'es',{numeric:true}));
}
function huPct(x){return x.etiquetado?pct(x.abierto+x.cerrado,x.etiquetado):0}
function huTone(v,obj){return v>=obj?'hu-good':v>=Math.max(0,obj-10)?'hu-warn':'hu-bad'}
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
  return `<div class="hu-bipe-grid"><div><table class="hu-table compact"><tr><th>Hora</th><th>HU / piezas</th></tr>${vals.map(x=>`<tr><td>${x.h}</td><td>${nf.format(x.v)}</td></tr>`).join('')}<tr class="total"><td>Total general</td><td>${nf.format(total)}</td></tr></table></div><div><div class="hu-prom"><span>Promedio produc. total</span><b>${nf.format(Math.round(prom))}</b><small>Mismo criterio del monitor de referencia: promedio incluyendo Total general.</small></div></div></div><div class="hu-bars">${vals.map(x=>`<div class="hu-bar-item"><span>${x.h}</span><div class="hu-bar-track"><i style="height:${Math.max(3,pct(x.v,max))}%"></i></div><b>${nf.format(x.v)}</b></div>`).join('')}</div>`;
}
function huProductivity(t){
  const rows=(t.hu?.userStats||[]).slice(0,12);
  if(!rows.length)return '<div class="hu-empty">Sin usuarios HU detectados.</div>';
  return `<table class="hu-table compact"><tr><th>Usuario HU</th><th>Piezas / eventos</th><th>Última actividad</th></tr>${rows.map(x=>`<tr><td>${esc(x.user)}</td><td>${nf.format(x.count)}</td><td>${x.last?new Date(x.last).toLocaleTimeString('es-AR',{hour:'2-digit',minute:'2-digit'}):'-'}</td></tr>`).join('')}</table>`;
}
function huDashboard(site,t){
  const cfg=huConfig(site),tot=t.hu?.totals||{etiquetado:0,abierto:0,cerrado:0,pendiente:0};
  const avance=tot.etiquetado?pct(tot.abierto+tot.cerrado,tot.etiquetado):0;
  const rows=huCptRows(site,t),active=new Set((t.hu?.activeUsers||[]).map(x=>x.user)).size;
  const hours=hoursToTarget(t.hu?.maxOutTs,cfg.targetTime),prod=Math.max(1,Number(cfg.prod)||190);
  const pph=hours>0?tot.pendiente/hours:0,need=hours>0?Math.ceil(pph/prod):0,realProd=active*prod,capacity=realProd*hours,gap=active-need;
  const bad=rows.filter(x=>huPct(x)<cfg.cptObjective);
  const update=t.hu?.maxOutTs?new Date(t.hu.maxOutTs).toLocaleTimeString('es-AR',{hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false}):'-';
  return `<section class="hu-dashboard" data-hu-site="${site}">
    <div class="hu-head">
      <div><span class="hu-brand">OCASA</span><h2>${names[site]} · Control HU</h2><small>Última actualización HU <b>${update}</b> · conectados = actividad dentro de los últimos 10 min</small></div>
      <div class="hu-head-actions">
        <label>Hora objetivo<input type="time" data-hucfg="targetTime" data-site="${site}" value="${cfg.targetTime}"></label>
        <label>Prod. objetivo pza/h<input type="number" data-hucfg="prod" data-site="${site}" value="${cfg.prod}"></label>
        <label>Obj. cierre CPT %<input type="number" step="0.1" data-hucfg="cptObjective" data-site="${site}" value="${cfg.cptObjective}"></label>
      </div>
    </div>
    <div class="hu-status-strip">
      <div><span>Última actualización</span><b>${update}</b></div>
      <div><span>Hora objetivo</span><b>${cfg.targetTime}</b></div>
      <div><span>Tiempo restante</span><b>${fmtDuration(hours)}</b></div>
      <div><span>Conectados reales</span><b>${nf.format(active)}</b></div>
      <div><span>Necesarios</span><b>${nf.format(need)}</b></div>
      <div class="${gap>=0?'gap-good':'gap-bad'}"><span>Brecha</span><b>${gap>0?'+':''}${nf.format(gap)}</b></div>
    </div>
    <div class="hu-layout">
      <div class="hu-left">
        <div class="hu-kpi-panel">
          <table class="hu-summary"><tr><td>TOTAL Piezas</td><td>${nf.format(tot.etiquetado)}</td></tr><tr><td>Piezas con HU Abierto</td><td>${nf.format(tot.abierto)}</td></tr><tr><td>Piezas HU Cerrado</td><td>${nf.format(tot.cerrado)}</td></tr><tr><td>Piezas Pendientes de HU</td><td>${nf.format(tot.pendiente)}</td></tr></table>
          <div class="hu-big ${huTone(avance,cfg.objective)}">${pf.format(avance)}%</div>
        </div>
        <div class="hu-titlebar">CONTROL - CPT / XD</div>
        <h3>Armado de HU</h3>
        <div class="hu-scroll"><table class="hu-table"><tr><th>CPT</th><th>Etiquetado</th><th>HU-Abierto</th><th>HU-Cerrado</th><th>Pend. HU</th><th>% Avance</th><th>Users activos</th></tr>
        ${rows.map(x=>{const a=huPct(x);return `<tr><td>${x.cpt}</td><td>${nf.format(x.etiquetado)}</td><td>${nf.format(x.abierto)}</td><td>${nf.format(x.cerrado)}</td><td class="hu-pend">${nf.format(x.pendiente)}</td><td><span class="hu-pill ${huTone(a,cfg.objective)}">${pf.format(a)}%</span></td><td>${x.users.size||'-'}</td></tr>`}).join('')}
        <tr class="total"><td>Total</td><td>${nf.format(tot.etiquetado)}</td><td>${nf.format(tot.abierto)}</td><td>${nf.format(tot.cerrado)}</td><td>${nf.format(tot.pendiente)}</td><td>${pf.format(avance)}%</td><td>${active}</td></tr></table></div>
      </div>
      <div class="hu-right">
        <h3>Datos operativos</h3>
        <div class="hu-ops"><table class="hu-table op">
          <tr><td>total</td><td>${nf.format(tot.etiquetado)}</td></tr>
          <tr><td>objetivo avance</td><td>${nf.format(Math.round(tot.etiquetado*cfg.objective/100))}</td></tr>
          <tr><td>piezas procesadas</td><td>${nf.format(tot.abierto+tot.cerrado)}</td></tr>
          <tr><td>HU cerrado</td><td>${nf.format(tot.cerrado)}</td></tr>
          <tr><td>pendiente</td><td>${nf.format(tot.pendiente)}</td></tr>
          <tr><td>hs restantes</td><td>${fmtDuration(hours)}</td></tr>
          <tr><td>pza x hs neces</td><td>${nf.format(Math.ceil(pph))}</td></tr>
          <tr><td>usuarios HU necesarios</td><td class="hu-need">${nf.format(need)}</td></tr>
          <tr><td>conectados reales</td><td>${nf.format(active)}</td></tr>
          <tr><td>brecha</td><td class="${gap>=0?'gap-good-cell':'gap-bad-cell'}">${gap>0?'+':''}${nf.format(gap)}</td></tr>
          <tr><td>producción real/h</td><td>${nf.format(realProd)}</td></tr>
          <tr><td>capacidad hasta ${cfg.targetTime}</td><td>${nf.format(Math.round(capacity))}</td></tr>
        </table></div>
        <h3>Bipeo HU por hora</h3>${huHourlyTable(t)}
      </div>
    </div>
    <div class="hu-tracking-block"><h3>Seguimiento por CPT y SubCA</h3><div class="hu-note">Avance, pendientes y conectados activos por cada SubCA dentro de su CPT.</div>${huTrackingTable(site,t)}</div>
    <div class="hu-bottom-grid">
      <div><h3>Auditoría CPT · objetivo ${pf.format(cfg.cptObjective)}%</h3><div class="hu-scroll"><table class="hu-table compact"><tr><th>CPT</th><th>Avance</th><th>Pendiente</th><th>Estado</th></tr>${rows.map(x=>{const a=huPct(x),ok=a>=cfg.cptObjective;return `<tr><td>${x.cpt}</td><td>${pf.format(a)}%</td><td>${nf.format(x.pendiente)}</td><td><span class="hu-pill ${ok?'hu-good':a>=95?'hu-warn':'hu-bad'}">${ok?'CUMPLE':'PENDIENTE'}</span></td></tr>`}).join('')}</table></div><div class="hu-note">${bad.length?bad.length+' CPT debajo del objetivo final':'Todos los CPT cumplen el objetivo final'}.</div></div>
      <div><h3>Productividad HU · Top usuarios</h3><div class="hu-scroll">${huProductivity(t)}</div></div>
    </div>
  </section>`;
}
function bindHuControls(){
  document.querySelectorAll('[data-hucfg]').forEach(el=>el.onchange=()=>{
    const site=el.dataset.site,k=el.dataset.hucfg;
    huConfig(site)[k]=k==='targetTime'?el.value:Number(el.value);
    huControl();
  });
}

function huDetailRows(site,t){
  const mp=new Map(masters[site].map(x=>[String(x.subca).toLowerCase(),x]));
  const activeBySub=new Map();
  for(const a of t.hu?.activeUsers||[]){
    const k=String(a.subca||'SIN SUBCA');
    if(!activeBySub.has(k))activeBySub.set(k,new Set());
    activeBySub.get(k).add(a.user);
  }
  return (t.hu?.subca||[]).map(g=>{
    const cfg=mp.get(String(g.subca).toLowerCase())||{};
    return {
      ...g,
      finalizado:g.finalizado||0,
      enDespacho:g.enDespacho||0,
      despachado:g.despachado||0,
      ola:cfg.ola||'',
      cpt:cfg.cpt??'SIN CONFIG',
      indicador:cfg.indicador||'',
      users:activeBySub.get(String(g.subca))?.size||0,
      avance:g.etiquetado?pct(g.abierto+g.cerrado,g.etiquetado):0
    };
  }).sort((a,b)=>String(a.cpt).localeCompare(String(b.cpt),'es',{numeric:true})||b.etiquetado-a.etiquetado);
}
function huCptTracking(site,t){
  const rows=huDetailRows(site,t),groups=new Map();
  for(const r of rows){
    const k=String(r.cpt);
    if(!groups.has(k))groups.set(k,{cpt:r.cpt,etiquetado:0,abierto:0,cerrado:0,pendiente:0,finalizado:0,enDespacho:0,despachado:0,users:0,subcas:[]});
    const g=groups.get(k);
    g.etiquetado+=r.etiquetado;g.abierto+=r.abierto;g.cerrado+=r.cerrado;g.pendiente+=r.pendiente;g.finalizado+=r.finalizado;g.enDespacho+=r.enDespacho;g.despachado+=r.despachado;g.users+=r.users;g.subcas.push(r);
  }
  return [...groups.values()].map(g=>({...g,avance:g.etiquetado?pct(g.abierto+g.cerrado,g.etiquetado):0}))
    .sort((a,b)=>String(a.cpt).localeCompare(String(b.cpt),'es',{numeric:true}));
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
        <span>${nf.format(g.users)} conectados</span>
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
          <td>${nf.format(r.users)}</td><td>${nf.format(r.finalizado)}</td><td>${nf.format(r.enDespacho)}</td><td>${nf.format(r.despachado)}</td>
        </tr>`).join('')}
      </table></div>
    </details>`).join('')}</div>`;
}
function huControl(){
  let h='';
  for(const site of ['soldati','echeverria']){const t=state.sites[site].tms;if(t?.hu)h+=huDashboard(site,t)}
  $('huView').innerHTML=h||'<div class="card empty">Procesá un TMS para ver el Control HU.</div>';
  bindHuControls();
}

async function initMasters(){const[s,e]=await Promise.all([fetch('./js/config/masterS.json').then(r=>r.json()),fetch('./js/config/masterE.json').then(r=>r.json())]);state.defaults={masterS:s,masterE:e};masters.soldati=JSON.parse(localStorage.getItem('inhubMasterS')||'null')||s;masters.echeverria=JSON.parse(localStorage.getItem('inhubMasterE')||'null')||e;masterUI()}
function masterUI(){let h='';for(const site of ['soldati','echeverria'])h+=`<div class="card"><h3>${names[site]}</h3><div class="master-actions"><button class="smallbtn primary" data-add="${site}">+ Agregar</button><button class="smallbtn ghost" data-reset="${site}">Restaurar</button></div><div class="scroll"><table><tr><th>SubCA</th><th>Ola</th><th>CPT</th><th>Indicador</th><th></th></tr>${masters[site].map((x,i)=>`<tr><td><input data-site="${site}" data-i="${i}" data-f="subca" value="${esc(x.subca)}"></td><td><input data-site="${site}" data-i="${i}" data-f="ola" value="${esc(x.ola)}"></td><td><input type="number" data-site="${site}" data-i="${i}" data-f="cpt" value="${x.cpt}"></td><td><select data-site="${site}" data-i="${i}" data-f="indicador"><option ${x.indicador==='prioritario'?'selected':''}>prioritario</option><option ${x.indicador==='standard'?'selected':''}>standard</option></select></td><td><button class="smallbtn danger" data-del="${site}" data-i="${i}">X</button></td></tr>`).join('')}</table></div></div>`; $('configView').innerHTML=h;document.querySelectorAll('[data-f]').forEach(el=>el.onchange=()=>{const s=el.dataset.site,i=+el.dataset.i,f=el.dataset.f;masters[s][i][f]=f==='cpt'?Number(el.value):el.value.trim();save(s);subca()});document.querySelectorAll('[data-del]').forEach(b=>b.onclick=()=>{masters[b.dataset.del].splice(+b.dataset.i,1);save(b.dataset.del);masterUI();subca()});document.querySelectorAll('[data-add]').forEach(b=>b.onclick=()=>{masters[b.dataset.add].push({subca:'NUEVA',ola:'',cpt:0,indicador:'prioritario'});save(b.dataset.add);masterUI()});document.querySelectorAll('[data-reset]').forEach(b=>b.onclick=()=>{masters[b.dataset.reset]=structuredClone(b.dataset.reset==='soldati'?state.defaults.masterS:state.defaults.masterE);save(b.dataset.reset);masterUI();subca()})}
function save(site){localStorage.setItem(site==='soldati'?'inhubMasterS':'inhubMasterE',JSON.stringify(masters[site]))}

async function runJ(){const day=$('jorDate').value||state.config.analysisDate||state.sites.soldati.jornalesMeta?.latestDate||state.sites.echeverria.jornalesMeta?.latestDate;if(!day)return;const ger=$('jorGer').value||'__ALL__',d1=Math.max(0,+$('jorD1').value||3),d2=Math.max(d1+1,+$('jorD2').value||10);for(const site of ['soldati','echeverria'])state.sites[site].jornalesResult=await calcJ(site,day,ger,d1,d2);renderAll()}
function jornales(){let h='<div class="grid two">',any=false;for(const site of ['soldati','echeverria']){const q=state.sites[site].jornalesResult;if(!q)continue;any=true;h+=`<div class="card"><h2>${names[site]}</h2><div class="kpi-grid"><div class="kpi"><span>Jornales</span><b>${nf.format(q.total)}</b></div><div class="kpi"><span>Nuevos hoy</span><b>${nf.format(q.newToday)}</b></div><div class="kpi"><span>Nuevo -${q.d1}</span><b>${nf.format(q.a)}</b><small>${pf.format(pct(q.a,q.total))}%</small></div><div class="kpi"><span>Nuevo ${q.d1+1}-${q.d2}</span><b>${nf.format(q.b)}</b><small>${pf.format(pct(q.b,q.total))}%</small></div><div class="kpi"><span>Antiguo</span><b>${nf.format(q.c)}</b><small>${pf.format(pct(q.c,q.total))}%</small></div></div></div>`}h+='</div>';$('jornalesView').innerHTML=any?h:'<div class="empty">Cargá Jornales y analizá.</div>'}
$('jorRun').onclick=runJ;$('analysisDate').onchange=()=>{$('jorDate').value=$('analysisDate').value};

function mailHTML(){let h='<div class="mail-sheet"><p>Estimados,</p><p>Les comparto un breve resumen operativo de ambos sites:</p>';for(const site of ['soldati','echeverria']){const d=state.sites[site],t=d.tms,a=d.arrivals,q=d.jornalesResult;if(!t&&!a&&!q)continue;h+=`<h2>➤ ${names[site].toUpperCase()}</h2>`;if(t){const pure=Math.max(0,t.vol-t.big-t.sb),base=Math.max(0,t.totalConPost-t.big-t.sb);h+=`<h3>INHUB</h3><p>• Proyectado 09:00 hs: ${Number($(site==='soldati'?'fcS':'fcE').value)?nf.format(Number($(site==='soldati'?'fcS':'fcE').value)):'No informado'}</p><p>• Real Inhub c/Post CPT: ${nf.format(t.totalConPost)}</p><p>• Real Inhub s/Post CPT: ${nf.format(t.totalSinPost)}</p><h3>MIX OPERATIVO</h3><p>• Voluminoso c/Bigger + SuperBigger: ${nf.format(t.vol)} | ${pf.format(pct(t.vol,t.totalConPost))}%</p><p>• Voluminoso s/Bigger + SuperBigger: ${nf.format(pure)} | ${pf.format(pct(pure,base))}%</p><p>• Bigger: ${nf.format(t.big)}</p><p>• SuperBigger: ${nf.format(t.sb)}</p><p>• MELI Air: ${nf.format(t.meli.arrivals)} arribados · ${nf.format(t.meli.processed)} HU</p>${t.labelless.supplied?`<p>• Labelless: ${nf.format(t.labelless.arrived)} arribados · ${nf.format(t.labelless.processed)} HU</p>`:''}`}if(a)h+=`<h3>ARRIBOS</h3><p>• Vehículos: ${nf.format(a.veh)}</p><p>• Semi ${pf.format(pct(a.semi,a.veh))}% · Chasis ${pf.format(pct(a.chasis,a.veh))}% · Camioneta ${pf.format(pct(a.camioneta,a.veh))}%</p><h3>CORTES DE ARRIBO - PAQUETES</h3><p>Pre16 ${pf.format(cut(a,state.config.curveStart,16,'packages'))}% · Pre18 ${pf.format(cut(a,state.config.curveStart,18,'packages'))}% · Pre20 ${pf.format(cut(a,state.config.curveStart,20,'packages'))}% · Post20 ${pf.format(100-cut(a,state.config.curveStart,20,'packages'))}%</p><h3>CORTES DE ARRIBO - VEHÍCULOS</h3><p>Pre16 ${pf.format(cut(a,state.config.curveStart,16,'vehicles'))}% · Pre18 ${pf.format(cut(a,state.config.curveStart,18,'vehicles'))}% · Pre20 ${pf.format(cut(a,state.config.curveStart,20,'vehicles'))}% · Post20 ${pf.format(100-cut(a,state.config.curveStart,20,'vehicles'))}%</p>`;if(q)h+=`<h3>DOTACIÓN / JORNALES</h3><p>• Jornales: ${nf.format(q.total)}</p><p>• Nuevo -${q.d1}: ${nf.format(q.a)} | ${pf.format(pct(q.a,q.total))}%</p><p>• Nuevo ${q.d1+1}-${q.d2}: ${nf.format(q.b)} | ${pf.format(pct(q.b,q.total))}%</p><p>• Antiguo: ${nf.format(q.c)} | ${pf.format(pct(q.c,q.total))}%</p>`;if(t)h+=`<h3>Voluminoso hora a hora</h3>${tmsTable(t,state.config.curveStart)}`;if(a)h+=`<h3>Paquetes / vehículos hora a hora</h3>${arrTable(a,state.config.curveStart)}`}return h+'<p>Cualquier consulta quedo a disposición.<br>Saludos</p></div>'}
function mail(){$('mailView').innerHTML=mailHTML()}
$('copyRich').onclick=async()=>{const html=mailHTML(),d=document.createElement('div');d.innerHTML=html;const plain=d.innerText;try{await navigator.clipboard.write([new ClipboardItem({'text/html':new Blob([html],{type:'text/html'}),'text/plain':new Blob([plain],{type:'text/plain'})})])}catch{await navigator.clipboard.writeText(plain)}};
$('copyPlain').onclick=async()=>{const d=document.createElement('div');d.innerHTML=mailHTML();await navigator.clipboard.writeText(d.innerText)};

$('exportBtn').onclick=()=>{const rows=[];for(const site of ['soldati','echeverria']){const d=state.sites[site],t=d.tms,a=d.arrivals,q=d.jornalesResult;if(!t&&!a&&!q)continue;rows.push({Site:names[site],Fecha:state.config.analysisDate||'',Inhub:t?.totalConPost??'',Inhub_s_Post:t?.totalSinPost??'',Voluminoso:t?.vol??'',Bigger:t?.big??'',SuperBigger:t?.sb??'',MELI_Air:t?.meli?.arrivals??'',Labelless:t?.labelless?.arrived??'',Vehiculos:a?.veh??'',Paquetes:a?.totalShip??'',Jornales:q?.total??'',Nuevo_1:q?.a??'',Nuevo_2:q?.b??'',Antiguo:q?.c??''})}const csv=[Object.keys(rows[0]||{}).join(';'),...rows.map(r=>Object.values(r).join(';'))].join('\n'),blob=new Blob(['\uFEFF'+csv],{type:'text/csv'}),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`Consolidado_Inhub_${state.config.analysisDate||'sin_fecha'}.csv`;a.click();URL.revokeObjectURL(a.href)};

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