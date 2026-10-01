export function createShareSourceAuthority({enumerateSources,timeoutMs=4500}){
  if(typeof enumerateSources!=='function')throw new Error('Share source authority requires an enumerator.');
  let inFlight=null;
  let inFlightKey='';
  const sourceMaps=new Map();

  const keyFor=options=>{
    const kind=String(options?.kind||'screen')==='window'?'window':'screen';
    return `${kind}:${Boolean(options?.includeDominionStar)?'all':'filtered'}`;
  };
  const timeoutResult=()=>new Promise(resolve=>{
    // This timeout is a UI recovery guarantee. Keep it referenced until it
    // fires so a stalled native ScreenCaptureKit enumeration always releases
    // the picker instead of leaving an unresolved IPC request behind.
    setTimeout(()=>resolve({ok:false,timedOut:true,sources:[]}),timeoutMs);
  });

  async function list(options={}){
    const requestedKey=keyFor(options);
    // Keep exactly one native ScreenCaptureKit enumeration active at a time.
    // Basic may request screens and windows together, but those native calls are
    // serialized so macOS never receives overlapping discovery requests.
    if(inFlight){
      if(inFlightKey===requestedKey)return Promise.race([inFlight,timeoutResult()]);
      const previous=inFlight;
      await Promise.race([previous,timeoutResult()]);
      if(inFlight===previous)return {ok:false,timedOut:true,sources:[]};
    }

    inFlightKey=requestedKey;
    const tracked=Promise.resolve()
      .then(()=>enumerateSources(options))
      .then(sources=>{
        const safe=Array.isArray(sources)?sources:[];
        sourceMaps.set(requestedKey,new Map(safe.map(source=>[String(source.id),source])));
        return {ok:true,timedOut:false,sources:safe};
      })
      .finally(()=>{
        if(inFlight===tracked){inFlight=null;inFlightKey='';}
      });
    inFlight=tracked;
    return Promise.race([tracked,timeoutResult()]);
  }

  const get=id=>{
    const key=String(id||'');
    for(const map of sourceMaps.values()){
      const source=map.get(key);
      if(source)return source;
    }
    return null;
  };
  const busy=()=>Boolean(inFlight);
  const snapshot=()=>Object.freeze({busy:Boolean(inFlight),key:inFlightKey,sourceCount:[...sourceMaps.values()].reduce((total,map)=>total+map.size,0),families:sourceMaps.size});
  return Object.freeze({list,get,busy,snapshot});
}
