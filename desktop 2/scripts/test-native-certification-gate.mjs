import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const packageJson=JSON.parse(fs.readFileSync(path.join(root,'package.json'),'utf8'));
const bootstrap=fs.readFileSync(path.join(root,'src/bootstrap.mjs'),'utf8');

assert.equal(packageJson.main,'src/bootstrap.mjs','Desktop must enter through native bootstrap');
assert.ok(bootstrap.includes("guardian-certification.js"),'Desktop must explicitly neutralize the stale hosted certification script');
assert.ok(bootstrap.includes('onBeforeRequest'),'Desktop must intercept the stale hosted certification request before it executes');
assert.ok(bootstrap.includes('requestMacMediaAccess'),'macOS startup media permission flow must be restored');
assert.ok(bootstrap.includes("askForMediaAccess(mediaType)"),'macOS startup permission flow must request camera/microphone access when undetermined');
assert.ok(bootstrap.includes('await requestMacMediaAccess()'),'Startup must complete macOS permission prompting before opening Meet');
assert.ok(bootstrap.includes("await import('./main.mjs')"),'Bootstrap must hand off to the existing production application');

console.log('DominionStar native certification-gate regression test passed.');
