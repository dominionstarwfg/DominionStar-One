const menu=document.getElementById('presenterMoreMenu');
const more=document.querySelector('[data-command="more"]');
let collapseTimer=0;
const expandedHeight=menu?330:76;
const scheduleCollapse=()=>{
  clearTimeout(collapseTimer);
  collapseTimer=setTimeout(()=>{
    menu.hidden=true;
    document.body.classList.add('collapsed');
    window.presenterBridge.resize?.(270,48);
  },2200);
};
const expand=()=>{
  clearTimeout(collapseTimer);
  document.body.classList.remove('collapsed');
  window.presenterBridge.resize?.(930,menu.hidden?76:expandedHeight);
};
document.addEventListener('pointerenter',expand);
document.addEventListener('pointermove',scheduleCollapse);
document.addEventListener('pointerleave',scheduleCollapse);
document.querySelectorAll('[data-command]').forEach(button=>button.addEventListener('click',event=>{
  const command=button.dataset.command;
  if(command==='more'){
    event.stopPropagation();
    menu.hidden=!menu.hidden;
    window.presenterBridge.resize?.(930,menu.hidden?76:expandedHeight);
    return;
  }
  menu.hidden=true;
  window.presenterBridge.resize?.(930,76);
  window.presenterBridge.command(command);
  scheduleCollapse();
}));
document.addEventListener('click',event=>{if(!menu.hidden&&!menu.contains(event.target)&&event.target!==more){menu.hidden=true;window.presenterBridge.resize?.(930,76);}});
scheduleCollapse();
