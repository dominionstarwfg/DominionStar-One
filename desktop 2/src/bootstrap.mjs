import { app, session } from 'electron';

const DESKTOP_PARTITION = 'persist:dominionstar-meet';
const CERTIFICATION_URLS = [
  'https://dominionstarld.com/assets/js/runtime/guardian-certification.js*',
  'https://www.dominionstarld.com/assets/js/runtime/guardian-certification.js*'
];

await app.whenReady();

// The signed native application is authoritative for desktop compatibility.
// Guardian remains useful for observation/recovery, but a mutable hosted
// certification script must never lock a valid installed build out of Meet.
const desktopSession = session.fromPartition(DESKTOP_PARTITION);
desktopSession.webRequest.onBeforeRequest(
  { urls: CERTIFICATION_URLS },
  (_details, callback) => callback({ cancel: true })
);

// Startup must never wait on TCC camera/microphone decisions. Media consent is
// requested by the meeting renderer only when the user enters a meeting and
// actually asks to use camera or microphone.
await import('./main.mjs');
