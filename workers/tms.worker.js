const TEXT_DECODER = new TextDecoder('utf-8');

function norm(s){
  return String(s??'')
    .replace(/[\u00A0\u2007\u202F]/g,' ')
    .replace(/[\r\n\t]+/g,' ')
    .normalize('NFD').replace(/[\u0300-\u036f]/g,'')
    .toLowerCase().trim().replace(/\s+/g,' ');
}

function num(v){
  if(typeof v==='number') return Number.isFinite(v)?v:0;
  const s=String(v??'').trim().replace(/\./g,'').replace(',','.');
  const n=Number(s);
  return Number.isFinite(n)?n:0;
}

function parseDateParts(v){
  if(v==null || v==='') return null;
  const s=String(v).trim();
  let m=s.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{2}))?/);
  if(m) return {d:+m[1],m:+m[2],y:+m[3],h:m[4]!==undefined?+m[4]:null,min:m[5]?+m[5]:0};
  m=s.match(/(\d{4})-(\d{1,2})-(\d{1,2})(?:[ T](\d{1,2}):(\d{2}))?/);
  if(m) return {y:+m[1],m:+m[2],d:+m[3],h:m[4]!==undefined?+m[4]:null,min:m[5]?+m[5]:0};
  return null;
}

function isSelectedDay(p, selectedDate){
  if(!p || p.y==null || p.m==null || p.d==null) return false;
  if(!selectedDate) return true;
  const [y,m,d]=selectedDate.split('-').map(Number);
  return p.y===y && p.m===m && p.d===d;
}

function classifyByValues(weight,height,length,width){
  const w=num(weight), H=num(height), L=num(length), W=num(width), kg=w/10000;
  if(H>2000 || L>2000 || W>2000 || kg>50) return 'SuperBigger';
  if(H>1500 || L>1500 || W>1500 || kg>30) return 'Bigger';
  if(H>=500 || L>=500 || W>=500 || kg>=20) return 'Voluminoso';
  return 'Paqueteria';
}

function parseDelimitedLine(line, delimiter){
  const out=[]; let field=''; let q=false;
  for(let i=0;i<line.length;i++){
    const c=line[i];
    if(q){
      if(c==='"' && line[i+1]==='"'){ field+='"'; i++; }
      else if(c==='"') q=false;
      else field+=c;
    } else {
      if(c==='"') q=true;
      else if(c===delimiter){ out.push(field); field=''; }
      else field+=c;
    }
  }
  out.push(field);
  return out;
}

function detectDelimiter(headerLine){
  const commas=(headerLine.match(/,/g)||[]).length;
  const semis=(headerLine.match(/;/g)||[]).length;
  return semis>commas?';':',';
}

function fieldIndex(headers, names){
  const map=new Map(headers.map((h,i)=>[norm(h),i]));
  for(const n of names){
    const idx=map.get(norm(n));
    if(idx!==undefined) return idx;
  }
  return -1;
}

function makeHourBuckets(){
  return Array.from({length:24},()=>({tot:0,vol:0,big:0,sb:0,meliArr:0,meliProc:0}));
}

function safeValue(row,idx){ return idx>=0 ? (row[idx]??'') : ''; }

async function processTmsFile(file, config){
  const size=file.size;
  const chunkSize=4*1024*1024;
  let offset=0;
  let remainder='';
  let headers=null;
  let delimiter=',';
  let indexes=null;
  let totalRows=0;

  const by=makeHourBuckets();
  let totalConPost=0,totalSinPost=0,vol=0,big=0,sb=0;
  let meliArrivals=0,meliProcessed=0;
  const meliZones={};
  const cptStart=Number(config.cptStart||10);

  function buildIndexes(h){
    return {
      inDate:fieldIndex(h,['Inbound Date Included']),
      outDate:fieldIndex(h,['Outbound Included Date']),
      outId:fieldIndex(h,['Outbound ID']),
      weight:fieldIndex(h,['Weight']),
      height:fieldIndex(h,['Height']),
      length:fieldIndex(h,['Length']),
      width:fieldIndex(h,['Width']),
      zone:fieldIndex(h,['Labeling Zone','SubCA','Labeling Zone ']),
      shipment:fieldIndex(h,['Shipment ID','SHIPMENT_ID','SHIPMENT ID','SHIPMENT'])
    };
  }

  function handleRow(cols){
    if(!indexes) return;
    totalRows++;
    const inP=parseDateParts(safeValue(cols,indexes.inDate));
    const outP=parseDateParts(safeValue(cols,indexes.outDate));
    const cls=classifyByValues(
      safeValue(cols,indexes.weight),
      safeValue(cols,indexes.height),
      safeValue(cols,indexes.length),
      safeValue(cols,indexes.width)
    );

    if(isSelectedDay(inP,config.selectedDate)){
      totalConPost++;
      if(inP?.h!=null && inP.h>=cptStart) totalSinPost++;
      if(cls!=='Paqueteria') vol++;
      if(cls==='Bigger') big++;
      if(cls==='SuperBigger') sb++;
      if(inP?.h!=null && inP.h>=0 && inP.h<=23){
        const b=by[inP.h];
        b.tot++;
        if(cls!=='Paqueteria') b.vol++;
        if(cls==='Bigger') b.big++;
        if(cls==='SuperBigger') b.sb++;
      }
    }

    const zone=String(safeValue(cols,indexes.zone)).trim();
    const isMeli=/_a$/i.test(zone);
    if(isMeli){
      if(zone) meliZones[zone]=(meliZones[zone]||0)+1;
      if(isSelectedDay(inP,config.selectedDate)){
        meliArrivals++;
        if(inP?.h!=null && inP.h>=0 && inP.h<=23) by[inP.h].meliArr++;
      }
      const outId=String(safeValue(cols,indexes.outId)).trim();
      const outRaw=String(safeValue(cols,indexes.outDate)).trim();
      if(outId && outRaw && outP && isSelectedDay(outP,config.selectedDate)){
        meliProcessed++;
        if(outP?.h!=null && outP.h>=0 && outP.h<=23) by[outP.h].meliProc++;
      }
    }
  }

  while(offset<size){
    const end=Math.min(size,offset+chunkSize);
    const buf=await file.slice(offset,end).arrayBuffer();
    let text=TEXT_DECODER.decode(buf,{stream:end<size});
    offset=end;
    text=remainder+text;

    let lines=text.split(/\n/);
    remainder=lines.pop() ?? '';

    for(let raw of lines){
      const line=raw.replace(/\r$/,'');
      if(!headers){
        delimiter=detectDelimiter(line);
        headers=parseDelimitedLine(line,delimiter).map(x=>x.replace(/^\uFEFF/,'').trim());
        indexes=buildIndexes(headers);
        if(indexes.inDate<0) throw new Error('No se encontró la columna Inbound Date Included en el TMS.');
        continue;
      }
      if(!line.trim()) continue;
      handleRow(parseDelimitedLine(line,delimiter));
    }

    self.postMessage({type:'PROGRESS',progress:Math.min(99,Math.round(offset/size*100))});
  }

  if(remainder.trim()){
    if(!headers){
      delimiter=detectDelimiter(remainder);
      headers=parseDelimitedLine(remainder,delimiter).map(x=>x.replace(/^\uFEFF/,'').trim());
      indexes=buildIndexes(headers);
    } else handleRow(parseDelimitedLine(remainder.replace(/\r$/,''),delimiter));
  }

  return {
    totalRows,
    total:totalConPost,
    totalConPost,
    totalSinPost,
    cptStart,
    vol,big,sb,
    by,
    meli:{
      arrivals:meliArrivals,
      processed:meliProcessed,
      subcas:meliZones,
      by:Object.fromEntries(by.map((x,h)=>[h,{arr:x.meliArr,proc:x.meliProc}]))
    }
  };
}

self.onmessage=async(event)=>{
  const {type,file,config}=event.data||{};
  if(type!=='PROCESS_TMS') return;
  try{
    self.postMessage({type:'PROGRESS',progress:1});
    const result=await processTmsFile(file,config||{});
    self.postMessage({type:'RESULT',result});
  }catch(error){
    self.postMessage({type:'ERROR',message:error?.message||String(error)});
  }
};
