(()=>{
  'use strict';
  if(window.DominionRuntimeBootstrap)return;

  const absolute=value=>new URL(value,location.href).href;
  const stylePromises=new Map();
  const scriptPromises=new Map();

  function loadStyle(href,key){
    const url=absolute(href);
    const existing=[...document.querySelectorAll('link[rel="stylesheet"]')].find(node=>node.href===url);
    if(existing){if(key)existing.dataset[key]='1';return Promise.resolve(existing);}
    if(stylePromises.has(url))return stylePromises.get(url);
    const promise=new Promise((resolve,reject)=>{
      const link=document.createElement('link');
      link.rel='stylesheet';link.href=href;if(key)link.dataset[key]='1';
      link.addEventListener('load',()=>resolve(link),{once:true});
      link.addEventListener('error',()=>reject(new Error(`style_load_failed:${href}`)),{once:true});
      document.head.append(link);
    });
    stylePromises.set(url,promise);return promise;
  }

  function loadScript(src,key){
    const url=absolute(src);
    const existing=[...document.scripts].find(node=>node.src===url);
    if(existing){if(key)existing.dataset[key]='1';return Promise.resolve(existing);}
    if(scriptPromises.has(url))return scriptPromises.get(url);
    const promise=new Promise((resolve,reject)=>{
      const script=document.createElement('script');
      script.src=src;if(key)script.dataset[key]='1';
      script.addEventListener('load',()=>resolve(script),{once:true});
      script.addEventListener('error',()=>reject(new Error(`script_load_failed:${src}`)),{once:true});
      document.head.append(script);
    });
    scriptPromises.set(url,promise);return promise;
  }

  const styles=[
    ['./zoom-production-polish.css','dsZoomProductionPolish'],
    ['./zoom-physical-acceptance.css','dsZoomPhysicalAcceptance'],
    ['./physical-mac-repair.css','dsPhysicalMacRepair'],
    ['./zoom-adaptive-parity.css','dsZoomAdaptiveParity'],
    ['./approved-reference-parity.css','dsApprovedReferenceParity'],
    ['./runtime-stability.css','dsRuntimeStability'],
    ['./runtime-layout-fix.css','dsRuntimeLayoutFix'],
    ['./runtime-motion.css','dsRuntimeMotion'],
    ['./zoom-screenshot-reference-2.0.41.css','dsZoomScreenshotReference2041'],
    ['./executive-home-2.0.41.css','dsExecutiveHome2041'],
    ['./executive-prejoin-2.0.41.css','dsExecutivePrejoin2041']
  ];

  const ready=(async()=>{
    await Promise.all(styles.map(([href,key])=>loadStyle(href,key)));
    await loadScript('./runtime-stability.js','dsRuntimeStability');

    // Independent compatibility surfaces load after the canonical runtime so
    // none of them can become the first desktop authority.
    await Promise.all([
      loadScript('./zoom-production-polish.js','dsZoomProductionPolish'),
      loadScript('./zoom-physical-acceptance.js','dsZoomPhysicalAcceptance'),
      loadScript('./zoom-reaction-parity.js','dsZoomReactionParity'),
      loadScript('./zoom-contract-bridge.js','dsZoomContractBridge'),
      loadScript('./presenter-command-parity-2.0.27.js','dsPresenterCommandParity227')
    ]);

    // Preserve the historical dependency order for the remaining reference
    // compatibility chain, but keep ownership in RuntimeStability.
    await loadScript('./physical-mac-repair.js','dsPhysicalMacRepair');
    await loadScript('./zoom-adaptive-parity.js','dsZoomAdaptiveParity');
    await loadScript('./approved-reference-parity.js','dsApprovedReferenceParity');
    await loadScript('./zoom-screenshot-reference-2.0.41.js','dsZoomScreenshotReference2041');
    await loadScript('./zoom-participants-reference-2.0.41.js','dsZoomParticipantsReference2041');
    await loadScript('./active-share-home-parity-2.0.41.js','dsActiveShareHome2041');

    window.dispatchEvent(new CustomEvent('dominion:runtime-bootstrap-ready'));
    return true;
  })().catch(error=>{
    console.error('[DominionStar Meet] Runtime bootstrap failed.',error);
    window.dispatchEvent(new CustomEvent('dominion:runtime-bootstrap-error',{detail:{message:String(error?.message||error)}}));
    return false;
  });

  window.DominionRuntimeBootstrap=Object.freeze({version:'2.0.53-clean-bootstrap',ready,loadStyle,loadScript});
})();
