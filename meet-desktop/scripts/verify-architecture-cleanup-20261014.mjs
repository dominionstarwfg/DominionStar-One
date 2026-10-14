import fs from 'node:fs';
import assert from 'node:assert/strict';

const read=(path)=>fs.readFileSync(new URL('../'+path,import.meta.url),'utf8');
const app=read('ui/app.js');
const photos=read('ui/profile-photo-fallback.js');
const reference=read('ui/approved-reference-parity.js');
const stage=read('ui/meeting-parity.js');
const rtc=read('ui/webrtc-controller.js');
const browserBridge=read('ui/browser-bridge.js');
const macVideo=read('ui/mac-share-video.js');
const macStyle=read('ui/mac-share-video.css');
const native=read('src/mac-share-presenter-overlay.mjs');
const annotation=read('ui/mac-annotation-toolbar.css');

const check=(ok,message)=>assert.ok(ok,message);

// These tests police regressions in source ownership and reject the 2026-10-14
// failures. They are NOT substitutes for receiving real video on two Macs.
check(!app.includes("$('#prejoinAvatar').textContent=initials("),'prejoin must never replace user photo with initials');
check(!app.includes("$('#stageAvatar').textContent=initials("),'stage entry must never replace user photo with initials');
check(app.includes("setAvatar($('#prejoinAvatar'),authState.user,"),'prejoin reads authenticated photo');
check(photos.includes('function paintLocal()'),'canonical photo painter exists');
check(reference.includes('if(window.DominionProfilePhotoFallback)return;'),'legacy reference painter yields to canonical photo authority');
check(stage.includes("sourceFallback.querySelector(':scope > img:not([hidden])')"),'speaker fallback must show photo OR initials, not both');
check(!stage.includes('||singleRemoteTile'),'sole remote presence must not steal speaker stage');
check(stage.includes('const tile=spotlightTile||(!localSpeaking?remoteSpeaker:null);'),'explicit spotlight or measured remote speaker is needed');
check(stage.includes("window.addEventListener('dominion:local-voice-level'"),'local mic activity must participate in stage arbitration');
check(stage.includes("if(streamChanged)activeStage.srcObject=source.srcObject"),'speaker stage must retain an unchanged stream');
check(rtc.includes('record.senderSync.catch(()=>{}).then(async()=>'),'sender lane replacements must be serialized');
check(rtc.includes('lane.sender.track===track'),'identical sender tracks must never be replaced');
check(rtc.includes("const screen=share?.getVideoTracks?.().find(track=>track.readyState==='live')"),'screen sender must take the current live capture track');
check(rtc.includes('clearTimeout(record.cameraMuteTimer)'),'brief camera mute must be cancellable');
check(rtc.includes('clearTimeout(record.shareMuteTimer)'),'brief screen-share mute must be cancellable');
check(rtc.includes('hideRemoteShare(record.id,false)'),'transient remote-share interruption must preserve media stream');
check(rtc.includes("if(signature!==state.lastSpeakerSignature)"),'speaker UI events must be change-driven');
check(rtc.includes('async function diagnosticSnapshot()'),'non-sensitive receiver/sender diagnostics must be obtainable for physical QA');
check(rtc.includes('framesEncoded:')&&rtc.includes('framesDecoded:')&&rtc.includes("element('#remoteShareVideo')"),'diagnostics must separate sender from receiver and on-screen frames');
check(!macVideo.includes("stack.textContent='';"),'native share video may not rebuild the whole filmstrip');
check(macVideo.includes('stack.insertBefore(tile,position||null)'),'native video tiles must preserve existing media elements by participant ID');
check(!macVideo.includes("lastSignature='';renderParticipants(true);\n  }\n  q('#videoViewSpeaker')"),'repeated native state updates cannot force full remounts');
check(native.includes('width:880,height:92'),'native annotation palette must be compact rather than 184x500');
check(annotation.includes('grid-template-rows:1fr')&&annotation.includes('repeat(5,minmax(0,1fr))'),'native annotation tools must use a single row');
check(macStyle.includes('width:176px;max-width:100%;height:99px'),'default native share companion tiles must remain 176x99');
check(macStyle.includes('grid-template-columns:repeat(2,176px);grid-auto-rows:99px'),'native companion gallery must retain exact dimensions');
check(macStyle.includes('overflow-y:hidden')&&macStyle.includes('.video-dock[data-scrollable="1"] .video-stack{overflow-y:auto}')&&macVideo.includes("dock.dataset.scrollable=list.length>5?'1':'0'"),'internal companion scrolling must begin only after five participants');
check(native.includes('width:188,height:140,minWidth:188,minHeight:140')&&native.includes("else if(videoLayout==='gallery'){width=369;"),'native video window must not override approved tile size');
check(rtc.includes('if(state.signalPull)return state.signalPull'),'signaling polling must be single-flight');
check(rtc.includes('signals.sort((a,b)=>'),'negotiation signals must be consumed in ascending ID order');
check(rtc.includes('state.lastSignalId=Math.max(state.lastSignalId,id)'),'accepted signal cursor must advance incrementally');
check(rtc.includes('if(!state.running||state.generation!==generation)return'),'stale room signaling results must be ignored');
check(rtc.includes('if(state.snapshotPull)return state.snapshotPull'),'participant reconciliation must be single-flight');
check(browserBridge.includes("relayFailure=/401|403|jwt|auth|access/.test(reason)"),'direct ICE fallback must record sanitized TURN authentication failures');
check(rtc.includes("surface:desktop?.isBrowserMeet?'web':'desktop'")&&rtc.includes('relayFailure:state.relayFailure'),'browser and desktop diagnostics must distinguish relay failure');
console.log('PASS 35 architecture-cleanup source invariants — NOT a two-device video or release acceptance result');
