import { app, session, systemPreferences } from 'electron';

const DESKTOP_PARTITION = 'persist:dominionstar-meet';
const CERTIFICATION_URLS = [
  'https://dominionstarld.com/assets/js/runtime/guardian-certification.js*',
  'https://www.dominionstarld.com/assets/js/runtime/guardian-certification.js*'
];

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

// The signed native application is authoritative for desktop compatibility.
// Guardian remains useful for observation/recovery, but a mutable hosted
// certification script must never lock a valid installed build out of Meet.
const desktopSession = session.fromPartition(DESKTOP_PARTITION);
desktopSession.webRequest.onBeforeRequest(
  { urls: CERTIFICATION_URLS },
  (_details, callback) => callback({ cancel: true })
);

// Match the proven macOS startup behavior: ask once when each permission is
// still undetermined and otherwise respect the user's existing OS decision.
await requestMacMediaAccess();

await import('./main.mjs');
