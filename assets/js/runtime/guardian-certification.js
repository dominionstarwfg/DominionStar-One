(()=>{
'use strict';
if(window.DominionGuardianCertification?.version==='2.1.0')return;

const VERSION='2.1.0';
const ACTION_VERSION='1.0.0';
const STABILITY_WINDOW_MS=120000;
const MAX_RECENT_ALERTS=120;
const MAX_ACTION_EVENTS=320;

const action=(id,label,selector,event='click',required=true,group='meeting')=>Object.freeze({id,label,selector,event,required,group});
const ACTION_CATALOG=Object.freeze([
  action('prejoin.new-meeting','New Meeting','#newMeetingAction','click',true,'prejoin'),
  action('prejoin.share-screen','Start and Share Screen','#shareScreenAction','click',true,'prejoin'),
  action('prejoin.personal-room','Personal Room','#personalMeetingAction','click',true,'prejoin'),
  action('prejoin.join','Join by Meeting ID','#joinMeetingAction','click',true,'prejoin'),
  action('prejoin.schedule','Schedule Meeting','#scheduleMeetingAction','click',true,'prejoin'),
  action('prejoin.recurring','Recurring Meeting','#recurringMeetingAction','click',true,'prejoin'),
  action('prejoin.scheduled-close','Close Scheduled Meetings','#closeScheduledMeetings','click',true,'prejoin'),
  action('prejoin.mic','Prejoin Microphone','#preMic','click',true,'prejoin'),
  action('prejoin.camera','Prejoin Camera','#preCam','click',true,'prejoin'),
  action('prejoin.settings','Prejoin Settings','#preSettings','click',true,'prejoin'),
  action('prejoin.submit','Join Meeting','#joinForm','submit',true,'prejoin'),

  action('toolbar.mic','Mute / Unmute','#micBtn'),
  action('toolbar.mic-menu','Audio Options','#micMenuBtn'),
  action('toolbar.camera','Start / Stop Video','#camBtn'),
  action('toolbar.camera-menu','Video Options','#camMenuBtn'),
  action('toolbar.participants','Participants','#participantsBtn'),
  action('toolbar.chat','Meeting Chat','#chatBtn'),
  action('toolbar.share','Share Screen','#shareBtn'),
  action('toolbar.reactions','Reactions','#reactionBtn'),
  action('toolbar.raise-hand','Raise Hand','#raiseHandBtn'),
  action('toolbar.transcription','Live Transcription','#transcribeBtn'),
  action('toolbar.ai-notes','AI Notes','#meetingIntelligenceBtn'),
  action('toolbar.host-tools','Host Tools','#hostToolsBtn'),
  action('toolbar.more','More','#moreBtn'),
  action('toolbar.leave','Leave / End','#leaveBtn'),

  action('participants.close','Close Participants','#participantsPanel [data-close="participantsPanel"]'),
  action('participants.waiting-toggle','Waiting Room Section','#waitingHeader'),
  action('participants.invite','Invite','#inviteBtn'),
  action('participants.mute-all','Mute All','#muteAllBtn'),
  action('participants.more','Participant Panel More','#participantMoreBtn'),
  action('invite.close','Close Invite','#closeInviteBtn'),
  action('invite.copy-link','Copy Meeting Link','#copyLinkBtn'),
  action('invite.copy-invitation','Copy Invitation','#copyInviteBtn'),
  action('chat.close','Close Chat','#chatPanel [data-close="chatPanel"]'),
  action('chat.recipient','Chat Recipient','#chatRecipient','change'),
  action('chat.send','Send Chat Message','#chatForm','submit'),

  action('share.viewer-more','Shared Screen Options','#shareViewerMoreBtn'),
  action('share.mic','Share Toolbar Audio','#shareMicBtn'),
  action('share.camera','Share Toolbar Video','#shareCamBtn'),
  action('share.participants','Share Toolbar Participants','#shareParticipantsBtn'),
  action('share.chat','Share Toolbar Chat','#shareChatBtn'),
  action('share.reactions','Share Toolbar Reactions','#shareReactionBtn'),
  action('share.share','Share Toolbar Share','#shareTopBtn'),
  action('share.pause-resume','Pause / Resume Share','#pauseShareBtn'),
  action('share.new','New Share','#newShareBtn'),
  action('share.more','Share Toolbar More','#shareMoreBtn'),
  action('share.stop','Stop Share','#stopShareBtn'),

  action('settings.close','Close Settings','#settingsDialog button[value="cancel"]'),
  action('settings.camera','Camera Selection','#cameraSelect','change'),
  action('settings.microphone','Microphone Selection','#microphoneSelect','change'),
  action('settings.speaker','Speaker Selection','#speakerSelect','change'),
  action('settings.mirror','Mirror Video','#mirrorToggle','change'),
  action('settings.quality','Video Quality','#qualitySelect','change'),
  action('settings.background','Background','#backgroundSelect','change'),
  action('settings.brightness','Brightness','#brightnessRange','change'),
  action('settings.appearance','Touch Up Appearance','#touchAppearanceRange','change'),

  action('schedule.close','Close Schedule','#scheduleClose'),
  action('schedule.cancel','Cancel Schedule','#scheduleCancel'),
  action('schedule.submit','Schedule Meeting','#scheduleMeetingForm','submit'),
  action('schedule.recurring','Recurring Toggle','#scheduleRecurring','change'),
  action('schedule.waiting-room','Schedule Waiting Room','#scheduleWaitingRoom','change'),
  action('schedule.passcode','Schedule Passcode','#scheduleRequirePasscode','change'),

  action('personal.close','Close Personal Room','#personalRoomClose'),
  action('personal.copy','Copy Personal Invitation','#copyPersonalInvite'),
  action('personal.save','Save Personal Room','#savePersonalRoom'),
  action('personal.start','Start Personal Room','#startPersonalRoom'),
  action('personal.passcode','Personal Room Passcode Toggle','#personalRequirePasscode','change'),
  action('personal.waiting-room','Personal Room Waiting Room','#personalWaitingRoom','change'),

  action('leave.close','Close Leave Dialog','#leaveClose'),
  action('leave.leave','Leave Meeting','#leaveOnlyBtn'),
  action('leave.end-all','End Meeting for All','#endAllBtn'),
  action('leave.cancel','Cancel Leave','#leaveCancelBtn'),

  action('dock.collapsed','Minimize Participant Dock','[data-dock-view="collapsed"]'),
  action('dock.speaker','Speaker Dock View','[data-dock-view="speaker"]'),
  action('dock.stack','Stack Dock View','[data-dock-view="stack"]'),
  action('dock.grid','Grid Dock View','[data-dock-view="grid"]'),
  action('dock.previous','Previous Participants','#dockUp'),
  action('dock.next','Next Participants','#dockDown'),

  action('dynamic.waiting-admit','Admit Waiting Participant','[data-admit],[data-toast-admit]','click',false,'dynamic'),
  action('dynamic.waiting-decline','Decline Waiting Participant','[data-deny],[data-toast-deny]','click',false,'dynamic'),
  action('dynamic.participant-mic','Participant Microphone Action','[data-quick-mic]','click',false,'dynamic'),
  action('dynamic.participant-video','Participant Video Action','[data-quick-video]','click',false,'dynamic'),
  action('dynamic.participant-more','Participant More Menu','[data-participant]','click',false,'dynamic'),
  action('dynamic.utility-command','Dynamic Utility / Participant Command','#deviceMenu button','click',false,'dynamic'),
  action('dynamic.transcription-command','Transcription Dialog Command','.transcription-dialog button,.transcription-dialog select','click',false,'dynamic'),
  action('dynamic.ai-notes-command','AI Notes Panel Command','.meeting-intelligence-panel button,.meeting-intelligence-panel select','click',false,'dynamic')
]);

const state={
  version:VERSION,
  startedAt:Date.now(),
  lastRunAt:0,
  lastReport:null,
  firstHealthyAt:0,
  consecutiveHealthySamples:0,
  timer:null,
  actionEvents:[],
  actionCounts:new Map(),
  actionOff:[]
};

const now=()=>Date.now();
const guardian=()=>window.DominionGuardianObserver;
const recovery=()=>window.DominionGuardianRecovery;
const resilience=()=>window.DominionGuardianResilience;
const meeting=()=>window.DominionRuntime?.meeting;
const bus=()=>window.DominionRuntime?.events;
const publish=(type,payload={},severity='info',source='guardian-certification')=>bus()?.publish?.({
  type,source,severity,
  meetingId:meeting()?.snapshot?.()?.roomId||'',actorId:meeting()?.snapshot?.()?.participantId||'',payload
});

const result=(id,label,status,detail='',evidence={})=>({id,label,status,detail,evidence});
const worstStatus=checks=>{
  const rank={pass:0,warn:1,fail:2};
  let worst='pass';
  for(const check of checks)if((rank[check.status]||0)>(rank[worst]||0))worst=check.status;
  return worst;
};

const matchAction=event=>{
  const target=event?.target;
  if(!target)return null;
  for(const item of ACTION_CATALOG){
    if(item.event!==event.type)continue;
    let node=null;
    try{
      node=event.type==='submit'?(target.matches?.(item.selector)?target:null):target.closest?.(item.selector);
    }catch(_){node=null;}
    if(node)return {item,node};
  }
  return null;
};

const actionPhase=()=>{
  if(document.body.classList.contains('waiting-room-active'))return 'waiting-room';
  if(document.body.classList.contains('local-presentation-active'))return 'sharing';
  if(document.body.classList.contains('meeting-active'))return 'meeting';
  return 'prejoin';
};

const recordAction=event=>{
  const matched=matchAction(event);
  if(!matched)return;
  const {item,node}=matched;
  const snap=meeting()?.snapshot?.()||{};
  const entry={
    id:item.id,label:item.label,group:item.group,event:event.type,
    timestamp:now(),phase:actionPhase(),
    role:snap.isHost?'host':String(snap.role||'attendee'),
    disabled:Boolean(node.disabled||node.getAttribute?.('aria-disabled')==='true')
  };
  state.actionEvents.push(entry);
  if(state.actionEvents.length>MAX_ACTION_EVENTS)state.actionEvents.splice(0,state.actionEvents.length-MAX_ACTION_EVENTS);
  state.actionCounts.set(item.id,(state.actionCounts.get(item.id)||0)+1);
  publish('guardian.action.invoked',entry,entry.disabled?'warning':'info','guardian-actions');
};

const actionHealth=()=>{
  const required=ACTION_CATALOG.filter(item=>item.required);
  const missing=required.filter(item=>{
    try{return !document.querySelector(item.selector);}catch(_){return true;}
  });
  return {
    status:missing.length?'critical':'healthy',
    version:ACTION_VERSION,
    catalogSize:ACTION_CATALOG.length,
    requiredActions:required.length,
    missingRequired:missing.map(item=>({id:item.id,label:item.label,selector:item.selector})),
    observedActionTypes:state.actionCounts.size,
    invocations:state.actionEvents.length
  };
};

const actionSnapshot=()=>({
  ...actionHealth(),
  counts:Object.fromEntries(state.actionCounts),
  recent:state.actionEvents.slice(-80),
  catalog:ACTION_CATALOG.map(item=>({...item}))
});
const actionCatalog=()=>ACTION_CATALOG.map(item=>({...item}));
const clearActionHistory=()=>{state.actionEvents.length=0;state.actionCounts.clear();return true;};
const actionApi={version:ACTION_VERSION,health:actionHealth,snapshot:actionSnapshot,catalog:actionCatalog,clear:clearActionHistory};

const installActionObserver=()=>{
  if(state.actionOff.length)return;
  for(const type of ['click','submit','change']){
    const handler=event=>recordAction(event);
    document.addEventListener(type,handler,true);
    state.actionOff.push(()=>document.removeEventListener(type,handler,true));
  }
};
const removeActionObserver=()=>state.actionOff.splice(0).forEach(off=>{try{off();}catch(_){}});

const apiChecks=()=>{
  const checks=[];
  const required=[
    ['event-bus','Event Bus',bus(),['publish','on','health']],
    ['meeting-engine','Meeting Engine',meeting(),['health','snapshot','resyncPresence','recoverPeer','recoverPeers','startMedia','toggleAudio','toggleVideo','shareScreen','chat','reaction','transcript']],
    ['guardian-observer','Guardian Observer',guardian(),['health','snapshot','registerService']],
    ['guardian-recovery','Guardian Recovery',recovery(),['health','snapshot']],
    ['guardian-resilience','Guardian Resilience',resilience(),['health','diagnostics']],
    ['guardian-actions','Guardian Action Observer',actionApi,['health','snapshot','catalog']]
  ];
  for(const [id,label,service,methods] of required){
    const missing=!service?methods:methods.filter(name=>typeof service?.[name]!=='function');
    checks.push(result(id,label,missing.length?'fail':'pass',missing.length?`Missing: ${missing.join(', ')}`:'Runtime contract available',{missing}));
  }
  return checks;
};

const featureChecks=()=>{
  const checks=[];
  const ah=actionHealth();
  checks.push(result('action-surface','Complete Meet action surface',ah.missingRequired.length?'fail':'pass',ah.missingRequired.length?`${ah.missingRequired.length} required actions missing`:`${ah.requiredActions} required actions registered`,{catalogSize:ah.catalogSize,requiredActions:ah.requiredActions,missing:ah.missingRequired}));
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
  const ah=actionHealth();
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
  checks.push(result('guardian-actions','Guardian action observer',ah.status==='critical'?'fail':'pass',`${ah.observedActionTypes} action types observed; ${ah.missingRequired.length} required missing`,ah));
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
  return {healthyForMs:state.firstHealthyAt?now()-state.firstHealthyAt:0,targetMs:STABILITY_WINDOW_MS,qualified:Boolean(state.firstHealthyAt&&now()-state.firstHealthyAt>=STABILITY_WINDOW_MS),samples:state.consecutiveHealthySamples};
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
    actions:actionSnapshot(),
    summary:{pass:checks.filter(c=>c.status==='pass').length,warn:checks.filter(c=>c.status==='warn').length,fail:checks.filter(c=>c.status==='fail').length},
    build:window.__DS_MEET_BUILD||'RC10-S16',
    meetingId:meeting()?.snapshot?.()?.roomId||''
  };
  state.lastRunAt=now();state.lastReport=report;
  if(publishEvent)publish('guardian.certification.completed',{status,productionReady:report.productionReady,summary:report.summary,stability,actions:{catalogSize:report.actions.catalogSize,observedActionTypes:report.actions.observedActionTypes,invocations:report.actions.invocations}},status==='fail'?'error':status==='warn'?'warning':'info');
  try{window.dispatchEvent(new CustomEvent('dominion:certification',{detail:report}));}catch(_){}
  return report;
};

const health=()=>{
  const report=state.lastReport||run({publishEvent:false});
  return {status:report.status==='fail'?'critical':report.status==='warn'?'warning':'healthy',version:VERSION,productionReady:report.productionReady,pass:report.summary.pass,warn:report.summary.warn,fail:report.summary.fail,healthyForMs:report.stability.healthyForMs,actionsObserved:report.actions?.invocations||0,actionTypesObserved:report.actions?.observedActionTypes||0};
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
  installActionObserver();
  window.DominionGuardianActions=actionApi;
  window.DominionRuntime=window.DominionRuntime||{};
  window.DominionRuntime.actions=actionApi;
  guardian()?.registerService?.('actions',actionApi);
  guardian()?.registerService?.('certification',api);
  state.timer=setInterval(()=>run({publishEvent:false}),5000);
  run({publishEvent:false});
  publish('guardian.actions.started',{version:ACTION_VERSION,catalogSize:ACTION_CATALOG.length,requiredActions:ACTION_CATALOG.filter(item=>item.required).length},'info','guardian-actions');
  publish('guardian.certification.started',{version:VERSION,stabilityWindowMs:STABILITY_WINDOW_MS});
  return true;
};
const stop=()=>{
  clearInterval(state.timer);state.timer=null;
  removeActionObserver();
  guardian()?.unregisterService?.('actions');
  guardian()?.unregisterService?.('certification');
  return true;
};
const snapshot=()=>state.lastReport||run({publishEvent:false});
const api={version:VERSION,start,stop,run,snapshot,health,exportReport,actionCatalog,actionSnapshot,clearActionHistory};
window.DominionGuardianCertification=api;
window.DominionRuntime=window.DominionRuntime||{};
window.DominionRuntime.certification=api;
window.DominionGuardianActions=actionApi;
window.DominionRuntime.actions=actionApi;
if(!start())document.addEventListener('DOMContentLoaded',start,{once:true});
})();
