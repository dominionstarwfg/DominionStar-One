import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';

const [guardian,eventBus,html,runtime,personal,transcription,intelligence,dock] = await Promise.all([
  readFile('assets/js/runtime/guardian-certification.js','utf8'),
  readFile('assets/js/runtime/event-bus.js','utf8'),
  readFile('meet/index.html','utf8'),
  readFile('assets/js/meet-next/executive6.js','utf8'),
  readFile('assets/js/meet-next/personal-room.js','utf8'),
  readFile('assets/js/meet/live-transcription.js','utf8'),
  readFile('assets/js/meet/meeting-intelligence.js','utf8'),
  readFile('assets/js/meet/dock-layout-v2.js','utf8')
]);

const requireText=(text,needle,message)=>{if(!text.includes(needle))throw new Error(message)};
const requireAll=(text,needles,prefix)=>needles.forEach(needle=>requireText(text,needle,`${prefix}: ${needle}`));
const sha256=text=>createHash('sha256').update(text).digest('hex');

requireAll(guardian,[
  "const ACTION_VERSION='1.0.0'",
  'const ACTION_CATALOG=Object.freeze([',
  "window.DominionGuardianActions=actionApi",
  "window.DominionRuntime.actions=actionApi",
  "guardian()?.registerService?.('actions',actionApi)",
  "publish('guardian.action.invoked'",
  "for(const type of ['click','submit','change'])",
  "['guardian-actions','Guardian Action Observer'",
  "'action-surface'",
  "actions:actionSnapshot()"
],'Guardian action observer contract missing');

// Guardian records action identity and state only. It must not capture message,
// passcode, name, search, or other user-entered field values.
for(const forbidden of ['node.value','target.value','event.target.value','innerText:','textContent:node']){
  if(guardian.includes(forbidden))throw new Error(`Guardian action telemetry may capture user-entered content: ${forbidden}`);
}

const requiredActionIds=[
  'prejoin.new-meeting','prejoin.share-screen','prejoin.personal-room','prejoin.join','prejoin.schedule','prejoin.recurring','prejoin.submit',
  'toolbar.mic','toolbar.mic-menu','toolbar.camera','toolbar.camera-menu','toolbar.participants','toolbar.chat','toolbar.share','toolbar.reactions','toolbar.raise-hand','toolbar.transcription','toolbar.ai-notes','toolbar.host-tools','toolbar.more','toolbar.leave',
  'participants.invite','participants.mute-all','participants.more','invite.copy-link','invite.copy-invitation','chat.recipient','chat.send',
  'share.mic','share.camera','share.participants','share.chat','share.reactions','share.share','share.pause-resume','share.new','share.more','share.stop',
  'settings.camera','settings.microphone','settings.speaker','settings.mirror','settings.quality','settings.background','settings.brightness','settings.appearance',
  'schedule.submit','schedule.recurring','schedule.waiting-room','schedule.passcode',
  'personal.copy','personal.save','personal.start','personal.passcode','personal.waiting-room',
  'leave.leave','leave.end-all','leave.cancel',
  'dock.collapsed','dock.speaker','dock.stack','dock.grid',
  'dynamic.waiting-admit','dynamic.waiting-decline','dynamic.participant-mic','dynamic.participant-video','dynamic.participant-more','dynamic.utility-command','dynamic.transcription-command','dynamic.ai-notes-command'
];
requireAll(guardian,requiredActionIds,'Guardian catalog lost required action family');

// Every fixed #id selector named by Guardian must exist in the static Meet shell.
const selectorMatches=[...guardian.matchAll(/action\('[^']+','[^']+','(#[A-Za-z][A-Za-z0-9_-]*)'/g)].map(m=>m[1]);
const uniqueSelectors=[...new Set(selectorMatches)];
const missingStatic=uniqueSelectors.filter(selector=>!html.includes(`id=\"${selector.slice(1)}\"`));
if(missingStatic.length)throw new Error(`Guardian catalogs static controls absent from Meet shell: ${missingStatic.join(', ')}`);

// Prove the primary runtime still owns behavior rather than Guardian replacing it.
requireAll(runtime,[
  'ids.micBtn.onclick=', 'ids.camBtn.onclick=', 'ids.chatBtn.onclick=', 'ids.shareBtn.onclick=',
  "$('shareMicBtn').onclick=", "$('shareCamBtn').onclick=", "$('shareParticipantsBtn').onclick=", "$('shareChatBtn').onclick=", "$('shareReactionBtn').onclick=", "$('shareTopBtn').onclick=",
  'ids.pauseShareBtn.onclick=', 'ids.newShareBtn.onclick=', 'ids.stopShareBtn.onclick=',
  "event.target.closest('[data-admit]')", "event.target.closest('[data-deny]')",
  "event.target.closest('[data-toast-admit]')", "event.target.closest('[data-toast-deny]')",
  "event.target.closest('[data-quick-mic]')", "event.target.closest('[data-quick-video]')", "event.target.closest('[data-participant]')",
  "$('scheduleMeetingAction')?.addEventListener('click',openSchedule)",
  "$('scheduleMeetingForm')?.addEventListener('submit'",
  'ids.leaveBtn.onclick=', 'ids.leaveOnlyBtn.onclick=', 'ids.endAllBtn.onclick='
],'Meet runtime action handler missing');

requireAll(personal,[
  "$('personalMeetingAction')?.addEventListener('click'",
  "$('savePersonalRoom')?.addEventListener('click'",
  "$('startPersonalRoom')?.addEventListener('click'",
  "$('copyPersonalInvite')?.addEventListener('click'"
],'Personal Room action handler missing');
requireText(transcription,"button.addEventListener('click'",'Transcription toolbar action is not wired');
requireText(intelligence,"openBtn.addEventListener('click'",'AI Notes toolbar action is not wired');
requireText(dock,"button.addEventListener('click'",'Participant dock view action is not wired');

// Older feature telemetry must converge on the canonical bus observed by Guardian.
requireText(eventBus,'window.DominionStarEventBus=window.DominionRuntime.events','Legacy feature telemetry is not bridged into Guardian event bus');

console.log(`GUARDIAN_CERTIFICATION_SHA256=${sha256(guardian)}`);
console.log(`GUARDIAN_EVENT_BUS_SHA256=${sha256(eventBus)}`);
console.log(`GUARDIAN_ACTION_CATALOG_STATIC_CONTROLS=${uniqueSelectors.length}`);
console.log(`GUARDIAN_ACTION_CATALOG_REQUIRED_IDS=${requiredActionIds.length}`);
console.log('DOMINIONSTAR_GUARDIAN_EVERY_ACTION_CONTRACT_OK');
