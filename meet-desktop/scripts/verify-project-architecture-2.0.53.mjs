import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';

const root=fileURLToPath(new URL('..',import.meta.url));
const walk=dir=>fs.readdirSync(dir,{withFileTypes:true}).flatMap(entry=>{
  const full=path.join(dir,entry.name);
  return entry.isDirectory()?walk(full):[full];
});
const rel=file=>path.relative(root,file).replaceAll(path.sep,'/');
const files=walk(root).filter(file=>/\.(?:js|mjs|cjs|css|html)$/.test(file));
const sources=new Map(files.map(file=>[rel(file),fs.readFileSync(file,'utf8')]));
const failures=[];
const fail=(file,rule,detail='')=>failures.push({file,rule,detail});

const uiJs=[...sources].filter(([file])=>file.startsWith('ui/')&&/\.(?:js|mjs|cjs)$/.test(file));
const css=[...sources].filter(([file])=>file.startsWith('ui/')&&file.endsWith('.css'));

// Camera ownership: the renderer media controller is the only UI module
// permitted to acquire camera/microphone hardware directly.
for(const [file,src] of uiJs){
  if(!src.includes('getUserMedia')||file==='ui/media-controller.js')continue;
  const isolatedDesktopCapture=file==='ui/share-capture-worker.js'&&src.includes("chromeMediaSource:'desktop'")&&!src.includes('getUserMedia({video:true');
  if(!isolatedDesktopCapture)fail(file,'camera-single-owner','Direct camera/microphone getUserMedia outside media-controller.js');
}

// Never permit presenter/share companion surfaces to acquire a camera.
for(const [file,src] of uiJs){
  if(/presenter|share-video|share-integration/i.test(file)&&src.includes('getUserMedia'))fail(file,'presenter-no-camera-acquisition','Presenter/share UI attempted direct camera acquisition');
}

// Visual compatibility modules must not run unbounded high-frequency desktop
// reconciliation loops. Functional transport/signal modules are intentionally
// outside this filename class.
for(const [file,src] of uiJs){
  if(!/(?:adaptive|polish|reference|repair|participant|presenter)(?:[-_.]|$)/i.test(file))continue;
  if(!src.includes('setInterval('))continue;
  const guarded=
    src.includes('const backgroundEnabled=!Boolean(window.dominionDesktop)')||
    src.includes('const desktopCanonical=Boolean(window.dominionDesktop)')||
    src.includes('const desktopCanonical=Boolean(desktop?.isDesktop)')||
    src.includes('desktopSurface?0:setInterval')||
    file==='ui/zoom-reaction-parity.js';
  if(!guarded)fail(file,'no-autonomous-desktop-visual-polling','setInterval exists without an explicit desktop retirement guard');
}

// Production diagnostics must remain fully idle until explicitly started.
const diagnostics=sources.get('ui/physical-diagnostics.js')||'';
if(/\n\s*start\(\);\s*\n\s*window\.DominionPhysicalDiagnostics/.test(diagnostics)){
  fail('ui/physical-diagnostics.js','diagnostics-opt-in-only','Physical diagnostics auto-start in production');
}
if(diagnostics.includes("meeting-ui-ready',()=>{attachRosterObserver()")){
  fail('ui/physical-diagnostics.js','diagnostics-no-idle-observer','Diagnostics attach the roster observer while idle');
}

// Compatibility layers may not own continuous participant or behavior reconciliation.
const participantCenter=sources.get('ui/participants-center-lock-2.0.41.js')||'';
if(participantCenter.includes('new MutationObserver(')){
  fail('ui/participants-center-lock-2.0.41.js','participant-compatibility-no-subtree-observer','Legacy participant compatibility still observes the meeting subtree');
}
const behavior=sources.get('ui/zoom-behavior.js')||'';
if(behavior.includes('setInterval(')){
  fail('ui/zoom-behavior.js','behavior-event-driven-only','Behavior compatibility still uses periodic reconciliation');
}
const app=sources.get('ui/app.js')||'';
if(!behavior.includes("'dominion:meeting-entered'")||!app.includes("new CustomEvent('dominion:meeting-entered'")){
  fail('ui/zoom-behavior.js','behavior-explicit-enter-lifecycle','Meeting behavior must initialize from an explicit meeting-entered lifecycle event');
}

// Canonical Participants selectors are protected API. Historical styling may
// still carry generic compatibility rules, but it may not directly target the
// final ds-* authority selectors from an unrelated module.
const protectedParticipantTokens=['.ds-participants-reference','.ds-participant-search-primary','.ds-ref-participants-footer','.ds-traffic-close','.ds-traffic-minimize','.ds-traffic-restore'];
const protectedParticipantOwners=new Set(['ui/zoom-participants-reference-2.0.41.js','ui/runtime-stability.js','ui/runtime-stability.css','ui/zoom-screenshot-reference-2.0.41.js','ui/zoom-screenshot-reference-2.0.41.css']);
for(const [file,src] of sources){
  if(protectedParticipantOwners.has(file)||file.startsWith('scripts/'))continue;
  for(const token of protectedParticipantTokens)if(src.includes(token))fail(file,'protected-participant-selector',`Non-owner targets canonical selector ${token}`);
}

// The exact one-person search regression is forbidden anywhere in CSS.
for(const [file,src] of css){
  const compact=src.replace(/\s+/g,' ');
  if(/data-ds-adaptive-count\s*=\s*["']1["'][^{}]*zoom-participant-search[^{}]*\{[^}]*display\s*:\s*none/i.test(compact)||
     /data-ds-adaptive-count[^{}]*1[^{}]*ds-participant-search[^{}]*\{[^}]*display\s*:\s*none/i.test(compact)){
    fail(file,'one-person-search-must-remain-visible','Participant-count CSS hides the search surface');
  }
}

// The canonical search input must never regain the legacy class that historical
// styles target.
for(const [file,src] of sources){
  if(!file.startsWith('ui/'))continue;
  if(src.includes('zoom-participant-search ds-participant-search-primary'))fail(file,'canonical-search-class-isolation','Canonical search input carries legacy search class');
}

// The approved native Mac filmstrip starts at participant #2.
const overlay=sources.get('src/mac-share-presenter-overlay.mjs')||'';
if(!overlay.includes("function shouldShowVideoWindow(){return videoLayout!=='hide'&&presenterParticipantCount()>=2;}"))fail('src/mac-share-presenter-overlay.mjs','approved-filmstrip-threshold','Native video panel is not explicitly gated to 2+ participants');

// Presenter commands must not treat appearance changes as execution success.
const integration=sources.get('ui/share-integration.js')||'';
for(const token of ["error:'pause_state_not_reached'","error:'camera_state_not_reached'"]){
  if(!integration.includes(token))fail('ui/share-integration.js','presenter-state-acknowledgement',`Missing ${token}`);
}

// Approved compact native presenter toolbar: no extra primary actions.
const toolbar=sources.get('ui/mac-presenter-toolbar.html')||'';
const required=['data-command="audio"','data-command="video"','data-command="pause"','data-command="participants"','data-command="chat"','id="moreButton"','id="stopShare"'];
const forbidden=['id="layoutButton"','data-command="show-meeting"','data-command="new-share"','id="brandLogo"'];
for(const token of required)if(!toolbar.includes(token))fail('ui/mac-presenter-toolbar.html','approved-presenter-toolbar',`Missing ${token}`);
for(const token of forbidden)if(toolbar.includes(token))fail('ui/mac-presenter-toolbar.html','approved-presenter-toolbar',`Forbidden top-level control ${token}`);

// High-frequency presenter compatibility polling is prohibited.
const parity=sources.get('ui/presenter-command-parity-2.0.27.js')||'';
if(parity.includes('setInterval('))fail('ui/presenter-command-parity-2.0.27.js','bounded-presenter-install','Presenter compatibility uses polling instead of bounded retries');

// Keep a machine-readable summary in CI logs for future audits.
const intervalFiles=uiJs.filter(([,src])=>src.includes('setInterval(')).map(([file])=>file);
const observerFiles=uiJs.filter(([,src])=>src.includes('MutationObserver')).map(([file])=>file);
const directCameraFiles=uiJs.filter(([,src])=>src.includes('getUserMedia')).map(([file])=>file);

if(failures.length){
  for(const item of failures)console.error(`ARCHITECTURE_VIOLATION file=${item.file} rule=${item.rule} detail=${item.detail}`);
  assert.fail(`Project architecture audit found ${failures.length} violation(s).`);
}
console.log('DOMINIONSTAR_PROJECT_ARCHITECTURE_2_0_54_OK');
console.log('ARCHITECTURE_INTERVAL_FILES '+JSON.stringify(intervalFiles));
console.log('ARCHITECTURE_OBSERVER_FILES '+JSON.stringify(observerFiles));
console.log('ARCHITECTURE_DIRECT_CAMERA_FILES '+JSON.stringify(directCameraFiles));
