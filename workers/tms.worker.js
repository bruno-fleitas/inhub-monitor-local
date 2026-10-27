const TEXT_DECODER=new TextDecoder('utf-8');
const norm=s=>String(s??'').replace(/[\u00A0\u2007\u202F]/g,' ').replace(/[\r\n\t]+/g,' ').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim().replace(/\s+/g,' ');
function num(v){if(typeof v==='number')return Number.isFinite(v)?v:0;const n=Number(String(v??'').trim().replace(/\./g,'').replace(',','.'));return isFinite(n)?n:0}
function parts(v){
 if(v==null||v==='')return null;const s=String(v).trim();
 let m=s.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{2}))?/);
 if(m)return{d:+m[1],m:+m[2],y:+m[3],h:m[4]!==undefined?+m[4]:null,min:m[5]?+m[5]:0};
 m=s.match(/(\d{4})-(\d{1,2})-(\d{1,2})(?:[ T](\d{1,2}):(\d{2}))?/);
 if(m)return{y:+m[1],m:+m[2],d:+m[3],h:m[4]!==undefined?+m[4]:null,min:m[5]?+m[5]:0};
 const months={ene:1,feb:2,mar:3,abr:4,may:5,jun:6,jul:7,ago:8,sep:9,oct:10,nov:11,dic:12};
 m=s.match(/(\d{1,2})\s+([a-záéíóú]{3,})\s+(\d{4})(?:[,\s]+(\d{1,2}):(\d{2}))?/i);
 if(m){const month=months[norm(m[2]).slice(0,3)];if(month)return{d:+m[1],m:month,y:+m[3],h:m[4]!==undefined?+m[4]:null,min:m[5]?+m[5]:0}}
 return null
}
const ts=p=>p&&p.y!=null?new Date(p.y,p.m-1,p.d,p.h||0,p.min||0,0,0).getTime():null;
function sameDay(p,day){if(!p||p.y==null)return false;if(!day)return true;const[y,m,d]=day.split('-').map(Number);return p.y===y&&p.m===m&&p.d===d}
function classify(w,h,l,wi){w=num(w);h=num(h);l=num(l);wi=num(wi);const kg=w/10000;if(h>2000||l>2000||wi>2000||kg>50)return'SuperBigger';if(h>1500||l>1500||wi>1500||kg>30)return'Bigger';if(h>=500||l>=500||wi>=500||kg>=20)return'Voluminoso';return'Paqueteria'}
function line(line,delim){const out=[];let f='',q=false;for(let i=0;i<line.length;i++){const c=line[i];if(q){if(c==='"'&&line[i+1]==='"'){f+='"';i++}else if(c==='"')q=false;else f+=c}else{if(c==='"')q=true;else if(c===delim){out.push(f);f=''}else f+=c}}out.push(f);return out}
const delim=s=>(s.split(';').length>s.split(',').length?';':',');
function idx(h,names){const m=new Map(h.map((x,i)=>[norm(x),i]));for(const n of names){const i=m.get(norm(n));if(i!==undefined)return i}return-1}
const val=(r,i)=>i>=0?(r[i]??''):'';
const statusOf=s=>String(s??'').replace(/dispatched/g,'HU despachado').replace(/in_dispatch/g,'HU en despacho').replace(/outbound_finished/g,'HU finalizado');
const ETIQ=new Set(['authorized_by_carrier','devolution_HU despachado','devolution_HU en despacho','devolution_HU finalizado','devolution_in_hub_reject','HU despachado','HU en despacho','HU finalizado','in_hub','in_hub_finished','in_hub_reject','in_packing_list','label_printed','no_choices_available','not_manifested_to_carrier','not_received_on_carrier']);
const ABIERTO=new Set(['in_packing_list']);
const CERRADO=new Set(['HU despachado','HU finalizado','HU en despacho']);
const USERS=new Set(['devolution_label_printed','HU despachado','HU en despacho','in_packing_list','devolution_HU despachado','not_received_on_carrier','not_manifested_to_carrier','devolution_HU en despacho','devolution_in_hub_reject','devolution_HU finalizado','devolution_label_generated','devolution_in_packing_list']);
const HU_VISIBLE=new Set(['authorized_by_carrier','devolution_label_printed','HU despachado','HU en despacho','HU finalizado','in_hub_finished','in_hub_reject','in_packing_list','label_printed','route_regeneration_failed','cancelled','devolution_HU despachado','not_received_on_carrier','not_manifested_to_carrier','devolution_HU en despacho','devolution_in_hub_reject','devolution_HU finalizado','in_hub','devolution_label_generated','devolution_in_packing_list','blocked']);
async function labIds(file){if(!file)return new Set();const text=await file.text(),ls=text.split(/\r?\n/).filter(Boolean);if(!ls.length)return new Set();const d=delim(ls[0]),h=line(ls.shift(),d).map(x=>x.replace(/^\uFEFF/,'').trim()),i=idx(h,['Shipment ID','SHIPMENT_ID','SHIPMENT ID','SHIPMENT']);const s=new Set();if(i<0)return s;for(const x of ls){const a=line(x,d),id=String(a[i]??'').trim();if(id)s.add(id)}return s}
async function process(file,labFile,cfg){
 const labs=await labIds(labFile),found=new Set(),arrived=new Set(),processed=new Set(),by=Array.from({length:24},()=>({tot:0,vol:0,big:0,sb:0,meliArr:0,meliProc:0,labArr:0,labProc:0}));
 const docks=new Map(),sub=new Map(),huSub=new Map(),userAct=new Map(),userStats=new Map(),zones={},cpt=Number(cfg.cptStart||10);
 let totalRows=0,totalConPost=0,totalSinPost=0,vol=0,big=0,sb=0,meliArrivals=0,meliProcessed=0,maxOutTs=null,maxInTs=null;const dotRows=[];
 const huByHour=Array.from({length:24},()=>0);
 let headers=null,indexes=null,d=',',offset=0,rest='';const size=file.size,chunk=4*1024*1024;
 function setup(h){indexes={inDate:idx(h,['Inbound Date Included']),outDate:idx(h,['Outbound Included Date']),outId:idx(h,['Outbound ID']),weight:idx(h,['Weight']),height:idx(h,['Height']),length:idx(h,['Length']),width:idx(h,['Width']),zone:idx(h,['Labeling Zone','SubCA']),ship:idx(h,['Shipment ID','SHIPMENT_ID','SHIPMENT ID','SHIPMENT']),status:idx(h,['Hub Status']),outUser:idx(h,['Outbound User IDs','Outbound User ID']),dock:idx(h,['Inbound Dock ID']),inUser:idx(h,['Inbound User ID','Inbound User IDs'])};if(indexes.inDate<0)throw new Error('No se encontró Inbound Date Included en el TMS.')}
 function addSub(zone,cl){const k=zone||'SIN SUBCA';let g=sub.get(k);if(!g){g={subca:k,total:0,vol:0,big:0,sb:0};sub.set(k,g)}g.total++;if(cl!=='Paqueteria')g.vol++;if(cl==='Bigger')g.big++;if(cl==='SuperBigger')g.sb++}
 function addHu(zone,status,user,pout){
   const k=zone||'SIN SUBCA';let g=huSub.get(k);
   if(!g){g={subca:k,etiquetado:0,abierto:0,cerrado:0,finalizado:0,enDespacho:0,despachado:0};huSub.set(k,g)}
   if(ETIQ.has(status)){g.etiquetado++;if(ABIERTO.has(status))g.abierto++;if(CERRADO.has(status))g.cerrado++;if(status==='HU finalizado')g.finalizado++;if(status==='HU en despacho')g.enDespacho++;if(status==='HU despachado')g.despachado++}
   const ot=ts(pout);
   if(HU_VISIBLE.has(status)&&pout?.h!=null&&pout.h>=0&&pout.h<=23)huByHour[pout.h]++;
   if(user&&USERS.has(status)){
     const uk=k+'\u0001'+user,prev=userAct.get(uk);
     if(ot!=null&&(!prev||ot>prev.last))userAct.set(uk,{subca:k,user,last:ot});
     const sk=user,st=userStats.get(sk)||{user,count:0,last:null};st.count++;if(ot!=null&&(st.last==null||ot>st.last))st.last=ot;userStats.set(sk,st);
     if(ot!=null&&(maxOutTs==null||ot>maxOutTs))maxOutTs=ot;
   }
 }
 function row(r){
  totalRows++;const pin=parts(val(r,indexes.inDate)),pout=parts(val(r,indexes.outDate)),cl=classify(val(r,indexes.weight),val(r,indexes.height),val(r,indexes.length),val(r,indexes.width)),zone=String(val(r,indexes.zone)).trim(),sid=String(val(r,indexes.ship)).trim(),hasHU=String(val(r,indexes.outId)).trim()&&String(val(r,indexes.outDate)).trim()&&pout;
  if(sameDay(pin,cfg.selectedDate)){const it=ts(pin);if(it!=null&&(maxInTs==null||it>maxInTs))maxInTs=it;totalConPost++;const dock=String(val(r,indexes.dock)).trim();if(dock&&it!=null){let x=docks.get(dock);if(!x){x={dock,count:0,first:it,last:it};docks.set(dock,x)}x.count++;x.first=Math.min(x.first,it);x.last=Math.max(x.last,it);const username=String(val(r,indexes.inUser)).trim();if(username){x.users??={};x.users[username]=(x.users[username]||0)+1}}if(pin.h!=null&&pin.h>=cpt)totalSinPost++;if(cl!=='Paqueteria')vol++;if(cl==='Bigger')big++;if(cl==='SuperBigger')sb++;addSub(zone,cl);if(pin.h!=null&&pin.h>=0&&pin.h<=23){const b=by[pin.h];b.tot++;if(cl!=='Paqueteria')b.vol++;if(cl==='Bigger')b.big++;if(cl==='SuperBigger')b.sb++}}
  if(/_a$/i.test(zone)){if(zone)zones[zone]=(zones[zone]||0)+1;if(sameDay(pin,cfg.selectedDate)){meliArrivals++;if(pin.h!=null&&pin.h>=0&&pin.h<=23)by[pin.h].meliArr++}if(hasHU&&sameDay(pout,cfg.selectedDate)){meliProcessed++;if(pout.h!=null&&pout.h>=0&&pout.h<=23)by[pout.h].meliProc++}}
  const status=statusOf(val(r,indexes.status)),outUser=String(val(r,indexes.outUser)).trim();
  if(sameDay(pin,cfg.selectedDate)&&pin.h!=null&&pin.h>=7)addHu(zone,status,outUser,pout);
  if(sid&&labs.has(sid)){found.add(sid);if(sameDay(pin,cfg.selectedDate)){arrived.add(sid);if(pin.h!=null&&pin.h>=0&&pin.h<=23)by[pin.h].labArr++}if(hasHU&&sameDay(pout,cfg.selectedDate)){processed.add(sid);if(pout.h!=null&&pout.h>=0&&pout.h<=23)by[pout.h].labProc++}}
 }
 while(offset<size){const end=Math.min(size,offset+chunk),buf=await file.slice(offset,end).arrayBuffer();let text=TEXT_DECODER.decode(buf,{stream:end<size});offset=end;text=rest+text;const ls=text.split(/\n/);rest=ls.pop()??'';for(let raw of ls){raw=raw.replace(/\r$/,'');if(!headers){d=delim(raw);headers=line(raw,d).map(x=>x.replace(/^\uFEFF/,'').trim());setup(headers);continue}if(raw.trim())row(line(raw,d))}self.postMessage({type:'PROGRESS',progress:Math.min(99,Math.round(offset/size*100))})}
 if(rest.trim()&&headers)row(line(rest.replace(/\r$/,''),d));
 const huSubca=[...huSub.values()].map(g=>({...g,pendiente:Math.max(0,g.etiquetado-g.abierto-g.cerrado)}));
 const huTotals=huSubca.reduce((a,g)=>({etiquetado:a.etiquetado+g.etiquetado,abierto:a.abierto+g.abierto,cerrado:a.cerrado+g.cerrado,pendiente:a.pendiente+g.pendiente}),{etiquetado:0,abierto:0,cerrado:0,pendiente:0});
 const activity=[...userAct.values()];const active=maxOutTs==null?[]:activity.filter(x=>maxOutTs-x.last<600000);
 const stats=[...userStats.values()].sort((a,b)=>b.count-a.count);
 return{totalRows,total:totalConPost,totalConPost,totalSinPost,cptStart:cpt,vol,big,sb,by,subcaGroups:[...sub.values()],hu:{subca:huSubca,totals:huTotals,byHour:huByHour,activeUsers:active,userActivity:activity,userStats:stats,maxOutTs},dotRows,maxInTs,docks:[...docks.values()].sort((a,b)=>b.count-a.count),meli:{arrivals:meliArrivals,processed:meliProcessed,subcas:zones,by:Object.fromEntries(by.map((x,h)=>[h,{arr:x.meliArr,proc:x.meliProc}]))},labelless:{supplied:labs.size,found:found.size,missing:Math.max(0,labs.size-found.size),arrived:arrived.size,processed:processed.size,by:Object.fromEntries(by.map((x,h)=>[h,{arr:x.labArr,proc:x.labProc}]))}}
}
self.onmessage=async e=>{if(e.data?.type!=='PROCESS_TMS')return;try{self.postMessage({type:'PROGRESS',progress:1});self.postMessage({type:'RESULT',result:await process(e.data.file,e.data.labFile,e.data.config||{})})}catch(err){self.postMessage({type:'ERROR',message:err.message||String(err)})}};