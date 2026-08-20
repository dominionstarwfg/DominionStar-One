import fs from 'node:fs';
import assert from 'node:assert/strict';

const read = rel => fs.readFileSync(new URL(`../../${rel}`, import.meta.url), 'utf8');
const compositor = read('assets/js/meet/video-intelligence-compositor.js');
const bootstrap = read('assets/js/meet/operation-2030-bootstrap.js');
const quick = read('assets/js/meet/quick-device-menu-parity.js');

assert(!compositor.includes('getUserMedia('), 'Video intelligence must never become a second camera acquisition owner.');
assert(compositor.includes('FaceDetector.createFromOptions') && compositor.includes('runningMode: \'VIDEO\''), 'Auto-framing must use real on-device subject detection.');
assert(compositor.includes('processing: \'on-device\''), 'Video intelligence must explicitly remain on-device.');
assert(compositor.includes('smooth(session.subject.cx') && compositor.includes('cropForSubject'), 'Auto-framing must smooth subject movement and crop the outgoing frame.');
assert(compositor.includes("brightness(.80) saturate(.96)") && compositor.includes("brightness(1.18) saturate(1.04)"), 'Portrait Lighting must dim the surrounding scene and brighten the subject region in the outgoing canvas.');
assert(compositor.includes('outputTrack.__dsVideoIntelligence = true'), 'Processed output must be tagged to prevent recursive re-processing.');
assert(compositor.includes('upstreamStartMedia') && compositor.includes('existingStream: processed'), 'Processed frames must publish through the meeting engine media boundary.');
assert(bootstrap.includes('video-intelligence-compositor.js') && bootstrap.includes('data-ds-video-intelligence-compositor'), 'Certified bootstrap must load the video-intelligence compositor.');
assert(bootstrap.indexOf('video-intelligence-compositor.js') < bootstrap.indexOf('background-effects-2030.js'), 'Video intelligence must run before background segmentation in the media pipeline.');
assert(quick.includes("$('portraitLightingToggle')") && quick.includes("$('autoFramingToggle')"), 'Camera quick menu must expose the real Portrait Lighting and Auto-framing controls.');
assert(quick.includes('Keep me centered') && quick.includes('On-device subject lighting'), 'Quick-menu copy must describe real video-intelligence outcomes.');

console.log('Video intelligence compositor guardrails passed.');
