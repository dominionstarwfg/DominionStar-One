(()=>{
'use strict';
if(window.DominionGuardianResilience?.version==='1.0.0')return;

const SAMPLE_MS=2000;
const MAX_ERRORS=80;
const LONG_TASK_WARN_MS=250;
const EVENT_LOOP_WARN_MS=180;
const MEMORY_WARN_RATIO=.82;
const state={
  version:'1.0.0',startedAt:Date.now(),timer:null,longTaskObserver:null,
  errors:[],longTasks:0,lastLongTaskAt:0,lastLongTaskDuration:0,
  eventLoopLagMs:0,maxEventLoopLagMs:0,memoryRatio:null,memoryUsed:null,memoryLimit:null,
  online:navigator.onLine!==false,visibility:document.visibilityState||'unknown',
  unhandledErrors:0,unhandledRejections:0,lastSampleAt:Date.now(),off:[]
};

const bus=()=>window.DominionRuntime?.events;
const meeting=()=>window.DominionRuntime?.meeting;
const now=()=>Date.now();
const publish=(type,payload={},severity='info')=>bus()?.publish?.({
  type,source:'guardian-resilience',severity,
  meetingId:meeting()?.snapshot?.()?.roomId||'',actorId:meeting()?.snapshot?.()?.participantId||'',payload
});
const boundedPush=(list,item,max)=>{list.push(item);if(list.length>max)list.splice(0,list.length-max);};

const captureError=(kind,error)=>{
  const entry={kind,timestamp:now(),message:error?.message||String(error||'Unknown error'),stack:String(error?.stack||'').slice(0,4000)};
  boundedPush(state.errors,entry,MAX_ERRORS);
  if(kind==='error')state.unhandledErrors+=1; else state.unhandledRejections+=1;
  publish(`runtime.unhandled.${kind}`,{message:entry.message,stack:entry.stack},'error');
};

const sampleMemory=()=>{
  const mem=performance?.memory;
  if(!mem?.jsHeapSizeLimit)return;
  state.memoryUsed=mem.usedJSHeapSize||0;
  state.memoryLimit=mem.jsHeapSizeLimit||0;
  state.memoryRatio=state.memoryLimit?state.memoryUsed/state.memoryLimit:null;
  if(state.memoryRatio!==null&&state.memoryRatio>=MEMORY_WARN_RATIO){
    publish('runtime.memory.pressure',{ratio:Number(state.memoryRatio.toFixed(3)),used:state.memoryUsed,limit:state.memoryLimit},'warning');
  }
};

const sampleEventLoop=()=>{
  const scheduled=performance.now();
  setTimeout(()=>{
    const lag=Math.max(0,performance.now()-scheduled);
    state.eventLoopLagMs=Number(lag.toFixed(1));
    state.maxEventLoopLagMs=Math.max(state.maxEventLoopLagMs,state.eventLoopLagMs);
    if(state.eventLoopLagMs>=EVENT_LOOP_WARN_MS)publish('runtime.eventloop.degraded',{lagMs:state.eventLoopLagMs},'warning');
  },0);
};

const sample=()=>{
  state.online=navigator.onLine!==false;
  state.visibility=document.visibilityState||'unknown';
  state.lastSampleAt=now();
  sampleMemory();
  sampleEventLoop();
  const h=meeting()?.health?.();
  if(h?.failedPeers||h?.disconnectedPeers){
    publish('runtime.session.degraded',{failedPeers:h.failedPeers||0,disconnectedPeers:h.disconnectedPeers||0},'warning');
  }
};

const health=()=>{
  const recentErrors=state.errors.filter(e=>now()-e.timestamp<60000).length;
  const severeLag=state.eventLoopLagMs>=EVENT_LOOP_WARN_MS;
  const memoryPressure=state.memoryRatio!==null&&state.memoryRatio>=MEMORY_WARN_RATIO;
  const status=recentErrors>=3||memoryPressure?'warning':severeLag?'warning':'healthy';
  return {
    status,version:state.version,uptimeMs:now()-state.startedAt,
    online:state.online,visibility:state.visibility,recentErrors,
    unhandledErrors:state.unhandledErrors,unhandledRejections:state.unhandledRejections,
    longTasks:state.longTasks,lastLongTaskDuration:state.lastLongTaskDuration,
    eventLoopLagMs:state.eventLoopLagMs,maxEventLoopLagMs:state.maxEventLoopLagMs,
    memoryRatio:state.memoryRatio===null?null:Number(state.memoryRatio.toFixed(3)),
    memoryUsed:state.memoryUsed,memoryLimit:state.memoryLimit
  };
};

const diagnostics=()=>({
  generatedAt:new Date().toISOString(),
  location:{href:location.href,visibility:document.visibilityState,online:navigator.onLine!==false},
  userAgent:navigator.userAgent,
  platform:navigator.platform||'',
  resilience:health(),
  guardian:window.DominionGuardianObserver?.snapshot?.()||null,
  recovery:window.DominionGuardianRecovery?.snapshot?.()||null,
  meeting:meeting()?.health?.()||null,
  meetingSnapshot:meeting()?.snapshot?.()||null,
  recentUnhandled:state.errors.slice(-25)
});

const exportDiagnostics=()=>{
  const data=diagnostics();
  const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'});
  const url=URL.createObjectURL(blob);
  const a=document.createElement('a');
  const room=String(data?.meeting?.roomId||'meeting').replace(/[^a-z0-9_-]+/gi,'-').slice(0,40);
  a.href=url;a.download=`dominionstar-diagnostics-${room}-${Date.now()}.json`;
  document.body.appendChild(a);a.click();a.remove();
  setTimeout(()=>URL.revokeObjectURL(url),1500);
  publish('guardian.diagnostics.exported',{roomId:data?.meeting?.roomId||''});
  return data;
};

const start=()=>{
  if(state.timer)return true;
  const onError=e=>captureError('error',e?.error||new Error(e?.message||'window error'));
  const onRejection=e=>captureError('rejection',e?.reason instanceof Error?e.reason:new Error(String(e?.reason||'unhandled rejection')));
  const onOnline=()=>{state.online=true;publish('runtime.network.online',{});};
  const onOffline=()=>{state.online=false;publish('runtime.network.offline',{},'warning');};
  const onVisibility=()=>{state.visibility=document.visibilityState||'unknown';publish('runtime.visibility.changed',{visibility:state.visibility});};
  window.addEventListener('error',onError);
  window.addEventListener('unhandledrejection',onRejection);
  window.addEventListener('online',onOnline);
  window.addEventListener('offline',onOffline);
  document.addEventListener('visibilitychange',onVisibility);
  state.off=[()=>window.removeEventListener('error',onError),()=>window.removeEventListener('unhandledrejection',onRejection),()=>window.removeEventListener('online',onOnline),()=>window.removeEventListener('offline',onOffline),()=>document.removeEventListener('visibilitychange',onVisibility)];
  if('PerformanceObserver' in window){
    try{
      state.longTaskObserver=new PerformanceObserver(list=>{
        for(const entry of list.getEntries()){
          state.longTasks+=1;state.lastLongTaskAt=now();state.lastLongTaskDuration=Math.round(entry.duration||0);
          if((entry.duration||0)>=LONG_TASK_WARN_MS)publish('runtime.longtask',{durationMs:Math.round(entry.duration||0)},'warning');
        }
      });
      state.longTaskObserver.observe({entryTypes:['longtask']});
    }catch(_){state.longTaskObserver=null;}
  }
  state.timer=setInterval(sample,SAMPLE_MS);
  sample();
  window.DominionGuardianObserver?.registerService?.('resilience',api);
  publish('guardian.resilience.started',{version:state.version});
  return true;
};
const stop=()=>{
  clearInterval(state.timer);state.timer=null;
  state.longTaskObserver?.disconnect?.();state.longTaskObserver=null;
  state.off.splice(0).forEach(fn=>{try{fn();}catch(_){}});
  window.DominionGuardianObserver?.unregisterService?.('resilience');
  return true;
};

const api={version:state.version,start,stop,health,diagnostics,exportDiagnostics};
window.DominionGuardianResilience=api;
window.DominionRuntime=window.DominionRuntime||{};
window.DominionRuntime.resilience=api;
if(!start())document.addEventListener('DOMContentLoaded',start,{once:true});
})();
