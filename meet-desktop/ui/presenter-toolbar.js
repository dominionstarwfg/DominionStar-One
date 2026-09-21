(()=>{
  const bridge=window.dominionDesktop?.presenter;
  const $=selector=>document.querySelector(selector),toolbar=$('#toolbar'),more=$('#moreMenu'),layout=$('#layoutMenu'),layoutEditor=$('#presenterLayoutLiveEditor');let reactions=null,handRaised=false,hideTimer=0,lastPointerAt=Date.now(),lastState={},liveGeometry=null,editorDragging=false;
  const AUTO_HIDE_MS=2400;
  const menusOpen=()=>!more.hidden||!layout.hidden||Boolean(reactions);
  const revealToolbar=()=>{
    lastPointerAt=Date.now();
    toolbar.classList.remove('auto-hidden');
    if(hideTimer){clearTimeout(hideTimer);hideTimer=0;}
  };
  const scheduleAutoHide=()=>{
    if(hideTimer){clearTimeout(hideTimer);hideTimer=0;}
    if(menusOpen()||lastState.alwaysShowControls===true)return;
    hideTimer=setTimeout(()=>{
      hideTimer=0;
      if(menusOpen()||lastState.alwaysShowControls===true)return;
      if(Date.now()-lastPointerAt<AUTO_HIDE_MS-80){scheduleAutoHide();return;}
      toolbar.classList.add('auto-hidden');
    },AUTO_HIDE_MS);
  };
  const setMenuExpanded=open=>{
    toolbar.classList.toggle('menu-open',Boolean(open));
    if(open)revealToolbar();else scheduleAutoHide();
    void bridge?.setMenuOpen?.(Boolean(open));
  };
  const routedCommand=command=>['chat','participants','annotate','stop'].includes(String(command||''))?`toolbar:${command}`:String(command||'');
  function closeReactions(){reactions?.remove();reactions=null;toolbar.classList.remove('menu-open');}
  function openReactions(anchor){
    closeReactions();toolbar.classList.add('menu-open');reactions=document.createElement('div');reactions.className='presenter-reaction-menu';
    for(const emoji of ['👏','👍','❤️','😂','😮','🎉']){const button=document.createElement('button');button.type='button';button.textContent=emoji;button.onclick=()=>{closeReactions();more.hidden=true;setMenuExpanded(false);void bridge?.command?.(`reaction:${emoji}`);};reactions.append(button);}
    const hand=document.createElement('button');hand.type='button';hand.className='presenter-hand-action';hand.textContent=handRaised?'✋ Lower Hand':'✋ Raise Hand';hand.onclick=()=>{closeReactions();more.hidden=true;setMenuExpanded(false);void bridge?.command?.('toggle-hand');};reactions.append(hand);
    anchor.parentElement.append(reactions);
  }
  const clamp=(v,min,max)=>Math.max(min,Math.min(max,v));
  const defaultGeometry=layout=>layout==='background'?{camera:{x:.70,y:.68,w:.27,h:.27},content:{x:0,y:0,w:1,h:1}}:layout==='shoulder'?{camera:{x:0,y:0,w:.38,h:1},content:{x:.405,y:.08,w:.57,h:.84}}:{camera:{x:.02,y:.02,w:.30,h:.96},content:{x:.34,y:.02,w:.64,h:.96}};
  const normalizeRect=(rect,fallback)=>{const raw=rect&&typeof rect==='object'?rect:{},base=fallback||{x:0,y:0,w:1,h:1};let x=Number.isFinite(Number(raw.x))?Number(raw.x):base.x,y=Number.isFinite(Number(raw.y))?Number(raw.y):base.y,w=Number.isFinite(Number(raw.w))?Number(raw.w):base.w,h=Number.isFinite(Number(raw.h))?Number(raw.h):base.h;x=clamp(x,0,.95);y=clamp(y,0,.95);w=clamp(w,.08,1-x);h=clamp(h,.08,1-y);return {x,y,w,h};};
  const normalizedGeometry=(raw,layout)=>{const base=defaultGeometry(layout);return {camera:normalizeRect(raw?.camera,base.camera),content:normalizeRect(raw?.content,base.content)};};
  function renderLayoutEditor(layoutMode){
    if(!layoutEditor)return;layoutEditor.hidden=layoutMode==='content';if(layoutMode==='content')return;liveGeometry=normalizedGeometry(liveGeometry||lastState.presenterGeometry,layoutMode);
    for(const role of ['camera','content']){const item=layoutEditor.querySelector(`[data-live-role="${role}"]`),rect=liveGeometry[role];if(!item||!rect)continue;item.style.left=`${rect.x*100}%`;item.style.top=`${rect.y*100}%`;item.style.width=`${rect.w*100}%`;item.style.height=`${rect.h*100}%`;}
  }
  function bindLayoutEditor(){
    if(!layoutEditor)return;layoutEditor.querySelectorAll('[data-live-role]').forEach(item=>item.addEventListener('pointerdown',event=>{
      if(event.button!==0||!liveGeometry)return;event.preventDefault();event.stopPropagation();const role=String(item.dataset.liveRole||''),stage=item.closest('.presenter-layout-live-stage'),box=stage.getBoundingClientRect(),start={x:event.clientX,y:event.clientY},base={...liveGeometry[role]},resize=Boolean(event.target.closest('.resize-handle'));editorDragging=true;item.classList.add('dragging');item.setPointerCapture?.(event.pointerId);
      const move=moveEvent=>{if(!item.hasPointerCapture?.(event.pointerId))return;const dx=(moveEvent.clientX-start.x)/Math.max(1,box.width),dy=(moveEvent.clientY-start.y)/Math.max(1,box.height),next={...base};if(resize){next.w=clamp(base.w+dx,.08,1-base.x);next.h=clamp(base.h+dy,.08,1-base.y);}else{next.x=clamp(base.x+dx,0,1-base.w);next.y=clamp(base.y+dy,0,1-base.h);}liveGeometry={...liveGeometry,[role]:next};renderLayoutEditor(String(lastState.presenterLayout||'side'));};
      const up=async()=>{item.classList.remove('dragging');try{item.releasePointerCapture?.(event.pointerId);}catch{}item.removeEventListener('pointermove',move);item.removeEventListener('pointerup',up);editorDragging=false;const payload=encodeURIComponent(JSON.stringify(liveGeometry));await bridge?.command?.(`presenter-geometry:${payload}`);};
      item.addEventListener('pointermove',move);item.addEventListener('pointerup',up);
    }));}
  bindLayoutEditor();

  document.querySelectorAll('[data-command]').forEach(button=>button.addEventListener('click',async()=>{
    const command=String(button.dataset.command||'');
    if(command==='reactions'){setMenuExpanded(true);openReactions(button);return;}
    closeReactions();more.hidden=true;layout.hidden=true;setMenuExpanded(false);
    if(command==='hide-controls'){toolbar.classList.add('auto-hidden');return;}
    if(command==='stop'){
      if(button.dataset.stopping==='1')return;
      button.dataset.stopping='1';button.disabled=true;const label=button.querySelector('span:last-child');if(label)label.textContent='Stopping…';
      try{await bridge?.command?.(routedCommand('stop'));}
      catch{button.disabled=false;button.dataset.stopping='0';if(label)label.textContent='Stop Share';}
      setTimeout(()=>{if(!button.isConnected)return;button.disabled=false;button.dataset.stopping='0';if(label)label.textContent='Stop Share';},1600);
      return;
    }
    await bridge?.command?.(routedCommand(command));
  }));
  $('#layoutButton').addEventListener('click',()=>{closeReactions();more.hidden=true;layout.hidden=!layout.hidden;setMenuExpanded(!layout.hidden);});
  $('#moreButton').addEventListener('click',()=>{closeReactions();layout.hidden=true;more.hidden=!more.hidden;setMenuExpanded(!more.hidden);});
  document.addEventListener('pointerdown',event=>{revealToolbar();if(!event.target.closest('.more-wrap')&&!event.target.closest('.layout-wrap')){more.hidden=true;layout.hidden=true;closeReactions();setMenuExpanded(false);}},true);
  window.addEventListener('blur',()=>{more.hidden=true;layout.hidden=true;closeReactions();setMenuExpanded(false);});
  window.addEventListener('pointermove',()=>{revealToolbar();scheduleAutoHide();},{passive:true});
  window.addEventListener('pointerenter',()=>{revealToolbar();scheduleAutoHide();},{passive:true});
  window.addEventListener('focus',()=>{revealToolbar();scheduleAutoHide();});
  toolbar.addEventListener('pointerleave',scheduleAutoHide,{passive:true});
  window.addEventListener('keydown',event=>{
    if(event.repeat||event.target?.matches?.('input,textarea,select,[contenteditable="true"]'))return;
    const key=String(event.key||'').toLowerCase();let handled=false;
    if(event.metaKey&&event.shiftKey&&!event.ctrlKey&&!event.altKey){
      if(key==='a'){handled=true;void bridge?.command?.('audio');}
      else if(key==='v'){handled=true;void bridge?.command?.('video');}
      else if(key==='s'){handled=true;void bridge?.command?.(routedCommand('stop'));}
      else if(key==='t'){handled=true;void bridge?.command?.('pause');}
      else if(key==='h'){handled=true;void bridge?.command?.(routedCommand('chat'));}
      else if(key==='r'){handled=true;void bridge?.command?.('record');}
    }else if(event.metaKey&&!event.shiftKey&&!event.ctrlKey&&!event.altKey&&key==='u'){handled=true;void bridge?.command?.(routedCommand('participants'));}
    else if(event.altKey&&!event.metaKey&&!event.ctrlKey&&!event.shiftKey&&key==='y'){handled=true;void bridge?.command?.('toggle-hand');}
    else if(event.ctrlKey&&event.altKey&&event.metaKey&&!event.shiftKey&&key==='h'){handled=true;toolbar.classList.toggle('auto-hidden');}
    else if(event.ctrlKey&&!event.altKey&&!event.metaKey&&!event.shiftKey&&key==='\\'){handled=true;void bridge?.command?.('toggle-always-show-controls');}
    if(handled)event.preventDefault();
  },true);
  revealToolbar();scheduleAutoHide();
  bridge?.onState?.(state=>{
    lastState={...lastState,...state};if(lastState.alwaysShowControls===true)revealToolbar();else scheduleAutoHide();
    const paused=Boolean(state?.paused);handRaised=Boolean(state?.handRaised);toolbar.classList.toggle('paused',paused);$('#pauseLabel').textContent=paused?'Resume':'Pause';$('#shareStateLabel').textContent=paused?'Share paused':'You are sharing';
    $('#audioLabel').textContent=state?.micOn?'Mute':'Unmute';$('#videoLabel').textContent=state?.cameraOn?'Stop Video':'Start Video';const source=$('#shareSourceLabel');if(source)source.textContent=String(state?.sourceName||'Shared content');const audioFlag=$('#shareAudioFlag');if(audioFlag)audioFlag.hidden=!state?.shareAudio;const optimizeFlag=$('#shareOptimizeFlag');if(optimizeFlag)optimizeFlag.hidden=!state?.optimizeVideo;
    const shareSound=$('#presenterShareSound'),mono=$('#presenterShareSoundMono'),stereo=$('#presenterShareSoundStereo'),optimizeCommand=$('#presenterOptimizeVideo'),mode=String(state?.shareAudioMode||'mono')==='stereo'?'stereo':'mono';
    if(shareSound)shareSound.textContent=`${state?.shareAudio?'✓ ':''}Share Sound`;if(mono)mono.textContent=`${mode==='mono'?'✓ ':''}Sound mode: Mono`;if(stereo)stereo.textContent=`${mode==='stereo'?'✓ ':''}Sound mode: Stereo (high fidelity)`;if(optimizeCommand)optimizeCommand.textContent=`${state?.optimizeVideo?'✓ ':''}Optimize for video sharing`;
    const presenterLayout=['background','shoulder','side'].includes(String(state?.presenterLayout||''))?String(state.presenterLayout):'content';
    if(!editorDragging)liveGeometry=normalizedGeometry(state?.presenterGeometry,presenterLayout);renderLayoutEditor(presenterLayout);
    const presenterLayoutLabels={content:'Content only',background:'As background',shoulder:'Over the shoulder',side:'Side by side'};
    for(const [mode,id] of Object.entries({content:'presenterLayoutContent',background:'presenterLayoutBackground',shoulder:'presenterLayoutShoulder',side:'presenterLayoutSide'})){const node=$('#'+id);if(node)node.textContent=`${presenterLayout===mode?'✓ ':''}${presenterLayoutLabels[mode]}`;}
    const panelVisible=state?.participantVideoVisible!==false;
    for(const id of ['presenterLayoutShowVideo','presenterMoreShowVideo']){const node=$('#'+id);if(node)node.hidden=panelVisible;}
    for(const id of ['presenterLayoutHideVideo','presenterMoreHideVideo']){const node=$('#'+id);if(node)node.hidden=!panelVisible;}
    const meetingLabel=$('#meetingLabel');if(meetingLabel)meetingLabel.textContent=state?.meetingVisible?'Hide meeting':'Show meeting';
    const record=$('#presenterRecordCommand'),stopRecord=$('#presenterStopRecord');if(record)record.textContent=state?.recording?(state?.recordingPaused?'Resume recording':'Pause recording'):'Record meeting';if(stopRecord)stopRecord.hidden=!state?.recording;
  });
})();
