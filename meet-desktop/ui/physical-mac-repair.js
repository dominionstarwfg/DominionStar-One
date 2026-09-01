(()=>{
  'use strict';
  if(window.DominionPhysicalMacRepair)return;

  const desktop=window.dominionDesktop||{};
  const q=s=>document.querySelector(s),qa=s=>[...document.querySelectorAll(s)];
  const digits=v=>String(v||'').replace(/\D/g,'');
  const inMeeting=()=>Boolean(q('#meetingOverlay')&&!q('#meetingOverlay').hidden);
  let shareBusy=false;
  let personalBusy=false;
  let recoveryDialog=null;
  let expectedPersonalCode='';
  let shareStateUnsub=null;

  function installReactionTrayGuard(){
    if(document.querySelector('style[data-ds-legacy-reaction-hand-guard]'))return;
    const style=document.createElement('style');
    style.dataset.dsLegacyReactionHandGuard='1';
    style.textContent='.ds-reaction-tray>.ds-reaction-divider,.ds-reaction-tray>.ds-raise-hand{display:none!important}';
    document.head.append(style);
  }

  function hideLegacyShareRecovery(){
    for(const node of qa('.ds-share-permission,.ds-219-share-recovery')){
      if(!node.hidden)node.hidden=true;
    }
  }

  async function screenStatus(){
    try{return String((await desktop.media?.permissions?.())?.screen||'unknown').toLowerCase();}
    catch{return 'unknown';}
  }

  async function detectScreenPermission(){
    // This helper is diagnostic only. It never enumerates desktop sources.
    // Explicit denial is actionable; granted proceeds; not-determined/unknown
    // must be decided by the real native getDisplayMedia request.
    const reported=await screenStatus();
    if(reported==='granted')return {ok:true,status:'granted',restartRequired:false,detectedBy:'tcc-status'};
    if(reported==='denied'||reported==='restricted')return {ok:false,status:reported,restartRequired:false,detectedBy:'tcc-status'};
    return {ok:true,status:reported,nativeDecisionRequired:true,restartRequired:false,detectedBy:'native-decision'};
  }

  function ensureRecoveryDialog(){
    if(recoveryDialog?.isConnected)return recoveryDialog;
    recoveryDialog=document.createElement('section');
    recoveryDialog.className='ds-219-share-recovery';
    recoveryDialog.hidden=true;
    recoveryDialog.setAttribute('role','dialog');
    recoveryDialog.setAttribute('aria-modal','true');
    recoveryDialog.innerHTML=`<div class="ds-219-share-card"><div class="ds-219-share-icon">↥</div><div class="ds-219-share-copy"><p>SCREEN SHARING</p><h3>DominionStar Meet needs Screen Recording access</h3><span data-ds-219-share-message></span></div><div class="ds-219-share-actions"><button type="button" data-ds-219-cancel>Not now</button><button type="button" data-ds-219-reset>Reset permission</button><button type="button" data-ds-219-open>Open System Settings</button><button type="button" class="primary" data-ds-219-recheck>Recheck & Share</button><button type="button" class="primary" data-ds-219-restart hidden>Restart DominionStar Meet</button></div></div>`;
    document.body.append(recoveryDialog);
    recoveryDialog.querySelector('[data-ds-219-cancel]').onclick=()=>{recoveryDialog.hidden=true;};
    recoveryDialog.querySelector('[data-ds-219-open]').onclick=async()=>{await desktop.media?.openPrivacy?.('screen').catch?.(()=>{});};
    recoveryDialog.querySelector('[data-ds-219-restart]').onclick=()=>void desktop.app?.relaunch?.();
    recoveryDialog.querySelector('[data-ds-219-recheck]').onclick=async event=>{
      const button=event.currentTarget;button.disabled=true;
      try{recoveryDialog.hidden=true;await openVerifiedShare();}
      finally{button.disabled=false;}
    };
    recoveryDialog.querySelector('[data-ds-219-reset]').onclick=async event=>{
      const button=event.currentTarget;button.disabled=true;
      try{
        const result=await desktop.app?.resetScreenPermission?.();
        if(result?.ok===false)throw new Error(result.error||'Unable to reset Screen Recording permission.');
        await desktop.media?.openPrivacy?.('screen').catch?.(()=>{});
        const message=recoveryDialog.querySelector('[data-ds-219-share-message]');
        if(message)message.textContent='The Screen Recording entry was reset. Enable DominionStar Meet in System Settings, then return here and choose Recheck & Share.';
      }catch(error){
        const message=recoveryDialog.querySelector('[data-ds-219-share-message]');
        if(message)message.textContent=String(error?.message||error||'Unable to reset Screen Recording permission.');
      }finally{button.disabled=false;}
    };
    return recoveryDialog;
  }

  async function showRecovery(status='unknown',restartRequired=false){
    hideLegacyShareRecovery();
    const dialog=ensureRecoveryDialog();
    let identity={};try{identity=await desktop.app?.privacyIdentity?.()||{};}catch{}
    const message=dialog.querySelector('[data-ds-219-share-message]');
    const restart=dialog.querySelector('[data-ds-219-restart]');
    const unstable=identity?.stableAcrossRebuilds===false;
    if(message){
      if(restartRequired){
        message.textContent='macOS sees a Screen Recording permission record, but this running process still cannot capture. Restart DominionStar Meet once, then Share Screen should proceed without asking again.';
      }else if(unstable){
        message.textContent=`Screen Recording is not available to this installed prototype yet (status: ${status}). Enable DominionStar Meet in Privacy & Security → Screen & System Audio Recording, then return and choose Recheck & Share. Reset permission is only for a stale macOS entry.`;
      }else{
        message.textContent=`Screen Recording is not enabled (status: ${status}). Enable DominionStar Meet in Privacy & Security → Screen & System Audio Recording, then return and choose Recheck & Share.`;
      }
    }
    if(restart)restart.hidden=!restartRequired;
    dialog.hidden=false;
  }

  async function openVerifiedShare(){
    if(shareBusy||!inMeeting())return false;
    shareBusy=true;hideLegacyShareRecovery();
    try{
      const permission=await detectScreenPermission();
      if(!permission.ok){await showRecovery(permission.status,false);return false;}
      const integration=window.DominionShareIntegration;
      if(!integration?.open)throw new Error('Screen-share integration is not ready.');
      return await integration.open();
    }catch(error){
      const status=await screenStatus();
      await showRecovery(status||String(error?.name||'unknown'),status==='granted');
      return false;
    }finally{shareBusy=false;}
  }

  function syncPersonalChoice(){
    const toggle=q('#newMeetingUsePersonal'),passInput=q('#newMeetingPasscode');if(!toggle||!passInput)return;
    const passLabel=passInput.closest('label');
    if(toggle.checked)passLabel?.style.setProperty('display','none','important');
    else passLabel?.style.removeProperty('display');
    toggle.dataset.ds219Authority='1';
  }

  async function startSelectedPersonalMeeting(event){
    const form=event.target;
    if(!(form instanceof HTMLFormElement)||form.id!=='newMeetingForm')return;
    const toggle=q('#newMeetingUsePersonal');if(!toggle?.checked||personalBusy)return;
    event.preventDefault();event.stopPropagation();event.stopImmediatePropagation();
    personalBusy=true;
    const button=q('#startMeetingButton'),error=q('#newMeetingError');if(button)button.disabled=true;if(error)error.hidden=true;
    try{
      const personal=await desktop.meeting?.personalRoom?.();
      if(!personal?.roomCode)throw new Error('Personal Meeting ID is unavailable.');
      const room=await desktop.meeting?.startPersonalRoom?.();
      if(!room?.roomCode)throw new Error('Personal Room did not return a Meeting ID.');
      if(digits(personal.roomCode)!==digits(room.roomCode))throw new Error('Personal Meeting ID changed while starting. The meeting was blocked instead of silently creating a different room.');
      expectedPersonalCode=digits(room.roomCode);
      document.body.dataset.dsExpectedPersonalRoomCode=expectedPersonalCode;
      q('#newMeetingDialog')?.close();
      if(!window.DominionPersonalRoom?.beginHostPrejoin)throw new Error('Personal Room prejoin authority is unavailable.');
      window.DominionPersonalRoom.beginHostPrejoin(room,'personal');
    }catch(err){
      if(error){error.textContent=String(err?.message||err||'Unable to start Personal Room.');error.hidden=false;}
    }finally{personalBusy=false;if(button)button.disabled=false;}
  }

  async function verifyLivePersonalIdentity(){
    if(!expectedPersonalCode)return true;
    try{
      const context=await desktop.meeting?.context?.();
      const live=digits(context?.roomCode);
      if(live&&live!==expectedPersonalCode){
        console.error('[DominionStar Meet] Personal Meeting ID mismatch blocked by physical acceptance authority.',{expected:expectedPersonalCode,live});
        window.DominionMeetingNotifications?.toast?.('Personal Meeting ID mismatch detected. End this meeting and retry.');
        return false;
      }
      if(live===expectedPersonalCode){expectedPersonalCode='';document.body.dataset.dsExpectedPersonalRoomCode='';}
    }catch{}
    return true;
  }

  function syncParticipantCount(){
    const roster=q('#participantRoster');if(!roster)return;
    const panel=roster.closest('.room-side')||q('#participantPanel');
    const heading=panel?.querySelector('.room-side-head strong')||panel?.querySelector('section h3');
    if(!heading)return;
    const count=roster.querySelectorAll('[data-participant-id]').length;
    const next=`Participants (${count})`;
    if(heading.textContent!==next)heading.textContent=next;
  }

  function syncVideoDockPolicy(){
    const dock=q('#participantVideoDock'),overlay=q('#meetingOverlay');if(!dock||!overlay||overlay.hidden)return;
    const shared=overlay.classList.contains('share-active')||document.body.classList.contains('remote-share-active');
    const view=String(overlay.dataset.viewMode||'speaker');
    const visibleTiles=qa('#participantVideoDock .remote-peer-tile').filter(tile=>!tile.hidden&&!tile.classList.contains('stage-promoted')).length;
    const rosterCount=q('#participantRoster')?.querySelectorAll('[data-participant-id]').length||0;
    const participantCount=Math.max(rosterCount,visibleTiles+(q('#localVideoDockTile')?1:0));
    const thresholdApplies=!shared&&view==='speaker';
    const suppress=thresholdApplies&&participantCount<=2;
    dock.dataset.zoomThreshold=suppress?'suppressed-under-3':'available';
    if(suppress){if(!dock.hidden)dock.hidden=true;return;}
    if(shared){
      const allowed=window.DominionPreferences?.read?.('shareVideoDock')!==false;
      if(allowed&&visibleTiles>0&&dock.hidden)dock.hidden=false;
      return;
    }
    if(thresholdApplies&&participantCount>2&&visibleTiles>0&&dock.hidden)dock.hidden=false;
  }

  function bindShareState(){
    if(shareStateUnsub||!window.DominionShareController?.onChange)return;
    shareStateUnsub=window.DominionShareController.onChange(()=>requestAnimationFrame(syncVideoDockPolicy));
  }

  function sync(){syncPersonalChoice();syncParticipantCount();syncVideoDockPolicy();bindShareState();}

  function onDocumentClick(event){
    // Share Screen is intentionally NOT intercepted here. The isolated Share
    // integration owns that click so permission status, native picker and real
    // getDisplayMedia failure all stay in one transaction.
    if(event.target?.closest?.('#newMeetingUsePersonal'))requestAnimationFrame(syncPersonalChoice);
  }

  installReactionTrayGuard();
  document.addEventListener('submit',event=>void startSelectedPersonalMeeting(event),true);
  document.addEventListener('click',onDocumentClick,true);
  window.addEventListener('dominion:meeting-ui-ready',()=>{sync();void verifyLivePersonalIdentity();});
  window.addEventListener('dominion:meeting-snapshot',()=>{syncParticipantCount();syncVideoDockPolicy();void verifyLivePersonalIdentity();});
  window.addEventListener('dominion:participant-presence',()=>{syncParticipantCount();syncVideoDockPolicy();});
  window.addEventListener('resize',()=>requestAnimationFrame(syncVideoDockPolicy),{passive:true});
  window.addEventListener('dominion:meeting-ended',()=>{expectedPersonalCode='';document.body.dataset.dsExpectedPersonalRoomCode='';});
  sync();

  window.DominionPhysicalMacRepair=Object.freeze({version:'2.0.21',openVerifiedShare,showRecovery,detectScreenPermission,syncPersonalChoice,verifyLivePersonalIdentity,syncParticipantCount,syncVideoDockPolicy,sync});
})();