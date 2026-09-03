(()=>{
  const bridge=window.dominionDesktop?.presenter;
  const $=selector=>document.querySelector(selector),toolbar=$('#toolbar'),more=$('#moreMenu');let reactions=null,handRaised=false,hideTimer=0,lastPointerAt=Date.now();
  const AUTO_HIDE_MS=2400;
  const menusOpen=()=>!more.hidden||Boolean(reactions);
  const revealToolbar=()=>{
    lastPointerAt=Date.now();
    toolbar.classList.remove('auto-hidden');
    if(hideTimer){clearTimeout(hideTimer);hideTimer=0;}
  };
  const scheduleAutoHide=()=>{
    if(hideTimer){clearTimeout(hideTimer);hideTimer=0;}
    if(menusOpen()||document.activeElement?.closest?.('button'))return;
    hideTimer=setTimeout(()=>{
      hideTimer=0;
      if(menusOpen())return;
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
    closeReactions();reactions=document.createElement('div');reactions.className='presenter-reaction-menu';
    for(const emoji of ['👏','👍','❤️','😂','😮','🎉']){const button=document.createElement('button');button.type='button';button.textContent=emoji;button.onclick=()=>{closeReactions();more.hidden=true;setMenuExpanded(false);void bridge?.command?.(`reaction:${emoji}`);};reactions.append(button);}
    const hand=document.createElement('button');hand.type='button';hand.className='presenter-hand-action';hand.textContent=handRaised?'✋ Lower Hand':'✋ Raise Hand';hand.onclick=()=>{closeReactions();more.hidden=true;setMenuExpanded(false);void bridge?.command?.('toggle-hand');};reactions.append(hand);
    anchor.parentElement.append(reactions);
  }
  document.querySelectorAll('[data-command]').forEach(button=>button.addEventListener('click',async()=>{
    const command=String(button.dataset.command||'');
    if(command==='reactions'){setMenuExpanded(true);openReactions(button);return;}
    closeReactions();more.hidden=true;setMenuExpanded(false);
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
  $('#moreButton').addEventListener('click',()=>{closeReactions();more.hidden=!more.hidden;setMenuExpanded(!more.hidden);});
  document.addEventListener('pointerdown',event=>{revealToolbar();if(!event.target.closest('.more-wrap')){more.hidden=true;closeReactions();setMenuExpanded(false);}},true);
  window.addEventListener('blur',()=>{more.hidden=true;closeReactions();setMenuExpanded(false);});
  window.addEventListener('pointermove',()=>{revealToolbar();scheduleAutoHide();},{passive:true});
  window.addEventListener('pointerenter',()=>{revealToolbar();scheduleAutoHide();},{passive:true});
  window.addEventListener('focus',()=>{revealToolbar();scheduleAutoHide();});
  toolbar.addEventListener('pointerleave',scheduleAutoHide,{passive:true});
  revealToolbar();scheduleAutoHide();
  bridge?.onState?.(state=>{
    const paused=Boolean(state?.paused);handRaised=Boolean(state?.handRaised);toolbar.classList.toggle('paused',paused);$('#pauseLabel').textContent=paused?'Resume':'Pause';$('#shareStateLabel').textContent=paused?'Share paused':'You are sharing';
    $('#audioLabel').textContent=state?.micOn?'Mute':'Unmute';$('#videoLabel').textContent=state?.cameraOn?'Stop Video':'Start Video';const source=$('#shareSourceLabel');if(source)source.textContent=String(state?.sourceName||'Shared content');const audioFlag=$('#shareAudioFlag');if(audioFlag)audioFlag.hidden=!state?.shareAudio;const optimizeFlag=$('#shareOptimizeFlag');if(optimizeFlag)optimizeFlag.hidden=!state?.optimizeVideo;
    const meetingLabel=$('#meetingLabel');if(meetingLabel)meetingLabel.textContent=state?.meetingVisible?'Hide meeting':'Show meeting';
    const record=$('#presenterRecordCommand'),stopRecord=$('#presenterStopRecord');if(record)record.textContent=state?.recording?(state?.recordingPaused?'Resume recording':'Pause recording'):'Record meeting';if(stopRecord)stopRecord.hidden=!state?.recording;
  });
})();
