import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const packageJson = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const workflow = fs.readFileSync(path.join(root, '..', '.github', 'workflows', 'desktop-build.yml'), 'utf8');

const fail = (message) => {
  console.error(`PUBLISHER_TRUST_POLICY_FAIL ${message}`);
  process.exit(61);
};

if (packageJson?.build?.mac?.notarize !== true) fail('mac.notarize must be true');
if (packageJson?.build?.mac?.hardenedRuntime !== true) fail('mac.hardenedRuntime must be true');

const requiredMarkers = [
  'Verify Windows publisher credentials',
  'WIN_CSC_LINK',
  'WIN_CSC_KEY_PASSWORD',
  'Verify Windows Authenticode signature',
  'Verify macOS publisher credentials',
  'MAC_CSC_LINK',
  'MAC_CSC_KEY_PASSWORD',
  'APPLE_API_KEY',
  'APPLE_API_KEY_ID',
  'APPLE_API_ISSUER',
  'APPLE_TEAM_ID',
  'Verify Developer ID signature and notarization',
  'xcrun stapler validate',
  'spctl --assess',
  'Production PKG intentionally excluded until Developer ID Installer signing is certified'
];

for (const marker of requiredMarkers) {
  if (!workflow.includes(marker)) fail(`desktop-build.yml missing marker: ${marker}`);
}

if (workflow.includes('desktop 2/dist/*.pkg')) {
  fail('internal unsigned PKG must not be uploaded as a production release artifact');
}

console.log('DOMINIONSTAR_PUBLISHER_TRUST_POLICY_OK');
