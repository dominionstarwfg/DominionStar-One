(() => {
  'use strict';
  if (window.DominionShareArbitration) return;

  const engine = window.DominionStarMeetingEngine;
  if (!engine?.shareScreen || !engine?.stopScreenShare) return;

  const originalShareScreen = engine.shareScreen.bind(engine);
  const originalStopScreenShare = engine.stopScreenShare.bind(engine);
  const CLAIM_WINDOW_MS = 180;
  const CLAIM_TTL_MS = 2500;
  const state = {
    client: null,
    channel: null,
    channelReady: false,
    channelPromise: null,
    roomId: '',
    activePresenterId: '',
    claims: new Map(),
    localSharePromise: null,
    lastDecision: null
  };

  const snapshot = () => engine.snapshot?.() || {};
  const isPrivileged = snap => Boolean(snap?.isHost || snap?.role === 'host' || snap?.role === 'cohost');
  const now = () => Date.now();
  const participantId = () => String(snapshot().participantId || '');
  const priorityFor = snap => isPrivileged(snap) ? 2 : 1;

  const publishAudit = (type, payload={}) => window.DominionRuntime?.events?.publish?.({
    type,
    source:'meet-share-arbitration',
    meetingId:String(snapshot().roomId || ''),
    actorId:participantId(),
    payload
  });

  const cleanClaims = () => {
    const cutoff = now() - CLAIM_TTL_MS;
    for (const [id, claim] of state.claims) if (Number(claim?.requestedAt || 0) < cutoff) state.claims.delete(id);
  };

  const compareClaims = (a,b) => {
    const priority = Number(b?.priority || 0) - Number(a?.priority || 0);
    if (priority) return priority;
    const time = Number(a?.requestedAt || 0) - Number(b?.requestedAt || 0);
    if (time) return time;
    return String(a?.participantId || '').localeCompare(String(b?.participantId || ''));
  };

  const winningClaim = () => {
    cleanClaims();
    return [...state.claims.values()].sort(compareClaims)[0] || null;
  };

  const createCleanClient = () => {
    const cfg = window.DOMINIONSTAR_SUPABASE || {};
    if (!window.supabase?.createClient || !cfg.url || !cfg.anonKey) return null;
    try {
      return window.supabase.createClient(cfg.url,cfg.anonKey,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
    } catch (_) { return null; }
  };

  const trackPresence = async () => {
    const snap = snapshot();
    if (!state.channel || !snap.participantId) return;
    try {
      await state.channel.track({
        participantId:String(snap.participantId),
        role:String(snap.role || 'attendee'),
        isHost:Boolean(snap.isHost),
        admitted:Boolean(snap.admitted),
        joinedAt:new Date().toISOString()
      });
    } catch (_) {}
  };

  const ensureChannel = async () => {
    const snap = snapshot();
    const roomId = String(snap.roomId || '');
    if (!roomId || !snap.participantId || !snap.admitted) return false;
    if (state.channelReady && state.roomId === roomId) return true;
    if (state.channelPromise && state.roomId === roomId) return state.channelPromise;

    if (state.channel && state.client) {
      try { await state.client.removeChannel(state.channel); } catch (_) {}
    }
    state.client = createCleanClient();
    state.channel = null;
    state.channelReady = false;
    state.roomId = roomId;
    if (!state.client) return false;

    state.channelPromise = new Promise(resolve => {
      let settled = false;
      const finish = value => { if (!settled) { settled = true; resolve(value); } };
      const timeout = setTimeout(()=>finish(false),5000);
      const channel = state.client.channel(`dominionstar-meet-share-arbitration-${roomId}`,{
        config:{broadcast:{self:true,ack:true},presence:{key:String(snap.participantId)}}
      });
      state.channel = channel;
      channel.on('broadcast',{event:'share-claim'},({payload})=>{
        if (!payload?.participantId || String(payload.roomId || '') !== state.roomId) return;
        state.claims.set(String(payload.participantId),{
          participantId:String(payload.participantId),
          priority:Number(payload.priority || 1),
          requestedAt:Number(payload.requestedAt || 0),
          role:String(payload.role || 'attendee')
        });
      });
      channel.on('broadcast',{event:'share-active'},({payload})=>{
        if (String(payload?.roomId || '') !== state.roomId) return;
        state.activePresenterId = payload?.active ? String(payload.participantId || '') : (state.activePresenterId === String(payload.participantId || '') ? '' : state.activePresenterId);
      });
      channel.subscribe(async status => {
        if (status === 'SUBSCRIBED') {
          state.channelReady = true;
          await trackPresence();
          clearTimeout(timeout);
          finish(true);
        }
        if (['CHANNEL_ERROR','TIMED_OUT','CLOSED'].includes(status)) {
          state.channelReady = false;
          clearTimeout(timeout);
          finish(false);
        }
      });
    }).finally(()=>{ state.channelPromise = null; });
    return state.channelPromise;
  };

  const broadcast = async (event,payload={}) => {
    if (!(await ensureChannel()) || !state.channel) return false;
    try {
      await state.channel.send({type:'broadcast',event,payload:{roomId:state.roomId,...payload}});
      return true;
    } catch (_) { return false; }
  };

  const announceActive = async active => {
    const id = participantId();
    if (!id) return false;
    state.activePresenterId = active ? id : (state.activePresenterId === id ? '' : state.activePresenterId);
    return broadcast('share-active',{participantId:id,active:Boolean(active),sentAt:now()});
  };

  const stopCurrentPresenterForInterrupt = async activeId => {
    const snap = snapshot();
    if (!activeId || activeId === String(snap.participantId || '')) return true;
    if (!isPrivileged(snap)) throw new Error('Another participant is already sharing. Wait until they stop sharing.');
    await engine.moderate?.(activeId,'stop-share').catch(()=>{});
    publishAudit('screen.share.interrupt.requested',{activePresenterId:activeId,byRole:snap.role || (snap.isHost?'host':'attendee')});
    await new Promise(resolve=>setTimeout(resolve,220));
    return true;
  };

  const requestShare = async (...args) => {
    if (state.localSharePromise) return state.localSharePromise;
    state.localSharePromise = (async()=>{
      const snap = snapshot();
      const self = String(snap.participantId || '');
      if (!self || !snap.admitted) throw new Error('Join the meeting before sharing your screen.');

      const handoffPresenter = String(window.DominionPresentationHandoff?.snapshot?.().presenterId || '');
      const active = state.activePresenterId || handoffPresenter;
      if (active && active !== self) await stopCurrentPresenterForInterrupt(active);

      if (!(await ensureChannel())) throw new Error('Screen-share coordination is reconnecting. Try Share Screen again in a moment.');

      const claim = {
        participantId:self,
        role:String(snap.role || 'attendee'),
        priority:priorityFor(snap),
        requestedAt:now()
      };
      state.claims.set(self,claim);
      const sent = await broadcast('share-claim',claim);
      if (!sent) throw new Error('Screen-share coordination is unavailable. Try again.');

      await new Promise(resolve=>setTimeout(resolve,CLAIM_WINDOW_MS));
      const winner = winningClaim();
      if (!winner || winner.participantId !== self) {
        const winnerPrivileged = Number(winner?.priority || 0) > Number(claim.priority || 0);
        state.lastDecision = {allowed:false,winner:winner?.participantId || '',reason:winnerPrivileged?'privileged-presenter-won':'another-presenter-won',at:now()};
        publishAudit('screen.share.claim.rejected',state.lastDecision);
        throw new Error(winnerPrivileged ? 'The host or co-host is starting a screen share.' : 'Another participant started sharing first.');
      }

      state.lastDecision = {allowed:true,winner:self,reason:isPrivileged(snap)?'privileged-claim':'first-valid-claim',at:now()};
      publishAudit('screen.share.claim.accepted',state.lastDecision);
      const stream = await originalShareScreen(...args);
      await announceActive(true);
      return stream;
    })().finally(()=>{
      state.claims.delete(participantId());
      state.localSharePromise = null;
    });
    return state.localSharePromise;
  };

  const stopShare = async (...args) => {
    const result = await originalStopScreenShare(...args);
    await announceActive(false);
    return result;
  };

  engine.shareScreen = requestShare;
  engine.stopScreenShare = stopShare;

  engine.on?.('admitted',()=>ensureChannel());
  engine.on?.('connected',()=>ensureChannel());
  engine.on?.('role-change',()=>{ trackPresence(); });
  engine.on?.('screen-stream',()=>announceActive(true));
  engine.on?.('screen-ended',()=>announceActive(false));
  engine.on?.('screen-state',payload=>{
    const remoteId = String(payload?.participantId || '');
    if (!remoteId || remoteId === participantId()) return;
    if (payload.active) {
      const previous = state.activePresenterId;
      state.activePresenterId = remoteId;
      if (previous && previous !== remoteId) publishAudit('screen.share.presenter.changed',{previousPresenterId:previous,nextPresenterId:remoteId,source:'remote-screen-state'});
    } else if (state.activePresenterId === remoteId) {
      state.activePresenterId = '';
    }
  });

  window.addEventListener('dominion:presentation-handoff',event=>{
    const detail = event?.detail || {};
    state.activePresenterId = String(detail.nextPresenterId || '');
  });

  ensureChannel();

  window.DominionShareArbitration = Object.freeze({
    version:'1.0.0',
    policy:Object.freeze({maxSimultaneousShares:1,whoCanInterrupt:'host-cohost-only'}),
    requestShare,
    snapshot:()=>({
      activePresenterId:state.activePresenterId,
      channelReady:state.channelReady,
      roomId:state.roomId,
      lastDecision:state.lastDecision ? {...state.lastDecision} : null,
      winner:winningClaim()?.participantId || ''
    })
  });
})();
