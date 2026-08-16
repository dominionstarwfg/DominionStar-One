(()=>{
'use strict';
if(window.DominionGuardianObserver?.version==='3.0.0')return;

const MAX_EVENTS=600;
const MAX_ALERTS=180;
const HEALTH_INTERVAL_MS=2000;
const ALERT_DEDUPE_MS=5000;
const state={
  version:'3.0.0',
  startedAt:Date.now(),
  events:[],
  alerts:[],
  counters:new Map(),
  services:new Map(),
  lastAlertAt:new Map(),
  off:null,
  timer:null,
  lastOverallStatus:'unknown',
  lastSnapshot:null
};

const warningTypes=new Set([
  'meet.peer.failed','meet.moderation.timeout','meet.control.failed',
  'media.track.failed','media.camera.track.ended','media.camera.recovery.failed',
  'media.remote.video.missing',
  'realtime.disconnected','realtime.reconnect.failed','realtime.event.failed',
  'guardian.service.unhealthy'
]);

const severityRank={info:0,warning:1,error:2,critical:3};
const classify=event=>{
  const explicit=String(event?.severity||'').toLowerCase();
  if(explicit in severityRank)return explicit;
  if(warningTypes.has(event?.type))return 'warning';
  if(/critical/i.test(event?.type||''))return 'critical';
  if(/error|failed/i.test(event?.type||''))return 'error';
  if(/timeout|warning|degraded|disconnected/i.test(event?.type||''))return 'warning';
  return 'info';
};

const pushBounded=(list,item,max)=>{list.push(item);if(list.length>max)list.splice(0,list.length-max);};
const alertKey=entry=>`${entry.type}|${entry.actorId||''}|${entry.correlationId||''}`;

const observe=(payload,event)=>{
  if(!event)return;
  const entry={...event,severity:classify(event)};
  pushBounded(state.events,entry,MAX_EVENTS);
  state.counters.set(entry.type,(state.counters.get(entry.type)||0)+1);
  if(entry.severity==='info')return;
  const key=alertKey(entry); const now=Date.now(); const previous=state.lastAlertAt.get(key)||0;
  state.lastAlertAt.set(key,now);
  if(now-previous<ALERT_DEDUPE_MS)return;
  pushBounded(state.alerts,entry,MAX_ALERTS);
};

const registerService=(name,service)=>{
  if(!name||!service)return false;
  state.services.set(String(name),service);
  return true;
};
const unregisterService=name=>state.services.delete(String(name));

const serviceHealth=()=>{
  const services={};
  const runtime=window.DominionRuntime||{};
  // Auto-register known runtime services without requiring callers to change.
  [['eventBus',runtime.events],['meeting',runtime.meeting]].forEach(([name,service])=>{if(service&&!state.services.has(name))state.services.set(name,service);});
  for(const [name,service] of state.services.entries()){
    try{
      const value=typeof service?.health==='function'?service.health():{status:'healthy'};
      services[name]=value&&typeof value==='object'?value:{status:'unknown'};
    }catch(error){
      services[name]={status:'critical',error:error?.message||String(error)};
    }
  }
  return services;
};

const combineStatus=services=>{
  let rank=0;
  for(const item of Object.values(services||{})){
    const status=String(item?.status||'unknown').toLowerCase();
    const r=status==='critical'?3:status==='error'?2:status==='warning'||status==='degraded'?1:0;
    rank=Math.max(rank,r);
  }
  const recentCritical=state.alerts.some(item=>item.severity==='critical'&&Date.now()-item.timestamp<60000);
  const recentError=state.alerts.some(item=>item.severity==='error'&&Date.now()-item.timestamp<30000);
  if(recentCritical)rank=Math.max(rank,3); else if(recentError)rank=Math.max(rank,2);
  return rank===3?'critical':rank===2?'error':rank===1?'warning':'healthy';
};

const eventRate=(windowMs=10000)=>{
  const cutoff=Date.now()-windowMs;
  const count=state.events.reduce((n,item)=>n+(item.timestamp>=cutoff?1:0),0);
  return Number((count/(windowMs/1000)).toFixed(2));
};

const health=()=>{
  const services=serviceHealth();
  const status=combineStatus(services);
  const recentWarnings=state.alerts.filter(item=>Date.now()-item.timestamp<60000).length;
  return {
    version:state.version,
    status,
    observing:Boolean(state.off),
    eventsObserved:state.events.length,
    alerts:state.alerts.length,
    recentWarnings,
    eventRatePerSecond:eventRate(),
    services,
    visibility:document.visibilityState||'unknown',
    online:navigator.onLine!==false,
    uptimeMs:Date.now()-state.startedAt
  };
};

const recent=(limit=50)=>state.events.slice(-Math.max(1,limit));
const alerts=(limit=30)=>state.alerts.slice(-Math.max(1,limit));
const snapshot=()=>({health:health(),events:recent(120),alerts:alerts(60),counters:Object.fromEntries(state.counters)});

const publishHealthTransition=current=>{
  const bus=window.DominionRuntime?.events;
  if(!bus?.publish)return;
  if(current.status!==state.lastOverallStatus){
    bus.publish({type:'guardian.health.changed',source:'guardian-observer',severity:current.status==='healthy'?'info':current.status,payload:{from:state.lastOverallStatus,to:current.status,services:current.services}});
    state.lastOverallStatus=current.status;
  }
};

const pulse=()=>{
  const current=health();
  state.lastSnapshot=current;
  publishHealthTransition(current);
  try{window.dispatchEvent(new CustomEvent('dominion:guardian-snapshot',{detail:current}));}catch(_){ }
};

const start=()=>{
  if(state.off)return true;
  const bus=window.DominionRuntime?.events;
  if(!bus?.on)return false;
  state.off=bus.on('*',observe);
  registerService('eventBus',bus);
  if(window.DominionRuntime?.meeting)registerService('meeting',window.DominionRuntime.meeting);
  clearInterval(state.timer); state.timer=setInterval(pulse,HEALTH_INTERVAL_MS);
  pulse();
  bus.publish?.({type:'guardian.observer.started',source:'guardian-observer',payload:{startedAt:state.startedAt,version:state.version}});
  return true;
};

const stop=()=>{state.off?.();state.off=null;clearInterval(state.timer);state.timer=null;return true;};
const clearAlerts=()=>{state.alerts.length=0;state.lastAlertAt.clear();return true;};

window.DominionGuardianObserver={version:state.version,start,stop,recent,alerts,health,snapshot,registerService,unregisterService,clearAlerts};
window.DominionRuntime=window.DominionRuntime||{};
window.DominionRuntime.guardian=window.DominionGuardianObserver;

if(!start())document.addEventListener('DOMContentLoaded',start,{once:true});
})();
