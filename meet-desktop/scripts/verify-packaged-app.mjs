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
  '/ui/index.html','/ui/app.js','/ui/auth-password.js','/ui/media-controller.js','/ui/av-settings.js','/ui/av-settings.css','/ui/meeting-parity.js','/ui/meeting-parity.css','/ui/share-controller.js','/ui/share-integration.js','/ui/share-picker.html','/ui/presenter-toolbar.html',
  '/ui/webrtc-controller.js','/ui/webrtc.css','/ui/diagnostics.js','/ui/diagnostics.css','/package.json'
];
for(const item of required)assert(listing.includes(item),`Packaged ASAR is missing ${item}`);
for(const forbidden of ['/desktop/','/desktop 2/','/meet-home/','/meet-login/','/assets/js/meeting-engine.js'])assert(!listing.includes(forbidden),`Legacy runtime leaked into packaged ASAR: ${forbidden}`);

const unpackDir=path.resolve('.package-audit');
fs.rmSync(unpackDir,{recursive:true,force:true});
execFileSync(process.execPath,[path.resolve('node_modules/@electron/asar/bin/asar.js'),'extract',asarPath,unpackDir]);
const main=fs.readFileSync(path.join(unpackDir,'src','main.mjs'),'utf8');
const auth=fs.readFileSync(path.join(unpackDir,'src','auth-service.mjs'),'utf8');
const meeting=fs.readFileSync(path.join(unpackDir,'src','meeting-service.mjs'),'utf8');
const preload=fs.readFileSync(path.join(unpackDir,'src','preload.cjs'),'utf8');
const share=fs.readFileSync(path.join(unpackDir,'src','share-source-authority.mjs'),'utf8');
const shareService=fs.readFileSync(path.join(unpackDir,'src','share-service.mjs'),'utf8');
const media=fs.readFileSync(path.join(unpackDir,'ui','media-controller.js'),'utf8');
const authPassword=fs.readFileSync(path.join(unpackDir,'ui','auth-password.js'),'utf8');
const html=fs.readFileSync(path.join(unpackDir,'ui','index.html'),'utf8');
const av=fs.readFileSync(path.join(unpackDir,'ui','av-settings.js'),'utf8');
const parity=fs.readFileSync(path.join(unpackDir,'ui','meeting-parity.js'),'utf8');
const parityCss=fs.readFileSync(path.join(unpackDir,'ui','meeting-parity.css'),'utf8');
const webrtc=fs.readFileSync(path.join(unpackDir,'ui','webrtc-controller.js'),'utf8');
assert(main.includes("loadFile(path.join(uiDir,'index.html'))"),'Packaged desktop must launch the local Home file.');
assert(!main.includes('dominionstarld.com'),'Packaged desktop must not launch the public website.');
assert(main.includes('systemPreferences.getMediaAccessStatus(kind)'),'Packaged desktop must include native macOS media permission authority.');
assert(main.includes("permissionStatus('screen')"),'Packaged desktop must check Screen Recording permission before sharing.');
assert(auth.includes('flowType:\'pkce\''),'Packaged Google auth must use PKCE.');
assert(auth.includes("CALLBACK_HOST='127.0.0.1'"),'Packaged auth must use the loopback callback.');
assert(auth.includes('client.auth.signInWithPassword'),'Packaged app must include email/password sign-in.');
assert(preload.includes('signInPassword:')&&authPassword.includes('auth.signInPassword'),'Packaged renderer must expose email/password only through narrow native auth IPC.');
assert(meeting.includes("passcode.length<3"),'Packaged meeting lifecycle must accept 3-digit passcodes such as 360.');
assert(media.includes("deviceId:id?{ideal:id}:undefined"),'Packaged camera authority must use resilient soft device preference.');
assert(media.includes("const candidates=unique([preferredId,...catalog.map(item=>item.id)])"),'Packaged camera authority must fall back to another available device.');
assert(html.includes('<script src="./av-settings.js"></script>')&&html.includes('<script src="./meeting-parity.js"></script>'),'Packaged Home must load A/V settings and meeting parity, not merely contain them.');
assert(av.includes("caret.className='meeting-control av-device-caret'"),'Packaged meeting must retain mic/video device-option carets.');
assert(parity.includes("side.dataset.floatingDock='1'")&&parity.includes("button.id='roomSettings'")&&parity.includes("button.id='roomMore'"),'Packaged meeting must include floating participant dock plus Settings/More controls.');
assert(parityCss.includes('resize:both')&&parityCss.includes('padding-left:86px'),'Packaged meeting chrome must include resizable dock and macOS titlebar clearance.');
assert(share.includes('let inFlight=null'),'Packaged share authority must keep exactly one native source enumeration in flight.');
assert(share.includes('Promise.race([inFlight,timeoutResult()])'),'Packaged share source enumeration must remain bounded by timeout.');
assert(share.includes('.finally(()=>{inFlight=null;})'),'Packaged share authority must release single-flight state after enumeration.');
assert(shareService.includes('createShareSourceAuthority'),'Packaged share service must use the isolated source authority.');
assert(shareService.includes('ensureScreenPermission()')&&shareService.includes('permissionRequired:true'),'Packaged share picker must preflight native Screen Recording permission.');
assert(webrtc.includes('RTCPeerConnection'),'Packaged app must include WebRTC transport.');
assert(webrtc.includes('meeting.iceConfig'),'Packaged app must include relay-capable ICE configuration.');
fs.rmSync(unpackDir,{recursive:true,force:true});
console.log('DOMINIONSTAR_PACKAGED_APP_CERTIFIED local-home email-google-auth passcode-360 native-media-permissions camera-fallback loaded-av floating-dock bounded-share webrtc diagnostics no-legacy-runtime');
