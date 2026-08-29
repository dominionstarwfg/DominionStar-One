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
    setTimeout(()=>resolve({ok:false,timedOut:true,sources:[]}),timeoutMs);
  });
  const mergedMap=()=>{const map=new Map();for(const sources of sourceMaps.values())for(const [id,source] of sources)map.set(id,source);return map;};

  async function list(options={}){
    const requestedKey=keyFor(options);
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

  const get=id=>mergedMap().get(String(id||''))||null;
  const busy=()=>Boolean(inFlight);
  const snapshot=()=>Object.freeze({busy:Boolean(inFlight),key:inFlightKey,sourceCount:mergedMap().size});
  return Object.freeze({list,get,busy,snapshot});
}
