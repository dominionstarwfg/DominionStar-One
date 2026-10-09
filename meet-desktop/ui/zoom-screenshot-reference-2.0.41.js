(()=>{
  if(window.DominionZoomScreenshotReference)return;
  const q=s=>document.querySelector(s),qa=s=>[...document.querySelectorAll(s)];
  const participants=()=>window.DominionParticipantControls||null;
  const meeting=()=>window.dominionDesktop?.meeting||null;
  const prefs=()=>window.DominionPreferences||null;
  let syncQueued=false,presenterTimer=0,notesDialog=null,hostPanel=null,participantBulkMenu=null,participantInviteMenu=null,meetingMoreMenu=null,transientEpoch=0;

  const sym=Object.freeze({plus:'＋',bell:'♧',calendar:'▣',record:'◉',captions:'CC',breakout:'▦',polls:'▥',docs:'▤',whiteboard:'▱',apps:'⌘',info:'ⓘ',transfer:'⇥',settings:'⚙'});
  const esc=value=>String(value||'').replace(/[&<>\"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;'}[c]));
  function ensureCriticalMeetingGeometry(){
    let style=q('style[data-ds-ref-critical-meeting-geometry]');
    if(!style){
      style=document.createElement('style');
      style.dataset.dsRefCriticalMeetingGeometry='1';
      document.head.append(style);
    }
    style.textContent=`
      #meetingOverlay .meeting-shell{grid-template-rows:47px minmax(0,1fr) 56px!important}
      #meetingOverlay .meeting-footer,
      #meetingOverlay .meeting-footer[data-ds-runtime-toolbar-zones="1"]{
        height:56px!important;min-height:56px!important;max-height:56px!important;
        box-sizing:border-box!important;padding-top:0!important;padding-bottom:0!important
      }
      #meetingOverlay .ds-runtime-toolbar-left,
      #meetingOverlay .ds-runtime-toolbar-center,
      #meetingOverlay .ds-runtime-toolbar-right{height:56px!important;min-height:56px!important;max-height:56px!important}
      #meetingOverlay #roomReactions .ds-control-label{font-size:10px!important;line-height:1.1!important;white-space:nowrap!important}
      #meetingOverlay .meeting-body{min-height:0!important}
    `;
    const footer=q('#meetingOverlay .meeting-footer');
    if(footer){
      for(const prop of ['height','min-height','max-height'])footer.style.setProperty(prop,'56px','important');
      footer.style.setProperty('box-sizing','border-box','important');
      footer.style.setProperty('padding-top','0','important');
      footer.style.setProperty('padding-bottom','0','important');
    }
    for(const zone of qa('#meetingOverlay .ds-runtime-toolbar-left,#meetingOverlay .ds-runtime-toolbar-center,#meetingOverlay .ds-runtime-toolbar-right')){
      for(const prop of ['height','min-height','max-height'])zone.style.setProperty(prop,'56px','important');
    }
  }
  function setVisibleLabel(button,text){
    if(!button)return;
    let label=button.querySelector('.ds-control-label');
    if(!label){
      const icon=button.querySelector('.ds-control-icon');
      if(icon){
        label=document.createElement('span');
        label.className='ds-control-label';
        icon.insertAdjacentElement('afterend',label);
      }else if(!button.querySelector('svg')){
        button.textContent=text;
        return;
      }
    }
    if(label&&label.textContent!==text)label.textContent=text;
  }
  function notice(title,copy){const d=q('#foundationDialog');if(!d)return;q('#foundationTitle').textContent=title;q('#foundationCopy').textContent=copy;if(!d.open)d.showModal();}
  function ensureDeterministicPresenterIdle(){if(document.querySelector('style[data-ds-ref-presenter-idle]'))return;const style=document.createElement('style');style.dataset.dsRefPresenterIdle='1';style.textContent='#meetingOverlay.share-active:not(.ds-ref-presenter-visible) #inlinePresenterToolbar{opacity:0!important;pointer-events:none!important;transition:none!important;transform:translateX(-50%) translateY(-12px)!important}';document.head.append(style);}

  function ensureHomeTopbar(){const shell=q('#appShell');if(!shell)return;let bar=q('.ds-ref-home-topbar');if(!bar){bar=document.createElement('div');bar.className='ds-ref-home-topbar';bar.innerHTML=`<div class="ds-ref-nav-arrows"><span>‹</span><span>›</span></div><input class="ds-ref-search" type="search" placeholder="Search (⌘E)" aria-label="Search DominionStar Meet"><div class="ds-ref-top-icons"><button type="button" data-ref-plus aria-label="New meeting">${sym.plus}</button><button type="button" data-ref-bell aria-label="Notifications">${sym.bell}</button><button type="button" data-ref-calendar aria-label="Meetings">${sym.calendar}</button></div>`;shell.append(bar);bar.querySelector('[data-ref-plus]').onclick=()=>q('[data-action="new-meeting"]')?.click();bar.querySelector('[data-ref-calendar]').onclick=()=>q('.nav-button[data-section="meetings"]')?.click();bar.querySelector('[data-ref-bell]').onclick=()=>notice('Notifications','No new DominionStar Meet notifications.');const search=bar.querySelector('.ds-ref-search');search.addEventListener('keydown',event=>{if(event.key!=='Enter')return;const term=String(search.value||'').trim().toLowerCase();if(!term)return;const action=qa('#homeSection .action-card').find(button=>String(button.textContent||'').toLowerCase().includes(term));if(action){action.focus();action.scrollIntoView({block:'center'});}else if(/meeting|schedule|calendar/.test(term))q('.nav-button[data-section="meetings"]')?.click();});}bar.hidden=shell.hidden||q('#homeSection')?.hidden===true;}
  function ensureNotesAction(){const actions=q('#homeSection .quick-actions');if(!actions||actions.querySelector('.ds-ref-notes'))return;const button=document.createElement('button');button.type='button';button.className='action-card ds-ref-notes';button.style.gridColumn='1 / -1';button.style.justifySelf='center';button.innerHTML='<span class="action-icon"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 19h14M7 16l9-9 2 2-9 9-4 1z"/></svg></span><strong>My Notes</strong><small>Private local notes</small>';button.onclick=openNotes;actions.append(button);}
  function openNotes(){if(!notesDialog){notesDialog=document.createElement('dialog');notesDialog.className='modal compact-modal ds-ref-notes-dialog';notesDialog.innerHTML='<form method="dialog"><header><div><h2>My Notes</h2></div><button class="modal-close" value="cancel" aria-label="Close">×</button></header><textarea aria-label="Private meeting notes" placeholder="Write a note…" style="width:100%;height:220px;resize:none;border:1px solid #444;border-radius:8px;background:#17181a;color:#fff;padding:12px;font:inherit"></textarea><div class="modal-actions"><button value="cancel" class="secondary-button">Close</button><button type="button" class="primary-button" data-save>Save</button></div></form>';document.body.append(notesDialog);const text=notesDialog.querySelector('textarea');try{text.value=localStorage.getItem('ds_my_notes')||'';}catch{}notesDialog.querySelector('[data-save]').onclick=()=>{try{localStorage.setItem('ds_my_notes',text.value);}catch{}notesDialog.close();};}if(!notesDialog.open)notesDialog.showModal();}

  function ensurePrejoin(){const overlay=q('#prejoinOverlay'),footer=overlay?.querySelector('.prejoin-window>footer');if(!overlay||!footer)return;const strong=q('#prejoinBackgrounds strong');if(strong)strong.textContent='Backgrounds';let pref=footer.querySelector('.ds-ref-prejoin-pref');if(!pref){pref=document.createElement('label');pref.className='ds-ref-prejoin-pref';pref.innerHTML='<input type="checkbox" checked><span>Always show this preview when joining</span><span title="You can change this in Settings">ⓘ</span>';footer.prepend(pref);const input=pref.querySelector('input');try{const saved=localStorage.getItem('ds_pref_show_join_preview');input.checked=saved===null?true:saved==='1';}catch{}input.onchange=()=>{try{localStorage.setItem('ds_pref_show_join_preview',input.checked?'1':'0');}catch{}};}}
  function ensureMeetingHead(){const head=q('#meetingOverlay .meeting-head');if(!head)return;head.querySelector('.ds-ref-meeting-head-icons')?.remove();const view=q('#meetingViewButton');if(view){view.setAttribute('aria-label','View');view.title='View';}}
  function ensureCoreMeetingControls(){
    const overlay=q('#meetingOverlay');if(!overlay||overlay.hidden)return;
    try{window.DominionMeetingParity?.install?.();}catch{}
    try{window.DominionApprovedReferenceParity?.ensureRaiseHandControl?.();}catch{}
    const role=String(q('#roomRole')?.textContent||'').trim().toLowerCase().replace('-','');
    if(['host','cohost'].includes(role)&&!q('#roomHostTools')){
      const footer=q('.meeting-footer'),more=q('#roomMore'),exit=q('#roomExitButton');if(footer){
        const button=document.createElement('button');button.id='roomHostTools';button.type='button';button.className='meeting-control zoom-host-tools-control';button.setAttribute('aria-label','Host Tools');button.innerHTML='<span class="ds-control-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M12 3 5 6v5c0 4.5 2.8 8 7 10 4.2-2 7-5.5 7-10V6z"/><path d="M8.5 12h7M12 8.5v7"/></svg></span><span class="ds-control-label">Host Tools</span>';
        const anchor=more?.isConnected?more:(exit?.isConnected?exit:null);anchor?.parentElement?.insertBefore(button,anchor)||footer.append(button);
      }
    }
  }
  function bindPrimaryToolbar(){
    const host=q('#roomHostTools');if(host&&host.dataset.dsRefHostBound!=='1'){host.dataset.dsRefHostBound='1';host.addEventListener('click',event=>{if(q('#meetingOverlay')?.hidden)return;event.preventDefault();event.stopImmediatePropagation();void openHostToolsPanel();},true);}
    const more=q('#roomMore');if(more&&more.dataset.dsRefMoreBound!=='1'){more.dataset.dsRefMoreBound='1';more.addEventListener('click',event=>{if(q('#meetingOverlay')?.hidden)return;event.preventDefault();event.stopImmediatePropagation();openMeetingMore(event.currentTarget);},true);}
  }
  function syncParticipantVisibility(){const overlay=q('#meetingOverlay'),side=overlay?.querySelector('.room-side');if(!overlay||!side)return;const hidden=Boolean(side.hidden);overlay.classList.toggle('participants-hidden',hidden);if(hidden)closeParticipantBulk();}
  function reconcileAuthoritativeShareClass(){
    const overlay=q('#meetingOverlay'),integration=window.DominionShareIntegration;
    if(!overlay||!integration?.state)return;
    const nativeMacPresenter=document.body.classList.contains('ds-native-mac-presenter-share');
    let active=false;
    try{active=Boolean(integration.state()?.active)&&!nativeMacPresenter;}catch{return;}
    overlay.classList.toggle('share-active',active);
    document.body.classList.toggle('ds-share-active',active);
    if(nativeMacPresenter){
      overlay.classList.remove('ds-ref-presenter-visible');
      const inline=q('#inlinePresenterToolbar');if(inline)inline.hidden=true;
      q('.ds-ref-share-banner')?.remove();
    }
  }
  function syncMeetingLabels(){const overlay=q('#meetingOverlay');if(!overlay||overlay.hidden){document.body.classList.remove('ds-in-meeting','ds-share-active');closeHostPanel();closeMeetingMore();closeParticipantBulk();return;}document.body.classList.add('ds-in-meeting');ensureCoreMeetingControls();syncParticipantVisibility();setVisibleLabel(q('#roomMic'),'Audio');setVisibleLabel(q('#roomCamera'),'Video');setVisibleLabel(q('#roomParticipants'),'Participants');setVisibleLabel(q('#roomChat'),'Chat');setVisibleLabel(q('#roomReactions'),'React');setVisibleLabel(q('#roomRaiseHand'),q('#roomRaiseHand')?.getAttribute('aria-pressed')==='true'?'Lower hand':'Raise hand');setVisibleLabel(q('#roomShare'),'Share');setVisibleLabel(q('#roomHostTools'),'Host tools');setVisibleLabel(q('#roomMore'),'More');setVisibleLabel(q('#roomExitButton'),'End');const count=qa('#participantRoster [data-participant-id]').length||1;if(q('#roomParticipants'))q('#roomParticipants').dataset.dsRefCount=String(count);ensureMeetingHead();bindPrimaryToolbar();ensureParticipantsFooter();syncPresenter();}

  function closeParticipantInvite(){participantInviteMenu?.remove();participantInviteMenu=null;}
  async function copyParticipantInvite(text){
    const value=String(text||'').trim();if(!value)return false;
    try{await navigator.clipboard.writeText(value);return true;}catch{}
    try{const area=document.createElement('textarea');area.value=value;area.setAttribute('readonly','');area.style.position='fixed';area.style.opacity='0';document.body.append(area);area.select();const ok=document.execCommand?.('copy')!==false;area.remove();return Boolean(ok);}catch{return false;}
  }
  function flashFooterButton(button,text,reset,delay=1500){if(!button)return;clearTimeout(Number(button.dataset.dsFlashTimer)||0);button.textContent=text;button.dataset.dsFlashTimer=String(setTimeout(()=>{button.textContent=reset;},delay));}
  function openParticipantInvite(anchor){
    closeParticipantInvite();closeParticipantBulk();
    const side=q('#meetingOverlay .room-side');if(!side||side.hidden)return;
    const info=String(q('#roomCodeLabel')?.textContent||'').trim();
    participantInviteMenu=document.createElement('div');participantInviteMenu.className='ds-ref-invite-menu';
    participantInviteMenu.innerHTML='<strong>Invite to meeting</strong><p data-invite-info></p><div><button type="button" data-copy>Copy invitation</button><button type="button" data-close>Close</button></div>';
    side.append(participantInviteMenu);participantInviteMenu.style.right='8px';participantInviteMenu.style.bottom='52px';
    participantInviteMenu.querySelector('[data-invite-info]').textContent=info||'Meeting information is not available yet.';
    participantInviteMenu.querySelector('[data-copy]').onclick=async event=>{const ok=await copyParticipantInvite(info);flashFooterButton(event.currentTarget,ok?'Copied':'Copy failed','Copy invitation');};
    participantInviteMenu.querySelector('[data-close]').onclick=closeParticipantInvite;
    return anchor;
  }
  function ensureParticipantsFooter(){
    const side=q('#meetingOverlay .room-side');if(!side)return;
    side.querySelector('.zoom-participant-footer')?.remove();
    const count=qa('#participantRoster [data-participant-id]').length||1;
    const head=side.querySelector('.room-side-head');if(head){const strong=head.querySelector('strong');if(strong)strong.textContent=`Participants (${count})`;}
    let footer=side.querySelector('.ds-ref-participants-footer');if(footer)return;
    footer=document.createElement('div');footer.className='ds-ref-participants-footer';
    footer.innerHTML='<button type="button" data-ref-invite>Invite</button><button type="button" data-ref-mute-all>Mute all</button><button type="button" data-ref-participant-more aria-label="More participant controls">More</button>';
    side.append(footer);
    footer.querySelector('[data-ref-invite]').onclick=event=>openParticipantInvite(event.currentTarget);
    footer.querySelector('[data-ref-mute-all]').onclick=async event=>{
      const button=event.currentTarget;
      const result=await participants()?.sendAll?.('host:mute');
      if(result?.reason==='not_authorized')flashFooterButton(button,'Host only','Mute all');
      else if(result?.count===0)flashFooterButton(button,'No one to mute','Mute all');
      else flashFooterButton(button,'Muted','Mute all');
    };
    footer.querySelector('[data-ref-participant-more]').onclick=event=>void openParticipantBulkMenu(event.currentTarget);
  }
  function bumpTransientEpoch(){transientEpoch=(transientEpoch+1)%1000000;return transientEpoch;}
  function closeParticipantBulk(){participantBulkMenu?.remove();participantBulkMenu=null;}
  function closeTransient(){bumpTransientEpoch();closeParticipantInvite();closeParticipantBulk();closeHostPanel();closeMeetingMore();}
  async function currentSecurity(){let ctx={},snap={};try{ctx=await meeting()?.context?.()||{};if(ctx.roomId)snap=await meeting()?.snapshot?.(ctx.roomId)||{};}catch{}return {ctx,snap,locked:Boolean(snap.meetingLocked),muteOnEntry:Boolean(snap.muteOnEntry),waitingRoomEnabled:snap.waitingRoomEnabled!==false};}
  async function setSecurityPatch(patch={}){const state=await currentSecurity();if(!state.ctx.roomId)return false;await meeting()?.setSecurity?.(state.ctx.roomId,{locked:patch.locked??state.locked,muteOnEntry:patch.muteOnEntry??state.muteOnEntry,waitingRoomEnabled:patch.waitingRoomEnabled??state.waitingRoomEnabled});return true;}
  async function openParticipantBulkMenu(anchor){closeParticipantBulk();const side=q('#meetingOverlay .room-side');if(!side||side.hidden)return;const epoch=bumpTransientEpoch();const state=await currentSecurity();if(epoch!==transientEpoch||!side.isConnected||side.hidden)return;participantBulkMenu=document.createElement('div');participantBulkMenu.className='ds-ref-participant-bulk-menu';participantBulkMenu.innerHTML=`<button type="button" data-ask>Ask all to unmute</button><button type="button" data-clear disabled>Clear all feedback</button><div class="ds-ref-bulk-divider"></div><label><span>Mute all upon entry</span><input type="checkbox" data-mute-entry ${state.muteOnEntry?'checked':''}></label><label><span>Play join and leave sound</span><input type="checkbox" data-join-sound ${prefs()?.read?.('joinLeaveSound')!==false?'checked':''}></label><div class="ds-ref-bulk-divider"></div><button type="button" data-host-participants>Host tools for participants</button>`;side.append(participantBulkMenu);participantBulkMenu.style.right='8px';participantBulkMenu.style.bottom='52px';participantBulkMenu.querySelector('[data-ask]').onclick=()=>{closeParticipantBulk();void participants()?.sendAll?.('host:ask-unmute');};participantBulkMenu.querySelector('[data-mute-entry]').onchange=async event=>{event.currentTarget.disabled=true;try{await setSecurityPatch({muteOnEntry:event.currentTarget.checked});}finally{event.currentTarget.disabled=false;}};participantBulkMenu.querySelector('[data-join-sound]').onchange=event=>prefs()?.write?.('joinLeaveSound',event.currentTarget.checked);participantBulkMenu.querySelector('[data-host-participants]').onclick=()=>{closeParticipantBulk();openHostToolsPanel();};}

  function closeHostPanel(){hostPanel?.remove();hostPanel=null;}
  async function openHostToolsPanel(){closeMeetingMore();closeParticipantBulk();closeHostPanel();const epoch=bumpTransientEpoch();const state=await currentSecurity();if(epoch!==transientEpoch||q('#meetingOverlay')?.hidden)return;hostPanel=document.createElement('aside');hostPanel.className='ds-ref-host-tools-panel';hostPanel.innerHTML=`<header><strong>Host tools</strong><span><button type="button" data-popout aria-label="Pop out">↗</button><button type="button" data-close aria-label="Close">×</button></span></header><section><label><span>Lock meeting</span><input type="checkbox" data-lock ${state.locked?'checked':''}></label><label><span>Enable waiting room</span><input type="checkbox" data-waiting ${state.waitingRoomEnabled?'checked':''}></label><label><span>Hide profile pictures</span><input type="checkbox" data-hide-pictures ${document.body.classList.contains('ds-ref-hide-profile-pictures')?'checked':''}></label><button type="button" class="ds-ref-host-nav" data-participants><span>Participants</span><span>›</span></button><button type="button" class="ds-ref-host-nav" data-advanced><span>Advanced</span><span>›</span></button></section>`;document.body.append(hostPanel);hostPanel.querySelector('[data-close]').onclick=closeHostPanel;hostPanel.querySelector('[data-lock]').onchange=async event=>{event.currentTarget.disabled=true;try{await setSecurityPatch({locked:event.currentTarget.checked});}catch{event.currentTarget.checked=!event.currentTarget.checked;}finally{event.currentTarget.disabled=false;}};hostPanel.querySelector('[data-waiting]').onchange=async event=>{event.currentTarget.disabled=true;const wanted=event.currentTarget.checked;try{await setSecurityPatch({waitingRoomEnabled:wanted});if(!wanted){window.DominionMeetingNotifications?.toast?.('Waiting room disabled. Anyone waiting was admitted.','info');}}catch{event.currentTarget.checked=!wanted;}finally{event.currentTarget.disabled=false;}};hostPanel.querySelector('[data-hide-pictures]').onchange=event=>document.body.classList.toggle('ds-ref-hide-profile-pictures',event.currentTarget.checked);hostPanel.querySelector('[data-participants]').onclick=()=>{closeHostPanel();const side=q('#meetingOverlay .room-side');if(side?.hidden)q('#roomParticipants')?.click();};hostPanel.querySelector('[data-advanced]').onclick=()=>openHostAdvanced(hostPanel.querySelector('section'));hostPanel.querySelector('[data-popout]').onclick=()=>hostPanel.classList.toggle('detached');}
  function openHostAdvanced(section){if(!section)return;section.innerHTML='<button type="button" class="ds-ref-host-nav" data-back><span>‹ Host tools</span></button><label><span>Mute participants upon entry</span><input type="checkbox" data-mute-entry></label><button type="button" class="ds-ref-host-nav" data-ask-unmute><span>Ask all to unmute</span><span>›</span></button><button type="button" class="ds-ref-host-nav" data-stop-video><span>Stop participant video</span><span>›</span></button>';void currentSecurity().then(state=>{const input=section.querySelector('[data-mute-entry]');if(input)input.checked=state.muteOnEntry;});section.querySelector('[data-back]').onclick=()=>{closeHostPanel();openHostToolsPanel();};section.querySelector('[data-mute-entry]').onchange=event=>void setSecurityPatch({muteOnEntry:event.currentTarget.checked});section.querySelector('[data-ask-unmute]').onclick=()=>void participants()?.sendAll?.('host:ask-unmute');section.querySelector('[data-stop-video]').onclick=()=>void participants()?.sendAll?.('host:stop-video');}

  function closeMeetingMore(){meetingMoreMenu?.remove();meetingMoreMenu=null;}
  function addMoreItem(grid,label,key,handler,{disabled=false}={}){const b=document.createElement('button');b.type='button';b.disabled=disabled;b.innerHTML=`<span class="ds-ref-more-icon">${sym[key]||'•'}</span><span>${esc(label)}</span>`;b.onclick=()=>{if(disabled)return;closeMeetingMore();handler?.();};grid.append(b);return b;}
  function openMeetingMore(anchor){closeHostPanel();closeParticipantBulk();closeMeetingMore();meetingMoreMenu=document.createElement('div');meetingMoreMenu.className='ds-ref-meeting-more-grid meeting-more-menu';const grid=document.createElement('div');grid.className='ds-ref-meeting-more-items';meetingMoreMenu.append(grid);addMoreItem(grid,'Record','record',()=>window.DominionMeetingFeatures?.toggleRecording?.());addMoreItem(grid,'Show captions','captions',()=>q('#roomCaptions')?.click());addMoreItem(grid,'Polls','polls',()=>window.DominionMeetingTools?.openPolls?.());addMoreItem(grid,'Whiteboard','whiteboard',()=>window.DominionMeetingTools?.openWhiteboard?.());addMoreItem(grid,'Aurora Assist','apps',()=>window.DominionAuroraMeet?.open?.());addMoreItem(grid,'Apps','apps',()=>window.DominionMeetingTools?.openApps?.());addMoreItem(grid,'Meeting info','info',()=>notice('Meeting information',String(q('#roomCodeLabel')?.textContent||'DominionStar meeting')));addMoreItem(grid,'Settings','settings',()=>{const d=q('#settingsDialog');if(d&&!d.open)d.showModal();});const foot=document.createElement('footer');foot.innerHTML='<span>Meeting tools</span><button type="button">Reset</button>';meetingMoreMenu.append(foot);document.body.append(meetingMoreMenu);const r=anchor?.getBoundingClientRect?.()||{left:innerWidth/2,top:innerHeight-70};meetingMoreMenu.style.left=`${Math.max(10,Math.min(innerWidth-300,r.left-195))}px`;meetingMoreMenu.style.top=`${Math.max(10,r.top-meetingMoreMenu.offsetHeight-8)}px`;foot.querySelector('button').onclick=requestSync;}

  function ensurePresenterButtons(toolbar){const actions=toolbar?.querySelector('.inline-presenter-actions');if(!actions||actions.dataset.dsRef==='1')return;actions.dataset.dsRef='1';const ensure=(command,label,before)=>{if(actions.querySelector(`[data-ref-command="${command}"]`))return;const b=document.createElement('button');b.type='button';b.dataset.refCommand=command;b.textContent=label;b.onclick=()=>{if(command==='layout')q('#meetingViewButton')?.click();else if(command==='show-meeting')window.dominionDesktop?.app?.show?.();else if(command==='more')openMeetingMore(b);};const anchor=before?actions.querySelector(`[data-inline-command="${before}"]`):null;anchor?actions.insertBefore(b,anchor):actions.append(b);};ensure('layout','Layout','annotate');ensure('show-meeting','Show meeting','stop');ensure('more','More','stop');}
  function syncPresenter(){ensureDeterministicPresenterIdle();const overlay=q('#meetingOverlay');if(!overlay)return;const nativeMacPresenter=document.body.classList.contains('ds-native-mac-presenter-share');const active=!nativeMacPresenter&&overlay.classList.contains('share-active');document.body.classList.toggle('ds-share-active',active);const toolbar=q('#inlinePresenterToolbar');if(!toolbar)return;if(nativeMacPresenter){toolbar.hidden=true;q('.ds-ref-share-banner')?.remove();overlay.classList.remove('ds-ref-presenter-visible');clearTimeout(presenterTimer);return;}ensurePresenterButtons(toolbar);const labels={audio:'Audio',video:'Video',participants:'Participants',chat:'Chat',pause:'Pause',annotate:'Annotate','new-share':'Share',stop:'Stop share'};for(const [command,label] of Object.entries(labels)){const b=toolbar.querySelector(`[data-inline-command="${command}"]`);if(b&&command!=='pause')b.textContent=label;}let banner=q('.ds-ref-share-banner');if(active&&!banner){banner=document.createElement('div');banner.className='ds-ref-share-banner';banner.innerHTML='<span>You are screen sharing</span><span class="ds-ref-share-secure">◆</span><button type="button" data-ref-stop-share>Stop share</button>';document.body.append(banner);banner.querySelector('[data-ref-stop-share]').onclick=()=>toolbar.querySelector('[data-inline-command="stop"]')?.click();}if(banner)banner.hidden=!active;if(active&&!overlay.dataset.dsRefPointerBound){overlay.dataset.dsRefPointerBound='1';const reveal=()=>{overlay.classList.add('ds-ref-presenter-visible');clearTimeout(presenterTimer);presenterTimer=setTimeout(()=>overlay.classList.remove('ds-ref-presenter-visible'),1650);};overlay.addEventListener('pointermove',reveal,{passive:true});overlay.addEventListener('pointerdown',reveal,{passive:true});reveal();}if(!active){overlay.classList.remove('ds-ref-presenter-visible');clearTimeout(presenterTimer);}}

  function stableCommandDelegate(event){
    const target=event.target;
    if(target?.closest?.('#roomParticipants,.room-side-head>button,.ds-participants-traffic'))closeParticipantBulk();
    if(target?.closest?.('#roomChat,#roomHostTools,#roomMore,[data-chat-close]'))closeParticipantBulk();
    if(target?.closest?.('#roomParticipants,#roomChat,[data-chat-close]'))closeHostPanel();
    // RuntimeStability is the canonical command router. Keep this layer focused
    // on reference chrome/transient lifecycle so two capture-phase authorities
    // never compete for the same toolbar click.
    if(window.DominionRuntimeStability)return;
    const more=target?.closest?.('#roomMore');
    if(more&&q('#meetingOverlay')&&!q('#meetingOverlay').hidden){event.preventDefault();event.stopPropagation();openMeetingMore(more);return;}
    const host=target?.closest?.('#roomHostTools');
    if(host&&q('#meetingOverlay')&&!q('#meetingOverlay').hidden){event.preventDefault();event.stopPropagation();void openHostToolsPanel();}
  }
  window.addEventListener('click',stableCommandDelegate,true);
  function closeOnOutside(event){if(participantInviteMenu&&!participantInviteMenu.contains(event.target)&&!event.target.closest?.('[data-ref-invite]'))closeParticipantInvite();if(participantBulkMenu&&!participantBulkMenu.contains(event.target)&&!event.target.closest?.('[data-ref-participant-more]'))closeParticipantBulk();if(meetingMoreMenu&&!meetingMoreMenu.contains(event.target)&&!event.target.closest?.('#roomMore'))closeMeetingMore();}
  document.addEventListener('pointerdown',closeOnOutside,true);

  function claimFinalMeetingAuthority(){
    const overlay=q('#meetingOverlay');if(!overlay)return;
    overlay.classList.remove('ds-exec-lock');
    for(const node of qa('#meetingOverlay .ds-exec-icon,#meetingOverlay .ds-exec-label,#meetingOverlay .ds-exec-encrypted,#meetingOverlay .ds-exec-divider'))node.remove();
    for(const node of qa('#meetingOverlay .ds-exec-control'))node.classList.remove('ds-exec-control');
  }
  function sync(){syncQueued=false;claimFinalMeetingAuthority();ensureCriticalMeetingGeometry();ensureDeterministicPresenterIdle();ensureHomeTopbar();ensureNotesAction();ensurePrejoin();reconcileAuthoritativeShareClass();syncMeetingLabels();}
  function requestSync(){if(syncQueued)return;syncQueued=true;requestAnimationFrame(sync);}
  const observer=new MutationObserver(requestSync);for(const root of [q('#meetingOverlay'),q('#prejoinOverlay'),q('#appShell')])if(root)observer.observe(root,{subtree:true,childList:true,attributes:true,attributeFilter:['hidden','aria-pressed']});window.addEventListener('dominion:meeting-ui-ready',requestSync,true);window.addEventListener('dominion:participant-update',requestSync,true);window.addEventListener('dominion:share-state',requestSync,true);window.addEventListener('resize',requestSync,{passive:true});
  window.DominionZoomScreenshotReference=Object.freeze({version:'2.0.49-functional-more-tools',sync,requestSync,openHostToolsPanel,openMeetingMore,openParticipantBulkMenu,closeTransient,dispose:()=>{observer.disconnect();clearTimeout(presenterTimer);window.removeEventListener('click',stableCommandDelegate,true);closeTransient();}});
  sync();
})();