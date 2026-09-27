(()=>{
  'use strict';
  const bridge=window.dominionDesktop?.macShare||null;
  const buttons=[...document.querySelectorAll('[data-command]')];
  const modeCommands=new Set(['annotate-pen','annotate-highlight','annotate-laser','annotate-erase']);
  const colorCommands=new Set(['annotate-color-red','annotate-color-blue','annotate-color-green','annotate-color-white']);
  const setExclusive=(set,button)=>{for(const node of buttons)if(set.has(String(node.dataset.command||'')))node.classList.toggle('active',node===button);};
  for(const button of buttons)button.addEventListener('click',async()=>{
    const command=String(button.dataset.command||'');if(!command||!bridge?.command)return;
    button.classList.add('pending');
    try{
      const result=await bridge.command(command);
      if(result?.ok===false)throw new Error(result?.error||'annotation_command_failed');
      if(modeCommands.has(command))setExclusive(modeCommands,button);
      if(colorCommands.has(command))setExclusive(colorCommands,button);
    }catch(error){
      console.error('[DominionStar Meet] Annotation command failed.',command,error);
      button.classList.add('error');setTimeout(()=>button.classList.remove('error'),700);
    }finally{button.classList.remove('pending');}
  });
  window.DominionMacAnnotationPalette=Object.freeze({version:'2.0.44-left-vertical',commands:buttons.map(button=>button.dataset.command)});
})();