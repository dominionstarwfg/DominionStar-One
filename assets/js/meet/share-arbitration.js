(() => {
  'use strict';
  if (window.DominionShareArbitration) return;

  const engine = window.DominionStarMeetingEngine;
  if (!engine) return;

  const CLAIM_WINDOW_MS = 260;
  const LEASE_STALE_MS = 12000;
  const state = {
    client:null, channel:null, channelRoomId:'', channelReady:false, channelPromise:null,
    members:new Map(), claims:new Map(), lease:null, sequence:0
  };

  const snapshot = () => engine.snapshot?.() || {};
  const normalizeRole = snap => snap?.isHost || snap?.role === 'host' ? 'host' : snap?.role === 'cohost' ? 'cohost' : 'attendee';
  const rankRole = role => role === 'host' ? 3 : role === 'cohost' ? 2 : 1;
  const isPrivileged = snap => rankRole(normalizeRole(snap)) >= 2;
  const now = () => Date.now();
  const validLease = () => state.lease && (now() - Number(state.lease.claimedAt || 0) < LEASE_STALE_MS) ? state.lease : null;

  const publishState = (reason='state') => {
    const lease = validLease();
    if (!lease) state.lease = null;
    document.body.dataset.shareLeaseParticipantId = lease?.participantId || '';
    document.body.dataset.shareLeaseSequence = String(lease?.sequence || 0);
    window.dispatchEvent(new CustomEvent('dominion:share-arbitration',{detail:{reason,lease:lease?{...lease}:null}}));
  };

  const membersFromPresence = () => {
    const raw = state.channel?.presenceState?.() || {};
    const next = new Map();
    Object.values(raw).flat().forEach(member => {
      if (member?.participantId) next.set(String(member.participantId), member);
    });
    state.members = next;
  };

  const verifiedMember = participantId => {
    const member = state.members.get(String(participantId || ''));
    if (!member || member.admitted === false) return null;
    return member;
  };

  const compareClaims = (a,b) => {
    const rankDiff = rankRole(String(b.role||'attendee')) - rankRole(String(a.role||'attendee'));
    if (rankDiff) return rankDiff;
    const timeDiff = Number(a.claimedAt||0) - Number(b.claimedAt||0);
    if (timeDiff) return timeDiff;
    return String(a.participantId||'').localeCompare(String(b.participantId||''));
  };

  const recomputeLease = (reason='claim') => {
    const cutoff = now() - CLAIM_WINDOW_MS * 3;
    for (const [id,claim] of state.claims) if (Number(claim.claimedAt||0) < cutoff) state.claims.delete(id);
    const incumbent = validLease();
    if (incumbent && !state.claims.size) return incumbent;
    const candidates = [...state.claims.values()].filter(claim => verifiedMember(claim.participantId));
    if (incumbent) candidates.push(incumbent);
    if (!candidates.length) { state.lease=null; publishState(reason); return null; }
    candidates.sort(compareClaims);
    const winner = candidates[0];
    state.lease = {...winner};
    publishState(reason);
    return state.lease;
  };

  const handleRemote = payload => {
    if (!payload || String(payload.roomId||'') !== String(snapshot().roomId||'')) return;
    const member = verifiedMember(payload.from);
    if (!member) return;
    if (payload.type === 'release') {
      if (state.lease?.participantId === String(payload.participantId||payload.from)) {
        state.lease = null;
        state.claims.delete(String(payload.participantId||payload.from));
        publishState('remote-release');
      }
      return;
    }
    if (payload.type !== 'claim') return;
    const participantId = String(payload.participantId||payload.from||'');
    if (!participantId || participantId !== String(payload.from||'')) return;
    const role = member.isHost || member.role === 'host' ? 'host' : member.role === 'cohost' ? 'cohost' : 'attendee';
    state.claims.set(participantId,{participantId,role,claimedAt:Number(payload.claimedAt||now()),sequence:Number(payload.sequence||0)});
    setTimeout(()=>recomputeLease('remote-claim'),CLAIM_WINDOW_MS);
  };

  const createClient = () => {
    const cfg = window.DOMINIONSTAR_SUPABASE || {};
    if (!window.supabase?.createClient || !cfg.url || !cfg.anonKey) return null;
    try { return window.supabase.createClient(cfg.url,cfg.anonKey,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}}); }
    catch (_) { return null; }
  };

  const ensureChannel = async () => {
    const snap = snapshot();
    if (!snap.roomId || !snap.participantId || !snap.admitted) return false;
    if (state.channelReady && state.channelRoomId === String(snap.roomId)) return true;
    if (state.channelPromise && state.channelRoomId === String(snap.roomId)) return state.channelPromise;
    if (state.channel && state.client) try { await state.client.removeChannel(state.channel); } catch (_) {}
    state.channelReady=false; state.channelRoomId=String(snap.roomId); state.client=createClient();
    if (!state.client) return false;
    state.channelPromise = new Promise(resolve => {
      let settled=false;
      const finish=value=>{if(!settled){settled=true;resolve(value);}};
      const timer=setTimeout(()=>finish(false),5000);
      const channel=state.client.channel(`dominionstar-meet-share-arbitration-${snap.roomId}`,{config:{broadcast:{self:false,ack:true},presence:{key:snap.participantId}}});
      state.channel=channel;
      channel.on('broadcast',{event:'share-arbitration'},({payload})=>handleRemote(payload));
      channel.on('presence',{event:'sync'},membersFromPresence);
      channel.subscribe(async status=>{
        if(status==='SUBSCRIBED'){
          state.channelReady=true;
          try{await channel.track({participantId:snap.participantId,displayName:snap.displayName||'',isHost:Boolean(snap.isHost),role:snap.role||'attendee',admitted:Boolean(snap.admitted),joinedAt:new Date().toISOString()});}catch(_){}
          membersFromPresence();clearTimeout(timer);finish(true);
        }
        if(['CHANNEL_ERROR','TIMED_OUT','CLOSED'].includes(status)){state.channelReady=false;clearTimeout(timer);finish(false);}
      });
    }).finally(()=>{state.channelPromise=null;});
    return state.channelPromise;
  };

  const requestStart = async () => {
    const snap=snapshot();
    if (!(await ensureChannel()) || !state.channel) return {ok:false,reason:'arbitration-unavailable'};
    const existing=validLease();
    if (existing && existing.participantId !== String(snap.participantId||'')) return {ok:false,reason:'presenter-active',presenterId:existing.participantId,canTakeOver:isPrivileged(snap)};
    state.sequence += 1;
    const claim={participantId:String(snap.participantId||''),role:normalizeRole(snap),claimedAt:now(),sequence:state.sequence};
    state.claims.set(claim.participantId,claim);
    try { await state.channel.send({type:'broadcast',event:'share-arbitration',payload:{type:'claim',roomId:String(snap.roomId||''),from:claim.participantId,...claim}}); } catch (_) { return {ok:false,reason:'claim-send-failed'}; }
    await new Promise(resolve=>setTimeout(resolve,CLAIM_WINDOW_MS+40));
    const winner=recomputeLease('local-claim');
    return winner?.participantId === claim.participantId ? {ok:true,lease:{...winner}} : {ok:false,reason:'claim-lost',presenterId:winner?.participantId||''};
  };

  const release = async participantId=String(snapshot().participantId||'')) => {
    const id=String(participantId||'');
    if (!id) return false;
    state.claims.delete(id);
    if (state.lease?.participantId === id) state.lease=null;
    publishState('local-release');
    if (state.channelReady && state.channel) {
      try { await state.channel.send({type:'broadcast',event:'share-arbitration',payload:{type:'release',roomId:String(snapshot().roomId||''),from:String(snapshot().participantId||''),participantId:id,sentAt:now()}}); } catch (_) {}
    }
    return true;
  };

  const acceptIncoming = participantId => {
    const id=String(participantId||'');
    if (!id) return false;
    const lease=validLease();
    if (!lease) {
      const member=verifiedMember(id);
      state.lease={participantId:id,role:member?.isHost||member?.role==='host'?'host':member?.role==='cohost'?'cohost':'attendee',claimedAt:now(),sequence:0};
      publishState('legacy-adopt');
      return true;
    }
    return lease.participantId === id;
  };

  engine.on?.('admitted',ensureChannel);
  engine.on?.('connected',ensureChannel);
  engine.on?.('screen-ended',()=>release(String(snapshot().participantId||'')));
  engine.on?.('screen-state',payload=>{if(payload?.active===false&&state.lease?.participantId===String(payload.participantId||''))release(String(payload.participantId||''));});
  window.addEventListener('dominion:presentation-handoff',event=>{
    if (!event?.detail?.nextPresenterId && state.lease?.participantId) release(state.lease.participantId);
  });

  const handoff=window.DominionPresentationHandoff?.snapshot?.();
  if (handoff?.presenterId) state.lease={participantId:String(handoff.presenterId),role:'attendee',claimedAt:now(),sequence:0};
  publishState('bootstrap');
  ensureChannel();

  window.DominionShareArbitration=Object.freeze({
    version:'1.0.0', requestStart, release, acceptIncoming,
    canTakeOver:()=>isPrivileged(snapshot()),
    snapshot:()=>({lease:validLease()?{...state.lease}:null,channelReady:state.channelReady,roomId:state.channelRoomId})
  });
})();