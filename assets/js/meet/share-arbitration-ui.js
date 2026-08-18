(() => {
  'use strict';
  if (window.DominionShareArbitrationUI) return;

  const engine=window.DominionStarMeetingEngine;
  const shareBtn=document.getElementById('shareBtn');
  const newShareBtn=document.getElementById('newShareBtn');
  if(!engine||!shareBtn)return;

  let busy=false;
  let bypassShareClick=false;

  const style=document.createElement('style');
  style.textContent=`
    .ds-share-arbitration-toast{position:fixed;left:50%;top:72px;z-index:10080;transform:translateX(-50%);max-width:min(460px,calc(100vw - 32px));padding:10px 14px;border:1px solid rgba(255,255,255,.14);border-radius:12px;background:rgba(9,14,23,.94);box-shadow:0 18px 55px rgba(0,0,0,.42);color:#f8fafc;font:700 12px/1.35 Inter,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;backdrop-filter:blur(16px);-webkit-backdrop-filter:blur(16px)}
    .ds-share-arbitration-dialog{border:1px solid rgba(255,255,255,.15);border-radius:18px;padding:0;width:min(460px,calc(100vw - 32px));background:#0d1522;color:#f8fafc;box-shadow:0 30px 90px rgba(0,0,0,.62)}
    .ds-share-arbitration-dialog::backdrop{background:rgba(3,7,13,.64);backdrop-filter:blur(4px)}
    .ds-share-arbitration-dialog section{padding:24px;font-family:Inter,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}.ds-share-arbitration-dialog h2{margin:0 0 8px;font-size:19px}.ds-share-arbitration-dialog p{margin:0;color:#b8c2cf;line-height:1.55;font-size:13px}.ds-share-arbitration-dialog footer{display:flex;justify-content:flex-end;gap:9px;margin-top:22px}.ds-share-arbitration-dialog button{border:1px solid rgba(255,255,255,.15);border-radius:10px;padding:9px 13px;background:#162132;color:#f8fafc;font-weight:760;cursor:pointer}.ds-share-arbitration-dialog .primary{background:#e8bc49;border-color:#e8bc49;color:#111827}
  `;
  document.head.append(style);

  const toast=message=>{
    const existing=document.querySelector('.ds-share-arbitration-toast');existing?.remove();
    const node=document.createElement('div');node.className='ds-share-arbitration-toast';node.setAttribute('role','status');node.textContent=message;document.body.append(node);setTimeout(()=>node.remove(),2600);
  };

  const waitForArbitration=async()=>{
    if(window.DominionShareArbitration)return window.DominionShareArbitration;
    const script=document.querySelector('script[data-ds-share-arbitration]');
    if(script)await Promise.race([new Promise(resolve=>{script.addEventListener('load',resolve,{once:true});script.addEventListener('error',resolve,{once:true});}),new Promise(resolve=>setTimeout(resolve,4500))]);
    return window.DominionShareArbitration||null;
  };

  const confirmTakeover=()=>new Promise(resolve=>{
    const dialog=document.createElement('dialog');dialog.className='ds-share-arbitration-dialog';dialog.innerHTML='<section><h2>Another screen is being shared</h2><p>Stop the current participant\'s share and start sharing your screen instead?</p><footer><button type="button" data-cancel>Cancel</button><button type="button" class="primary" data-confirm>Stop share & start mine</button></footer></section>';
    document.body.append(dialog);
    const finish=value=>{if(dialog.open)dialog.close();dialog.remove();resolve(value);};
    dialog.querySelector('[data-cancel]').onclick=()=>finish(false);dialog.querySelector('[data-confirm]').onclick=()=>finish(true);dialog.addEventListener('cancel',event=>{event.preventDefault();finish(false);},{once:true});dialog.showModal();
  });

  const waitUntilReleased=async(arb,participantId,timeoutMs=4200)=>{
    const start=Date.now();
    while(Date.now()-start<timeoutMs){const lease=arb.snapshot?.().lease;if(!lease||lease.participantId!==participantId)return true;await new Promise(resolve=>setTimeout(resolve,120));}
    return false;
  };

  const startLocalShare=async()=>{
    if(busy)return false;busy=true;
    try{
      const arb=await waitForArbitration();
      if(!arb){toast('Screen-share coordination is still connecting. Try Share again.');return false;}
      let result=await arb.requestStart();
      if(!result.ok&&result.reason==='presenter-active'&&result.canTakeOver){
        if(!(await confirmTakeover()))return false;
        const presenterId=result.presenterId;
        try{await engine.moderate(presenterId,'stop-share');}catch(error){toast(error?.message||'Could not stop the current share.');return false;}
        if(!(await waitUntilReleased(arb,presenterId))){toast('The current share is still ending. Try again in a moment.');return false;}
        result=await arb.requestStart();
      }
      if(!result.ok){
        toast(result.reason==='presenter-active'||result.reason==='claim-lost'?'Someone else is already sharing.':'Screen-share coordination is unavailable. Try again.');
        return false;
      }
      try{await engine.shareScreen();return true;}
      catch(error){await arb.release?.(engine.snapshot?.().participantId||'',{force:true}).catch?.(()=>{});if(error?.name!=='AbortError')toast(error?.message||'Screen sharing could not start.');return false;}
    }finally{busy=false;}
  };

  const startNewShare=async()=>{
    if(busy)return false;busy=true;
    try{
      const arb=await waitForArbitration();
      if(!arb){toast('Screen-share coordination is still connecting.');return false;}
      if(!arb.holdForRestart?.()){toast('Your presentation ownership could not be preserved.');return false;}
      try{
        await engine.stopScreenShare();
        const result=await arb.requestStart();
        if(!result.ok){await arb.cancelRestart?.();toast('Another presenter took the stage before New Share could begin.');return false;}
        await engine.shareScreen();
        return true;
      }catch(error){await arb.cancelRestart?.().catch?.(()=>{});if(error?.name!=='AbortError')toast(error?.message||'Could not start a new share.');return false;}
    }finally{busy=false;}
  };

  document.addEventListener('click',event=>{
    const target=event.target?.closest?.('#shareBtn,#newShareBtn');
    if(!target)return;
    if(target===shareBtn){
      if(document.body.classList.contains('local-presentation-active'))return;
      if(bypassShareClick){bypassShareClick=false;return;}
      event.preventDefault();event.stopImmediatePropagation();startLocalShare();
      return;
    }
    if(target===newShareBtn&&document.body.classList.contains('local-presentation-active')){
      event.preventDefault();event.stopImmediatePropagation();startNewShare();
    }
  },true);

  engine.on?.('screen-state',payload=>{
    if(!payload?.active||!payload.participantId)return;
    const arb=window.DominionShareArbitration;
    if(!arb||arb.acceptIncoming(payload.participantId))return;
    const snap=engine.snapshot?.()||{};
    if(snap.isHost||snap.role==='host'||snap.role==='cohost')engine.moderate(payload.participantId,'stop-share').catch(()=>{});
    window.DominionRuntime?.events?.publish?.({type:'screen.share.arbitration.rejected',source:'meet-ui',meetingId:String(snap.roomId||''),actorId:String(payload.participantId||''),severity:'warning',payload:{participantId:String(payload.participantId||''),leaseParticipantId:String(arb.snapshot?.().lease?.participantId||'')}});
  });

  window.DominionShareArbitrationUI=Object.freeze({version:'1.0.0',startLocalShare,startNewShare,snapshot:()=>({busy,lease:window.DominionShareArbitration?.snapshot?.().lease||null})});
})();