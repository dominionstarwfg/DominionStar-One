import fs from 'node:fs';
import assert from 'node:assert/strict';

const read=rel=>fs.readFileSync(new URL(`../${rel}`,import.meta.url),'utf8');
const parity=read('ui/zoom-reaction-parity.js');
const auth=read('ui/auth-password.js');
const motion=read('ui/runtime-motion.css');

assert.ok(parity.includes('const DURATION_MS=10000'),'Reaction authority must preserve Zoom’s 10-second meeting reaction lifetime.');
assert.ok(parity.includes("canonical.style.setProperty('animation-duration','10s','important')"),'Rendered reaction animation must be forced to 10 seconds.');
assert.ok(parity.includes("node.replaceWith(canonical)"),'Reaction parity must replace the legacy short-lived node before its old removal timer can remove the canonical reaction.');
assert.ok(parity.includes("data-ds-reaction-parity=\"10s\"")||parity.includes("dataset.dsReactionParity='10s'"),'Canonical reaction must expose the 10-second parity marker.');
assert.ok(auth.includes("script.src='./zoom-reaction-parity.js'"),'Desktop startup must load the canonical reaction parity authority.');
assert.ok(auth.indexOf("script.src='./zoom-reaction-parity.js'")>auth.indexOf("script.src='./zoom-physical-acceptance.js'"),'Reaction parity authority must be registered after the physical-acceptance layer it corrects.');

assert.ok(parity.includes("observer.observe(layer,{childList:true})"),'Reaction observation must be limited to direct children of the reaction layer.');
assert.ok(!parity.includes('observer.observe(document.documentElement'),'Reaction authority must never observe the whole renderer.');
assert.ok(parity.includes("layer.dataset.dsZoomReactionLane='left'"),'Animated reactions must use the left-side physical Zoom reference lane.');
assert.ok(parity.includes('const MAX_ACTIVE=72'),'Reaction animation must remain bounded under high-volume rooms.');
assert.ok(parity.includes("if(!['❤️','👏','👍'].includes(emoji))return"),'Heart, clap, and thumbs-up reactions must support selective blossom behavior.');
assert.ok(parity.includes('const count=3+(seed%4)'),'A blossom must expand into a small variable-size cluster instead of duplicating every reaction identically.');
assert.ok(parity.includes('const dense=active.filter'),'Dense reaction traffic must reduce repeated name labels rather than create text collisions.');
assert.ok(motion.includes('#meetingReactionLayer[data-ds-zoom-reaction-lane="left"]'),'Final motion CSS must contain the reaction layer.');
assert.ok(motion.includes('.ds-reaction-satellite'),'Final motion CSS must style blossom satellites separately from primary named reactions.');

console.log('DOMINIONSTAR_REACTION_PARITY_OK ten-second-lifetime canonical-node startup-authority left-lanes bounded-high-volume selective-blossoms narrow-observer');