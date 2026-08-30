(()=>{
  const bridge=window.dominionDesktop?.presenter;
  const $=selector=>document.querySelector(selector),toolbar=$('#toolbar'),more=$('#moreMenu');let reactions=null,handRaised=false;
  function closeReactions(){reactions?.remove();reactions=null;}
  function openReactions(anchor){closeReactions();reactions=document.createElement('div');reactions.className='presenter-reaction-menu';for(const emoji of ['👏','👍','❤️','😂','😮','🎉']){const button=document.createElement('button');button.type='button';button.textContent=emoji;button.onclick=()=>{closeReactions();more.hidden=true;void bridge?.command?.(`reaction:${emoji}`);};reactions.append(button);}const hand=document.createElement('button');hand.type='button';hand.className='presenter-hand-action';hand.textContent=handRaised?'✋ Lower Hand':'✋ Raise Hand';hand.onclick=()=>{closeReactions();more.hidden=true;void bridge?.command?.('toggle-hand');};reactions.append(hand);anchor.parentElement.append(reactions);}
  document.querySelectorAll('[data-command]').forEach(button=>button.addEventListener('click',()=>{let command=button.dataset.command;if(command==='reactions'){openReactions(button);return;}if(command==='new-share')command='smart-new-share';closeReactions();more.hidden=true;void bridge?.command?.(command);}));
  $('#moreButton').addEventListener('click',()=>{closeReactions();more.hidden=!more.hidden;});
  document.addEventListener('pointerdown',event=>{if(!event.target.closest('.more-wrap')){more.hidden=true;closeReactions();}},true);
  bridge?.onState?.(state=>{
    const paused=Boolean(state?.paused);handRaised=Boolean(state?.handRaised);toolbar.classList.toggle('paused',paused);$('#pauseLabel').textContent=paused?'Resume':'Pause';$('#shareStateLabel').textContent=paused?'Share paused':'You are sharing';
    $('#audioLabel').textContent=state?.micOn?'Mute':'Unmute';$('#videoLabel').textContent=state?.cameraOn?'Stop Video':'Start Video';const source=$('#shareSourceLabel');if(source)source.textContent=String(state?.sourceName||'Shared content');const audioFlag=$('#shareAudioFlag');if(audioFlag)audioFlag.hidden=!state?.shareAudio;const optimizeFlag=$('#shareOptimizeFlag');if(optimizeFlag)optimizeFlag.hidden=!state?.optimizeVideo;
    const meetingLabel=$('#meetingLabel');if(meetingLabel)meetingLabel.textContent=state?.meetingVisible?'Hide meeting':'Show meeting';
    const record=$('#presenterRecordCommand'),stopRecord=$('#presenterStopRecord');if(record)record.textContent=state?.recording?(state?.recordingPaused?'Resume recording':'Pause recording'):'Record meeting';if(stopRecord)stopRecord.hidden=!state?.recording;
  });
})();
