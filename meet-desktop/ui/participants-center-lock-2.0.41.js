(()=>{
  'use strict';
  if(window.DominionParticipantsCenterLock2041)return;
  const q=s=>document.querySelector(s),qa=s=>[...document.querySelectorAll(s)];
  const meeting=window.dominionDesktop?.meeting||null;
  let frame=0,menu=null,wasVisible=false;

  function ensureStyle(){
    if(q('style[data-ds-participants-center-lock-2041]'))return;
    const style=document.createElement('style');
    style.dataset.dsParticipantsCenterLock2041='1';
    style.textContent=`
      /* One canonical meeting encryption badge only. The Executive badge is authoritative. */
      #meetingOverlay.ds-exec-lock .meeting-head .ds-approved-encryption{display:none!important}
      #meetingOverlay .room-side.ds-participants-reference.ds-center-lock{
        position:absolute!important;
        right:auto!important;
        bottom:auto!important;
        transform:none!important;
        z-index:3400!important;
        box-shadow:0 22px 64px rgba(0,0,0,.62)!important;
      }
      #meetingOverlay .room-side.ds-participants-reference.ds-center-lock .room-side-head{cursor:move!important}
      #meetingOverlay .room-side.ds-participants-reference #participantRoster .person-row{
        grid-template-columns:34px minmax(0,1fr) auto 28px!important;
      }
      #meetingOverlay .room-side.ds-participants-reference #participantRoster .person-copy{
        display:flex!important;align-items:center!important;gap:6px!important;min-width:0!important;
      }
      #meetingOverlay .room-side.ds-participants-reference #participantRoster .person-copy strong{
        min-width:0!important;overflow:hidden!important;text-overflow:ellipsis!important;white-space:nowrap!important;
      }
      .ds-participant-role-badge{display:inline-flex;align-items:center;height:18px;padding:0 7px;border-radius:9px;font-size:9px;font-weight:800;letter-spacing:.04em;text-transform:uppercase;flex:none}
      .ds-participant-role-badge.host{background:#b88a21;color:#fff6d7;border:1px solid rgba(255,216,105,.45)}
      .ds-participant-role-badge.cohost{background:#2b6fa8;color:#e8f5ff;border:1px solid rgba(105,187,255,.35)}
      .ds-participant-self-label{color:#d8d8da;font-size:11px;font-weight:500;flex:none}
      #meetingOverlay .room-side.ds-participants-reference #participantRoster .participant-actions{display:flex!important;align-items:center!important;justify-content:center!important;min-width:28px!important}
      #meetingOverlay .room-side.ds-participants-reference #participantRoster [data-participant-more],
      #meetingOverlay .room-side.ds-participants-reference #participantRoster .ds-host-row-more{
        display:grid!important;place-items:center!important;width:28px!important;height:28px!important;min-width:28px!important;padding:0!important;margin:0!important;border:0!important;border-radius:6px!important;background:transparent!important;color:#e5e5e7!important;font-size:0!important;opacity:1!important;visibility:visible!important;cursor:pointer!important
      }
      #meetingOverlay .room-side.ds-participants-reference #participantRoster [data-participant-more]::before,
      #meetingOverlay .room-side.ds-participants-reference #participantRoster .ds-host-row-more::before{content:'•••';font-size:13px!important;letter-spacing:1px!important;line-height:1!important;color:#e5e5e7!important}
      #meetingOverlay .room-side.ds-participants-reference #participantRoster [data-participant-more]:hover,
      #meetingOverlay .room-side.ds-participants-reference #participantRoster .ds-host-row-more:hover{background:#4a4a4d!important}
      .ds-host-self-menu{position:fixed;z-index:9000;width:190px;padding:6px;border:1px solid #55565a;border-radius:8px;background:#2b2b2d;box-shadow:0 16px 42px rgba(0,0,0,.55);display:flex;flex-direction:column;gap:2px}
      .ds-host-self-menu button{height:34px;padding:0 10px;border:0;border-radius:6px;background:transparent;color:#f3f3f4;text-align:left;font:500 12px -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;cursor:pointer}
      .ds-host-self-menu button:hover{background:#454548}
      #meetingOverlay .room-side.ds-participants-reference [data-ds-final-legacy-actions='1']{display:none!important}
    `;
    document.head.append(style);
  }

  function side(){return q('#meetingOverlay .room-side.ds-participants-reference');}
  function rows(){return qa('#participantRoster [data-participant-id]');}

  function syncEncryption(){
    const head=q('#meetingOverlay .meeting-head');if(!head)return;
    const exec=[...head.querySelectorAll('.ds-exec-encrypted')];
    const approved=[...head.querySelectorAll('.ds-approved-encryption')];
    if(exec.length){
      exec.slice(1).forEach(node=>node.remove());
      approved.forEach(node=>node.remove());
      exec[0].setAttribute('aria-label','Encrypted media transport');
      return;
    }
    approved.slice(1).forEach(node=>node.remove());
  }

  function cleanName(row){
    const strong=row.querySelector('.person-copy strong');if(!strong)return;
    if(!strong.dataset.dsBaseName){strong.dataset.dsBaseName=String(row.dataset.participantName||strong.textContent||'Participant').replace(/\s*\((?:host|co-host|cohost|me)(?:\s*,\s*(?:host|co-host|cohost|me))*\)\s*$/i,'').trim()||'Participant';}
    strong.textContent=strong.dataset.dsBaseName;
  }
  function roleFor(row){
    const explicit=String(row.dataset.participantRole||'').toLowerCase().replace('-','');
    if(explicit)return explicit;
    const text=String(row.textContent||'').toLowerCase();
    if(text.includes('co-host')||text.includes('cohost'))return 'cohost';
    if(text.includes('host'))return 'host';
    return 'participant';
  }
  function syncIdentity(row){
    cleanName(row);const copy=row.querySelector('.person-copy');if(!copy)return;
    const role=roleFor(row),self=row.dataset.participantSelf==='1'||/\bme\b/i.test(String(row.textContent||''));
    let badge=copy.querySelector('.ds-participant-role-badge');
    if(role==='host'||role==='cohost'){
      if(!badge){badge=document.createElement('span');badge.className='ds-participant-role-badge';copy.append(badge);}
      badge.className=`ds-participant-role-badge ${role}`;badge.textContent=role==='host'?'Host':'Co-host';badge.hidden=false;
    }else badge?.remove();
    let selfLabel=copy.querySelector('.ds-participant-self-label');
    if(self){if(!selfLabel){selfLabel=document.createElement('span');selfLabel.className='ds-participant-self-label';copy.append(selfLabel);}selfLabel.textContent='(me)';}
    else selfLabel?.remove();
  }

  function closeMenu(){menu?.remove();menu=null;}
  async function renameSelf(row){
    const id=String(row.dataset.participantId||''),current=String(row.dataset.participantName||row.querySelector('.person-copy strong')?.textContent||'Participant');
    const next=window.prompt('Rename participant',current);if(!next||!String(next).trim()||!id)return;
    try{await meeting?.renameParticipant?.(id,String(next).trim());}catch{}
  }
  function openHostMenu(button,row){
    closeMenu();menu=document.createElement('div');menu.className='ds-host-self-menu';
    const rename=document.createElement('button');rename.type='button';rename.textContent='Rename';rename.onclick=()=>{closeMenu();void renameSelf(row);};menu.append(rename);
    const copy=document.createElement('button');copy.type='button';copy.textContent='Copy participant name';copy.onclick=()=>{const name=String(row.dataset.participantName||row.querySelector('.person-copy strong')?.textContent||'');closeMenu();void navigator.clipboard?.writeText?.(name);};menu.append(copy);
    document.body.append(menu);const r=button.getBoundingClientRect();menu.style.left=`${Math.max(10,Math.min(innerWidth-200,r.right-190))}px`;menu.style.top=`${Math.max(10,Math.min(innerHeight-menu.offsetHeight-10,r.bottom+5))}px`;
  }
  function ensureOverflow(row){
    const actions=row.querySelector('.participant-actions')||(()=>{const node=document.createElement('div');node.className='participant-actions';row.append(node);return node;})();
    const role=roleFor(row),self=row.dataset.participantSelf==='1'||/\bme\b/i.test(String(row.textContent||''));
    if(role==='host'&&self){
      if(!actions.querySelector('.ds-host-row-more')){const b=document.createElement('button');b.type='button';b.className='ds-host-row-more';b.setAttribute('aria-label','More controls');b.title='More';b.onclick=event=>{event.stopPropagation();openHostMenu(b,row);};actions.append(b);}
    }
  }

  function hideDuplicateActions(panel){
    const primary=panel.querySelector('.ds-ref-participants-footer');
    for(const node of [...panel.querySelectorAll('div,footer')]){
      if(node===primary||primary?.contains(node)||node.closest('#participantRoster')||node.closest('.room-side-head'))continue;
      const buttons=[...node.querySelectorAll(':scope > button')];if(buttons.length<2)continue;
      const labels=buttons.map(b=>String(b.textContent||b.getAttribute('aria-label')||'').trim().toLowerCase());
      const looksLegacy=labels.some(v=>v==='invite')&&labels.some(v=>v.includes('mute all'))&&(labels.some(v=>v==='more')||labels.some(v=>v==='...'||v==='•••'));
      if(looksLegacy){node.dataset.dsFinalLegacyActions='1';node.hidden=true;}
    }
  }

  function centerPanel(panel,force=false){
    const body=q('#meetingOverlay .meeting-body')||q('#meetingOverlay');if(!body||panel.hidden)return;
    if(!force&&panel.dataset.dsAdaptiveUserPositioned==='1')return;
    const width=Math.min(Math.max(panel.offsetWidth||390,320),Math.max(320,body.clientWidth-24));
    const height=Math.min(Math.max(panel.offsetHeight||520,310),Math.max(310,body.clientHeight-24));
    const left=Math.max(10,Math.round((body.clientWidth-width)/2));
    const top=Math.max(10,Math.round((body.clientHeight-height)/2));
    panel.style.setProperty('width',`${width}px`,'important');panel.style.setProperty('height',`${height}px`,'important');
    panel.style.setProperty('left',`${left}px`,'important');panel.style.setProperty('right','auto','important');panel.style.setProperty('top',`${top}px`,'important');panel.style.setProperty('bottom','auto','important');panel.style.setProperty('transform','none','important');
    panel.classList.add('ds-center-lock');panel.dataset.dsFinalCentered='1';
  }

  function sync(){
    frame=0;ensureStyle();syncEncryption();
    const panel=side();
    if(!panel||panel.hidden){wasVisible=false;return;}
    if(!wasVisible){
      wasVisible=true;
      try{localStorage.removeItem('ds_zoom_participants_geometry_2_0_41');}catch{}
      delete panel.dataset.dsAdaptiveUserPositioned;
      delete panel.dataset.dsFinalCentered;
    }
    /* Default is always center. Only a real user drag/resize may move it away. */
    if(panel.dataset.dsAdaptiveUserPositioned!=='1')centerPanel(panel,true);
    hideDuplicateActions(panel);for(const row of rows()){syncIdentity(row);ensureOverflow(row);}
  }
  function schedule(){if(frame)return;frame=requestAnimationFrame(sync);}
  document.addEventListener('pointerdown',event=>{if(menu&&!menu.contains(event.target)&&!event.target.closest?.('.ds-host-row-more'))closeMenu();},true);
  window.addEventListener('resize',()=>{const panel=side();if(panel&&panel.dataset.dsAdaptiveUserPositioned!=='1')centerPanel(panel,true);syncEncryption();},true);
  window.addEventListener('dominion:meeting-ui-ready',schedule,true);
  const observer=new MutationObserver(schedule);observer.observe(document.documentElement,{subtree:true,childList:true,attributes:true,attributeFilter:['hidden','class','style','data-participant-role','data-participant-self']});
  const timer=setInterval(schedule,350);
  window.DominionParticipantsCenterLock2041=Object.freeze({version:'2.0.41',sync,center:()=>{const panel=side();if(panel){delete panel.dataset.dsAdaptiveUserPositioned;centerPanel(panel,true);}},dispose:()=>{clearInterval(timer);observer.disconnect();if(frame)cancelAnimationFrame(frame);closeMenu();}});
  sync();
})();
