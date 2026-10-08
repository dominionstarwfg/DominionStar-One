(()=>{
  'use strict';
  if(window.DominionMeetingLifecycleAuthority)return;
  const desktop=window.dominionDesktop||{},meeting=desktop.meeting||null;
  const q=s=>document.querySelector(s);
  let exitDialog=null,inviteDialog=null;

  const esc=value=>String(value||'').replace(/[&<>"]/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[char]));
  const digits=value=>String(value||'').replace(/\D/g,'');
  const formatRoom=value=>digits(value).replace(/(\d{3})(?=\d)/g,'$1 ').trim();

  function installStyle(){
    if(q('style[data-ds-lifecycle-authority]'))return;
    const style=document.createElement('style');
    style.dataset.dsLifecycleAuthority='1';
    style.textContent=`
      .ds-lifecycle-dialog{width:min(480px,calc(100vw - 32px));padding:0;border:1px solid #4a4b50;border-radius:14px;background:#252629;color:#f4f4f5;box-shadow:0 28px 90px #000c}
      .ds-lifecycle-dialog::backdrop{background:#000a;backdrop-filter:blur(3px)}
      .ds-lifecycle-dialog header{display:flex;align-items:center;justify-content:space-between;padding:16px 18px;border-bottom:1px solid #3c3d41}
      .ds-lifecycle-dialog header div{min-width:0}.ds-lifecycle-dialog header small{display:block;color:#aeb0b5;font-size:11px;margin-bottom:3px}.ds-lifecycle-dialog h2{margin:0;font-size:18px}
      .ds-lifecycle-dialog .ds-close{width:30px;height:30px;border:0;border-radius:7px;background:transparent;color:#ddd;font-size:20px;cursor:pointer}
      .ds-lifecycle-body{display:grid;gap:13px;padding:18px}.ds-lifecycle-body p{margin:0;color:#c4c5c9;font-size:12px;line-height:1.5}
      .ds-lifecycle-status{min-height:18px;color:#ff8a94!important}.ds-lifecycle-actions{display:grid;gap:8px}
      .ds-lifecycle-actions button{height:42px;border:0;border-radius:9px;background:#414247;color:#fff;font-weight:650;cursor:pointer}
      .ds-lifecycle-actions button:hover{filter:brightness(1.08)}.ds-lifecycle-actions .danger{background:#c83c49}.ds-lifecycle-actions .primary{background:#2d78df}
      .ds-invite-field{display:grid;gap:6px}.ds-invite-field span{color:#aeb0b5;font-size:10px;text-transform:uppercase;letter-spacing:.06em}
      .ds-invite-field input{width:100%;height:39px;padding:0 10px;border:1px solid #4b4c50;border-radius:8px;background:#18191b;color:#fff}
      .ds-invite-meta{display:grid;grid-template-columns:1fr 1fr;gap:9px}.ds-invite-meta div{padding:10px;border:1px solid #3f4044;border-radius:8px;background:#1d1e21}
      .ds-invite-meta small,.ds-invite-meta strong{display:block}.ds-invite-meta small{color:#aeb0b5;font-size:9px}.ds-invite-meta strong{margin-top:3px;font-size:13px}
      .ds-invite-buttons{display:flex;gap:8px}.ds-invite-buttons button{flex:1}
    `;
    document.head.append(style);
  }

  async function ctx(){try{return await meeting?.context?.()||{};}catch{return {};}}
  async function snap(roomId){try{return roomId&&meeting?.snapshot?await meeting.snapshot(roomId):null;}catch{return null;}}

  async function copy(text){
    const value=String(text||'');if(!value)return false;
    try{await navigator.clipboard.writeText(value);return true;}catch{}
    try{
      const area=document.createElement('textarea');area.value=value;area.readOnly=true;area.style.position='fixed';area.style.opacity='0';
      document.body.append(area);area.select();const ok=document.execCommand?.('copy')!==false;area.remove();return Boolean(ok);
    }catch{return false;}
  }

  function ensureExitDialog(){
    installStyle();
    if(exitDialog?.isConnected)return exitDialog;
    exitDialog=document.createElement('dialog');exitDialog.id='dsCanonicalExitDialog';exitDialog.className='ds-lifecycle-dialog';
    exitDialog.innerHTML='<header><div><small>MEETING</small><h2>Leave or end meeting?</h2></div><button type="button" class="ds-close" aria-label="Close">×</button></header><div class="ds-lifecycle-body"><p data-copy></p><p class="ds-lifecycle-status" data-status></p><div class="ds-lifecycle-actions"><button type="button" data-leave>Leave Meeting</button><button type="button" class="danger" data-end>End Meeting for All</button><button type="button" data-cancel>Cancel</button></div></div>';
    document.body.append(exitDialog);
    exitDialog.querySelector('.ds-close').onclick=()=>exitDialog.close('cancel');
    exitDialog.querySelector('[data-cancel]').onclick=()=>exitDialog.close('cancel');
    return exitDialog;
  }

  async function openExit(){
    if(!meeting)return {closed:false};
    const context=await ctx();if(!context.roomId)return {closed:false};
    const host=String(context.role||'').toLowerCase()==='host';
    const dialog=ensureExitDialog(),status=dialog.querySelector('[data-status]'),copyNode=dialog.querySelector('[data-copy]');
    const leave=dialog.querySelector('[data-leave]'),end=dialog.querySelector('[data-end]');
    dialog.querySelector('h2').textContent=host?'Leave or end meeting?':'Leave meeting?';
    copyNode.textContent=host?'Leave keeps the meeting running only when another signed-in participant can become host. End Meeting for All closes the room for everyone.':'Confirm before leaving this meeting.';
    status.textContent='';end.hidden=!host;
    const finish=()=>{if(dialog.open)dialog.close('complete');return {closed:true};};
    const busy=value=>{leave.disabled=value;end.disabled=value;};
    return await new Promise(resolve=>{
      const closeHandler=()=>{dialog.removeEventListener('close',closeHandler);if(dialog.returnValue!=='complete')resolve({closed:false});};
      dialog.addEventListener('close',closeHandler);
      leave.onclick=async()=>{
        busy(true);status.textContent='';
        try{
          if(host){
            const snapshot=await snap(context.roomId);
            const peers=(snapshot?.participants||[]).filter(p=>String(p.participantId||'')!==String(context.participantId||'')&&['admitted','joined'].includes(String(p.state||'joined'))&&p.memberId);
            peers.sort((a,b)=>Number(String(b.role||'')==='cohost')-Number(String(a.role||'')==='cohost'));
            const successor=peers[0];
            if(!successor||typeof meeting.transferHostAndLeave!=='function'){
              status.textContent='Another signed-in DominionStar participant must be in the meeting before the host can leave. You can still end the meeting for everyone.';
              busy(false);return;
            }
            await meeting.transferHostAndLeave(successor.participantId);
          }else await meeting.leave(context.participantId,context.joinToken);
          const result=finish();resolve(result);
        }catch(error){status.textContent=String(error?.message||error||'Meeting could not be left.');busy(false);}
      };
      end.onclick=async()=>{
        busy(true);status.textContent='';
        try{await meeting.end(context.roomId);const result=finish();resolve(result);}
        catch(error){status.textContent=String(error?.message||error||'Meeting could not be ended.');busy(false);}
      };
      if(!dialog.open)dialog.showModal();
    });
  }

  function ensureInviteDialog(){
    installStyle();
    if(inviteDialog?.isConnected)return inviteDialog;
    inviteDialog=document.createElement('dialog');inviteDialog.id='dsCanonicalInviteDialog';inviteDialog.className='ds-lifecycle-dialog';
    inviteDialog.innerHTML='<header><div><small>INVITE</small><h2>Invite to meeting</h2></div><button type="button" class="ds-close" aria-label="Close">×</button></header><div class="ds-lifecycle-body"><div class="ds-invite-field"><span>Meeting link</span><input data-link readonly></div><div class="ds-invite-meta"><div><small>Meeting ID</small><strong data-room></strong></div><div><small>Passcode</small><strong data-passcode></strong></div></div><p class="ds-lifecycle-status" data-status></p><div class="ds-lifecycle-actions"><div class="ds-invite-buttons"><button type="button" class="primary" data-copy-link>Copy Link</button><button type="button" data-copy-invite>Copy Invitation</button></div><button type="button" data-close>Close</button></div></div>';
    document.body.append(inviteDialog);
    for(const node of inviteDialog.querySelectorAll('.ds-close,[data-close]'))node.onclick=()=>inviteDialog.close('close');
    return inviteDialog;
  }

  async function openInvite(){
    const context=await ctx();const dialog=ensureInviteDialog();
    const room=digits(context.roomCode),passcode=digits(context.passcode);
    const link=room?`https://dominionstarld.com/meet/?meetingId=${encodeURIComponent(room)}${passcode?`&passcode=${encodeURIComponent(passcode)}`:''}`:'';
    const title=String(q('#roomTitle')?.textContent||'DominionStar Meeting').trim();
    const invitation=`${title}\nMeeting ID: ${formatRoom(room)}\nPasscode: ${passcode}\n${link}`.trim();
    dialog.querySelector('[data-link]').value=link;
    dialog.querySelector('[data-room]').textContent=formatRoom(room)||'Unavailable';
    dialog.querySelector('[data-passcode]').textContent=passcode||'None';
    const status=dialog.querySelector('[data-status]');status.textContent='';
    dialog.querySelector('[data-copy-link]').onclick=async()=>{status.textContent=await copy(link)?'Meeting link copied.':'Could not copy the meeting link.';};
    dialog.querySelector('[data-copy-invite]').onclick=async()=>{status.textContent=await copy(invitation)?'Invitation copied.':'Could not copy the invitation.';};
    if(!dialog.open)dialog.showModal();
    return true;
  }

  if(!window.__DOMINION_CANONICAL_INVITE_GUARD_BOUND){
    window.__DOMINION_CANONICAL_INVITE_GUARD_BOUND=true;
    window.addEventListener('click',event=>{
      const invite=event.target?.closest?.('[data-ds-invite],[data-ref-invite]');
      if(!invite||q('#meetingOverlay')?.hidden)return;
      event.preventDefault();event.stopPropagation();event.stopImmediatePropagation();
      void openInvite();
    },true);
  }

  window.DominionMeetingLifecycleAuthority=Object.freeze({version:'2.0.55-two-device-regression-repair',openExit,openInvite});
})();