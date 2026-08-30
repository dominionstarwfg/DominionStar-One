(()=>{
  'use strict';
  if(window.DominionPhysicalMacRepair)return;

  const desktop=window.dominionDesktop||{};
  const q=s=>document.querySelector(s),qa=s=>[...document.querySelectorAll(s)];
  const digits=v=>String(v||'').replace(/\D/g,'');
  const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
  const inMeeting=()=>Boolean(q('#meetingOverlay')&&!q('#meetingOverlay').hidden);
  let shareBusy=false;
  let personalBusy=false;
  let recoveryDialog=null;
  let expectedPersonalCode='';
  let rosterObserver=null;

  function hideLegacyShareRecovery(){
    for(const node of qa('.ds-share-permission')){
      if(!node.hidden)node.hidden=true;
    }
  }

  async function screenStatus(){
    try{return String((await desktop.media?.permissions?.())?.screen||'unknown');}
    catch{return 'unknown';}
  }

  async function sourceProbe(kind='screen'){
    try{
      const result=await desktop.sharePicker?.listSources?.({kind,includeDominionStar:false});
      const sources=Array.isArray(result?.sources)?result.sources:[];
      return {ok:Boolean(result?.ok&&sources.length),sources,result};
    }catch(error){return {ok:false,sources:[],result:{ok:false,error:String(error?.message||error||'source_probe_failed')}};}
  }

  async function waitForNativeDecision(maxMs=45000){
    const started=Date.now();
    while(Date.now()-started<maxMs){
      const status=await screenStatus();
      if(status!=='not-determined')return status;
      await sleep(500);
    }
    return 'not-determined';
  }

  function ensureRecoveryDialog(){
    if(recoveryDialog?.isConnected)return recoveryDialog;
    recoveryDialog=document.createElement('section');
    recoveryDialog.className='ds-219-share-recovery';
    recoveryDialog.hidden=true;
    recoveryDialog.setAttribute('role','dialog');
    recoveryDialog.setAttribute('aria-modal','true');
    recoveryDialog.innerHTML=`<div class="ds-219-share-card"><div class="ds-219-share-icon">↥</div><div class="ds-219-share-copy"><p>SCREEN SHARING</p><h3>Reauthorize this installed build</h3><span data-ds-219-share-message></span></div><div class="ds-219-share-actions"><button type="button" data-ds-219-cancel>Not now</button><button type="button" data-ds-219-reset>Reset & Reauthorize</button><button type="button" class="primary" data-ds-219-restart>Restart DominionStar Meet</button></div></div>`;
    document.body.append(recoveryDialog);
    recoveryDialog.querySelector('[data-ds-219-cancel]').onclick=()=>{recoveryDialog.hidden=true;};
    recoveryDialog.querySelector('[data-ds-219-restart]').onclick=()=>void desktop.app?.relaunch?.();
    recoveryDialog.querySelector('[data-ds-219-reset]').onclick=async event=>{
      const button=event.currentTarget;button.disabled=true;
      try{
        const result=await desktop.app?.resetScreenPermission?.();
        recoveryDialog.hidden=true;
        if(result?.ok===false)throw new Error(result.error||'Unable to reset Screen Recording permission.');
        // Trigger the native macOS request for this exact running binary. Do not
        // stack a DominionStar modal over the operating-system prompt.
        await sourceProbe('screen');
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
        ? `macOS did not return a readable screen source for this running build (status: ${status}). This prototype is ad-hoc signed, so an ON switch left by an older DominionStar build can belong to a different privacy identity. Reset & Reauthorize clears the stale Screen Recording record for this build. After granting access, restart DominionStar Meet once.`
        : `macOS did not return a readable screen source (status: ${status}). Reauthorize Screen Recording, then restart DominionStar Meet once so the running process can use the new grant.`;
    }
    dialog.hidden=false;
  }

  async function openVerifiedShare(){
    if(shareBusy||!inMeeting())return;
    shareBusy=true;hideLegacyShareRecovery();
    try{
      const initialStatus=await screenStatus();
      const first=await sourceProbe('screen');
      if(first.ok){
        await window.DominionZoomPhysicalAcceptance?.openSmartSharePicker?.();
        return;
      }

      // A not-determined status means macOS owns the interaction. desktopCapturer
      // may have just opened the native Screen Recording prompt. Never display a
      // second DominionStar modal while that native prompt is unresolved.
      if(initialStatus==='not-determined'){
        const decided=await waitForNativeDecision();
        if(decided==='not-determined')return;
        if(decided==='granted'){
          await sleep(350);
          const retry=await sourceProbe('screen');
          if(retry.ok){await window.DominionZoomPhysicalAcceptance?.openSmartSharePicker?.();return;}
        }
        await showRecovery(decided);
        return;
      }

      // If TCC claims granted but no readable source exists, this is precisely the
      // stale/replaced-binary case seen in physical QA. Recovery must reauthorize
      // the exact installed binary rather than blindly reopening Settings.
      await showRecovery(initialStatus);
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
    const roster=q('#participantRoster'),heading=q('#participantPanel .room-side-head strong, .room-side .room-side-head strong');if(!roster||!heading)return;
    const count=roster.querySelectorAll('[data-participant-id]').length;
    const next=`Participants (${count})`;
    if(heading.textContent!==next)heading.textContent=next;
  }

  function installRosterObserver(){
    const roster=q('#participantRoster');if(!roster||rosterObserver)return;
    rosterObserver=new MutationObserver(()=>syncParticipantCount());
    rosterObserver.observe(roster,{childList:true,subtree:true});syncParticipantCount();
  }

  function sync(){syncPersonalChoice();installRosterObserver();syncParticipantCount();}

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
  window.addEventListener('dominion:meeting-snapshot',()=>{syncParticipantCount();void verifyLivePersonalIdentity();});
  new MutationObserver(()=>sync()).observe(document.body,{childList:true,subtree:true});
  setInterval(sync,900);sync();

  window.DominionPhysicalMacRepair=Object.freeze({version:'2.0.19',openVerifiedShare,syncPersonalChoice,verifyLivePersonalIdentity,syncParticipantCount});
})();
