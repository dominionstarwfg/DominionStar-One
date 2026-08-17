import { readFile } from 'node:fs/promises';

const source = await readFile('assets/js/meet/dock-layout-v2.js', 'utf8');
const runtime = await readFile('assets/js/meet-next/executive6.js', 'utf8');
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

requireText(runtime, "const privileged=state.isHost||state.role==='cohost'", 'host/co-host moderation role contract is missing');
requireText(runtime, "add('Enable Waiting Room'", 'host Waiting Room control disappeared from the primary runtime');
requireText(runtime, "add('Lock Meeting'", 'professional host security tools lost Lock Meeting');

requireText(wrapper, 'professional Audio menu omitted speaker/output selection', 'browser acceptance no longer exercises speaker/output quick selection');
requireText(wrapper, 'co-host incorrectly received host-only Waiting Room enable/disable authority', 'browser acceptance no longer enforces co-host Waiting Room boundary');
requireText(wrapper, 'normal meeting toolbar remained visible while presenting', 'browser acceptance no longer enforces presenter toolbar replacement');
requireText(wrapper, 'normal meeting toolbar did not return after screen sharing stopped', 'browser acceptance no longer enforces toolbar restoration');

console.log('DOMINIONSTAR_PROFESSIONAL_MEETING_CONTROLS_CONTRACT_OK');
