import assert from 'node:assert/strict';
import fs from 'node:fs';

const hotfix = fs.readFileSync(new URL('../assets/js/meet/hotfix-rc13-1-media-prejoin.js', import.meta.url), 'utf8');
const html = fs.readFileSync(new URL('../meet/index.html', import.meta.url), 'utf8');
const home = fs.readFileSync(new URL('../meet-home/index.html', import.meta.url), 'utf8');
const desktopMain = fs.readFileSync(new URL('../desktop 2/src/main-v2.mjs', import.meta.url), 'utf8');

const must = (source, needle, message) => assert(source.includes(needle), message);

// The installed app launches Meet Home and New Meeting still arrives through the
// explicit desktop action contract. The hosted bootstrap must consume that intent
// before Executive 6's window-load auto-start path can submit the room.
must(desktopMain, "const MEET_HOME_URL = `${APP_ORIGIN}/meet-home/?desktop=1`;", 'Desktop app no longer launches the certified Meet Home route.');
must(home, "new URLSearchParams({desktop:desktop?'1':'0',action})", 'Meet Home no longer carries the desktop action contract.');
must(hotfix, "const bootstrapParams = new URLSearchParams(location.search);", 'Desktop prejoin bootstrap does not inspect launch parameters.');
must(hotfix, "bootstrapParams.get('desktop') === '1'", 'Desktop prejoin bootstrap is not scoped to the installed app.');
must(hotfix, "bootstrapAction === 'new' || bootstrapAction === 'share'", 'Desktop prejoin bootstrap does not cover New Meeting and Share Screen.');
must(hotfix, "enterHostPrejoin({autoShare:bootstrapAction === 'share'});", 'Desktop launch intent is not converted into host prejoin.');
must(hotfix, "window.__DS_DESKTOP_PREJOIN_BOOTSTRAP = 'rc13.1-desktop-prejoin-v2';", 'Desktop prejoin runtime marker is missing.');
must(hotfix, "history.replaceState(null, '', `${location.pathname}?room=${roomId}&host=1", 'Host prejoin does not consume the auto-start action from the URL.');

// Cache key must change whenever bootstrap behavior changes because Electron uses
// a persistent partition. A valid fix must not require users to hard-refresh.
must(html, '/assets/js/meet/hotfix-rc13-1-media-prejoin.js?v=4-camera-privacy-reacquire', 'Meet HTML does not force the desktop prejoin bootstrap asset refresh.');

// The host checkpoint itself must remain explicit and must release preview media
// before the actual meeting engine acquires the camera.
must(hotfix, "heading.textContent = 'Ready to start?'", 'Host prejoin heading is missing.');
must(hotfix, "label.textContent = 'Start Meeting'", 'Host prejoin does not require explicit Start Meeting confirmation.');
must(hotfix, "await sleep(1100);", 'Preview-to-meeting camera release grace period is missing.');
must(hotfix, "stopHotfixPreview({all:true});", 'Desktop prejoin does not release owned preview media before meeting entry.');

console.log('DOMINIONSTAR_DESKTOP_PREJOIN_BOOTSTRAP_OK');
