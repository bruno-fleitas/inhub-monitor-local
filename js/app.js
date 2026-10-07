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

function renderAll(){summary();operation();huControl();curves();mix();subca();jornales();mail();reportPreview()}
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
 const rows=[];let arAc=0,inAc=0;for(let h=start;h<24;h++){const ar=d.registros.byHour?.[h]||0,inh=d.tms.by?.[h]?.tot||0;arAc+=ar;inAc+=inh;rows.push({h,ar,inh,arAc,inAc})}
 const max=Math.max(1,...rows.flatMap(x=>[x.ar,x.inh]));
 const pts=(key)=>rows.map((x,i)=>{const xx=rows.length===1?50:i/(rows.length-1)*100,yy=94-(x[key]/max*84);return xx+','+yy}).join(' ');
 return `<div class="flow-curve"><div class="flow-title"><div><h3>Arribado vs Ingresado TMS por hora</h3><small>Arribado = Reporte de Registros · Ingresado = Inbound Date Included (TMS)</small></div><div class="flow-legend"><span class="flow-arr">● Arribado</span><span class="flow-in">● Ingresado TMS</span></div></div>
 <div class="flow-chart"><svg viewBox="0 0 100 100" preserveAspectRatio="none"><line x1="0" y1="94" x2="100" y2="94" class="axis"/><polyline points="${pts('ar')}" class="line-arr"/><polyline points="${pts('inh')}" class="line-in"/></svg><div class="flow-values">${rows.map(x=>`<div><b>${String(x.h).padStart(2,'0')}:00</b><span>${nf.format(x.ar)}</span><span>${nf.format(x.inh)}</span></div>`).join('')}</div></div>
 <div class="scroll"><table><tr><th>Hora</th><th>Arribado Registros</th><th>Ingresado TMS</th><th>Brecha hora</th><th>Arribado acum.</th><th>TMS acum.</th><th>Brecha acum.</th></tr>${rows.map(x=>`<tr><td>${String(x.h).padStart(2,'0')}:00</td><td>${nf.format(x.ar)}</td><td>${nf.format(x.inh)}</td><td class="${x.ar-x.inh>=0?'posnum':'negnum'}">${x.ar-x.inh>=0?'+':''}${nf.format(x.ar-x.inh)}</td><td>${nf.format(x.arAc)}</td><td>${nf.format(x.inAc)}</td><td class="${x.arAc-x.inAc>=0?'posnum':'negnum'}">${x.arAc-x.inAc>=0?'+':''}${nf.format(x.arAc-x.inAc)}</td></tr>`).join('')}</table></div></div>`;
}
function curves(){const start=state.config.curveStart;let h='';for(const site of ['soldati','echeverria']){const d=state.sites[site];if(!d.tms&&!d.arrivals&&!d.registros)continue;h+=`<article class="card"><h2>${names[site]}</h2>${flowCurve(d,start)}<div class="cols">${d.arrivals?`<div><h3>Arribos</h3>${arrTable(d.arrivals,start)}${vehicleShareTable(d.arrivals)}<h4>Paquetes por hora</h4>${bars(d.arrivals.h,'ship',start)}</div>`:''}${d.tms?`<div><h3>TMS / Voluminoso</h3>${tmsTable(d.tms,start)}<h4>Inhub por hora</h4>${bars(d.tms.by,'tot',start)}</div>`:''}</div></article>`} $('curvesView').innerHTML=h||'<article class="card empty">Sin datos.</article>'}
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
  state.config.hu[site] ??= {prod:190,objective:65,cptObjective:99.5,targetTime:'05:00',activeMinutes:10};
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
  for(const a of huActiveUsers(site,t)){
    const cfg=mp.get(String(a.subca).toLowerCase()),cpt=cfg?.cpt??'SIN CONFIG';
    const x=m.get(String(cpt)); if(x)x.users.add(a.user);
  }
  return [...m.values()].sort((a,b)=>String(a.cpt).localeCompare(String(b.cpt),'es',{numeric:true}));
}
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
  const rows=huCptRows(site,t),active=new Set(huActiveUsers(site,t).map(x=>x.user)).size;
  const hours=hoursToTarget(t.hu?.maxOutTs,cfg.targetTime),prod=Math.max(1,Number(cfg.prod)||190);
  const pph=hours>0?tot.pendiente/hours:0,need=hours>0?Math.ceil(pph/prod):0,realProd=active*prod,capacity=realProd*hours,gap=active-need;
  const bad=rows.filter(x=>huPct(x)<cfg.cptObjective);
  const update=t.hu?.maxOutTs?new Date(t.hu.maxOutTs).toLocaleTimeString('es-AR',{hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false}):'-';
  return `<section class="hu-dashboard" data-hu-site="${site}">
    <div class="hu-head">
      <div><span class="hu-brand">OCASA</span><h2>${names[site]} · Control HU</h2><small>Última actualización HU <b>${update}</b> · conectados = actividad dentro de los últimos ${cfg.activeMinutes} min</small></div>
      <div class="hu-head-actions">
        <label>Hora objetivo<input type="time" data-hucfg="targetTime" data-site="${site}" value="${cfg.targetTime}"></label>
        <label>Prod. objetivo pza/h<input type="number" data-hucfg="prod" data-site="${site}" value="${cfg.prod}"></label>
        <label>Obj. cierre CPT %<input type="number" step="0.1" data-hucfg="cptObjective" data-site="${site}" value="${cfg.cptObjective}"></label><label>Ventana conectados (min)<input type="number" min="1" max="120" step="1" data-hucfg="activeMinutes" data-site="${site}" value="${cfg.activeMinutes}"></label>
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
    ${dotMonitor(site,t)}
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
  for(const a of huActiveUsers(site,t)){
    const k=String(a.subca||'SIN SUBCA');
    if(!activeBySub.has(k))activeBySub.set(k,new Map());
    const m=activeBySub.get(k),prev=m.get(a.user);if(!prev||a.last>prev.last)m.set(a.user,{user:a.user,last:a.last});
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
  const payload=encodeURIComponent(JSON.stringify(list.map(x=>({user:x.user,last:x.last}))));
  return `<button type="button" class="user-link" data-user-list="${payload}" data-user-label="${esc(label)}">${nf.format(n)}</button>`;
}
function bindHuUserClicks(){
  document.querySelectorAll('[data-user-list]').forEach(btn=>btn.onclick=e=>{
    e.preventDefault();e.stopPropagation();
    let list=[];try{list=JSON.parse(decodeURIComponent(btn.dataset.userList||''))}catch{}
    const rows=list.map(x=>`<tr><td>${esc(x.user)}</td><td>${x.last?new Date(x.last).toLocaleTimeString('es-AR',{hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false}):'-'}</td></tr>`).join('');
    const modal=document.createElement('div');modal.className='user-modal';
    modal.innerHTML=`<div class="user-modal-card"><div class="user-modal-head"><div><h3>${esc(btn.dataset.userLabel||'Usuarios conectados')}</h3><small>${nf.format(list.length)} usuarios activos según la ventana configurada</small></div><button type="button" class="user-close">×</button></div><div class="user-modal-body"><table class="hu-table compact"><tr><th>Usuario</th><th>Última actividad</th></tr>${rows||'<tr><td colspan="2">Sin usuarios activos.</td></tr>'}</table></div></div>`;
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
function dotTarget(site){state.config.dot??={};state.config.dot[site]??={objective:99.55};return state.config.dot[site]}
function cptDeadline(day,cpt){
 if(!day||cpt==null||cpt==='SIN CONFIG')return null;
 const [y,m,d]=day.split('-').map(Number),h=Number(cpt);if(!Number.isFinite(h))return null;
 const x=new Date(y,m-1,d,h,0,0,0);if(h<12)x.setDate(x.getDate()+1);return x.getTime();
}
function dotData(site,t){
 const master=new Map(masters[site].map(x=>[String(x.subca).toLowerCase(),x])),now=t.hu?.maxOutTs||t.maxInTs||Date.now(),obj=dotTarget(site).objective,groups=new Map();
 for(const r of t.dotRows||[]){
  const cfg=master.get(String(r.subca).toLowerCase());if(!cfg)continue;
  const deadline=cptDeadline(state.config.analysisDate,cfg.cpt);if(deadline==null)continue;
  const k=String(cfg.cpt)+'|'+r.subca;if(!groups.has(k))groups.set(k,{cpt:cfg.cpt,subca:r.subca,total:0,onTime:0,delay:0,deviation:0,pending:0,deadline});
  const g=groups.get(k);g.total++;
  if(r.outTs!=null){if(r.outTs<=deadline)g.onTime++;else g.delay++}
  else if(now>deadline)g.deviation++;else g.pending++;
 }
 const rows=[...groups.values()].map(g=>({...g,dot:g.total?pct(g.onTime,g.total):0,margin:g.total?pct(g.onTime,g.total)-obj:0}));
 const cpts=new Map();for(const r of rows){const k=String(r.cpt);if(!cpts.has(k))cpts.set(k,{cpt:r.cpt,total:0,onTime:0,delay:0,deviation:0,pending:0,subcas:[]});const g=cpts.get(k);for(const z of ['total','onTime','delay','deviation','pending'])g[z]+=r[z];g.subcas.push(r)}
 return{objective:obj,rows,cpts:[...cpts.values()].map(g=>({...g,dot:g.total?pct(g.onTime,g.total):0,margin:g.total?pct(g.onTime,g.total)-obj:0})).sort((a,b)=>Number(a.cpt)-Number(b.cpt))};
}
function dotMonitor(site,t){
 const d=dotData(site,t),tot=d.cpts.reduce((a,g)=>{for(const k of ['total','onTime','delay','deviation','pending'])a[k]+=g[k];return a},{total:0,onTime:0,delay:0,deviation:0,pending:0}),dp=tot.total?pct(tot.onTime,tot.total):0;
 return `<section class="dot-panel"><div class="hu-section-title"><div><h3>Dispatch On Time · DOT</h3><div class="hu-note">ON TIME = Outbound Included dentro del CPT · Delay = despachado después · Desvío = CPT vencido sin despacho.</div></div><label>Objetivo DOT %<input type="number" min="0" max="100" step="0.01" data-dot-objective="${site}" value="${d.objective}"></label></div>
 <div class="hu-status-strip"><div><span>DOT</span><b class="${dp>=d.objective?'hu-good':'hu-bad'}">${pf.format(dp)}%</b></div><div><span>Objetivo</span><b>${pf.format(d.objective)}%</b></div><div><span>Margen</span><b class="${dp-d.objective>=0?'hu-good':'hu-bad'}">${dp-d.objective>=0?'+':''}${pf.format(dp-d.objective)} pp</b></div><div><span>On Time</span><b>${nf.format(tot.onTime)}</b></div><div><span>Delay</span><b>${nf.format(tot.delay)}</b></div><div><span>Desvío</span><b>${nf.format(tot.deviation)}</b></div></div>
 <div class="cpt-track">${d.cpts.map(g=>`<details class="cpt-group"><summary><span class="cpt-name">CPT ${esc(g.cpt)}</span><span>${nf.format(g.total)} pzas</span><span class="${g.dot>=d.objective?'hu-good':'hu-bad'}">${pf.format(g.dot)}% DOT</span><span>${nf.format(g.onTime)} OT</span><span>${nf.format(g.delay)} delay</span><span>${nf.format(g.deviation)} desvío</span><span>${g.margin>=0?'+':''}${pf.format(g.margin)} pp</span></summary>
 <div class="hu-scroll"><table class="hu-table compact"><tr><th>SubCA</th><th>CPT</th><th>Total</th><th>On Time</th><th>Delay</th><th>Desvío</th><th>Pendiente</th><th>DOT</th><th>Margen</th></tr>${g.subcas.sort((a,b)=>a.dot-b.dot).map(r=>`<tr><td>${esc(r.subca)}</td><td>${esc(r.cpt)}</td><td>${nf.format(r.total)}</td><td>${nf.format(r.onTime)}</td><td>${nf.format(r.delay)}</td><td>${nf.format(r.deviation)}</td><td>${nf.format(r.pending)}</td><td><span class="hu-pill ${r.dot>=d.objective?'hu-good':'hu-bad'}">${pf.format(r.dot)}%</span></td><td class="${r.margin>=0?'hu-good':'hu-bad'}">${r.margin>=0?'+':''}${pf.format(r.margin)} pp</td></tr>`).join('')}</table></div></details>`).join('')}</div></section>`;
}
function bindDotControls(){document.querySelectorAll('[data-dot-objective]').forEach(el=>el.onchange=()=>{dotTarget(el.dataset.dotObjective).objective=Math.max(0,Math.min(100,Number(el.value)||99.55));huControl();reportPreview()})}
function huControl(){
  let h='';
  for(const site of ['soldati','echeverria']){const t=state.sites[site].tms;if(t?.hu)h+=huDashboard(site,t)}
  $('huView').innerHTML=h||'<div class="card empty">Procesá un TMS para ver el Control HU.</div>';
  bindHuControls();
  bindHuUserClicks();
  bindDotControls();
}

async function initMasters(){const[s,e]=await Promise.all([fetch('./js/config/masterS.json').then(r=>r.json()),fetch('./js/config/masterE.json').then(r=>r.json())]);state.defaults={masterS:s,masterE:e};masters.soldati=JSON.parse(localStorage.getItem('inhubMasterS')||'null')||s;masters.echeverria=JSON.parse(localStorage.getItem('inhubMasterE')||'null')||e;masterUI()}
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
 let hu=null;if(t?.hu){const z=t.hu.totals||{},hc=huConfig(site),active=new Set(huActiveUsers(site,t).map(x=>x.user)).size,hrs=hoursToTarget(t.hu.maxOutTs,hc.targetTime),need=hrs>0?Math.ceil((z.pendiente/hrs)/Math.max(1,hc.prod)):0;hu={...z,avance:z.etiquetado?pct(z.abierto+z.cerrado,z.etiquetado):0,active,need,gap:active-need,target:hc.targetTime,cpts:huCptRows(site,t).map(x=>({...x,avance:huPct(x)}))};}
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
 const addText=(s,txt,x,y,w,h,opt={})=>s.addText(String(txt??''),{x,y,w,h,fontFace:'Aptos',fontSize:opt.size||12,bold:!!opt.bold,color:opt.color||C.ink,margin:0,breakLine:false,valign:opt.valign||'mid',align:opt.align||'left',fit:'shrink'});
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