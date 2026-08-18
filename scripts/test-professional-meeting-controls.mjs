import { readFile } from 'node:fs/promises';

const source = await readFile('assets/js/meet/dock-layout-v2.js', 'utf8');
const runtime = await readFile('assets/js/meet-next/executive6.js', 'utf8');
const shareView = await readFile('assets/js/meet/share-view-controls.js', 'utf8');
const meet = await readFile('meet/index.html', 'utf8');
const wrapper = await readFile('scripts/run-browser-two-client-meet-acceptance.mjs', 'utf8');

const requireText = (text, needle, message) => {
  if (!text.includes(needle)) throw new Error(message);
};

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
requireText(shareView, 'window.DominionShareViewerControls = Object.freeze', 'share-view diagnostic surface disappeared');
if (shareView.includes('engine.spotlight')) throw new Error('viewer controls must not fake share spotlight using participant-video spotlight semantics');
if (shareView.includes('Annotate')) throw new Error('viewer controls must not expose dead annotation before synchronized annotation exists');

requireText(wrapper, 'professional Audio menu omitted speaker/output selection', 'browser acceptance no longer exercises speaker/output quick selection');
requireText(wrapper, 'co-host incorrectly received host-only Waiting Room enable/disable authority', 'browser acceptance no longer enforces co-host Waiting Room boundary');
requireText(wrapper, 'normal meeting toolbar remained visible while presenting', 'browser acceptance no longer enforces presenter toolbar replacement');
requireText(wrapper, 'normal meeting toolbar did not return after screen sharing stopped', 'browser acceptance no longer enforces toolbar restoration');

console.log('DOMINIONSTAR_PROFESSIONAL_MEETING_CONTROLS_CONTRACT_OK');
console.log('DOMINIONSTAR_SHARE_VIEW_CONTROLS_GUARDRAIL_OK');
