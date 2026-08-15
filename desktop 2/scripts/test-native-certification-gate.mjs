import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const main=fs.readFileSync(path.join(root,'src/main.mjs'),'utf8');

assert.ok(main.includes("guardian-certification.js"),'Desktop must explicitly neutralize the stale hosted certification script');
assert.ok(main.includes('onBeforeRequest'),'Desktop must intercept the stale hosted certification request before it executes');
assert.ok(main.includes('requestMacMediaAccess'),'macOS startup media permission flow must be restored');
assert.ok(main.includes("askForMediaAccess(mediaType)"),'macOS startup permission flow must request camera/microphone access when undetermined');
assert.ok(main.includes('await requestMacMediaAccess()'),'Startup must complete macOS permission prompting before opening Meet');

console.log('DominionStar native certification-gate regression test passed.');
