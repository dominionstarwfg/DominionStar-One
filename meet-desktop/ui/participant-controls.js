(()=>{
  if(window.DominionParticipantControls)return;
  const desktop=window.dominionDesktop||{},meeting=desktop.meeting||null;
  const media=()=>window.DominionMediaController||null;
  const q=s=>document.querySelector(s),qa=s=>[...document.querySelectorAll(s)];
  let menu=null,prompt=null,renameDialog=null,busy=false,spotlightParticipantIds=[],localMediaUnsub=null;const remoteMedia=new Map();
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
      return;
    }
    if(type==='host:lower-hand'){
      await window.DominionMeetingFeatures?.setLocalHand?.(false,{broadcastChange:true});
      toast(`${sender} lowered your hand`);
      return;
    }
    if(type==='host:spotlight'){
      const incoming=Array.isArray(detail.payload?.participantIds)?detail.payload.participantIds:[detail.payload?.participantId];
      spotlightParticipantIds=[...new Set(incoming.map(value=>String(value||'')).filter(Boolean))].slice(0,4);
      window.dispatchEvent(new CustomEvent('dominion:spotlight-change',{detail:{participantIds:[...spotlightParticipantIds],participantId:spotlightParticipantIds[0]||''}}));
      return;
    }
    if(type==='host:view-layout'){
      const mode=String(detail.payload?.mode||'');
      if(['speaker','gallery','multi'].includes(mode)){
        window.dispatchEvent(new CustomEvent('dominion:host-view-layout',{detail:{mode,sharing:Boolean(detail.payload?.sharing),from:sender}}));
        toast(`${sender} changed the meeting view`);
      }
    }
  }
  window.addEventListener('dominion:meeting-signal',event=>void handleHostSignal(event),true);

  async function send(target,type){if(!canManage()||!meeting?.sendSignal)return false;await meeting.sendSignal(target,type,{at:new Date().toISOString()});return true;}
  async function sendAll(type){
    if(busy||!canManage())return;busy=true;syncPanelActions();
    try{
      const list=(await peers()).filter(p=>String(p.role||'').toLowerCase()!=='host');
      await Promise.allSettled(list.map(p=>send(p.participantId,type)));
      const labels={'host:mute':'All participants muted','host:ask-unmute':'Unmute requests sent','host:stop-video':'Video stopped for all participants','host:ask-start-video':'Start-video requests sent','host:lower-hand':'All raised hands lowered'};
      toast(labels[type]||'Meeting-wide action sent');
    } finally{busy=false;syncPanelActions();}
  }

  function ensureRenameDialog(){
    if(renameDialog?.isConnected)return renameDialog;
    renameDialog=document.createElement('dialog');renameDialog.className='participant-control-prompt participant-rename-prompt';
    renameDialog.innerHTML='<form method="dialog"><header><strong>Rename participant</strong></header><label><span>Name</span><input maxlength="100" autocomplete="off"></label><p class="participant-rename-status"></p><div><button type="button" class="secondary-button" data-rename-cancel>Cancel</button><button type="submit" class="primary-button">Rename</button></div></form>';
    document.body.append(renameDialog);renameDialog.querySelector('[data-rename-cancel]').onclick=()=>renameDialog.close();return renameDialog;
  }
  function renameParticipant(id,currentName){
    const dialog=ensureRenameDialog(),input=dialog.querySelector('input'),status=dialog.querySelector('.participant-rename-status'),form=dialog.querySelector('form');
    input.value=String(currentName||'');status.textContent='';if(!dialog.open)dialog.showModal();setTimeout(()=>{input.focus();input.select();},20);
    form.onsubmit=async event=>{event.preventDefault();const name=String(input.value||'').trim();if(!name){status.textContent='Enter a name.';return;}const buttons=[...form.querySelectorAll('button')];buttons.forEach(b=>b.disabled=true);try{await meeting.renameParticipant(id,name);dialog.close();toast('Participant renamed');}catch(error){status.textContent=String(error?.message||error||'Rename failed.');}finally{buttons.forEach(b=>b.disabled=false);}};
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
    {
      const alreadySpotlighted=spotlightParticipantIds.includes(id);
      const spotlightLabel=alreadySpotlighted?'Remove Spotlight':spotlightParticipantIds.length?'Add Spotlight':'Spotlight for Everyone';
      add(spotlightLabel,async()=>{
        let next=alreadySpotlighted?spotlightParticipantIds.filter(value=>value!==id):[...spotlightParticipantIds,id];
        next=[...new Set(next)].slice(0,4);
        spotlightParticipantIds=next;
        window.dispatchEvent(new CustomEvent('dominion:spotlight-change',{detail:{participantIds:[...next],participantId:next[0]||''}}));
        const list=await peers();
        await Promise.allSettled(list.map(p=>meeting.sendSignal(p.participantId,'host:spotlight',{participantIds:[...next],participantId:next[0]||'',at:new Date().toISOString()})));
        toast(next.length>1?`${next.length} participants spotlighted`:next.length===1?'Participant spotlighted':'Spotlight removed');
      });
    }
    if(row.dataset.raisedHand==='1')add('Lower Hand',()=>send(id,'host:lower-hand'));
    add('Rename',()=>renameParticipant(id,name));
    if(localRole()==='host'&&row.dataset.recordEligible==='1'&&role!=='cohost'){
      add(row.dataset.recordingAllowed==='1'?'Forbid Record':'Allow Record',async()=>{await meeting.setRecordingPermission(id,row.dataset.recordingAllowed!=='1');});
    }
    if(localRole()==='host'&&role!=='cohost')add('Make Co-host',async()=>{await meeting.setCohost(id,true);});
    if(localRole()==='host'&&role==='cohost')add('Remove Co-host',async()=>{await meeting.setCohost(id,false);});
    if(localRole()==='host'||role!=='cohost')add('Remove',async()=>{await meeting.removeParticipant(id);},true);
    document.body.append(menu);const r=button.getBoundingClientRect();menu.style.left=`${Math.max(10,Math.min(innerWidth-230,r.right-210))}px`;menu.style.top=`${Math.max(10,Math.min(innerHeight-menu.offsetHeight-10,r.bottom+6))}px`;
    menu.setAttribute('aria-label',`Controls for ${name}`);
  }

  function setMediaIcon(node,on,kind){
    if(!node)return;
    const known=typeof on==='boolean';
    node.classList.toggle('on',known&&on);
    node.classList.toggle('off',known&&!on);
    node.classList.toggle('unknown',!known);
    node.setAttribute('aria-label',kind==='mic'?(known?(on?'Microphone on':'Microphone muted'):'Microphone status unknown'):(known?(on?'Video on':'Video off'):'Video status unknown'));
    node.title=node.getAttribute('aria-label');
  }
  function syncRowMedia(row){
    const id=String(row.dataset.participantId||''),self=row.dataset.participantSelf==='1';
    let state=null;
    if(self){
      const snap=media()?.snapshot?.();state=snap?{micOn:Boolean(snap.micOn),cameraOn:Boolean(snap.cameraOn)}:null;
    }else state=remoteMedia.get(id)||null;
    setMediaIcon(row.querySelector('[data-participant-mic]'),state?.micOn,'mic');
    setMediaIcon(row.querySelector('[data-participant-video]'),state?.cameraOn,'video');
  }
  function syncAllMedia(){for(const row of qa('#participantRoster [data-participant-id]'))syncRowMedia(row);}

  function syncRoster(){
    if(!inMeeting())return;
    for(const row of qa('#participantRoster [data-participant-id]')){
      let button=row.querySelector('[data-participant-more]');
      const role=String(row.dataset.participantRole||'participant');
      if(!canManage()||role==='host'){button?.remove();continue;}
      if(!button){button=document.createElement('button');button.type='button';button.dataset.participantMore='1';button.className='mini-btn participant-more';button.textContent='More';button.setAttribute('aria-label',`More controls for ${String(row.dataset.participantName||'participant')}`);button.onclick=event=>{event.stopPropagation();void openParticipantMenu(button);};row.querySelector('.participant-actions')?.append(button)||row.append(button);}syncRowMedia(row);
    }
  }

  function syncPanelActions(){
    const side=q('.room-side');if(!side)return;
    let footer=q('#participantBulkActions');
    if(!canManage()){footer?.remove();return;}
    if(!footer){
      footer=document.createElement('div');footer.id='participantBulkActions';footer.className='participant-bulk-actions';
      footer.innerHTML='<button type="button" data-mute-all>Mute All</button><button type="button" data-ask-all>Ask All to Unmute</button><button type="button" data-stop-video-all>Stop Video for All</button><button type="button" data-ask-video-all>Ask All to Start Video</button><button type="button" data-lower-hands>Lower All Hands</button>';
      side.append(footer);
      footer.querySelector('[data-mute-all]').onclick=()=>void sendAll('host:mute');
      footer.querySelector('[data-ask-all]').onclick=()=>void sendAll('host:ask-unmute');
      footer.querySelector('[data-stop-video-all]').onclick=()=>void sendAll('host:stop-video');
      footer.querySelector('[data-ask-video-all]').onclick=()=>void sendAll('host:ask-start-video');
      footer.querySelector('[data-lower-hands]').onclick=()=>void sendAll('host:lower-hand');
    }
    qa('#participantBulkActions button').forEach(b=>b.disabled=busy);
  }

  function sync(){if(!inMeeting()){closeMenu();return;}syncRoster();syncPanelActions();syncAllMedia();}
  document.addEventListener('pointerdown',event=>{if(menu&&!menu.contains(event.target)&&!event.target.closest?.('[data-participant-more]'))closeMenu();},true);
  window.addEventListener('dominion:remote-media-state',event=>{const detail=event.detail||{},id=String(detail.participantId||'');if(!id)return;if(detail.disconnected)remoteMedia.delete(id);else remoteMedia.set(id,{micOn:Boolean(detail.micOn),cameraOn:Boolean(detail.cameraOn)});const row=q(`#participantRoster [data-participant-id="${CSS.escape(id)}"]`);if(row)syncRowMedia(row);},true);
  localMediaUnsub=media()?.onChange?.(()=>syncAllMedia())||null;
  const timer=setInterval(sync,800);sync();
  window.DominionParticipantControls=Object.freeze({version:'2.0.39',sync,sendAll,syncAllMedia,dispose:()=>{clearInterval(timer);localMediaUnsub?.();localMediaUnsub=null;closeMenu();prompt?.remove();renameDialog?.remove();}});
})();