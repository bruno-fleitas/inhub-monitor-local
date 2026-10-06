self.onmessage = async (event)=>{
  const {type,payload}=event.data||{};
  if(type!=='PING') return;
  self.postMessage({type:'PONG',payload});
};
