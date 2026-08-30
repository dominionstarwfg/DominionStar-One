import fs from 'node:fs';
import assert from 'node:assert/strict';

const workflow=fs.readFileSync(new URL('../../.github/workflows/rebuild-mac-production.yml',import.meta.url),'utf8');
const pkg=JSON.parse(fs.readFileSync(new URL('../package.json',import.meta.url),'utf8'));
const standard=fs.readFileSync(new URL('../RELEASE_STANDARD.md',import.meta.url),'utf8');

const requiredSteps=[
  'Clean generated state',
  'Resolve package version',
  'Verify production visual polish',
  'Run complete production certification',
  'Build universal production app',
  'Verify package identity privacy and signature',
  'Audit packaged production app',
  'Launch packaged app',
  'Exercise packaged desktop controls',
  'Measure packaged Zoom-scale interface',
  'Exercise packaged physical acceptance',
  'Create installable DMG, archive, and checksums',
  'Verify installer layout and installed app identity',
  'Upload production artifact'
];

let previous=-1;
for(const name of requiredSteps){
  const index=workflow.indexOf(`- name: ${name}`);
  assert.ok(index>=0,`Release workflow is missing mandatory gate: ${name}`);
  assert.ok(index>previous,`Release gate is out of order: ${name}`);
  previous=index;
}

assert.ok(workflow.includes('node scripts/verify-physical-acceptance.mjs'),'Physical acceptance source audit is mandatory.');
assert.ok(workflow.includes('node scripts/verify-packaged-interactions.mjs'),'Packaged interaction audit is mandatory.');
assert.ok(workflow.includes('node scripts/verify-packaged-zoom-visual.mjs'),'Rendered Zoom-parity audit is mandatory.');
assert.ok(workflow.includes('node scripts/verify-packaged-physical-acceptance.mjs'),'Packaged physical acceptance audit is mandatory.');
assert.ok(workflow.indexOf('Exercise packaged physical acceptance')<workflow.indexOf('Create installable DMG, archive, and checksums'),'Installer creation must remain behind the physical acceptance gate.');
assert.ok(workflow.indexOf('Verify installer layout and installed app identity')<workflow.indexOf('Upload production artifact'),'Artifact upload must remain behind installer verification.');
assert.ok(workflow.includes("VERSION=\"$(node -p \"require('./meet-desktop/package.json').version\")\""),'Workflow must derive the candidate version from package.json.');
assert.ok(workflow.includes('steps.meta.outputs.version'),'Workflow must reuse the resolved package version across release steps.');
assert.ok(workflow.includes("CFBundleShortVersionString' \"$PLIST\" | grep -Fx \"${{ steps.meta.outputs.version }}\""),'Bundle version verification must use the resolved package version.');
assert.ok(workflow.includes('DominionStar-Meet-${{ steps.meta.outputs.version }}-Mac-Installer.dmg'),'DMG naming must use the resolved package version.');
assert.ok(workflow.includes('dominionstar-meet-${{ steps.meta.outputs.version }}-mac-production'),'Artifact naming must use the resolved package version.');
assert.ok(/Zoom desktop behavior is the primary UX reference/i.test(standard),'Release standard must preserve Zoom as the primary meeting UX reference.');
assert.ok(/Physical-Mac acceptance feedback is a first-class release input/i.test(standard),'Release standard must preserve physical Mac failures as first-class release evidence.');
assert.ok(/Do not create or upload the installer if any prior gate fails/i.test(standard),'Release standard must prohibit publishing failed candidates.');

console.log(`DOMINIONSTAR_RELEASE_STANDARD_OK version=${pkg.version} dynamic-version clean-source source-cert packaged-audit packaged-launch packaged-controls zoom-render-gate physical-acceptance installer-verify upload-last`);
