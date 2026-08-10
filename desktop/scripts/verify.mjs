import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const required = ['package.json', 'src/main.mjs', 'src/preload.cjs', 'src/capture-source.mjs', 'src/capture-session.mjs', 'src/offline.html', 'src/launcher.html', 'src/entitlements.mac.plist'];
const missing = required.filter((file) => !fs.existsSync(path.join(root, file)));
if (missing.length) throw new Error(`Missing desktop files: ${missing.join(', ')}`);

const main = fs.readFileSync(path.join(root, 'src/main.mjs'), 'utf8');
for (const safeguard of ['contextIsolation: true', 'nodeIntegration: false', 'sandbox: true', 'setPermissionRequestHandler', 'setWindowOpenHandler']) {
  if (!main.includes(safeguard)) throw new Error(`Missing safeguard: ${safeguard}`);
}
if (!main.includes('setDisplayMediaRequestHandler')) throw new Error('Missing native screen-sharing bridge');
if (!main.includes("ipcMain.handle('desktop:share-sources'")) throw new Error('Missing desktop share source picker');
if (!main.includes("ipcMain.on('desktop:home'")) throw new Error('Missing persistent Meet Home navigation');
if (!main.includes("ipcMain.on('desktop:account-chooser'")) throw new Error('Missing signed-out account chooser navigation');
if (!main.includes("ipcMain.handle('desktop:runtime-info'")) throw new Error('Missing web/desktop compatibility contract');
if (!main.includes("ipcMain.handle('desktop:open-external'")) throw new Error('Missing secure system-browser OAuth bridge');
if (!main.includes("ipcMain.handle('desktop:remote-input'")) throw new Error('Missing native remote-control input bridge');
if (!main.includes('isTrustedAccessibilityClient')) throw new Error('Missing macOS Accessibility consent gate');
if (!main.includes("String(input.capability||'')!==remoteControlCapability")) throw new Error('Native remote input lacks an accepted-session capability gate');
if (!main.includes("'/meet-home'")) throw new Error('Missing dedicated Meet Home route');
if (!main.includes('resolveCaptureSource(freshSources,selection)')) throw new Error('Capture source is not re-resolved at capture time');
if (!main.includes("ipcMain.handle('desktop:capture-status'")) throw new Error('Missing native screen-permission status bridge');
if (!main.includes('captureSession.consume(contentsId)')) throw new Error('Missing atomic single-use capture selection');
if (!main.includes("captureSession.fail('source-unavailable')")) throw new Error('Missing explicit native capture failure diagnostics');
if (!main.includes('resolveCaptureSource(freshSources,selection)')) throw new Error('Native capture does not resolve the selected source at capture time');
if (!/process\.platform\s*===\s*['"]win32['"]/.test(main)) throw new Error('Missing platform-safe system-audio gate');
if (!main.includes("ipcMain.handle('desktop:end-share'")) throw new Error('Missing native share cleanup bridge');
if (!main.includes("persist:dominionstar-meet")) throw new Error('Missing persistent desktop account partition');
if (!main.includes('createWindow(deepLink ? resolveDeepLink(deepLink) : MEET_HOME_URL)')) throw new Error('Normal startup does not resume Meet Home');
if (!main.includes('BrowserWindow.getAllWindows().length === 0) createWindow(MEET_HOME_URL)')) throw new Error('macOS Dock reopen does not resume the signed-in Meet session');
if (!main.includes('else pendingDeepLink=url')) throw new Error('macOS OAuth callback can be lost before the window is ready');
if (!main.includes('consumedAuthCallback === url.hash')) throw new Error('Desktop OAuth callback is not single-use guarded');
if (!main.includes('process.defaultApp') || !main.includes("setAsDefaultProtocolClient('dominionstar'")) throw new Error('Packaged/development deep-link registration is incomplete');
const packageJson=JSON.parse(fs.readFileSync(path.join(root,'package.json'),'utf8'));
if(packageJson.version!=='1.0.2')throw new Error('Unexpected desktop package version');
if(!main.includes("preload: path.join(__dirname, 'preload.cjs')"))throw new Error('Sandboxed desktop bridge must use the CommonJS preload');
if(!main.includes('{useSystemPicker:supportsNativeSystemPicker}'))throw new Error('Missing native macOS system screen picker');
if(!packageJson.build?.mac?.extendInfo?.NSAudioCaptureUsageDescription)throw new Error('Missing macOS audio-capture privacy description');
console.log('DominionStar Desktop verification passed.');
