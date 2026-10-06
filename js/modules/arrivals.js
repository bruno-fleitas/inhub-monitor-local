export function buildArrivalCurve(rows,startHour=9){
  const byHour=Array.from({length:24},()=>({packages:0,vehicles:0}));
  for(const row of rows){
    const h=Number(row.hour);
    if(!Number.isInteger(h) || h<startHour || h>23) continue;
    byHour[h].packages += Number(row.shipments||0);
    byHour[h].vehicles += 1;
  }
  const hours=[];
  let cumPackages=0,cumVehicles=0;
  for(let h=startHour;h<24;h++){
    cumPackages += byHour[h].packages;
    cumVehicles += byHour[h].vehicles;
    hours.push({hour:h,...byHour[h],cumPackages,cumVehicles});
  }
  return {startHour,hours,totalPackages:cumPackages,totalVehicles:cumVehicles};
}

export function cutoffShare(curve,cutoff,type='packages'){
  const total=type==='vehicles'?curve.totalVehicles:curve.totalPackages;
  if(!total) return 0;
  const key=type==='vehicles'?'vehicles':'packages';
  let value=0;
  for(const r of curve.hours){
    if(r.hour<cutoff) value+=r[key];
  }
  return value/total*100;
}
