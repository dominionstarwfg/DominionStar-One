import fs from 'node:fs';
import assert from 'node:assert/strict';

const read=rel=>fs.readFileSync(new URL('../'+rel,import.meta.url),'utf8');
const participantRef=read('ui/zoom-participants-reference-2.0.41.js');
const participantControls=read('ui/participant-controls.js');
const adaptive=read('ui/zoom-adaptive-parity.js');
const adaptiveCss=read('ui/zoom-adaptive-parity.css');
const activeShareHome=read('ui/active-share-home-parity-2.0.41.js');
const productionPolish=read('ui/zoom-production-polish.js');
const approvedReference=read('ui/approved-reference-parity.js');
const physicalAcceptance=read('ui/zoom-physical-acceptance.js');
const runtime=read('ui/runtime-stability.js');
const shareIntegration=read('ui/share-integration.js');
const macVideo=read('ui/mac-share-video.js');
const macPresenter=read('src/mac-share-presenter-overlay.mjs');
const presenterToolbar=read('ui/mac-presenter-toolbar.html');
const presenterToolbarJs=read('ui/mac-presenter-toolbar.js');
const presenterParity=read('ui/presenter-command-parity-2.0.27.js');
const preload=read('src/preload.cjs');
const pkg=JSON.parse(read('package.json'));
const appSource=read('ui/app.js');
const shareService=read('src/share-service.mjs');
const macOverlay=read('src/mac-share-presenter-overlay.mjs');
const captions=read('ui/meeting-captions.js');
const featureReady=read('ui/meeting-feature-ready-2.0.41.js');
const workflow=fs.readFileSync(new URL('../../.github/workflows/rebuild-mac-production.yml',import.meta.url),'utf8');

// Participants: one search/structure owner. The canonical input deliberately
// does not carry the legacy class that historical CSS used to hide.
assert(appSource.includes('class="ds-participant-search-wrap"')&&appSource.includes('class="ds-participant-search-primary"'),'Base meeting DOM must contain the canonical Participants search before the panel can become visible.');
assert(participantRef.includes("wrap.dataset.dsParticipantSearchBound!=='1'"),'Participant reference must bind the base search exactly once instead of recreating it.');
assert(participantRef.includes('class="ds-participant-search-primary"'),'Canonical Participants search input is missing.');
assert(!participantRef.includes('class="zoom-participant-search ds-participant-search-primary"'),'Canonical Participants search must not inherit the legacy zoom-participant-search class.');
assert(participantRef.includes('const backgroundEnabled=!Boolean(window.dominionDesktop);'),'Participants reference must be manual/event-driven on desktop.');
assert(participantRef.includes('if(backgroundEnabled){'),'Participants reference desktop background guard is missing.');
assert(!adaptiveCss.includes('[data-ds-adaptive-count="1"] .zoom-participant-search'),'Adaptive CSS must never hide search for one-person meetings.');
assert(!adaptive.includes('search.hidden=count<=1'),'Adaptive JS must never hide the participant search for one-person meetings.');
assert(runtime.includes('Participants search has one owner: DominionZoomParticipantsReference2041.'),'Runtime must explicitly defer participant-search ownership.');
assert(participantControls.includes('const timer=desktopSurface?0:setInterval'),'Participant controls must not run a six-second desktop reconciliation timer.');

// Legacy parity layers may remain callable for a deliberate one-shot pass, but
// they may not autonomously reconcile desktop meeting surfaces.
assert(adaptive.includes('const desktopCanonical=Boolean(window.dominionDesktop);'),'Adaptive desktop authority guard is missing.');
assert(adaptive.includes('if(desktopCanonical)return;'),'Adaptive desktop sync must stop before participant/chat/video-dock mutation.');
assert(adaptive.includes('if(!desktopCanonical){')&&adaptive.includes('timer=setInterval(sync,650);'),'Adaptive background observer/timer must be non-desktop only.');
assert(activeShareHome.includes('const desktopCanonical=Boolean(desktop?.isDesktop);')&&activeShareHome.includes('if(!desktopCanonical){'),'Active-share helper must be event-driven on desktop.');
assert(productionPolish.includes('const backgroundEnabled=!Boolean(window.dominionDesktop);')&&productionPolish.includes('if(backgroundEnabled){'),'Production polish must not autonomously reconcile desktop chrome.');
assert(approvedReference.includes('const backgroundEnabled=!Boolean(window.dominionDesktop);')&&approvedReference.includes('if(backgroundEnabled){'),'Approved reference compatibility layer must not poll desktop chrome.');
assert(physicalAcceptance.includes('const desktopCanonical=Boolean(desktop?.isDesktop);'),'Physical acceptance desktop guard is missing.');
assert(physicalAcceptance.includes('const timer=desktopCanonical?0:setInterval'),'Physical acceptance must not run its 700ms desktop timer.');
assert(physicalAcceptance.includes("window.removeEventListener('dominion:meeting-signal',onMeetingSignal,true)"),'Physical acceptance dispose must actually remove its desktop event listeners.');

// Presenter video: exactly one camera owner and approved participant-count rule.
assert(!macVideo.includes('getUserMedia'),'Native presenter video must never acquire a second camera.');
assert(macVideo.includes('realParticipants=out.filter(item=>item.participantId!==\'local-self\')'),'Presenter video must remove synthetic self when a real participant exists.');
assert(macPresenter.includes("function shouldShowVideoWindow(){return videoLayout!=='hide'&&presenterParticipantCount()>=2;}"),'Mac presenter filmstrip must be hidden for one participant and start at two.');
assert(shareIntegration.includes('presenterParticipants().length<2){stopMacRemoteFramePump();return;}'),'Presenter frame pump must stop when fewer than two participants exist.');
assert(shareIntegration.includes('setInterval(publishMacRemoteFrames,180)'),'Presenter frame pump cadence must remain bounded.');
assert(shareIntegration.includes('localImageCapture=new ImageCapture(localTrack)'),'Local presenter video must mirror the already-owned camera track.');
assert(!shareIntegration.includes('navigator.mediaDevices.getUserMedia'),'Share integration must not open another camera.');

// Presenter controls must match the approved compact sharing guide.
for(const required of ['data-command="audio"','data-command="video"','data-command="pause"','data-command="participants"','data-command="chat"','id="moreButton"','id="stopShare"'])assert(presenterToolbar.includes(required),`Approved presenter toolbar is missing ${required}`);
for(const forbidden of ['id="layoutButton"','data-command="show-meeting"','data-command="new-share"','id="brandLogo"'])assert(!presenterToolbar.includes(forbidden),`Presenter toolbar reintroduced non-approved top-level control: ${forbidden}`);
const declaredPresenterCommands=[...presenterToolbar.matchAll(/data-command="([^"]+)"/g)].map(match=>match[1]).sort();
assert.deepEqual(declaredPresenterCommands,['annotate','audio','chat','layout-gallery','layout-hide','layout-speaker','participants','pause','record','video'],'Presenter toolbar command inventory drifted from the approved compact surface.');
for(const command of ['audio','video','pause','participants','chat','annotate','layout-speaker','layout-gallery','layout-hide','record']){
  const routed=command==='audio'?shareIntegration.includes("command==='audio'||command==='audio-on'||command==='audio-off'")
    :command==='video'?shareIntegration.includes("command==='video'||command==='video-on'||command==='video-off'")
    :command==='pause'?shareIntegration.includes("command==='pause'||command==='pause-share'||command==='resume-share'")
    :shareIntegration.includes(`command==='${command}'`);
  assert(routed,`Presenter command has no renderer execution path: ${command}`);
}
assert(presenterToolbarJs.includes("await send('stop')"),'Stop Share must have a real acknowledged presenter execution path.');
assert(presenterToolbar.includes('<button type="button" data-command="pause"')&&presenterToolbar.indexOf('data-command="pause"')<presenterToolbar.indexOf('data-command="participants"'),'Pause Share must remain before Participants in the approved toolbar.');
assert(presenterToolbar.indexOf('data-command="chat"')<presenterToolbar.indexOf('id="moreButton"')&&presenterToolbar.indexOf('id="moreButton"')<presenterToolbar.indexOf('id="stopShare"'),'Approved presenter toolbar order changed.');

// A visual button change is not success: media state must confirm the command.
assert(shareIntegration.includes("error:'pause_state_not_reached'"),'Pause/Resume must fail closed when the requested share state is not reached.');
assert(shareIntegration.includes("error:'camera_state_not_reached'"),'Video on/off must fail closed when the requested camera state is not reached.');
assert(presenterToolbarJs.includes('presenter_command_not_acknowledged')&&presenterToolbarJs.includes('result.ok!==false'),'Presenter toolbar must reject negative acknowledgements even when transport delivery itself was acknowledged.');

// No permanent high-frequency fallback loops in presenter command infrastructure.
assert(!presenterParity.includes('setInterval('),'Presenter command compatibility install must use bounded retries, not polling intervals.');
assert(preload.includes('const PRESENTER_FALLBACK_POLL_MS=250;'),'Presenter fallback IPC poll must remain explicitly bounded.');
assert(!preload.includes('setInterval(()=>{void pollPresenterCommand();},80)'),'80ms presenter fallback polling is prohibited.');

// macOS screenshots must include presenter surfaces; self-capture exclusion must
// not rely on content-protection blackouts.
assert(shareService.includes("const protect=platform==='darwin'?false:Boolean(enabled);"),'macOS meeting/presenter windows must not use content protection that blanks screenshots.');
assert(macOverlay.includes('function allowSystemCapture(win)')&&macOverlay.includes('win.setContentProtection(false)'),'Native presenter surfaces must explicitly remain capturable by macOS screenshots.');
assert(macOverlay.includes('function presenterRetrySafe(command)')&&macOverlay.includes("presenter_direct_timeout_no_retry"),'Native presenter delivery must distinguish retry-safe target-state commands from non-idempotent actions.');
assert(macOverlay.includes("if(result?.ok||!presenterRetrySafe(command))return result;"),'Non-idempotent presenter queue delivery must never be retried automatically.');
assert(shareService.includes('try{main.setIgnoreMouseEvents(false);}catch{}')&&shareService.includes('protectMeetingChrome(main,false)'),'Share teardown must restore normal main-window interaction and capture state.');

// Meeting end must deterministically release every long-lived runtime owner.
assert(appSource.includes("window.DominionWebRTCController?.stop?.()"),'Meeting end must explicitly stop WebRTC instead of waiting for lifecycle polling.');
assert(appSource.includes('media.stop();')&&appSource.includes('await stopMeetingPresentation();'),'Meeting end must release local media and active presentation state.');
assert(appSource.includes("desktop?.app?.meetingEnded?.()"),'Renderer meeting-end flow must invoke native teardown.');
assert(shareService.includes('function shutdown()')&&shareService.includes("globalThis.__dominionMacSharePresenterOverlay?.destroy?.()"),'Native meeting-end teardown must destroy presenter windows.');
assert(captions.includes("window.addEventListener('dominion:meeting-ended',resetMeetingState)"),'Caption state must reset immediately when a meeting ends.');
assert(!captions.includes('setInterval(()=>{if(inMeeting())'),'Captions must not rely on periodic UI cleanup after meeting end.');
assert(featureReady.includes("version:'2.0.53-retiring-legacy-executive'")&&featureReady.includes('function retireLegacyWatchers()'),'Legacy meeting chrome must expose deterministic retirement.');
assert(featureReady.includes('retireLegacyWatchers();')&&featureReady.includes("window.removeEventListener('dominion:meeting-snapshot',schedule)"),'Legacy meeting chrome observers/listeners must retire after final-reference handoff.');

// The authority contract is itself a mandatory release gate.
assert(pkg.scripts?.verify?.includes('verify-ui-authority-contract-2.0.53.mjs'),'npm verify must include the UI authority contract.');
assert(workflow.includes('node scripts/verify-ui-authority-contract-2.0.53.mjs'),'Production workflow must execute the UI authority contract before packaging.');

console.log('DOMINIONSTAR_UI_AUTHORITY_CONTRACT_2_0_53_OK single-search-owner manual-desktop-legacy-layers no-one-person-filmstrip single-camera-owner bounded-frame-pump approved-presenter-toolbar state-ack-controls bounded-presenter-fallback release-gated');
