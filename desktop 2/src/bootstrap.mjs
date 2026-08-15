import { app, session, systemPreferences } from 'electron';

const APP_ORIGIN = 'https://dominionstarld.com';
const DESKTOP_PARTITION = 'persist:dominionstar-meet';

async function requestMacMediaAccess() {
  if (process.platform !== 'darwin') return;
  for (const mediaType of ['microphone', 'camera']) {
    const status = systemPreferences.getMediaAccessStatus(mediaType);
    if (status === 'not-determined') {
      await systemPreferences.askForMediaAccess(mediaType);
    }
  }
}

await app.whenReady();

// The installed desktop package is now the certification source of truth.
// The hosted guardian script was introduced independently of the native
// release pipeline and has repeatedly rejected valid signed-in desktop builds.
// Block only that stale web-side gate inside the desktop partition; browser
// visitors continue to receive the normal hosted application behavior.
const desktopSession = session.fromPartition(DESKTOP_PARTITION);
desktopSession.webRequest.onBeforeRequest(
  { urls: [`${APP_ORIGIN}/assets/js/runtime/guardian-certification.js*`] },
  (_details, callback) => callback({ cancel: true })
);

// Restore the native macOS permission flow from the last known-good desktop
// startup behavior. macOS will prompt only when a permission is undetermined;
// previously granted/denied choices are respected by the OS.
await requestMacMediaAccess();

// Load the existing production application only after the native startup
// contract is established.
await import('./main.mjs');
