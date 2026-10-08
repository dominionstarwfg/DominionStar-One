(()=>{
  'use strict';
  if(window.DominionPhysicalDiagnostics)return;

  const desktop=window.dominionDesktop||{};
  const MAX_SAMPLES=1200;
  const MAX_EVENTS=1200;
  const MAX_ORDER_CHANGES=400;
  const nodeIds=new WeakMap();
  let nextNodeId=1;
  let timer=0,metricsTimer=0,rosterObserver=null,observedRoster=null;
  let lastOrder='',lastTick=performance.now(),lastMetrics=[];
  let lastMutationTotals={total:0,childList:0,attributes:0,text:0};

  const state={
    version:'2.0.54-on-demand-physical-recorder',
    startedAt:0,
    samples:[],
    events:[],
    orderChanges:[],
    mutations:{total:0,childList:0,attributes:0,text:0}
  };

  const q=s=>document.querySelector(s);
  const now=()=>Date.now();
  const pushBounded=(list,value,max)=>{list.push(value);if(list.length>max)list.splice(0,list.length-max);};
  const idFor=node=>{if(!node)return 0;if(!nodeIds.has(node))nodeIds.set(node,nextNodeId++);return nodeIds.get(node)||0;};
  const cleanText=value=>String(value||'').replace(/\s+/g,' ').trim().slice(0,240);
  const safeRect=node=>{
    if(!node)return null;
    try{const r=node.getBoundingClientRect();return {x:Math.round(r.x),y:Math.round(r.y),width:Math.round(r.width),height:Math.round(r.height)};}catch{return null;}
  };
  const safeError=error=>String(error?.stack||error?.message||error||'unknown').slice(0,4000);

  function record(type,detail={}){
    let payload={};
    try{payload=JSON.parse(JSON.stringify(detail??{}));}catch{payload={detail:String(detail||'')};}
    pushBounded(state.events,{at:now(),type:String(type||'event'),detail:payload},MAX_EVENTS);
  }

  function participantOrder(){
    return [...document.querySelectorAll('#participantRoster [data-participant-id]')].map(row=>String(row.dataset.participantId||'')).join('|');
  }

  function attachRosterObserver(){
    const roster=q('#participantRoster');
    if(roster===observedRoster)return;
    try{rosterObserver?.disconnect?.();}catch{}
    observedRoster=roster;lastOrder=participantOrder();
    if(!roster)return;
    rosterObserver=new MutationObserver(records=>{
      state.mutations.total+=records.length;
      for(const item of records){
        if(item.type==='childList')state.mutations.childList++;
        else if(item.type==='attributes')state.mutations.attributes++;
        else if(item.type==='characterData')state.mutations.text++;
      }
    });
    rosterObserver.observe(roster,{subtree:true,childList:true,attributes:true,characterData:true});
    record('roster-observer-attached',{nodeId:idFor(roster)});
  }

  function tracksFor(stream){
    try{return [...(stream?.getTracks?.()||[])].map(track=>({
      id:String(track.id||''),
      kind:String(track.kind||''),
      enabled:Boolean(track.enabled),
      muted:Boolean(track.muted),
      readyState:String(track.readyState||''),
      label:String(track.label||'').slice(0,120)
    }));}catch{return [];}
  }

  function rowState(row){
    return {
      nodeId:idFor(row),
      id:String(row.dataset.participantId||''),
      name:String(row.dataset.participantName||''),
      role:String(row.dataset.participantRole||''),
      self:String(row.dataset.participantSelf||''),
      adaptiveSelf:String(row.dataset.dsAdaptiveSelf||''),
      hidden:Boolean(row.hidden),
      speaking:row.classList.contains('participant-speaking'),
      micOn:Boolean(row.querySelector('[data-participant-mic].on')),
      videoOn:Boolean(row.querySelector('[data-participant-video].on')),
      text:cleanText(row.textContent)
    };
  }

  function dockTileState(tile){
    const video=tile.querySelector('video');
    const fallback=tile.querySelector('.remote-peer-fallback,.video-fallback');
    const avatar=tile.querySelector('.fallback-avatar,.remote-peer-fallback img');
    const initials=tile.querySelector('.video-fallback span,.remote-peer-fallback span');
    const stream=video?.srcObject||null;
    return {
      nodeId:idFor(tile),
      id:String(tile.dataset.participantId||tile.dataset.peerId||''),
      self:String(tile.dataset.participantSelf||''),
      hidden:Boolean(tile.hidden),
      cameraOn:String(tile.dataset.cameraOn||''),
      micOn:String(tile.dataset.micOn||''),
      videoHidden:Boolean(video?.hidden),
      hasStream:Boolean(stream),
      videoWidth:Number(video?.videoWidth)||0,
      videoHeight:Number(video?.videoHeight)||0,
      tracks:tracksFor(stream),
      fallbackHidden:Boolean(fallback?.hidden),
      avatarHidden:Boolean(avatar?.hidden),
      initialsHidden:Boolean(initials?.hidden)
    };
  }

  function captureSample(){
    attachRosterObserver();
    const perf=performance.now(),drift=Math.max(0,perf-lastTick-250);lastTick=perf;
    const order=participantOrder();
    if(order!==lastOrder){
      pushBounded(state.orderChanges,{at:now(),from:lastOrder,to:order},MAX_ORDER_CHANGES);
      lastOrder=order;
    }
    const mutationDelta={
      total:state.mutations.total-lastMutationTotals.total,
      childList:state.mutations.childList-lastMutationTotals.childList,
      attributes:state.mutations.attributes-lastMutationTotals.attributes,
      text:state.mutations.text-lastMutationTotals.text
    };
    lastMutationTotals={...state.mutations};

    let media={},share={},localStream=null;
    try{media=window.DominionMediaController?.snapshot?.()||{};}catch{}
    try{share=window.DominionShareController?.snapshot?.()||{};}catch{}
    try{localStream=window.DominionMediaController?.stream?.()||null;}catch{}

    const side=q('.room-side'),dock=q('#participantVideoDock');
    const rows=[...document.querySelectorAll('#participantRoster [data-participant-id]')].map(rowState);
    const dockTiles=[...document.querySelectorAll('#participantVideoDock .remote-peer-tile')].map(dockTileState);
    pushBounded(state.samples,{
      at:now(),
      driftMs:Math.round(drift),
      mutationDelta,
      order,
      participantPanel:{
        hidden:Boolean(side?.hidden),
        rect:safeRect(side),
        rowCount:rows.length,
        rows
      },
      media:{
        micOn:Boolean(media.micOn),
        cameraOn:Boolean(media.cameraOn),
        videoLive:Boolean(media.videoLive),
        cameraId:String(media.cameraId||''),
        mirror:media.mirror!==false,
        tracks:tracksFor(localStream)
      },
      share:{
        active:Boolean(share.active),
        paused:Boolean(share.paused),
        busy:Boolean(share.busy),
        sourceName:String(share.sourceName||'').slice(0,160),
        annotating:Boolean(share.annotating)
      },
      videoDock:{
        hidden:Boolean(dock?.hidden),
        rect:safeRect(dock),
        tileCount:dockTiles.length,
        tiles:dockTiles
      },
      processMetrics:lastMetrics,
      versions:{
        runtime:String(window.DominionRuntimeStability?.version||''),
        participants:String(window.DominionZoomParticipantsReference2041?.version||''),
        physical:String(window.DominionZoomPhysicalAcceptance?.version||''),
        parity:String(window.DominionMeetingParity?.version||'')
      }
    },MAX_SAMPLES);
  }

  async function sampleSystem(){
    try{
      const metrics=await desktop.diagnostics?.system?.();
      if(Array.isArray(metrics))lastMetrics=metrics;
    }catch(error){record('system-metrics-error',{error:safeError(error)});}
  }

  function start(){
    if(timer)return true;
    state.startedAt=now();lastTick=performance.now();
    attachRosterObserver();captureSample();void sampleSystem();
    timer=setInterval(captureSample,250);
    metricsTimer=setInterval(()=>void sampleSystem(),1000);
    record('recorder-started',{href:String(location.href||'')});
    return true;
  }

  function stop(){
    if(timer){clearInterval(timer);timer=0;}
    if(metricsTimer){clearInterval(metricsTimer);metricsTimer=0;}
    try{rosterObserver?.disconnect?.();}catch{}
    rosterObserver=null;observedRoster=null;
    record('recorder-stopped',{});
    return true;
  }

  async function exportReport(){
    captureSample();
    await sampleSystem();
    let environment=null;
    try{environment=await desktop.environment?.();}catch{}
    const roster=q('#participantRoster'),dock=q('#participantVideoDock');
    const report={
      product:'DominionStar Meet',
      diagnosticVersion:state.version,
      exportedAt:new Date().toISOString(),
      environment,
      navigator:{
        platform:String(navigator.platform||''),
        userAgent:String(navigator.userAgent||'')
      },
      recording:{
        active:Boolean(timer),
      startedAt:state.startedAt,
        durationMs:Math.max(0,now()-state.startedAt),
        mutationTotals:{...state.mutations},
        orderChanges:[...state.orderChanges],
        events:[...state.events],
        samples:[...state.samples]
      },
      finalDom:{
        participantRoster:roster?.outerHTML?.slice(0,250000)||'',
        participantVideoDock:dock?.outerHTML?.slice(0,250000)||'',
        bodyClasses:String(document.body.className||'')
      },
      finalSystemMetrics:lastMetrics
    };
    const result=await desktop.diagnostics?.export?.(report);
    if(result?.ok){
      record('report-exported',{fileName:result.fileName,bytes:result.bytes});
      try{window.DominionMeetingNotifications?.toast?.('Diagnostic report saved to Downloads.');}catch{}
    }else{
      record('report-export-failed',{error:String(result?.error||'unknown')});
      try{window.DominionMeetingNotifications?.toast?.('Could not export diagnostic report.','error');}catch{}
    }
    return result;
  }

  window.addEventListener('dominion:meeting-ui-ready',()=>{if(timer){attachRosterObserver();record('meeting-ui-ready',{});}},true);
  window.addEventListener('dominion:meeting-snapshot',event=>{if(timer)record('meeting-snapshot',{participants:Array.isArray(event.detail?.participants)?event.detail.participants.length:undefined});},true);
  window.addEventListener('dominion:active-speakers',event=>{if(timer)record('active-speakers',{participantIds:Array.isArray(event.detail?.participantIds)?event.detail.participantIds.map(String):[]});},true);
  window.addEventListener('dominion:presenter-command-dispatch',event=>{if(timer)record('presenter-command-dispatch',{command:String(event.detail?.command||''),qaCommandId:Number(event.detail?.qaCommandId||0)});},true);
  window.addEventListener('dominion:meeting-ended',()=>{if(timer)record('meeting-ended',{});},true);
  window.addEventListener('error',event=>record('window-error',{message:String(event.message||''),filename:String(event.filename||''),line:Number(event.lineno)||0,column:Number(event.colno)||0}),true);
  window.addEventListener('unhandledrejection',event=>record('unhandled-rejection',{error:safeError(event.reason)}),true);
  document.addEventListener('click',event=>{
    const control=event.target?.closest?.('#roomMic,#roomCamera,#roomShare,#roomParticipants,#roomChat,#roomReactions,#roomMore,[data-inline-command]');
    if(timer&&control)record('meeting-control-click',{id:String(control.id||''),command:String(control.dataset?.inlineCommand||''),label:cleanText(control.textContent)});
  },true);

  // Diagnostics are opt-in. Production must remain idle until start() is explicitly requested.
  window.DominionPhysicalDiagnostics=Object.freeze({
    version:state.version,
    start,stop,record,exportReport,
    snapshot:()=>({
      startedAt:state.startedAt,
      sampleCount:state.samples.length,
      eventCount:state.events.length,
      mutationTotals:{...state.mutations},
      orderChanges:[...state.orderChanges]
    })
  });
})();