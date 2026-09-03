import fs from 'node:fs';
import assert from 'node:assert/strict';

// 2.0.26 exact-head gate: synchronize PR checks after stacked CI base registration.
const read=rel=>fs.readFileSync(new URL(`../${rel}`,import.meta.url),'utf8');
const ui=read('ui/profile-photo-fallback.js');
const parity=read('ui/meeting-parity.js');
const auth=read('src/auth-service.mjs');
const meeting=read('src/meeting-service.mjs');
const share=read('src/share-service.mjs');
const existing=read('scripts/verify-profile-photo-fallback-2.0.24.mjs');

const has=(source,needle,message)=>assert.ok(source.includes(needle),message);
const lacks=(source,needle,message)=>assert.ok(!source.includes(needle),message);

// Carry forward the established private photo transport rather than creating a
// second avatar/storage system.
has(auth,"client.storage.from('member-avatars').createSignedUrl",'Private signed avatar authority regressed.');
has(meeting,"auth.rpc('meet_v2_room_avatar_paths'",'Room avatar metadata enrichment regressed.');
has(meeting,'avatarUrl:record.avatarUrl','Signed avatar URL is no longer carried into participant snapshots.');
has(existing,'local-and-remote-photo-first initials-fallback','2.0.24 photo-first/initials fallback gate must remain present.');
lacks(auth,'.getPublicUrl(','2.0.26 must not make member avatars public.');

// 2.0.26 regression: Gallery/Multi-speaker must not erase the local identity
// tile merely because camera video is off.
has(ui,'function syncLocalGalleryIdentity()','Local camera-off identity correction is missing.');
has(ui,"if(sharing||!['gallery','multi'].includes(mode))return;",'Identity correction must be limited to non-sharing Gallery/Multi-speaker views.');
has(ui,"Boolean(window.DominionPreferences?.read?.('hideSelfView'))",'Hide Self View authority must be preserved.');
has(ui,'if(hideSelf){if(!tile.hidden)tile.hidden=true;syncDockCount(dock);return;}','Hide Self View must still remove the local tile.');
has(ui,"const live=Boolean(snapshot.videoLive&&stream?.getVideoTracks?.().some(track=>track.readyState==='live'))",'Camera-live detection must require a real live video track.');
has(ui,'if(tile.hidden)tile.hidden=false;','Gallery/Multi camera-off identity must restore the local tile.');
has(ui,'if(video.srcObject)video.srcObject=null;video.hidden=true;','Camera-off local tile must stop painting stale camera video.');
has(ui,'if(fallback)fallback.hidden=false;','Camera-off local tile must reveal the photo/initials fallback.');
has(ui,'if(video.srcObject!==stream)video.srcObject=stream;video.hidden=false','Camera-on recovery must restore the live local video surface.');
has(ui,'if(fallback)fallback.hidden=true;','Camera-on recovery must hide the fallback surface.');
has(ui,"qa('#participantVideoDock .remote-peer-tile').filter(tile=>!tile.hidden&&!tile.classList.contains('stage-promoted'))",'Dock count must include the restored camera-off local tile.');
has(ui,"if(count>0)dock.dataset.orientation='grid'",'Gallery/Multi identity correction must retain grid orientation.');

// The correction is intentionally post-layout and bounded. It watches only the
// local tile/dock visibility attributes, never the entire meeting attribute tree.
has(ui,'let localVisibilityObserver=null,observedTile=null,observedDock=null','Local visibility observer must remain single-instance.');
has(ui,"localVisibilityObserver.observe(tile,{attributes:true,attributeFilter:['hidden']})",'Local tile visibility must be observed narrowly.');
has(ui,"localVisibilityObserver.observe(dock,{attributes:true,attributeFilter:['hidden']})",'Dock visibility must be observed narrowly.');
has(ui,'localVisibilityObserver=new MutationObserver(()=>schedulePaint())','Visibility correction must use the existing bounded scheduler.');
has(ui,'repaintTimer=window.setTimeout(()=>{repaintTimer=0;paintAll();},32)','Identity correction must continue yielding through a bounded task.');
lacks(ui,'queueMicrotask(paintAll)','Camera-off identity must not reintroduce renderer-starving microtask repaint loops.');

// Profile-photo painting remains photo-first with initials fallback on all
// already-certified participant surfaces.
has(ui,"q('#prejoinAvatar')",'Prejoin profile-photo fallback regressed.');
has(ui,"q('#stageAvatar')",'Main-stage profile-photo fallback regressed.');
has(ui,"q('#localVideoDockTile .remote-peer-fallback')",'Local dock profile-photo fallback regressed.');
has(ui,"qa('.remote-peer-tile[data-peer-id]')",'Remote tile profile-photo fallback regressed.');
has(ui,"qa('[data-participant-id]')",'Roster profile-photo fallback regressed.');
has(ui,"qa('[data-wait]')",'Waiting-room profile-photo fallback regressed.');
has(ui,'syncLocalGalleryIdentity();','Local photo painting must immediately reconcile camera-off visibility.');
has(ui,'syncLocalGalleryIdentity','Runtime test API must expose the local identity reconciliation for packaged QA.');

// Do not contaminate the certified presenter/share architecture.
has(parity,'if(share){syncShareLayout();return;}','Meeting parity must retain the macOS share no-rebind guard.');
lacks(share,'syncLocalGalleryIdentity','Share service must remain independent from camera-off profile identity.');
lacks(share,'member-avatars','Share service must remain independent from avatar storage.');

console.log('DOMINIONSTAR_PROFILE_PHOTO_CAMERA_OFF_2_0_26_OK private-signed-avatars existing-room-enrichment gallery-multi-local-tile camera-off-photo-first initials-fallback camera-on-recovery hide-self-authoritative narrow-visibility-observer bounded-repaint share-stack-untouched');
