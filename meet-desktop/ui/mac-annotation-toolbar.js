(()=>{
  'use strict';
  const bridge=window.dominionDesktop?.macShare||null;
  const buttons=[...document.querySelectorAll('[data-command]')];
  const modeCommands=new Set(['annotate-select','annotate-pen','annotate-highlight','annotate-laser','annotate-erase','annotate-shape-line','annotate-shape-arrow','annotate-shape-rect','annotate-shape-ellipse']);
  const widthCommands=new Set(['annotate-width-thin','annotate-width-medium','annotate-width-thick','annotate-width-heavy']);
  const colorCommands=new Set(['annotate-color-red','annotate-color-blue','annotate-color-green','annotate-color-white']);
  const panels=[...document.querySelectorAll('[data-flyout-panel]')];
  const setExclusive=(set,button)=>{for(const node of buttons)if(set.has(String(node.dataset.command||'')))node.classList.toggle('active',node===button);};
  const syncFlyoutWindow=()=>{try{void bridge?.setAnnotationFlyout?.(panels.some(panel=>!panel.hidden));}catch{}};
  const closeFlyouts=except=>{for(const panel of panels)if(panel!==except)panel.hidden=true;syncFlyoutWindow();};
  const toggleFlyout=name=>{
    const panel=document.querySelector('[data-flyout-panel="'+CSS.escape(String(name||''))+'"]');if(!panel)return;
    const next=panel.hidden;closeFlyouts(panel);panel.hidden=!next;syncFlyoutWindow();
  };
  for(const trigger of document.querySelectorAll('[data-flyout]'))trigger.addEventListener('click',event=>{event.stopPropagation();toggleFlyout(trigger.dataset.flyout);});
  for(const closer of document.querySelectorAll('[data-close-flyout]'))closer.addEventListener('click',event=>{event.stopPropagation();closeFlyouts();});
  for(const button of buttons)button.addEventListener('click',async()=>{
    const command=String(button.dataset.command||'');if(!command||!bridge?.command)return;
    button.classList.add('pending');
    try{
      const result=await bridge.command(command);
      if(result?.ok===false)throw new Error(result?.error||'annotation_command_failed');
      if(modeCommands.has(command))setExclusive(modeCommands,button);
      if(widthCommands.has(command))setExclusive(widthCommands,button);
      if(colorCommands.has(command)){setExclusive(colorCommands,button);const dot=document.querySelector('.color-dot');if(dot){const map={'annotate-color-red':'#ff3b30','annotate-color-blue':'#2d8cff','annotate-color-green':'#28c76f','annotate-color-white':'#ffffff'};dot.style.background=map[command]||'#ff3b30';}}
      if(modeCommands.has(command)||command==='annotate-undo'||command==='annotate-clear')closeFlyouts();
    }catch(error){
      console.error('[DominionStar Meet] Annotation command failed.',command,error);
      button.classList.add('error');setTimeout(()=>button.classList.remove('error'),900);
    }finally{button.classList.remove('pending');}
  });
  document.addEventListener('pointerdown',event=>{if(!event.target.closest('.annotation-flyout,[data-flyout]'))closeFlyouts();},true);
  document.addEventListener('keydown',event=>{if(event.key==='Escape'){if(panels.some(panel=>!panel.hidden)){closeFlyouts();return;}event.preventDefault();void bridge?.command?.('annotate-close');}});
  syncFlyoutWindow();
  window.DominionMacAnnotationPalette=Object.freeze({version:'2.0.55-zoom-vertical-rail',commands:buttons.map(button=>button.dataset.command),closeFlyouts});
})();