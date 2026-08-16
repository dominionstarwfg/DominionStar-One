(()=>{
'use strict';
if(window.DominionGuardianCertification?.version==='2.0.0')return;

const VERSION='2.0.0';
const STABILITY_WINDOW_MS=120000;
const MAX_RECENT_ALERTS=120;
const state={
  version:VERSION,
  startedAt:Date.now(),
  lastRunAt:0,
  lastReport:null,
  firstHealthyAt:0,
  consecutiveHealthySamples:0,
  timer:null
};

const now=()=>Date.now();
const guardian=()=>window.DominionGuardianObserver;
const recovery=()=>window.DominionGuardianRecovery;
const resilience=()=>window.DominionGuardianResilience;
const meeting=()=>window.DominionRuntime?.meeting;
const bus=()=>window.DominionRuntime?.events;
const publish=(type,payload={},severity='info')=>bus()?.publish?.({
  type,source:'guardian-certification',severity,
  meetingId:meeting()?.snapshot?.()?.roomId||'',actorId:meeting()?.snapshot?.()?.participantId||'',payload
});

const result=(id,label,status,detail='',evidence={})=>({id,label,status,detail,evidence});
const worstStatus=checks=>{
  const rank={pass:0,warn:1,fail:2};
  let worst='pass';
  for(const check of checks)if((rank[check.status]||0)>(rank[worst]||0))worst=check.status;
  return worst;
};

const apiChecks=()=>{
  const checks=[];
  const required=[
    ['event-bus','Event Bus',bus(),['publish','on','health']],
    ['meeting-engine','Meeting Engine',meeting(),['health','snapshot','resyncPresence','recoverPeer','recoverPeers','startMedia','toggleAudio','toggleVideo','shareScreen','chat','reaction','transcript']],
    ['guardian-observer','Guardian Observer',guardian(),['health','snapshot','registerService']],
    ['guardian-recovery','Guardian Recovery',recovery(),['health','snapshot']],
    ['guardian-resilience','Guardian Resilience',resilience(),['health','diagnostics']]
  ];
  for(const [id,label,service,methods] of required){
    const missing=!service?methods:methods.filter(name=>typeof service?.[name]!=='function');
    checks.push(result(id,label,missing.length?'fail':'pass',missing.length?`Missing: ${missing.join(', ')}`:'Runtime contract available',{missing}));
  }
  return checks;
};

const featureChecks=()=>{
  const requiredControls=[
    ['micBtn','Microphone control'],['camBtn','Camera control'],['participantsBtn','Participants'],
    ['chatBtn','Meeting chat'],['shareBtn','Screen sharing'],['reactionBtn','Reactions'],
    ['raiseHandBtn','Raise Hand'],['transcribeBtn','Transcription'],['moreBtn','More controls'],['leaveBtn','Leave meeting']
  ];
  const checks=requiredControls.map(([id,label])=>result(`control-${id}`,label,document.getElementById(id)?'pass':'fail',document.getElementById(id)?'Control available':'Control missing',{id}));
  const mh=meeting()?.health?.()||{};
  checks.push(result('realtime-channel','Realtime channel',mh.channelStatus==='subscribed'?'pass':mh.channelStatus==='idle'?'warn':'fail',`Status: ${mh.channelStatus||'unknown'}`,{channelStatus:mh.channelStatus||'unknown'}));
  checks.push(result('remote-media-delivery',(mh.expectedRemoteVideo||0)?'Remote video delivery':'Remote video readiness',(mh.missingRemoteVideo||0)>0?'fail':'pass',`${mh.missingRemoteVideo||0} missing of ${mh.expectedRemoteVideo||0} expected`,{expected:mh.expectedRemoteVideo||0,missing:mh.missingRemoteVideo||0,participants:mh.missingRemoteVideoParticipants||[]}));
  checks.push(result('waiting-room-ui','Waiting-room controls',document.getElementById('waitingSection')&&document.getElementById('waitingRoom')?'pass':'fail','Admission interface available'));
  checks.push(result('private-chat-ui','Private meeting chat',document.getElementById('chatRecipient')?'pass':'fail','Recipient selector available'));
  return checks;
};

const runtimeChecks=()=>{
  const checks=[];
  const mh=meeting()?.health?.()||{};
  const gh=guardian()?.health?.()||{};
  const rh=recovery()?.health?.()||recovery()?.snapshot?.()?.health||{};
  const sh=resilience()?.health?.()||{};
  const alerts=guardian()?.alerts?.(MAX_RECENT_ALERTS)||[];
  const cutoff=now()-60000;
  const recent=alerts.filter(item=>(item.timestamp||0)>=cutoff);
  const severe=recent.filter(item=>['error','critical'].includes(String(item.severity||'').toLowerCase()));
  const warnings=recent.filter(item=>String(item.severity||'').toLowerCase()==='warning');

  checks.push(result('network','Network',navigator.onLine===false?'fail':'pass',navigator.onLine===false?'Browser reports offline':'Online'));
  checks.push(result('meeting-health','Meeting health',mh.status==='critical'?'fail':mh.status==='warning'?'warn':'pass',`Status: ${mh.status||'unknown'}`,mh));
  checks.push(result('peer-failures','Peer connections',(mh.failedPeers||0)>0?'fail':(mh.disconnectedPeers||0)>0?'warn':'pass',`Failed ${mh.failedPeers||0}, disconnected ${mh.disconnectedPeers||0}`,{failedPeers:mh.failedPeers||0,disconnectedPeers:mh.disconnectedPeers||0,peerCount:mh.peerCount||0}));
  checks.push(result('moderation-queue','Host control queue',(mh.pendingModerationRequests||0)>3?'warn':'pass',`${mh.pendingModerationRequests||0} pending`,{pending:mh.pendingModerationRequests||0}));
  checks.push(result('runtime-errors','Unhandled runtime errors',(sh.recentErrors||0)>0?'fail':'pass',`${sh.recentErrors||0} in last minute`,{recentErrors:sh.recentErrors||0,totalErrors:sh.unhandledErrors||0,totalRejections:sh.unhandledRejections||0}));
  checks.push(result('event-loop','Event-loop responsiveness',(sh.eventLoopLagMs||0)>=250?'fail':(sh.eventLoopLagMs||0)>=180?'warn':'pass',`${sh.eventLoopLagMs||0} ms`,{lagMs:sh.eventLoopLagMs||0,maxLagMs:sh.maxEventLoopLagMs||0,longTasks:sh.longTasks||0}));
  checks.push(result('heap-pressure','Heap pressure',sh.memoryRatio!==null&&sh.memoryRatio!==undefined&&sh.memoryRatio>=.9?'fail':sh.memoryRatio>=.82?'warn':'pass',sh.memoryRatio===null||sh.memoryRatio===undefined?'Telemetry unavailable':`${Math.round(sh.memoryRatio*100)}%`,{memoryRatio:sh.memoryRatio??null}));
  checks.push(result('recent-alerts','Recent Guardian alerts',severe.length?'fail':warnings.length>3?'warn':'pass',`${severe.length} severe, ${warnings.length} warnings in 60s`,{severe:severe.length,warnings:warnings.length}));
  checks.push(result('recovery','Recovery health',(rh.failures||0)>0?'warn':'pass',`${rh.successes||0} succeeded, ${rh.failures||0} failed`,{successes:rh.successes||0,failures:rh.failures||0,inFlight:rh.inFlight||0}));
  checks.push(result('guardian','Guardian health',gh.status==='critical'||gh.status==='error'?'fail':gh.status==='warning'?'warn':'pass',`Status: ${gh.status||'unknown'}`,{status:gh.status||'unknown',alerts:gh.alerts||0,eventRatePerSecond:gh.eventRatePerSecond||0}));
  return checks;
};

const updateStability=checks=>{
  const status=worstStatus(checks);
  if(status==='pass'){
    if(!state.firstHealthyAt)state.firstHealthyAt=now();
    state.consecutiveHealthySamples+=1;
  }else{
    state.firstHealthyAt=0;
    state.consecutiveHealthySamples=0;
  }
  return {
    healthyForMs:state.firstHealthyAt?now()-state.firstHealthyAt:0,
    targetMs:STABILITY_WINDOW_MS,
    qualified:Boolean(state.firstHealthyAt&&now()-state.firstHealthyAt>=STABILITY_WINDOW_MS),
    samples:state.consecutiveHealthySamples
  };
};

const run=({publishEvent=true}={})=>{
  const checks=[...apiChecks(),...featureChecks(),...runtimeChecks()];
  const status=worstStatus(checks);
  const stability=updateStability(checks);
  const report={
    version:VERSION,
    generatedAt:new Date().toISOString(),
    status,
    productionReady:status==='pass'&&stability.qualified,
    stability,
    checks,
    summary:{pass:checks.filter(c=>c.status==='pass').length,warn:checks.filter(c=>c.status==='warn').length,fail:checks.filter(c=>c.status==='fail').length},
    build:window.__DS_MEET_BUILD||'RC10-S16',
    meetingId:meeting()?.snapshot?.()?.roomId||''
  };
  state.lastRunAt=now();state.lastReport=report;
  if(publishEvent)publish('guardian.certification.completed',{status,productionReady:report.productionReady,summary:report.summary,stability},status==='fail'?'error':status==='warn'?'warning':'info');
  try{window.dispatchEvent(new CustomEvent('dominion:certification',{detail:report}));}catch(_){}
  return report;
};

const health=()=>{
  const report=state.lastReport||run({publishEvent:false});
  return {status:report.status==='fail'?'critical':report.status==='warn'?'warning':'healthy',version:VERSION,productionReady:report.productionReady,pass:report.summary.pass,warn:report.summary.warn,fail:report.summary.fail,healthyForMs:report.stability.healthyForMs};
};

const exportReport=()=>{
  const report=run();
  const blob=new Blob([JSON.stringify(report,null,2)],{type:'application/json'});
  const url=URL.createObjectURL(blob);const a=document.createElement('a');
  a.href=url;a.download=`dominionstar-certification-${report.meetingId||'meeting'}-${Date.now()}.json`;
  document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1500);
  publish('guardian.certification.exported',{status:report.status,productionReady:report.productionReady});
  return report;
};

const start=()=>{
  if(state.timer)return true;
  guardian()?.registerService?.('certification',api);
  state.timer=setInterval(()=>run({publishEvent:false}),5000);
  run({publishEvent:false});
  publish('guardian.certification.started',{version:VERSION,stabilityWindowMs:STABILITY_WINDOW_MS});
  return true;
};
const stop=()=>{clearInterval(state.timer);state.timer=null;guardian()?.unregisterService?.('certification');return true;};
const snapshot=()=>state.lastReport||run({publishEvent:false});
const api={version:VERSION,start,stop,run,snapshot,health,exportReport};
window.DominionGuardianCertification=api;
window.DominionRuntime=window.DominionRuntime||{};
window.DominionRuntime.certification=api;
if(!start())document.addEventListener('DOMContentLoaded',start,{once:true});
})();
