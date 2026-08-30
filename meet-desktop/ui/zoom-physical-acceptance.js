(()=>{
  if(window.DominionZoomPhysicalAcceptance)return;

  const desktop=window.dominionDesktop||{};
  const meeting=desktop.meeting||null;
  const q=s=>document.querySelector(s),qa=s=>[...document.querySelectorAll(s)];
  const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
  const esc=value=>String(value||'').replace(/[&<>\"]/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[char]));
  const inMeeting=()=>Boolean(q('#meetingOverlay')&&!q('#meetingOverlay').hidden);
  const localRole=()=>String(q('#roomRole')?.textContent||'participant').trim().toLowerCase().replace('-','');
  const isManager=()=>['host','cohost'].includes(localRole());
  const parity=()=>window.DominionMeetingParity||null;
  const features=()=>window.DominionMeetingFeatures||null;
  const media=()=>window.DominionMediaController||null;

  const REACTIONS=['👏','👍','❤️','😂','😮','🎉'];
  const remoteMediaState=new Map();
  let localParticipantId='';
  let commandMenu=null;
  let reactionMenu=null;
  let selfMenu=null;
  let sharePicker=null;
  let sharePermissionDialog=null;
  let shareSources={screen:[],window:[]};
  let shareKind='screen';
  let selectedShareId='';
  let mediaBroadcastTimer=0;
  let participantObserver=null;
  let reactionObserver=null;
  let mediaUnsub=null;
  let presenterUnsub=null;

  function closeCommandMenu(){commandMenu?.remove();commandMenu=null;for(const node of qa('[aria-expanded="true"]'))node.setAttribute('aria-expanded','false');}
  function closeReactionMenu(){reactionMenu?.remove();reactionMenu=null;q('#roomReactions')?.setAttribute('aria-expanded','false');}
  function closeSelfMenu(){selfMenu?.remove();selfMenu=null;}
  function closeTransientMenus(){closeCommandMenu();closeReactionMenu();closeSelfMenu();}

  function positionMenu(menu,anchor,{width=272,above=true}={}){
    if(!menu||!anchor)return;
    const anchorRect=anchor.getBoundingClientRect();
    const rect=menu.getBoundingClientRect();
    const menuWidth=rect.width||width;
    const left=clamp(anchorRect.left+anchorRect.width/2-menuWidth/2,12,innerWidth-menuWidth-12);
    menu.style.left=`${Math.round(left)}px`;
    menu.style.right='auto';
    if(above){
      const bottom=Math.max(14,innerHeight-anchorRect.top+10);
      menu.style.bottom=`${Math.round(bottom)}px`;
      menu.style.top='auto';
    }else{
      const top=clamp(anchorRect.bottom+8,12,innerHeight-(rect.height||280)-12);
      menu.style.top=`${Math.round(top)}px`;
      menu.style.bottom='auto';
    }
  }

  function createCommandMenu(anchor,title=''){
    closeTransientMenus();
    const menu=document.createElement('div');
    menu.className='ds-command-menu';
    menu.setAttribute('role','menu');
    if(title){const heading=document.createElement('div');heading.className='ds-command-menu-heading';heading.textContent=title;menu.append(heading);}
    document.body.append(menu);commandMenu=menu;anchor?.setAttribute('aria-expanded','true');
    requestAnimationFrame(()=>positionMenu(menu,anchor));
    return menu;
  }
  function addCommand(menu,label,handler,{selected=false,danger=false,disabled=false}={}){
    const button=document.createElement('button');button.type='button';button.setAttribute('role','menuitem');button.disabled=Boolean(disabled);button.className=`ds-command-item${selected?' selected':''}${danger?' danger':''}`;button.innerHTML=`<span>${selected?'✓':''}</span><strong>${esc(label)}</strong>`;
    button.onclick=event=>{event.stopPropagation();closeCommandMenu();Promise.resolve(handler?.()).catch(()=>{});};menu.append(button);return button;
  }
  function addDivider(menu){const divider=document.createElement('div');divider.className='ds-command-divider';divider.setAttribute('role','separator');menu.append(divider);}

  function installViewAuthority(){
    const button=q('#meetingViewButton');if(!button||button.dataset.dsPhysicalAuthority==='1')return;
    button.dataset.dsPhysicalAuthority='1';button.setAttribute('aria-haspopup','menu');button.setAttribute('aria-expanded','false');
    button.onclick=event=>{
      event.preventDefault();event.stopPropagation();
      const menu=createCommandMenu(button,'View');
      const current=String(q('#meetingOverlay')?.dataset.viewMode||'speaker');
      addCommand(menu,'Speaker',()=>parity()?.applyViewMode?.('speaker'),{selected:current==='speaker'});
      addCommand(menu,'Gallery',()=>parity()?.applyViewMode?.('gallery'),{selected:current==='gallery'});
      addCommand(menu,'Multi-speaker',()=>parity()?.applyViewMode?.('multi'),{selected:current==='multi'});
      if(q('#meetingOverlay')?.classList.contains('share-active')){
        addDivider(menu);
        const dock=q('#participantVideoDock');
        addCommand(menu,dock?.hidden?'Show participant video':'Hide participant video',()=>{if(dock){dock.hidden=!dock.hidden;parity()?.syncVideoDock?.();}});
      }
    };
  }

  async function openHostTools(button){
    const menu=createCommandMenu(button,'Host Tools');
    let ctx={},snapshot={};
    try{ctx=await meeting?.context?.()||{};if(ctx.roomId&&meeting?.snapshot)snapshot=await meeting.snapshot(ctx.roomId)||{};}catch{}
    if(commandMenu!==menu)return;
    const locked=Boolean(snapshot.meetingLocked),muteOnEntry=Boolean(snapshot.muteOnEntry);
    addCommand(menu,'Open Participants',()=>parity()?.toggleParticipants?.(true));
    addCommand(menu,'Copy meeting information',async()=>{const text=String(q('#roomCodeLabel')?.textContent||'').trim();if(text)await navigator.clipboard.writeText(text);});
    addDivider(menu);
    addCommand(menu,locked?'Unlock Meeting':'Lock Meeting',()=>meeting?.setSecurity?.(ctx.roomId,{locked:!locked,muteOnEntry}),{selected:locked,disabled:!ctx.roomId});
    addCommand(menu,'Mute Participants on Entry',()=>meeting?.setSecurity?.(ctx.roomId,{locked,muteOnEntry:!muteOnEntry}),{selected:muteOnEntry,disabled:!ctx.roomId});
    requestAnimationFrame(()=>positionMenu(menu,button));
  }
  function installHostToolsAuthority(){
    const button=q('#roomHostTools');if(!button||button.dataset.dsPhysicalAuthority==='1')return;
    button.dataset.dsPhysicalAuthority='1';button.setAttribute('aria-haspopup','menu');button.setAttribute('aria-expanded','false');
    button.onclick=event=>{event.preventDefault();event.stopPropagation();if(isManager())void openHostTools(button);};
  }

  function installMoreAuthority(){
    const button=q('#roomMore');if(!button||button.dataset.dsPhysicalAuthority==='1')return;
    button.dataset.dsPhysicalAuthority='1';button.setAttribute('aria-haspopup','menu');button.setAttribute('aria-expanded','false');
    button.onclick=event=>{
      event.preventDefault();event.stopPropagation();const menu=createCommandMenu(button,'More');const feature=features(),recording=Boolean(feature?.snapshot?.().recording);
      addCommand(menu,recording?'Stop recording':'Record',()=>recording?feature?.stopRecording?.():feature?.toggleRecording?.());
      const captions=q('#roomCaptions');if(captions)addCommand(menu,captions.getAttribute('aria-pressed')==='true'?'Hide captions':'Show captions',()=>captions.click());
      addCommand(menu,'Meeting settings',()=>{const dialog=q('#settingsDialog');if(dialog&&!dialog.open)dialog.showModal();});
      addDivider(menu);
      addCommand(menu,'Reset participant video panel',()=>parity()?.resetVideoDock?.());
      const dock=q('#participantVideoDock');if(dock&&!dock.hidden)addCommand(menu,'Hide participant video',()=>{dock.hidden=true;});
    };
  }

  const MIC_ON='<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5.5 11.5a6.5 6.5 0 0 0 13 0M12 18v3M9 21h6"/></svg>';
  const MIC_OFF='<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5.5 11.5a6.5 6.5 0 0 0 9.5 5.78M12 18v3M9 21h6M4 4l16 16"/></svg>';
  const VIDEO_ON='<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="6" width="13" height="12" rx="3"/><path d="m16 10 5-3v10l-5-3z"/></svg>';
  const VIDEO_OFF='<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="6" width="13" height="12" rx="3"/><path d="m16 10 5-3v7M4 4l16 16"/></svg>';

  async function refreshLocalParticipantId(){try{const ctx=await meeting?.context?.();localParticipantId=String(ctx?.participantId||localParticipantId||'');}catch{}return localParticipantId;}
  function statusFor(id){
    if(String(id)===String(localParticipantId)){
      const snap=media()?.snapshot?.()||{};return {micOn:Boolean(snap.micOn),cameraOn:Boolean(snap.cameraOn),known:true};
    }
    const state=remoteMediaState.get(String(id));return state?{...state,known:true}:{micOn:false,cameraOn:false,known:false};
  }
  function mediaStatusNode(row,id){
    let wrap=row.querySelector('.ds-participant-media');if(!wrap){wrap=document.createElement('span');wrap.className='ds-participant-media';const actions=row.querySelector('.participant-actions')||document.createElement('span');if(!actions.isConnected){actions.className='participant-actions ds-participant-actions';row.append(actions);}actions.prepend(wrap);}
    const state=statusFor(id);wrap.innerHTML=`<span class="ds-media-state ${state.known?'':'unknown'} ${state.micOn?'on':'off'}" title="${state.known?(state.micOn?'Microphone on':'Microphone muted'):'Audio status syncing'}" aria-label="${state.known?(state.micOn?'Microphone on':'Microphone muted'):'Audio status syncing'}">${state.micOn?MIC_ON:MIC_OFF}</span><span class="ds-media-state ${state.known?'':'unknown'} ${state.cameraOn?'on':'off'}" title="${state.known?(state.cameraOn?'Video on':'Video off'):'Video status syncing'}" aria-label="${state.known?(state.cameraOn?'Video on':'Video off'):'Video status syncing'}">${state.cameraOn?VIDEO_ON:VIDEO_OFF}</span>`;
    return wrap;
  }

  function ensureSelfMore(row){
    if(String(row.dataset.participantId||'')!==String(localParticipantId||''))return;
    const actions=row.querySelector('.participant-actions');if(!actions)return;
    let button=actions.querySelector('[data-ds-self-more]');if(button)return;
    button=document.createElement('button');button.type='button';button.dataset.dsSelfMore='1';button.className='participant-more ds-participant-more';button.textContent='•••';button.setAttribute('aria-label','More options for yourself');
    button.onclick=event=>{event.stopPropagation();openSelfParticipantMenu(button,row);};actions.append(button);
  }
  function openSelfParticipantMenu(button,row){
    closeTransientMenus();const id=String(row.dataset.participantId||'');selfMenu=document.createElement('div');selfMenu.className='ds-command-menu ds-self-participant-menu';document.body.append(selfMenu);
    const rename=document.createElement('button');rename.type='button';rename.className='ds-command-item';rename.innerHTML='<span></span><strong>Rename</strong>';rename.onclick=()=>{closeSelfMenu();openRenamePrompt(id,String(row.dataset.participantName||''));};selfMenu.append(rename);
    const copy=document.createElement('button');copy.type='button';copy.className='ds-command-item';copy.innerHTML='<span></span><strong>Copy display name</strong>';copy.onclick=async()=>{closeSelfMenu();try{await navigator.clipboard.writeText(String(row.dataset.participantName||''));}catch{}};selfMenu.append(copy);
    positionMenu(selfMenu,button,{width:220,above:false});
  }
  function openRenamePrompt(id,currentName){
    let dialog=q('#dsRenameSelfDialog');if(!dialog){dialog=document.createElement('dialog');dialog.id='dsRenameSelfDialog';dialog.className='ds-modern-dialog';dialog.innerHTML='<form method="dialog"><header><strong>Rename</strong><button value="cancel" aria-label="Close">×</button></header><label><span>Display name</span><input maxlength="100" autocomplete="off"></label><p class="ds-dialog-status"></p><footer><button value="cancel">Cancel</button><button type="submit" value="default" class="primary">Save</button></footer></form>';document.body.append(dialog);}
    const form=dialog.querySelector('form'),input=dialog.querySelector('input'),status=dialog.querySelector('.ds-dialog-status');input.value=currentName;status.textContent='';
    form.onsubmit=async event=>{event.preventDefault();const next=String(input.value||'').trim();if(!next)return;try{await meeting?.renameParticipant?.(id,next);dialog.close();}catch(error){status.textContent=String(error?.message||error||'Rename failed.');}};
    if(!dialog.open)dialog.showModal();setTimeout(()=>{input.focus();input.select();},20);
  }

  function decorateParticipantRows(){
    if(!inMeeting())return;
    window.DominionParticipantControls?.sync?.();
    for(const row of qa('#participantRoster [data-participant-id]')){
      const id=String(row.dataset.participantId||'');if(!id)continue;
      row.classList.add('ds-modern-participant-row');
      let actions=row.querySelector('.participant-actions');if(!actions){actions=document.createElement('span');actions.className='participant-actions ds-participant-actions';row.append(actions);}else actions.classList.add('ds-participant-actions');
      mediaStatusNode(row,id);
      const more=row.querySelector('[data-participant-more]');if(more){more.textContent='•••';more.classList.add('ds-participant-more');more.setAttribute('aria-label',`More options for ${String(row.dataset.participantName||'participant')}`);actions.append(more);}
      ensureSelfMore(row);
      const copy=row.querySelector('.person-copy'),role=String(row.dataset.participantRole||'participant').toLowerCase();
      if(copy){let badge=copy.querySelector('.ds-role-chip');if(!badge){badge=document.createElement('span');badge.className='ds-role-chip';copy.querySelector('strong')?.append(badge);}badge.textContent=role==='host'?'Host':role==='cohost'?'Co-host':'';badge.hidden=!['host','cohost'].includes(role);const legacy=copy.querySelector('small');if(legacy)legacy.textContent=id===localParticipantId?'You':role==='host'?'Meeting host':role==='cohost'?'Co-host':'Participant';}
    }
  }

  async function broadcastLocalMediaState(){
    clearTimeout(mediaBroadcastTimer);mediaBroadcastTimer=0;if(!inMeeting()||!meeting?.context||!meeting?.snapshot||!meeting?.sendSignal)return;
    let ctx,snapshot;try{ctx=await meeting.context();if(!ctx?.roomId||!ctx?.participantId)return;localParticipantId=String(ctx.participantId);snapshot=await meeting.snapshot(ctx.roomId);}catch{return;}
    const state=media()?.snapshot?.()||{},payload={kind:'media-state',micOn:Boolean(state.micOn),cameraOn:Boolean(state.cameraOn),participantId:localParticipantId,at:new Date().toISOString()};remoteMediaState.set(localParticipantId,payload);decorateParticipantRows();
    const role=localRole();const targets=(snapshot?.participants||[]).filter(p=>String(p.participantId||'')&&String(p.participantId)!==localParticipantId&&['admitted','joined'].includes(String(p.state||'joined'))&&(['host','cohost'].includes(role)||['host','cohost'].includes(String(p.role||'').toLowerCase())));
    await Promise.allSettled(targets.map(p=>meeting.sendSignal(p.participantId,'reaction',payload)));
  }
  function scheduleMediaBroadcast(delay=100){clearTimeout(mediaBroadcastTimer);mediaBroadcastTimer=setTimeout(()=>void broadcastLocalMediaState(),delay);}

  function installParticipantAuthority(){
    const roster=q('#participantRoster');if(roster&&!participantObserver){participantObserver=new MutationObserver(()=>requestAnimationFrame(decorateParticipantRows));participantObserver.observe(roster,{childList:true,subtree:true});}
    void refreshLocalParticipantId().then(()=>decorateParticipantRows());
    if(!mediaUnsub&&media()?.onChange){mediaUnsub=media().onChange(()=>{decorateParticipantRows();scheduleMediaBroadcast(80);});}
  }

  function setReactionIcon(){
    const icon=q('#roomReactions .ds-control-icon');if(!icon||icon.dataset.dsReactionIcon==='1')return;icon.dataset.dsReactionIcon='1';icon.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.5" cy="12" r="7.5"/><path d="M7.8 10h.01M13.2 10h.01M7.6 14c.9 1.2 1.8 1.7 2.9 1.7 1.2 0 2.2-.5 3.1-1.7"/><path d="M18.2 3.8v3.4M16.5 5.5h3.4M18 15.7c1.9.2 3 1.1 3 2.4 0 1.6-1.8 2.6-4.7 2.7"/></svg>';
  }
  function installReactionAuthority(){
    const button=q('#roomReactions');if(!button)return;setReactionIcon();if(button.dataset.dsPhysicalAuthority==='1')return;button.dataset.dsPhysicalAuthority='1';button.setAttribute('aria-haspopup','menu');button.setAttribute('aria-expanded','false');
    button.onclick=event=>{event.preventDefault();event.stopPropagation();openReactionTray(button);};
    const layer=q('#meetingReactionLayer');if(layer&&!reactionObserver){reactionObserver=new MutationObserver(records=>{for(const record of records){for(const node of record.addedNodes){if(!(node instanceof HTMLElement)||!node.classList.contains('meeting-reaction-bubble')||node.dataset.dsUpgraded==='1')continue;upgradeReactionBubble(node);}}});reactionObserver.observe(layer,{childList:true});}
  }
  function openReactionTray(anchor){
    closeTransientMenus();reactionMenu=document.createElement('div');reactionMenu.className='ds-reaction-tray';reactionMenu.setAttribute('role','menu');
    for(const emoji of REACTIONS){const button=document.createElement('button');button.type='button';button.textContent=emoji;button.setAttribute('aria-label',`React ${emoji}`);button.onclick=event=>{event.stopPropagation();closeReactionMenu();void features()?.sendReaction?.(emoji);};reactionMenu.append(button);}
    const divider=document.createElement('span');divider.className='ds-reaction-divider';reactionMenu.append(divider);const hand=document.createElement('button');hand.type='button';hand.className='ds-raise-hand';const raised=Boolean(features()?.snapshot?.().handRaised);hand.textContent=raised?'✋ Lower Hand':'✋ Raise Hand';hand.onclick=event=>{event.stopPropagation();closeReactionMenu();void features()?.toggleRaiseHand?.();};reactionMenu.append(hand);document.body.append(reactionMenu);anchor.setAttribute('aria-expanded','true');positionMenu(reactionMenu,anchor,{width:430});
  }
  function upgradeReactionBubble(node){
    node.dataset.dsUpgraded='1';const emoji=String(node.querySelector('b')?.textContent||''),name=String(node.querySelector('span')?.textContent||'Participant');if(!emoji)return;
    const replacement=document.createElement('div');replacement.className='ds-reaction-float';replacement.innerHTML=`<b>${esc(emoji)}</b><span>${esc(name)}</span>`;node.replaceWith(replacement);setTimeout(()=>replacement.remove(),6300);
  }

  function ensureSharePermissionDialog(){
    if(sharePermissionDialog?.isConnected)return sharePermissionDialog;
    sharePermissionDialog=document.createElement('section');sharePermissionDialog.className='ds-share-permission';sharePermissionDialog.hidden=true;sharePermissionDialog.setAttribute('role','dialog');sharePermissionDialog.setAttribute('aria-modal','true');sharePermissionDialog.innerHTML='<div class="ds-share-permission-card"><div class="ds-share-permission-icon">↥</div><div><p>SCREEN SHARING</p><h3>Screen access is not active for this running copy</h3><span data-ds-share-permission-copy></span></div><div class="ds-share-permission-actions"><button type="button" data-ds-share-cancel>Not now</button><button type="button" data-ds-share-recheck>Recheck</button><button type="button" data-ds-share-settings class="primary">Open System Settings</button></div></div>';document.body.append(sharePermissionDialog);
    sharePermissionDialog.querySelector('[data-ds-share-cancel]').onclick=()=>{sharePermissionDialog.hidden=true;};
    sharePermissionDialog.querySelector('[data-ds-share-recheck]').onclick=()=>{sharePermissionDialog.hidden=true;void openSmartSharePicker();};
    sharePermissionDialog.querySelector('[data-ds-share-settings]').onclick=async()=>{try{sessionStorage.setItem('ds_screen_settings_opened','1');}catch{}await desktop.media?.openPrivacy?.('screen');updateSharePermissionCopy('settings-opened');};
    return sharePermissionDialog;
  }
  function updateSharePermissionCopy(reason='blocked',status='unknown'){
    const dialog=ensureSharePermissionDialog(),copy=dialog.querySelector('[data-ds-share-permission-copy]');const opened=(()=>{try{return sessionStorage.getItem('ds_screen_settings_opened')==='1';}catch{return false;}})();
    if(copy){
      if(opened||reason==='settings-opened')copy.textContent='DominionStar Meet will recheck real screen sources when you click Recheck. If macOS still blocks capture after the switch is enabled, fully quit DominionStar Meet and reopen this same installed copy from Applications; macOS can require a process restart before a new Screen Recording grant takes effect.';
      else if(status==='not-determined')copy.textContent='Enable DominionStar Meet in Privacy & Security → Screen & System Audio Recording, then return here and click Recheck.';
      else copy.textContent='The app tested real screen-source access and macOS did not return a usable source. Open Screen & System Audio Recording, confirm DominionStar Meet is enabled, then click Recheck.';
    }
    dialog.hidden=false;
  }
  async function showSharePermissionRecovery(result){
    let status='unknown';try{status=String((await desktop.media?.permissions?.())?.screen||'unknown');}catch{}
    updateSharePermissionCopy(result?.timedOut?'timeout':'blocked',status);
  }

  function ensureSmartSharePicker(){
    if(sharePicker?.isConnected)return sharePicker;
    sharePicker=document.createElement('section');sharePicker.id='dsSmartSharePicker';sharePicker.className='ds-smart-share-picker';sharePicker.hidden=true;sharePicker.setAttribute('role','dialog');sharePicker.setAttribute('aria-modal','true');
    sharePicker.innerHTML='<div class="ds-share-picker-card"><header><div><p>SHARE SCREEN</p><h2>Choose what to share</h2></div><button type="button" data-ds-share-close aria-label="Close">×</button></header><nav><button type="button" data-share-kind="screen" class="active">Screens</button><button type="button" data-share-kind="window">Windows</button></nav><div class="ds-share-source-status" role="status"></div><div class="ds-share-source-grid"></div><footer><label><input type="checkbox" data-share-audio><span>Share sound</span></label><label><input type="checkbox" data-share-optimize><span>Optimize for video clip</span></label><span class="ds-share-footer-spacer"></span><button type="button" data-ds-share-cancel>Cancel</button><button type="button" data-ds-share-start class="primary" disabled>Share</button></footer></div>';
    document.body.append(sharePicker);
    sharePicker.querySelector('[data-ds-share-close]').onclick=()=>closeSmartSharePicker();sharePicker.querySelector('[data-ds-share-cancel]').onclick=()=>closeSmartSharePicker();
    qa('[data-share-kind]',sharePicker).forEach?.(()=>{});
    for(const tab of sharePicker.querySelectorAll('[data-share-kind]'))tab.onclick=()=>{shareKind=tab.dataset.shareKind==='window'?'window':'screen';for(const peer of sharePicker.querySelectorAll('[data-share-kind]'))peer.classList.toggle('active',peer===tab);void loadShareSources(shareKind);};
    sharePicker.querySelector('[data-ds-share-start]').onclick=()=>void commitSmartShare();return sharePicker;
  }
  function closeSmartSharePicker(){if(sharePicker)sharePicker.hidden=true;selectedShareId='';}
  function renderShareSources(kind,result){
    const picker=ensureSmartSharePicker(),grid=picker.querySelector('.ds-share-source-grid'),status=picker.querySelector('.ds-share-source-status'),start=picker.querySelector('[data-ds-share-start]');const sources=Array.isArray(result?.sources)?result.sources:[];shareSources[kind]=sources;selectedShareId='';start.disabled=true;
    status.textContent=sources.length?`${sources.length} ${kind==='screen'?'screen':'window'}${sources.length===1?'':'s'} available`:'No shareable sources were returned.';
    grid.innerHTML=sources.map(source=>`<button type="button" class="ds-share-source" data-source-id="${esc(source.id)}"><span class="ds-share-thumb">${source.thumbnail?`<img src="${esc(source.thumbnail)}" alt="">`:'<span class="ds-share-placeholder">▣</span>'}</span><strong>${esc(source.name||'Untitled source')}</strong></button>`).join('');
    for(const card of grid.querySelectorAll('.ds-share-source'))card.onclick=()=>{selectedShareId=String(card.dataset.sourceId||'');for(const peer of grid.querySelectorAll('.ds-share-source'))peer.classList.toggle('selected',peer===card);start.disabled=!selectedShareId;};
  }
  async function loadShareSources(kind){
    const picker=ensureSmartSharePicker(),grid=picker.querySelector('.ds-share-source-grid'),status=picker.querySelector('.ds-share-source-status');status.textContent='Checking macOS screen access…';grid.innerHTML='<div class="ds-share-loading"><i></i><span>Loading shareable sources…</span></div>';
    let result;try{result=await desktop.sharePicker?.listSources?.({kind,includeDominionStar:false});}catch(error){result={ok:false,error:String(error?.message||error||'source_list_failed'),sources:[]};}
    if(!result?.ok||!Array.isArray(result.sources)||result.sources.length===0){picker.hidden=true;await showSharePermissionRecovery(result||{});return false;}
    try{sessionStorage.removeItem('ds_screen_settings_opened');}catch{}
    renderShareSources(kind,result);return true;
  }
  async function openSmartSharePicker(){
    if(!desktop.sharePicker?.listSources||!desktop.sharePicker?.choose)return false;
    const state=window.DominionShareController?.snapshot?.()||{};if(state.active){window.DominionMeetingNotifications?.toast?.('A share is already active. Use New Share from the floating share toolbar.');return false;}
    const picker=ensureSmartSharePicker();shareKind='screen';for(const tab of picker.querySelectorAll('[data-share-kind]'))tab.classList.toggle('active',tab.dataset.shareKind==='screen');picker.hidden=false;const ok=await loadShareSources('screen');return ok;
  }
  async function commitSmartShare(){
    if(!selectedShareId)return;const picker=ensureSmartSharePicker(),start=picker.querySelector('[data-ds-share-start]');start.disabled=true;const options={shareAudio:Boolean(picker.querySelector('[data-share-audio]')?.checked),optimizeVideo:Boolean(picker.querySelector('[data-share-optimize]')?.checked)};
    try{const result=await desktop.sharePicker.choose(selectedShareId,options);if(result?.ok===false)throw new Error(result.error||'share_source_not_available');closeSmartSharePicker();}
    catch(error){start.disabled=false;picker.querySelector('.ds-share-source-status').textContent=String(error?.message||error||'That source is no longer available. Choose another source.');}
  }
  function installShareAuthority(){
    const button=q('#roomShare');if(button&&button.dataset.dsPhysicalShareAuthority!=='1'){
      button.dataset.dsPhysicalShareAuthority='1';button.addEventListener('click',event=>{if(!inMeeting())return;event.preventDefault();event.stopImmediatePropagation();event.currentTarget.blur();void openSmartSharePicker();},true);
    }
    if(!presenterUnsub&&desktop.share?.onPresenterCommand){presenterUnsub=desktop.share.onPresenterCommand(command=>{if(String(command||'')==='smart-new-share')void openSmartSharePicker();});}
  }

  function installReactionBubbleObserver(){
    const layer=q('#meetingReactionLayer');if(!layer||reactionObserver)return;reactionObserver=new MutationObserver(records=>{for(const record of records)for(const node of record.addedNodes)if(node instanceof HTMLElement&&node.classList.contains('meeting-reaction-bubble')&&node.dataset.dsUpgraded!=='1')upgradeReactionBubble(node);});reactionObserver.observe(layer,{childList:true});
  }

  function sync(){
    if(!inMeeting()){closeTransientMenus();return;}
    installViewAuthority();installHostToolsAuthority();installMoreAuthority();installParticipantAuthority();installReactionAuthority();installReactionBubbleObserver();installShareAuthority();decorateParticipantRows();setReactionIcon();
  }

  window.addEventListener('dominion:meeting-signal',event=>{
    const detail=event.detail||{},payload=detail.payload||{};if(detail.type!=='reaction'||payload.kind!=='media-state')return;const id=String(detail.fromParticipantId||payload.participantId||'');if(!id)return;remoteMediaState.set(id,{micOn:Boolean(payload.micOn),cameraOn:Boolean(payload.cameraOn),at:payload.at||Date.now()});decorateParticipantRows();
  },true);
  window.addEventListener('dominion:meeting-snapshot',()=>{void refreshLocalParticipantId().then(()=>{decorateParticipantRows();scheduleMediaBroadcast(140);});});
  window.addEventListener('dominion:meeting-ui-ready',()=>setTimeout(sync,0));
  document.addEventListener('pointerdown',event=>{
    if(commandMenu&&!commandMenu.contains(event.target)&&!event.target.closest?.('#roomMore,#roomHostTools,#meetingViewButton'))closeCommandMenu();
    if(reactionMenu&&!reactionMenu.contains(event.target)&&!event.target.closest?.('#roomReactions'))closeReactionMenu();
    if(selfMenu&&!selfMenu.contains(event.target)&&!event.target.closest?.('[data-ds-self-more]'))closeSelfMenu();
  },true);
  window.addEventListener('resize',()=>{closeTransientMenus();},{passive:true});

  const timer=setInterval(sync,700);sync();
  window.DominionZoomPhysicalAcceptance=Object.freeze({version:'2.0.11-physical-acceptance',sync,openSmartSharePicker,decorateParticipantRows,broadcastLocalMediaState,dispose:()=>{clearInterval(timer);clearTimeout(mediaBroadcastTimer);participantObserver?.disconnect();reactionObserver?.disconnect();mediaUnsub?.();presenterUnsub?.();closeTransientMenus();sharePicker?.remove();sharePermissionDialog?.remove();}});
})();
