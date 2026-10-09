(()=>{
  if(window.DominionZoomPhysicalAcceptance)return;

  const desktop=window.dominionDesktop||{};
  const desktopCanonical=Boolean(desktop?.isDesktop);
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
  const sharingParticipantIds=new Set();
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
  let shareUnsub=null;
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
    return parity()?.openSecurity?.(button||q('#roomHostTools'));
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
      addCommand(menu,'Export diagnostic report',()=>void window.DominionPhysicalDiagnostics?.exportReport?.());
      addCommand(menu,'Reset participant video panel',()=>parity()?.resetVideoDock?.());
      const dock=q('#participantVideoDock');if(dock&&!dock.hidden)addCommand(menu,'Hide participant video',()=>{dock.hidden=true;});
    };
  }

  const MIC_ON='<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5.5 11.5a6.5 6.5 0 0 0 13 0M12 18v3M9 21h6"/></svg>';
  const MIC_OFF=MIC_ON;
  const VIDEO_ON='<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="6" width="13" height="12" rx="3"/><path d="m16 10 5-3v10l-5-3z"/></svg>';
  const VIDEO_OFF=VIDEO_ON;

  async function refreshLocalParticipantId(){try{const ctx=await meeting?.context?.();localParticipantId=String(ctx?.participantId||localParticipantId||'');}catch{}return localParticipantId;}
  function statusFor(id){
    if(String(id)===String(localParticipantId)){
      const snap=media()?.snapshot?.()||{};return {micOn:Boolean(snap.micOn),cameraOn:Boolean(snap.cameraOn),known:true};
    }
    const state=remoteMediaState.get(String(id));return state?{...state,known:true}:{micOn:false,cameraOn:false,known:false};
  }
  function mediaStatusNode(row,id){
    // One canonical media-status surface only. Older builds created a second
    // ds-participant-media strip, which visually doubled mute slashes/icons.
    for(const legacy of [...row.querySelectorAll('.ds-participant-media')])legacy.remove();
    let wrap=row.querySelector('.participant-media-state');
    if(!wrap){
      wrap=document.createElement('span');
      wrap.className='participant-media-state';
      wrap.setAttribute('aria-label','Participant media status');
      const actions=row.querySelector('.participant-actions');
      actions?.before(wrap)||row.append(wrap);
    }
    let mic=wrap.querySelector('[data-participant-mic]'),video=wrap.querySelector('[data-participant-video]');
    if(!mic){
      mic=document.createElement('span');mic.dataset.participantMic='';
      mic.className='participant-media-icon participant-mic unknown';
      mic.innerHTML=MIC_ON;wrap.append(mic);
    }
    if(!video){
      video=document.createElement('span');video.dataset.participantVideo='';
      video.className='participant-media-icon participant-video unknown';
      video.innerHTML=VIDEO_ON;wrap.append(video);
    }
    mic.classList.add('participant-media-icon','participant-mic');
    video.classList.add('participant-media-icon','participant-video');
    mic.classList.remove('ds-media-state');video.classList.remove('ds-media-state');
    const existingMicOn=mic.classList.contains('on'),existingCameraOn=video.classList.contains('on');
    const state=statusFor(id),micOn=state.known?state.micOn:existingMicOn,cameraOn=state.known?state.cameraOn:existingCameraOn;
    const micTitle=state.known?(micOn?'Microphone on':'Microphone muted'):'Audio status syncing';
    const videoTitle=state.known?(cameraOn?'Video on':'Video off'):'Video status syncing';
    mic.classList.toggle('unknown',!state.known);mic.classList.toggle('on',micOn);mic.classList.toggle('off',!micOn);
    video.classList.toggle('unknown',!state.known);video.classList.toggle('on',cameraOn);video.classList.toggle('off',!cameraOn);
    if(mic.title!==micTitle)mic.title=micTitle;if(mic.getAttribute('aria-label')!==micTitle)mic.setAttribute('aria-label',micTitle);
    if(video.title!==videoTitle)video.title=videoTitle;if(video.getAttribute('aria-label')!==videoTitle)video.setAttribute('aria-label',videoTitle);
    return wrap;
  }
  const SHARE_ON='<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3.5" y="5" width="17" height="13" rx="2"/><path d="M8 12h8M13 9l3 3-3 3"/></svg>';
  function participantShareStateNode(row,id){
    const active=sharingParticipantIds.has(String(id));
    let node=row.querySelector('.ds-participant-share-state');
    if(!active){node?.remove();return null;}
    if(!node){node=document.createElement('span');node.className='ds-participant-share-state';node.setAttribute('title','Sharing screen');node.setAttribute('aria-label','Sharing screen');}
    if(!node.firstElementChild)node.innerHTML=SHARE_ON;
    const actions=row.querySelector('.participant-actions');if(actions&&node.parentElement!==actions)actions.prepend(node);
    return node;
  }

  function participantIsSelf(row,id){
    const pid=String(id||row?.dataset?.participantId||''),small=String(row?.querySelector?.('.person-copy small')?.textContent||'').toLowerCase();
    if((pid&&pid===String(localParticipantId||''))||row?.dataset?.participantSelf==='1'||/\byou\b|\bme\b/.test(small))return true;
    if(localParticipantId)return false;
    const role=String(row?.dataset?.participantRole||'participant').toLowerCase().replace('-','');
    if(!['host','cohost'].includes(role)||role!==localRole())return false;
    const sameRole=qa('#participantRoster [data-participant-id]').filter(node=>String(node.dataset.participantRole||'participant').toLowerCase().replace('-','')===role);
    return sameRole.length===1&&sameRole[0]===row;
  }

  function ensureSelfMore(row){
    const id=String(row.dataset.participantId||'');
    if(!participantIsSelf(row,id))return;
    const actions=row.querySelector('.participant-actions');if(!actions)return;
    const candidates=[...actions.querySelectorAll('[data-participant-more],[data-ds-self-more],.ds-host-row-more')];
    let button=candidates.find(node=>node.dataset.dsSelfMore==='1')||candidates[0]||null;
    for(const node of candidates)if(node!==button)node.remove();
    if(!button){
      button=document.createElement('button');button.type='button';button.dataset.dsSelfMore='1';button.className='participant-more ds-participant-more';actions.append(button);
    }
    button.dataset.dsSelfMore='1';button.classList.add('participant-more','ds-participant-more');
    if(button.textContent!=='•••')button.textContent='•••';
    if(button.getAttribute('aria-label')!=='More options for yourself')button.setAttribute('aria-label','More options for yourself');
    if(button.dataset.dsSelfMoreBound!=='1'){
      button.dataset.dsSelfMoreBound='1';
      button.addEventListener('click',event=>{event.stopPropagation();openSelfParticipantMenu(button,row);});
    }
    if(button.parentElement!==actions)actions.append(button);
  }
  function openSelfParticipantMenu(button,row){
    closeTransientMenus();const id=String(row.dataset.participantId||'');selfMenu=document.createElement('div');selfMenu.className='ds-command-menu ds-self-participant-menu';document.body.append(selfMenu);
    const mediaState=window.DominionMediaController?.snapshot?.()||{};
    const addSelfAction=(label,handler)=>{const item=document.createElement('button');item.type='button';item.className='ds-command-item';item.innerHTML=`<span></span><strong>${label}</strong>`;item.onclick=()=>{closeSelfMenu();void handler();};selfMenu.append(item);};
    addSelfAction(mediaState.micOn?'Mute':'Unmute',()=>window.DominionMediaController?.setMicrophone?.(!mediaState.micOn));
    addSelfAction(mediaState.cameraOn?'Stop Video':'Start Video',()=>window.DominionMediaController?.setCamera?.(!mediaState.cameraOn));
    addSelfAction('Rename',()=>openRenamePrompt(id,String(row.dataset.participantName||'')));
    addSelfAction('Copy display name',async()=>{try{await navigator.clipboard.writeText(String(row.dataset.participantName||''));}catch{}});
    positionMenu(selfMenu,button,{width:220,above:false});
  }
  function openRenamePrompt(id,currentName){
    let dialog=q('#dsRenameSelfDialog');if(!dialog){dialog=document.createElement('dialog');dialog.id='dsRenameSelfDialog';dialog.className='ds-modern-dialog';dialog.innerHTML='<form method="dialog"><header><strong>Rename</strong><button value="cancel" aria-label="Close">×</button></header><label><span>Display name</span><input maxlength="100" autocomplete="off"></label><p class="ds-dialog-status"></p><footer><button value="cancel">Cancel</button><button type="submit" value="default" class="primary">Save</button></footer></form>';document.body.append(dialog);}
    const form=dialog.querySelector('form'),input=dialog.querySelector('input'),status=dialog.querySelector('.ds-dialog-status');input.value=currentName;status.textContent='';
    form.onsubmit=async event=>{event.preventDefault();const next=String(input.value||'').trim();if(!next)return;try{await meeting?.renameParticipant?.(id,next);dialog.close();}catch(error){status.textContent=String(error?.message||error||'Rename failed.');}};
    if(!dialog.open)dialog.showModal();setTimeout(()=>{input.focus();input.select();},20);
  }

  function normalizeParticipantIdentity(row,id){
    const copy=row.querySelector('.person-copy');if(!copy)return;
    const name=String(row.dataset.participantName||'Participant').trim()||'Participant';
    const role=String(row.dataset.participantRole||'participant').toLowerCase().replace('-','');
    const self=participantIsSelf(row,id);row.dataset.participantSelf=self?'1':'0';row.dataset.dsAdaptiveSelf=self?'1':'0';
    for(const node of copy.querySelectorAll('.ds-role-chip,.ds-participant-role-badge,.ds-participant-self-label,.ds-adaptive-role,.ds-canonical-role,.ds-canonical-self'))node.remove();
    let strong=copy.querySelector('strong');
    if(!strong){strong=document.createElement('strong');copy.prepend(strong);}
    let nameNode=strong.querySelector('.participant-name-text');
    if(!nameNode){nameNode=document.createElement('span');nameNode.className='participant-name-text';strong.prepend(nameNode);}
    if(nameNode.textContent!==name)nameNode.textContent=name;if(strong.title!==name)strong.title=name;
    let inline=strong.querySelector('.participant-you');
    if(!inline){inline=document.createElement('em');inline.className='participant-you';strong.append(inline);}
    const inlineRole=role==='host'?(self?'(Host, me)':'(Host)'):role==='cohost'?(self?'(Co-host, me)':'(Co-host)'):(self?'(me)':'');
    if(inline.textContent!==inlineRole)inline.textContent=inlineRole;if(inline.hidden===Boolean(inlineRole))inline.hidden=!inlineRole;
    let small=copy.querySelector('small');
    if(!small){small=document.createElement('small');copy.append(small);}
    if(small.textContent)small.textContent='';if(!small.hidden)small.hidden=true;
  }

  function decorateParticipantRows(){
    if(!inMeeting())return;
    window.DominionParticipantControls?.sync?.();
    for(const row of qa('#participantRoster [data-participant-id]')){
      const id=String(row.dataset.participantId||'');if(!id)continue;
      row.classList.add('ds-modern-participant-row');
      let actions=row.querySelector('.participant-actions');if(!actions){actions=document.createElement('span');actions.className='participant-actions ds-participant-actions';row.append(actions);}else actions.classList.add('ds-participant-actions');
      mediaStatusNode(row,id);
      participantShareStateNode(row,id);
      const self=participantIsSelf(row,id);
      if(self)ensureSelfMore(row);
      else{
        const moreButtons=[...actions.querySelectorAll('[data-participant-more],.ds-host-row-more,[data-ds-self-more]')];
        const more=moreButtons.find(node=>node.matches('[data-participant-more]'))||moreButtons[0]||null;
        for(const node of moreButtons)if(node!==more)node.remove();
        if(more){more.textContent='•••';more.classList.add('ds-participant-more');more.setAttribute('aria-label',`More options for ${String(row.dataset.participantName||'participant')}`);more.onclick=event=>{event.stopPropagation();void window.DominionParticipantControls?.openParticipantMenu?.(more);};actions.append(more);}
      }
      normalizeParticipantIdentity(row,id);
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
    const roster=q('#participantRoster');if(roster&&!participantObserver){participantObserver=new MutationObserver(()=>requestAnimationFrame(decorateParticipantRows));participantObserver.observe(roster,{childList:true,subtree:false});}
    void refreshLocalParticipantId().then(()=>decorateParticipantRows());
    if(!mediaUnsub&&media()?.onChange){mediaUnsub=media().onChange(()=>{decorateParticipantRows();scheduleMediaBroadcast(80);});}
    if(!shareUnsub&&window.DominionShareController?.onChange){
      shareUnsub=window.DominionShareController.onChange(state=>{void refreshLocalParticipantId().then(()=>{const id=String(localParticipantId||'');if(id){if(state?.active)sharingParticipantIds.add(id);else sharingParticipantIds.delete(id);}decorateParticipantRows();});});
    }
  }

  function setReactionIcon(){
    const icon=q('#roomReactions .ds-control-icon');if(!icon||icon.dataset.dsReactionIcon==='1')return;icon.dataset.dsReactionIcon='1';icon.innerHTML='<span class="reaction-emoji-glyph" aria-hidden="true">😊</span>';
  }
  function installReactionAuthority(){
    const button=q('#roomReactions');if(!button)return;setReactionIcon();
    // Final React ownership belongs to DominionMeetingFeatures + RuntimeStability.
    // This compatibility layer may observe reaction animations, but it must not
    // install a second button handler or create a second chooser.
    button.setAttribute('aria-haspopup','menu');
    const layer=q('#meetingReactionLayer');if(layer&&!reactionObserver){reactionObserver=new MutationObserver(records=>{for(const record of records){for(const node of record.addedNodes){if(!(node instanceof HTMLElement)||!node.classList.contains('meeting-reaction-bubble')||node.dataset.dsUpgraded==='1')continue;upgradeReactionBubble(node);}}});reactionObserver.observe(layer,{childList:true});}
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

  const onMeetingSignal=event=>{
    if(desktopCanonical&&window.DominionRuntimeStability)return;
    const detail=event.detail||{},payload=detail.payload||{};if(detail.type!=='reaction'||payload.kind!=='media-state')return;const id=String(detail.fromParticipantId||payload.participantId||'');if(!id)return;remoteMediaState.set(id,{micOn:Boolean(payload.micOn),cameraOn:Boolean(payload.cameraOn),at:payload.at||Date.now()});decorateParticipantRows();
  };
  const onRemoteShareState=event=>{
    if(desktopCanonical&&window.DominionRuntimeStability)return;
    const id=String(event.detail?.participantId||'');if(!id)return;if(event.detail?.active)sharingParticipantIds.add(id);else sharingParticipantIds.delete(id);decorateParticipantRows();
  };
  const onMeetingSnapshot=()=>{if(desktopCanonical&&window.DominionRuntimeStability)return;void refreshLocalParticipantId().then(()=>{decorateParticipantRows();scheduleMediaBroadcast(140);});};
  const onMeetingEnded=()=>{sharingParticipantIds.clear();remoteMediaState.clear();if(!(desktopCanonical&&window.DominionRuntimeStability))decorateParticipantRows();};
  const onMeetingReady=()=>{if(!desktopCanonical)setTimeout(sync,0);};
  const onPointerDown=event=>{
    if(commandMenu&&!commandMenu.contains(event.target)&&!event.target.closest?.('#roomMore,#roomHostTools,#meetingViewButton'))closeCommandMenu();
    if(reactionMenu&&!reactionMenu.contains(event.target)&&!event.target.closest?.('#roomReactions'))closeReactionMenu();
    if(selfMenu&&!selfMenu.contains(event.target)&&!event.target.closest?.('[data-ds-self-more]'))closeSelfMenu();
  };
  const onResize=()=>{closeTransientMenus();};
  window.addEventListener('dominion:meeting-signal',onMeetingSignal,true);
  window.addEventListener('dominion:remote-share-state',onRemoteShareState,true);
  window.addEventListener('dominion:meeting-snapshot',onMeetingSnapshot);
  window.addEventListener('dominion:meeting-ended',onMeetingEnded,true);
  window.addEventListener('dominion:meeting-ui-ready',onMeetingReady);
  document.addEventListener('pointerdown',onPointerDown,true);
  window.addEventListener('resize',onResize,{passive:true});

  const timer=desktopCanonical?0:setInterval(sync,700);if(!desktopCanonical)sync();
  window.DominionZoomPhysicalAcceptance=Object.freeze({version:'2.0.53-manual-desktop-acceptance',sync,openSmartSharePicker,decorateParticipantRows,broadcastLocalMediaState,dispose:()=>{if(timer)clearInterval(timer);clearTimeout(mediaBroadcastTimer);participantObserver?.disconnect();reactionObserver?.disconnect();mediaUnsub?.();shareUnsub?.();presenterUnsub?.();window.removeEventListener('dominion:meeting-signal',onMeetingSignal,true);window.removeEventListener('dominion:remote-share-state',onRemoteShareState,true);window.removeEventListener('dominion:meeting-snapshot',onMeetingSnapshot);window.removeEventListener('dominion:meeting-ended',onMeetingEnded,true);window.removeEventListener('dominion:meeting-ui-ready',onMeetingReady);document.removeEventListener('pointerdown',onPointerDown,true);window.removeEventListener('resize',onResize);closeTransientMenus();sharePicker?.remove();sharePermissionDialog?.remove();}});
})();
