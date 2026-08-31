(()=>{
  'use strict';
  if(window.DominionZoomAdaptiveParity)return;

  const q=s=>document.querySelector(s),qa=s=>[...document.querySelectorAll(s)];
  const raisedAt=new Map();
  const VIDEO_DOCK_GEOMETRY_KEY='ds_zoom_video_dock_geometry_v1';
  let syncing=false;
  let timer=0;
  let participantPanelDrag=null;
  let participantHeadBound=null;
  let participantDocumentDragBound=false;
  let videoDockDrag=null;
  let videoDockBound=null;

  const meetingOpen=()=>Boolean(q('#meetingOverlay')&&!q('#meetingOverlay').hidden);
  const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));

  function participantRows(){return qa('#participantRoster [data-participant-id]');}
  function rowName(row){return String(row.dataset.participantName||row.querySelector('.person-copy strong')?.childNodes?.[0]?.textContent||row.textContent||'').trim();}
  function classify(row){
    const small=String(row.querySelector('.person-copy small')?.textContent||'').trim().toLowerCase();
    if(!row.dataset.dsAdaptiveSelf)row.dataset.dsAdaptiveSelf=/\byou\b|\bme\b/.test(small)?'1':'0';
    const self=row.dataset.dsAdaptiveSelf==='1';
    const role=String(row.dataset.participantRole||'participant').toLowerCase().replace('-','');
    const raised=row.dataset.raisedHand==='1'||Boolean(row.querySelector('.raised-hand-indicator'));
    const id=String(row.dataset.participantId||'');
    if(raised&&!raisedAt.has(id))raisedAt.set(id,Date.now());
    if(!raised)raisedAt.delete(id);
    const mic=row.querySelector('.ds-participant-media .ds-media-state');
    const micOn=Boolean(mic?.classList.contains('on'));
    let bucket=5;
    if(self)bucket=0;
    else if(role==='host')bucket=1;
    else if(role==='cohost')bucket=2;
    else if(raised)bucket=3;
    else if(micOn)bucket=4;
    return {row,id,name:rowName(row),role,self,raised,micOn,bucket,raisedAt:raisedAt.get(id)||Number.MAX_SAFE_INTEGER};
  }

  function sortParticipants(){
    const roster=q('#participantRoster');if(!roster)return;
    const rows=participantRows(),entries=rows.map(classify);
    const sorted=[...entries].sort((a,b)=>a.bucket-b.bucket||(a.bucket===3?a.raisedAt-b.raisedAt:0)||a.name.localeCompare(b.name,undefined,{numeric:true,sensitivity:'base'}));
    if(sorted.some((entry,index)=>entry.row!==rows[index])){
      const fragment=document.createDocumentFragment();for(const entry of sorted)fragment.append(entry.row);roster.append(fragment);
    }
    for(const entry of sorted){
      const copy=entry.row.querySelector('.person-copy');if(!copy)continue;
      let suffix=copy.querySelector('.ds-adaptive-role');
      if(!suffix){suffix=document.createElement('span');suffix.className='ds-adaptive-role';copy.querySelector('strong')?.insertAdjacentElement('afterend',suffix);}
      suffix.textContent=entry.self&&entry.role==='host'?'(Host, me)':entry.self?'(me)':entry.role==='host'?'(Host)':entry.role==='cohost'?'(Co-host)':'';
      suffix.hidden=!suffix.textContent;
    }
  }

  function hasWaitingPeople(){
    const queue=q('#waitingQueue');if(!queue)return false;
    return [...queue.children].some(node=>node.matches?.('[data-participant-id],[data-waiting-id],.waiting-person')||Boolean(node.querySelector?.('button')));
  }

  function centerParticipantPanel(side,count){
    const body=q('.meeting-body');if(!body||!side)return;
    const width=count<=1?320:count<=6?360:390;
    const height=count<=1?390:count<=6?500:Math.min(590,body.clientHeight-28);
    const w=Math.min(width,Math.max(280,body.clientWidth-24));
    const h=Math.min(height,Math.max(300,body.clientHeight-24));
    side.dataset.zoomPanelMode='popout';
    side.dataset.dsAdaptiveMode='floating';
    side.style.setProperty('position','absolute','important');
    side.style.setProperty('width',`${w}px`,'important');
    side.style.setProperty('height',`${h}px`,'important');
    side.style.setProperty('left',`${Math.max(12,(body.clientWidth-w)/2)}px`,'important');
    side.style.setProperty('right','auto','important');
    side.style.setProperty('top',`${Math.max(12,(body.clientHeight-h)/2)}px`,'important');
    side.style.setProperty('bottom','auto','important');
    side.style.setProperty('transform','none','important');
  }

  function startParticipantPanelDrag(event){
    if(event.button!==0||event.target.closest?.('button,a,input,select,textarea'))return;
    const head=event.currentTarget,side=head.closest('.room-side'),body=q('.meeting-body');
    if(!side||!body||side.dataset.zoomPanelMode!=='popout'||side.dataset.dsAdaptiveMode!=='floating')return;
    const sr=side.getBoundingClientRect();
    participantPanelDrag={id:event.pointerId,dx:event.clientX-sr.left,dy:event.clientY-sr.top,side};
    side.dataset.dsAdaptiveInitialized='1';side.dataset.dsAdaptiveUserPositioned='1';
    event.stopImmediatePropagation();event.preventDefault();
    side.classList.add('dragging');
    side.style.setProperty('right','auto','important');side.style.setProperty('bottom','auto','important');
  }
  function moveParticipantPanelDrag(event){
    if(!participantPanelDrag||event.pointerId!==participantPanelDrag.id)return;
    const side=participantPanelDrag.side,body=q('.meeting-body');if(!side||!body)return;
    const br=body.getBoundingClientRect(),w=side.offsetWidth,h=side.offsetHeight;
    const left=clamp(event.clientX-br.left-participantPanelDrag.dx,10,Math.max(10,br.width-w-10));
    const top=clamp(event.clientY-br.top-participantPanelDrag.dy,10,Math.max(10,br.height-h-10));
    side.style.setProperty('left',`${left}px`,'important');side.style.setProperty('top',`${top}px`,'important');
    event.stopImmediatePropagation();event.preventDefault();
  }
  function endParticipantPanelDrag(event){
    if(!participantPanelDrag||(event?.pointerId!=null&&event.pointerId!==participantPanelDrag.id))return;
    const side=participantPanelDrag.side;participantPanelDrag=null;
    side?.classList.remove('dragging');event.stopImmediatePropagation();event.preventDefault();
  }
  function installParticipantPanelDrag(){
    const head=q('.room-side .room-side-head');if(!head)return;
    if(head!==participantHeadBound){
      participantHeadBound?.removeEventListener('pointerdown',startParticipantPanelDrag,true);
      participantHeadBound=head;head.dataset.dsAdaptiveParticipantDrag='1';
      head.addEventListener('pointerdown',startParticipantPanelDrag,true);
    }
    if(!participantDocumentDragBound){
      participantDocumentDragBound=true;
      document.addEventListener('pointermove',moveParticipantPanelDrag,true);
      document.addEventListener('pointerup',endParticipantPanelDrag,true);
      document.addEventListener('pointercancel',endParticipantPanelDrag,true);
    }
  }

  function syncParticipants(){
    if(!meetingOpen())return;
    const side=q('.room-side'),roster=q('#participantRoster');if(!side||!roster)return;
    const rows=participantRows(),count=rows.length;
    side.dataset.dsAdaptiveCount=String(count);
    const heading=side.querySelector('.room-side-head strong')||side.querySelector('section h3');
    if(heading)heading.textContent=`Participants (${count})`;

    const search=side.querySelector('.zoom-participant-search');if(search)search.hidden=count<=1;
    const waiting=q('#waitingQueueSection');if(waiting)waiting.hidden=!hasWaitingPeople();

    sortParticipants();installParticipantPanelDrag();

    if(!side.hidden&&!side.dataset.dsAdaptiveInitialized){
      side.dataset.dsAdaptiveInitialized='1';
      if(count<=6)centerParticipantPanel(side,count);
    }else if(!side.hidden&&side.dataset.dsAdaptiveMode==='floating'&&side.dataset.zoomPanelMode==='popout'&&!participantPanelDrag){
      const rect=side.getBoundingClientRect(),body=q('.meeting-body')?.getBoundingClientRect();
      if(body&&(rect.right>body.right||rect.bottom>body.bottom||rect.left<body.left||rect.top<body.top))centerParticipantPanel(side,count);
    }

    for(const row of rows)row.querySelector('.ds-role-chip')?.setAttribute('aria-hidden','true');
  }

  function ensureChatNavigation(panel){
    const header=panel?.querySelector('header');if(!panel||!header)return;
    if(!panel.querySelector('.ds-adaptive-chat-nav')){
      const nav=document.createElement('div');nav.className='ds-adaptive-chat-nav';nav.innerHTML='<button type="button" class="active" data-chat-everyone>Everyone</button><button type="button" data-chat-new>＋ New chat</button>';
      header.insertAdjacentElement('afterend',nav);
      nav.querySelector('[data-chat-everyone]').onclick=()=>{const select=q('#meetingChatRecipient');if(select){select.value='everyone';select.dispatchEvent(new Event('change',{bubbles:true}));}q('#meetingChatInput')?.focus();};
      nav.querySelector('[data-chat-new]').onclick=()=>{q('#meetingChatRecipient')?.focus();};
    }
    const form=q('#meetingChatForm');
    if(form&&!panel.querySelector('.ds-chat-privacy')){const privacy=document.createElement('div');privacy.className='ds-chat-privacy';privacy.textContent='Who can see your messages?';form.before(privacy);}
    const send=form?.querySelector('button[type="submit"]');if(send&&!send.dataset.dsAdaptiveSend){send.dataset.dsAdaptiveSend='1';send.textContent='➤';send.title='Send';send.setAttribute('aria-label','Send message');}
  }

  function syncChat(){
    const panel=q('#meetingChatPanel'),body=q('.meeting-body'),stage=q('.stage'),overlay=q('#meetingOverlay');if(!panel||!body||!stage||!overlay)return;
    ensureChatNavigation(panel);
    if(panel.hidden){stage.style.removeProperty('margin-right');overlay.classList.remove('ds-chat-docked','ds-chat-floating');return;}
    const wide=body.clientWidth>=1120;
    overlay.classList.toggle('ds-chat-docked',wide);overlay.classList.toggle('ds-chat-floating',!wide);
    panel.dataset.dsAdaptiveMode=wide?'docked':'floating';
    panel.style.setProperty('position','absolute','important');panel.style.setProperty('right',wide?'8px':'12px','important');panel.style.setProperty('left','auto','important');panel.style.setProperty('top',wide?'8px':'12px','important');panel.style.setProperty('bottom',wide?'8px':'auto','important');panel.style.setProperty('width',`${wide?340:Math.min(360,Math.max(290,body.clientWidth-24))}px`,'important');panel.style.setProperty('height',wide?'auto':`${Math.min(520,Math.max(340,body.clientHeight-24))}px`,'important');
    if(wide)stage.style.setProperty('margin-right','356px','important');else stage.style.removeProperty('margin-right');
  }

  function saveVideoDockGeometry(dock,stage){try{const dr=dock.getBoundingClientRect(),sr=stage.getBoundingClientRect();localStorage.setItem(VIDEO_DOCK_GEOMETRY_KEY,JSON.stringify({left:dr.left-sr.left,top:dr.top-sr.top,width:dr.width,height:dr.height,anchor:dock.dataset.anchor||'right',resized:dock.classList.contains('user-resized')}));}catch{}}
  function nearestVideoDockAnchor(dock,stage){const dr=dock.getBoundingClientRect(),sr=stage.getBoundingClientRect();const distances={left:dr.left-sr.left,right:sr.right-dr.right,top:dr.top-sr.top,bottom:sr.bottom-dr.bottom};return Object.entries(distances).sort((a,b)=>a[1]-b[1])[0]?.[0]||'right';}
  function startVideoDockDrag(event){
    if(event.button!==0||event.target.closest?.('button,.participant-video-resize,a,input,select,textarea'))return;
    const dock=event.currentTarget,stage=q('.stage');if(!dock||!stage)return;
    const dr=dock.getBoundingClientRect();videoDockDrag={id:event.pointerId,dx:event.clientX-dr.left,dy:event.clientY-dr.top};
    event.stopImmediatePropagation();event.preventDefault();dock.setPointerCapture?.(event.pointerId);dock.classList.add('user-positioned','dragging');dock.style.right='auto';dock.style.bottom='auto';
  }
  function moveVideoDockDrag(event){if(!videoDockDrag||event.pointerId!==videoDockDrag.id)return;const dock=event.currentTarget,stage=q('.stage');if(!dock||!stage)return;const sr=stage.getBoundingClientRect();dock.style.left=`${clamp(event.clientX-sr.left-videoDockDrag.dx,8,Math.max(8,sr.width-dock.offsetWidth-8))}px`;dock.style.top=`${clamp(event.clientY-sr.top-videoDockDrag.dy,8,Math.max(8,sr.height-dock.offsetHeight-8))}px`;event.stopImmediatePropagation();}
  function endVideoDockDrag(event){if(!videoDockDrag||(event?.pointerId!=null&&event.pointerId!==videoDockDrag.id))return;const dock=event.currentTarget,stage=q('.stage');videoDockDrag=null;if(dock&&stage){dock.classList.remove('dragging');dock.dataset.anchor=nearestVideoDockAnchor(dock,stage);saveVideoDockGeometry(dock,stage);window.DominionMeetingParity?.syncVideoDock?.();}event?.stopImmediatePropagation?.();}
  function installVideoDockDrag(){const dock=q('#participantVideoDock');if(!dock||dock===videoDockBound)return;if(videoDockBound){videoDockBound.removeEventListener('pointerdown',startVideoDockDrag,true);videoDockBound.removeEventListener('pointermove',moveVideoDockDrag,true);videoDockBound.removeEventListener('pointerup',endVideoDockDrag,true);videoDockBound.removeEventListener('pointercancel',endVideoDockDrag,true);}videoDockBound=dock;dock.dataset.dsAdaptiveWholePanelDrag='1';dock.addEventListener('pointerdown',startVideoDockDrag,true);dock.addEventListener('pointermove',moveVideoDockDrag,true);dock.addEventListener('pointerup',endVideoDockDrag,true);dock.addEventListener('pointercancel',endVideoDockDrag,true);}

  function ensurePrejoinChrome(win){
    const preview=win?.querySelector('.preview-frame');if(!win||!preview)return;
    if(!preview.querySelector('[data-ds-prejoin-backgrounds]')){const background=document.createElement('button');background.type='button';background.dataset.dsPrejoinBackgrounds='1';background.className='ds-prejoin-backgrounds';background.textContent='▣ Backgrounds';background.onclick=()=>{const dialog=q('#settingsDialog');if(dialog&&!dialog.open)dialog.showModal();};preview.append(background);}
    let preference=win.querySelector('.ds-prejoin-always');if(!preference){preference=document.createElement('label');preference.className='ds-prejoin-always';preference.innerHTML='<input type="checkbox"><span>Always show this preview when joining</span>';const footer=win.querySelector('footer');footer?.insertAdjacentElement('beforebegin',preference);const input=preference.querySelector('input');input.checked=window.DominionPreferences?.read?.('showJoinPreview')!==false;input.onchange=()=>window.DominionPreferences?.write?.('showJoinPreview',input.checked);}
  }
  function syncPrejoin(){const overlay=q('#prejoinOverlay'),win=overlay?.querySelector('.prejoin-window');if(!overlay||overlay.hidden||!win)return;overlay.classList.add('ds-adaptive-prejoin');win.classList.add('ds-adaptive-prejoin-window');ensurePrejoinChrome(win);const deviceLabels=qa('#prejoinOverlay .device-grid label');for(const label of deviceLabels){const title=String(label.querySelector('span')?.textContent||'').trim().toLowerCase();label.hidden=title==='speaker';}const mirror=q('#prejoinOverlay .mirror-option');if(mirror)mirror.hidden=true;}

  function sync(){if(syncing)return;syncing=true;try{syncPrejoin();if(meetingOpen()){syncParticipants();syncChat();installVideoDockDrag();}}finally{syncing=false;}}

  document.addEventListener('click',event=>{
    if(event.target.closest?.('#roomParticipants'))requestAnimationFrame(()=>{const side=q('.room-side');if(side&&!side.hidden){side.dataset.dsAdaptiveInitialized='';delete side.dataset.dsAdaptiveUserPositioned;syncParticipants();}});
    if(event.target.closest?.('#roomChat'))requestAnimationFrame(syncChat);
    if(event.target.closest?.('.zoom-participant-layout-menu button')){const side=q('.room-side');if(side){side.dataset.dsAdaptiveInitialized='1';side.dataset.dsAdaptiveMode=side.dataset.zoomPanelMode==='popout'?'floating':'docked';}}
  });
  window.addEventListener('resize',()=>requestAnimationFrame(sync));window.addEventListener('dominion:meeting-ui-ready',()=>setTimeout(sync,0));window.addEventListener('dominion:meeting-snapshot',()=>requestAnimationFrame(sync));
  const observer=new MutationObserver(()=>requestAnimationFrame(sync));observer.observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:['hidden','class','data-raised-hand']});
  timer=setInterval(sync,650);sync();

  window.DominionZoomAdaptiveParity=Object.freeze({version:'2.0.21',sync,syncParticipants,syncChat,syncPrejoin,installParticipantPanelDrag,installVideoDockDrag,dispose:()=>{clearInterval(timer);observer.disconnect();participantHeadBound?.removeEventListener('pointerdown',startParticipantPanelDrag,true);if(participantDocumentDragBound){document.removeEventListener('pointermove',moveParticipantPanelDrag,true);document.removeEventListener('pointerup',endParticipantPanelDrag,true);document.removeEventListener('pointercancel',endParticipantPanelDrag,true);participantDocumentDragBound=false;}if(videoDockBound){videoDockBound.removeEventListener('pointerdown',startVideoDockDrag,true);videoDockBound.removeEventListener('pointermove',moveVideoDockDrag,true);videoDockBound.removeEventListener('pointerup',endVideoDockDrag,true);videoDockBound.removeEventListener('pointercancel',endVideoDockDrag,true);}}});
})();