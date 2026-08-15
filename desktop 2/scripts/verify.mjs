import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const required = ['package.json', 'src/main.mjs', 'src/preload.cjs', 'src/presenter-preload.cjs', 'src/presenter-toolbar.html', 'src/presenter-toolbar.js', 'src/capture-source.mjs', 'src/capture-session.mjs', 'src/desktop-session.mjs', 'src/desktop-layout.mjs', 'src/desktop-updater.mjs', 'src/offline.html', 'src/launcher.html', 'src/entitlements.mac.plist'];
const missing = required.filter((file) => !fs.existsSync(path.join(root, file)));
if (missing.length) throw new Error(`Missing desktop files: ${missing.join(', ')}`);

// Resolve the complete local JavaScript module graph. A release must never pass
// verification when its production entry point imports a file omitted from the ZIP.
const visited = new Set();
const externalImports = new Set();
function verifyLocalImports(file) {
  const absolute = path.resolve(root, file);
  if (visited.has(absolute)) return;
  visited.add(absolute);
  const source = fs.readFileSync(absolute, 'utf8');
  const imports = source.matchAll(/(?:import\s+(?:[^'\"]+?\s+from\s+)?|import\s*\(|require\s*\()\s*['\"](\.[^'\"]+)['\"]/g);
  for (const match of imports) {
    const candidate = path.resolve(path.dirname(absolute), match[1]);
    const resolved = [candidate, `${candidate}.mjs`, `${candidate}.js`, `${candidate}.cjs`].find((entry) => fs.existsSync(entry));
    if (!resolved) throw new Error(`Missing local module imported by ${path.relative(root, absolute)}: ${match[1]}`);
    if (/\.(?:mjs|js|cjs)$/.test(resolved)) verifyLocalImports(path.relative(root, resolved));
  }
  const bareImports = source.matchAll(/(?:import\s+(?:[^'\"]+?\s+from\s+)?|import\s*\(|require\s*\()\s*['\"]((?!\.|\/)[^'\"]+)['\"]/g);
  for (const match of bareImports) externalImports.add(match[1]);
}
verifyLocalImports('src/main.mjs');

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
if (!main.includes("ipcMain.handle('desktop:open-screen-settings'")) throw new Error('Missing macOS Screen Recording settings bridge');
if (!main.includes('visibleCaptureSources(sources')) throw new Error('Desktop picker does not filter its own windows');
if (!main.includes("captureSession.fail('own-window-blocked')")) throw new Error('Capture handler does not enforce its own-window privacy rule');
if (!main.includes('captureSession.consume(contentsId)')) throw new Error('Missing atomic single-use capture selection');
if (!main.includes("captureSession.fail('source-unavailable')")) throw new Error('Missing explicit native capture failure diagnostics');
if (!main.includes('resolveCaptureSource(freshSources,selection)')) throw new Error('Native capture does not resolve the selected source at capture time');
if (!main.includes("['win32','darwin'].includes(process.platform)")) throw new Error('Missing platform-safe system-audio gate');
if (!main.includes("ipcMain.handle('desktop:end-share'")) throw new Error('Missing native share cleanup bridge');
if (!main.includes("persist:dominionstar-meet")) throw new Error('Missing persistent desktop account partition');
if (!main.includes('createWindow(deepLink ? resolveDeepLink(deepLink) : MEET_HOME_URL)')) throw new Error('Normal startup does not resume Meet Home');
if (!main.includes('BrowserWindow.getAllWindows().length === 0) createWindow(MEET_HOME_URL)')) throw new Error('macOS Dock reopen does not resume the signed-in Meet session');
if (!main.includes('else pendingDeepLink=url')) throw new Error('macOS OAuth callback can be lost before the window is ready');
if (!main.includes('consumedAuthCallback === url.hash')) throw new Error('Desktop OAuth callback is not single-use guarded');
if (!main.includes('process.defaultApp') || !main.includes("setAsDefaultProtocolClient('dominionstar'")) throw new Error('Packaged/development deep-link registration is incomplete');
const packageJson=JSON.parse(fs.readFileSync(path.join(root,'package.json'),'utf8'));
for (const specifier of externalImports) {
  if (specifier === 'electron' || specifier.startsWith('node:')) continue;
  const packageName = specifier.startsWith('@') ? specifier.split('/').slice(0, 2).join('/') : specifier.split('/')[0];
  if (!packageJson.dependencies?.[packageName]) throw new Error(`Production import is not declared in dependencies: ${specifier}`);
}
if(packageJson.version!=='1.1.4')throw new Error('Unexpected desktop package version');
if(!main.includes("preload: path.join(__dirname, 'preload.cjs')"))throw new Error('Sandboxed desktop bridge must use the CommonJS preload');
const preload=fs.readFileSync(path.join(root,'src/preload.cjs'),'utf8');
if(!preload.includes('electronVersion: process.versions.electron'))throw new Error('Desktop Electron runtime field missing');
if(!main.includes('version:appVersion,appVersion,buildVersion:appVersion')||!main.includes('electronVersion:process.versions.electron'))throw new Error('Runtime info does not expose consistent application versions');
if(!main.includes('refreshHostedMeetingAssets(desktopSession,APP_ORIGIN)'))throw new Error('Desktop hosted cache refresh missing');
if(!main.includes('loadFreshPage(mainWindow, initialUrl)'))throw new Error('Initial hosted navigation does not bypass cache');
if(main.includes('requestMacMediaAccess'))throw new Error('Desktop must not request camera or microphone during startup');
if(!main.includes("route==='/meet'")||!main.includes('mediaPermissions.has(permission)'))throw new Error('Meeting-only media permission policy missing');
if(!main.includes("ipcMain.handle('desktop:window-layout'"))throw new Error('Missing adaptive native window bridge');
if(!main.includes("ipcMain.handle('desktop:update-status'"))throw new Error('Missing in-place update status bridge');
if(!packageJson.dependencies?.['electron-updater'])throw new Error('Missing desktop update client');
if(!main.includes("ipcMain.on('desktop:presenter-show'")||!main.includes('presenterWindow.setContentProtection(true)'))throw new Error('Missing protected native presenter toolbar');
if(!main.includes('mainWindow.hide()')||!main.includes('hidePresenterWindow({restoreMeeting:true})'))throw new Error('Presenter mode must hide and restore the meeting window');
if(!main.includes("ipcMain.on('desktop:presenter-resize'"))throw new Error('Missing native presenter toolbar collapse/expand bridge');
if(!main.includes('useSystemPicker:supportsMacSystemPicker()'))throw new Error('Missing macOS 15 native system-picker fallback');
if(!packageJson.build?.mac?.extendInfo?.NSAudioCaptureUsageDescription)throw new Error('Missing macOS audio-capture privacy description');
console.log('DominionStar Desktop verification passed.');
