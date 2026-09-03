(()=>{
  'use strict';
  if(window.DominionPresenterCommandParity)return;

  const STYLE_ID='ds-presenter-command-parity-2-0-27';
  const TOOLBAR_PREFIX='toolbar:';
  let installTimer=0;
  let styleTimer=0;

  const normalizeCommand=raw=>{
    const command=String(raw?.command||raw||'').trim();
    return command.startsWith(TOOLBAR_PREFIX)?command.slice(TOOLBAR_PREFIX.length):command;
  };

  function ensureFloatingSharePanels(){
    if(document.getElementById(STYLE_ID))return true;
    const shareStyle=[...document.querySelectorAll('link[rel="stylesheet"]')].some(link=>/\/share\.css(?:$|[?#])/.test(String(link.href||'')));
    if(!shareStyle&&!window.DominionShareIntegration)return false;
    const style=document.createElement('style');
    style.id=STYLE_ID;
    style.textContent=`
      /* 2.0.27: Chat and Participants stay as floating meeting panels while
         sharing. The older companion rules must never turn either command into
         a full-window meeting takeover. */
      body[data-ds-share-companion="chat"] #meetingOverlay.meeting-overlay.share-active .meeting-body,
      body[data-ds-share-companion="participants"] #meetingOverlay.meeting-overlay.share-active .meeting-body{
        display:block!important;
        position:relative!important;
        width:100%!important;
        height:100%!important;
      }
      body[data-ds-share-companion="chat"] #meetingOverlay.meeting-overlay.share-active .stage,
      body[data-ds-share-companion="participants"] #meetingOverlay.meeting-overlay.share-active .stage{
        display:grid!important;
        position:absolute!important;
        inset:0!important;
        width:100%!important;
        height:100%!important;
      }
      body[data-ds-share-companion="chat"] #meetingOverlay.meeting-overlay.share-active #meetingChatPanel,
      body[data-ds-share-companion="participants"] #meetingOverlay.meeting-overlay.share-active .room-side{
        width:min(410px,calc(100% - 24px))!important;
        height:min(590px,calc(100% - 24px))!important;
        max-width:calc(100% - 24px)!important;
        max-height:calc(100% - 24px)!important;
        border-radius:12px!important;
        box-shadow:0 18px 48px rgba(0,0,0,.45)!important;
      }
    `;
    document.head.append(style);
    return true;
  }

  function wrapPresenterDispatcher(){
    const current=window.__DominionPresenterDispatch;
    if(typeof current!=='function')return false;
    if(current.__dsPresenterCommandParity227===true)return true;
    const original=current;
    const wrapped=async raw=>{
      const command=normalizeCommand(raw);
      const payload=raw&&typeof raw==='object'?{...raw,command}:command;
      return original(payload);
    };
    Object.defineProperty(wrapped,'__dsPresenterCommandParity227',{value:true});
    Object.defineProperty(wrapped,'__dsPresenterOriginal',{value:original});
    window.__DominionPresenterDispatch=wrapped;
    return true;
  }

  function install(){
    const dispatcherReady=wrapPresenterDispatcher();
    const styleReady=ensureFloatingSharePanels();
    if(dispatcherReady&&installTimer){clearInterval(installTimer);installTimer=0;}
    if(styleReady&&styleTimer){clearInterval(styleTimer);styleTimer=0;}
    return {dispatcherReady,styleReady};
  }

  installTimer=window.setInterval(()=>{wrapPresenterDispatcher();},40);
  styleTimer=window.setInterval(()=>{ensureFloatingSharePanels();},80);
  window.setTimeout(()=>{if(installTimer){clearInterval(installTimer);installTimer=0;}if(styleTimer){clearInterval(styleTimer);styleTimer=0;}install();},12000);

  window.addEventListener('dominion:meeting-ui-ready',install);
  window.addEventListener('dominion:meeting-ended',()=>{
    if(document.body?.dataset?.dsShareCompanion)delete document.body.dataset.dsShareCompanion;
  });

  window.DominionPresenterCommandParity=Object.freeze({
    version:'2.0.27',
    normalizeCommand,
    install,
    sync:install
  });
  install();
})();
