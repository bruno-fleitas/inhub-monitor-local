function norm(s){return String(s??'').replace(/^\uFEFF/,'').trim().toLowerCase().replace(/[_\s]+/g,' ')}
function parse(line,d){const out=[];let f='',q=false;for(let i=0;i<line.length;i++){const c=line[i];if(q){if(c==='"'&&line[i+1]==='"'){f+='"';i++}else if(c==='"')q=false;else f+=c}else{if(c==='"')q=true;else if(c===d){out.push(f);f=''}else f+=c}}out.push(f);return out}
self.onmessage=async e=>{
 if(e.data?.type!=='PROCESS_LAB')return;
 try{
  const text=await e.data.file.text(),ls=text.split(/\r?\n/).filter(Boolean);
  if(!ls.length){self.postMessage({type:'RESULT',result:{supplied:0}});return}
  const d=(ls[0].split(';').length>ls[0].split(',').length)?';':',',h=parse(ls.shift(),d);
  const i=h.findIndex(x=>['shipment id','shipment'].includes(norm(x)));
  if(i<0)throw new Error('Labelless: no encontré Shipment ID.');
  const ids=new Set();for(const x of ls){const a=parse(x,d),id=String(a[i]??'').trim();if(id)ids.add(id)}
  self.postMessage({type:'RESULT',result:{supplied:ids.size}})
 }catch(err){self.postMessage({type:'ERROR',message:err.message||String(err)})}
};