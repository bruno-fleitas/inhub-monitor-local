import { $ } from '../core/dom.js';
import { nf, pf, esc } from '../core/formatters.js';
import { state, names } from '../core/state.js';
import { onceWorker } from '../core/workers.js?v=20261111-tms-1';
const URL_WORKER='./workers/docks-filter.worker.js?v=20261117-docks-detail-2';
const filters=Object.fromEntries(['soldati','echeverria'].map(s=>[s,{start:'00:00',category:'all',sort:'slow',period:'current',job:null}]));
const clock=ms=>Number.isFinite(ms)?new Date(ms).toLocaleTimeString('es-AR',{hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false}):'—';
const qty=n=>nf.format(n);
const rate=(n,h)=>h>0?n/h:null;
const fmtRate=n=>n===null?'—':nf.format(Math.round(n));
const pct=(n,d)=>d>0?pf.format(100*n/d)+'%':'—';
const mixSum=items=>items.reduce((a,x)=>{for(const k of ['count','vol','big','sb'])a[k]+=x[k]||0;return a},{count:0,vol:0,big:0,sb:0});
function data(site,t){
 const f=filters[site],file=state.sites[site].files.tms,date=state.config.analysisDate;
 if(!file)return {error:'Cargá el TMS para analizar dársenas.'};
 if(f.job?.t===t&&f.job.file===file&&f.job.date===date&&f.job.start===f.start)return f.job;
 const job={t,file,date,start:f.start,loading:true};f.job=job;
 onceWorker(URL_WORKER,{type:'FILTER_DOCKS',file,config:{date,start:f.start,latest:t.maxInTs}}).then(result=>{Object.assign(job,result);job.loading=false}).catch(e=>{job.error=e.message;job.loading=false}).finally(()=>{if(f.job===job&&state.sites[site].tms===t&&state.sites[site].files.tms===file)dockDashboard()});
 return job;
}
function summary(items,h,measure=true){
 const a=mixSum(items),c=mixSum(items.map(x=>x.current)),first=items.length?Math.min(...items.map(x=>x.first)):null,last=items.length?Math.max(...items.map(x=>x.last)):null;
 const avg=rate(a.count,first===null?0:(last-first)/3600000),now=rate(c.count,h);
 const k=(label,v)=>'<div><span>'+label+'</span><b>'+v+'</b></div>';
 return '<div class="dock-summary">'+k('Velocidad actual · pza/h',fmtRate(now))+k('Velocidad promedio · pza/h',fmtRate(avg))+k('Paquetes acumulados',qty(a.count))+k('Docks con bipeos en hora actual',qty(items.filter(x=>x.current.count>0).length)+' / '+qty(items.length))+k('Primer / último bipeo',clock(first)+' / '+clock(last))+k('Voluminosos acumulados',measure?qty(a.vol)+' · '+pct(a.vol,a.count):'Sin medidas')+'</div>';
}
function mixTable(m,measure){
 return '<table class="dock-mix"><thead><tr><th>Mix</th><th>Cant.</th><th>%</th></tr></thead><tbody>'+[['Voluminoso','vol'],['Bigger','big'],['SuperBigger','sb']].map(([l,k])=>'<tr><td>'+l+'</td><td>'+ (measure?qty(m[k]):'—')+'</td><td>'+(measure?pct(m[k],m.count):'—')+'</td></tr>').join('')+'</tbody></table>';
}
function sorted(items,f,h){
 const key=x=>{const m=f.period==='current'?x.current:x;return f.sort==='vol'?m.count?m.vol/m.count:-1:f.sort==='big'?m.count?m.big/m.count:-1:f.sort==='sb'?m.count?m.sb/m.count:-1:f.sort==='qty'?m.count:f.sort==='dock'?Number(x.dock):x.current.count};
 return [...items].sort((a,b)=>{if(['slow','fast'].includes(f.sort)&&!!a.current.count!==!!b.current.count)return a.current.count?-1:1;const d=(['slow','dock'].includes(f.sort)?1:-1)*(key(a)-key(b));return d||String(a.dock).localeCompare(String(b.dock),'es',{numeric:true})});
}
function tile(x,site,f,h,measure){
 const current=rate(x.current.count,h),avg=rate(x.count,(x.last-x.first)/3600000),m=f.period==='current'?x.current:x,users=Object.entries(x.users||{}).sort((a,b)=>b[1].count-a[1].count);
 const status=x.current.count?'Con bipeos en hora actual':'Sin bipeos en hora actual';
 return '<div class="dock-tile dock-detail" tabindex="0"><div class="dock-num">DOCK '+esc(x.dock)+'</div><div class="dock-state '+(x.current.count?'':'dock-idle')+'">'+status+'</div><div class="dock-current-label">Velocidad actual</div><strong>'+fmtRate(current)+' <small>pza/h</small></strong><div class="dock-speed">'+(current===null?'—':pf.format(current/60))+' pza/min</div><div class="dock-meta"><span>Promedio</span><b>'+fmtRate(avg)+' pza/h</b><span>Acumulado</span><b>'+qty(x.count)+' pzas.</b><span>Hora actual</span><b>'+qty(x.current.count)+' pzas.</b></div>'+mixTable(m,measure)+'<div class="dock-qty dock-user-trigger" tabindex="0">'+users.length+' usuarios · '+clock(x.last)+'<div class="dock-tooltip"><b>Usuarios · desde '+esc(f.start)+'</b>'+ (users.length?users.map(([u,v])=>'<span>'+esc(u)+' · '+qty(v.count)+' pzas. · '+clock(v.last)+'</span>').join(''):'<span>Sin usuario Inbound informado</span>')+'<span>Primer bipeo: '+clock(x.first)+'</span><span>Último bipeo: '+clock(x.last)+'</span></div></div><button type="button" class="smallbtn dock-export" data-dock-export="'+esc(site)+'" data-dock-id="'+esc(x.dock)+'">↓ Exportar datos</button></div>';
}
const opts=(values,current)=>values.map(([v,l])=>'<option value="'+v+'"'+(v===current?' selected':'')+'>'+l+'</option>').join('');
export function dockDashboard(){
 let html='';
 for(const site of ['soldati','echeverria']){
  const t=state.sites[site].tms;if(!t)continue;const f=filters[site],r=data(site,t),key='dockThreshold_'+site,threshold=Number(state.config[key]??localStorage.getItem('inhub_'+key)??40);
  html+='<article class="card dock-dashboard"><h2>'+names[site]+' · Productividad por dársena</h2><div class="dock-toolbar"><label>Desde dock N.º se considera Camioneta<input class="dock-limit" data-dock-site="'+site+'" type="number" min="0" step="1" value="'+threshold+'"></label><label>Inicio de bipeo<input type="time" data-dock-start="'+site+'" value="'+f.start+'"></label><button type="button" class="smallbtn primary" data-dock-apply="'+site+'">Aplicar horario</button><button type="button" class="smallbtn ghost" data-dock-reset="'+site+'">Desde 00:00</button><label>Vehículos<select data-dock-category="'+site+'">'+opts([['all','Todos'],['cam','Camionetas'],['cha','Chasis']],f.category)+'</select></label><label>Ordenar por<select data-dock-sort="'+site+'">'+opts([['slow','Más lentos'],['fast','Más rápidos'],['vol','% Voluminoso'],['big','% Bigger'],['sb','% SuperBigger'],['qty','Cantidad de piezas'],['dock','Número de dock']],f.sort)+'</select></label><label>Período del mix<select data-dock-period="'+site+'">'+opts([['current','Hora actual'],['accum','Acumulado']],f.period)+'</select></label></div>';
  if(r.loading||r.error){html+='<p class="'+(r.error?'alertbox':'muted')+'">'+esc(r.error||'Calculando productividad y mix de dársenas…')+'</p></article>';continue}
  const rows=r.rows||[],h=Number.isFinite(r.latest)&&Number.isFinite(r.currentStart)?Math.max(0,(r.latest-r.currentStart)/3600000):0,cam=rows.filter(x=>Number.isFinite(Number(x.dock))&&Number(x.dock)>=threshold),cha=rows.filter(x=>Number.isFinite(Number(x.dock))&&Number(x.dock)<threshold),other=rows.filter(x=>!Number.isFinite(Number(x.dock)));
  html+='<div class="dock-period-note"><b>Hora actual:</b> '+clock(r.currentStart)+' – '+clock(r.latest)+' · <b>Acumulado:</b> desde '+esc(f.start)+' · <b>Mix mostrado:</b> '+(f.period==='current'?'hora actual':'acumulado')+'</div>'+summary(rows,h,r.hasMeasures);
  if(!r.hasMeasures)html+='<p class="alertbox">Faltan columnas de peso o dimensiones: mix no disponible.</p>';
  if(r.missing)html+='<p class="muted">'+qty(r.missing)+' bipeos sin dársena informada, excluidos de esta vista.</p>';
  const group=(label,items)=>'<h3>'+label+' · '+items.length+' docks</h3>'+summary(items,h,r.hasMeasures)+(items.length?'<div class="dock-tiles">'+sorted(items,f,h).map(x=>tile(x,site,f,h,r.hasMeasures)).join('')+'</div>':'<p class="muted">Sin dársenas en esta categoría.</p>');
  if(f.category!=='cha')html+=group('Camionetas',cam);if(f.category!=='cam')html+=group('Chasis',cha);if(f.category==='all'&&other.length)html+=group('Sin clasificación de vehículo',other);
  html+='<p class="muted">Velocidad actual: piezas de la hora del último bipeo / minutos transcurridos desde HH:00 (o inicio seleccionado si es posterior). Promedio: piezas acumuladas / tiempo entre primer y último bipeo de cada grupo o dock. Voluminoso incluye Bigger y SuperBigger; porcentajes sobre las piezas del período elegido. Sin bipeos en la hora no implica inactividad operativa confirmada. La exportación incluye el acumulado desde el inicio seleccionado.</p></article>';
 }
 $('docksView').innerHTML=html||'<article class="card empty">Procesá un TMS para visualizar las dársenas.</article>';
 document.querySelectorAll('[data-dock-apply],[data-dock-reset]').forEach(b=>b.onclick=()=>{const site=b.dataset.dockApply||b.dataset.dockReset,f=filters[site],start=b.dataset.dockReset?'00:00':document.querySelector('[data-dock-start="'+site+'"]')?.value;if(!/^([01]\d|2[0-3]):[0-5]\d$/.test(start||'')){alert('Ingresá una hora válida.');return}f.start=start;f.job=null;dockDashboard()});
 for(const field of ['category','sort','period'])document.querySelectorAll('[data-dock-'+field+']').forEach(el=>el.onchange=()=>{filters[el.getAttribute('data-dock-'+field)][field]=el.value;dockDashboard()});
 document.querySelectorAll('.dock-limit').forEach(el=>el.onchange=()=>{const n=Number(el.value);if(!Number.isFinite(n)||n<0)return;const key='dockThreshold_'+el.dataset.dockSite;state.config[key]=n;localStorage.setItem('inhub_'+key,String(n));dockDashboard()});
 document.querySelectorAll('[data-dock-export]').forEach(b=>b.onclick=async()=>{const site=b.dataset.dockExport,dock=b.dataset.dockId,f=filters[site],job=f.job,x=job?.rows?.find(v=>v.dock===dock);if(!x)return;const label=b.textContent;b.disabled=true;try{const result=await onceWorker(URL_WORKER,{type:'EXPORT_DOCK',file:job.file,config:{date:job.date,start:job.start,latest:job.latest,dock,expected:x.count}},p=>b.textContent='Exportando '+p+'%');if(f.job!==job||state.sites[site].tms!==job.t||state.sites[site].files.tms!==job.file)throw Error('Cambió el análisis. Volvé a exportar.');const u=URL.createObjectURL(result.blob),a=document.createElement('a');a.href=u;a.download=site+'_Dock_'+dock.replace(/[^a-z0-9_-]/gi,'_')+'_'+(job.date||'sin_fecha')+'_desde_'+job.start.replace(':','')+'.csv';a.click();setTimeout(()=>URL.revokeObjectURL(u),1000)}catch(e){alert(e.message)}finally{b.disabled=false;b.textContent=label}});
}
