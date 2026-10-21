// Isolated regression: remote audio recovery and approved fallback/geometry invariants.
// Run from repository root with Node >= 20. Never requires a meeting or QA fixtures.
import fs from 'node:fs';
import assert from 'node:assert/strict';
const source=fs.readFileSync(new URL('../ui/webrtc-controller.js',import.meta.url),'utf8');
const css=fs.readFileSync(new URL('../ui/webrtc.css',import.meta.url),'utf8');
const panel=fs.readFileSync(new URL('../ui/zoom-participants-reference-2.0.41.js',import.meta.url),'utf8');
const exporter=fs.readFileSync(new URL('../ui/physical-media-qa-export.js',import.meta.url),'utf8');
const start=source.indexOf('  async function routeAudioElement(audio,stream){');
const end=source.indexOf('  async function playRemoteAudio(',start);
assert.ok(start>=0&&end>start,'Remote audio playback helper missing');
const registered={};
const audio=[];
const mockDocument={
  addEventListener(type,callback){registered[type]=callback;},
  querySelectorAll(selector){assert.equal(selector,'#remoteAudioBin audio');return audio;}
};
const mockWindow={DominionMediaController:{snapshot:()=>({speakerId:''})}};
const {routeAudioElement}=new Function('window','document',source.slice(start,end)+';return {routeAudioElement};')(mockWindow,mockDocument);
const stream={id:'test-stream'};
let attempts=0;
const player={dataset:{},srcObject:null,setSinkId:null,async play(){attempts++;if(attempts===1){const e=new Error('Mock autoplay rejected');e.name='NotAllowedError';throw e;}}};
audio.push(player);
await routeAudioElement(player,stream);
assert.equal(player.dataset.dsPlayback,'blocked');
assert.equal(player.dataset.dsPlaybackError,'NotAllowedError');
assert.equal(player.srcObject,stream,'Stream must remain attached despite autoplay denial');
assert.equal(typeof registered.pointerdown,'function','User gesture retry missing');
registered.pointerdown();
await new Promise(resolve=>setTimeout(resolve,0));
assert.equal(player.dataset.dsPlayback,'playing');
assert.equal(player.dataset.dsPlaybackError,undefined);
assert.equal(attempts,2,'Playback should retry exactly once after a gesture');
registered.pointerdown();
await new Promise(resolve=>setTimeout(resolve,0));
assert.equal(attempts,2,'Healthy playback must not be retried on every gesture');
assert.match(source,/remoteAudioPlayback:after.remoteAudioPlayback/,'Audio playback status must reach diagnosticWindow');
assert.match(exporter,/'remoteAudioPlayback'/,'Audio evidence must be exportable from the physical QA UI');
assert.match(css,/\.remote-peer-tile \.remote-peer-fallback\[hidden\]\{display:none!important\}/,'Camera fallback must honor hidden');
assert.match(css,/#remoteShareVideo\[hidden\]\{display:none!important\}/,'Hidden remote screen must never cover main stage');
assert.match(panel,/left:50%!important;right:auto!important;top:50%!important;bottom:auto!important;transform:translate\(-50%,-50%\)!important;/,'Approved participants center geometry missing');
console.log('PASS remote-audio retry, diagnostic visibility, fallback visibility, and participant placement invariants (simulated only)');
