import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const required = ['package.json', 'src/main.mjs', 'src/preload.mjs', 'src/offline.html', 'src/entitlements.mac.plist'];
const missing = required.filter((file) => !fs.existsSync(path.join(root, file)));
if (missing.length) throw new Error(`Missing desktop files: ${missing.join(', ')}`);

const main = fs.readFileSync(path.join(root, 'src/main.mjs'), 'utf8');
for (const safeguard of ['contextIsolation: true', 'nodeIntegration: false', 'sandbox: true', 'setPermissionRequestHandler', 'setWindowOpenHandler']) {
  if (!main.includes(safeguard)) throw new Error(`Missing safeguard: ${safeguard}`);
}
console.log('DominionStar Desktop verification passed.');
