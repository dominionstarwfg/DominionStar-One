(()=>{
  if(window.DominionMeetingNotifications)return;
  const desktop=window.dominionDesktop||{};
  const q=s=>document.querySelector(s);
  let audioContext=null,toastTimer=0,waitingCount=0;

  if(!document.querySelector('link[data-ds-meeting-notifications]')){
    const link=document.createElement('link');link.rel='stylesheet';link.href='./meeting-notifications.css';link.dataset.dsMeetingNotifications='1';document.head.append(link);
  }

  const pref=(key,fallback=true)=>{
    try{const p=window.DominionPreferences;return p?.read?Boolean(p.read(key)):fallback;}catch{return fallback;}
  };
  function context(){
    try{audioContext=audioContext||new (window.AudioContext||window.webkitAudioContext)();return audioContext;}catch{return null;}
  }
  function tone(frequency,start,duration,gainValue=.045){
    const ctx=context();if(!ctx)return;
    try{
      if(ctx.state==='suspended')void ctx.resume();
      const osc=ctx.createOscillator(),gain=ctx.createGain(),now=ctx.currentTime;
      osc.type='sine';osc.frequency.value=frequency;gain.gain.setValueAtTime(.0001,now+start);gain.gain.exponentialRampToValueAtTime(gainValue,now+start+.015);gain.gain.exponentialRampToValueAtTime(.0001,now+start+duration);
      osc.connect(gain);gain.connect(ctx.destination);osc.start(now+start);osc.stop(now+start+duration+.03);
    }catch{}
  }
  function play(kind){
    if(kind==='waiting'&&!pref('waitingRoomSound',true))return;
    if((kind==='join'||kind==='leave')&&!pref('joinLeaveSound',true))return;
    if(kind==='waiting'){tone(660,0,.11);tone(880,.14,.16);}
    if(kind==='join'){tone(620,0,.09);tone(820,.11,.12);}
    if(kind==='leave'){tone(620,0,.09);tone(440,.11,.13);}
  }
  function ensureToast(){
    let node=q('#meetingEventToast');if(node)return node;
    node=document.createElement('div');node.id='meetingEventToast';node.className='meeting-event-toast';node.hidden=true;node.innerHTML='<strong></strong><span></span>';document.body.append(node);return node;
  }
  function toast(title,body){
    const node=ensureToast();node.querySelector('strong').textContent=String(title||'Meeting update');node.querySelector('span').textContent=String(body||'');node.hidden=false;
    clearTimeout(toastTimer);toastTimer=setTimeout(()=>{node.hidden=true;},4200);
  }
  function native(title,body){
    if(!pref('desktopMeetingNotifications',true)||document.hasFocus())return;
    const call=desktop.notifications?.showMeeting?.(String(title||'DominionStar Meet'),String(body||''));
    if(call&&typeof call.catch==='function')void call.catch(()=>{});
  }
  function participantBadge(count){
    waitingCount=Math.max(0,Number(count)||0);const button=q('#roomParticipants');if(!button)return;
    let badge=button.querySelector('.waiting-room-badge');
    if(!badge){badge=document.createElement('span');badge.className='waiting-room-badge';badge.setAttribute('aria-hidden','true');button.append(badge);}
    badge.textContent=waitingCount>99?'99+':String(waitingCount);badge.hidden=waitingCount===0;
    button.classList.toggle('has-waiting-room-alert',waitingCount>0);
    button.setAttribute('aria-label',waitingCount?'Participants, '+waitingCount+' waiting':'Participants');
  }
  function names(items=[]){return items.map(x=>String(x.displayName||'Participant')).filter(Boolean);}
  function onWaiting(event){
    const d=event.detail||{},items=Array.isArray(d.items)?d.items:[],added=Array.isArray(d.added)?d.added:[];
    participantBadge(items.length);
    const attention=added.length>0&&!document.hasFocus();
    const badgeCall=desktop.notifications?.setWaitingCount?.(items.length,attention);if(badgeCall&&typeof badgeCall.catch==='function')void badgeCall.catch(()=>{});
    if(!added.length)return;
    const list=names(added),body=list.length===1?list[0]+' is waiting to join':list.length+' people are waiting to join';
    toast('Waiting Room',body);native('DominionStar Meet — Waiting Room',body);play('waiting');
  }
  function onPresence(event){
    const d=event.detail||{},joined=Array.isArray(d.joined)?d.joined:[],left=Array.isArray(d.left)?d.left:[];
    if(joined.length){
      const list=names(joined),body=list.length===1?list[0]+' joined the meeting':list.length+' participants joined the meeting';
      toast('Participant joined',body);native('DominionStar Meet',body);play('join');
    }
    if(left.length){
      const list=names(left),body=list.length===1?list[0]+' left the meeting':list.length+' participants left the meeting';
      toast('Participant left',body);native('DominionStar Meet',body);play('leave');
    }
  }
  function reset(){participantBadge(0);const badgeCall=desktop.notifications?.setWaitingCount?.(0,false);if(badgeCall&&typeof badgeCall.catch==='function')void badgeCall.catch(()=>{});const node=q('#meetingEventToast');if(node)node.hidden=true;}
  window.addEventListener('dominion:waiting-room-update',onWaiting);
  window.addEventListener('dominion:participant-presence',onPresence);
  window.addEventListener('dominion:meeting-ended',reset);
  window.DominionMeetingNotifications=Object.freeze({version:'1.0.0',play,toast,participantBadge,reset});
})();