import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';

const root=fileURLToPath(new URL('..',import.meta.url));
const uiDir=path.join(root,'ui');
const pkg=JSON.parse(fs.readFileSync(path.join(root,'package.json'),'utf8'));
const bootstrap=fs.readFileSync(path.join(uiDir,'runtime-bootstrap.js'),'utf8');

const files=fs.readdirSync(uiDir).sort();
const forbidden=[
  /zoom-adaptive-parity/i,
  /rejected-build-repair/i,
  /physical-mac-repair/i,
  /participant-panel-stability/i,
  /runtime-layout-fix/i,
  /final-physical-repair/i,
  /physical-rejection-repair/i
];
const stale=files.filter(file=>forbidden.some(rule=>rule.test(file)));
assert.deepEqual(stale,[],'Obsolete repair/adaptive runtime files must not exist in ui/.');

const allowedBootstrapScripts=[
  './runtime-stability.js',
  './zoom-production-polish.js',
  './zoom-physical-acceptance.js',
  './zoom-reaction-parity.js',
  './zoom-contract-bridge.js',
  './presenter-command-parity-2.0.27.js',
  './physical-intelligence-2.0.41.js',
  './approved-reference-parity.js',
  './zoom-screenshot-reference-2.0.41.js',
  './zoom-participants-reference-2.0.41.js'
];
const loaded=[...bootstrap.matchAll(/loadScript\('([^']+)'/g)].map(match=>match[1]).sort();
assert.deepEqual(loaded,[...allowedBootstrapScripts].sort(),'runtime-bootstrap.js contains an unexpected desktop compatibility layer.');

const allowedBootstrapStyles=[
  './runtime-stability.css',
  './runtime-motion.css',
  './zoom-screenshot-reference-2.0.41.css',
  './executive-home-2.0.41.css',
  './executive-prejoin-2.0.41.css'
];
const styleLiteralBlock=bootstrap.slice(bootstrap.indexOf('const styles=['),bootstrap.indexOf('];',bootstrap.indexOf('const styles=['))+2);
const styles=[...styleLiteralBlock.matchAll(/\['([^']+\.css)'/g)].map(match=>match[1]).sort();
assert.deepEqual(styles,[...allowedBootstrapStyles].sort(),'runtime-bootstrap.js contains an unexpected desktop compatibility stylesheet.');

assert(!bootstrap.includes('zoom-adaptive-parity'),'Deleted adaptive parity layer must not be referenced by runtime bootstrap.');
assert(!fs.readFileSync(path.join(uiDir,'runtime-stability.js'),'utf8').includes('DominionZoomAdaptiveParity'),'Canonical runtime must not retain a reference to the deleted adaptive controller.');

const buildFiles=Array.isArray(pkg.build?.files)?pkg.build.files:[];
assert.deepEqual(buildFiles,['src/**/*','ui/**/*','package.json'],'Production package must contain runtime source only; tests, audit docs, and repository history stay outside the app bundle.');

const verify=String(pkg.scripts?.verify||'');
assert(verify.includes('verify-clean-runtime-2.0.54.mjs'),'The clean-runtime gate must certify itself through npm verify.');

console.log('DOMINIONSTAR_CLEAN_RUNTIME_2_0_54_OK no-obsolete-repair-files minimal-bootstrap runtime-only-package single-certification-entrypoint');
