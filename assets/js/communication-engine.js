(() => {
  const state = { client:null, session:null, context:null, loops:new Map(), badge:0, channel:null, activeConversationMember:'' };
  const settings = () => ({
    sounds: localStorage.getItem('ds_comm_sounds') !== 'off',
    browser: localStorage.getItem('ds_browser_notifications') !== 'off'
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
  const toast = ({title,body='',type='info',actionUrl=''}) => {
    let region=document.getElementById('genesisToastRegion');
    if(!region){ region=document.createElement('div'); region.id='genesisToastRegion'; region.className='genesis-toast-region'; document.body.appendChild(region); }
    const item=document.createElement(actionUrl?'a':'article'); if(actionUrl) item.href=actionUrl;
    item.className=`genesis-toast ${type}`; item.innerHTML=`<span></span><div><strong>${escapeHtml(title)}</strong><small>${escapeHtml(body)}</small></div><button type="button" aria-label="Dismiss">×</button>`;
    item.querySelector('button').onclick=e=>{e.preventDefault();item.remove()}; region.prepend(item); requestAnimationFrame(()=>item.classList.add('show')); setTimeout(()=>item.remove(),7000);
  };
  const escapeHtml=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
  const setBadge = value => {
    state.badge=Math.max(0,Number(value)||0);
    document.querySelectorAll('[data-communication-badge],#notificationCount').forEach(el=>{el.textContent=state.badge;el.classList.toggle('member-hidden',!state.badge)});
    if('setAppBadge' in navigator){ state.badge?navigator.setAppBadge(state.badge).catch(()=>{}):navigator.clearAppBadge().catch(()=>{}); }
  };
  const browserNotify = async ({title,body='',tag='',actionUrl='/'}) => {
    if(!settings().browser || !('Notification' in window) || Notification.permission!=='granted') return;
    const reg=await navigator.serviceWorker?.ready.catch(()=>null);
    if(reg) return reg.showNotification(title,{body,tag,icon:'/assets/logo.jpeg',badge:'/assets/logo.jpeg',data:{actionUrl}});
    new Notification(title,{body,tag,icon:'/assets/logo.jpeg'});
  };
  const requestPermission = async () => {
    if(!('Notification' in window)) return 'unsupported';
    const result=await Notification.requestPermission(); localStorage.setItem('ds_browser_notifications',result==='granted'?'on':'off'); return result;
  };
  const init = async ({client,session}={}) => {
    state.client=client||state.client; state.session=session||state.session;
    if('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(()=>{});
    document.addEventListener('pointerdown',ensureContext,{once:true});
    if(state.client&&state.session&&!state.channel){
      state.channel=state.client.channel(`communication-events-${state.session.user.id}`)
        .on('postgres_changes',{event:'INSERT',schema:'public',table:'executive_events',filter:`member_id=eq.${state.session.user.id}`},({new:event})=>{
          const activeMessage = event.event_type?.startsWith('message.') &&
            event.actor_id === state.activeConversationMember &&
            document.visibilityState === 'visible';
          if (activeMessage) return;
          setBadge(state.badge+1);
          const kind=event.event_type==='call.missed'?'missed_call':event.event_type?.startsWith('meeting.')?'meeting':'message_received';
          play(kind);
          toast({title:event.title||'DominionStar update',body:event.description||'',type:event.event_type?.startsWith('call.')?'call':'info',actionUrl:event.payload?.action_url||'/notifications/'});
          browserNotify({title:event.title||'DominionStar update',body:event.description||'',tag:event.id,actionUrl:event.payload?.action_url||'/notifications/'});
        }).subscribe();
    }
    return api;
  };
  const setActiveConversation = memberId => { state.activeConversationMember=memberId||''; };
  const api={init,play,startLoop,stopLoop,stopAll,toast,setBadge,browserNotify,requestPermission,settings,setActiveConversation};
  window.CommunicationEngine=api;
})();
