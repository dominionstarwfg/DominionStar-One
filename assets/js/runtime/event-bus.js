(()=>{
'use strict';

const makeId=(prefix='evt')=>`${prefix}_${globalThis.crypto?.randomUUID?.()||Math.random().toString(36).slice(2)}_${Date.now().toString(36)}`;
const clone=value=>{try{return structuredClone(value)}catch(_){try{return JSON.parse(JSON.stringify(value))}catch(__){return value}}};

class DominionEventBus{
  constructor({maxHistory=500,dedupeWindowMs=30000}={}){
    this.listeners=new Map();
    this.history=[];
    this.maxHistory=maxHistory;
    this.dedupeWindowMs=dedupeWindowMs;
    this.seen=new Map();
    this.startedAt=Date.now();
    this.published=0;
    this.droppedDuplicates=0;
    this.handlerErrors=0;
  }

  on(type,handler){
    if(!type||typeof handler!=='function')return()=>{};
    const set=this.listeners.get(type)||new Set();
    set.add(handler);
    this.listeners.set(type,set);
    return()=>this.off(type,handler);
  }

  once(type,handler){
    const off=this.on(type,(payload,event)=>{off();handler(payload,event)});
    return off;
  }

  off(type,handler){
    const set=this.listeners.get(type);
    if(!set)return;
    set.delete(handler);
    if(!set.size)this.listeners.delete(type);
  }

  normalize(input,detail={},meta={}){
    if(typeof input==='string'){
      return {
        id:meta.id||makeId('evt'),
        type:input,
        version:Number(meta.version||1),
        timestamp:Number(meta.timestamp||Date.now()),
        source:meta.source||'legacy',
        meetingId:meta.meetingId||detail?.meetingId||'',
        actorId:meta.actorId||detail?.participantId||detail?.from||'',
        correlationId:meta.correlationId||detail?.requestId||'',
        payload:detail??{}
      };
    }
    const event=input&&typeof input==='object'?input:{};
    return {
      id:event.id||makeId('evt'),
      type:String(event.type||'unknown'),
      version:Number(event.version||1),
      timestamp:Number(event.timestamp||Date.now()),
      source:String(event.source||'unknown'),
      meetingId:String(event.meetingId||event.payload?.meetingId||''),
      actorId:String(event.actorId||event.payload?.participantId||event.payload?.from||''),
      correlationId:String(event.correlationId||event.payload?.requestId||''),
      payload:event.payload??{},
      severity:event.severity||'info',
      tags:event.tags||undefined
    };
  }

  pruneSeen(now=Date.now()){
    for(const [id,at] of this.seen.entries())if(now-at>this.dedupeWindowMs)this.seen.delete(id);
  }

  publish(input,detail={},meta={}){
    const event=this.normalize(input,detail,meta);
    const now=Date.now();
    this.pruneSeen(now);
    if(event.id&&this.seen.has(event.id)){
      this.droppedDuplicates++;
      return {...event,duplicate:true};
    }
    if(event.id)this.seen.set(event.id,now);
    this.history.push(event);
    if(this.history.length>this.maxHistory)this.history.splice(0,this.history.length-this.maxHistory);
    this.published++;

    const deliver=(set,payloadFirst=true)=>{
      if(!set)return;
      [...set].forEach(fn=>{
        try{payloadFirst?fn(event.payload,event):fn(event,event)}
        catch(error){this.handlerErrors++;console.error('[DominionEventBus]',event.type,error)}
      });
    };
    deliver(this.listeners.get(event.type),true);
    deliver(this.listeners.get('*'),true);

    // Backward-compatible DOM bridge: detail remains the legacy payload.
    try{document.dispatchEvent(new CustomEvent(`dominion:${event.type}`,{detail:event.payload}))}catch(_){}
    try{document.dispatchEvent(new CustomEvent('dominion:event',{detail:event}))}catch(_){}
    return event;
  }

  emit(type,detail={},meta={}){return this.publish(type,detail,meta);}
  recent(limit=50){return this.history.slice(-Math.max(1,limit)).map(clone);}
  clearHistory(){this.history.length=0;}
  health(){
    return {
      status:this.handlerErrors?'warning':'healthy',
      published:this.published,
      droppedDuplicates:this.droppedDuplicates,
      handlerErrors:this.handlerErrors,
      listenerTypes:this.listeners.size,
      uptimeMs:Date.now()-this.startedAt
    };
  }
}

window.DominionRuntime=window.DominionRuntime||{};
const existing=window.DominionRuntime.events;
if(!existing||typeof existing.publish!=='function')window.DominionRuntime.events=new DominionEventBus();
window.DominionEventBus=DominionEventBus;
})();
