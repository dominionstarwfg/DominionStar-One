(()=>{
  const bridge=window.dominionDesktop?.presenter;
  const $=selector=>document.querySelector(selector);
  const toolbar=$('#toolbar'),more=$('#moreMenu');
  document.querySelectorAll('[data-command]').forEach(button=>button.addEventListener('click',()=>void bridge?.command?.(button.dataset.command)));
  $('#moreButton').addEventListener('click',()=>{more.hidden=!more.hidden;});
  bridge?.onState?.(state=>{
    const paused=Boolean(state?.paused);toolbar.classList.toggle('paused',paused);$('#pauseLabel').textContent=paused?'Resume':'Pause';$('#shareStateLabel').textContent=paused?'Share paused':'You are sharing';
    $('#audioLabel').textContent=state?.micOn?'Mute':'Unmute';$('#videoLabel').textContent=state?.cameraOn?'Stop Video':'Start Video';
  });
})();
