(() => {
  const state = { client:null, session:null, context:null, loops:new Map(), badge:0, channel:null, activeConversationMember:'' };
  const settings = () => ({
    sounds: localStorage.getItem('ds_comm_sounds') !== 'off',
    browser: localStorage.getItem('ds_browser_notifications') === 'on'
  });
  const ensureContext = () => {
    if (!window.AudioContext && !window.webkitAudioContext) return null;
    state.context ||= new (window.AudioContext || window.webkitAudioContext)();
    if (state.context.state === 'suspended') state.context.resume().catch(()=>{});
    return state.context;
  };
  const note = (frequency, duration=.14, delay=0, gainValue=.045, type='sine') => {
    if (!settings().sounds) return;
    const ctx=ensureContext(); if(!ctx) return;
    const osc=ctx.createOscillator(), gain=ctx.createGain(); osc.type=type; osc.frequency.value=frequency;
    osc.connect(gain); gain.connect(ctx.destination); const t=ctx.currentTime+delay;
    gain.gain.setValueAtTime(.0001,t); gain.gain.exponentialRampToValueAtTime(gainValue,t+.012); gain.gain.exponentialRampToValueAtTime(.0001,t+duration);
    osc.start(t); osc.stop(t+duration+.02);
  };
  const play = kind => {
    const patterns={
      message_received:[[784,.12,0],[1046,.12,.11]], message_sent:[[520,.09,0],[660,.09,.08]],
      call_connected:[[660,.12,0],[880,.16,.12]], call_ended:[[520,.12,0],[360,.16,.12]],
      call_declined:[[320,.18,0],[260,.22,.18]], missed_call:[[880,.12,0],[660,.12,.15],[440,.18,.3]],
      priority:[[880,.1,0],[1174,.13,.12],[880,.18,.27]], meeting:[[660,.12,0],[880,.12,.13],[1046,.18,.26]]
    };
    (patterns[kind]||patterns.message_received).forEach(([f,d,l])=>note(f,d,l));
  };
  const startLoop = kind => {
    stopLoop(kind); if(!settings().sounds) return;
    const run=()=>{
      if(kind==='incoming_ring') { note(740,.28,0,.06); note(880,.28,.35,.06); }
      else { note(440,.4,0,.035); note(480,.4,.55,.035); }
    };
    run(); state.loops.set(kind,setInterval(run, kind==='incoming_ring'?2300:2600));
  };
  const stopLoop = kind => { const id=state.loops.get(kind); if(id) clearInterval(id); state.loops.delete(kind); };
  const stopAll = () => [...state.loops.keys()].forEach(stopLoop);
  const safeActionUrl = candidate => {
    if (typeof candidate !== 'string') return '/notifications/';
    try {
      const parsed=new URL(candidate,window.location.origin);
      if(parsed.origin!==window.location.origin)return '/notifications/';
      return `${parsed.pathname}${parsed.search}${parsed.hash}` || '/notifications/';
    } catch(_error) { return '/notifications/'; }
  };
  const toast = ({title,body='',type='info',actionUrl=''}) => {
    let region=document.getElementById('genesisToastRegion');
    if(!region){ region=document.createElement('div'); region.id='genesisToastRegion'; region.className='genesis-toast-region'; document.body.appendChild(region); }
    const safeUrl=actionUrl?safeActionUrl(actionUrl):'';
    const item=document.createElement(safeUrl?'a':'article'); if(safeUrl) item.href=safeUrl;
    item.className=`genesis-toast ${type}`; item.innerHTML=`<span></span><div><strong>${escapeHtml(title)}</strong><small>${escapeHtml(body)}</small></div><button type="button" aria-label="Dismiss">×</button>`;
    item.querySelector('button').onclick=e=>{e.preventDefault();item.remove()}; region.prepend(item); requestAnimationFrame(()=>item.classList.add('show')); setTimeout(()=>item.remove(),7000);
  };
  const escapeHtml=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
  const setBadge = value => {
    state.badge=Math.max(0,Number(value)||0);
    document.querySelectorAll('[data-communication-badge],#notificationCount').forEach(el=>{el.textContent=state.badge;el.classList.toggle('member-hidden',!state.badge)});
    if('setAppBadge' in navigator){ state.badge?navigator.setAppBadge(state.badge).catch(()=>{}):navigator.clearAppBadge().catch(()=>{}); }
  };
  const urlBase64ToUint8Array = value => {
    const padding='='.repeat((4-value.length%4)%4);
    const base64=(value+padding).replace(/-/g,'+').replace(/_/g,'/');
    const raw=atob(base64);
    return Uint8Array.from([...raw].map(char=>char.charCodeAt(0)));
  };
  const pushSupport = () => (
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  );
  const enablePushSubscription = async () => {
    if(window.DOMINIONSTAR_NOTIFICATION_FEATURES?.webPush!==true)return {status:'not_enabled'};
    if(!pushSupport())return {status:'unsupported'};
    if(!state.client||!state.session?.user?.id)return {status:'not_ready'};
    if(Notification.permission!=='granted')return {status:'permission_required'};

    const registration=await navigator.serviceWorker.register('/sw.js');
    const keyResponse=await fetch('/.netlify/functions/push-public-key',{headers:{accept:'application/json'}});
    if(!keyResponse.ok)throw new Error('Push delivery is not configured yet.');
    const keyData=await keyResponse.json();
    if(!keyData?.publicKey)throw new Error('Push public key is unavailable.');

    let subscription=await registration.pushManager.getSubscription();
    if(!subscription){
      subscription=await registration.pushManager.subscribe({
        userVisibleOnly:true,
        applicationServerKey:urlBase64ToUint8Array(keyData.publicKey)
      });
    }

    const payload=subscription.toJSON();
    const registered=await state.client.rpc('register_my_push_subscription',{
      target_endpoint:subscription.endpoint,
      target_p256dh:payload.keys?.p256dh||'',
      target_auth:payload.keys?.auth||'',
      target_user_agent:navigator.userAgent.slice(0,500)
    });
    if(registered.error)throw registered.error;
    localStorage.setItem('ds_browser_notifications','on');
    return {status:'subscribed',subscription};
  };
  const disablePushSubscription = async () => {
    localStorage.setItem('ds_browser_notifications','off');
    if(!pushSupport())return {status:'unsupported'};
    const registration=await navigator.serviceWorker.getRegistration('/').catch(()=>null);
    const subscription=await registration?.pushManager?.getSubscription?.();
    if(subscription&&state.client&&state.session?.user?.id){
      await state.client.rpc('remove_my_push_subscription',{target_endpoint:subscription.endpoint}).catch(()=>{});
      await subscription.unsubscribe().catch(()=>{});
    }
    return {status:'disabled'};
  };
  const browserNotify = async ({title,body='',tag='',actionUrl='/',priority='normal'}) => {
    if(!settings().browser || !('Notification' in window) || Notification.permission!=='granted') return;
    if(document.visibilityState==='visible' && document.hasFocus()) return;
    const safeUrl=safeActionUrl(actionUrl);
    const urgent=['high','critical'].includes(String(priority||'').toLowerCase());
    const reg=await navigator.serviceWorker?.ready.catch(()=>null);
    if(reg) return reg.showNotification(title,{body,tag,icon:'/assets/logo.jpeg',badge:'/assets/logo.jpeg',renotify:urgent,requireInteraction:String(priority).toLowerCase()==='critical',data:{actionUrl:safeUrl}});
    const notification=new Notification(title,{body,tag,icon:'/assets/logo.jpeg'});
    notification.onclick=()=>{window.focus();window.location.href=safeUrl;notification.close();};
  };
  const requestPermission = async () => {
    if(!('Notification' in window)) return 'unsupported';
    const result=await Notification.requestPermission();
    localStorage.setItem('ds_browser_notifications',result==='granted'?'on':'off');
    if(result==='granted'&&state.client&&state.session)await enablePushSubscription().catch(()=>{});
    return result;
  };
  const init = async ({client,session}={}) => {
    state.client=client||state.client; state.session=session||state.session;
    if('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(()=>{});
    document.addEventListener('pointerdown',ensureContext,{once:true});
    if(settings().browser&&Notification.permission==='granted'){
      enablePushSubscription().catch(()=>{});
    }
    if(state.client&&state.session&&!state.channel){
      state.channel=state.client.channel(`communication-events-${state.session.user.id}`)
        .on('postgres_changes',{event:'INSERT',schema:'public',table:'executive_events',filter:`member_id=eq.${state.session.user.id}`},({new:event})=>{
          const activeMessage = event.event_type?.startsWith('message.') &&
            event.actor_id === state.activeConversationMember &&
            document.visibilityState === 'visible';
          if (activeMessage) return;
          setBadge(state.badge+1);
          const eventType=String(event.event_type||'');
          const priority=String(event.priority||'normal').toLowerCase();
          const kind=['high','critical'].includes(priority)
            ? 'priority'
            : eventType==='call.missed'
              ? 'missed_call'
              : (eventType.startsWith('meeting.')||eventType.startsWith('appointment.'))
                ? 'meeting'
                : 'message_received';
          play(kind);
          const actionUrl=safeActionUrl(event.payload?.action_url||'/notifications/');
          toast({title:event.title||'DominionStar update',body:event.description||'',type:eventType.startsWith('call.')?'call':'info',actionUrl});
          browserNotify({title:event.title||'DominionStar update',body:event.description||'',tag:event.id,actionUrl,priority});
          window.dispatchEvent(new CustomEvent('dominionstar:notification',{detail:event}));
        }).subscribe();
    }
    return api;
  };
  const setActiveConversation = memberId => { state.activeConversationMember=memberId||''; };
  const api={init,play,startLoop,stopLoop,stopAll,toast,setBadge,browserNotify,requestPermission,enablePushSubscription,disablePushSubscription,settings,setActiveConversation,safeActionUrl};
  window.CommunicationEngine=api;
})();
