import fs from 'node:fs';
import assert from 'node:assert/strict';

const read=rel=>fs.readFileSync(new URL(`../${rel}`,import.meta.url),'utf8');
const bootstrap=read('ui/runtime-bootstrap.js');
const auth=read('ui/auth-password.js');
const runtimeCss=read('ui/runtime-stability.css');
const referenceCss=read('ui/zoom-screenshot-reference-2.0.41.css');
const js=read('ui/zoom-production-polish.js');

assert(bootstrap.includes("./zoom-production-polish.js")&&!bootstrap.includes("./zoom-production-polish.css"),'Desktop startup must keep the chat helper without loading the retired Production Polish stylesheet.');
assert(!auth.includes('zoom-production-polish'),'Authentication must not load production meeting polish.');
assert(js.includes("version:'2.0.54-chat-helper'"),'Production Polish must be reduced to the chat-only compatibility helper.');
assert(!js.includes('participantPriority')&&!js.includes('popOutParticipantPanel')&&!js.includes('zoom-participant-search'),'Chat helper must not retain Participants ownership.');
assert(js.includes('function ensureChatChrome()')&&js.includes("more.setAttribute('aria-label','Chat options')"),'Chat helper must expose the Chat options control.');
assert(js.includes("select.dispatchEvent(new Event('change',{bubbles:true}))"),'Chat policy menu must drive the real policy select.');
assert(js.includes("if(/^host\\s+tools$/i.test")&&js.includes('button.remove()'),'More cleanup must remove duplicate Host Tools entries.');
assert(js.includes('window.DominionRuntimeStability?.layoutSideSurface?.()'),'Chat geometry must be delegated to the canonical runtime.');
assert(runtimeCss.includes('.ds-runtime-toolbar-left')&&runtimeCss.includes('.ds-runtime-toolbar-center')&&runtimeCss.includes('.ds-runtime-toolbar-right'),'Canonical runtime stylesheet must own toolbar zones.');
assert(referenceCss.includes('#meetingOverlay .meeting-control .ds-control-label')&&referenceCss.includes('#meetingOverlay #roomExitButton'),'Final reference stylesheet must own readable control labels and End-meeting styling.');
assert(referenceCss.includes('#meetingOverlay .room-side')&&referenceCss.includes('#meetingOverlay #participantRoster'),'Final reference stylesheet must own participant-panel visual scale.');
assert(!js.includes('setInterval(')&&!js.includes('MutationObserver'),'Chat helper must remain event-driven with no background reconciliation.');

console.log('DOMINIONSTAR_ZOOM_PRODUCTION_POLISH_OK chat-only-helper canonical-runtime-geometry no-retired-css no-participant-authority no-background-reconciliation');
