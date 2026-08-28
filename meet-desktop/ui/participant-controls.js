(()=>{
  if(window.DominionParticipantControls)return;
  const desktop=window.dominionDesktop||{},meeting=desktop.meeting||null;
  const media=()=>window.DominionMediaController||null;
  const q=s=>document.querySelector(s),qa=s=>[...document.querySelectorAll(s)];
  let menu=null,prompt=null,busy=false;
  const esc=value=>String(value||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const localRole=()=>String(q('#roomRole')?.textContent||'').trim().toLowerCase().replace('-','');
  const canManage=()=>['host','cohost'].includes(localRole());
  const inMeeting=()=>Boolean(q('#meetingOverlay')&&!q('#meetingOverlay').hidden);

  if(!document.querySelector('link[data-ds-participant-controls]')){
    const link=document.createElement('link');link.rel='stylesheet';link.href='./participant-controls.css';link.dataset.dsParticipantControls='1';document.head.append(link);
  }

  async function context(){try{return await meeting?.context?.()||{};}catch{return {};}}
  async function snapshot(){const ctx=await context();if(!ctx.roomId||!meeting?.snapshot)return null;try{return await meeting.snapshot(ctx.roomId);}catch{return null;}}
  async function peers(){const snap=await snapshot(),ctx=await context();return (snap?.participants||[]).filter(p=>String(p.participantId||'')&&String(p.participantId)!==String(ctx.participantId||'')&&['admitted','joined'].includes(String(p.state||'joined')));}
  async function authorizedSender(fromParticipantId){
    const snap=await snapshot();if(!snap)return false;
    const sender=(snap.participants||[]).find(p=>String(p.participantId)===String(fromParticipantId));
    return ['host','cohost'].includes(String(sender?.role||'').toLowerCase());
  }

  function toast(text){
    let node=q('#participantControlToast');
    if(!node){node=document.createElement('div');node.id='participantControlToast';node.className='participant-control-toast';document.body.append(node);}
    node.textContent=String(text||'');node.hidden=false;clearTimeout(Number(node.dataset.timer)||0);node.dataset.timer=String(setTimeout(()=>{node.hidden=true;},2600));
  }

  function ensurePrompt(){
    if(prompt?.isConnected)return prompt;
    prompt=document.createElement('dialog');prompt.id='participantControlPrompt';prompt.className='participant-control-prompt';
    prompt.innerHTML='<form method="dialog"><header><strong id="participantPromptTitle">Meeting request</strong></header><p id="participantPromptCopy"></p><div><button value="cancel" class="secondary-button">Not now</button><button value="confirm" class="primary-button">Continue</button></div></form>';
    document.body.append(prompt);return prompt;
  }
  async function requestConsent({title,copy,confirmLabel,action}){
    const dialog=ensurePrompt();q('#participantPromptTitle').textContent=title;q('#participantPromptCopy').textContent=copy;
    const confirm=dialog.querySelector('button[value="confirm"]');confirm.textContent=confirmLabel;
    if(!dialog.open)dialog.showModal();
    const result=await new Promise(resolve=>dialog.addEventListener('close',()=>resolve(dialog.returnValue),{once:true}));
    if(result!=='confirm')return false;
    try{await action();return true;}catch(error){toast(String(error?.message||error||'Action unavailable.'));return false;}
  }

  async function handleHostSignal(event){
    const detail=event.detail||{},type=String(detail.type||'');
    if(!type.startsWith('host:'))return;
    if(!await authorizedSender(detail.fromParticipantId))return;
    const sender=String(detail.fromDisplayName||'Host');
    if(type==='host:mute'){await media()?.setMicrophone?.(false);toast(`${sender} muted your microphone`);return;}
    if(type==='host:stop-video'){await media()?.setCamera?.(false);toast(`${sender} stopped your video`);return;}
    if(type==='host:ask-unmute'){
      await requestConsent({title:'Unmute microphone?',copy:`${sender} is asking you to unmute.`,confirmLabel:'Unmute',action:()=>media()?.setMicrophone?.(true)});
      return;
    }
    if(type==='host:ask-start-video'){
      await requestConsent({title:'Start video?',copy:`${sender} is asking you to start your video.`,confirmLabel:'Start Video',action:()=>media()?.setCamera?.(true)});
    }
  }
  window.addEventListener('dominion:meeting-signal',event=>void handleHostSignal(event),true);

  async function send(target,type){if(!canManage()||!meeting?.sendSignal)return false;await meeting.sendSignal(target,type,{at:new Date().toISOString()});return true;}
  async function sendAll(type){
    if(busy||!canManage())return;busy=true;syncPanelActions();
    try{const list=await peers();await Promise.allSettled(list.map(p=>send(p.participantId,type)));toast(type==='host:mute'?'Mute request sent to all participants':'Unmute requests sent to all participants');}
    finally{busy=false;syncPanelActions();}
  }

  function closeMenu(){menu?.remove();menu=null;}
  async function openParticipantMenu(button){
    closeMenu();const row=button.closest('[data-participant-id]');if(!row||!canManage())return;
    const id=String(row.dataset.participantId||''),role=String(row.dataset.participantRole||'participant'),name=String(row.dataset.participantName||'Participant');
    if(!id||role==='host')return;
    menu=document.createElement('div');menu.className='participant-control-menu';
    const add=(label,handler,danger=false)=>{const b=document.createElement('button');b.type='button';b.textContent=label;if(danger)b.className='danger';b.onclick=()=>{closeMenu();void handler();};menu.append(b);};
    add('Mute',()=>send(id,'host:mute'));
    add('Ask to Unmute',()=>send(id,'host:ask-unmute'));
    add('Stop Video',()=>send(id,'host:stop-video'));
    add('Ask to Start Video',()=>send(id,'host:ask-start-video'));
    if(localRole()==='host'&&role!=='cohost')add('Make Co-host',async()=>{await meeting.setCohost(id,true);});
    if(localRole()==='host'&&role==='cohost')add('Remove Co-host',async()=>{await meeting.setCohost(id,false);});
    add('Remove',async()=>{await meeting.removeParticipant(id);},true);
    document.body.append(menu);const r=button.getBoundingClientRect();menu.style.left=`${Math.max(10,Math.min(innerWidth-230,r.right-210))}px`;menu.style.top=`${Math.max(10,Math.min(innerHeight-menu.offsetHeight-10,r.bottom+6))}px`;
    menu.setAttribute('aria-label',`Controls for ${name}`);
  }

  function syncRoster(){
    if(!inMeeting())return;
    for(const row of qa('#participantRoster [data-participant-id]')){
      let button=row.querySelector('[data-participant-more]');
      const role=String(row.dataset.participantRole||'participant');
      if(!canManage()||role==='host'){button?.remove();continue;}
      if(!button){button=document.createElement('button');button.type='button';button.dataset.participantMore='1';button.className='mini-btn participant-more';button.textContent='More';button.onclick=event=>{event.stopPropagation();void openParticipantMenu(button);};row.querySelector('.participant-actions')?.append(button)||row.append(button);}
    }
  }

  function syncPanelActions(){
    const side=q('.room-side');if(!side)return;
    let footer=q('#participantBulkActions');
    if(!canManage()){footer?.remove();return;}
    if(!footer){
      footer=document.createElement('div');footer.id='participantBulkActions';footer.className='participant-bulk-actions';
      footer.innerHTML='<button type="button" data-mute-all>Mute All</button><button type="button" data-ask-all>Ask All to Unmute</button>';
      side.append(footer);
      footer.querySelector('[data-mute-all]').onclick=()=>void sendAll('host:mute');
      footer.querySelector('[data-ask-all]').onclick=()=>void sendAll('host:ask-unmute');
    }
    qa('#participantBulkActions button').forEach(b=>b.disabled=busy);
  }

  function sync(){if(!inMeeting()){closeMenu();return;}syncRoster();syncPanelActions();}
  document.addEventListener('pointerdown',event=>{if(menu&&!menu.contains(event.target)&&!event.target.closest?.('[data-participant-more]'))closeMenu();},true);
  const timer=setInterval(sync,800);sync();
  window.DominionParticipantControls=Object.freeze({version:'1.0.0',sync,sendAll,dispose:()=>{clearInterval(timer);closeMenu();prompt?.remove();}});
})();