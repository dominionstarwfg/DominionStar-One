import fs from 'node:fs';
import assert from 'node:assert/strict';

const read = rel => fs.readFileSync(new URL(`../../${rel}`, import.meta.url), 'utf8');
const compositor = read('assets/js/meet/video-intelligence-compositor.js');
const quality = read('assets/js/meet/video-quality-parity.js');
const bootstrap = read('assets/js/meet/operation-2030-bootstrap.js');
const quick = read('assets/js/meet/quick-device-menu-parity.js');

assert(!compositor.includes('getUserMedia('), 'Video intelligence must never become a second camera acquisition owner.');
assert(compositor.includes('FaceDetector.createFromOptions') && compositor.includes("runningMode: 'VIDEO'"), 'Auto-framing must use real on-device subject detection.');
assert(compositor.includes("processing:'on-device'") || compositor.includes("processing: 'on-device'"), 'Video intelligence must explicitly remain on-device.');
assert(compositor.includes('smooth(session.subject.cx') && compositor.includes('cropForSubject'), 'Auto-framing must smooth subject movement and crop the outgoing frame.');
assert(compositor.includes("brightness(.80) saturate(.96)") && compositor.includes("brightness(1.18) saturate(1.04)"), 'Portrait Lighting must dim the surrounding scene and brighten the subject region in the outgoing canvas.');
assert(compositor.includes('outputTrack.__dsVideoIntelligence = true'), 'Processed output must be tagged to prevent recursive re-processing.');
assert(compositor.includes('outputTrack.__dsPhysicalSourceTrack = sourceTrack') && compositor.includes('getSourceTrack:'), 'Video intelligence must preserve a live path back to the physical camera.');
assert(compositor.includes('upstreamStartMedia') && compositor.includes('existingStream:processed'), 'Processed frames must publish through the meeting engine media boundary.');

// Real-device performance contract: effects must not monopolize the meeting UI.
assert(compositor.includes('const OUTPUT_FPS = 24'), 'Processed video output must be capped below the UI refresh rate.');
assert(compositor.includes('BASE_DETECTION_INTERVAL_MS = 400'), 'Face detection must be throttled rather than running at 10 FPS on the meeting thread.');
assert(compositor.includes('MAX_DETECTION_INTERVAL_MS = 1200'), 'Auto-framing must have adaptive detection backoff for slower Macs.');
assert(compositor.includes('MAX_OUTPUT_WIDTH = 1280') && compositor.includes('MAX_OUTPUT_HEIGHT = 720'), 'Video intelligence must cap processing resolution to 720p during QA.');
assert(compositor.includes('session.detectionMs > 120') && compositor.includes('session.detectionIntervalMs = Math.min'), 'Slow face detection must automatically reduce its own workload.');
assert(compositor.includes("input.setAttribute('role', 'switch')"), 'Advanced video toggles must expose switch semantics.');
assert(compositor.includes('data-ds-modern-setting-switches'), 'Advanced video settings must use modern sliding switch treatment.');

assert(quality.indexOf('DominionVideoIntelligenceCompositor?.getSourceTrack?.()') < quality.indexOf('DominionBackgroundEffects2030?.getSourceTrack?.()'), 'Low Light must resolve the physical camera through Video Intelligence before Background Effects.');
assert(quality.includes('__dsPhysicalSourceTrack'), 'Low Light must unwrap a processed track when a physical camera reference is available.');
assert(bootstrap.includes('video-intelligence-compositor.js') && bootstrap.includes('data-ds-video-intelligence-compositor'), 'Certified bootstrap must load the video-intelligence compositor.');
assert(bootstrap.indexOf('video-intelligence-compositor.js') < bootstrap.indexOf('background-effects-2030.js'), 'Video intelligence must run before background segmentation in the media pipeline.');
assert(quick.includes("$('portraitLightingToggle')") && quick.includes("$('autoFramingToggle')"), 'Camera quick menu must expose the real Portrait Lighting and Auto-framing controls.');
assert(quick.includes('Keep me centered') && quick.includes('On-device subject lighting'), 'Quick-menu copy must describe real video-intelligence outcomes.');
assert(quick.includes('ds-quick-switch') && !quick.includes("${checked?'✓ ':''}"), 'Quick video menu must use switch UI rather than checkmarks.');

console.log('Video intelligence compositor guardrails passed.');
