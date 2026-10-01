(()=>{
  'use strict';
  if(window.DominionZoomParticipantsReference2041)return;

  const q=s=>document.querySelector(s),qa=s=>[...document.querySelectorAll(s)];
  const GEOMETRY_KEY='ds_zoom_participants_geometry_2_0_41';
  const isMac=/Mac|darwin/i.test([navigator.platform,navigator.userAgent,navigator.userAgentData?.platform].filter(Boolean).join(' '));
  let runtimeMac=isMac||/Mac/i.test(String(window.dominionDesktop?.platform||'')),syncFrame=0,activeSpeakerIds=[];

  const ICONS=Object.freeze({
    micOn:'<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="9" y="3" width="6" height="11" rx="3"></rect><path d="M5.5 11.5a6.5 6.5 0 0 0 13 0M12 18v3M9 21h6"></path></svg>',
    micOff:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 9v2.5a3 3 0 0 0 4.9 2.3M15 10V6a3 3 0 0 0-5.6-1.5M5.5 11.5a6.5 6.5 0 0 0 10.7 5M12 18v3M9 21h6M4 4l16 16"></path></svg>',
    videoOn:'<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="6" width="13" height="12" rx="3"></rect><path d="m16 10 5-3v10l-5-3z"></path></svg>',
    videoOff:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3.5 7.5A3 3 0 0 1 6 6h8a2 2 0 0 1 2 2v6.5M15 18H6a3 3 0 0 1-3-3V9M16 10l5-3v10l-3.5-2.1M4 4l16 16"></path></svg>'
  });

  function ensureStyle(){
    if(q('style[data-ds-zoom-participants-reference-2041]'))return;
    const style=document.createElement('style');
    style.dataset.dsZoomParticipantsReference2041='1';
    style.textContent=`
      #meetingOverlay .room-side.ds-participants-reference{
        position:absolute!important;width:318px!important;min-width:300px!important;max-width:min(342px,calc(100% - 24px))!important;
        height:452px!important;min-height:360px!important;max-height:calc(100% - 24px)!important;
        left:auto!important;right:24px!important;top:18px!important;bottom:auto!important;transform:none!important;
        display:flex!important;flex-direction:column!important;padding:0!important;border:1px solid #55565a!important;border-radius:10px!important;
        background:#2b2b2d!important;box-shadow:0 18px 54px rgba(0,0,0,.55)!important;overflow:hidden!important;resize:both!important;z-index:3200!important;color:#f5f5f6!important
      }
      #meetingOverlay .room-side.ds-participants-reference[hidden]{display:none!important}
      #meetingOverlay .room-side.ds-participants-reference.dragging{transform:none!important;box-shadow:0 22px 64px rgba(0,0,0,.62)!important}
      #meetingOverlay .room-side.ds-participants-reference .room-side-head{position:relative!important;flex:0 0 38px!important;height:38px!important;min-height:38px!important;padding:0 40px!important;display:flex!important;align-items:center!important;justify-content:center!important;border:0!important;border-bottom:1px solid #46474a!important;border-radius:10px 10px 0 0!important;background:#353537!important;cursor:move!important;user-select:none!important}
      #meetingOverlay .room-side.ds-participants-reference .room-side-head>div{text-align:center!important;min-width:0!important}
      #meetingOverlay .room-side.ds-participants-reference .room-side-head strong{font-size:13px!important;font-weight:650!important;letter-spacing:0!important;color:#f5f5f6!important}
      #meetingOverlay .room-side.ds-participants-reference .room-side-head small{display:none!important}
      #meetingOverlay .room-side.ds-participants-reference .room-side-head>button{position:absolute!important;right:9px!important;top:8px!important;width:26px!important;height:26px!important;border:0!important;background:transparent!important;color:#e4e4e5!important;font-size:18px!important;line-height:1!important;cursor:pointer!important}
       #meetingOverlay .room-side.ds-participants-reference .room-side-head>.ds-participants-popout{right:38px!important;font-size:14px!important;display:grid!important;place-items:center!important}
       #meetingOverlay .room-side.ds-participants-reference.ds-participants-mac .room-side-head>.ds-participants-popout{right:9px!important}
       #meetingOverlay .room-side.ds-participants-reference.ds-participants-mac .room-side-head>button[aria-label="Close participants"]{display:none!important}
      #meetingOverlay .room-side.ds-participants-reference.ds-participants-mac .room-side-head>button{display:block!important}
      #meetingOverlay .room-side.ds-participants-reference .room-side-head:has(.ds-panel-traffic)>div{padding-left:0!important;text-align:center!important}
      #meetingOverlay .room-side.ds-participants-reference .ds-panel-traffic{left:10px!important;top:0!important;height:38px!important;gap:7px!important}
      #meetingOverlay .room-side.ds-participants-reference .ds-panel-traffic>button{width:11px!important;min-width:11px!important;height:11px!important}
      .ds-participants-traffic{position:absolute;left:10px;top:0;height:38px;display:flex!important;align-items:center;gap:8px;z-index:8;pointer-events:auto;opacity:1!important;visibility:visible!important}
      .ds-participants-traffic button{width:12px;height:12px;border:0;border-radius:50%;padding:0;box-shadow:inset 0 0 0 1px rgba(0,0,0,.18);cursor:pointer}
      .ds-participants-traffic .close{background:#ff5f57}.ds-participants-traffic .min{background:#febc2e}.ds-participants-traffic .max{background:#28c840}
      .ds-participant-search-wrap{flex:0 0 auto;padding:8px 10px 7px;background:#2b2b2d;position:relative}
       .ds-participant-search-wrap[hidden],#meetingOverlay .room-side.ds-participants-reference .ds-participant-search-primary[hidden]{display:none!important}
      .ds-participant-search-wrap svg{position:absolute;left:20px;top:17px;width:15px;height:15px;fill:none;stroke:#d4d4d6;stroke-width:2;pointer-events:none}
      #meetingOverlay .room-side.ds-participants-reference .ds-participant-search-primary{display:block!important;width:100%!important;height:32px!important;margin:0!important;padding:0 10px 0 32px!important;border:1px solid #737477!important;border-radius:7px!important;outline:none!important;background:#202023!important;color:#f5f5f6!important;font:500 11px/32px -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif!important;box-shadow:none!important}
      #meetingOverlay .room-side.ds-participants-reference .ds-participant-search-primary:focus{border-color:#36a8ff!important;box-shadow:0 0 0 1px #36a8ff!important}
      #meetingOverlay .room-side.ds-participants-reference .ds-participant-search-primary::placeholder{color:#c6c6c8!important;opacity:1!important}
      #meetingOverlay .room-side.ds-participants-reference [data-ds-legacy-participant-search="1"],#meetingOverlay .room-side.ds-participants-reference [data-ds-legacy-participant-actions="1"]{display:none!important}
      #meetingOverlay .room-side.ds-participants-reference>section{padding:0!important;margin:0!important}
      #meetingOverlay .room-side.ds-participants-reference>section:not(#waitingQueueSection){display:flex!important;flex-direction:column!important;flex:1 1 auto!important;min-height:0!important;overflow:hidden!important}
      #meetingOverlay .room-side.ds-participants-reference section>h3{display:none!important}
      #meetingOverlay .room-side.ds-participants-reference #waitingQueueSection{flex:0 0 auto!important;max-height:150px!important;overflow:auto!important;border-bottom:1px solid #414245!important}
      #meetingOverlay .room-side.ds-participants-reference #participantRoster{flex:1 1 auto!important;min-height:0!important;max-height:331px!important;overflow-x:hidden!important;overflow-y:auto!important;overscroll-behavior:contain!important;scrollbar-gutter:stable!important;padding:3px 8px 6px!important;margin:0!important;scrollbar-width:thin!important;scrollbar-color:#626367 transparent!important}
      #meetingOverlay .room-side.ds-participants-reference #participantRoster .person-row{min-height:46px!important;height:46px!important;margin:0!important;padding:6px 8px!important;border:0!important;border-radius:7px!important;background:transparent!important;display:grid!important;grid-template-columns:34px minmax(0,1fr) auto auto!important;align-items:center!important;column-gap:10px!important}
      #meetingOverlay .room-side.ds-participants-reference #participantRoster .person-row:hover{background:#3a3a3d!important}
      #meetingOverlay .room-side.ds-participants-reference #participantRoster .person-row.participant-speaking{background:#303b34!important}
      #meetingOverlay .room-side.ds-participants-reference #participantRoster .person-row.participant-speaking .person-copy strong{color:#55d98a!important}
      #meetingOverlay .room-side.ds-participants-reference #participantRoster .person-row.participant-speaking [data-participant-mic]{color:#55d98a!important}
      #meetingOverlay .room-side.ds-participants-reference #participantRoster .person-row[hidden]{display:none!important}
      #meetingOverlay .room-side.ds-participants-reference #participantRoster .person-badge{width:34px!important;height:34px!important;border-radius:50%!important;margin:0!important;overflow:hidden!important;display:grid!important;place-items:center!important;background:#59616d!important;color:#fff!important;font-size:11px!important;font-weight:700!important}
      #meetingOverlay .room-side.ds-participants-reference #participantRoster .person-badge img{width:100%!important;height:100%!important;object-fit:cover!important;border-radius:50%!important}
      #meetingOverlay .room-side.ds-participants-reference #participantRoster .person-copy{min-width:0!important;display:flex!important;flex-direction:row!important;align-items:center!important;gap:5px!important;overflow:hidden!important}
      #meetingOverlay .room-side.ds-participants-reference #participantRoster .person-copy strong{min-width:0!important;display:block!important;overflow:hidden!important;text-overflow:ellipsis!important;white-space:nowrap!important;font-size:13px!important;font-weight:600!important;color:#f3f3f4!important}
      #meetingOverlay .room-side.ds-participants-reference #participantRoster .person-copy small{display:none!important}
      #meetingOverlay .room-side.ds-participants-reference #participantRoster .participant-you{font-style:normal!important;color:#dedee0!important;font-weight:500!important}
      #meetingOverlay .room-side.ds-participants-reference #participantRoster .ds-adaptive-role{display:inline!important;flex:none!important;font-size:11px!important;color:#dedee0!important;font-weight:500!important;white-space:nowrap!important}
      #meetingOverlay .room-side.ds-participants-reference #participantRoster .participant-media-state{display:flex!important;align-items:center!important;gap:8px!important;margin:0!important}
      #meetingOverlay .room-side.ds-participants-reference #participantRoster .participant-media-icon{width:18px!important;height:18px!important;display:grid!important;place-items:center!important;color:#d5d5d7!important;font-size:0!important}
      #meetingOverlay .room-side.ds-participants-reference #participantRoster .participant-media-icon svg{width:18px!important;height:18px!important;fill:none!important;stroke:currentColor!important;stroke-width:1.8!important;stroke-linecap:round!important;stroke-linejoin:round!important}
      #meetingOverlay .room-side.ds-participants-reference #participantRoster .participant-media-icon.off{color:#ff5365!important}
      #meetingOverlay .room-side.ds-participants-reference #participantRoster .participant-media-icon.on{color:#dfe0e2!important}
      #meetingOverlay .room-side.ds-participants-reference #participantRoster .participant-media-icon.unknown{color:#8f9094!important}
      .ds-participant-share-state{width:19px;height:19px;display:grid;place-items:center;color:#26d26f;flex:none}.ds-participant-share-state svg{width:18px;height:18px;fill:none;stroke:currentColor;stroke-width:1.9}
      #meetingOverlay .room-side.ds-participants-reference #participantRoster .participant-actions{display:flex!important;align-items:center!important;justify-content:flex-end!important;min-width:24px!important}
      #meetingOverlay .room-side.ds-participants-reference #participantRoster .participant-more,#meetingOverlay .room-side.ds-participants-reference #participantRoster .ds-participant-more{width:28px!important;height:28px!important;min-width:28px!important;padding:0!important;border:0!important;border-radius:5px!important;background:transparent!important;color:#d7d7d9!important;font-size:0!important;display:grid!important;place-items:center!important}
      #meetingOverlay .room-side.ds-participants-reference #participantRoster .participant-more:before,#meetingOverlay .room-side.ds-participants-reference #participantRoster .ds-participant-more:before{content:'•••';font-size:11px!important;letter-spacing:1px!important;line-height:1!important}
      #participantBulkActions{display:none!important}
      #meetingOverlay .room-side.ds-participants-reference .ds-ref-participants-footer{position:relative!important;left:auto!important;right:auto!important;bottom:auto!important;flex:0 0 56px!important;height:56px!important;padding:10px 12px!important;margin:0!important;border-top:1px solid #454649!important;border-radius:0 0 10px 10px!important;background:#333335!important;display:flex!important;align-items:center!important;gap:10px!important}
      #meetingOverlay .room-side.ds-participants-reference .ds-ref-participants-footer button{height:34px!important;min-width:88px!important;padding:0 16px!important;border:0!important;border-radius:18px!important;background:#55565a!important;color:#fff!important;font-size:11px!important;font-weight:600!important;cursor:pointer!important}
      #meetingOverlay .room-side.ds-participants-reference .ds-ref-participants-footer button:hover{background:#65666a!important}
      #meetingOverlay .room-side.ds-participants-reference .ds-ref-participants-footer button:last-child{margin-left:auto!important;min-width:58px!important}
      #meetingOverlay .meeting-footer #roomMic.ds-av-off .ds-control-icon,#meetingOverlay .meeting-footer #roomCamera.ds-av-off .ds-control-icon{color:#ff5365!important}
      #meetingOverlay .meeting-footer #roomMic .ds-control-icon svg,#meetingOverlay .meeting-footer #roomCamera .ds-control-icon svg{fill:none!important;stroke:currentColor!important;stroke-width:1.9!important;stroke-linecap:round!important;stroke-linejoin:round!important}
      #meetingOverlay .meeting-footer #roomCamera::before,#meetingOverlay .meeting-footer #roomCamera::after,#meetingOverlay .meeting-footer #roomCamera .ds-control-icon::before,#meetingOverlay .meeting-footer #roomCamera .ds-control-icon::after{content:none!important}
      #meetingOverlay .meeting-footer #roomCamera.ds-av-off .ds-control-icon{position:relative!important}
      #meetingOverlay .meeting-footer #roomCamera.ds-av-off .ds-control-icon::after{content:""!important;position:absolute!important;left:-1px!important;right:-1px!important;top:50%!important;height:2px!important;border-radius:999px!important;background:#ff5365!important;transform:translateY(-50%) rotate(-45deg)!important;pointer-events:none!important}
      .ds-participant-search-empty{padding:28px 14px;text-align:center;color:#a9aaad;font-size:11px}
      #meetingOverlay .room-side.ds-participants-reference.ds-panel-collapsed{height:38px!important;min-height:38px!important;resize:none!important}
      #meetingOverlay .room-side.ds-participants-reference.ds-panel-collapsed>:not(.room-side-head){display:none!important}
      @media(max-width:720px){#meetingOverlay .room-side.ds-participants-reference{width:min(360px,calc(100% - 20px))!important;height:min(500px,calc(100% - 20px))!important;right:10px!important;top:10px!important}}
    `;
    document.head.append(style);
  }

  function meetingOpen(){const overlay=q('#meetingOverlay');return Boolean(overlay&&!overlay.hidden);}
  function sidePanel(){return q('#meetingOverlay .room-side');}
  function participantRows(){return qa('#participantRoster [data-participant-id]');}
  function localRole(){return String(q('#roomRole')?.textContent||'participant').toLowerCase().replace('-','');}

  function ensureHeader(side){
    let head=side.querySelector('.room-side-head');
    if(!head){head=document.createElement('header');head.className='room-side-head';head.innerHTML='<div><strong>Participants</strong><small></small></div><button type="button" class="ds-participants-popout" aria-label="Expand participants" title="Expand participants">↗</button><button type="button" aria-label="Close participants">×</button>';side.prepend(head);}
    const close=head.querySelector(':scope > button[aria-label="Close participants"]');if(close&&close.dataset.dsParticipantRefClose!=='1'){close.dataset.dsParticipantRefClose='1';close.onclick=()=>q('#roomParticipants')?.click();}
    let popout=head.querySelector('.ds-participants-popout');if(!popout){popout=document.createElement('button');popout.type='button';popout.className='ds-participants-popout';popout.setAttribute('aria-label','Expand participants');popout.title='Expand participants';popout.textContent='↗';head.insertBefore(popout,close||null);}
    if(popout.dataset.dsParticipantPopoutBound!=='1'){popout.dataset.dsParticipantPopoutBound='1';popout.onclick=event=>{event.stopPropagation();side.classList.toggle('ds-panel-wide');window.DominionRuntimeStability?.layoutSideSurface?.();};}
    if((runtimeMac||Boolean(window.dominionDesktop))&&!head.querySelector('.ds-participants-traffic')){
      side.classList.add('ds-participants-mac');const traffic=document.createElement('div');traffic.className='ds-participants-traffic';
      traffic.innerHTML='<button type="button" class="close" aria-label="Close participants"></button><button type="button" class="min" aria-label="Collapse participants"></button><button type="button" class="max" aria-label="Expand participants"></button>';head.prepend(traffic);
      traffic.querySelector('.close').onclick=event=>{event.stopPropagation();q('#roomParticipants')?.click();};
      traffic.querySelector('.min').onclick=event=>{event.stopPropagation();side.classList.add('ds-panel-collapsed');};
      traffic.querySelector('.max').onclick=event=>{event.stopPropagation();side.classList.remove('ds-panel-collapsed');side.classList.toggle('ds-panel-wide');window.DominionRuntimeStability?.layoutSideSurface?.();saveGeometry(side);};
    }
    return head;
  }

  function cleanupLegacySearch(side,primary){
    for(const input of [...side.querySelectorAll('input[type="search"]')]){
      if(input===primary)continue;
      input.dataset.dsLegacyParticipantSearch='1';input.hidden=true;
      const parent=input.parentElement;
      if(parent&&parent!==side&&!parent.matches('section')&&parent.children.length<=2){parent.dataset.dsLegacyParticipantSearch='1';parent.hidden=true;}
    }
  }

  function ensureSearch(side){
    let wrap=side.querySelector('.ds-participant-search-wrap');
    if(!wrap){wrap=document.createElement('div');wrap.className='ds-participant-search-wrap';wrap.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7"></circle><path d="m16.5 16.5 4 4"></path></svg><input class="zoom-participant-search ds-participant-search-primary" type="search" autocomplete="off" placeholder="Search" aria-label="Search participants">';ensureHeader(side).insertAdjacentElement('afterend',wrap);wrap.querySelector('input').addEventListener('input',event=>filterRows(event.currentTarget.value));}
    const input=wrap.querySelector('.ds-participant-search-primary');if(input)input.removeAttribute('style');
    cleanupLegacySearch(side,input);return input;
  }

  function cleanupLegacyActionBars(side){
    for(const child of [...side.children]){
      if(child.matches('.room-side-head,.ds-participant-search-wrap,.ds-ref-participants-footer,section'))continue;
      const text=String(child.textContent||'').replace(/\s+/g,' ').trim();
      if(child.querySelector('button')&&(/\bInvite\b/i.test(text)||/\bMute All\b/i.test(text)||/\bMute all\b/i.test(text))){child.dataset.dsLegacyParticipantActions='1';child.hidden=true;}
    }
    const bulk=q('#participantBulkActions');if(bulk)bulk.hidden=true;
  }

  function filterRows(value){
    const term=String(value||'').trim().toLocaleLowerCase();let visible=0;
    for(const row of participantRows()){const name=String(row.dataset.participantName||row.textContent||'').toLocaleLowerCase();row.hidden=Boolean(term&&!name.includes(term));if(!row.hidden)visible++;}
    const roster=q('#participantRoster');if(!roster)return;let empty=roster.querySelector('.ds-participant-search-empty');
    if(term&&visible===0){if(!empty){empty=document.createElement('div');empty.className='ds-participant-search-empty';empty.textContent='No participants found';roster.append(empty);}}else empty?.remove();
  }

  function iconState(node){if(node.classList.contains('off'))return 'off';if(node.classList.contains('on'))return 'on';return 'unknown';}
  function syncParticipantMediaIcons(){
    for(const row of participantRows()){
      const mic=row.querySelector('[data-participant-mic]'),video=row.querySelector('[data-participant-video]');
      for(const [node,kind] of [[mic,'mic'],[video,'video']]){
        if(!node)continue;const state=iconState(node),signature=`${kind}:${state}`;if(node.dataset.dsSemanticState===signature)continue;
        node.dataset.dsSemanticState=signature;node.innerHTML=kind==='mic'?(state==='off'?ICONS.micOff:ICONS.micOn):(state==='off'?ICONS.videoOff:ICONS.videoOn);
      }
    }
  }

  function toolbarOff(button,kind){
    if(!button)return false;if(button.classList.contains('is-off'))return true;
    const snap=window.DominionMediaController?.snapshot?.();if(kind==='mic'&&snap&&typeof snap.micOn==='boolean')return !snap.micOn;if(kind==='video'&&snap&&typeof snap.cameraOn==='boolean')return !snap.cameraOn;
    return /unmute|start video/i.test(String(button.getAttribute('aria-label')||''));
  }
  function syncToolbarAvIcons(){
    for(const [id,kind] of [['#roomMic','mic'],['#roomCamera','video']]){
      const button=q(id),icon=button?.querySelector('.ds-control-icon');if(!button||!icon)continue;const off=toolbarOff(button,kind),signature=`${kind}:${off?'off':'on'}`;
      if(icon.dataset.dsSemanticState!==signature){icon.dataset.dsSemanticState=signature;icon.innerHTML=kind==='mic'?ICONS.micOn:ICONS.videoOn;}
      button.classList.toggle('ds-av-off',off);
    }
  }

  function micIsOn(row){return Boolean(row.querySelector('[data-participant-mic].on'));}
  function sortRows(){
    const roster=q('#participantRoster');if(!roster)return;const rows=participantRows(),speakerRank=id=>{const index=activeSpeakerIds.indexOf(String(id||''));return index<0?999:index;};
    const rank=row=>{const speaking=speakerRank(row.dataset.participantId)<999,self=row.dataset.participantSelf==='1',role=String(row.dataset.participantRole||'participant').toLowerCase().replace('-','');if(speaking)return speakerRank(row.dataset.participantId);if(self)return 20;if(role==='host')return 21;if(role==='cohost')return 22;if(micIsOn(row))return 23;return 24;};
    for(const row of rows)row.classList.toggle('participant-speaking',speakerRank(row.dataset.participantId)<999);
    const sorted=[...rows].sort((a,b)=>rank(a)-rank(b)||String(a.dataset.participantName||'').localeCompare(String(b.dataset.participantName||''),undefined,{numeric:true,sensitivity:'base'}));
    if(sorted.some((row,index)=>row!==rows[index])){const fragment=document.createDocumentFragment();sorted.forEach(row=>fragment.append(row));roster.append(fragment);}
  }

  function syncShareState(){
    const active=Boolean(q('#meetingOverlay')?.classList.contains('share-active'));
    for(const row of participantRows()){
      const self=row.dataset.participantSelf==='1';let icon=row.querySelector('.ds-participant-share-state');
      if(active&&self){if(!icon){icon=document.createElement('span');icon.className='ds-participant-share-state';icon.title='Sharing screen';icon.setAttribute('aria-label','Sharing screen');icon.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="4" width="18" height="14" rx="2"></rect><path d="m8 11 4-4 4 4M12 7v8"></path></svg>';row.querySelector('.participant-media-state')?.prepend(icon);}}else icon?.remove();
    }
  }

  function saveGeometry(side){
    if(!side||side.hidden||side.dataset.dsAdaptiveUserPositioned!=='1')return;const body=q('#meetingOverlay .meeting-body');if(!body)return;
    const sr=side.getBoundingClientRect(),br=body.getBoundingClientRect();try{localStorage.setItem(GEOMETRY_KEY,JSON.stringify({left:Math.max(0,sr.left-br.left),top:Math.max(0,sr.top-br.top),width:sr.width,height:sr.height}));}catch{}
  }

  function applyGeometry(side){
    if(window.DominionRuntimeStability?.layoutSideSurface)return;
    const body=q('#meetingOverlay .meeting-body');if(!body)return;side.dataset.zoomPanelMode='popout';side.dataset.dsAdaptiveMode='floating';side.dataset.dsAdaptiveInitialized='1';
    if(side.dataset.dsAdaptiveUserPositioned==='1')return;
    let saved=null;try{saved=JSON.parse(localStorage.getItem(GEOMETRY_KEY)||'null');}catch{}
    if(saved&&Number.isFinite(saved.left)&&Number.isFinite(saved.top)&&Number.isFinite(saved.width)&&Number.isFinite(saved.height)){
      const width=Math.min(Math.max(saved.width,294),Math.min(340,body.clientWidth-24)),height=Math.min(Math.max(saved.height,300),Math.min(430,body.clientHeight-24)),left=Math.max(10,Math.min(saved.left,body.clientWidth-width-10)),top=Math.max(10,Math.min(saved.top,body.clientHeight-height-10));
      side.style.setProperty('width',`${width}px`,'important');side.style.setProperty('height',`${height}px`,'important');side.style.setProperty('left',`${left}px`,'important');side.style.setProperty('right','auto','important');side.style.setProperty('top',`${top}px`,'important');side.style.setProperty('bottom','auto','important');side.style.setProperty('transform','none','important');
    }else{
      side.style.setProperty('width',`${Math.min(318,Math.max(294,body.clientWidth-24))}px`,'important');side.style.setProperty('height',`${Math.min(390,Math.max(300,body.clientHeight-24))}px`,'important');side.style.setProperty('left','auto','important');side.style.setProperty('right','24px','important');side.style.setProperty('top','18px','important');side.style.setProperty('bottom','auto','important');side.style.setProperty('transform','none','important');
    }
  }

  function syncFooter(side){
    const footer=side.querySelector('.ds-ref-participants-footer');if(!footer)return;footer.hidden=false;footer.removeAttribute('data-ds-legacy-participant-actions');
    const action=footer.querySelector('[data-ref-mute-all]'),more=footer.querySelector('[data-ref-participant-more]');if(!action)return;
    const manager=['host','cohost'].includes(localRole()),desired=manager?'Mute all':'Unmute me';if(action.textContent!==desired&&!['Muted','No one to mute','Host only'].includes(action.textContent))action.textContent=desired;
    if(more)more.hidden=!manager;
    if(action.dataset.dsParticipantRefAction!==desired){
      action.dataset.dsParticipantRefAction=desired;
      action.onclick=async()=>{if(manager){const result=await window.DominionParticipantControls?.sendAll?.('host:mute');if(result?.count===0){action.textContent='No one to mute';setTimeout(()=>{action.textContent='Mute all';},1500);}}else{const mic=q('#roomMic');if(toolbarOff(mic,'mic'))mic.click();}};
    }
  }

  function sync(){
    syncFrame=0;ensureStyle();if(!meetingOpen())return;const side=sidePanel();if(!side)return;
    side.classList.add('ds-participants-reference');ensureHeader(side);if(side.hidden)return;const search=ensureSearch(side);cleanupLegacyActionBars(side);applyGeometry(side);
    const rows=participantRows(),head=side.querySelector('.room-side-head strong');if(head)head.textContent=`Participants (${rows.length||1})`;
    const searchWrap=side.querySelector('.ds-participant-search-wrap');if(searchWrap)searchWrap.hidden=rows.length<7;
    if(search)search.hidden=rows.length<7;
    sortRows();syncParticipantMediaIcons();syncToolbarAvIcons();syncShareState();syncFooter(side);if(search&&!search.hidden)filterRows(search.value);
  }
  function schedule(){if(syncFrame)return;syncFrame=requestAnimationFrame(sync);}

  document.addEventListener('mouseup',()=>{const side=sidePanel();if(side?.dataset.dsAdaptiveUserPositioned==='1')saveGeometry(side);},true);
  document.addEventListener('pointerup',()=>{const side=sidePanel();if(side?.dataset.dsAdaptiveUserPositioned==='1')saveGeometry(side);},true);
  window.addEventListener('resize',schedule,true);window.addEventListener('dominion:remote-media-state',schedule,true);window.addEventListener('dominion:share-state',schedule,true);window.addEventListener('dominion:meeting-ui-ready',schedule,true);window.addEventListener('dominion:active-speakers',event=>{activeSpeakerIds=Array.isArray(event.detail?.participantIds)?event.detail.participantIds.map(String):[];schedule();},true);
  window.dominionDesktop?.environment?.().then(info=>{if(info?.platform==='darwin'&&!runtimeMac){runtimeMac=true;schedule();}}).catch(()=>{});
  const observer=new MutationObserver(schedule);const observedRoot=q('#meetingOverlay')||document.body;observer.observe(observedRoot,{subtree:true,childList:true,attributes:true,attributeFilter:['hidden','data-participant-role','data-participant-name','data-participant-self']});
  const timer=setInterval(()=>{const side=sidePanel();if(!document.hidden&&meetingOpen()&&side&&!side.hidden)schedule();},6000);

  window.DominionZoomParticipantsReference2041=Object.freeze({version:'2.0.49-mac-header-seven-row-reference',sync,saveGeometry,resetGeometry:()=>{try{localStorage.removeItem(GEOMETRY_KEY);}catch{}const side=sidePanel();if(side){delete side.dataset.dsParticipantsRefGeometry;delete side.dataset.dsAdaptiveUserPositioned;schedule();}},dispose:()=>{clearInterval(timer);observer.disconnect();if(syncFrame)cancelAnimationFrame(syncFrame);}});
  sync();
})();
