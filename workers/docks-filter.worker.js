/* Relectura local bajo demanda; no modifica el procesamiento TMS. */
importScripts('./tms.worker.js?v=20261111-tms-1');
async function filterDocks(file,cfg){
 const match=/^([01]\d|2[0-3]):([0-5]\d)$/.exec(cfg.start);if(!match)throw Error('Horario inválido.');
 const start=Number(match[1])*60+Number(match[2]),docks=new Map(),decoder=new TextDecoder('utf-8');
 let headers=null,d=',',ii=-1,di=-1,ui=-1,offset=0,rest='';const chunk=4*1024*1024;
 function consume(raw){
  raw=raw.replace(/\r$/,'');if(!raw.trim())return;
  if(!headers){d=delim(raw);headers=line(raw,d).map(x=>x.replace(/^\uFEFF/,'').trim());ii=idx(headers,['Inbound Date Included']);di=idx(headers,['Inbound Dock ID']);ui=idx(headers,['Inbound User ID','Inbound User IDs']);if(ii<0||di<0)throw Error('Faltan columnas Inbound Date Included o Inbound Dock ID.');return}
  const r=dataLine(raw,d,headers.length),p=parts(val(r,ii));if(!sameDay(p,cfg.date)||p.h==null||p.h*60+(p.min||0)<start)return;
  const dock=String(val(r,di)).trim(),it=ts(p);if(!dock||it==null)return;
  let x=docks.get(dock);if(!x){x={dock,count:0,first:it,last:it,users:Object.create(null)};docks.set(dock,x)}
  x.count++;x.first=Math.min(x.first,it);x.last=Math.max(x.last,it);const u=String(val(r,ui)).trim();if(u)x.users[u]=(x.users[u]||0)+1;
 }
 while(offset<file.size){const end=Math.min(file.size,offset+chunk),buf=await file.slice(offset,end).arrayBuffer();const ls=(rest+decoder.decode(buf,{stream:end<file.size})).split('\n');offset=end;rest=ls.pop()??'';for(const raw of ls)consume(raw);self.postMessage({type:'PROGRESS',progress:Math.min(99,Math.round(offset/file.size*100))})}
 if(rest.trim())consume(rest);if(!headers)throw Error('CSV vacío.');
 return [...docks.values()];
}
self.onmessage=async e=>{if(e.data?.type!=='FILTER_DOCKS')return;try{self.postMessage({type:'RESULT',result:await filterDocks(e.data.file,e.data.config)})}catch(err){self.postMessage({type:'ERROR',message:err.message||String(err)})}};
