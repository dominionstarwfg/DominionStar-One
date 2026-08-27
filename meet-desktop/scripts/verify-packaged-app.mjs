import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';

const appPath=process.argv[2];
if(!appPath)throw new Error('Usage: node verify-packaged-app.mjs <DominionStar Meet.app>');
const absolute=path.resolve(appPath);
assert(fs.existsSync(absolute),'Packaged .app does not exist.');
const resources=path.join(absolute,'Contents','Resources');
const asarPath=path.join(resources,'app.asar');
assert(fs.existsSync(asarPath),'Packaged app.asar is missing.');

const listing=execFileSync(process.execPath,[path.resolve('node_modules/@electron/asar/bin/asar.js'),'list',asarPath],{encoding:'utf8'});
const required=[
  '/src/main.mjs','/src/auth-service.mjs','/src/meeting-service.mjs','/src/share-service.mjs','/src/share-source-authority.mjs','/src/preload.cjs',
  '/ui/index.html','/ui/app.js','/ui/media-controller.js','/ui/share-controller.js','/ui/share-integration.js','/ui/share-picker.html','/ui/presenter-toolbar.html',
  '/ui/webrtc-controller.js','/ui/webrtc.css','/ui/diagnostics.js','/ui/diagnostics.css','/package.json'
];
for(const item of required)assert(listing.includes(item),`Packaged ASAR is missing ${item}`);
for(const forbidden of ['/desktop/','/desktop 2/','/meet-home/','/meet-login/','/assets/js/meeting-engine.js'])assert(!listing.includes(forbidden),`Legacy runtime leaked into packaged ASAR: ${forbidden}`);

const unpackDir=path.resolve('.package-audit');
fs.rmSync(unpackDir,{recursive:true,force:true});
execFileSync(process.execPath,[path.resolve('node_modules/@electron/asar/bin/asar.js'),'extract',asarPath,unpackDir]);
const main=fs.readFileSync(path.join(unpackDir,'src','main.mjs'),'utf8');
const auth=fs.readFileSync(path.join(unpackDir,'src','auth-service.mjs'),'utf8');
const share=fs.readFileSync(path.join(unpackDir,'src','share-source-authority.mjs'),'utf8');
const shareService=fs.readFileSync(path.join(unpackDir,'src','share-service.mjs'),'utf8');
const webrtc=fs.readFileSync(path.join(unpackDir,'ui','webrtc-controller.js'),'utf8');
assert(main.includes("loadFile(path.join(uiDir,'index.html'))"),'Packaged desktop must launch the local Home file.');
assert(!main.includes('dominionstarld.com'),'Packaged desktop must not launch the public website.');
assert(auth.includes('flowType:\'pkce\''),'Packaged auth must use PKCE.');
assert(auth.includes("CALLBACK_HOST='127.0.0.1'"),'Packaged auth must use the loopback callback.');
assert(share.includes('let inFlight=null'),'Packaged share authority must keep exactly one native source enumeration in flight.');
assert(share.includes('Promise.race([inFlight,timeoutResult()])'),'Packaged share source enumeration must remain bounded by timeout.');
assert(share.includes('.finally(()=>{inFlight=null;})'),'Packaged share authority must release single-flight state after enumeration.');
assert(shareService.includes('createShareSourceAuthority'),'Packaged share service must use the isolated source authority.');
assert(webrtc.includes('RTCPeerConnection'),'Packaged app must include WebRTC transport.');
assert(webrtc.includes('meeting.iceConfig'),'Packaged app must include relay-capable ICE configuration.');
fs.rmSync(unpackDir,{recursive:true,force:true});
console.log('DOMINIONSTAR_PACKAGED_APP_CERTIFIED local-home pkce bounded-single-flight-share webrtc diagnostics no-legacy-runtime');
