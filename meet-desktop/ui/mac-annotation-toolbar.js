(()=>{
  'use strict';
  const bridge=window.dominionDesktop?.macShare||null;
  const buttons=[...document.querySelectorAll('[data-command]')];
  const modeCommands=new Set(['annotate-select','annotate-pen','annotate-highlight','annotate-laser','annotate-erase','annotate-shape-line','annotate-shape-arrow','annotate-shape-rect','annotate-shape-ellipse']);
  const widthCommands=new Set(['annotate-width-thin','annotate-width-medium','annotate-width-thick','annotate-width-heavy']);
  const colorCommands=new Set(['annotate-color-red','annotate-color-blue','annotate-color-green','annotate-color-white']);
  const setExclusive=(set,button)=>{for(const node of buttons)if(set.has(String(node.dataset.command||'')))node.classList.toggle('active',node===button);};
  for(const button of buttons)button.addEventListener('click',async()=>{
    const command=String(button.dataset.command||'');if(!command||!bridge?.command)return;
    button.classList.add('pending');
    try{
      const result=await bridge.command(command);
      if(result?.ok===false)throw new Error(result?.error||'annotation_command_failed');
      if(modeCommands.has(command))setExclusive(modeCommands,button);
      if(widthCommands.has(command))setExclusive(widthCommands,button);
      if(colorCommands.has(command))setExclusive(colorCommands,button);
    }catch(error){
      console.error('[DominionStar Meet] Annotation command failed.',command,error);
      button.classList.add('error');setTimeout(()=>button.classList.remove('error'),900);
    }finally{button.classList.remove('pending');}
  });
  document.addEventListener('keydown',event=>{if(event.key==='Escape'){event.preventDefault();void bridge?.command?.('annotate-close');}});
  window.DominionMacAnnotationPalette=Object.freeze({version:'2.0.46-native-canvas-palette',commands:buttons.map(button=>button.dataset.command)});
})();