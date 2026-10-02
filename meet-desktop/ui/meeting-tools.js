(()=>{
'use strict';
if(window.DominionMeetingTools)return;
const desktop=window.dominionDesktop||{},meeting=desktop.meeting||null;
const q=s=>document.querySelector(s),qa=s=>[...document.querySelectorAll(s)];
let pollDialog=null,whiteboardDialog=null,appsDialog=null;
const pollState={poll:null,votes:new Map(),hostId:'',localId:'',localRole:''};
const esc=value=>String(value??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
async function context(){try{return await meeting?.context?.()||{};}catch{return{}}}
async function snap(){const ctx=await context();if(!ctx.roomId||!meeting?.snapshot)return null;try{return await meeting.snapshot(ctx.roomId);}catch{return null}}
async function refreshIdentity(){const ctx=await context(),s=await snap();pollState.localId=String(ctx.participantId||'');const self=(s?.participants||[]).find(p=>String(p.participantId)===pollState.localId);pollState.localRole=String(self?.role||q('#roomRole')?.textContent||'participant').toLowerCase().replace('-','');const host=(s?.participants||[]).find(p=>String(p.role||'').toLowerCase()==='host');pollState.hostId=String(host?.participantId||'');return {ctx,s,self,host}}
async function peers(){const {s}=await refreshIdentity();return (s?.participants||[]).filter(p=>String(p.participantId||'')&&String(p.participantId)!==pollState.localId&&['joined','admitted'].includes(String(p.state||'joined')))}
async function broadcast(type,payload){if(!meeting?.sendSignal)return;const list=await peers();await Promise.allSettled(list.map(p=>meeting.sendSignal(p.participantId,type,payload)))}
function manager(){return ['host','cohost'].includes(pollState.localRole)}
function ensurePollDialog(){
 if(pollDialog?.isConnected)return pollDialog;
 pollDialog=document.createElement('dialog');pollDialog.className='modal meeting-poll-dialog';pollDialog.innerHTML='<form method="dialog"><header><div><p class="eyebrow">MEETING POLL</p><h2>Polls</h2></div><button class="modal-close" value="cancel" aria-label="Close">×</button></header><section class="poll-create"><label><span>Question</span><input data-poll-question maxlength="180" placeholder="Ask a question"></label><label><span>Option 1</span><input data-poll-option maxlength="100" placeholder="First choice"></label><label><span>Option 2</span><input data-poll-option maxlength="100" placeholder="Second choice"></label><label><span>Option 3</span><input data-poll-option maxlength="100" placeholder="Optional third choice"></label><label><span>Option 4</span><input data-poll-option maxlength="100" placeholder="Optional fourth choice"></label><button type="button" class="primary-button" data-poll-launch>Launch poll</button></section><section class="poll-live" hidden><h3 data-poll-live-question></h3><div data-poll-choices></div><div data-poll-results></div><p data-poll-status></p><div class="modal-actions"><button type="button" class="secondary-button" data-poll-end>End poll</button><button value="cancel" class="primary-button">Close</button></div></section></form>';document.body.append(pollDialog);
 pollDialog.querySelector('[data-poll-launch]').onclick=()=>void launchPoll();
 pollDialog.querySelector('[data-poll-end]').onclick=()=>void endPoll();
 return pollDialog;
}
function renderPoll(){
 const d=ensurePollDialog(),create=d.querySelector('.poll-create'),live=d.querySelector('.poll-live');const active=Boolean(pollState.poll);
 create.hidden=active||!manager();live.hidden=!active;
 if(!active){if(!manager()){live.hidden=false;live.querySelector('[data-poll-live-question]').textContent='No active poll';live.querySelector('[data-poll-choices]').innerHTML='<p class="poll-empty">The host has not launched a poll.</p>';live.querySelector('[data-poll-results]').innerHTML='';live.querySelector('[data-poll-end]').hidden=true;}return}
 const poll=pollState.poll;live.querySelector('[data-poll-live-question]').textContent=poll.question;const choices=live.querySelector('[data-poll-choices]');choices.innerHTML='';
 poll.options.forEach((label,index)=>{const b=document.createElement('button');b.type='button';b.className='poll-choice';b.textContent=label;b.disabled=manager()||pollState.votes.has(pollState.localId);b.onclick=()=>void vote(index);choices.append(b)});
 const results=live.querySelector('[data-poll-results]');results.innerHTML='';
 if(manager()){const counts=poll.options.map(()=>0);for(const index of pollState.votes.values())if(Number.isInteger(index)&&counts[index]!=null)counts[index]+=1;const total=[...pollState.votes.values()].length;poll.options.forEach((label,index)=>{const row=document.createElement('div');row.className='poll-result';const pct=total?Math.round(counts[index]/total*100):0;row.innerHTML=`<span><strong>${esc(label)}</strong><small>${counts[index]} vote${counts[index]===1?'':'s'} · ${pct}%</small></span><i><b style="width:${pct}%"></b></i>`;results.append(row)});live.querySelector('[data-poll-status]').textContent=`${total} response${total===1?'':'s'}`;live.querySelector('[data-poll-end]').hidden=false}else{results.innerHTML='';live.querySelector('[data-poll-status]').textContent=pollState.votes.has(pollState.localId)?'Response submitted':'Choose one response';live.querySelector('[data-poll-end]').hidden=true}
}
async function launchPoll(){
 await refreshIdentity();if(!manager())return;const d=ensurePollDialog(),question=String(d.querySelector('[data-poll-question]').value||'').trim(),options=qa('.meeting-poll-dialog [data-poll-option]').map(i=>String(i.value||'').trim()).filter(Boolean).slice(0,4);if(!question||options.length<2){d.querySelector('.poll-create').classList.add('invalid');return}
 pollState.poll={id:`poll-${Date.now()}`,question,options,startedAt:new Date().toISOString(),hostId:pollState.localId};pollState.votes.clear();renderPoll();await broadcast('poll:start',pollState.poll);
}
async function vote(index){await refreshIdentity();if(!pollState.poll||manager()||pollState.votes.has(pollState.localId)||!pollState.hostId)return;pollState.votes.set(pollState.localId,index);renderPoll();await meeting?.sendSignal?.(pollState.hostId,'poll:vote',{pollId:pollState.poll.id,index,participantId:pollState.localId,at:new Date().toISOString()})}
async function endPoll(){if(!pollState.poll)return;const id=pollState.poll.id;pollState.poll=null;pollState.votes.clear();renderPoll();await broadcast('poll:end',{pollId:id,at:new Date().toISOString()})}
async function openPolls(){await refreshIdentity();renderPoll();const d=ensurePollDialog();if(!d.open)d.showModal()}
function ensureWhiteboard(){
 if(whiteboardDialog?.isConnected)return whiteboardDialog;
 whiteboardDialog=document.createElement('dialog');whiteboardDialog.className='modal meeting-whiteboard-dialog';whiteboardDialog.innerHTML='<form method="dialog"><header><div><p class="eyebrow">WHITEBOARD</p><h2>Meeting Whiteboard</h2></div><button class="modal-close" value="cancel" aria-label="Close">×</button></header><div class="whiteboard-tools"><button type="button" data-wb-pen class="active">Pen</button><input type="color" data-wb-color value="#2d8cff" aria-label="Pen color"><input type="range" data-wb-width min="2" max="16" value="4" aria-label="Pen width"><button type="button" data-wb-clear>Clear</button><button type="button" data-wb-save>Save PNG</button></div><canvas width="1280" height="720"></canvas><div class="modal-actions"><button value="cancel" class="primary-button">Close</button></div></form>';document.body.append(whiteboardDialog);
 const canvas=whiteboardDialog.querySelector('canvas'),ctx=canvas.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);let drawing=false,last=null;
 const point=e=>{const r=canvas.getBoundingClientRect();return{x:(e.clientX-r.left)*canvas.width/r.width,y:(e.clientY-r.top)*canvas.height/r.height}};
 canvas.addEventListener('pointerdown',e=>{if(e.button!==0)return;drawing=true;last=point(e);canvas.setPointerCapture?.(e.pointerId)});
 canvas.addEventListener('pointermove',e=>{if(!drawing)return;const next=point(e);ctx.strokeStyle=whiteboardDialog.querySelector('[data-wb-color]').value;ctx.lineWidth=Number(whiteboardDialog.querySelector('[data-wb-width]').value)||4;ctx.lineCap='round';ctx.lineJoin='round';ctx.beginPath();ctx.moveTo(last.x,last.y);ctx.lineTo(next.x,next.y);ctx.stroke();last=next});
 const end=e=>{drawing=false;last=null;canvas.releasePointerCapture?.(e.pointerId)};canvas.addEventListener('pointerup',end);canvas.addEventListener('pointercancel',end);
 whiteboardDialog.querySelector('[data-wb-clear]').onclick=()=>{ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height)};
 whiteboardDialog.querySelector('[data-wb-save]').onclick=()=>{const a=document.createElement('a');a.href=canvas.toDataURL('image/png');a.download=`DominionStar-Whiteboard-${new Date().toISOString().replace(/[:.]/g,'-')}.png`;a.click()};
 return whiteboardDialog;
}
function openWhiteboard(){const d=ensureWhiteboard();if(!d.open)d.showModal()}
function ensureApps(){
 if(appsDialog?.isConnected)return appsDialog;
 appsDialog=document.createElement('dialog');appsDialog.className='modal meeting-apps-dialog';appsDialog.innerHTML='<form method="dialog"><header><div><p class="eyebrow">MEETING APPS</p><h2>Apps</h2></div><button class="modal-close" value="cancel" aria-label="Close">×</button></header><div class="meeting-app-grid"><button type="button" data-app="polls"><b>▥</b><strong>Polls</strong><small>Ask and collect responses</small></button><button type="button" data-app="whiteboard"><b>✎</b><strong>Whiteboard</strong><small>Draw and save ideas</small></button><button type="button" data-app="hubs"><b>▦</b><strong>Hubs</strong><small>Recordings and local notes</small></button><button type="button" data-app="aurora"><b>✦</b><strong>Aurora Assist</strong><small>Private local meeting commands</small></button><button type="button" data-app="settings"><b>⚙</b><strong>Settings</strong><small>Audio, video and meeting preferences</small></button></div></form>';document.body.append(appsDialog);
 appsDialog.querySelector('[data-app="polls"]').onclick=()=>{appsDialog.close();void openPolls()};appsDialog.querySelector('[data-app="whiteboard"]').onclick=()=>{appsDialog.close();openWhiteboard()};appsDialog.querySelector('[data-app="hubs"]').onclick=()=>{appsDialog.close();q('[data-section="hubs"]')?.click()};appsDialog.querySelector('[data-app="aurora"]').onclick=()=>{appsDialog.close();window.DominionAuroraMeet?.open?.()};appsDialog.querySelector('[data-app="settings"]').onclick=()=>{appsDialog.close();const d=q('#settingsDialog');if(d&&!d.open)d.showModal()};return appsDialog;
}
function openApps(){const d=ensureApps();if(!d.open)d.showModal()}
window.addEventListener('dominion:meeting-signal',event=>{const detail=event.detail||{},payload=detail.payload||{};if(detail.type==='poll:start'){pollState.poll={...payload};pollState.hostId=String(detail.fromParticipantId||payload.hostId||'');pollState.votes.clear();void refreshIdentity().then(()=>{renderPoll();const d=ensurePollDialog();if(!d.open)d.showModal()})}else if(detail.type==='poll:vote'&&pollState.poll&&String(payload.pollId||'')===pollState.poll.id){pollState.votes.set(String(payload.participantId||detail.fromParticipantId||''),Number(payload.index));renderPoll()}else if(detail.type==='poll:end'&&pollState.poll&&String(payload.pollId||'')===pollState.poll.id){pollState.poll=null;pollState.votes.clear();renderPoll()}});
window.addEventListener('dominion:meeting-ended',()=>{pollState.poll=null;pollState.votes.clear();pollDialog?.close?.();whiteboardDialog?.close?.();appsDialog?.close?.()});
window.DominionMeetingTools=Object.freeze({version:'1.0.0-functional-more-tools',openPolls,openWhiteboard,openApps});
})();