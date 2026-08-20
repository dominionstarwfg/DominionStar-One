(()=>{
  'use strict';
  if(window.DominionSlideControl)return;
  const engine=window.DominionStarMeetingEngine;
  if(!engine||!globalThis.crypto?.subtle)return;

  const textEncoder=new TextEncoder();
  const textDecoder=new TextDecoder();
  const participants=new Map();
  const peerKeys=new Map();
  const grants=new Map();
  let channel=null,client=null,keyPair=null,publicKeyB64='';
  let helloTimer=0,lastSource=null,localShareActive=false,slidePermissionReady=false;
  let controllerGrant=null,remotePresenterActive=false;

  const snapshot=()=>engine.snapshot?.()||{};
  const selfId=()=>String(snapshot().participantId||'');
  const roomId=()=>String(snapshot().roomId||'');
  const bytesToB64=bytes=>btoa(String.fromCharCode(...new Uint8Array(bytes)));
  const b64ToBytes=value=>Uint8Array.from(atob(String(value||'')),c=>c.charCodeAt(0));
  const exportPublic=key=>crypto.subtle.exportKey('raw',key).then(bytesToB64);
  const importPublic=value=>crypto.subtle.importKey('raw',b64ToBytes(value),{name:'ECDH',namedCurve:'P-256'},false,[]);
  const deriveKey=async publicB64=>crypto.subtle.deriveKey({name:'ECDH',public:await importPublic(publicB64)},keyPair.privateKey,{name:'AES-GCM',length:256},false,['encrypt','decrypt']);
  const encrypt=async(key,value)=>{const iv=crypto.getRandomValues(new Uint8Array(12));const data=await crypto.subtle.encrypt({name:'AES-GCM',iv},key,textEncoder.encode(JSON.stringify(value)));return{iv:bytesToB64(iv),data:bytesToB64(data)};};
  const decrypt=async(key,iv,data)=>JSON.parse(textDecoder.decode(await crypto.subtle.decrypt({name:'AES-GCM',iv:b64ToBytes(iv)},key,b64ToBytes(data))));
  const randomId=prefix=>`${prefix}_${crypto.randomUUID?.()||Math.random().toString(36).slice(2)}_${Date.now().toString(36)}`;

  const supportedSource=source=>{
    if(!source)return false;
    if(source.kind==='screen')return true;
    return /powerpoint|keynote|google\s*slides|slides\s*-|slide\s*show/i.test(String(source.sourceName||''));
  };

  const style=document.createElement('style');
  style.textContent=`
    .ds-slide-dialog{width:min(520px,92vw);border:1px solid #ffffff24;border-radius:18px;padding:0;background:linear-gradient(160deg,#172131,#0a1019);color:#f8fafc;box-shadow:0 30px 100px #000b}.ds-slide-dialog::backdrop{background:#02060bb8;backdrop-filter:blur(8px)}
    .ds-slide-dialog header{padding:22px 24px 14px}.ds-slide-dialog h2{margin:0 0 7px;font-size:21px}.ds-slide-dialog p{margin:0;color:#aeb9c8;line-height:1.45}.ds-slide-people{padding:10px 18px 18px;max-height:330px;overflow:auto}.ds-slide-person{display:flex;align-items:center;justify-content:space-between;gap:14px;padding:12px;border:1px solid #ffffff12;border-radius:12px;background:#ffffff08;margin-top:8px}.ds-slide-person strong{display:block}.ds-slide-person small{color:#8f9aaa}.ds-slide-person button,.ds-slide-footer button{border:1px solid #ffffff22;border-radius:9px;padding:8px 12px;background:#1c2737;color:#fff;font-weight:750;cursor:pointer}.ds-slide-person button.active{border-color:#e8bc49;background:#e8bc49;color:#151922}.ds-slide-footer{display:flex;justify-content:space-between;align-items:center;padding:14px 18px;border-top:1px solid #ffffff17}.ds-slide-footer small{color:#9ca8b8}.ds-slide-footer .danger{color:#ff9ba6}
    .ds-slide-controller{position:fixed;left:20px;bottom:96px;z-index:10060;display:flex;align-items:center;gap:8px;padding:8px;border:1px solid #ffffff24;border-radius:14px;background:linear-gradient(180deg,#172131f5,#0b111bf5);box-shadow:0 20px 60px #0009;backdrop-filter:blur(18px)}.ds-slide-controller[hidden]{display:none}.ds-slide-controller span{padding:0 7px;color:#d9e1eb;font-size:11px;font-weight:750}.ds-slide-controller button{width:42px;height:38px;border:1px solid #ffffff24;border-radius:10px;background:#253247;color:#fff;font-size:20px;cursor:pointer}.ds-slide-controller button:hover{border-color:#e8bc49;background:#34435a}.ds-slide-controller .close{font-size:14px;color:#ffb0b8}
  `;
  document.head.append(style);

  const dialog=document.createElement('dialog');dialog.className='ds-slide-dialog';
  dialog.innerHTML='<header><h2>Slide Control</h2><p>Give selected participants Previous / Next control for the presentation you are sharing.</p></header><div class="ds-slide-people"></div><footer class="ds-slide-footer"><small data-slide-status>Presentation control is private and limited to slide navigation.</small><div><button type="button" class="danger" data-revoke-all>Stop Slide Control</button> <button type="button" data-close>Done</button></div></footer>';
  document.body.append(dialog);
  const people=dialog.querySelector('.ds-slide-people'),status=dialog.querySelector('[data-slide-status]');
  const controller=document.createElement('div');controller.className='ds-slide-controller';controller.hidden=true;controller.innerHTML='<button type="button" data-prev aria-label="Previous slide">‹</button><span>Slide Control</span><button type="button" data-next aria-label="Next slide">›</button><button type="button" class="close" data-hide aria-label="Hide slide controls">×</button>';document.body.append(controller);

  const send=async(event,payload={})=>{if(!channel)return false;return channel.send({type:'broadcast',event,payload:{...payload,roomId:roomId(),from:selfId(),sentAt:Date.now()}});};
  const announce=()=>publicKeyB64&&send('hello',{publicKey:publicKeyB64,displayName:String(snapshot().displayName||'Participant')}).catch(()=>{});

  const renderPeople=()=>{
    const current=selfId();
    const rows=[...participants.entries()].filter(([id,p])=>id!==current&&p?.admitted!==false);
    people.innerHTML=rows.length?'':'<p style="padding:12px;color:#93a0b1">No other admitted participant is available yet.</p>';
    for(const [id,p] of rows){
      const row=document.createElement('div');row.className='ds-slide-person';
      const copy=document.createElement('span');copy.innerHTML=`<strong>${String(p.displayName||'Participant').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}</strong><small>${peerKeys.has(id)?'Ready for slide control':'Connecting secure control…'}</small>`;
      const button=document.createElement('button');button.type='button';button.textContent=grants.has(id)?'Revoke':'Grant control';button.classList.toggle('active',grants.has(id));button.disabled=!peerKeys.has(id);button.onclick=()=>grants.has(id)?revoke(id):grant(id);
      row.append(copy,button);people.append(row);
    }
  };

  const ensurePermission=async()=>{
    if(slidePermissionReady)return true;
    if(!window.dominionDesktop?.isDesktop)return false;
    const result=await window.dominionDesktop.getSlideControlPermission?.().catch(()=>({ok:false}));
    slidePermissionReady=Boolean(result?.ok);
    if(!slidePermissionReady){status.textContent='Allow DominionStar Meet in Privacy & Security → Accessibility, then open Slide Control again.';return false;}
    window.dominionDesktop.setSlideControlState?.({active:localShareActive&&supportedSource(lastSource)});
    return true;
  };

  const grant=async participantId=>{
    if(!localShareActive||!supportedSource(lastSource)){status.textContent='Share a screen or a PowerPoint, Keynote, or Google Slides presentation first.';return false;}
    if(!await ensurePermission())return false;
    const targetPublic=peerKeys.get(participantId);if(!targetPublic){status.textContent='Waiting for the participant secure-control channel…';return false;}
    const key=await deriveKey(targetPublic);const grantId=randomId('slide');const payload=await encrypt(key,{grantId,presenterId:selfId(),issuedAt:Date.now()});
    grants.set(participantId,{key,grantId,lastSeq:0});
    await send('grant',{to:participantId,presenterPublicKey:publicKeyB64,...payload});
    status.textContent='Slide control granted. Only Previous and Next are authorized.';renderPeople();return true;
  };

  const revoke=async participantId=>{
    const current=grants.get(participantId);grants.delete(participantId);
    if(current){const payload=await encrypt(current.key,{grantId:current.grantId,revokedAt:Date.now()}).catch(()=>null);if(payload)await send('revoke',{to:participantId,...payload}).catch(()=>{});}
    renderPeople();return true;
  };
  const revokeAll=async()=>{for(const id of [...grants.keys()])await revoke(id);status.textContent='Slide control revoked for everyone.';};

  const open=async()=>{
    if(!localShareActive){status.textContent='Slide Control is available while you are sharing a presentation.';}
    else if(!supportedSource(lastSource)){status.textContent='Select an entire screen or a supported PowerPoint, Keynote, or Google Slides window.';}
    else status.textContent='Choose who may move the presentation backward or forward.';
    renderPeople();dialog.showModal();return true;
  };

  const handleGrant=async payload=>{
    if(payload.to!==selfId()||!payload.presenterPublicKey)return;
    try{const key=await deriveKey(payload.presenterPublicKey);const data=await decrypt(key,payload.iv,payload.data);if(!data?.grantId)return;controllerGrant={presenterId:String(data.presenterId||payload.from),grantId:data.grantId,key,seq:0};remotePresenterActive=true;controller.hidden=false;}catch(_){ }
  };
  const handleRevoke=async payload=>{
    if(payload.to!==selfId()||!controllerGrant||payload.from!==controllerGrant.presenterId)return;
    try{const data=await decrypt(controllerGrant.key,payload.iv,payload.data);if(data?.grantId!==controllerGrant.grantId)return;controllerGrant=null;controller.hidden=true;}catch(_){ }
  };
  const handleCommand=async payload=>{
    if(payload.to!==selfId()||!localShareActive)return;
    const grantState=grants.get(payload.from);if(!grantState||payload.grantId!==grantState.grantId)return;
    try{const data=await decrypt(grantState.key,payload.iv,payload.data);const seq=Number(data?.seq||0);if(seq<=grantState.lastSeq||!['previous','next'].includes(data?.command))return;grantState.lastSeq=seq;await window.dominionDesktop?.applySlideControlCommand?.(data.command);}catch(_){ }
  };

  const sendCommand=async command=>{
    if(!controllerGrant||!remotePresenterActive)return false;
    controllerGrant.seq+=1;const payload=await encrypt(controllerGrant.key,{command,seq:controllerGrant.seq,at:Date.now()});
    await send('command',{to:controllerGrant.presenterId,grantId:controllerGrant.grantId,...payload});return true;
  };

  const connect=async()=>{
    if(channel||!roomId())return;
    keyPair=await crypto.subtle.generateKey({name:'ECDH',namedCurve:'P-256'},true,['deriveKey']);publicKeyB64=await exportPublic(keyPair.publicKey);
    const cfg=window.DOMINIONSTAR_SUPABASE||{};if(!window.supabase?.createClient||!cfg.url||!cfg.anonKey)return;
    client=window.supabase.createClient(cfg.url,cfg.anonKey,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
    channel=client.channel(`dominionstar-slide-${roomId()}`,{config:{broadcast:{self:false,ack:true}}});
    for(const event of ['hello','grant','revoke','command'])channel.on('broadcast',{event},({payload})=>{
      if(!payload||payload.roomId!==roomId()||payload.from===selfId())return;
      if(event==='hello'){peerKeys.set(payload.from,String(payload.publicKey||''));const known=participants.get(payload.from)||{};participants.set(payload.from,{...known,displayName:payload.displayName||known.displayName});renderPeople();}
      else if(event==='grant')void handleGrant(payload);else if(event==='revoke')void handleRevoke(payload);else void handleCommand(payload);
    });
    channel.subscribe(status=>{if(status==='SUBSCRIBED'){announce();clearInterval(helloTimer);helloTimer=setInterval(announce,4500);}});
  };

  const wrapPicker=()=>{
    const picker=window.DominionDesktopSharePicker;if(!picker?.choose||picker.__dsSlideWrapped)return false;
    const original=picker.choose.bind(picker);picker.choose=async(...args)=>{const result=await original(...args);if(result){lastSource={...result};window.dispatchEvent(new CustomEvent('dominion:presentation-source',{detail:lastSource}));}return result;};
    Object.defineProperty(picker,'__dsSlideWrapped',{value:true});return true;
  };
  const pickerTimer=setInterval(()=>{if(wrapPicker())clearInterval(pickerTimer);},150);
  setTimeout(()=>clearInterval(pickerTimer),12000);wrapPicker();

  engine.on('connected',()=>connect().catch(()=>{}));
  engine.on('admitted',()=>connect().catch(()=>{}));
  engine.on('presence',payload=>{for(const member of payload?.members||[])if(member?.participantId)participants.set(member.participantId,member);renderPeople();announce();});
  engine.on('screen-stream',()=>{localShareActive=true;window.dominionDesktop?.setSlideControlState?.({active:slidePermissionReady&&supportedSource(lastSource)});});
  engine.on('screen-ended',()=>{localShareActive=false;window.dominionDesktop?.setSlideControlState?.({active:false});if(dialog.open)dialog.close();});
  engine.on('screen-state',payload=>{if(controllerGrant&&payload.participantId===controllerGrant.presenterId){remotePresenterActive=Boolean(payload.active);controller.hidden=!remotePresenterActive;}});
  engine.on('meeting-ended',()=>{controllerGrant=null;grants.clear();controller.hidden=true;clearInterval(helloTimer);window.dominionDesktop?.setSlideControlState?.({active:false});});
  window.addEventListener('dominion:slide-control-open',()=>void open());
  window.addEventListener('beforeunload',()=>window.dominionDesktop?.setSlideControlState?.({active:false}),{once:true});
  dialog.querySelector('[data-close]').onclick=()=>dialog.close();dialog.querySelector('[data-revoke-all]').onclick=()=>void revokeAll();
  controller.querySelector('[data-prev]').onclick=()=>void sendCommand('previous');controller.querySelector('[data-next]').onclick=()=>void sendCommand('next');controller.querySelector('[data-hide]').onclick=()=>controller.hidden=true;
  if(roomId())connect().catch(()=>{});

  window.DominionSlideControl=Object.freeze({version:'1.0.0',open,grant,revoke,revokeAll,snapshot:()=>({localShareActive,source:lastSource,grants:[...grants.keys()],controller:controllerGrant?{presenterId:controllerGrant.presenterId,grantId:controllerGrant.grantId}:null})});
})();
