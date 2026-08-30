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
  'Verify packaged reaction duration parity',
  'Verify packaged 2.0.19 physical Mac repairs',
  'Verify packaged Zoom Participants and video-panel behavior',
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
assert.ok(workflow.includes('node scripts/verify-reaction-parity.mjs'),'Reaction timing source audit is mandatory.');
assert.ok(workflow.includes('node scripts/verify-physical-mac-2.0.19.mjs'),'Physical-Mac repair source audit is mandatory.');
assert.ok(workflow.includes('node scripts/verify-zoom-window-parity.mjs'),'Zoom window behavior source audit is mandatory.');
assert.ok(workflow.includes('node scripts/verify-packaged-interactions.mjs'),'Packaged interaction audit is mandatory.');
assert.ok(workflow.includes('node scripts/verify-packaged-zoom-visual.mjs'),'Rendered Zoom-parity audit is mandatory.');
assert.ok(workflow.includes('node scripts/verify-packaged-physical-acceptance.mjs'),'Packaged physical acceptance audit is mandatory.');
assert.ok(workflow.includes('node scripts/verify-packaged-reaction-parity.mjs'),'Packaged 10-second reaction parity audit is mandatory.');
assert.ok(workflow.includes('node scripts/verify-packaged-physical-mac-2.0.19.mjs'),'Packaged physical-Mac screenshot-derived audit is mandatory.');
assert.ok(workflow.includes('node scripts/verify-packaged-zoom-window-parity.mjs'),'Packaged Zoom Participants/Pop Out/video-panel audit is mandatory.');
assert.ok(workflow.indexOf('Exercise packaged physical acceptance')<workflow.indexOf('Verify packaged reaction duration parity'),'Reaction timing must be verified after the general physical-acceptance gate.');
assert.ok(workflow.indexOf('Verify packaged reaction duration parity')<workflow.indexOf('Verify packaged 2.0.19 physical Mac repairs'),'Physical repairs must be checked after reaction parity.');
assert.ok(workflow.indexOf('Verify packaged 2.0.19 physical Mac repairs')<workflow.indexOf('Verify packaged Zoom Participants and video-panel behavior'),'Zoom window parity must run after the carried-forward physical-Mac repair gate.');
assert.ok(workflow.indexOf('Verify packaged Zoom Participants and video-panel behavior')<workflow.indexOf('Create installable DMG, archive, and checksums'),'Installer creation must remain behind Zoom window parity.');
assert.ok(workflow.indexOf('Verify installer layout and installed app identity')<workflow.indexOf('Upload production artifact'),'Artifact upload must remain behind installer verification.');
assert.ok(workflow.includes("VERSION=\"$(node -p \"require('./meet-desktop/package.json').version\")\""),'Workflow must derive the candidate version from package.json.');
assert.ok(workflow.includes('steps.meta.outputs.version'),'Workflow must reuse the resolved package version across release steps.');
assert.ok(workflow.includes("CFBundleShortVersionString' \"$PLIST\" | grep -Fx \"${{ steps.meta.outputs.version }}\""),'Bundle version verification must use the resolved package version.');
assert.ok(workflow.includes('DominionStar-Meet-${{ steps.meta.outputs.version }}-Mac-Installer.dmg'),'DMG naming must use the resolved package version.');
assert.ok(workflow.includes('dominionstar-meet-${{ steps.meta.outputs.version }}-mac-production'),'Artifact naming must use the resolved package version.');
assert.ok(workflow.includes('tcc_persistence=not-certified-adhoc'),'Ad-hoc production provenance must explicitly state that privacy-permission persistence is not certified.');
assert.ok(/Zoom desktop behavior is the primary UX reference/i.test(standard),'Release standard must preserve Zoom as the primary meeting UX reference.');
assert.ok(/Physical-Mac acceptance feedback is a first-class release input/i.test(standard),'Release standard must preserve physical Mac failures as first-class release evidence.');
assert.ok(/Do not create or upload the installer if any prior gate fails/i.test(standard),'Release standard must prohibit publishing failed candidates.');

console.log(`DOMINIONSTAR_RELEASE_STANDARD_OK version=${pkg.version} dynamic-version clean-source source-cert packaged-audit packaged-launch packaged-controls zoom-render-gate physical-acceptance reaction-10s-gate physical-mac-repair zoom-window-parity tcc-provenance installer-verify upload-last`);
