importScripts('https://cdn.sheetjs.com/xlsx-0.20.3/package/dist/xlsx.full.min.js');

const norm=s=>String(s??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim().replace(/\s+/g,' ');
function num(v){
  if(typeof v==='number') return Number.isFinite(v)?v:0;
  const s=String(v??'').trim().replace(/\./g,'').replace(',','.');
  const n=Number(s); return Number.isFinite(n)?n:0;
}
function parts(v){
  if(v instanceof Date&&!isNaN(v)) return {y:v.getFullYear(),m:v.getMonth()+1,d:v.getDate(),h:v.getHours(),min:v.getMinutes(),sec:v.getSeconds()};
  if(typeof v==='number'&&Number.isFinite(v)){const z=XLSX.SSF.parse_date_code(v);if(z)return{y:z.y,m:z.m,d:z.d,h:z.H||0,min:z.M||0,sec:Math.floor(z.S||0)}}
  const s=String(v??'').trim();
  let m=s.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?/);
  if(m)return{d:+m[1],m:+m[2],y:+m[3],h:+(m[4]||0),min:+(m[5]||0),sec:+(m[6]||0)};
  m=s.match(/(\d{4})-(\d{1,2})-(\d{1,2})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?)?/);
  if(m)return{y:+m[1],m:+m[2],d:+m[3],h:+(m[4]||0),min:+(m[5]||0),sec:+(m[6]||0)};
  return null;
}
const stamp=p=>p?new Date(p.y,p.m-1,p.d,p.h||0,p.min||0,p.sec||0,0).getTime():null;
function sameDay(p,day){if(!day)return true;if(!p)return false;const[y,m,d]=day.split('-').map(Number);return p.y===y&&p.m===m&&p.d===d}
function key(row,names){
  const ks=Object.keys(row||{});
  for(const n of names){const x=ks.find(k=>norm(k)===norm(n));if(x)return x}
  return null;
}
async function rowsFromWorkbook(file){
  const ab=await file.arrayBuffer(),wb=XLSX.read(ab,{type:'array',cellDates:true});
  let chosen=null;
  for(const sn of wb.SheetNames){
    const ws=wb.Sheets[sn];
    const probe=XLSX.utils.sheet_to_json(ws,{header:1,defval:'',raw:true}).slice(0,12);
    for(let i=0;i<probe.length;i++){
      const h=probe[i].map(norm);
      if(h.includes(norm('Fecha y hora'))&&h.includes(norm('TIPO DE OPERACION'))&&h.includes(norm('Accion'))){
        chosen={ws,row:i,sn};break;
      }
    }
    if(chosen)break;
  }
  if(!chosen)throw new Error('Registros: no encontré los encabezados Fecha y hora / TIPO DE OPERACION / Accion.');
  return {rows:XLSX.utils.sheet_to_json(chosen.ws,{range:chosen.row,defval:'',raw:true,cellDates:true}),sheet:chosen.sn};
}
async function analyze(file,day){
  const src=await rowsFromWorkbook(file),rows=src.rows;
  if(!rows.length)return{ok:true,records:0,packages:0,byHour:Array(24).fill(0),lastTs:null,currentSpeed:0,sheet:src.sheet};
  const sample=rows.find(r=>Object.values(r).some(v=>v!==''))||rows[0];
  const kChofer=key(sample,['CHOFER']),kTipo=key(sample,['TIPO DE OPERACION']),kAcc=key(sample,['Accion']),kFecha=key(sample,['Fecha y hora']),kPaq=key(sample,['CANT PAQUETES']);
  if(!kTipo||!kAcc||!kFecha)throw new Error('Registros: faltan columnas requeridas.');
  const byHour=Array(24).fill(0);let records=0,packages=0,lastTs=null,currentHourPackages=0;
  for(const r of rows){
    const chofer=kChofer?String(r[kChofer]??'').trim():'';
    const tipo=String(r[kTipo]??'').trim();
    const acc=String(r[kAcc]??'').trim();
    if(kChofer&&!chofer)continue;
    if(norm(tipo)==='carga')continue;
    if(norm(tipo)!=='descarga'||norm(acc)!=='add')continue;
    const p=parts(r[kFecha]);if(!p||!sameDay(p,day)||p.h===1||p.h===2)continue;
    const q=kPaq?num(r[kPaq]):0;
    records++;packages+=q;byHour[p.h]+=q;
    const st=stamp(p);if(st!=null&&(lastTs==null||st>lastTs))lastTs=st;
  }
  let currentSpeed=0,currentHour=null,elapsedMinutes=0;
  if(lastTs!=null){
    const d=new Date(lastTs);currentHour=d.getHours();elapsedMinutes=d.getMinutes()+d.getSeconds()/60;
    currentHourPackages=byHour[currentHour]||0;
    currentSpeed=elapsedMinutes>0?currentHourPackages/(elapsedMinutes/60):currentHourPackages;
  }
  return{ok:true,records,packages,byHour,lastTs,currentHour,currentHourPackages,elapsedMinutes,currentSpeed,sheet:src.sheet};
}
self.onmessage=async e=>{
  if(e.data?.type!=='PROCESS_REGISTROS')return;
  try{self.postMessage({type:'RESULT',result:await analyze(e.data.file,e.data.day)})}
  catch(err){self.postMessage({type:'ERROR',message:err.message||String(err)})}
};