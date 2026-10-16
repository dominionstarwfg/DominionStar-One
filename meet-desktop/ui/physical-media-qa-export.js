/* Optional, read-only physical Mac media diagnostic export.
   Cmd+Option+Shift+D while a real meeting is open. No fixture mode,
   remote debugger, network endpoint, credentials or layout mutation at rest. */
(()=>{
  'use strict';
  if(window.DominionPhysicalMediaQA||!window.dominionDesktop?.isDesktop)return;
  let busy=false,dialog=null,downloadUrl='';
  const meetingOpen=()=>{
    const overlay=document.getElementById('meetingOverlay');
    return Boolean(overlay&&!overlay.hidden);
  };
  const safeReport=data=>{
    // The WebRTC probe produces a deliberately de-identified summary.
    // Whitelist its non-sensitive fields rather than exporting raw app state.
    const keys=['durationMs','at','surface','running','networkOnline',
      'peerCount','connectionStates','screenSendersWithFrameProgress',
      'screenReceiversWithDecodedFrameProgress','remoteSharePlayback',
      'remoteCamera','remoteAudioPlayback','peerLanes','limitation'];
    const output={};
    for(const key of keys)if(Object.hasOwn(data||{},key))output[key]=data[key];
    return output;
  };
  const panel=()=>{
    if(dialog)return dialog;
    dialog=document.createElement('section');
    dialog.id='dominion-physical-media-qa';
    dialog.setAttribute('role','status');
    dialog.setAttribute('aria-live','polite');
    dialog.style.cssText='position:fixed;right:20px;bottom:112px;z-index:2147483500;max-width:345px;padding:15px;border:1px solid #53627a;border-radius:12px;background:#101c2e;color:#fff;box-shadow:0 12px 35px #0009;font:13px/1.4 system-ui,sans-serif';
    const heading=document.createElement('strong');
    heading.textContent='DominionStar Meet · Physical media QA';
    const message=document.createElement('p');
    message.setAttribute('data-qa-message','');
    message.style.cssText='margin:9px 0 12px;white-space:pre-wrap';
    const actions=document.createElement('div');
    actions.style.cssText='display:flex;gap:8px;align-items:center';
    const link=document.createElement('a');
    link.textContent='Save JSON report';
    link.setAttribute('data-qa-save','');
    link.hidden=true;
    link.style.cssText='padding:8px 10px;border-radius:8px;background:#245bce;color:#fff;text-decoration:none';
    const close=document.createElement('button');
    close.textContent='Close';
    close.type='button';
    close.style.cssText='padding:8px 10px;border-radius:8px;background:#202c40;color:#fff;border:1px solid #53627a';
    close.onclick=()=>{dialog.remove();dialog=null;if(downloadUrl){URL.revokeObjectURL(downloadUrl);downloadUrl='';}};
    actions.append(link,close);
    dialog.append(heading,message,actions);
    document.body.append(dialog);
    return dialog;
  };
  const status=(text)=>{
    const message=panel().querySelector('[data-qa-message]');
    if(message)message.textContent=text;
  };
  async function collect(){
    if(busy)return null;
    if(!meetingOpen()){status('Open and join a meeting first. No report collected.');return null;}
    if(typeof window.DominionWebRTCController?.diagnosticWindow!=='function'){
      status('This build has no active WebRTC diagnostics. Install a verified instrumented test build before proceeding.');
      return null;
    }
    busy=true;
    if(downloadUrl){URL.revokeObjectURL(downloadUrl);downloadUrl='';}
    const link=panel().querySelector('[data-qa-save]');link.hidden=true;link.removeAttribute('href');
    status('Sampling live screen-share frames for 4.5 seconds…');
    try{
      const data=safeReport(await window.DominionWebRTCController.diagnosticWindow(4500));
      if(!meetingOpen()||data.running!==true)throw new Error('Meeting is no longer active.');
      const role=window.DominionShareController?.snapshot?.()?.active?'sender':'receiver';
      const filename='dominionstar-meet-'+role+'-'+new Date().toISOString().replace(/[:.]/g,'-')+'.json';
      const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'});
      downloadUrl=URL.createObjectURL(blob);
      link.href=downloadUrl;
      link.download=filename;
      link.hidden=false;
      status('Sample ready. Select “Save JSON report”, then repeat on the other Mac while sharing the same moving screen.');
      return {ok:true,role,filename};
    }catch(error){
      status('Unable to collect live media data: '+String(error?.message||'diagnostic unavailable'));
      return {ok:false};
    }finally{busy=false;}
  }
  const onKey=e=>{
    if(!e.metaKey||!e.altKey||!e.shiftKey||e.ctrlKey||e.code!=='KeyD'||e.repeat)return;
    if(e.target?.closest?.('input,textarea,[contenteditable="true"]'))return;
    e.preventDefault();
    void collect();
  };
  document.addEventListener('keydown',onKey);
  window.DominionPhysicalMediaQA=Object.freeze({collect});
})();
