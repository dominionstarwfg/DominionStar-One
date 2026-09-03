(()=>{
  if(window.DominionZoomScreenshotReference)return;
  const q=s=>document.querySelector(s),qa=s=>[...document.querySelectorAll(s)];
  const media=()=>window.DominionMediaController||null;
  const participants=()=>window.DominionParticipantControls||null;
  let syncQueued=false,presenterTimer=0,notesDialog=null;

  const icon=(name)=>({
    plus:'＋',bell:'♧',calendar:'▣',shield:'◆',pen:'⌁',spark:'✦',apps:'▦',record:'◉',captions:'CC',breakout:'▦',polls:'▥',docs:'▤',whiteboard:'▱',info:'ⓘ',transfer:'▣',settings:'⚙',layout:'▣',annotate:'⌁',more:'•••',meeting:'▣'
  })[name]||'•';

  function setVisibleLabel(button,text){
    if(!button)return;
    const label=button.querySelector('.ds-control-label');
    if(label)label.textContent=text;
    else if(!button.querySelector('svg'))button.textContent=text;
  }

  function ensureHomeTopbar(){
    const shell=q('#appShell'),top=q('.topbar');if(!shell||!top)return;
    let bar=q('.ds-ref-home-topbar');
    if(!bar){
      bar=document.createElement('div');bar.className='ds-ref-home-topbar';
      bar.innerHTML=`<div class="ds-ref-nav-arrows"><span>‹</span><span>›</span></div><input class="ds-ref-search" type="search" placeholder="Search (⌘E)" aria-label="Search DominionStar Meet"><div class="ds-ref-top-icons"><button type="button" data-ref-plus aria-label="New meeting">${icon('plus')}</button><button type="button" data-ref-bell aria-label="Notifications">♧</button><button type="button" data-ref-calendar aria-label="Meetings">${icon('calendar')}</button></div>`;
      shell.append(bar);
      bar.querySelector('[data-ref-plus]').onclick=()=>q('[data-action="new-meeting"]')?.click();
      bar.querySelector('[data-ref-calendar]').onclick=()=>q('.nav-button[data-section="meetings"]')?.click();
      bar.querySelector('[data-ref-bell]').onclick=()=>{
        const foundation=q('#foundationDialog');if(!foundation)return;
        const title=q('#foundationTitle'),copy=q('#foundationCopy');if(title)title.textContent='Notifications';if(copy)copy.textContent='No new DominionStar Meet notifications.';if(!foundation.open)foundation.showModal();
      };
      const search=bar.querySelector('.ds-ref-search');
      search.addEventListener('keydown',event=>{
        if(event.key!=='Enter')return;const term=String(search.value||'').trim().toLowerCase();if(!term)return;
        const action=qa('#homeSection .action-card').find(button=>String(button.textContent||'').toLowerCase().includes(term));if(action){action.focus();action.scrollIntoView({block:'center'});}
        else if(/meeting|schedule|calendar/.test(term))q('.nav-button[data-section="meetings"]')?.click();
      });
    }
    bar.hidden=shell.hidden||!q('#homeSection')||q('#homeSection').hidden;
  }

  function ensureNotesAction(){
    const actions=q('#homeSection .quick-actions');if(!actions||actions.querySelector('.ds-ref-notes'))return;
    const button=document.createElement('button');button.type='button';button.className='action-card ds-ref-notes';button.style.gridColumn='1 / -1';button.style.justifySelf='center';
    button.innerHTML='<span class="action-icon"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 19h14M7 16l9-9 2 2-9 9-4 1z"/></svg></span><strong>My Notes</strong><small>Private local notes</small>';
    button.onclick=openNotes;actions.append(button);
  }
  function openNotes(){
    if(!notesDialog){
      notesDialog=document.createElement('dialog');notesDialog.className='modal compact-modal ds-ref-notes-dialog';
      notesDialog.innerHTML='<form method="dialog"><header><div><h2>My Notes</h2></div><button class="modal-close" value="cancel" aria-label="Close">×</button></header><textarea aria-label="Private meeting notes" placeholder="Write a note…" style="width:100%;height:220px;resize:none;border:1px solid #444;border-radius:8px;background:#17181a;color:#fff;padding:12px;font:inherit"></textarea><div class="modal-actions"><button value="cancel" class="secondary-button">Close</button><button type="button" class="primary-button" data-save>Save</button></div></form>';
      document.body.append(notesDialog);const text=notesDialog.querySelector('textarea');try{text.value=localStorage.getItem('ds_my_notes')||'';}catch{}
      notesDialog.querySelector('[data-save]').onclick=()=>{try{localStorage.setItem('ds_my_notes',text.value);}catch{}notesDialog.close();};
    }
    if(!notesDialog.open)notesDialog.showModal();
  }

  function ensurePrejoin(){
    const overlay=q('#prejoinOverlay'),footer=overlay?.querySelector('.prejoin-window>footer');if(!overlay||!footer)return;
    const strong=q('#prejoinBackgrounds strong');if(strong)strong.textContent='Backgrounds';
    let pref=footer.querySelector('.ds-ref-prejoin-pref');
    if(!pref){
      pref=document.createElement('label');pref.className='ds-ref-prejoin-pref';pref.innerHTML='<input type="checkbox" checked><span>Always show this preview when joining</span><span title="You can change this in Settings">ⓘ</span>';
      footer.prepend(pref);const input=pref.querySelector('input');
      try{const saved=localStorage.getItem('ds_pref_show_prejoin');input.checked=saved===null?true:saved==='1';}catch{}
      input.onchange=()=>{try{localStorage.setItem('ds_pref_show_prejoin',input.checked?'1':'0');}catch{}};
    }
  }

  function ensureMeetingHead(){
    const head=q('#meetingOverlay .meeting-head');if(!head)return;
    let tools=head.querySelector('.ds-ref-meeting-head-icons');
    if(!tools){
      tools=document.createElement('div');tools.className='ds-ref-meeting-head-icons';
      tools.innerHTML=`<button type="button" data-ref-security title="Host tools" aria-label="Host tools">◆</button><button type="button" data-ref-annotate title="Annotate" aria-label="Annotate">⌁</button><button type="button" data-ref-effects title="Backgrounds and effects" aria-label="Backgrounds and effects">✦</button><button type="button" data-ref-calendar title="Meeting information" aria-label="Meeting information">▦</button>`;
      head.append(tools);
      tools.querySelector('[data-ref-security]').onclick=()=>q('#roomHostTools')?.click();
      tools.querySelector('[data-ref-annotate]').onclick=()=>q('[data-inline-command="annotate"]')?.click();
      tools.querySelector('[data-ref-effects]').onclick=()=>{const d=q('#settingsDialog');if(d&&!d.open)d.showModal();void window.DominionAVSettings?.openVideo?.();};
      tools.querySelector('[data-ref-calendar]').onclick=()=>{
        const text=String(q('#roomCodeLabel')?.textContent||'DominionStar meeting');
        const foundation=q('#foundationDialog');if(!foundation)return;q('#foundationTitle').textContent='Meeting information';q('#foundationCopy').textContent=text;if(!foundation.open)foundation.showModal();
      };
    }
  }

  function syncMeetingLabels(){
    const overlay=q('#meetingOverlay');if(!overlay||overlay.hidden){document.body.classList.remove('ds-in-meeting','ds-share-active');return;}
    document.body.classList.add('ds-in-meeting');
    setVisibleLabel(q('#roomMic'),'Audio');setVisibleLabel(q('#roomCamera'),'Video');setVisibleLabel(q('#roomParticipants'),'Participants');setVisibleLabel(q('#roomChat'),'Chat');setVisibleLabel(q('#roomReactions'),'React');setVisibleLabel(q('#roomRaiseHand'),q('#roomRaiseHand')?.getAttribute('aria-pressed')==='true'?'Lower hand':'Raise hand');setVisibleLabel(q('#roomShare'),'Share');setVisibleLabel(q('#roomHostTools'),'Host tools');setVisibleLabel(q('#roomMore'),'More');setVisibleLabel(q('#roomExitButton'),'End');
    const count=qa('#participantRoster [data-participant-id]').length||1;const participantButton=q('#roomParticipants');if(participantButton)participantButton.dataset.dsRefCount=String(count);
    ensureMeetingHead();ensureParticipantsFooter();syncPresenter();
  }

  function ensureParticipantsFooter(){
    const side=q('#meetingOverlay .room-side');if(!side)return;
    const head=side.querySelector('.room-side-head');if(head){const strong=head.querySelector('strong');if(strong)strong.textContent=`Participants (${qa('#participantRoster [data-participant-id]').length||1})`;}
    let footer=side.querySelector('.ds-ref-participants-footer');if(footer)return;
    footer=document.createElement('div');footer.className='ds-ref-participants-footer';
    footer.innerHTML='<button type="button" data-ref-invite>Invite</button><button type="button" data-ref-mute-all>Mute all</button><button type="button" data-ref-participant-more aria-label="More participant controls">•••</button>';
    side.append(footer);
    footer.querySelector('[data-ref-invite]').onclick=async()=>{
      const info=String(q('#roomCodeLabel')?.textContent||'').trim();try{if(info)await navigator.clipboard.writeText(info);}catch{}
      const foundation=q('#foundationDialog');if(foundation){q('#foundationTitle').textContent='Invite';q('#foundationCopy').textContent=info?'Meeting information copied.':'Meeting information is unavailable.';if(!foundation.open)foundation.showModal();}
    };
    footer.querySelector('[data-ref-mute-all]').onclick=()=>void participants()?.sendAll?.('host:mute');
    footer.querySelector('[data-ref-participant-more]').onclick=event=>{
      const legacy=q('#participantBulkActions');if(!legacy)return;
      let menu=q('.ds-ref-participant-bulk-menu');menu?.remove();menu=document.createElement('div');menu.className='participant-control-menu ds-ref-participant-bulk-menu';
      const actions=[['Ask all to unmute','host:ask-unmute'],['Mute all upon entry','host:mute'],['Stop video for all','host:stop-video'],['Ask all to start video','host:ask-start-video'],['Lower all hands','host:lower-hand']];
      for(const [label,type] of actions){const b=document.createElement('button');b.type='button';b.textContent=label;b.onclick=()=>{menu.remove();void participants()?.sendAll?.(type);};menu.append(b);}
      document.body.append(menu);const r=event.currentTarget.getBoundingClientRect();menu.style.left=`${Math.max(10,r.right-210)}px`;menu.style.top=`${Math.max(10,r.top-menu.offsetHeight-8)}px`;
    };
  }

  function decorateMoreMenu(menu){
    if(!menu||menu.dataset.dsRefDecorated==='1'||menu.classList.contains('security-menu')||menu.classList.contains('view-menu'))return;
    menu.dataset.dsRefDecorated='1';
    const map=[[/record/i,'record'],[/caption/i,'captions'],[/breakout/i,'breakout'],[/poll|quiz/i,'polls'],[/doc/i,'docs'],[/whiteboard/i,'whiteboard'],[/app/i,'apps'],[/meeting info/i,'info'],[/transfer/i,'transfer'],[/setting/i,'settings']];
    for(const button of menu.querySelectorAll('button')){
      const label=String(button.textContent||'').trim();const key=map.find(([re])=>re.test(label))?.[1]||'apps';
      button.innerHTML=`<span class="ds-ref-more-icon" aria-hidden="true" style="display:block;font-size:17px;margin-bottom:4px">${icon(key)}</span><span>${label}</span>`;
    }
  }

  function decorateSecurityMenu(menu){
    if(!menu||menu.dataset.dsRefSecurity==='1')return;menu.dataset.dsRefSecurity='1';
    for(const button of menu.querySelectorAll('button')){
      const label=String(button.textContent||'').replace(/^✓\s*/,'').trim();
      if(/lock meeting/i.test(label))button.textContent='Lock meeting';
      if(/waiting room/i.test(label))button.textContent=/disable/i.test(label)?'Disable waiting room':'Enable waiting room';
    }
  }

  function ensurePresenterButtons(toolbar){
    const actions=toolbar?.querySelector('.inline-presenter-actions');if(!actions||actions.dataset.dsRef==='1')return;actions.dataset.dsRef='1';
    const ensure=(command,label,before)=>{if(actions.querySelector(`[data-ref-command="${command}"]`))return;const b=document.createElement('button');b.type='button';b.dataset.refCommand=command;b.textContent=label;b.onclick=()=>{
      if(command==='layout')q('#meetingViewButton')?.click();
      else if(command==='show-meeting')q('#meetingOverlay')?.scrollIntoView?.();
      else if(command==='more')q('#roomMore')?.click();
    };const anchor=before?actions.querySelector(`[data-inline-command="${before}"]`):null;anchor?actions.insertBefore(b,anchor):actions.append(b);};
    ensure('layout','Layout','annotate');ensure('show-meeting','Show meeting','stop');ensure('more','More','stop');
  }

  function syncPresenter(){
    const overlay=q('#meetingOverlay');if(!overlay)return;const active=overlay.classList.contains('share-active');document.body.classList.toggle('ds-share-active',active);
    const toolbar=q('#inlinePresenterToolbar');if(!toolbar)return;ensurePresenterButtons(toolbar);
    const labels={audio:'Audio',video:'Video',participants:'Participants',chat:'Chat',pause:'Pause',annotate:'Annotate','new-share':'Share',stop:'Stop share'};
    for(const [command,label] of Object.entries(labels)){const b=toolbar.querySelector(`[data-inline-command="${command}"]`);if(b&&command!=='pause')b.textContent=label;}
    let banner=q('.ds-ref-share-banner');if(active&&!banner){banner=document.createElement('div');banner.className='ds-ref-share-banner';banner.innerHTML='<span>You are screen sharing</span><span>◆</span>';document.body.append(banner);}if(banner)banner.hidden=!active;
    if(active&&!overlay.dataset.dsRefPointerBound){overlay.dataset.dsRefPointerBound='1';const reveal=()=>{overlay.classList.add('ds-ref-presenter-visible');clearTimeout(presenterTimer);presenterTimer=setTimeout(()=>overlay.classList.remove('ds-ref-presenter-visible'),1650);};overlay.addEventListener('pointermove',reveal,{passive:true});overlay.addEventListener('pointerdown',reveal,{passive:true});reveal();}
    if(!active){overlay.classList.remove('ds-ref-presenter-visible');clearTimeout(presenterTimer);}
  }

  function sync(){
    syncQueued=false;ensureHomeTopbar();ensureNotesAction();ensurePrejoin();syncMeetingLabels();
    qa('.meeting-more-menu').forEach(menu=>menu.classList.contains('security-menu')?decorateSecurityMenu(menu):decorateMoreMenu(menu));
  }
  function requestSync(){if(syncQueued)return;syncQueued=true;requestAnimationFrame(sync);}

  const observer=new MutationObserver(requestSync);observer.observe(document.documentElement,{subtree:true,childList:true,attributes:true,attributeFilter:['hidden','class','aria-pressed']});
  window.addEventListener('dominion:meeting-ui-ready',requestSync,true);window.addEventListener('dominion:participant-update',requestSync,true);window.addEventListener('dominion:share-state',requestSync,true);window.addEventListener('resize',requestSync,{passive:true});
  const timer=setInterval(requestSync,650);requestSync();
  window.DominionZoomScreenshotReference=Object.freeze({version:'2.0.41',sync:requestSync,dispose:()=>{clearInterval(timer);observer.disconnect();clearTimeout(presenterTimer);}});
})();