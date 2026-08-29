(()=>{
  if(window.DominionMeetingCaptions)return;
  const desktop=window.dominionDesktop||{},meeting=desktop.meeting||null;
  const q=s=>document.querySelector(s),qa=s=>[...document.querySelectorAll(s)];
  const state={show:true,panelOpen:false,menu:null,history:[],snapshot:null,participants:[],localParticipantId:'',role:'participant',captioner:false,transcriptEnabled:false,captionMode:'off'};
  const esc=v=>String(v||'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
  const inMeeting=()=>Boolean(q('#meetingOverlay')&&!q('#meetingOverlay').hidden);
  const canManage=()=>['host','cohost'].includes(state.role);
  const now=()=>Date.now();

  if(!document.querySelector('link[href="./meeting-captions.css"]')){const link=document.createElement('link');link.rel='stylesheet';link.href='./meeting-captions.css';document.head.append(link);}

  async function context(){try{return await meeting?.context?.()||{};}catch{return {};}}
  function prune(){
    const cutoff=now()-180000;state.history=state.history.filter(item=>Number(item.at||0)>=cutoff);render();
  }
  function overlayText(){
    const recent=state.history.slice(-2);return recent.map(item=>'<div><strong>'+esc(item.name)+'</strong><span>'+esc(item.text)+'</span></div>').join('');
  }
  function render(){
    const overlay=q('#meetingCaptionOverlay'),panel=q('#meetingCaptionPanel'),list=q('#meetingCaptionList'),inputWrap=q('#meetingCaptionInputWrap');
    if(overlay){overlay.hidden=!state.show||!state.history.length;overlay.innerHTML=overlayText();}
    if(list){
      list.innerHTML=state.history.length?state.history.map(item=>'<article><strong>'+esc(item.name)+'</strong><p>'+esc(item.text)+'</p><time>'+new Date(item.at).toLocaleTimeString([],{hour:'numeric',minute:'2-digit'})+'</time></article>').join(''):'<p class="caption-empty">Live captions will appear here.</p>';
      list.scrollTop=list.scrollHeight;
    }
    if(inputWrap)inputWrap.hidden=!state.captioner;
    const button=q('#roomCaptions');if(button){const label=button.querySelector('.ds-control-label');if(label)label.textContent=state.show?'Hide Captions':'Show Captions';else button.textContent=state.show?'Hide Captions':'Show Captions';button.setAttribute('aria-pressed',String(state.show));}
    if(panel)panel.hidden=!state.panelOpen;
  }
  function addLine({text,name='Captioner',at=Date.now()}){
    const value=String(text||'').trim();if(!value)return;
    state.history.push({text:value.slice(0,2000),name:String(name||'Captioner'),at:Number(new Date(at).getTime())||Date.now()});prune();render();
  }
  function ensureUi(){
    const body=q('.meeting-body'),footer=q('.meeting-footer'),exit=q('#roomExitButton');if(!body||!footer||!exit)return false;
    if(!q('#meetingCaptionOverlay')){const overlay=document.createElement('div');overlay.id='meetingCaptionOverlay';overlay.className='meeting-caption-overlay';overlay.hidden=true;body.append(overlay);}
    if(!q('#meetingCaptionPanel')){
      const panel=document.createElement('aside');panel.id='meetingCaptionPanel';panel.className='meeting-caption-panel';panel.hidden=true;
      panel.innerHTML='<header><strong>Live Captions</strong><small>Past 3 minutes</small><button type="button" data-caption-close aria-label="Close captions panel">×</button></header><div id="meetingCaptionList" class="meeting-caption-list"><p class="caption-empty">Live captions will appear here.</p></div><form id="meetingCaptionInputWrap" class="meeting-caption-input" hidden><input maxlength="2000" autocomplete="off" placeholder="Type caption text"><button type="submit">Send</button></form>';
      body.append(panel);panel.querySelector('[data-caption-close]').onclick=()=>{state.panelOpen=false;render();};panel.querySelector('form').onsubmit=event=>void publishManual(event);
    }
    if(!q('#roomCaptions')){
      const cluster=document.createElement('span');cluster.className='caption-control-cluster';
      const button=document.createElement('button');button.id='roomCaptions';button.type='button';button.className='meeting-control';button.textContent='Captions';button.onclick=()=>{state.show=!state.show;render();};
      const caret=document.createElement('button');caret.id='roomCaptionsMenu';caret.type='button';caret.className='meeting-control caption-caret';caret.textContent='⌃';caret.setAttribute('aria-label','Caption options');caret.onclick=event=>{event.stopPropagation();void openMenu(caret);};
      cluster.append(button,caret);footer.insertBefore(cluster,q('#roomSettings')||exit);
    }
    render();return true;
  }

  function closeMenu(){state.menu?.remove();state.menu=null;}
  async function openMenu(anchor){
    ensureUi();closeMenu();const menu=document.createElement('div');menu.className='meeting-caption-menu';state.menu=menu;
    const add=(label,handler,{disabled=false,active=false}={})=>{const b=document.createElement('button');b.type='button';b.textContent=(active?'✓ ':'')+label;b.disabled=disabled;b.onclick=()=>{closeMenu();void handler();};menu.append(b);return b;};
    add(state.show?'Hide Captions':'Show Captions',()=>{state.show=!state.show;render();});
    add(state.panelOpen?'Hide Full Captions':'View Full Captions',()=>{state.panelOpen=!state.panelOpen;render();});
    if(canManage()){
      const sep=document.createElement('div');sep.className='caption-menu-separator';menu.append(sep);
      const title=document.createElement('strong');title.textContent='Host controls';menu.append(title);
      const select=document.createElement('select');select.className='captioner-select';select.setAttribute('aria-label','Manual captioner');
      select.innerHTML='<option value="">Select manual captioner</option>'+state.participants.filter(p=>String(p.state||'joined')==='joined'&&p.memberId).map(p=>'<option value="'+esc(p.participantId)+'">'+esc(p.displayName||'Participant')+'</option>').join('');
      if(state.snapshot?.captionerParticipantId)select.value=String(state.snapshot.captionerParticipantId);menu.append(select);
      add(state.captionMode==='manual'?'Update Manual Captioner':'Start Manual Captions',async()=>{
        if(!select.value)return;
        const ctx=await context();await meeting.setCaptionState(ctx.roomId,{mode:'manual',captionerParticipantId:select.value,transcriptEnabled:state.transcriptEnabled});
      });
      if(state.captionMode==='manual')add('Stop Manual Captions',async()=>{const ctx=await context();await meeting.setCaptionState(ctx.roomId,{mode:'off',captionerParticipantId:null,transcriptEnabled:state.transcriptEnabled});});
      add('Retain Meeting Transcript',async()=>{const ctx=await context();await meeting.setCaptionState(ctx.roomId,{mode:state.captionMode,captionerParticipantId:state.snapshot?.captionerParticipantId||null,transcriptEnabled:!state.transcriptEnabled});},{active:state.transcriptEnabled,disabled:state.captionMode==='off'});
      if(state.transcriptEnabled)add('Download Retained Transcript',()=>void downloadTranscript());
      const note=document.createElement('p');note.className='caption-menu-note';note.textContent='Automated captions are not enabled in this QA build until a stable speech engine is certified.';menu.append(note);
    }else if(state.captionMode==='off'){
      const note=document.createElement('p');note.className='caption-menu-note';note.textContent='Captions are currently off. Ask the host to enable manual captions.';menu.append(note);
    }
    document.body.append(menu);const r=anchor.getBoundingClientRect();menu.style.left=Math.max(10,Math.min(innerWidth-menu.offsetWidth-10,r.left))+'px';menu.style.bottom=Math.max(76,innerHeight-r.top+8)+'px';
  }

  async function publishManual(event){
    event.preventDefault();if(!state.captioner)return;
    const input=q('#meetingCaptionInputWrap input'),text=String(input?.value||'').trim();if(!text)return;input.value='';
    const ctx=await context();const me=state.participants.find(p=>String(p.participantId)===String(ctx.participantId));const name=String(me?.displayName||'Captioner');
    try{
      const retained=await meeting.publishCaption(ctx.participantId,text,name);
      const payload={text,name,at:retained?.spokenAt||new Date().toISOString()};addLine(payload);
      const peers=state.participants.filter(p=>String(p.participantId)!==String(ctx.participantId)&&['admitted','joined'].includes(String(p.state||'joined')));
      await Promise.allSettled(peers.map(p=>meeting.sendSignal(p.participantId,'caption',payload)));
    }catch(error){input.value=text;input.setCustomValidity(String(error?.message||error||'Caption could not be sent.'));input.reportValidity();setTimeout(()=>input.setCustomValidity(''),1600);}
  }

  async function downloadTranscript(){
    const ctx=await context();if(!ctx.roomId)return;
    try{
      const data=await meeting.transcript(ctx.roomId),lines=Array.isArray(data?.lines)?data.lines:[];
      const text=lines.map(line=>'['+new Date(line.spokenAt).toLocaleString()+'] '+String(line.speakerName||'Speaker')+': '+String(line.text||'')).join('\n');
      const blob=new Blob([text],{type:'text/plain;charset=utf-8'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='DominionStar-Meet-Transcript-'+new Date().toISOString().replace(/[:.]/g,'-')+'.txt';document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),10000);
    }catch{}
  }

  function applySnapshot(snapshot){
    state.snapshot=snapshot||null;state.participants=Array.isArray(snapshot?.participants)?snapshot.participants:[];
    state.captionMode=String(snapshot?.captionMode||'off');state.transcriptEnabled=Boolean(snapshot?.transcriptEnabled);
    const roleText=String(q('#roomRole')?.textContent||'participant').toLowerCase().replace('-','');state.role=roleText;
    void context().then(ctx=>{state.localParticipantId=String(ctx?.participantId||'');state.captioner=state.captionMode==='manual'&&String(snapshot?.captionerParticipantId||'')===state.localParticipantId;render();});
  }

  function handleSignal(event){const detail=event.detail||{};if(String(detail.type||'')!=='caption')return;const payload=detail.payload||{};addLine({text:payload.text,name:payload.name||detail.fromDisplayName||'Captioner',at:payload.at||detail.createdAt});}

  window.addEventListener('dominion:meeting-snapshot',event=>{if(inMeeting()){ensureUi();applySnapshot(event.detail||{});}});
  window.addEventListener('dominion:meeting-signal',handleSignal);
  document.addEventListener('pointerdown',event=>{if(state.menu&&!state.menu.contains(event.target)&&!event.target.closest?.('#roomCaptionsMenu'))closeMenu();},true);
  setInterval(()=>{if(inMeeting()){ensureUi();prune();}else{closeMenu();state.history=[];state.snapshot=null;state.captioner=false;state.panelOpen=false;}},1500);
  ensureUi();
  window.DominionMeetingCaptions=Object.freeze({version:'1.0.0',toggle:()=>{state.show=!state.show;render();return state.show;},openPanel:()=>{state.panelOpen=true;render();},snapshot:()=>({show:state.show,panelOpen:state.panelOpen,captionMode:state.captionMode,captioner:state.captioner,transcriptEnabled:state.transcriptEnabled,lineCount:state.history.length})});
})();