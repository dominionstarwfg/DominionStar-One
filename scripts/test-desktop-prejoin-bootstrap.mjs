import assert from 'node:assert/strict';
import fs from 'node:fs';

const flow = fs.readFileSync(new URL('../assets/js/meet/hotfix-rc13-1-media-prejoin.js', import.meta.url), 'utf8');
const html = fs.readFileSync(new URL('../meet/index.html', import.meta.url), 'utf8');
const home = fs.readFileSync(new URL('../meet-home/index.html', import.meta.url), 'utf8');
const desktopMain = fs.readFileSync(new URL('../desktop 2/src/main-v2.mjs', import.meta.url), 'utf8');

const must = (source, needle, message) => assert(source.includes(needle), message);
const mustNot = (source, needle, message) => assert(!source.includes(needle), message);

must(desktopMain, "const MEET_HOME_URL = `${APP_ORIGIN}/meet-home/?desktop=1`;", 'Desktop app no longer launches the certified Meet Home route.');
must(home, "new URLSearchParams({desktop:desktop?'1':'0',action})", 'Meet Home no longer carries the desktop action contract.');
must(flow, "const bootstrapParams = new URLSearchParams(location.search);", 'Desktop prejoin bootstrap does not inspect launch parameters.');
must(flow, "desktopMode && (bootstrapAction === 'new' || bootstrapAction === 'share')", 'Desktop prejoin bootstrap does not cover New Meeting and Share Screen.');
must(flow, "enterHostPrejoin({autoShare:bootstrapAction === 'share'});", 'Desktop launch intent is not converted into host prejoin.');
must(flow, "window.__DS_DESKTOP_PREJOIN_BOOTSTRAP = 'single-owner-host-prejoin-v1';", 'Single-owner desktop prejoin runtime marker is missing.');
must(flow, "history.replaceState(null, '', `${location.pathname}?room=${roomId}&host=1", 'Host prejoin does not consume the auto-start action from the URL.');

// Keep the deployed file cache-addressable while the flow implementation itself
// is certified by release hash. Electron loads hosted assets with no-cache.
must(html, '/assets/js/meet/hotfix-rc13-1-media-prejoin.js?v=4-camera-privacy-reacquire', 'Meet HTML no longer loads the certified prejoin flow asset.');

must(flow, "heading.textContent = 'Ready to start?'", 'Host prejoin heading is missing.');
must(flow, "label.textContent = 'Start Meeting'", 'Host prejoin does not require explicit Start Meeting confirmation.');
must(flow, 'await sleep(220);', 'Host preview-to-meeting hardware handoff interval changed unexpectedly.');
must(flow, 'stopTracks(hostPreviewStream);', 'Desktop host prejoin does not release its preview before meeting entry.');
must(flow, 'await ensureNativeMediaPermissions(constraints);', 'Host preview camera/microphone acquisition bypasses native macOS permission state.');
must(flow, "await replaceHostTrack('audio',preferredDevice('microphone'));", 'Mic On cannot acquire a missing microphone track.');

// The retired architecture wrapped every getUserMedia call and fought the base
// meeting runtime. That is now a release-blocking regression.
mustNot(flow, 'navigator.mediaDevices.getUserMedia =', 'Prejoin flow reintroduced a global getUserMedia wrapper.');
mustNot(flow, '__dsLocalDeviceRouting', 'Prejoin flow reintroduced the legacy media-routing wrapper marker.');
must(flow, "window.__DS_MEET_MEDIA_PREJOIN_HOTFIX = 'retired-global-wrapper-single-owner-flow-v1';", 'Retired-wrapper architecture marker is missing.');

console.log('DOMINIONSTAR_DESKTOP_PREJOIN_BOOTSTRAP_OK single-owner scoped host preview');
