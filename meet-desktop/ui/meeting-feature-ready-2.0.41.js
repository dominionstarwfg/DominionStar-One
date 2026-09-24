(()=>{
'use strict';
if(window.DominionMeetingFeatureReady2041?.executiveLocked)return;
const q=s=>document.querySelector(s),desktop=window.dominionDesktop||{};
let observer=null,frame=0,observed=null;
const I={
mic:'<svg viewBox="0 0 24 24"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5.5 11.5a6.5 6.5 0 0 0 13 0M12 18v3M9 21h6"/></svg>',
video:'<svg viewBox="0 0 24 24"><rect x="3" y="6" width="13" height="12" rx="3"/><path d="m16 10 5-3v10l-5-3z"/></svg>',
people:'<svg viewBox="0 0 24 24"><circle cx="9" cy="8" r="3"/><circle cx="17" cy="9" r="2.4"/><path d="M3 20a6 6 0 0 1 12 0M14 19a4.8 4.8 0 0 1 7 0"/></svg>',
chat:'<svg viewBox="0 0 24 24"><path d="M5 5h14a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H10l-5 4v-4H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2z"/></svg>',
react:'<svg viewBox="0 0 24 24"><circle cx="11" cy="12.2" r="7.6"/><path d="M8.3 10.6h.01M13.7 10.6h.01M8.4 14.1c.8 1.05 1.65 1.5 2.6 1.5 1 0 1.9-.48 2.65-1.5"/><path class="spark" d="m18.2 3.1.75 1.9 1.9.75-1.9.75-.75 1.9-.75-1.9-1.9-.75 1.9-.75z"/></svg>',
hand:'<svg viewBox="0 0 24 24"><path d="M8.2 11.5V6.8a1.35 1.35 0 0 1 2.7 0v4.1-5.4a1.35 1.35 0 0 1 2.7 0v5.4-4.7a1.35 1.35 0 0 1 2.7 0v5.2-3.7a1.35 1.35 0 0 1 2.7 0v5.6c0 4.6-2.9 7.2-7 7.2-2.8 0-4.6-1-6-3l-2.2-3a1.5 1.5 0 0 1 2.3-1.9z"/></svg>',
share:'<svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="14" rx="3"/><path d="m8 11 4-4 4 4M12 7v8M8 21h8"/></svg>',
host:'<svg viewBox="0 0 24 24"><path d="M12 3 5 6v5c0 4.6 2.8 8 7 10 4.2-2 7-5.4 7-10V6z"/><path d="m12 8 .8 1.8 1.9.2-1.45 1.25.45 1.9-1.7-1-1.7 1 .45-1.9L9.3 10l1.9-.2z"/></svg>',
more:'<svg viewBox="0 0 24 24"><circle cx="5" cy="12" r="1.65"/><circle cx="12" cy="12" r="1.65"/><circle cx="19" cy="12" r="1.65"/></svg>',
end:'<svg viewBox="0 0 24 24"><path d="M5.2 14.8c4.45-3.15 9.15-3.15 13.6 0l-1.8 3.1-3.2-1.35.4-1.65a10.4 10.4 0 0 0-4.4 0l.4 1.65L7 17.9z"/></svg>',
info:'<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8.5"/><path d="M12 10.5v6M12 7.5h.01"/></svg>',
effects:'<svg viewBox="0 0 24 24"><path d="m12 3 1.1 3.1L16.2 7.2l-3.1 1.1L12 11.4l-1.1-3.1-3.1-1.1 3.1-1.1zM18 13l.75 2.05 2.05.75-2.05.75L18 18.6l-.75-2.05-2.05-.75 2.05-.75z"/></svg>',
pen:'<svg viewBox="0 0 24 24"><path d="m5 18 1.2-4.2L15.8 4.2l4 4-9.6 9.6zM13.8 6.2l4 4M5 18l4.2-1.2"/></svg>',
shield:'<svg viewBox="0 0 24 24"><path d="M12 3 5 6v5c0 4.6 2.8 8 7 10 4.2-2 7-5.4 7-10V6z"/><path d="m9.2 12 1.8 1.8 3.8-4.6"/></svg>'
};
const controls=[['roomMic','mic','Audio'],['roomCamera','video','Video'],['roomParticipants','people','Participants'],['roomChat','chat','Chat'],['roomReactions','react','Reactions'],['roomRaiseHand','hand','Raise Hand'],['roomShare','share','Share'],['roomHostTools','host','Host Tools'],['roomMore','more','More'],['roomExitButton','end','End']];

function styles(){
if(q('style[data-ds-exec-meeting-2041]'))return;
const s=document.createElement('style');s.dataset.dsExecMeeting2041='1';s.textContent=`
body.ds-in-meeting{overflow:hidden!important;background:#02060b!important}
#meetingOverlay.ds-exec-lock{position:fixed!important;inset:0!important;width:100vw!important;height:100vh!important;min-width:0!important;min-height:0!important;max-width:none!important;max-height:none!important;margin:0!important;padding:0!important;border:0!important;border-radius:0!important;overflow:hidden!important;background:#03070c!important;z-index:1200!important}
#meetingOverlay.ds-exec-lock>.meeting-shell{position:absolute!important;inset:0!important;width:100%!important;height:100%!important;display:grid!important;grid-template-rows:54px minmax(0,1fr) 86px!important;border:0!important;border-radius:0!important;overflow:hidden!important;background:#03070c!important;box-shadow:none!important}
#meetingOverlay.ds-exec-lock .meeting-head{position:relative!important;z-index:80!important;height:54px!important;min-height:54px!important;padding:0 24px!important;display:flex!important;align-items:center!important;gap:14px!important;background:linear-gradient(180deg,#07111e,#050c16)!important;border:0!important;border-bottom:1px solid rgba(63,106,154,.36)!important;box-shadow:0 7px 26px rgba(0,0,0,.2)!important}
#meetingOverlay.ds-exec-lock .ds-meeting-brand{order:0!important;display:flex!important;align-items:center!important;gap:9px!important;flex:none!important}
#meetingOverlay.ds-exec-lock .ds-meeting-brand img{width:34px!important;height:34px!important;border-radius:8px!important;object-fit:cover!important;box-shadow:0 0 0 1px rgba(215,170,74,.25)!important}
#meetingOverlay.ds-exec-lock .ds-meeting-brand .ds-exec-brand-fallback{width:34px;height:34px;border:1px solid rgba(215,170,74,.42);border-radius:8px;display:grid;place-items:center;background:#101a27;color:#e7bd5c;font-size:10px;font-weight:800}
#meetingOverlay.ds-exec-lock .ds-meeting-brand strong{color:#f4f6fa!important;font-size:13px!important;font-weight:650!important;white-space:nowrap!important}
#meetingOverlay.ds-exec-lock .ds-exec-divider{order:1;width:1px;height:24px;background:rgba(151,171,196,.24);flex:none}
#meetingOverlay.ds-exec-lock .meeting-head>div:not(.ds-meeting-brand):not(.ds-ref-meeting-head-icons){order:2!important;display:flex!important;align-items:center!important;min-width:0!important}
#meetingOverlay.ds-exec-lock #roomTitle{margin:0!important;color:#f6f7fa!important;font-size:13px!important;font-weight:600!important;max-width:min(520px,40vw)!important;white-space:nowrap!important;overflow:hidden!important;text-overflow:ellipsis!important}
#meetingOverlay.ds-exec-lock #roomCodeLabel,#meetingOverlay.ds-exec-lock #roomRole,#meetingOverlay.ds-exec-lock .meeting-view-button{display:none!important}
#meetingOverlay.ds-exec-lock .ds-exec-encrypted{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);height:28px;padding:0 12px;display:flex;align-items:center;gap:6px;border:1px solid rgba(44,201,123,.34);border-radius:9px;background:rgba(19,79,54,.32);color:#76e6a8;font-size:10.5px;font-weight:700}
#meetingOverlay.ds-exec-lock .ds-exec-encrypted svg{width:14px;height:14px;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}
#meetingOverlay.ds-exec-lock .ds-ref-meeting-head-icons{order:4!important;margin-left:auto!important;display:flex!important;align-items:center!important;gap:8px!important}
#meetingOverlay.ds-exec-lock .ds-ref-meeting-head-icons button{width:34px!important;height:34px!important;border:0!important;border-radius:8px!important;background:transparent!important;color:#dfe7f2!important;font-size:0!important;display:grid!important;place-items:center!important}
#meetingOverlay.ds-exec-lock .ds-ref-meeting-head-icons button:hover{background:rgba(255,255,255,.07)!important}
#meetingOverlay.ds-exec-lock .ds-ref-meeting-head-icons svg{width:20px!important;height:20px!important;fill:none!important;stroke:currentColor!important;stroke-width:1.7!important;stroke-linecap:round!important;stroke-linejoin:round!important}
#meetingOverlay.ds-exec-lock .meeting-body{position:relative!important;width:100%!important;height:100%!important;min-width:0!important;min-height:0!important;overflow:hidden!important;background:#03070c!important}
#meetingOverlay.ds-exec-lock .stage{position:absolute!important;inset:0!important;width:100%!important;height:100%!important;margin:0!important;padding:0!important;display:grid!important;place-items:center!important;overflow:hidden!important;background:#06090e!important}
#meetingOverlay.ds-exec-lock .stage:has(#stageFallback:not([hidden]))::before{content:"";position:absolute;inset:-18%;pointer-events:none;background:radial-gradient(ellipse at 50% 52%,rgba(23,77,130,.13),transparent 54%),radial-gradient(ellipse at 50% 78%,transparent 0 48%,rgba(198,145,47,.11) 48.3% 48.55%,transparent 48.9%),radial-gradient(ellipse at 52% 71%,transparent 0 57%,rgba(23,112,205,.12) 57.2% 57.5%,transparent 57.9%);opacity:.72}
#meetingOverlay.ds-exec-lock .stage>#localMeetingVideo,#meetingOverlay.ds-exec-lock .stage>#remoteActiveSpeakerStage{position:absolute!important;inset:0!important;width:100%!important;height:100%!important;max-width:none!important;max-height:none!important;margin:0!important;border-radius:0!important;object-fit:cover!important;background:#05080d!important}
#meetingOverlay.ds-exec-lock .stage>.shared-content-video,#meetingOverlay.ds-exec-lock .stage>#remoteShareVideo{position:absolute!important;inset:0!important;width:100%!important;height:100%!important;max-width:none!important;max-height:none!important;object-fit:contain!important;background:#02050a!important}
#meetingOverlay.ds-exec-lock #stageFallback{position:relative!important;z-index:5!important;display:flex!important;flex-direction:column!important;align-items:center!important;background:transparent!important}
#meetingOverlay.ds-exec-lock #stageFallback[hidden]{display:none!important}
#meetingOverlay.ds-exec-lock #stageAvatar{width:138px!important;height:138px!important;border-radius:30px!important;overflow:hidden!important;display:grid!important;place-items:center!important;background:linear-gradient(145deg,#192536,#0b121c)!important;border:1px solid rgba(65,125,194,.5)!important;box-shadow:0 20px 54px rgba(0,0,0,.45),0 0 42px rgba(29,91,157,.13)!important;color:#e8c56f!important;font-size:28px!important;font-weight:750!important}
#meetingOverlay.ds-exec-lock #stageName{margin:18px 0 0!important;color:#f8f9fb!important;font-size:18px!important;font-weight:650!important}
#meetingOverlay.ds-exec-lock .meeting-footer{position:relative!important;z-index:90!important;width:100%!important;height:86px!important;min-height:86px!important;margin:0!important;padding:0 18px!important;box-sizing:border-box!important;display:grid!important;grid-template-columns:minmax(190px,1fr) auto minmax(115px,1fr)!important;align-items:center!important;column-gap:10px!important;overflow:visible!important;background:linear-gradient(180deg,rgba(6,12,20,.985),rgba(3,8,14,.995))!important;border:0!important;border-top:1px solid rgba(57,96,140,.32)!important;box-shadow:0 -10px 34px rgba(0,0,0,.2)!important}
#meetingOverlay.ds-exec-lock .meeting-footer>.ds-runtime-toolbar-zone{height:86px!important;min-width:0!important;display:flex!important;align-items:center!important;flex-wrap:nowrap!important}
#meetingOverlay.ds-exec-lock .ds-runtime-toolbar-left{grid-column:1!important;justify-self:start!important;justify-content:flex-start!important;gap:0!important}
#meetingOverlay.ds-exec-lock .ds-runtime-toolbar-center{grid-column:2!important;justify-self:center!important;justify-content:center!important;gap:4px!important}
#meetingOverlay.ds-exec-lock .ds-runtime-toolbar-right{grid-column:3!important;justify-self:end!important;justify-content:flex-end!important}
#meetingOverlay.ds-exec-lock .meeting-control.ds-exec-control{position:relative!important;min-width:74px!important;width:auto!important;height:70px!important;margin:0!important;padding:6px 8px 7px!important;display:flex!important;flex-direction:column!important;align-items:center!important;justify-content:center!important;gap:5px!important;border:0!important;border-radius:11px!important;background:transparent!important;color:#eef3fa!important;font-size:0!important;box-shadow:none!important}
#meetingOverlay.ds-exec-lock .meeting-control.ds-exec-control:hover{background:rgba(255,255,255,.065)!important;color:#fff!important}
#meetingOverlay.ds-exec-lock .ds-exec-icon{position:relative;width:27px;height:27px;display:grid;place-items:center;flex:none}
#meetingOverlay.ds-exec-lock .ds-exec-icon svg{width:26px;height:26px;fill:none;stroke:currentColor;stroke-width:1.75;stroke-linecap:round;stroke-linejoin:round;overflow:visible}
#meetingOverlay.ds-exec-lock .ds-exec-icon .spark{fill:#e9b94c!important;stroke:#e9b94c!important;stroke-width:1.1!important}
#meetingOverlay.ds-exec-lock .ds-exec-label{display:block!important;visibility:visible!important;opacity:1!important;color:currentColor!important;font-size:11.5px!important;font-weight:560!important;line-height:1.05!important;white-space:nowrap!important}
#meetingOverlay.ds-exec-lock .ds-exec-control>.ds-control-icon,#meetingOverlay.ds-exec-lock .ds-exec-control>.ds-control-label,#meetingOverlay.ds-exec-lock .ds-exec-control>.ds-reactions-fixed-label{display:none!important}
#meetingOverlay.ds-exec-lock #roomMic.is-off .ds-exec-icon::after,#meetingOverlay.ds-exec-lock #roomCamera.is-off .ds-exec-icon::after{content:"";position:absolute;left:2px;right:2px;top:12px;height:2px;border-radius:9px;background:#ff4261;transform:rotate(-42deg);box-shadow:0 0 0 1px rgba(4,9,15,.65)}
#meetingOverlay.ds-exec-lock.share-active #roomShare,body.ds-share-active #meetingOverlay.ds-exec-lock #roomShare,#meetingOverlay.ds-exec-lock #roomShare[aria-pressed="true"]{color:#20e278!important}
#meetingOverlay.ds-exec-lock #roomExitButton{min-width:72px!important;color:#ff3f59!important;background:transparent!important;border:0!important}
#meetingOverlay.ds-exec-lock #roomExitButton:hover{background:rgba(255,63,89,.08)!important}
#meetingOverlay.ds-exec-lock .av-device-caret.attached-device-caret{width:24px!important;min-width:24px!important;height:70px!important;margin:0 1px 0 -10px!important;padding:0!important;border:0!important;background:transparent!important;color:#d9e1eb!important}
#meetingOverlay.ds-exec-lock .room-side,#meetingOverlay.ds-exec-lock #meetingChatPanel{z-index:210!important}
#meetingOverlay.ds-exec-lock .participant-video-dock{z-index:180!important}
@media(max-width:1180px){#meetingOverlay.ds-exec-lock .meeting-control.ds-exec-control{min-width:66px!important;padding-left:5px!important;padding-right:5px!important}#meetingOverlay.ds-exec-lock .ds-exec-label{font-size:10.5px!important}#meetingOverlay.ds-exec-lock .ds-runtime-toolbar-center{gap:1px!important}}
@media(max-width:960px){#meetingOverlay.ds-exec-lock>.meeting-shell{grid-template-rows:52px minmax(0,1fr) 78px!important}#meetingOverlay.ds-exec-lock .meeting-footer{height:78px!important;min-height:78px!important;grid-template-columns:auto minmax(0,1fr) auto!important;padding:0 8px!important}#meetingOverlay.ds-exec-lock .meeting-footer>.ds-runtime-toolbar-zone{height:78px!important}#meetingOverlay.ds-exec-lock .ds-runtime-toolbar-center{max-width:100%!important;overflow-x:auto!important;justify-content:flex-start!important;scrollbar-width:none!important}#meetingOverlay.ds-exec-lock .meeting-control.ds-exec-control{flex:0 0 62px!important;min-width:62px!important;height:64px!important}#meetingOverlay.ds-exec-lock .ds-exec-label{font-size:9.5px!important}#meetingOverlay.ds-exec-lock .ds-meeting-brand strong{display:none!important}}
`;
document.head.append(s);
}

function ensureBrandIdentity(){
const h=q('#meetingOverlay .meeting-head');if(!h)return null;
let b=h.querySelector('.ds-meeting-brand');if(!b){b=document.createElement('div');b.className='ds-meeting-brand';h.prepend(b);}
if(!b.dataset.dsExec){b.textContent='';const url=String(desktop.brand?.logoUrl||'').trim();if(url){const img=document.createElement('img');img.src=url;img.alt='DominionStar';img.referrerPolicy='no-referrer';b.append(img);}else{const m=document.createElement('span');m.className='ds-exec-brand-fallback';m.textContent='DS';b.append(m);}const n=document.createElement('strong');n.textContent='DominionStar Meet';b.append(n);b.dataset.dsExec='1';}
return {h,b};
}
function brand(){
const identity=ensureBrandIdentity();if(!identity)return;const {h,b}=identity;
if(!h.querySelector(':scope>.ds-exec-divider')){const d=document.createElement('span');d.className='ds-exec-divider';b.after(d);}
if(!h.querySelector('.ds-exec-encrypted')){const e=document.createElement('span');e.className='ds-exec-encrypted';e.innerHTML=I.shield+'<span>Encrypted</span>';h.append(e);}
const tools=h.querySelector('.ds-ref-meeting-head-icons');
if(tools){for(const [sel,key] of [['[data-ref-security]','host'],['[data-ref-annotate]','pen'],['[data-ref-effects]','effects'],['[data-ref-info]','info']]){const x=tools.querySelector(sel);if(x&&x.dataset.dsExec!==key){x.innerHTML=I[key];x.dataset.dsExec=key;}}}
}

function control(id,key,label){
const b=document.getElementById(id);if(!b)return;
b.classList.add('ds-exec-control');b.querySelector('.ds-reactions-fixed-label')?.remove();
let i=b.querySelector(':scope>.ds-exec-icon');if(!i){i=document.createElement('span');i.className='ds-exec-icon';b.prepend(i);}if(i.dataset.icon!==key){i.innerHTML=I[key]||'';i.dataset.icon=key;}
let l=b.querySelector(':scope>.ds-exec-label');if(!l){l=document.createElement('span');l.className='ds-exec-label';b.append(l);}
const role=String(q('#roomRole')?.textContent||'').toLowerCase().replace('-','');
const txt=id==='roomExitButton'?(role==='host'?'End':(/leave/i.test(b.getAttribute('aria-label')||'')?'Leave':'End')):label;
if(l.textContent!==txt)l.textContent=txt;
}
function syncControls(){for(const [id,key,label] of controls)control(id,key,label);}

function finalReferenceReady(){return Boolean(window.DominionZoomScreenshotReference?.sync);}
function handoffToFinalReference(o){
if(!o)return false;
ensureBrandIdentity();
o.classList.remove('ds-exec-lock');
for(const node of o.querySelectorAll('.ds-exec-icon,.ds-exec-label,.ds-exec-encrypted,.ds-exec-divider'))node.remove();
for(const node of o.querySelectorAll('.ds-exec-control'))node.classList.remove('ds-exec-control');
window.DominionZoomScreenshotReference?.requestSync?.();
return true;
}
function sync(){
const o=q('#meetingOverlay');if(!o)return false;styles();
if(finalReferenceReady())return handoffToFinalReference(o);
o.classList.add('ds-exec-lock');brand();syncControls();
requestAnimationFrame(()=>{if(finalReferenceReady()){handoffToFinalReference(o);return;}brand();syncControls();});
return true;
}
function schedule(){if(frame)return;frame=requestAnimationFrame(()=>{frame=0;sync();});}
function observe(){const o=q('#meetingOverlay');if(!o||o===observed)return;observer?.disconnect();observed=o;observer=new MutationObserver(rs=>{if(rs.some(r=>r.type==='childList'||(r.type==='attributes'&&['hidden','class','aria-label','aria-pressed'].includes(r.attributeName))))schedule();});observer.observe(o,{subtree:true,childList:true,attributes:true,attributeFilter:['hidden','class','aria-label','aria-pressed']});}
function hydrate(){try{window.DominionMeetingFeatures?.toggleChat?.(false);}catch(e){console.warn('[DominionStar Meet] Meeting feature hydration failed.',e);}observe();schedule();setTimeout(schedule,80);setTimeout(schedule,320);}
window.addEventListener('dominion:meeting-ui-ready',hydrate);window.addEventListener('dominion:meeting-snapshot',schedule);window.addEventListener('resize',schedule,{passive:true});
window.DominionMeetingFeatureReady2041=Object.freeze({version:'2.0.41-locked-executive',executiveLocked:true,hydrate,sync:()=>{observe();return sync();},enforceReactionLabel:()=>{control('roomReactions','react','Reactions');return Boolean(q('#roomReactions'));},dispose(){window.removeEventListener('dominion:meeting-ui-ready',hydrate);window.removeEventListener('dominion:meeting-snapshot',schedule);window.removeEventListener('resize',schedule);observer?.disconnect();if(frame)cancelAnimationFrame(frame);}});
styles();if(q('#meetingOverlay'))hydrate();
})();
