/* Dársenas: análisis y exportación local bajo demanda, sin modificar TMS principal. */
importScripts('./tms.worker.js?v=20261111-tms-1');
const dockMix=()=>({count:0,vol:0,big:0,sb:0});
function dockAdd(m,cl){m.count++;if(cl!=='Paqueteria')m.vol++;if(cl==='Bigger')m.big++;if(cl==='SuperBigger')m.sb++}
const dockCell=v=>{let s=String(v??'');if(/^[\t\r\n ]*[=+@-]/.test(s)&&!/^-?\d+(?:[.,]\d+)?$/.test(s))s="'"+s;return '"'+s.replace(/"/g,'""')+'"'};
async function filterDocks(file,cfg,exportMode=false){
 const match=/^([01]\d|2[0-3]):([0-5]\d)$/.exec(cfg.start);if(!match)throw Error('Horario inválido.');
 const start=Number(match[1])*60+Number(match[2]),docks=new Map(),decoder=new TextDecoder('utf-8');
 const latest=Number.isFinite(cfg.latest)?cfg.latest:null, hourStart=latest===null?null:new Date(latest).setMinutes(0,0,0), currentStart=hourStart===null?null:Math.max(hourStart,new Date(latest).setHours(Number(match[1]),Number(match[2]),0,0));
 let headers=null,d=',',ii=-1,di=-1,ui=-1,wi=-1,hi=-1,li=-1,xi=-1,offset=0,rest='',buffer='',chunks=[],count=0,missing=0;const chunk=4*1024*1024;
 const emit=values=>{buffer+=values.map(dockCell).join(';')+'\r\n';if(buffer.length>=512*1024){chunks.push(buffer);buffer=''}};
 function consume(raw){
  raw=raw.replace(/\r$/,'');if(!raw.trim())return;
  if(!headers){d=delim(raw);headers=line(raw,d).map(x=>x.replace(/^\uFEFF/,'').trim());ii=idx(headers,['Inbound Date Included']);di=idx(headers,['Inbound Dock ID']);ui=idx(headers,['Inbound User ID','Inbound User IDs']);wi=idx(headers,['Weight']);hi=idx(headers,['Height']);li=idx(headers,['Length']);xi=idx(headers,['Width']);if(ii<0||di<0)throw Error('Faltan columnas Inbound Date Included o Inbound Dock ID.');if(exportMode)emit([...headers,'Clasificacion monitor']);return}
  const r=dataLine(raw,d,headers.length),p=parts(val(r,ii));if(!sameDay(p,cfg.date)||p.h==null||p.h*60+(p.min||0)<start)return;
  const dock=String(val(r,di)).trim(),it=ts(p);if(it==null)return;if(!dock){missing++;return}
  const cl=classify(val(r,wi),val(r,hi),val(r,li),val(r,xi));
  if(exportMode){if(dock===cfg.dock){emit([...r,cl]);count++}return}
  let x=docks.get(dock);if(!x){x={dock,...dockMix(),first:it,last:it,users:Object.create(null),current:dockMix()};docks.set(dock,x)}
  dockAdd(x,cl);x.first=Math.min(x.first,it);x.last=Math.max(x.last,it);
  if(currentStart!==null&&it>=currentStart&&it<=latest)dockAdd(x.current,cl);
  const u=String(val(r,ui)).trim();if(u){const a=x.users[u]??={count:0,last:it};a.count++;a.last=Math.max(a.last,it)}
 }
 while(offset<file.size){const end=Math.min(file.size,offset+chunk),buf=await file.slice(offset,end).arrayBuffer();const ls=(rest+decoder.decode(buf,{stream:end<file.size})).split('\n');offset=end;rest=ls.pop()??'';for(const raw of ls)consume(raw);self.postMessage({type:'PROGRESS',progress:Math.min(99,Math.round(offset/file.size*100))})}
 if(rest.trim())consume(rest);if(!headers)throw Error('CSV vacío.');
 if(exportMode){if(count!==cfg.expected)throw Error('La cantidad no coincide con la tarjeta. Volvé a procesar el archivo.');if(buffer)chunks.push(buffer);return {blob:new Blob(['\uFEFF',...chunks],{type:'text/csv;charset=utf-8'}),count}}
 return {rows:[...docks.values()],missing,currentStart,latest,hasMeasures:[wi,hi,li,xi].every(i=>i>=0)};
}
self.onmessage=async e=>{if(!['FILTER_DOCKS','EXPORT_DOCK'].includes(e.data?.type))return;try{self.postMessage({type:'RESULT',result:await filterDocks(e.data.file,e.data.config,e.data.type==='EXPORT_DOCK')})}catch(err){self.postMessage({type:'ERROR',message:err.message||String(err)})}};
