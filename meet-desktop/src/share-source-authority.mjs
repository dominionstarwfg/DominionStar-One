export function createShareSourceAuthority({enumerateSources,timeoutMs=4500}){
  if(typeof enumerateSources!=='function')throw new Error('Share source authority requires an enumerator.');
  let inFlight=null;
  let inFlightKey='';
  let sourceMap=new Map();

  const keyFor=options=>{
    const kind=String(options?.kind||'screen')==='window'?'window':'screen';
    return `${kind}:${Boolean(options?.includeDominionStar)?'all':'filtered'}`;
  };
  const timeoutResult=()=>new Promise(resolve=>{
    const timer=setTimeout(()=>resolve({ok:false,timedOut:true,sources:[]}),timeoutMs);
    timer.unref?.();
  });

  async function list(options={}){
    const requestedKey=keyFor(options);
    // Keep exactly one native ScreenCaptureKit enumeration active at a time.
    // A second tab click never stacks another native call while the first is
    // unresolved. Same-key requests reuse the current promise.
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
        sourceMap=new Map(safe.map(source=>[String(source.id),source]));
        return {ok:true,timedOut:false,sources:safe};
      })
      .finally(()=>{
        if(inFlight===tracked){inFlight=null;inFlightKey='';}
      });
    inFlight=tracked;
    return Promise.race([tracked,timeoutResult()]);
  }

  const get=id=>sourceMap.get(String(id||''))||null;
  const busy=()=>Boolean(inFlight);
  const snapshot=()=>Object.freeze({busy:Boolean(inFlight),key:inFlightKey,sourceCount:sourceMap.size});
  return Object.freeze({list,get,busy,snapshot});
}
