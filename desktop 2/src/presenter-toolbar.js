const menu=document.getElementById('presenterMoreMenu');
const more=document.querySelector('[data-command="more"]');
let collapseTimer=0;
let stopRecoveryTimer=0;
let sharePaused=false;
const EXPANDED_WIDTH=610;
const EXPANDED_HEIGHT=66;
const MENU_HEIGHT=360;
const COLLAPSED_WIDTH=230;
const COLLAPSED_HEIGHT=50;

const slideControlMarkup='<svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="14" rx="2"/><path d="m9 9-3 3 3 3M15 9l3 3-3 3M8 21h8"/></svg>';
if(menu&&!menu.querySelector('[data-command="slide-control"]')){
  const button=document.createElement('button');
  button.type='button';
  button.dataset.command='slide-control';
  button.innerHTML=`${slideControlMarkup}Slide Control`;
  menu.append(button);
}

const pauseButtons=()=>[...document.querySelectorAll('[data-command="pause"]')];
const renderPauseState=()=>{
  pauseButtons().forEach(button=>{
    button.classList.toggle('is-paused',sharePaused);
    button.setAttribute('aria-label',sharePaused?'Resume Share':'Pause Share');
    const label=button.querySelector('small');
    if(label)label.textContent=sharePaused?'Resume':'Pause';
    const svg=button.querySelector('svg');
    if(svg)svg.innerHTML=sharePaused?'<path d="m9 6 9 6-9 6z"/>':'<path d="M8 6v12M16 6v12"/>';
  });
};
const resetPauseState=()=>{sharePaused=false;renderPauseState();};
renderPauseState();

const scheduleCollapse=()=>{
  clearTimeout(collapseTimer);
  collapseTimer=setTimeout(()=>{
    menu.hidden=true;
    document.body.classList.add('collapsed');
    window.presenterBridge.resize?.(COLLAPSED_WIDTH,COLLAPSED_HEIGHT);
  },2400);
};
const expand=()=>{
  if(document.body.classList.contains('stopping'))return;
  clearTimeout(collapseTimer);
  document.body.classList.remove('collapsed');
  window.presenterBridge.resize?.(EXPANDED_WIDTH,menu.hidden?EXPANDED_HEIGHT:MENU_HEIGHT);
};
const beginStopTransition=()=>{
  clearTimeout(collapseTimer);
  clearTimeout(stopRecoveryTimer);
  resetPauseState();
  menu.hidden=true;
  document.body.classList.add('stopping','collapsed');
  document.body.style.opacity='0';
  document.body.style.pointerEvents='none';
  window.presenterBridge.resize?.(COLLAPSED_WIDTH,COLLAPSED_HEIGHT);
  window.presenterBridge.command('stop');
  stopRecoveryTimer=setTimeout(()=>{
    document.body.classList.remove('stopping');
    document.body.style.opacity='';
    document.body.style.pointerEvents='';
    expand();
    scheduleCollapse();
  },2200);
};

document.addEventListener('pointerenter',expand);
document.addEventListener('pointermove',scheduleCollapse);
document.addEventListener('pointerleave',scheduleCollapse);
document.querySelectorAll('[data-command]').forEach(button=>button.addEventListener('click',event=>{
  const command=button.dataset.command;
  if(command==='more'){
    event.stopPropagation();
    menu.hidden=!menu.hidden;
    window.presenterBridge.resize?.(EXPANDED_WIDTH,menu.hidden?EXPANDED_HEIGHT:MENU_HEIGHT);
    return;
  }
  if(command==='stop'){
    event.preventDefault();
    event.stopPropagation();
    beginStopTransition();
    return;
  }
  if(command==='pause'){
    sharePaused=!sharePaused;
    renderPauseState();
  }else if(command==='new-share'){
    resetPauseState();
  }
  menu.hidden=true;
  window.presenterBridge.resize?.(EXPANDED_WIDTH,EXPANDED_HEIGHT);
  window.presenterBridge.command(command);
  scheduleCollapse();
}));
document.addEventListener('click',event=>{
  if(!menu.hidden&&!menu.contains(event.target)&&event.target!==more){
    menu.hidden=true;
    window.presenterBridge.resize?.(EXPANDED_WIDTH,EXPANDED_HEIGHT);
  }
});
window.presenterBridge.resize?.(EXPANDED_WIDTH,EXPANDED_HEIGHT);
scheduleCollapse();
