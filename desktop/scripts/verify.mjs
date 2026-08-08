import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const required = ['package.json', 'src/main.mjs', 'src/preload.mjs', 'src/offline.html', 'src/launcher.html', 'src/entitlements.mac.plist'];
const missing = required.filter((file) => !fs.existsSync(path.join(root, file)));
if (missing.length) throw new Error(`Missing desktop files: ${missing.join(', ')}`);

const main = fs.readFileSync(path.join(root, 'src/main.mjs'), 'utf8');
for (const safeguard of ['contextIsolation: true', 'nodeIntegration: false', 'sandbox: true', 'setPermissionRequestHandler', 'setWindowOpenHandler']) {
  if (!main.includes(safeguard)) throw new Error(`Missing safeguard: ${safeguard}`);
}
if (!main.includes('setDisplayMediaRequestHandler')) throw new Error('Missing native screen-sharing bridge');
if (!main.includes("ipcMain.handle('desktop:share-sources'")) throw new Error('Missing desktop share source picker');
if (!main.includes("ipcMain.on('desktop:home'")) throw new Error('Missing persistent Meet Home navigation');
if (!main.includes("ipcMain.handle('desktop:remote-input'")) throw new Error('Missing native remote-control input bridge');
if (!main.includes('isTrustedAccessibilityClient')) throw new Error('Missing macOS Accessibility consent gate');
if (!main.includes("'/meet-home/'")) throw new Error('Missing dedicated Meet Home route');
if (!main.includes("createWindow(deepLink ? resolveDeepLink(deepLink) : '')")) throw new Error('Normal startup bypasses the Meet launcher');
console.log('DominionStar Desktop verification passed.');
