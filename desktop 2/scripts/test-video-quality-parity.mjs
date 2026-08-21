import fs from 'node:fs';
import assert from 'node:assert/strict';

const root = new URL('../../', import.meta.url);
const moduleSource = fs.readFileSync(new URL('assets/js/meet/video-quality-parity.js', root), 'utf8');
const bootstrap = fs.readFileSync(new URL('assets/js/meet/operation-2030-bootstrap.js', root), 'utf8');

assert(moduleSource.includes('Adjust for low light'));
assert(moduleSource.includes('Original ratio'));
assert(moduleSource.includes('getCapabilities'));
assert(moduleSource.includes('applyConstraints'));
assert(moduleSource.includes('exposureCompensation'));
assert(moduleSource.includes("objectFit = enabled ? 'contain' : ''"));
assert(moduleSource.includes('camera-controls-unavailable'));
assert(bootstrap.includes('video-quality-parity.js'));
assert(bootstrap.includes('data-ds-video-quality-parity'));
assert(bootstrap.indexOf('background-effects-2030.js') < bootstrap.indexOf('video-quality-parity.js'));

console.log('DominionStar video quality parity guardrails passed.');
