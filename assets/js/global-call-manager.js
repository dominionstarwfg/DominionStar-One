(() => {
  if (window.DominionStarGlobalCallManager) return;

  const state = {
    client: null,
    session: null,
    channel: null,
    pending: null,
    callerProfile: null,
    timeout: null,
    initialized: false
  };

  const isMessagesPage = () => location.pathname.startsWith('/direct-messages');
  const PAIR_CHANNEL_PREFIX = 'dominionstar-call';

  const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, character => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'
  }[character]));

  const ensureCommunicationEngine = async () => {
    if (window.CommunicationEngine) return window.CommunicationEngine;
    await new Promise((resolve, reject) => {
      const existing = document.querySelector('script[data-global-communication-engine]');
      if (existing) {
        existing.addEventListener('load', resolve, {once:true});
        existing.addEventListener('error', reject, {once:true});
        return;
      }
      const script = document.createElement('script');
      script.src = '/assets/js/communication-engine.js?v=9.0-executive-3.0-rc2';
      script.async = true;
      script.dataset.globalCommunicationEngine = 'true';
      script.onload = resolve;
      script.onerror = reject;
      document.head.appendChild(script);
    }).catch(() => {});
    return window.CommunicationEngine;
  };

  const injectUi = () => {
    if (document.getElementById('dsGlobalIncomingCall')) return;
    const style = document.createElement('style');
    style.textContent = `
      .ds-global-call{position:fixed;inset:0;z-index:10000;display:grid;place-items:center;background:rgba(2,8,14,.78);backdrop-filter:blur(18px);opacity:0;pointer-events:none;transition:.22s ease}
      .ds-global-call.visible{opacity:1;pointer-events:auto}
      .ds-global-call-card{width:min(420px,calc(100vw - 32px));padding:30px;border:1px solid rgba(255,255,255,.14);border-radius:28px;background:linear-gradient(160deg,rgba(20,33,48,.98),rgba(8,16,27,.98));box-shadow:0 30px 90px rgba(0,0,0,.55);text-align:center;color:#fff}
      .ds-global-call-avatar{width:96px;height:96px;margin:0 auto 16px;display:grid;place-items:center;border-radius:50%;overflow:hidden;border:4px solid #42d982;background:#22354a;color:#f2d477;font:800 28px/1 system-ui;box-shadow:0 0 0 8px rgba(66,217,130,.08)}
      .ds-global-call-avatar img{width:100%;height:100%;object-fit:cover}
      .ds-global-call-card h2{margin:0;font:700 30px/1.15 Georgia,serif}
      .ds-global-call-card p{margin:8px 0 22px;color:#aab7c7}
      .ds-global-call-pulse{width:9px;height:9px;margin:0 auto 14px;border-radius:50%;background:#42d982;box-shadow:0 0 0 0 rgba(66,217,130,.5);animation:dsGlobalPulse 1.5s infinite}
      .ds-global-call-actions{display:grid;grid-template-columns:1fr 1fr;gap:12px}
      .ds-global-call-actions button{min-height:52px;border:0;border-radius:999px;font-weight:800;cursor:pointer}
      .ds-global-call-actions .accept{background:#42d982;color:#062115}
      .ds-global-call-actions .decline{background:#e85b67;color:#fff}
      @keyframes dsGlobalPulse{70%{box-shadow:0 0 0 18px rgba(66,217,130,0)}100%{box-shadow:0 0 0 0 rgba(66,217,130,0)}}
    `;
    document.head.appendChild(style);

    const overlay = document.createElement('section');
    overlay.id = 'dsGlobalIncomingCall';
    overlay.className = 'ds-global-call';
    overlay.setAttribute('aria-hidden', 'true');
    overlay.innerHTML = `
      <div class="ds-global-call-card" role="dialog" aria-modal="true" aria-labelledby="dsGlobalCallerName">
        <div class="ds-global-call-pulse"></div>
        <div id="dsGlobalCallerAvatar" class="ds-global-call-avatar"><span>DS</span></div>
        <h2 id="dsGlobalCallerName">DominionStar Member</h2>
        <p id="dsGlobalCallType">Incoming call</p>
        <div class="ds-global-call-actions">
          <button id="dsGlobalDeclineCall" class="decline" type="button">Decline</button>
          <button id="dsGlobalAcceptCall" class="accept" type="button">Accept</button>
        </div>
      </div>`;
    document.body.appendChild(overlay);

    document.getElementById('dsGlobalAcceptCall').addEventListener('click', accept);
    document.getElementById('dsGlobalDeclineCall').addEventListener('click', decline);
  };

  const initials = name => String(name || 'DS').split(/\s+/).filter(Boolean).slice(0,2).map(part => part[0]).join('').toUpperCase();

  const resolveCaller = async callerId => {
    const result = await state.client
      .from('member_profiles')
      .select('id,full_name,preferred_name,avatar_path')
      .eq('id', callerId)
      .maybeSingle();

    const profile = result.data || {id:callerId, full_name:'DominionStar Member'};
    profile.display_name = profile.preferred_name || profile.full_name || 'DominionStar Member';

    if (profile.avatar_path) {
      const signed = await state.client.storage.from('member-avatars').createSignedUrl(profile.avatar_path, 3600);
      profile.avatar_url = signed.data?.signedUrl || '';
    }
    return profile;
  };

  const renderIncoming = async payload => {
    state.pending = payload;
    sessionStorage.setItem('ds_pending_global_call', JSON.stringify(payload));

    state.callerProfile = await resolveCaller(payload.from);
    const overlay = document.getElementById('dsGlobalIncomingCall');
    const avatar = document.getElementById('dsGlobalCallerAvatar');
    const name = document.getElementById('dsGlobalCallerName');
    const type = document.getElementById('dsGlobalCallType');

    avatar.innerHTML = state.callerProfile.avatar_url
      ? `<img src="${escapeHtml(state.callerProfile.avatar_url)}" alt="${escapeHtml(state.callerProfile.display_name)}">`
      : `<span>${escapeHtml(initials(state.callerProfile.display_name))}</span>`;
    name.textContent = state.callerProfile.display_name;
    type.textContent = payload.callType === 'video' ? 'Incoming video call' : 'Incoming audio call';

    overlay.classList.add('visible');
    overlay.setAttribute('aria-hidden','false');

    const engine = await ensureCommunicationEngine();
    await engine?.init({client:state.client,session:state.session});
    engine?.startLoop('incoming_ring');
    engine?.browserNotify({
      title:`${state.callerProfile.display_name} is calling`,
      body:type.textContent,
      tag:`incoming-call-${payload.from}`,
      actionUrl:`/direct-messages/?member=${encodeURIComponent(payload.from)}&incoming=1`
    });

    clearTimeout(state.timeout);
    state.timeout = setTimeout(() => dismiss('timeout'), 30000);
  };

  const sendPairSignal = async (targetId, signal) => {
    const name = [PAIR_CHANNEL_PREFIX, state.session.user.id, targetId].sort().join('-');
    // Publish on the exact pair channel used by direct-messages.js. A unique
    // response topic cannot be heard by the caller and caused Decline/Timeout
    // actions outside Chat to disappear.
    const channel = state.client.channel(name, {config:{broadcast:{self:false}}});
    await channel.subscribe();
    await channel.send({
      type:'broadcast',
      event:'call-signal',
      payload:{...signal, from:state.session.user.id, to:targetId}
    });
    setTimeout(() => state.client.removeChannel(channel), 1200);
  };

  async function accept() {
    if (!state.pending) return;
    clearTimeout(state.timeout);
    window.CommunicationEngine?.stopAll();
    sessionStorage.setItem('ds_pending_global_call', JSON.stringify({...state.pending, acceptedFromGlobal:true}));
    location.href = `/direct-messages/?member=${encodeURIComponent(state.pending.from)}&incoming=1`;
  }

  async function decline() {
    if (!state.pending) return;
    const pending = state.pending;
    clearTimeout(state.timeout);
    window.CommunicationEngine?.stopAll();
    await sendPairSignal(pending.from, {type:'decline', callType:pending.callType || 'audio'});
    sessionStorage.removeItem('ds_pending_global_call');
    hide();
  }

  async function dismiss(reason) {
    if (!state.pending) return;
    const pending = state.pending;
    window.CommunicationEngine?.stopAll();
    if (reason === 'timeout') {
      await sendPairSignal(pending.from, {type:'hangup', reason:'timeout', callType:pending.callType || 'audio'});
      window.CommunicationEngine?.play('missed_call');
    }
    sessionStorage.removeItem('ds_pending_global_call');
    hide();
  }

  const hide = () => {
    state.pending = null;
    const overlay = document.getElementById('dsGlobalIncomingCall');
    overlay?.classList.remove('visible');
    overlay?.setAttribute('aria-hidden','true');
  };

  const init = async () => {
    if (state.initialized || isMessagesPage()) return;

    // member-auth.js loads this file asynchronously. Some pages initialize auth
    // later than others, so wait briefly instead of permanently returning.
    if (!window.DSAuth?.ready) {
      setTimeout(init, 350);
      return;
    }

    state.client = await window.DSAuth.init();
    state.session = (await state.client?.auth.getSession()).data?.session;
    if (!state.client || !state.session) {
      setTimeout(init, 750);
      return;
    }
    state.initialized = true;

    injectUi();
    await ensureCommunicationEngine();
    await window.CommunicationEngine?.init({client:state.client,session:state.session});

    state.channel = state.client
      .channel(`dominionstar-user-call-${state.session.user.id}`, {config:{broadcast:{self:false}}})
      .on('broadcast', {event:'incoming-call'}, async ({payload}) => {
        if (!payload || payload.to !== state.session.user.id || payload.from === state.session.user.id) return;
        // Ignore a duplicate broadcast for the same WebRTC offer.
        if (state.pending?.from === payload.from && state.pending?.description?.sdp === payload.description?.sdp) return;
        await renderIncoming(payload);
      })
      .on('broadcast', {event:'call-cancelled'}, ({payload}) => {
        if (state.pending && payload?.from === state.pending.from) {
          window.CommunicationEngine?.stopAll();
          sessionStorage.removeItem('ds_pending_global_call');
          hide();
        }
      })
      .subscribe();

    window.addEventListener('beforeunload', () => {
      if (state.channel) state.client.removeChannel(state.channel);
    });
  };

  window.DominionStarGlobalCallManager = {init, accept, decline};
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, {once:true});
  } else {
    init();
  }
})();
