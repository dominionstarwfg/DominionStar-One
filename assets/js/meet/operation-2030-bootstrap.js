(()=>{
  'use strict';
  if(window.DominionOperation2030Bootstrap)return;

  const loaded=new Map();
  const load=(src,marker,{after=null}={})=>{
    if(loaded.has(marker))return loaded.get(marker);
    const existing=document.querySelector(`script[${marker}]`);
    if(existing){const promise=existing.dataset.dsLoaded==='1'?Promise.resolve(existing):new Promise(resolve=>{existing.addEventListener('load',()=>resolve(existing),{once:true});existing.addEventListener('error',()=>resolve(existing),{once:true});setTimeout(()=>resolve(existing),4000);});loaded.set(marker,promise);return promise;}
    const start=after?Promise.resolve(after).catch(()=>null):Promise.resolve();
    const promise=start.then(()=>new Promise(resolve=>{const script=document.createElement('script');script.src=src;script.setAttribute(marker,'1');script.async=false;script.addEventListener('load',()=>{script.dataset.dsLoaded='1';resolve(script);},{once:true});script.addEventListener('error',()=>resolve(script),{once:true});document.head.append(script);}));
    loaded.set(marker,promise);return promise;
  };

  const idle=new Promise(resolve=>{const done=()=>resolve(true);if(typeof requestIdleCallback==='function')requestIdleCallback(done,{timeout:1200});else setTimeout(done,700);});

  // Core only: these modules affect ordinary meeting controls, participant
  // layout, and the visible share toolbar. Position/orientation of #filmstrip
  // belongs exclusively to dock-layout-v2 (loaded by meet/index.html). The
  // preload-owned layer may enhance resizing/quality but must never install a
  // second drag or orientation authority.
  const core=[
    load('/assets/js/meet/device-preference-locality.js?v=2-clean-core','data-ds-device-preference-locality'),
    load('/assets/js/meet/receiver-side-layout-parity.js?v=2-clean-core','data-ds-receiver-side-layout'),
    load('/assets/js/meet/host-cohost-ui-parity.js?v=2-clean-core','data-ds-host-cohost-ui-parity'),
    load('/assets/js/meet/dock-resize-quality.js?v=1-single-layout-authority','data-ds-dock-resize-quality'),
    load('/assets/js/meet/native-dock-quality.js?v=2-clean-core','data-ds-native-dock-quality'),
    load('/assets/js/meet/share-optimization-parity.js?v=2-clean-core','data-ds-share-optimization-parity')
  ];
  const shareUi=load('/assets/js/meet/share-ui-2030.js?v=3-clean-core','data-ds-share-ui-2030',{after:core[5]});
  const quickDevices=load('/assets/js/meet/quick-device-menu-parity.js?v=3-clean-core','data-ds-quick-device-menu-parity',{after:idle});

  let mediaEnhancements=null;
  const loadMediaEnhancements=()=>{
    if(mediaEnhancements)return mediaEnhancements;
    const videoIntelligence=load('/assets/js/meet/video-intelligence-compositor.js?v=3-on-demand','data-ds-video-intelligence-compositor',{after:idle});
    const background=load('/assets/js/meet/background-effects-2030.js?v=3-on-demand','data-ds-background-effects-2030',{after:videoIntelligence});
    const quality=load('/assets/js/meet/video-quality-parity.js?v=2-on-demand','data-ds-video-quality-parity',{after:background});
    mediaEnhancements=Promise.all([videoIntelligence,background,quality]);return mediaEnhancements;
  };

  let presentationTools=null;
  const loadPresentationTools=()=>{
    if(presentationTools)return presentationTools;
    const annotation=load('/assets/js/meet/share-annotation.js?v=3-on-demand','data-ds-share-annotation');
    const vertical=load('/assets/js/meet/annotation-vertical-ui.js?v=2-on-demand','data-ds-annotation-vertical-ui',{after:annotation});
    const presenter=load('/assets/js/meet/presenter-command-web-parity.js?v=3-on-demand','data-ds-presenter-command-parity',{after:annotation});
    const slides=load('/assets/js/meet/slide-control-parity.js?v=2-on-demand','data-ds-slide-control-parity',{after:presenter});
    const spotlight=load('/assets/js/meet/share-spotlight.js?v=3-on-demand','data-ds-share-spotlight');
    const handoff=load('/assets/js/meet/presentation-handoff.js?v=3-on-demand','data-ds-presentation-handoff');
    const arbitration=load('/assets/js/meet/share-arbitration.js?v=3-on-demand','data-ds-share-arbitration');
    const arbitrationUi=load('/assets/js/meet/share-arbitration-ui.js?v=3-on-demand','data-ds-share-arbitration-ui',{after:arbitration});
    const watchdog=load('/assets/js/meet/remote-share-watchdog.js?v=3-on-demand','data-ds-remote-share-watchdog');
    presentationTools=Promise.all([annotation,vertical,presenter,slides,spotlight,handoff,arbitration,arbitrationUi,watchdog]);return presentationTools;
  };

  let recording=null;
  const loadRecording=()=>recording||(recording=load('/assets/js/meet/local-recording.js?v=2-on-demand','data-ds-local-recording'));
  let reactions=null;
  const loadReactions=()=>reactions||(reactions=load('/assets/js/meet/reaction-polish.js?v=2-on-demand','data-ds-reaction-polish'));

  const savedEffectNeedsProcessing=()=>{
    try{
      for(let i=0;i<localStorage.length;i+=1){const key=localStorage.key(i);if(!key?.startsWith('ds_meet_preferences:'))continue;const prefs=JSON.parse(localStorage.getItem(key)||'{}');if(['blur','portrait'].includes(String(prefs?.background||''))||Number(prefs?.brightness??100)!==100||Number(prefs?.touchAppearance??0)>0)return true;}
    }catch{}
    return false;
  };

  if(savedEffectNeedsProcessing())void loadMediaEnhancements();
  document.addEventListener('pointerdown',event=>{
    if(event.target.closest?.('#preSettings,#camMenuBtn,#backgroundSelect,#brightnessRange,#touchAppearanceRange'))void loadMediaEnhancements();
    if(event.target.closest?.('#recordBtn,[data-record-action]'))void loadRecording();
    if(event.target.closest?.('#reactionBtn,#shareReactionBtn'))void loadReactions();
    if(event.target.closest?.('#shareBtn,#shareScreenAction,#shareTopBtn,#annotateBtn,#newShareBtn'))void loadPresentationTools();
  },true);
  window.addEventListener('dominionstar:share-picker-opened',()=>void loadPresentationTools());

  const ready=Promise.all([...core,shareUi,quickDevices]);
  window.DominionOperation2030Bootstrap=Object.freeze({
    version:'3.1.0-single-dock-layout-authority',ready,idle,
    coreModules:Object.freeze(['device-preference-locality','receiver-side-layout-parity','host-cohost-ui-parity','dock-resize-quality','native-dock-quality','share-optimization-parity','share-ui-2030','quick-device-menu-parity']),
    loadMediaEnhancements,loadPresentationTools,loadRecording,loadReactions
  });
})();