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
  'Verify packaged physical runtime stability',
  'Exercise packaged desktop controls',
  'Measure packaged Zoom-scale interface',
  'Exercise packaged physical acceptance',
  'Verify packaged reaction duration parity',
  'Verify packaged high-volume reaction flow',
  'Verify packaged 2.0.21 physical Mac repairs',
  'Verify packaged adaptive Zoom meeting behavior',
  'Verify packaged approved 3D reference parity',
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
assert.ok(workflow.includes('node scripts/verify-reaction-parity.mjs'),'Reaction timing/source-flow audit is mandatory.');
assert.ok(workflow.includes('node scripts/verify-physical-mac-2.0.21.mjs'),'2.0.21 physical-Mac source audit is mandatory.');
assert.ok(workflow.includes('node scripts/verify-zoom-window-parity.mjs'),'Adaptive Zoom window behavior source audit is mandatory.');
assert.ok(workflow.includes('node scripts/verify-physical-parity-2.0.21.mjs'),'Physical-reference source audit is mandatory.');
assert.ok(workflow.includes('node scripts/verify-approved-reference-parity-2.0.22.mjs'),'Approved 3D-reference source audit is mandatory.');
assert.ok(workflow.includes('node scripts/verify-runtime-stability-2.0.22.mjs'),'Physical runtime stability source audit is mandatory.');
assert.ok(workflow.includes('node scripts/verify-packaged-runtime-stability-2.0.22.mjs'),'Packaged freeze/responsive-layout audit is mandatory.');
assert.ok(workflow.includes('node scripts/verify-packaged-interactions.mjs'),'Packaged interaction audit is mandatory.');
assert.ok(workflow.includes('node scripts/verify-packaged-zoom-visual.mjs'),'Rendered Zoom-parity audit is mandatory.');
assert.ok(workflow.includes('node scripts/verify-packaged-physical-acceptance.mjs'),'Packaged physical acceptance audit is mandatory.');
assert.ok(workflow.includes('node scripts/verify-packaged-reaction-parity.mjs'),'Packaged 10-second reaction parity audit is mandatory.');
assert.ok(workflow.includes('node scripts/verify-packaged-reaction-flow-2.0.22.mjs'),'Packaged left-lane/high-volume/blossom reaction audit is mandatory.');
assert.ok(workflow.includes('node scripts/verify-packaged-physical-mac-2.0.21.mjs'),'Packaged 2.0.21 physical-Mac audit is mandatory.');
assert.ok(workflow.includes('node scripts/verify-packaged-zoom-window-parity.mjs'),'Packaged adaptive Participants/Chat/prejoin/video-panel audit is mandatory.');
assert.ok(workflow.includes('node scripts/verify-packaged-approved-reference-2.0.22.mjs'),'Packaged approved 3D-reference audit is mandatory.');
assert.ok(workflow.indexOf('Verify packaged physical runtime stability')<workflow.indexOf('Exercise packaged desktop controls'),'Freeze/responsive-runtime acceptance must run before general interaction checks.');
assert.ok(workflow.indexOf('Exercise packaged physical acceptance')<workflow.indexOf('Verify packaged reaction duration parity'),'Reaction timing must be verified after the general physical-acceptance gate.');
assert.ok(workflow.indexOf('Verify packaged reaction duration parity')<workflow.indexOf('Verify packaged high-volume reaction flow'),'High-volume reaction flow must run after the base 10-second reaction lifetime gate.');
assert.ok(workflow.indexOf('Verify packaged high-volume reaction flow')<workflow.indexOf('Verify packaged 2.0.21 physical Mac repairs'),'Physical Mac repairs must remain behind the reaction-flow gate.');
assert.ok(workflow.indexOf('Verify packaged 2.0.21 physical Mac repairs')<workflow.indexOf('Verify packaged adaptive Zoom meeting behavior'),'Adaptive Zoom physical-reference parity must run after the carried-forward physical-Mac constraints.');
assert.ok(workflow.indexOf('Verify packaged adaptive Zoom meeting behavior')<workflow.indexOf('Verify packaged approved 3D reference parity'),'Approved 3D reference must be verified after adaptive Zoom behavior.');
assert.ok(workflow.indexOf('Verify packaged approved 3D reference parity')<workflow.indexOf('Create installable DMG, archive, and checksums'),'Installer creation must remain behind approved 3D-reference parity.');
assert.ok(workflow.indexOf('Verify installer layout and installed app identity')<workflow.indexOf('Upload production artifact'),'Artifact upload must remain behind installer verification.');
assert.ok(workflow.includes("VERSION=\"$(node -p \"require('./meet-desktop/package.json').version\")\""),'Workflow must derive the candidate version from package.json.');
assert.ok(workflow.includes('steps.meta.outputs.version'),'Workflow must reuse the resolved package version across release steps.');
assert.ok(workflow.includes("CFBundleShortVersionString' \"$PLIST\" | grep -Fx \"${{ steps.meta.outputs.version }}\""),'Bundle version verification must use the resolved package version.');
assert.ok(workflow.includes('DominionStar-Meet-${{ steps.meta.outputs.version }}-Mac-Installer.dmg'),'DMG naming must use the resolved package version.');
assert.ok(workflow.includes('dominionstar-meet-${{ steps.meta.outputs.version }}-mac-production'),'Artifact naming must use the resolved package version.');
assert.ok(workflow.includes('tcc_persistence=not-certified-adhoc'),'Ad-hoc production provenance must explicitly state that privacy-permission persistence is not certified.');
assert.ok(workflow.includes('native_share_picker=macos-15-plus'),'Production provenance must identify the native macOS system-picker authority.');
assert.ok(workflow.includes('reference_gate=approved-2.0.22'),'Production provenance must identify the approved 2.0.22 reference gate.');
assert.ok(workflow.includes('runtime_stability_gate=physical-freeze-full-window-panels'),'Production provenance must identify the physical runtime stability gate.');
assert.ok(workflow.includes('reaction_flow_gate=left-lanes-blossoms-bounded'),'Production provenance must identify the reaction-flow gate.');
assert.ok(/Zoom desktop behavior is the primary UX reference/i.test(standard),'Release standard must preserve Zoom as the primary meeting UX reference.');
assert.ok(/approved DominionStar Meet 3D illustration is a first-class visual reference/i.test(standard),'Release standard must require side-by-side approved 3D-reference review.');
assert.ok(/Security labels must be technically true/i.test(standard),'Release standard must prohibit unverified E2EE labeling.');
assert.ok(/Physical-Mac acceptance feedback is a first-class release input/i.test(standard),'Release standard must preserve physical Mac failures as first-class release evidence.');
assert.ok(/Do not create or upload the installer if any prior gate fails/i.test(standard),'Release standard must prohibit publishing failed candidates.');

console.log(`DOMINIONSTAR_RELEASE_STANDARD_OK version=${pkg.version} dynamic-version clean-source source-cert packaged-audit packaged-launch runtime-stability packaged-controls zoom-render-gate physical-acceptance reaction-10s-gate reaction-flow-gate physical-mac-2.0.21 adaptive-zoom-gate approved-3d-reference-gate native-system-picker tcc-provenance installer-verify upload-last`);