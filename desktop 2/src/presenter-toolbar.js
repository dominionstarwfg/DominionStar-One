const menu=document.getElementById('presenterMoreMenu');
const more=document.querySelector('[data-command="more"]');
let collapseTimer=0;
const EXPANDED_WIDTH=780;
const EXPANDED_HEIGHT=64;
const MENU_HEIGHT=286;
const COLLAPSED_WIDTH=218;
const COLLAPSED_HEIGHT=46;
const scheduleCollapse=()=>{
  clearTimeout(collapseTimer);
  collapseTimer=setTimeout(()=>{
    menu.hidden=true;
    document.body.classList.add('collapsed');
    window.presenterBridge.resize?.(COLLAPSED_WIDTH,COLLAPSED_HEIGHT);
  },2200);
};
const expand=()=>{
  clearTimeout(collapseTimer);
  document.body.classList.remove('collapsed');
  window.presenterBridge.resize?.(EXPANDED_WIDTH,menu.hidden?EXPANDED_HEIGHT:MENU_HEIGHT);
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
