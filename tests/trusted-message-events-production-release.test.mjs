import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const flags=readFileSync(new URL('../assets/js/notification-feature-flags.js',import.meta.url),'utf8');
const gate=readFileSync(new URL('../scripts/check-agent-release-gates.mjs',import.meta.url),'utf8');

test('trusted database-authored message events are enabled for the post-cutover release',()=>{
  assert.match(flags,/trustedMessageEvents\s*:\s*true\b/);
  assert.doesNotMatch(flags,/trustedMessageEvents\s*:\s*false\b/);
});

test('closed-browser Web Push remains disabled',()=>{
  assert.match(flags,/webPush\s*:\s*false\b/);
  assert.doesNotMatch(flags,/webPush\s*:\s*true\b/);
});

test('release guard enforces trusted events ON and Web Push OFF',()=>{
  assert.ok(gate.includes('Trusted message-event notifications are not enabled'));
  assert.ok(gate.includes('Closed-browser Web Push enabled before its separate production release'));
  assert.ok(gate.includes('trusted message events ON, Web Push OFF'));
});
