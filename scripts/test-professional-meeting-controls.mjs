import { readFile } from 'node:fs/promises';

const source = await readFile('assets/js/meet/dock-layout-v2.js', 'utf8');
const runtime = await readFile('assets/js/meet-next/executive6.js', 'utf8');
const shareView = await readFile('assets/js/meet/share-view-controls.js', 'utf8');
const annotation = await readFile('assets/js/meet/share-annotation.js', 'utf8');
const shareSpotlight = await readFile('assets/js/meet/share-spotlight.js', 'utf8');
const presentationHandoff = await readFile('assets/js/meet/presentation-handoff.js', 'utf8');
const remoteControl = await readFile('assets/js/meet/remote-control.js', 'utf8');
const meet = await readFile('meet/index.html', 'utf8');
const wrapper = await readFile('scripts/run-browser-two-client-meet-acceptance.mjs', 'utf8');

const requireText = (text, needle, message) => {
  if (!text.includes(needle)) throw new Error(message);
};

new Function(shareView);
new Function(annotation);
new Function(shareSpotlight);
new Function(presentationHandoff);
new Function(remoteControl);
await import('./test-share-spotlight-two-client.mjs');
await import('./test-presentation-handoff.mjs');

requireText(source, "appendDeviceSection('Microphone'", 'professional Audio menu no longer exposes microphone selection');
requireText(source, "appendDeviceSection('Speaker'", 'professional Audio menu no longer exposes speaker/output selection');
requireText(source, "settings.textContent='Audio Settings…'", 'professional Audio menu no longer exposes full audio settings');
requireText(source, "micMenuBtn.setAttribute('aria-label','Audio options')", 'Audio quick-control accessibility contract regressed');
requireText(source, "waitingRoomToggleLabel", 'host-only Waiting Room boundary is missing');
requireText(source, "if(!deviceMenu||isLocalHost())return", 'co-host Waiting Room UI boundary is missing');
requireText(source, "event.stopImmediatePropagation()", 'co-host Waiting Room click boundary is missing');

requireText(source, "navigator.mediaDevices?.addEventListener?.('devicechange',scheduleDeviceRefresh)", 'device selectors no longer refresh when hardware changes');
requireText(source, "refreshProfessionalDevices({retries:3})", 'device enumeration retry contract is missing');
requireText(source, "settingsObserver", 'Audio & Video Settings no longer refreshes device enumeration when opened');
requireText(source, "setFallbackOption(cameraSelect,'Camera unavailable')", 'camera selector can regress to a blank failure state');
requireText(source, "setFallbackOption(microphoneSelect,'Microphone unavailable')", 'microphone selector can regress to a blank failure state');
requireText(source, "setFallbackOption(speakerSelect,'System Default Speaker')", 'speaker selector can regress to a blank failure state');
requireText(source, "systemDefault.textContent='System Default Speaker'", 'speaker selector lost its explicit system-default output');
requireText(source, "device.label||`${fallback} ${index+1}`", 'unnamed media devices no longer receive readable fallback labels');

requireText(runtime, "const privileged=state.isHost||state.role==='cohost'", 'host/co-host moderation role contract is missing');
requireText(runtime, "add('Enable Waiting Room'", 'host Waiting Room control disappeared from the primary runtime');
requireText(runtime, "add('Lock Meeting'", 'professional host security tools lost Lock Meeting');

requireText(meet, '/assets/js/meet/share-view-controls.js?v=1-operation-2030', 'Meet no longer loads the Operation 2030 share-view controls');
requireText(shareView, 'const originalOpen = button.onclick', 'viewer controls must extend the trusted existing share menu');
requireText(shareView, 'originalOpen.call(button, event)', 'trusted share-menu authority must execute before viewer enhancements');
requireText(shareView, "controls.append(makeAction(`Fit to window (${fitPercent()}%)`", 'Fit-to-window viewer control disappeared');
requireText(shareView, '[50, 100, 150, 200, 300]', 'viewer zoom ladder regressed');
requireText(shareView, "percent === 100 ? ' (Original size)'", 'viewer Original size label disappeared');
requireText(shareView, 'requestFullscreen', 'viewer Enter fullscreen behavior disappeared');
requireText(shareView, 'exitFullscreen', 'viewer Exit fullscreen behavior disappeared');
requireText(shareView, 'filmstrip.hidden = !filmstrip.hidden', 'viewer hide/show video-panel behavior disappeared');
requireText(shareView, '/assets/js/meet/share-annotation.js?v=1-operation-2030', 'share viewer controls no longer load synchronized annotation');
requireText(shareView, '/assets/js/meet/share-spotlight.js?v=1-operation-2030', 'share viewer controls no longer load room-synchronized shared-content spotlight');
requireText(shareView, '/assets/js/meet/presentation-handoff.js?v=1-operation-2030', 'share viewer controls no longer load presentation handoff coordination');
requireText(shareView, 'prewarmAnnotationSurface', 'annotation render surface is no longer prewarmed for every active share');
requireText(shareView, 'const positionAnnotationToolbar = () =>', 'viewer annotation controls no longer avoid the normal meeting toolbar');
requireText(shareView, 'occupiedHeight + 18', 'viewer annotation controls lost their measured toolbar clearance');
requireText(shareView, "window.addEventListener('resize'", 'viewer annotation clearance no longer adapts when the meeting window resizes');
requireText(shareView, 'window.DominionShareViewerControls = Object.freeze', 'share-view diagnostic surface disappeared');
if (shareView.includes('engine.spotlight')) throw new Error('viewer controls must not fake share spotlight using participant-video spotlight semantics');

requireText(annotation, "addMenuAction(body,'Annotate',openAnnotation)", 'real Annotate action disappeared from the shared-screen menu');
requireText(annotation, 'dominionstar-meet-annotation-${snap.roomId}', 'annotation lost its isolated room-scoped realtime channel');
requireText(annotation, "event:'meet-annotation'", 'annotation broadcast event disappeared');
requireText(annotation, 'member.admitted === false', 'annotation no longer rejects non-admitted remote senders');
requireText(annotation, "member.role === 'cohost'", 'co-host Clear All validation disappeared');
requireText(annotation, 'MAX_STROKES = 220', 'annotation bounded stroke-history guardrail disappeared');
requireText(annotation, 'MAX_POINTS_PER_STROKE = 1200', 'annotation bounded point-history guardrail disappeared');
requireText(annotation, 'POINT_SEND_INTERVAL_MS = 28', 'annotation pointer-traffic throttle disappeared');
requireText(annotation, 'clamp01((x-rect.left)/Math.max(1,rect.width))', 'annotation normalized X coordinate contract disappeared');
requireText(annotation, 'clamp01((y-rect.top)/Math.max(1,rect.height))', 'annotation normalized Y coordinate contract disappeared');
requireText(annotation, "addTool('Pen','pen')", 'annotation Pen tool disappeared');
requireText(annotation, "addTool('Highlighter','highlighter')", 'annotation Highlighter tool disappeared');
requireText(annotation, "addTool('Laser','laser')", 'annotation Laser pointer disappeared');
requireText(annotation, "engine.on?.('screen-ended'", 'annotation no longer clears when screen sharing ends');
requireText(annotation, 'window.DominionShareAnnotation = Object.freeze', 'annotation diagnostic surface disappeared');

requireText(shareSpotlight, 'dominionstar-meet-share-spotlight-${snap.roomId}', 'share spotlight lost its isolated room-scoped realtime channel');
requireText(shareSpotlight, "event:'share-spotlight'", 'share spotlight broadcast event disappeared');
requireText(shareSpotlight, "member.role === 'cohost'", 'co-host shared-content spotlight authority disappeared');
requireText(shareSpotlight, 'member.admitted === false', 'share spotlight no longer rejects non-admitted remote senders');
requireText(shareSpotlight, "item.textContent = active ? 'Remove share spotlight' : 'Spotlight this share'", 'shared-content spotlight menu control disappeared');
requireText(shareSpotlight, "document.body.dataset.shareSpotlightParticipantId", 'shared-content spotlight no longer exposes synchronized content state');
requireText(shareSpotlight, "engine.on?.('screen-state'", 'shared-content spotlight no longer follows remote share lifecycle');
requireText(shareSpotlight, "engine.on?.('screen-ended'", 'shared-content spotlight no longer clears when sharing ends');
requireText(shareSpotlight, "window.addEventListener('dominion:presentation-handoff'", 'shared-content spotlight no longer clears stale spotlight state on presenter handoff');
requireText(shareSpotlight, 'window.DominionShareSpotlight = Object.freeze', 'shared-content spotlight diagnostic surface disappeared');
if (shareSpotlight.includes('engine.spotlight')) throw new Error('shared-content spotlight must remain separate from participant-video spotlight');

requireText(presentationHandoff, "window.dispatchEvent(new CustomEvent('dominion:presentation-handoff'", 'presentation handoff event contract disappeared');
requireText(presentationHandoff, 'document.body.dataset.presentationEpoch', 'presentation handoff no longer exposes monotonic epoch state');
requireText(presentationHandoff, "if (previous) await resetPresentationTools(detail)", 'presenter ownership changes no longer reset stale tools');
requireText(presentationHandoff, "annotation?.close?.()", 'presentation handoff no longer closes stale annotation mode');
requireText(presentationHandoff, "await annotation?.clear?.()", 'host/co-host handoff no longer clears stale annotation state');
requireText(presentationHandoff, "resetForPresenterChange", 'presentation handoff no longer resets remote control');
requireText(presentationHandoff, "engine.on?.('screen-state'", 'presentation handoff no longer follows remote presenter changes');
requireText(presentationHandoff, "engine.on?.('screen-stream'", 'presentation handoff no longer follows local presenter start');
requireText(presentationHandoff, "engine.on?.('screen-ended'", 'presentation handoff no longer follows local presenter end');

requireText(remoteControl, 'resetForPresenterChange', 'remote control no longer exposes deterministic presenter-handoff cleanup');
requireText(remoteControl, "engine.on('screen-ended'", 'presenter-side remote control no longer clears on local share end');
requireText(remoteControl, "window.addEventListener('dominion:presentation-handoff'", 'remote control no longer resets on presentation epoch changes');
requireText(remoteControl, "pendingRequest=null", 'remote-control pending requests can survive presenter handoff');
requireText(remoteControl, "clearRemoteControlPermission", 'desktop Accessibility permission cleanup disappeared from remote-control handoff');

requireText(wrapper, 'professional Audio menu omitted speaker/output selection', 'browser acceptance no longer exercises speaker/output quick selection');
requireText(wrapper, 'co-host incorrectly received host-only Waiting Room enable/disable authority', 'browser acceptance no longer enforces co-host Waiting Room boundary');
requireText(wrapper, 'normal meeting toolbar remained visible while presenting', 'browser acceptance no longer enforces presenter toolbar replacement');
requireText(wrapper, "'ds-supabase-realtime-'", 'browser acceptance no longer emulates the isolated annotation Realtime channel');
requireText(wrapper, "kind: 'presence-request'", 'browser annotation acceptance no longer reconciles late presence before authority checks');
requireText(wrapper, 'synchronized annotation rendered across two admitted clients', 'browser acceptance no longer proves cross-client annotation rendering');
requireText(wrapper, 'host Clear All synchronized across the shared screen', 'browser acceptance no longer proves privileged Clear All synchronization');
requireText(wrapper, 'normal meeting toolbar did not return after screen sharing stopped', 'browser acceptance no longer enforces toolbar restoration');

console.log('DOMINIONSTAR_PROFESSIONAL_MEETING_CONTROLS_CONTRACT_OK');
console.log('DOMINIONSTAR_SHARE_VIEW_CONTROLS_GUARDRAIL_OK');
console.log('DOMINIONSTAR_SYNCHRONIZED_ANNOTATION_GUARDRAIL_OK');
console.log('DOMINIONSTAR_SHARED_CONTENT_SPOTLIGHT_GUARDRAIL_OK');
console.log('DOMINIONSTAR_PRESENTATION_HANDOFF_GUARDRAIL_OK');
