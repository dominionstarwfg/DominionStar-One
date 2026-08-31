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
  let rosterObserver=null;
  let dockObserver=null;
  let observedDock=null;

  function hideLegacyShareRecovery(){
    for(const node of qa('.ds-share-permission,.ds-219-share-recovery')){
      if(!node.hidden)node.hidden=true;
    }
  }

  async function screenStatus(){
    try{return String((await desktop.media?.permissions?.())?.screen||'unknown');}
    catch{return 'unknown';}
  }

  function ensureRecoveryDialog(){
    if(recoveryDialog?.isConnected)return recoveryDialog;
    recoveryDialog=document.createElement('section');
    recoveryDialog.className='ds-219-share-recovery';
    recoveryDialog.hidden=true;
    recoveryDialog.setAttribute('role','dialog');
    recoveryDialog.setAttribute('aria-modal','true');
    recoveryDialog.innerHTML=`<div class="ds-219-share-card"><div class="ds-219-share-icon">↥</div><div class="ds-219-share-copy"><p>SCREEN SHARING</p><h3>Screen sharing was blocked by macOS</h3><span data-ds-219-share-message></span></div><div class="ds-219-share-actions"><button type="button" data-ds-219-cancel>Not now</button><button type="button" data-ds-219-reset>Reset & Reauthorize</button><button type="button" class="primary" data-ds-219-restart>Restart DominionStar Meet</button></div></div>`;
    document.body.append(recoveryDialog);
    recoveryDialog.querySelector('[data-ds-219-cancel]').onclick=()=>{recoveryDialog.hidden=true;};
    recoveryDialog.querySelector('[data-ds-219-restart]').onclick=()=>void desktop.app?.relaunch?.();
    recoveryDialog.querySelector('[data-ds-219-reset]').onclick=async event=>{
      const button=event.currentTarget;button.disabled=true;
      try{
        const result=await desktop.app?.resetScreenPermission?.();
        recoveryDialog.hidden=true;
        if(result?.ok===false)throw new Error(result.error||'Unable to reset Screen Recording permission.');
        await desktop.media?.openPrivacy?.('screen').catch?.(()=>{});
      }catch(error){
        recoveryDialog.hidden=false;
        const message=recoveryDialog.querySelector('[data-ds-219-share-message]');
        if(message)message.textContent=String(error?.message||error||'Unable to reset Screen Recording permission.');
      }finally{button.disabled=false;}
    };
    return recoveryDialog;
  }

  async function showRecovery(status='unknown'){
    hideLegacyShareRecovery();
    const dialog=ensureRecoveryDialog();
    let identity={};try{identity=await desktop.app?.privacyIdentity?.()||{};}catch{}
    const message=dialog.querySelector('[data-ds-219-share-message]');
    const unstable=identity?.stableAcrossRebuilds===false;
    if(message){
      message.textContent=unstable
        ? `The native macOS screen-capture request failed for this installed build (status: ${status}). This prototype is ad-hoc signed, so a grant left by an older build may not apply to this binary. Reset & Reauthorize only after the native picker fails, then restart DominionStar Meet once.`
        : `The native macOS screen-capture request failed (status: ${status}). Reauthorize Screen Recording, then restart DominionStar Meet once.`;
    }
    dialog.hidden=false;
  }

  async function openVerifiedShare(){
    if(shareBusy||!inMeeting())return false;
    shareBusy=true;hideLegacyShareRecovery();
    try{
      // 2.0.21 rule: never enumerate screen sources as a permission probe before
      // getDisplayMedia. The native macOS picker must receive the user gesture.
      const integration=window.DominionShareIntegration;
      if(!integration?.open)throw new Error('Screen-share integration is not ready.');
      return await integration.open();
    }catch(error){
      const status=await screenStatus();
      await showRecovery(status||String(error?.name||'unknown'));
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

  function installRosterObserver(){
    const roster=q('#participantRoster');if(!roster||rosterObserver)return;
    rosterObserver=new MutationObserver(()=>{syncParticipantCount();syncVideoDockPolicy();});
    rosterObserver.observe(roster,{childList:true,subtree:true});syncParticipantCount();
  }

  function installDockObserver(){
    const dock=q('#participantVideoDock');if(!dock||dock===observedDock)return;
    dockObserver?.disconnect();observedDock=dock;
    dockObserver=new MutationObserver(()=>syncVideoDockPolicy());
    dockObserver.observe(dock,{childList:true,subtree:true,attributes:true,attributeFilter:['hidden','class']});
    syncVideoDockPolicy();
  }

  function sync(){syncPersonalChoice();installRosterObserver();syncParticipantCount();installDockObserver();syncVideoDockPolicy();}

  document.addEventListener('submit',event=>void startSelectedPersonalMeeting(event),true);
  document.addEventListener('click',event=>{
    const share=event.target?.closest?.('#roomShare');
    if(share&&inMeeting()){
      event.preventDefault();event.stopPropagation();event.stopImmediatePropagation();
      void openVerifiedShare();return;
    }
    if(event.target?.closest?.('#newMeetingUsePersonal'))requestAnimationFrame(syncPersonalChoice);
  },true);
  window.addEventListener('dominion:meeting-ui-ready',()=>{sync();void verifyLivePersonalIdentity();});
  window.addEventListener('dominion:meeting-snapshot',()=>{syncParticipantCount();syncVideoDockPolicy();void verifyLivePersonalIdentity();});
  new MutationObserver(()=>sync()).observe(document.body,{childList:true,subtree:true});
  setInterval(sync,900);sync();

  window.DominionPhysicalMacRepair=Object.freeze({version:'2.0.21',openVerifiedShare,showRecovery,syncPersonalChoice,verifyLivePersonalIdentity,syncParticipantCount,syncVideoDockPolicy});
})();
