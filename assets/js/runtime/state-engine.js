(()=>{
'use strict';
const clone=value=>{try{return structuredClone(value)}catch(_){return JSON.parse(JSON.stringify(value))}};
class DominionStateEngine{
  constructor(initial={}){this.state=initial;this.subscribers=new Set();}
  get(path){if(!path)return clone(this.state);return path.split('.').reduce((v,k)=>v?.[k],this.state);}
  set(path,value,meta={}){const keys=path.split('.');let cursor=this.state;keys.slice(0,-1).forEach(k=>cursor=cursor[k]??=( {} ));cursor[keys.at(-1)]=value;const snapshot=this.get();this.subscribers.forEach(fn=>{try{fn(snapshot,{path,value,meta})}catch(e){console.error('[DominionState]',e)}});window.DominionRuntime?.events?.emit('state.changed',{path,value,meta});return value;}
  update(path,updater,meta={}){return this.set(path,updater(this.get(path)),meta);}
  subscribe(fn){this.subscribers.add(fn);return()=>this.subscribers.delete(fn);}
}
window.DominionRuntime=window.DominionRuntime||{};
window.DominionRuntime.state=window.DominionRuntime.state||new DominionStateEngine({meeting:{view:'speaker'},workspace:{},preferences:{}});
})();
