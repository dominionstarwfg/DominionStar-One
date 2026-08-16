import fs from 'node:fs';

const engine=fs.readFileSync(new URL('../assets/js/meeting-engine.js',import.meta.url),'utf8');
const ui=fs.readFileSync(new URL('../assets/js/meet-next/executive6.js',import.meta.url),'utf8');
const main=fs.readFileSync(new URL('../desktop 2/src/main-v2.mjs',import.meta.url),'utf8');

const requireSource=(source,needle,message)=>{if(!source.includes(needle))throw new Error(message);};

// Exact recovered production uses releaseCameraTrack() rather than the older
// direct optional-chaining form. Assert the semantics, not an obsolete spelling.
requireSource(engine,"try{base.removeTrack(track);}catch(_){}",'Video Off does not remove the camera track from the meeting stream.');
requireSource(engine,"if(track?.readyState!=='ended')",'Video Off does not inspect physical camera track state before stopping it.');
requireSource(engine,"try{track.stop();}catch(_){}",'Video Off does not end physical camera capture.');
requireSource(engine,'state.lastCameraReleaseAt=Date.now()','Video Off does not record hardware release for stable reacquisition.');
requireSource(engine,"Promise.allSettled([...state.peers.values()].map(peer=>syncPeerTracks(peer)))",'Video Off does not clear the negotiated camera senders after hardware release.');
requireSource(ui,"video:state.video?{width:{ideal:1280},height:{ideal:720}}:false",'Prejoin still requests camera while video is off.');
requireSource(ui,"state.stream.removeTrack(track)",'Prejoin Video Off does not release its camera track.');
requireSource(ui,'markPreviewCameraReleased()','Prejoin Video Off does not mark the hardware release boundary before Video On.');
requireSource(main,'function supportsMacSystemPicker()','Clean desktop runtime is missing the macOS native-picker capability gate.');
requireSource(main,'return major >= 15','Native picker is not restricted to supported macOS versions.');
requireSource(main,'{ useSystemPicker: supportsMacSystemPicker() }','macOS native screen picker is not enabled conditionally.');
requireSource(engine,"!desktopRuntime?.systemSharePicker",'Web meeting does not bypass the custom picker when native capture is available.');

console.log('PASS exact-production camera hardware privacy and macOS native screen-picker guardrails.');
