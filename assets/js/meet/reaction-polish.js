(() => {
  'use strict';
  if (window.DominionReactionPolish) return;

  const reactionLayer = document.getElementById('reactionLayer');
  if (!reactionLayer) return;

  if (!document.querySelector('style[data-ds-reaction-polish]')) {
    const style = document.createElement('style');
    style.dataset.dsReactionPolish = '1';
    style.textContent = `
      #reactionLayer.reaction-layer{pointer-events:none!important;background:transparent!important;box-shadow:none!important;border:0!important;}
      #reactionLayer .floating-reaction{background:transparent!important;border:0!important;box-shadow:none!important;backdrop-filter:none!important;-webkit-backdrop-filter:none!important;padding:0!important;min-width:0!important;overflow:visible!important;}
      #reactionLayer .floating-reaction-symbol{display:block!important;font-size:42px!important;line-height:1!important;background:transparent!important;border:0!important;box-shadow:none!important;filter:drop-shadow(0 8px 14px rgba(0,0,0,.22));}
      #reactionLayer .floating-reaction-name{display:none!important;}
      #reactionLayer .reaction-burst-particle{background:transparent!important;border:0!important;box-shadow:none!important;filter:drop-shadow(0 8px 14px rgba(0,0,0,.18));}
    `;
    document.head.append(style);
  }

  window.DominionReactionPolish = Object.freeze({
    version:'1.0.0',
    snapshot:()=>({reactionLayer:true})
  });
})();
