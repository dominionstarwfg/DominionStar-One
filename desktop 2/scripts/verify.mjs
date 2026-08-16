import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const required = ['package.json', 'package-lock.json', 'src/bootstrap.mjs', 'src/main.mjs', 'src/preload.cjs', 'src/presenter-preload.cjs', 'src/presenter-toolbar.html', 'src/presenter-toolbar.js', 'src/capture-source.mjs', 'src/capture-session.mjs', 'src/desktop-session.mjs', 'src/desktop-layout.mjs', 'src/desktop-updater.mjs', 'src/offline.html', 'src/launcher.html', 'src/startup.html', 'src/entitlements.mac.plist'];
const missing = required.filter((file) => !fs.existsSync(path.join(root, file)));
if (missing.length) throw new Error(`Missing desktop files: ${missing.join(', ')}`);

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
verifyLocalImports('src/bootstrap.mjs');

const packageJson=JSON.parse(fs.readFileSync(path.join(root,'package.json'),'utf8'));
const packageLock=JSON.parse(fs.readFileSync(path.join(root,'package-lock.json'),'utf8'));
const bootstrap=fs.readFileSync(path.join(root,'src/bootstrap.mjs'),'utf8');
const main = fs.readFileSync(path.join(root, 'src/main.mjs'), 'utf8');

if(packageJson.main!=='src/bootstrap.mjs')throw new Error('Native bootstrap must remain the packaged desktop entry point');
if(packageLock.version!==packageJson.version||packageLock.packages?.['']?.version!==packageJson.version)throw new Error('package-lock release metadata does not match package.json');
if(!bootstrap.includes('guardian-certification.js')||!bootstrap.includes('onBeforeRequest'))throw new Error('Native desktop certification authority gate missing');
if(bootstrap.includes('askForMediaAccess')||bootstrap.includes('requestMacMediaAccess'))throw new Error('macOS camera/microphone permission prompting must not block desktop startup');
if(!bootstrap.includes('await app.whenReady()'))throw new Error('Native bootstrap must wait for Electron readiness before handoff');
if(!bootstrap.includes("await import('./main.mjs')"))throw new Error('Native bootstrap does not hand off to production main process');

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
if (!main.includes("['win32','darwin'].includes(process.platform)")) throw new Error('Missing platform-safe system-audio gate');
if (!main.includes("ipcMain.handle('desktop:end-share'")) throw new Error('Missing native share cleanup bridge');
if (!main.includes("persist:dominionstar-meet")) throw new Error('Missing persistent desktop account partition');
if (!main.includes('createWindow(deepLink ? resolveDeepLink(deepLink) : MEET_HOME_URL)')) throw new Error('Normal startup does not resume Meet Home');
if (!main.includes('BrowserWindow.getAllWindows().length === 0) createWindow(MEET_HOME_URL)')) throw new Error('macOS Dock reopen does not resume the signed-in Meet session');
if (!main.includes('else pendingDeepLink=url')) throw new Error('macOS OAuth callback can be lost before the window is ready');
if (!main.includes('consumedAuthCallback === url.hash')) throw new Error('Desktop OAuth callback is not single-use guarded');
if (!main.includes('process.defaultApp') || !main.includes("setAsDefaultProtocolClient('dominionstar'")) throw new Error('Packaged/development deep-link registration is incomplete');

for (const specifier of externalImports) {
  if (specifier === 'electron' || specifier.startsWith('node:')) continue;
  const packageName = specifier.startsWith('@') ? specifier.split('/').slice(0, 2).join('/') : specifier.split('/')[0];
  if (!packageJson.dependencies?.[packageName]) throw new Error(`Production import is not declared in dependencies: ${specifier}`);
}
if(!/^\d+\.\d+\.\d+$/.test(packageJson.version))throw new Error(`Invalid desktop package version: ${packageJson.version}`);
if(!main.includes("preload: path.join(__dirname, 'preload.cjs')"))throw new Error('Sandboxed desktop bridge must use the CommonJS preload');
if(fs.existsSync(path.join(root,'src/preload.mjs')))throw new Error('Stale alternate preload.mjs must not ship beside the certified CommonJS preload');
const preload=fs.readFileSync(path.join(root,'src/preload.cjs'),'utf8');
if(!preload.includes(`version: '${packageJson.version}'`)||!preload.includes(`appVersion: '${packageJson.version}'`)||!preload.includes(`buildVersion: '${packageJson.version}'`))throw new Error('Desktop hosted certification identity does not match package version');
if(!preload.includes('electronVersion: process.versions.electron'))throw new Error('Desktop Electron runtime identity must remain separate');
if(!preload.includes('getRuntimeInfo: async'))throw new Error('Desktop runtime-info normalization bridge missing');
if(!main.includes('version:appVersion,appVersion,buildVersion:appVersion')||!main.includes('electronVersion:process.versions.electron'))throw new Error('Main runtime info does not expose application and Electron versions separately');
if(!main.includes('refreshHostedMeetingAssets(desktopSession,APP_ORIGIN)'))throw new Error('Desktop hosted cache refresh missing');
if(!main.includes('loadFreshPage(mainWindow, initialUrl)'))throw new Error('Initial hosted navigation does not bypass cache');
if(main.includes('requestMacMediaAccess'))throw new Error('Media permission prompting belongs to actual meeting media use, not production startup');
if(!main.includes("route==='/meet'")||!main.includes('mediaPermissions.has(permission)'))throw new Error('Meeting-only web media permission policy missing');
if(!main.includes("ipcMain.handle('desktop:window-layout'"))throw new Error('Missing adaptive native window bridge');
if(!main.includes("ipcMain.handle('desktop:update-status'"))throw new Error('Missing in-place update status bridge');
if(!packageJson.dependencies?.['electron-updater'])throw new Error('Missing desktop update client');
if(!main.includes("ipcMain.on('desktop:presenter-show'")||!main.includes('presenterWindow.setContentProtection(true)'))throw new Error('Missing protected native presenter toolbar');
if(!main.includes('mainWindow.hide()')||!main.includes('hidePresenterWindow({restoreMeeting:true})'))throw new Error('Presenter mode must hide and restore the meeting window');
if(!main.includes("ipcMain.on('desktop:presenter-resize'"))throw new Error('Missing native presenter toolbar collapse/expand bridge');
if(!main.includes('useSystemPicker:supportsMacSystemPicker()'))throw new Error('Missing macOS 15 native system-picker fallback');
if(!packageJson.build?.mac?.extendInfo?.NSAudioCaptureUsageDescription)throw new Error('Missing macOS audio-capture privacy description');

if(!main.includes('HOSTED_STARTUP_TIMEOUT_MS = 12000'))throw new Error('Hosted startup navigation is not bounded');
if(!main.includes("process.env.DOMINIONSTAR_STARTUP_PROBE"))throw new Error('Packaged startup proof hook is missing');
if(!main.includes("path.join(__dirname, 'startup.html')"))throw new Error('Native local startup shell is missing');
if(!main.includes("show: true"))throw new Error('Main desktop window must become visible before hosted navigation can stall');
if(!main.includes("'event-loop-responsive'"))throw new Error('Startup proof does not attest Electron event-loop responsiveness');

console.log('DominionStar Desktop verification passed.');
