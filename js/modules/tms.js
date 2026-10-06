export function num(v){
  if(v==null || v==='') return 0;
  if(typeof v==='number') return Number.isFinite(v)?v:0;
  const s=String(v).trim().replace(/\./g,'').replace(',','.');
  const n=Number(s);
  return Number.isFinite(n)?n:0;
}

export function classify(row){
  const w=num(row.Weight);
  const H=num(row.Height);
  const L=num(row.Length);
  const W=num(row.Width);
  const kg=w/10000;

  if(H>2000 || L>2000 || W>2000 || kg>50) return 'SuperBigger';
  if(H>1500 || L>1500 || W>1500 || kg>30) return 'Bigger';
  if(H>=500 || L>=500 || W>=500 || kg>=20) return 'Voluminoso';
  return 'Paqueteria';
}

export function isVolumetric(classification){
  return classification !== 'Paqueteria';
}

export function pct(a,b){
  return b ? (a/b)*100 : 0;
}

export function voluminosoSinBiggerSB(result){
  const pure=Math.max(0,result.vol-result.big-result.sb);
  const denominator=Math.max(0,result.totalConPost-result.big-result.sb);
  return pct(pure,denominator);
}
