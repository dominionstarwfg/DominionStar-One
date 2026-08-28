(()=>{
  const bridge=window.dominionDesktop?.presenter;
  const $=selector=>document.querySelector(selector),toolbar=$('#toolbar'),more=$('#moreMenu');let reactions=null;
  function closeReactions(){reactions?.remove();reactions=null;}
  function openReactions(anchor){closeReactions();reactions=document.createElement('div');reactions.className='presenter-reaction-menu';for(const emoji of ['👍','👏','❤️','😂','🎉','🤔']){const button=document.createElement('button');button.type='button';button.textContent=emoji;button.onclick=()=>{closeReactions();more.hidden=true;void bridge?.command?.(`reaction:${emoji}`);};reactions.append(button);}anchor.parentElement.append(reactions);}
  document.querySelectorAll('[data-command]').forEach(button=>button.addEventListener('click',()=>{const command=button.dataset.command;if(command==='reactions'){openReactions(button);return;}closeReactions();more.hidden=true;void bridge?.command?.(command);}));
  $('#moreButton').addEventListener('click',()=>{closeReactions();more.hidden=!more.hidden;});
  document.addEventListener('pointerdown',event=>{if(!event.target.closest('.more-wrap')){more.hidden=true;closeReactions();}},true);
  bridge?.onState?.(state=>{
    const paused=Boolean(state?.paused);toolbar.classList.toggle('paused',paused);$('#pauseLabel').textContent=paused?'Resume':'Pause';$('#shareStateLabel').textContent=paused?'Share paused':'You are sharing';
    $('#audioLabel').textContent=state?.micOn?'Mute':'Unmute';$('#videoLabel').textContent=state?.cameraOn?'Stop Video':'Start Video';
    const meetingLabel=$('#meetingLabel');if(meetingLabel)meetingLabel.textContent=state?.meetingVisible?'Hide meeting':'Show meeting';
  });
})();
