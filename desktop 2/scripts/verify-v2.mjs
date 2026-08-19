import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const required = [
  'package.json',
  'src/bootstrap.mjs',
  'src/main-v2.mjs',
  'src/preload.cjs',
  'src/startup-v2.html',
  'src/offline.html',
  'src/capture-source.mjs',
  'src/capture-session.mjs',
  'src/desktop-layout.mjs',
  'src/desktop-session.mjs',
  'src/desktop-updater.mjs',
  'src/presenter-preload.cjs',
  'src/presenter-toolbar.html',
  'src/presenter-toolbar.js',
  'src/entitlements.mac.plist'
];

const missing = required.filter(file => !fs.existsSync(path.join(root, file)));
if (missing.length) throw new Error(`Missing clean-runtime files: ${missing.join(', ')}`);

const pkg = JSON.parse(read('package.json'));
const bootstrap = read('src/bootstrap.mjs');
const main = read('src/main-v2.mjs');
const preload = read('src/preload.cjs');
const desktopSession = read('src/desktop-session.mjs');
const startup = read('src/startup-v2.html');

if (pkg.main !== 'src/bootstrap.mjs') throw new Error('Production entry point must include the deterministic lifecycle bootstrap');
if (!/^\d+\.\d+\.\d+$/.test(pkg.version)) throw new Error('Desktop package version is invalid');

for (const marker of [
  "await import('./main-v2.mjs')",
  "app.on('before-quit'",
  'BrowserWindow.getAllWindows()',
  "role: 'quit'",
  "accelerator: 'Command+Q'",
  'setImmediate(ensureMacQuitCommand)'
]) {
  if (!bootstrap.includes(marker)) throw new Error(`Desktop quit lifecycle safeguard missing: ${marker}`);
}

const sandboxIndex = main.indexOf('app.enableSandbox();');
const readyIndex = main.indexOf('app.whenReady()');
if (sandboxIndex < 0 || readyIndex < 0 || sandboxIndex > readyIndex) {
  throw new Error('Global renderer sandbox must be enabled before the app ready lifecycle');
}

for (const marker of [
  "writeStartupProbe('entry-loaded')",
  "writeStartupProbe('app-ready')",
  "writeStartupProbe('window-created')",
  "writeStartupProbe('local-shell-shown')",
  "writeStartupProbe('event-loop-responsive')",
  "show: true",
  "loadFile(path.join(__dirname, 'startup-v2.html'))",
  'HOSTED_NAVIGATION_TIMEOUT_MS = 12000',
  'session.fromPartition(DESKTOP_PARTITION)',
  'installCertificationInterception(desktopSession)',
  'setPermissionRequestHandler',
  'setDisplayMediaRequestHandler',
  "ipcMain.handle('desktop:runtime-info'",
  "ipcMain.handle('desktop:media-permissions'",
  "ipcMain.handle('desktop:request-media-permissions'",
  "systemPreferences.askForMediaAccess(kind)",
  "ipcMain.handle('desktop:share-sources'",
  "ipcMain.handle('desktop:remote-input'",
  "ipcMain.on('desktop:presenter-show'",
  'contextIsolation: true',
  'nodeIntegration: false',
  'sandbox: true',
  'webSecurity: true'
]) {
  if (!main.includes(marker)) throw new Error(`Clean runtime safeguard missing: ${marker}`);
}

if (/^import .*desktop-updater/m.test(main)) {
  throw new Error('electron-updater must be lazy-loaded after responsive native startup');
}
if (!main.includes("import('./desktop-updater.mjs')")) {
  throw new Error('Lazy updater import is missing');
}
if (!main.includes("const MEMBER_LOGIN_URL = `${APP_ORIGIN}/member-login/?desktop=1`;")) {
  throw new Error('Current member login route is not canonical');
}
if (!main.includes("if (url.startsWith('file:') || isDominionStarUrl(url)) return;")) {
  throw new Error('Trusted same-origin navigation policy is missing');
}
if (main.includes('shell.openExternal(target.toString());\n        loadFreshPage')) {
  throw new Error('Authenticated same-origin redirects must not be externalized');
}

for (const marker of [
  "guardian-*.js*",
  "storages: ['serviceworkers', 'cachestorage']",
  'desktopSession.clearCache()',
  'preparedSessions',
  'hosted-runtime-refresh-timeout',
  'await refreshHostedMeetingAssets(window.webContents.session, target.origin)'
]) {
  if (!desktopSession.includes(marker)) throw new Error(`Hosted runtime authority safeguard missing: ${marker}`);
}

for (const marker of [
  `const RELEASE_VERSION = '${pkg.version}'`,
  'native-authoritative',
  'certified: true',
  'blocking: false',
  'blocked: false',
  "contextBridge.exposeInMainWorld('DominionGuardianCertification'",
  "contextBridge.exposeInMainWorld('dominionDesktop'",
  'electronVersion: process.versions.electron',
  'bridgeVersion: BRIDGE_VERSION',
  'getMediaPermissions:',
  'requestMediaPermissions:'
]) {
  if (!preload.includes(marker)) throw new Error(`Desktop bridge/certification marker missing: ${marker}`);
}

if (!startup.includes('Content-Security-Policy')) throw new Error('Local startup shell must define a CSP');
if (!startup.includes('DominionStar Meet')) throw new Error('Local startup shell branding is missing');

const productionImports = [...main.matchAll(/from ['\"]([^'\"]+)['\"]/g)]
  .map(match => match[1])
  .filter(specifier => !specifier.startsWith('.') && specifier !== 'electron' && !specifier.startsWith('node:'));
if (productionImports.length) {
  throw new Error(`Unexpected eager production dependency import(s): ${productionImports.join(', ')}`);
}

console.log('DominionStar clean-runtime + hosted-authority + deterministic quit verification passed.');
