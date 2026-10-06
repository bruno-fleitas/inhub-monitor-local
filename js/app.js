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

const bindings=[['tmsS','soldati','tms'],['arrS','soldati','arrivals'],['labS','soldati','labelless'],['jorS','soldati','jornales'],['tmsE','echeverria','tms'],['arrE','echeverria','arrivals'],['labE','echeverria','labelless'],['jorE','echeverria','jornales']];
for(const [id,site,type] of bindings)$(id).onchange=async e=>{const f=e.target.files?.[0]||null;setFile(site,type,f);status(site);if(type==='jornales'&&f)await loadJ(site,f)};
function status(site){const id=site==='soldati'?'statusS':'statusE',a=Object.entries(state.sites[site].files).filter(([,f])=>f).map(([k,f])=>k+': '+f.name);$(id).textContent=a.length?a.join(' · '):'Sin archivos cargados.'}
function progress(p,msg){$('progress').classList.remove('hidden');$('progressBar').style.width=Math.max(0,Math.min(100,p))+'%';$('message').textContent=msg}
function onceWorker(url,payload,onp){return new Promise((res,rej)=>{const w=new Worker(url);w.onmessage=e=>{const m=e.data||{};if(m.type==='PROGRESS')onp?.(m.progress||0);if(m.type==='RESULT'){w.terminate();res(m.result)}if(m.type==='ERROR'){w.terminate();rej(new Error(m.message))}};w.onerror=e=>{w.terminate();rej(new Error(e.message||'Worker error'))};w.postMessage(payload)})}
const runT=(site,onp)=>state.sites[site].files.tms?onceWorker('./workers/tms.worker.js',{type:'PROCESS_TMS',file:state.sites[site].files.tms,labFile:state.sites[site].files.labelless||null,config:{selectedDate:state.config.analysisDate,cptStart:state.config.cptStart[site]}},onp):Promise.resolve(null);
const runA=(site,onp)=>state.sites[site].files.arrivals?onceWorker('./workers/arrivals.worker.js',{type:'PROCESS_ARRIVALS',file:state.sites[site].files.arrivals,day:state.config.analysisDate},onp):Promise.resolve(null);

function jw(site){return jworkers[site]||(jworkers[site]=new Worker('./workers/jornales.worker.js'))}
function loadJ(site,file){jready[site]=false;const w=jw(site);return new Promise((res,rej)=>{const h=e=>{const m=e.data||{};if(m.type==='LOADED'){w.removeEventListener('message',h);jready[site]=true;state.sites[site].jornalesMeta=m.meta;fillGer();$('message').textContent=`Jornales ${names[site]} indexados: ${nf.format(m.meta.records)} registros.`;res(m.meta)}else if(m.type==='ERROR'){w.removeEventListener('message',h);rej(new Error(m.message))}};w.addEventListener('message',h);w.postMessage({type:'LOAD_JORNALES',file})})}
function calcJ(site,day,ger,d1,d2){if(!jready[site])return Promise.resolve(null);const w=jw(site);return new Promise((res,rej)=>{const h=e=>{const m=e.data||{};if(m.type==='ANALYSIS'){w.removeEventListener('message',h);res(m.result)}else if(m.type==='ERROR'){w.removeEventListener('message',h);rej(new Error(m.message))}};w.addEventListener('message',h);w.postMessage({type:'ANALYZE_JORNALES',day,ger,d1,d2})})}
function fillGer(){const s=new Set();for(const site of ['soldati','echeverria'])for(const g of state.sites[site].jornalesMeta?.gerencias||[])s.add(g);$('jorGer').innerHTML='<option value="__ALL__">Todas</option>'+[...s].sort().map(x=>`<option>${esc(x)}</option>`).join('');const op=[...s].find(x=>x.toLowerCase()==='opsemli');if(op)$('jorGer').value=op}

const universe=(a,start)=>{let packages=0,vehicles=0;if(a?.ok)for(let h=start;h<=23;h++){packages+=a.h[h].ship;vehicles+=a.h[h].veh}return{packages,vehicles}};
function cut(a,start,c,type){const u=universe(a,start)[type];let x=0;if(a?.ok)for(let h=start;h<c&&h<=23;h++)x+=a.h[h][type==='packages'?'ship':'veh'];return pct(x,u)}
function tmsTable(t,start){let cv=0,ct=0,r='';for(let h=start;h<=23;h++){const x=t.by[h];cv+=x.vol;ct+=x.tot;r+=`<tr><td>${h}:00</td><td>${nf.format(x.tot)}</td><td>${nf.format(x.vol)}</td><td>${pf.format(pct(x.vol,x.tot))}%</td><td>${pf.format(pct(cv,ct))}%</td><td>${nf.format(x.big)}</td><td>${nf.format(x.sb)}</td></tr>`}return `<div class="scroll"><table><tr><th>Hora</th><th>Total</th><th>Vol.</th><th>% hora</th><th>% acum.</th><th>Bigger</th><th>SB</th></tr>${r}</table></div>`}
function arrTable(a,start){const u=universe(a,start);let cp=0,cv=0,r='';for(let h=start;h<=23;h++){cp+=a.h[h].ship;cv+=a.h[h].veh;r+=`<tr><td>${h}:00</td><td>${nf.format(a.h[h].ship)}</td><td>${nf.format(cp)}</td><td>${pf.format(pct(cp,u.packages))}%</td><td>${nf.format(a.h[h].veh)}</td><td>${nf.format(cv)}</td><td>${pf.format(pct(cv,u.vehicles))}%</td></tr>`}return `<div class="scroll"><table><tr><th>Hora</th><th>Paquetes</th><th>Paq. acum.</th><th>% paq.</th><th>Veh.</th><th>Veh. acum.</th><th>% veh.</th></tr>${r}</table></div>`}
function bars(rows,key,start){const mx=Math.max(1,...rows.slice(start).map(x=>x[key]||0));return '<div class="chart">'+Array.from({length:24-start},(_,i)=>i+start).map(h=>`<div class="barrow"><span class="barlabel">${h}:00</span><div class="bartrack"><div class="barfill" style="width:${pct(rows[h][key]||0,mx)}%"></div></div><span class="barvalue">${nf.format(rows[h][key]||0)}</span></div>`).join('')+'</div>'}

function renderAll(){summary();operation();huControl();curves();mix();subca();jornales();mail()}
function summary(){let h='';for(const site of ['soldati','echeverria']){const d=state.sites[site],t=d.tms;if(!t&&!d.arrivals&&!d.jornalesResult)continue;const fc=Number($(site==='soldati'?'fcS':'fcE').value)||0,pure=t?Math.max(0,t.vol-t.big-t.sb):0,base=t?Math.max(0,t.totalConPost-t.big-t.sb):0;h+=`<div class="site-summary"><h2>${names[site]}</h2><div class="kpi-grid">${t?`<div class="kpi"><span>Proyectado 09:00</span><b>${fc?nf.format(fc):'-'}</b></div><div class="kpi"><span>Inhub c/Post</span><b>${nf.format(t.totalConPost)}</b></div><div class="kpi"><span>Inhub s/Post</span><b>${nf.format(t.totalSinPost)}</b></div><div class="kpi"><span>Voluminoso</span><b>${nf.format(t.vol)}</b><small>${pf.format(pct(t.vol,t.totalConPost))}%</small></div><div class="kpi"><span>Vol. s/B/SB</span><b>${nf.format(pure)}</b><small>${pf.format(pct(pure,base))}%</small></div><div class="kpi"><span>Bigger</span><b>${nf.format(t.big)}</b></div><div class="kpi"><span>SuperBigger</span><b>${nf.format(t.sb)}</b></div><div class="kpi"><span>MELI Air</span><b>${nf.format(t.meli.arrivals)}</b><small>HU ${nf.format(t.meli.processed)}</small></div><div class="kpi"><span>Labelless</span><b>${nf.format(t.labelless.arrived)}</b><small>HU ${nf.format(t.labelless.processed)}</small></div>`:''}${d.arrivals?`<div class="kpi"><span>Vehículos</span><b>${nf.format(d.arrivals.veh)}</b><small>${nf.format(d.arrivals.totalShip)} paquetes</small></div>`:''}${d.jornalesResult?`<div class="kpi"><span>Jornales</span><b>${nf.format(d.jornalesResult.total)}</b></div>`:''}</div></div>`} $('summaryCards').innerHTML=h||'<div class="empty">Procesá archivos.</div>'}
function operation(){const start=state.config.curveStart;let h='';for(const site of ['soldati','echeverria']){const d=state.sites[site];if(!d.tms&&!d.arrivals)continue;h+=`<article class="card"><h2>${names[site]}</h2>`;if(d.tms)h+=`<div class="kpi-grid"><div class="kpi"><span>Inhub</span><b>${nf.format(d.tms.totalConPost)}</b></div><div class="kpi"><span>MELI Air procesado</span><b>${pf.format(pct(d.tms.meli.processed,d.tms.meli.arrivals))}%</b></div><div class="kpi"><span>Labelless no encontrados</span><b>${nf.format(d.tms.labelless.missing)}</b></div></div>`;if(d.arrivals)h+=`<h3>Arribos</h3><div class="kpi-grid"><div class="kpi"><span>Vehículos</span><b>${nf.format(d.arrivals.veh)}</b></div><div class="kpi"><span>Paquetes</span><b>${nf.format(d.arrivals.totalShip)}</b></div><div class="kpi"><span>% Semi</span><b>${pf.format(pct(d.arrivals.semi,d.arrivals.veh))}%</b></div><div class="kpi"><span>% Chasis</span><b>${pf.format(pct(d.arrivals.chasis,d.arrivals.veh))}%</b></div><div class="kpi"><span>% Camioneta</span><b>${pf.format(pct(d.arrivals.camionetaOther??d.arrivals.camioneta,d.arrivals.veh))}%</b></div><div class="kpi"><span>% Camioneta MELI</span><b>${pf.format(pct(d.arrivals.camionetaMeli||0,d.arrivals.veh))}%</b></div></div><div class="cols"><div><h4>Cortes paquetes</h4>${cuts(d.arrivals,start,'packages')}</div><div><h4>Cortes vehículos</h4>${cuts(d.arrivals,start,'vehicles')}</div></div>`;h+='</article>'}$('operationView').innerHTML=h||'<article class="card empty">Sin datos.</article>'}
function cuts(a,start,type){return '<table><tr><th>Corte</th><th>%</th></tr>'+[16,18,20].map(c=>`<tr><td>Pre ${c}</td><td>${pf.format(cut(a,start,c,type))}%</td></tr>`).join('')+`<tr><td>Post 20</td><td>${pf.format(100-cut(a,start,20,type))}%</td></tr></table>`}
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
  state.config.hu[site] ??= {hours:5,prod:190,objective:65,cptObjective:99.5};
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
  const hours=Math.max(.25,Number(cfg.hours)||5),prod=Math.max(1,Number(cfg.prod)||190);
  const pph=tot.pendiente/hours,need=Math.round(pph/prod),realProd=active*prod,capacity=realProd*hours;
  const bad=rows.filter(x=>huPct(x)<cfg.cptObjective);
  const update=t.hu?.maxOutTs?new Date(t.hu.maxOutTs).toLocaleTimeString('es-AR',{hour:'2-digit',minute:'2-digit',second:'2-digit'}):'-';
  return `<section class="hu-dashboard" data-hu-site="${site}">
    <div class="hu-head"><div><span class="hu-brand">OCASA</span><h2>${names[site]} · Control HU</h2><small>Última actividad HU ${update}</small></div><div class="hu-head-actions"><label>Objetivo avance %<input type="number" step="0.1" data-hucfg="objective" data-site="${site}" value="${cfg.objective}"></label><label>Obj. cierre CPT %<input type="number" step="0.1" data-hucfg="cptObjective" data-site="${site}" value="${cfg.cptObjective}"></label></div></div>
    <div class="hu-layout">
      <div class="hu-left">
        <div class="hu-kpi-panel">
          <table class="hu-summary"><tr><td>TOTAL Piezas</td><td>${nf.format(tot.etiquetado)}</td></tr><tr><td>Piezas con HU Abierto</td><td>${nf.format(tot.abierto)}</td></tr><tr><td>Piezas HU Cerrado</td><td>${nf.format(tot.cerrado)}</td></tr><tr><td>Piezas Pendientes de HU</td><td>${nf.format(tot.pendiente)}</td></tr></table>
          <div class="hu-big ${huTone(avance,cfg.objective)}">${pf.format(avance)}%</div>
        </div>
        <div class="hu-titlebar">CONTROL - CPT / XD</div>
        <h3>Armado de HU</h3>
        <div class="hu-scroll"><table class="hu-table"><tr><th>CPT</th><th>Etiquetado</th><th>Piezas HU-Abierto</th><th>Piezas HU-Cerrado</th><th>Piezas Pend. HU</th><th>% Avance</th><th>Users HU Activos</th></tr>
        ${rows.map(x=>{const a=huPct(x);return `<tr><td>${x.cpt}</td><td>${nf.format(x.etiquetado)}</td><td>${nf.format(x.abierto)}</td><td>${nf.format(x.cerrado)}</td><td class="hu-pend">${nf.format(x.pendiente)}</td><td><span class="hu-pill ${huTone(a,cfg.objective)}">${pf.format(a)}%</span></td><td>${x.users.size||'-'}</td></tr>`}).join('')}
        <tr class="total"><td>Total</td><td>${nf.format(tot.etiquetado)}</td><td>${nf.format(tot.abierto)}</td><td>${nf.format(tot.cerrado)}</td><td>${nf.format(tot.pendiente)}</td><td>${pf.format(avance)}%</td><td>${active}</td></tr></table></div>
      </div>
      <div class="hu-right">
        <h3>Datos operativos</h3>
        <div class="hu-ops">
          <table class="hu-table op"><tr><td>total</td><td>${nf.format(tot.etiquetado)}</td></tr><tr><td>objetivo</td><td>${nf.format(Math.round(tot.etiquetado*cfg.objective/100))}</td></tr><tr><td>piezas procesadas</td><td>${nf.format(tot.abierto+tot.cerrado)}</td></tr><tr><td>HU cerrado</td><td>${nf.format(tot.cerrado)}</td></tr><tr><td>pendiente</td><td>${nf.format(tot.pendiente)}</td></tr><tr><td>hs restantes</td><td><input type="number" step=".25" data-hucfg="hours" data-site="${site}" value="${cfg.hours}"></td></tr><tr><td>pza x hs neces</td><td>${nf.format(Math.round(pph))}</td></tr><tr><td>usar HU neces</td><td class="hu-need">${nf.format(need)}</td></tr><tr><td>cant. Real</td><td>${nf.format(active)}</td></tr><tr><td>prod x hs</td><td><input type="number" data-hucfg="prod" data-site="${site}" value="${cfg.prod}"></td></tr><tr><td>producción real/h</td><td>${nf.format(realProd)}</td></tr><tr><td>capacidad restante</td><td>${nf.format(Math.round(capacity))}</td></tr></table>
        </div>
        <h3>Bipeo HU por hora</h3>${huHourlyTable(t)}
      </div>
    </div>
    <div class="hu-bottom-grid">
      <div><h3>Auditoría CPT · objetivo ${pf.format(cfg.cptObjective)}%</h3><div class="hu-scroll"><table class="hu-table compact"><tr><th>CPT</th><th>Avance</th><th>Pendiente</th><th>Estado</th></tr>${rows.map(x=>{const a=huPct(x),ok=a>=cfg.cptObjective;return `<tr><td>${x.cpt}</td><td>${pf.format(a)}%</td><td>${nf.format(x.pendiente)}</td><td><span class="hu-pill ${ok?'hu-good':a>=95?'hu-warn':'hu-bad'}">${ok?'CUMPLE':'PENDIENTE'}</span></td></tr>`}).join('')}</table></div><div class="hu-note">${bad.length?bad.length+' CPT debajo del objetivo final':'Todos los CPT cumplen el objetivo final'}.</div></div>
      <div><h3>Productividad HU · Top usuarios</h3><div class="hu-scroll">${huProductivity(t)}</div></div>
    </div>
  </section>`;
}
function bindHuControls(){
  document.querySelectorAll('[data-hucfg]').forEach(el=>el.onchange=()=>{const site=el.dataset.site,k=el.dataset.hucfg;huConfig(site)[k]=Number(el.value);huControl()});
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

async function runJ(){const day=$('jorDate').value||state.config.analysisDate;if(!day)return;const ger=$('jorGer').value||'__ALL__',d1=Math.max(0,+$('jorD1').value||3),d2=Math.max(d1+1,+$('jorD2').value||10);for(const site of ['soldati','echeverria'])state.sites[site].jornalesResult=await calcJ(site,day,ger,d1,d2);renderAll()}
function jornales(){let h='<div class="grid two">',any=false;for(const site of ['soldati','echeverria']){const q=state.sites[site].jornalesResult;if(!q)continue;any=true;h+=`<div class="card"><h2>${names[site]}</h2><div class="kpi-grid"><div class="kpi"><span>Jornales</span><b>${nf.format(q.total)}</b></div><div class="kpi"><span>Nuevos hoy</span><b>${nf.format(q.newToday)}</b></div><div class="kpi"><span>Nuevo -${q.d1}</span><b>${nf.format(q.a)}</b><small>${pf.format(pct(q.a,q.total))}%</small></div><div class="kpi"><span>Nuevo ${q.d1+1}-${q.d2}</span><b>${nf.format(q.b)}</b><small>${pf.format(pct(q.b,q.total))}%</small></div><div class="kpi"><span>Antiguo</span><b>${nf.format(q.c)}</b><small>${pf.format(pct(q.c,q.total))}%</small></div></div></div>`}h+='</div>';$('jornalesView').innerHTML=any?h:'<div class="empty">Cargá Jornales y analizá.</div>'}
$('jorRun').onclick=runJ;$('analysisDate').onchange=()=>{$('jorDate').value=$('analysisDate').value};

function mailHTML(){let h='<div class="mail-sheet"><p>Estimados,</p><p>Les comparto un breve resumen operativo de ambos sites:</p>';for(const site of ['soldati','echeverria']){const d=state.sites[site],t=d.tms,a=d.arrivals,q=d.jornalesResult;if(!t&&!a&&!q)continue;h+=`<h2>➤ ${names[site].toUpperCase()}</h2>`;if(t){const pure=Math.max(0,t.vol-t.big-t.sb),base=Math.max(0,t.totalConPost-t.big-t.sb);h+=`<h3>INHUB</h3><p>• Proyectado 09:00 hs: ${Number($(site==='soldati'?'fcS':'fcE').value)?nf.format(Number($(site==='soldati'?'fcS':'fcE').value)):'No informado'}</p><p>• Real Inhub c/Post CPT: ${nf.format(t.totalConPost)}</p><p>• Real Inhub s/Post CPT: ${nf.format(t.totalSinPost)}</p><h3>MIX OPERATIVO</h3><p>• Voluminoso c/Bigger + SuperBigger: ${nf.format(t.vol)} | ${pf.format(pct(t.vol,t.totalConPost))}%</p><p>• Voluminoso s/Bigger + SuperBigger: ${nf.format(pure)} | ${pf.format(pct(pure,base))}%</p><p>• Bigger: ${nf.format(t.big)}</p><p>• SuperBigger: ${nf.format(t.sb)}</p><p>• MELI Air: ${nf.format(t.meli.arrivals)} arribados · ${nf.format(t.meli.processed)} HU</p>${t.labelless.supplied?`<p>• Labelless: ${nf.format(t.labelless.arrived)} arribados · ${nf.format(t.labelless.processed)} HU</p>`:''}`}if(a)h+=`<h3>ARRIBOS</h3><p>• Vehículos: ${nf.format(a.veh)}</p><p>• Semi ${pf.format(pct(a.semi,a.veh))}% · Chasis ${pf.format(pct(a.chasis,a.veh))}% · Camioneta ${pf.format(pct(a.camioneta,a.veh))}%</p><h3>CORTES DE ARRIBO - PAQUETES</h3><p>Pre16 ${pf.format(cut(a,state.config.curveStart,16,'packages'))}% · Pre18 ${pf.format(cut(a,state.config.curveStart,18,'packages'))}% · Pre20 ${pf.format(cut(a,state.config.curveStart,20,'packages'))}% · Post20 ${pf.format(100-cut(a,state.config.curveStart,20,'packages'))}%</p><h3>CORTES DE ARRIBO - VEHÍCULOS</h3><p>Pre16 ${pf.format(cut(a,state.config.curveStart,16,'vehicles'))}% · Pre18 ${pf.format(cut(a,state.config.curveStart,18,'vehicles'))}% · Pre20 ${pf.format(cut(a,state.config.curveStart,20,'vehicles'))}% · Post20 ${pf.format(100-cut(a,state.config.curveStart,20,'vehicles'))}%</p>`;if(q)h+=`<h3>DOTACIÓN / JORNALES</h3><p>• Jornales: ${nf.format(q.total)}</p><p>• Nuevo -${q.d1}: ${nf.format(q.a)} | ${pf.format(pct(q.a,q.total))}%</p><p>• Nuevo ${q.d1+1}-${q.d2}: ${nf.format(q.b)} | ${pf.format(pct(q.b,q.total))}%</p><p>• Antiguo: ${nf.format(q.c)} | ${pf.format(pct(q.c,q.total))}%</p>`;if(t)h+=`<h3>Voluminoso hora a hora</h3>${tmsTable(t,state.config.curveStart)}`;if(a)h+=`<h3>Paquetes / vehículos hora a hora</h3>${arrTable(a,state.config.curveStart)}`}return h+'<p>Cualquier consulta quedo a disposición.<br>Saludos</p></div>'}
function mail(){$('mailView').innerHTML=mailHTML()}
$('copyRich').onclick=async()=>{const html=mailHTML(),d=document.createElement('div');d.innerHTML=html;const plain=d.innerText;try{await navigator.clipboard.write([new ClipboardItem({'text/html':new Blob([html],{type:'text/html'}),'text/plain':new Blob([plain],{type:'text/plain'})})])}catch{await navigator.clipboard.writeText(plain)}};
$('copyPlain').onclick=async()=>{const d=document.createElement('div');d.innerHTML=mailHTML();await navigator.clipboard.writeText(d.innerText)};

$('exportBtn').onclick=()=>{const rows=[];for(const site of ['soldati','echeverria']){const d=state.sites[site],t=d.tms,a=d.arrivals,q=d.jornalesResult;if(!t&&!a&&!q)continue;rows.push({Site:names[site],Fecha:state.config.analysisDate||'',Inhub:t?.totalConPost??'',Inhub_s_Post:t?.totalSinPost??'',Voluminoso:t?.vol??'',Bigger:t?.big??'',SuperBigger:t?.sb??'',MELI_Air:t?.meli?.arrivals??'',Labelless:t?.labelless?.arrived??'',Vehiculos:a?.veh??'',Paquetes:a?.totalShip??'',Jornales:q?.total??'',Nuevo_1:q?.a??'',Nuevo_2:q?.b??'',Antiguo:q?.c??''})}const csv=[Object.keys(rows[0]||{}).join(';'),...rows.map(r=>Object.values(r).join(';'))].join('\n'),blob=new Blob(['\uFEFF'+csv],{type:'text/csv'}),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`Consolidado_Inhub_${state.config.analysisDate||'sin_fecha'}.csv`;a.click();URL.revokeObjectURL(a.href)};

$('processBtn').onclick=async()=>{state.config.analysisDate=$('analysisDate').value||null;if(!state.config.analysisDate){$('message').textContent='Elegí la fecha a analizar antes de procesar.';return;}state.config.curveStart=+$('curveStart').value||9;state.config.cptStart.soldati=+$('cptS').value||10;state.config.cptStart.echeverria=+$('cptE').value||10;$('jorDate').value=state.config.analysisDate||$('jorDate').value;const jobs=[];for(const site of ['soldati','echeverria']){if(state.sites[site].files.tms)jobs.push([site,'tms']);if(state.sites[site].files.arrivals)jobs.push([site,'arr'])}try{$('processBtn').disabled=true;$('engineStatus').textContent='Procesando';let i=0;for(const[j,type]of jobs){const span=100/Math.max(1,jobs.length),base=i*span;if(type==='tms')state.sites[j].tms=await runT(j,p=>progress(base+p/100*span,`Procesando TMS ${names[j]}… ${p}%`));else state.sites[j].arrivals=await runA(j,p=>progress(base+p/100*span,`Procesando Arribos ${names[j]}…`));i++}if(jready.soldati||jready.echeverria)await runJ();else renderAll();progress(100,'Todo lo cargado fue procesado.');$('engineStatus').textContent='Motor listo';setTimeout(()=>$('progress').classList.add('hidden'),800)}catch(e){$('engineStatus').textContent='Error';$('message').textContent='Error: '+e.message}finally{$('processBtn').disabled=false}};

await initMasters();renderAll();