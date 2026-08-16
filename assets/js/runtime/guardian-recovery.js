(()=>{
'use strict';
if(window.DominionGuardianRecovery?.version==='1.1.0')return;

const COOLDOWN_MS=5000;
const CAMERA_VERIFY_MS=900;
const MAX_ATTEMPTS_PER_MINUTE=8;
const state={
  version:'1.1.0',
  startedAt:Date.now(),
  enabled:true,
  attempts:[],
  successes:0,
  failures:0,
  skipped:0,
  cooldowns:new Map(),
  inFlight:new Map(),
  off:null,
  cameraTimer:null,
  onlineHandler:null,
  visibilityHandler:null
};

const bus=()=>window.DominionRuntime?.events;
const meeting=()=>window.DominionRuntime?.meeting;
const publish=(type,payload={},severity='info')=>bus()?.publish?.({
  type,source:'guardian-recovery',severity,
  meetingId:meeting()?.snapshot?.()?.roomId||'',
  actorId:meeting()?.snapshot?.()?.participantId||'',
  correlationId:payload?.participantId||payload?.key||'',
  payload
});
const pruneAttempts=()=>{
  const cutoff=Date.now()-60000;
  state.attempts=state.attempts.filter(at=>at>=cutoff);
};
const allowed=(key)=>{
  if(!state.enabled)return {ok:false,reason:'disabled'};
  pruneAttempts();
  if(state.attempts.length>=MAX_ATTEMPTS_PER_MINUTE)return {ok:false,reason:'rate-limited'};
  const last=state.cooldowns.get(key)||0;
  if(Date.now()-last<COOLDOWN_MS)return {ok:false,reason:'cooldown'};
  if(state.inFlight.has(key))return {ok:false,reason:'in-flight'};
  return {ok:true};
};
const run=async(key,kind,operation,context={})=>{
  const permit=allowed(key);
  if(!permit.ok){state.skipped+=1;return {ok:false,skipped:true,reason:permit.reason};}
  state.cooldowns.set(key,Date.now());
  state.attempts.push(Date.now());
  publish('guardian.recovery.started',{key,kind,...context});
  const promise=(async()=>{
    try{
      const result=await operation();
      if(result?.ok===false&&!result?.skipped)throw new Error(result.error||result.reason||`${kind} recovery failed`);
      if(result?.skipped){state.skipped+=1;publish('guardian.recovery.skipped',{key,kind,reason:result.reason||'skipped',...context});return result;}
      state.successes+=1;
      publish('guardian.recovery.succeeded',{key,kind,result,...context});
      return result||{ok:true};
    }catch(error){
      state.failures+=1;
      const message=error?.message||String(error);
      publish('guardian.recovery.failed',{key,kind,message,...context},'error');
      return {ok:false,error:message};
    }finally{state.inFlight.delete(key);}
  })();
  state.inFlight.set(key,promise);
  return promise;
};

const recoverCamera=async(reason='guardian-event')=>{
  const engine=meeting();
  if(!engine?.recoverCamera)return {ok:false,skipped:true,reason:'unsupported'};
  const health=engine.health?.();
  if(!health?.media?.video)return {ok:false,skipped:true,reason:'camera-disabled'};
  if(health.media.cameraTrackState==='live')return {ok:true,skipped:true,reason:'already-live'};
  return run('camera','camera',()=>engine.recoverCamera({reason}),{reason});
};

const recoverPeer=async(participantId,reason='guardian-event')=>{
  const id=String(participantId||'');
  if(!id)return {ok:false,skipped:true,reason:'missing-participant'};
  const engine=meeting();
  if(!engine?.recoverPeer)return {ok:false,skipped:true,reason:'unsupported'};
  return run(`peer:${id}`,'peer',()=>engine.recoverPeer(id,{reason}),{participantId:id,reason});
};

const reconcilePresence=async(reason='guardian-event')=>{
  const engine=meeting();
  if(!engine?.resyncPresence)return {ok:false,skipped:true,reason:'unsupported'};
  return run('presence','presence',()=>engine.resyncPresence({reason}),{reason});
};

const recoverDegradedPeers=async(reason='guardian-pulse')=>{
  const engine=meeting();
  const h=engine?.health?.();
  if(!h||(!h.failedPeers&&!h.disconnectedPeers))return {ok:true,skipped:true,reason:'healthy'};
  if(!engine?.recoverPeers)return {ok:false,skipped:true,reason:'unsupported'};
  return run('peers:all','peers',()=>engine.recoverPeers({reason}),{reason,failedPeers:h.failedPeers,disconnectedPeers:h.disconnectedPeers});
};

const observe=(_payload,event)=>{
  if(!event||!state.enabled)return;
  const type=event.type;
  if(type==='media.camera.track.ended'||type==='media.camera.recovery.failed'){
    clearTimeout(state.cameraTimer);
    state.cameraTimer=setTimeout(()=>recoverCamera(type),CAMERA_VERIFY_MS);
    return;
  }
  // Peer transport recovery is owned by meeting-engine. Guardian observes the
  // state and records diagnostics, but must not launch a competing ICE restart.
  if(type==='meet.peer.state')return;
  if(type==='presence.reconcile.failed')setTimeout(()=>reconcilePresence('retry-after-failure'),1200);
};

const pulse=()=>{
  if(!state.enabled||document.visibilityState==='hidden'||navigator.onLine===false)return;
  const h=meeting()?.health?.();
  if(!h)return;
  if(h.media?.video&&h.media?.cameraTrackState!=='live')recoverCamera('health-check');
  // Do not mutate peer transport from the health pulse. Manual repair remains
  // available in System Health for a user-directed recovery attempt.
};

const health=()=>{
  pruneAttempts();
  const failures=state.failures;
  return {
    status:failures>state.successes+2?'warning':'healthy',
    version:state.version,
    enabled:state.enabled,
    inFlight:state.inFlight.size,
    attemptsLastMinute:state.attempts.length,
    successes:state.successes,
    failures:state.failures,
    skipped:state.skipped,
    uptimeMs:Date.now()-state.startedAt
  };
};

const start=()=>{
  if(state.off)return true;
  const eventBus=bus();
  if(!eventBus?.on)return false;
  state.off=eventBus.on('*',observe);
  state.onlineHandler=()=>{reconcilePresence('browser-online');setTimeout(()=>recoverDegradedPeers('browser-online'),500);};
  state.visibilityHandler=()=>{if(document.visibilityState==='visible'&&navigator.onLine!==false){reconcilePresence('visibility-resume');setTimeout(pulse,350);}};
  window.addEventListener('online',state.onlineHandler);
  document.addEventListener('visibilitychange',state.visibilityHandler);
  state.timer=setInterval(pulse,3500);
  window.DominionGuardianObserver?.registerService?.('recovery',api);
  publish('guardian.recovery.started.service',{version:state.version});
  return true;
};
const stop=()=>{
  state.off?.();state.off=null;
  clearInterval(state.timer);state.timer=null;
  clearTimeout(state.cameraTimer);state.cameraTimer=null;
  if(state.onlineHandler)window.removeEventListener('online',state.onlineHandler);
  if(state.visibilityHandler)document.removeEventListener('visibilitychange',state.visibilityHandler);
  state.onlineHandler=null;state.visibilityHandler=null;
  window.DominionGuardianObserver?.unregisterService?.('recovery');
  return true;
};
const setEnabled=value=>{state.enabled=Boolean(value);publish('guardian.recovery.mode.changed',{enabled:state.enabled});return state.enabled;};
const snapshot=()=>({...health(),cooldowns:Object.fromEntries(state.cooldowns)});
const api={version:state.version,start,stop,setEnabled,recoverCamera,recoverPeer,recoverDegradedPeers,reconcilePresence,health,snapshot};
window.DominionGuardianRecovery=api;
window.DominionRuntime=window.DominionRuntime||{};
window.DominionRuntime.recovery=api;
if(!start())document.addEventListener('DOMContentLoaded',start,{once:true});
})();
