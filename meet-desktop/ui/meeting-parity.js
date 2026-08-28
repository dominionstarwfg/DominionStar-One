(()=>{
  if(window.DominionMeetingParity)return;
  const q=s=>document.querySelector(s);
  const qa=s=>[...document.querySelectorAll(s)];
  const SVG=Object.freeze({
    mic:'<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5.5 11.5a6.5 6.5 0 0 0 13 0M12 18v3M9 21h6"/></svg>',
    video:'<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="6" width="13" height="12" rx="3"/><path d="m16 10 5-3v10l-5-3z"/></svg>',
    participants:'<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="9" cy="8" r="3"/><circle cx="17" cy="9" r="2.4"/><path d="M3 20a6 6 0 0 1 12 0M14 19a4.8 4.8 0 0 1 7 0"/></svg>',
    settings:'<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.8 1.8 0 0 0 .36 1.98l.06.06-2.12 2.12-.06-.06a1.8 1.8 0 0 0-1.98-.36A1.8 1.8 0 0 0 14.6 20.4V21h-5v-.6a1.8 1.8 0 0 0-1.1-1.65 1.8 1.8 0 0 0-1.98.36l-.06.06-2.12-2.12.06-.06A1.8 1.8 0 0 0 4.76 15 1.8 1.8 0 0 0 3.1 13.9H3v-3h.1A1.8 1.8 0 0 0 4.76 9.8a1.8 1.8 0 0 0-.36-1.98l-.06-.06 2.12-2.12.06.06a1.8 1.8 0 0 0 1.98.36A1.8 1.8 0 0 0 9.6 4.4V4h5v.4a1.8 1.8 0 0 0 1.1 1.65 1.8 1.8 0 0 0 1.98-.36l.06-.06 2.12 2.12-.06.06a1.8 1.8 0 0 0-.36 1.98 1.8 1.8 0 0 0 1.66 1.1h.1v3h-.1A1.8 1.8 0 0 0 19.4 15z"/></svg>',
    more:'<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="5" cy="12" r="1.7"/><circle cx="12" cy="12" r="1.7"/><circle cx="19" cy="12" r="1.7"/></svg>',
    exit:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5h9a3 3 0 0 1 3 3v8a3 3 0 0 1-3 3H8M12 8l-4 4 4 4M8 12h9"/></svg>'
  });
  let moreMenu=null;
  let drag=null;

  const iconFor=button=>{
    if(!button)return '';
    if(button.id==='roomMic'||button.id==='prejoinMic')return SVG.mic;
    if(button.id==='roomCamera'||button.id==='prejoinCamera')return SVG.video;
    if(button.id==='roomParticipants')return SVG.participants;
    if(button.id==='roomSettings')return SVG.settings;
    if(button.id==='roomMore')return SVG.more;
    if(button.id==='roomExitButton')return SVG.exit;
    return '';
  };
  function decorate(button){
    if(!button||button.querySelector('.ds-control-icon'))return;
    const icon=iconFor(button);if(!icon)return;
    const label=String(button.textContent||button.getAttribute('aria-label')||'Control').trim();
    button.textContent='';
    const iconNode=document.createElement('span');iconNode.className='ds-control-icon';iconNode.innerHTML=icon;
    const labelNode=document.createElement('span');labelNode.className='ds-control-label';labelNode.textContent=label;
    button.append(iconNode,labelNode);button.setAttribute('aria-label',label);
  }
  function decorateControls(){for(const button of qa('#prejoinMic,#prejoinCamera,#roomMic,#roomCamera,#roomParticipants,#roomSettings,#roomMore,#roomExitButton'))decorate(button);}

  function syncHostIdentity(){
    const role=String(q('#roomRole')?.textContent||'').trim().toLowerCase();
    if(role!=='host')return;
    const host=[...document.querySelectorAll('#participantRoster .person-row')].find(row=>String(row.querySelector('.person-copy small')?.textContent||'').trim().toLowerCase()==='host');
    const name=host?.querySelector('.person-copy strong')?.textContent?.trim();
    if(!name)return;
    const stage=q('#stageName');if(stage)stage.textContent=name;
    const avatar=q('#stageAvatar');if(avatar)avatar.textContent=name.split(/\s+/).filter(Boolean).slice(0,2).map(v=>v[0]).join('').toUpperCase()||'DS';
  }

  function clampDock(){
    const side=q('.room-side'),body=q('.meeting-body');if(!side||!body||!side.dataset.floatingDock)return;
    if(!side.style.left)return;
    const parent=body.getBoundingClientRect(),rect=side.getBoundingClientRect();
    const left=Math.max(10,Math.min(Number.parseFloat(side.style.left)||10,parent.width-rect.width-10));
    const top=Math.max(10,Math.min(Number.parseFloat(side.style.top)||10,parent.height-rect.height-10));
    side.style.left=`${left}px`;side.style.top=`${top}px`;
  }
  function installDock(){
    const side=q('.room-side'),body=q('.meeting-body');if(!side||!body||side.dataset.floatingDock)return;
    side.dataset.floatingDock='1';
    const head=document.createElement('div');head.className='room-side-head';head.innerHTML='<div><strong>Participants</strong><small>Drag to move · resize from corner</small></div><button type="button" aria-label="Close participants">×</button>';
    side.prepend(head);
    head.querySelector('button').onclick=()=>toggleParticipants(false);
    head.addEventListener('pointerdown',event=>{
      if(event.button!==0||event.target.closest('button'))return;
      const sideRect=side.getBoundingClientRect(),bodyRect=body.getBoundingClientRect();
      drag={pointerId:event.pointerId,offsetX:event.clientX-sideRect.left,offsetY:event.clientY-sideRect.top,bodyRect};
      head.setPointerCapture?.(event.pointerId);side.classList.add('dragging');event.preventDefault();
    });
    head.addEventListener('pointermove',event=>{
      if(!drag||drag.pointerId!==event.pointerId)return;
      const bodyRect=body.getBoundingClientRect(),width=side.offsetWidth,height=side.offsetHeight;
      const left=Math.max(10,Math.min(event.clientX-bodyRect.left-drag.offsetX,bodyRect.width-width-10));
      const top=Math.max(10,Math.min(event.clientY-bodyRect.top-drag.offsetY,bodyRect.height-height-10));
      side.style.right='auto';side.style.bottom='auto';side.style.left=`${left}px`;side.style.top=`${top}px`;
    });
    const end=event=>{if(!drag||drag.pointerId!==event.pointerId)return;drag=null;side.classList.remove('dragging');head.releasePointerCapture?.(event.pointerId);clampDock();};
    head.addEventListener('pointerup',end);head.addEventListener('pointercancel',end);
    new ResizeObserver(()=>clampDock()).observe(side);
  }
  function toggleParticipants(force){
    const overlay=q('#meetingOverlay'),side=q('.room-side'),button=q('#roomParticipants');if(!overlay||!side)return;
    const show=typeof force==='boolean'?force:overlay.classList.contains('participants-hidden');
    overlay.classList.toggle('participants-hidden',!show);button?.setAttribute('aria-pressed',String(show));
    if(show){side.hidden=false;requestAnimationFrame(clampDock);}else side.hidden=true;
  }

  function closeMore(){moreMenu?.remove();moreMenu=null;}
  function openMore(anchor){
    closeMore();moreMenu=document.createElement('div');moreMenu.className='meeting-more-menu';
    const add=(label,action)=>{const button=document.createElement('button');button.type='button';button.textContent=label;button.onclick=()=>{closeMore();action();};moreMenu.append(button);};
    add('Meeting settings',()=>{const dialog=q('#settingsDialog');if(dialog&&!dialog.open)dialog.showModal();});
    add('Diagnostics',()=>q('#meetDiagnosticsButton')?.click());
    add('Reset participant panel',()=>{const side=q('.room-side');if(side){side.style.left='';side.style.top='';side.style.right='';side.style.bottom='';toggleParticipants(true);}});
    document.body.append(moreMenu);const rect=anchor.getBoundingClientRect();const width=220;moreMenu.style.left=`${Math.min(innerWidth-width-12,Math.max(12,rect.left))}px`;moreMenu.style.bottom=`${Math.max(78,innerHeight-rect.top+8)}px`;
  }

  function installMeetingControls(){
    const footer=q('.meeting-footer'),exit=q('#roomExitButton');if(!footer||!exit)return;
    if(!q('#roomSettings')){const button=document.createElement('button');button.id='roomSettings';button.type='button';button.className='meeting-control';button.textContent='Settings';button.onclick=()=>{const dialog=q('#settingsDialog');if(dialog&&!dialog.open)dialog.showModal();};footer.insertBefore(button,exit);}
    if(!q('#roomMore')){const button=document.createElement('button');button.id='roomMore';button.type='button';button.className='meeting-control';button.textContent='More';button.onclick=event=>{event.stopPropagation();moreMenu?closeMore():openMore(button);};footer.insertBefore(button,exit);}
    const participants=q('#roomParticipants');if(participants&&!participants.dataset.parityBound){participants.dataset.parityBound='1';participants.setAttribute('aria-pressed','true');participants.addEventListener('click',()=>toggleParticipants());}
    decorateControls();
  }

  function install(){installDock();installMeetingControls();decorateControls();syncHostIdentity();}
  const observer=new MutationObserver(mutations=>{
    let needsInstall=false,needsIdentity=false,needsDecorate=false;
    for(const mutation of mutations){
      if(mutation.type==='childList'){needsInstall=true;needsDecorate=true;if(mutation.target.closest?.('#participantRoster'))needsIdentity=true;}
      if(mutation.type==='characterData')needsDecorate=true;
    }
    if(needsInstall)install();if(needsIdentity)syncHostIdentity();if(needsDecorate)decorateControls();
  });
  observer.observe(document.body,{childList:true,subtree:true,characterData:true});
  document.addEventListener('pointerdown',event=>{if(moreMenu&&!moreMenu.contains(event.target)&&event.target!==q('#roomMore'))closeMore();},true);
  window.addEventListener('resize',()=>{closeMore();clampDock();});
  install();
  window.DominionMeetingParity=Object.freeze({version:'1.0.0-approved-chrome',install,toggleParticipants,clampDock,syncHostIdentity});
})();