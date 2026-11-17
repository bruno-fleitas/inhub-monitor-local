/* Exportación bajo demanda: reutiliza parser y reglas del TMS, sin modificar su procesamiento. */
importScripts('./tms.worker.js?v=20261111-tms-1');
const csvCell=v=>{let s=String(v??'');if(/^[\t\r\n ]*[=+@-]/.test(s)&&!/^-?\d+(?:[.,]\d+)?$/.test(s))s="'"+s;return '"'+s.replace(/"/g,'""')+'"'};
async function exportCpt(file,cfg){
 const zones=new Set(cfg.subcas.map(x=>String(x).trim()));
 const cutoff=cfg.cutoff?Number(cfg.cutoff.slice(0,2))*60+Number(cfg.cutoff.slice(3)):null;
 let headers=null,d=',',inIdx=-1,zoneIdx=-1,statusIdx=-1,offset=0,rest='',all=0,pending=0,output=[],buffer='';
 const decoder=new TextDecoder('utf-8'),chunk=4*1024*1024;
 const emit=values=>{buffer+=values.map(csvCell).join(';')+'\r\n';if(buffer.length>=512*1024){output.push(buffer);buffer=''}};
 function consume(raw){
  raw=raw.replace(/\r$/,'');if(!raw.trim())return;
  if(!headers){d=delim(raw);headers=line(raw,d).map(x=>x.replace(/^\uFEFF/,'').trim());inIdx=idx(headers,['Inbound Date Included']);zoneIdx=idx(headers,['Labeling Zone','SubCA']);statusIdx=idx(headers,['Hub Status']);if([inIdx,zoneIdx,statusIdx].some(i=>i<0))throw Error('Faltan columnas necesarias del TMS.');emit([...headers,'Site Control HU','CPT Control HU','Estado Control HU']);return}
  const r=dataLine(raw,d,headers.length),p=parts(val(r,inIdx)),zone=String(val(r,zoneIdx)).trim()||'SIN SUBCA';
  if(!sameDay(p,cfg.date)||p.h==null||p.h<cfg.start||(cutoff!==null&&p.h*60+(p.min||0)>cutoff)||!zones.has(zone))return;
  const status=statusOf(val(r,statusIdx));if(!ETIQ.has(status))return;
  const open=ABIERTO.has(status),closed=CERRADO.has(status),pend=!open&&!closed;
  all++;if(pend)pending++;
  if(!cfg.pendingOnly||pend)emit([...r,cfg.site,cfg.cpt,pend?'PENDIENTE HU':open?'HU ABIERTO':'HU CERRADO']);
 }
 while(offset<file.size){const end=Math.min(file.size,offset+chunk);const buf=await file.slice(offset,end).arrayBuffer();const ls=(rest+decoder.decode(buf,{stream:end<file.size})).split('\n');offset=end;rest=ls.pop()??'';for(const raw of ls)consume(raw);self.postMessage({type:'PROGRESS',progress:Math.min(99,Math.round(offset/file.size*100))})}
 if(rest.trim())consume(rest);if(!headers)throw Error('CSV vacío.');
 if(all!==cfg.expectedAll||pending!==cfg.expectedPending)throw Error('Los datos del archivo no coinciden con el CPT mostrado. Volvé a procesar el TMS antes de exportar.');
 if(buffer)output.push(buffer);
 return {blob:new Blob(['\uFEFF',...output],{type:'text/csv;charset=utf-8'}),count:cfg.pendingOnly?pending:all};
}
self.onmessage=async e=>{if(e.data?.type!=='EXPORT_CPT')return;try{self.postMessage({type:'RESULT',result:await exportCpt(e.data.file,e.data.config)})}catch(err){self.postMessage({type:'ERROR',message:err.message||String(err)})}};
