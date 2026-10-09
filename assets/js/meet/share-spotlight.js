(() => {
  'use strict';
  if (window.DominionShareSpotlight) return;

  const engine = window.DominionStarMeetingEngine;
  const menu = document.getElementById('deviceMenu');
  const stage = document.getElementById('stage');
  if (!engine || !menu || !stage) return;

  const state = {
    client: null,
    channel: null,
    channelRoomId: '',
    channelReady: false,
    channelPromise: null,
    members: new Map(),
    remotePresenterId: '',
    activePresenterId: '',
    activePresenterName: '',
    badge: null
  };

  const snapshot = () => engine.snapshot?.() || {};
  const isPrivileged = snap => Boolean(snap?.isHost || snap?.role === 'host' || snap?.role === 'cohost');
  const currentPresenterId = () => {
    const snap = snapshot();
    if (snap.screenStream && snap.participantId) return String(snap.participantId);
    return String(state.remotePresenterId || '');
  };

  const ensureBadge = () => {
    if (state.badge?.isConnected) return state.badge;
    if (getComputedStyle(stage).position === 'static') stage.style.position = 'relative';
    const badge = document.createElement('div');
    badge.className = 'ds-share-spotlight-badge';
    badge.hidden = true;
    badge.setAttribute('role','status');
    badge.setAttribute('aria-live','polite');
    stage.append(badge);
    state.badge = badge;
    return badge;
  };

  const style = document.createElement('style');
  style.textContent = `
    .ds-share-spotlight-badge{position:absolute;left:14px;top:14px;z-index:59;max-width:min(360px,calc(100% - 28px));padding:8px 11px;border:1px solid rgba(232,188,73,.48);border-radius:999px;background:rgba(9,14,23,.86);box-shadow:0 12px 36px rgba(0,0,0,.30);backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px);color:#f8fafc;font:750 11px/1.2 Inter,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;letter-spacing:.02em;pointer-events:none}
    .ds-share-spotlight-badge[hidden]{display:none!important}
    .ds-share-spotlight-action{font-weight:760}
    body.share-spotlight-active #stage{outline:1px solid rgba(232,188,73,.34);outline-offset:-1px}
  `;
  document.head.append(style);

  const applySpotlight = ({presenterId='', presenterName='', active=false, from='', remote=false}={}) => {
    const id = String(presenterId || '');
    const enabled = Boolean(active && id);
    state.activePresenterId = enabled ? id : '';
    state.activePresenterName = enabled ? String(presenterName || '') : '';
    document.body.classList.toggle('share-spotlight-active', enabled);
    document.body.dataset.shareSpotlightParticipantId = enabled ? id : '';
    stage.dataset.shareSpotlight = enabled ? '1' : '0';
    stage.dataset.shareSpotlightParticipantId = enabled ? id : '';
    const badge = ensureBadge();
    badge.hidden = !enabled;
    if (enabled) badge.textContent = state.activePresenterName ? `Spotlighted share · ${state.activePresenterName}` : 'Spotlighted share';
    window.dispatchEvent(new CustomEvent('dominion:share-spotlight',{detail:{presenterId:id,presenterName:state.activePresenterName,active:enabled,from:String(from||''),remote:Boolean(remote)}}));
    return enabled;
  };

  const membersFromPresence = () => {
    const raw = state.channel?.presenceState?.() || {};
    const next = new Map();
    Object.values(raw).flat().forEach(member => {
      if (member?.participantId) next.set(String(member.participantId), member);
    });
    state.members = next;
  };

  const validPrivilegedSender = payload => {
    const snap = snapshot();
    if (!payload?.from || String(payload.roomId||'') !== String(snap.roomId||'')) return null;
    const member = state.members.get(String(payload.from));
    if (!member || member.admitted === false) return null;
    if (!(member.isHost || member.role === 'host' || member.role === 'cohost')) return null;
    return member;
  };

  const handleRemote = payload => {
    const member = validPrivilegedSender(payload);
    if (!member) return;
    const active = Boolean(payload.active);
    const presenterId = String(payload.presenterId || '');
    if (active && !presenterId) return;
    applySpotlight({presenterId, presenterName:String(payload.presenterName||''), active, from:String(payload.from), remote:true});
  };

  const createCleanClient = () => {
    const cfg = window.DOMINIONSTAR_SUPABASE || {};
    if (!window.supabase?.createClient || !cfg.url || !cfg.anonKey) return null;
    try {
      return window.supabase.createClient(cfg.url,cfg.anonKey,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
    } catch (_) { return null; }
  };

  const ensureChannel = async () => {
    const snap = snapshot();
    if (!snap.roomId || !snap.participantId || !snap.admitted) return false;
    if (state.channelReady && state.channelRoomId === String(snap.roomId)) return true;
    if (state.channelPromise && state.channelRoomId === String(snap.roomId)) return state.channelPromise;

    if (state.channel && state.client) {
      try { await state.client.removeChannel(state.channel); } catch (_) {}
    }
    state.channel = null;
    state.channelReady = false;
    state.channelRoomId = String(snap.roomId);
    state.client = createCleanClient();
    if (!state.client) return false;

    state.channelPromise = new Promise(resolve => {
      let settled = false;
      const finish = value => { if (!settled) { settled=true; resolve(value); } };
      const timeout = setTimeout(()=>finish(false),5000);
      const channel = state.client.channel(`dominionstar-meet-share-spotlight-${snap.roomId}`,{config:{broadcast:{self:false,ack:true},presence:{key:snap.participantId}}});
      state.channel = channel;
      channel.on('broadcast',{event:'share-spotlight'},({payload})=>handleRemote(payload));
      channel.on('presence',{event:'sync'},membersFromPresence);
      channel.subscribe(async status => {
        if (status === 'SUBSCRIBED') {
          state.channelReady = true;
          try {
            await channel.track({participantId:snap.participantId,displayName:snap.displayName||'',isHost:Boolean(snap.isHost),role:snap.role||'attendee',admitted:Boolean(snap.admitted),joinedAt:new Date().toISOString()});
          } catch (_) {}
          membersFromPresence();
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

  const setSpotlight = async (active, presenterId=currentPresenterId(), presenterName='') => {
    const snap = snapshot();
    if (!isPrivileged(snap)) return false;
    const target = String(presenterId || '');
    if (active && !target) return false;
    if (!(await ensureChannel()) || !state.channel) return false;
    const payload = {
      roomId:String(snap.roomId||''),
      from:String(snap.participantId||''),
      presenterId:target,
      presenterName:String(presenterName||''),
      active:Boolean(active),
      sentAt:Date.now()
    };
    applySpotlight({...payload,remote:false});
    try {
      await state.channel.send({type:'broadcast',event:'share-spotlight',payload});
      return true;
    } catch (_) {
      return false;
    }
  };

  const toggleCurrent = async () => {
    const presenterId = currentPresenterId();
    if (!presenterId) return false;
    const active = state.activePresenterId === presenterId;
    const status = document.getElementById('shareStatusText')?.textContent || '';
    const presenterName = status.replace(/\s+is sharing$/i,'').replace(/^You are sharing$/i,snapshot().displayName||'You');
    return setSpotlight(!active,presenterId,presenterName);
  };

  const addMenuAction = body => {
    if (!body || body.querySelector('[data-ds-share-spotlight-action="1"]')) return;
    const snap = snapshot();
    const presenterId = currentPresenterId();
    if (!isPrivileged(snap) || !presenterId || !document.body.classList.contains('presentation-active')) return;
    const item = document.createElement('button');
    item.type = 'button';
    item.className = 'device-menu-item ds-share-spotlight-action';
    item.dataset.dsShareSpotlightAction = '1';
    item.setAttribute('role','menuitem');
    const active = state.activePresenterId === presenterId;
    item.textContent = active ? 'Remove share spotlight' : 'Spotlight this share';
    item.addEventListener('click',async event=>{
      event.preventDefault();
      event.stopPropagation();
      await toggleCurrent();
      menu.hidden = true;
    });
    body.append(item);
  };

  const enhanceMenu = () => {
    const title = menu.querySelector('.menu-title')?.textContent?.trim();
    const body = menu.querySelector('.utility-menu-body') || menu;
    if (title === 'Shared Screen') addMenuAction(body);
    if (title === 'More' && document.body.classList.contains('local-presentation-active')) addMenuAction(body);
  };

  new MutationObserver(()=>{ if (!menu.hidden) queueMicrotask(enhanceMenu); }).observe(menu,{childList:true,subtree:true,attributes:true,attributeFilter:['hidden']});
  new MutationObserver(()=>{
    if (!document.body.classList.contains('presentation-active') && state.activePresenterId) applySpotlight({active:false});
    if (!menu.hidden) queueMicrotask(enhanceMenu);
  }).observe(document.body,{attributes:true,attributeFilter:['class']});

  engine.on?.('admitted',()=>ensureChannel());
  engine.on?.('connected',()=>ensureChannel());
  engine.on?.('role-change',()=>{ ensureChannel(); if (!menu.hidden) queueMicrotask(enhanceMenu); });
  engine.on?.('screen-state',payload=>{
    const participantId = String(payload?.participantId || '');
    if (!participantId) return;
    if (payload.active) state.remotePresenterId = participantId;
    else if (state.remotePresenterId === participantId) state.remotePresenterId = '';
    if (!payload.active && state.activePresenterId === participantId) applySpotlight({active:false});
  });
  engine.on?.('screen-stream',()=>{ if (!menu.hidden) queueMicrotask(enhanceMenu); });
  engine.on?.('screen-ended',()=>{
    const snap = snapshot();
    if (!document.body.classList.contains('presentation-active') || state.activePresenterId === String(snap.participantId||'')) applySpotlight({active:false});
  });
  window.addEventListener('dominion:presentation-handoff',event=>{
    const previous = String(event.detail?.previousPresenterId || '');
    if (previous && state.activePresenterId === previous) applySpotlight({active:false});
  });

  ensureBadge();
  ensureChannel();

  window.DominionShareSpotlight = Object.freeze({
    version:'1.1.0',
    toggleCurrent,
    set:(presenterId,presenterName='')=>setSpotlight(true,presenterId,presenterName),
    clear:()=>setSpotlight(false,state.activePresenterId,''),
    canManage:()=>isPrivileged(snapshot()),
    snapshot:()=>({activePresenterId:state.activePresenterId,activePresenterName:state.activePresenterName,currentPresenterId:currentPresenterId(),channelReady:state.channelReady,roomId:state.channelRoomId})
  });
})();
