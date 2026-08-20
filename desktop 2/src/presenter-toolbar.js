const menu=document.getElementById('presenterMoreMenu');
const more=document.querySelector('[data-command="more"]');
let collapseTimer=0;
let stopRecoveryTimer=0;
const EXPANDED_WIDTH=930;
const EXPANDED_HEIGHT=64;
const MENU_HEIGHT=370;
const COLLAPSED_WIDTH=218;
const COLLAPSED_HEIGHT=46;

if(menu&&!menu.querySelector('[data-command="slide-control"]')){
  const button=document.createElement('button');
  button.type='button';
  button.dataset.command='slide-control';
  button.innerHTML='<svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="14" rx="2"/><path d="m9 9-3 3 3 3M15 9l3 3-3 3M8 21h8"/></svg>Slide Control';
  const stop=menu.querySelector('[data-command="stop"]');
  menu.insertBefore(button,stop||null);
}

const scheduleCollapse=()=>{
  clearTimeout(collapseTimer);
  collapseTimer=setTimeout(()=>{
    menu.hidden=true;
    document.body.classList.add('collapsed');
    window.presenterBridge.resize?.(COLLAPSED_WIDTH,COLLAPSED_HEIGHT);
  },2200);
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
