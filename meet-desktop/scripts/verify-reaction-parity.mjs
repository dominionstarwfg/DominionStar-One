import fs from 'node:fs';
import assert from 'node:assert/strict';

const read=rel=>fs.readFileSync(new URL(`../${rel}`,import.meta.url),'utf8');
const parity=read('ui/zoom-reaction-parity.js');
const auth=read('ui/auth-password.js');

assert.ok(parity.includes('const DURATION_MS=10000'),'Reaction authority must preserve Zoom’s 10-second meeting reaction lifetime.');
assert.ok(parity.includes("canonical.style.setProperty('animation-duration','10s','important')"),'Rendered reaction animation must be forced to 10 seconds.');
assert.ok(parity.includes("node.replaceWith(canonical)"),'Reaction parity must replace the legacy short-lived node before its old removal timer can remove the canonical reaction.');
assert.ok(parity.includes("data-ds-reaction-parity=\"10s\"")||parity.includes("dataset.dsReactionParity='10s'"),'Canonical reaction must expose the 10-second parity marker.');
assert.ok(auth.includes("script.src='./zoom-reaction-parity.js'"),'Desktop startup must load the canonical reaction parity authority.');
assert.ok(auth.indexOf("script.src='./zoom-reaction-parity.js'")>auth.indexOf("script.src='./zoom-physical-acceptance.js'"),'Reaction parity authority must be registered after the physical-acceptance layer it corrects.');

console.log('DOMINIONSTAR_REACTION_PARITY_OK ten-second-lifetime canonical-node startup-authority');
