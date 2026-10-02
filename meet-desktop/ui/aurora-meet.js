(()=>{
'use strict';
if(window.DominionAuroraMeet)return;
const q=s=>document.querySelector(s);
let dialog=null,privacyDialog=null,lastResult='';
const LOCAL_VOICE_KEY='ds_aurora_local_voice_feedback';
const normalize=value=>String(value||'').toLowerCase().replace(/[.,!?;:]+/g,' ').replace(/\s+/g,' ').trim();
function localVoiceEnabled(){try{return localStorage.getItem(LOCAL_VOICE_KEY)!=='0'}catch{return true}}
function setLocalVoiceEnabled(value){try{localStorage.setItem(LOCAL_VOICE_KEY,value?'1':'0')}catch{}}
function speak(text){
  if(!localVoiceEnabled()||!('speechSynthesis'in window))return false;
  const voices=speechSynthesis.getVoices?.()||[],local=voices.find(v=>v.localService===true&&/^en/i.test(v.lang||''))||voices.find(v=>v.localService===true);
  if(!local)return false;try{speechSynthesis.cancel();const utterance=new SpeechSynthesisUtterance(String(text||''));utterance.voice=local;utterance.rate=1;utterance.volume=.82;speechSynthesis.speak(utterance);return true}catch{return false}
}
function click(selector){const node=q(selector);if(!node)return false;node.click();return true}
function isPressed(selector){return q(selector)?.getAttribute('aria-pressed')==='true'}
function meetingActive(){return Boolean(q('#meetingOverlay')&&!q('#meetingOverlay').hidden)}
function response(text,kind='ok'){lastResult=text;const out=dialog?.querySelector('[data-aurora-result]');if(out){out.textContent=text;out.dataset.kind=kind}speak(text);return {ok:kind!=='error',message:text}}
async function execute(raw){
  let command=normalize(raw).replace(/^(hey\s+meet|hey\s+aurora|aurora|meet)\s*/,'').trim();
  if(!command)return response('Try a meeting command such as “mute my mic” or “turn off my video”.','error');
  if(!meetingActive()&&!/(settings|hubs|privacy|recordings)/.test(command))return response('Start or join a meeting before using that command.','error');

  if(/^(mute|turn off|disable).*(mic|microphone|audio)|^(mute me)$/.test(command)){
    if(!isPressed('#roomMic'))click('#roomMic');return response('Microphone muted.');
  }
  if(/^(unmute|turn on|enable).*(mic|microphone|audio)|^(unmute me)$/.test(command)){
    if(isPressed('#roomMic'))click('#roomMic');return response('Microphone on.');
  }
  if(/^(turn off|disable|stop).*(camera|video)|^(camera off|video off)$/.test(command)){
    if(!isPressed('#roomCamera'))click('#roomCamera');return response('Video off.');
  }
  if(/^(turn on|enable|start).*(camera|video)|^(camera on|video on)$/.test(command)){
    if(isPressed('#roomCamera'))click('#roomCamera');return response('Video on.');
  }
  if(/(open|show).*(participants|people)|^participants$/.test(command)){click('#roomParticipants');return response('Participants opened.')}
  if(/(open|show).*(chat|messages)|^chat$/.test(command)){window.DominionMeetingFeatures?.toggleChat?.(true);return response('Chat opened.')}
  if(/(close|hide).*(chat|messages)/.test(command)){window.DominionMeetingFeatures?.toggleChat?.(false);return response('Chat closed.')}
  if(/(share|start sharing).*(screen|display)|^share screen$/.test(command)){click('#roomShare');return response('Opening screen share.')}
  if(/(stop|end).*(share|sharing|screen share)/.test(command)){const stopped=window.DominionShareIntegration?.stop?.({waitForCleanup:true})??window.DominionShareController?.stop?.({waitForCleanup:true});await Promise.resolve(stopped).catch(()=>{});return response('Screen sharing stopped.')}
  if(/(raise).*(hand)/.test(command)){await window.DominionMeetingFeatures?.setLocalHand?.(true);return response('Hand raised.')}
  if(/(lower).*(hand)/.test(command)){await window.DominionMeetingFeatures?.setLocalHand?.(false);return response('Hand lowered.')}
  if(/(start|record).*(recording)|^record$/.test(command)){await window.DominionMeetingFeatures?.toggleRecording?.();return response('Recording command sent.')}
  if(/(captions|caption|subtitle)/.test(command)){click('#roomCaptions');return response('Captions toggled.')}
  if(/(poll|polls)/.test(command)){await window.DominionMeetingTools?.openPolls?.();return response('Polls opened.')}
  if(/(whiteboard|board)/.test(command)){window.DominionMeetingTools?.openWhiteboard?.();return response('Whiteboard opened.')}
  if(/(hubs|recordings)/.test(command)){q('[data-section="hubs"]')?.click();return response('Hubs opened.')}
  if(/(settings|preferences)/.test(command)){const d=q('#settingsDialog');if(d&&!d.open)d.showModal();return response('Settings opened.')}
  if(/(privacy|security)/.test(command)){openPrivacy();return response('Privacy and Aurora status opened.')}
  return response('I did not match that command. Use a direct meeting action such as mute, video, chat, participants, share, record, polls, whiteboard, Hubs, or settings.','error');
}
function ensureDialog(){
  if(dialog?.isConnected)return dialog;
  dialog=document.createElement('dialog');dialog.className='modal aurora-meet-dialog';dialog.innerHTML='<form method="dialog"><header><div><p class="eyebrow">AURORA MEETING ASSIST</p><h2>Private meeting commands</h2></div><button class="modal-close" value="cancel" aria-label="Close">×</button></header><div class="aurora-orbit"><span>✦</span><div><strong>Local command mode</strong><small>Commands are interpreted in this app. No meeting audio is sent to an AI service.</small></div></div><label class="aurora-command"><span>Ask Aurora</span><input data-aurora-input autocomplete="off" placeholder="Hey Meet, turn off my video"></label><div class="aurora-suggestions"><button type="button">Mute my mic</button><button type="button">Turn off my video</button><button type="button">Open participants</button><button type="button">Share screen</button><button type="button">Open polls</button><button type="button">Open Hubs</button></div><p class="aurora-result" data-aurora-result>Ready.</p><section class="aurora-voice-status"><div><strong>Voice wake phrase</strong><small>Cloud speech recognition is blocked by design. “Hey Meet” voice listening will activate only when an approved on-device speech engine is installed.</small></div><span>LOCAL ENGINE REQUIRED</span></section><div class="modal-actions"><button type="button" class="secondary-button" data-aurora-privacy>Privacy</button><button type="submit" class="primary-button">Run command</button></div></form>';document.body.append(dialog);
  const form=dialog.querySelector('form'),input=dialog.querySelector('[data-aurora-input]');form.addEventListener('submit',event=>{event.preventDefault();void execute(input.value);input.select()});
  dialog.querySelectorAll('.aurora-suggestions button').forEach(button=>button.onclick=()=>{input.value=button.textContent;void execute(button.textContent)});
  dialog.querySelector('[data-aurora-privacy]').onclick=openPrivacy;return dialog;
}
function ensurePrivacy(){
 if(privacyDialog?.isConnected)return privacyDialog;
 privacyDialog=document.createElement('dialog');privacyDialog.className='modal aurora-privacy-dialog';privacyDialog.innerHTML='<form method="dialog"><header><div><p class="eyebrow">PRIVACY & SECURITY</p><h2>Aurora and meeting data</h2></div><button class="modal-close" value="cancel" aria-label="Close">×</button></header><div class="aurora-privacy-grid"><article><span>✓</span><div><strong>Aurora command parsing</strong><small>Local in the DominionStar Meet renderer. No prompt is sent to an external AI API.</small></div></article><article><span>✓</span><div><strong>Hubs recordings & notes</strong><small>Stored locally on this Mac in app storage unless you explicitly download or share them.</small></div></article><article><span>◈</span><div><strong>Meeting transport</strong><small>Media uses encrypted WebRTC transport. Signaling and relay infrastructure can process connection metadata; this screen does not claim zero third-party infrastructure.</small></div></article><article><span>⛔</span><div><strong>Cloud speech fallback</strong><small>Disabled. Aurora will not silently send microphone audio to a browser or cloud speech-recognition service.</small></div></article></div><label class="aurora-local-voice"><span><strong>Local voice feedback</strong><small>Use only an operating-system voice marked as local.</small></span><input type="checkbox" data-local-voice></label><div class="modal-actions"><button value="ok" class="primary-button">Done</button></div></form>';document.body.append(privacyDialog);const toggle=privacyDialog.querySelector('[data-local-voice]');toggle.checked=localVoiceEnabled();toggle.onchange=()=>setLocalVoiceEnabled(toggle.checked);return privacyDialog;
}
function open(){const d=ensureDialog();if(!d.open)d.showModal();setTimeout(()=>d.querySelector('[data-aurora-input]')?.focus(),20)}
function openPrivacy(){const d=ensurePrivacy();const toggle=d.querySelector('[data-local-voice]');if(toggle)toggle.checked=localVoiceEnabled();if(!d.open)d.showModal()}
window.DominionAuroraMeet=Object.freeze({version:'1.0.0-local-command-assist',open,openPrivacy,execute,privacy:Object.freeze({commandProcessing:'local',cloudSpeechFallback:false,hubsStorage:'local',meetingTransport:'encrypted-webrtc-with-infrastructure-metadata'})});
})();