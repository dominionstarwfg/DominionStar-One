export function createShareSourceAuthority({enumerateSources,timeoutMs=4500}){
  if(typeof enumerateSources!=='function')throw new Error('Share source authority requires an enumerator.');
  let inFlight=null;
  let sourceMap=new Map();

  const timeoutResult=()=>new Promise(resolve=>setTimeout(()=>resolve({ok:false,timedOut:true,sources:[]}),timeoutMs));

  async function list(options={}){
    if(!inFlight){
      inFlight=Promise.resolve()
        .then(()=>enumerateSources(options))
        .then(sources=>{
          const safe=Array.isArray(sources)?sources:[];
          sourceMap=new Map(safe.map(source=>[String(source.id),source]));
          return {ok:true,timedOut:false,sources:safe};
        })
        .finally(()=>{inFlight=null;});
    }
    return Promise.race([inFlight,timeoutResult()]);
  }

  const get=id=>sourceMap.get(String(id||''))||null;
  const busy=()=>Boolean(inFlight);
  return Object.freeze({list,get,busy});
}
