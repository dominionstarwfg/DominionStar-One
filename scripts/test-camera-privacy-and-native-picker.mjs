import fs from 'node:fs';

const engine=fs.readFileSync(new URL('../assets/js/meeting-engine.js',import.meta.url),'utf8');
const ui=fs.readFileSync(new URL('../assets/js/meet-next/executive6.js',import.meta.url),'utf8');
const main=fs.readFileSync(new URL('../desktop/src/main.mjs',import.meta.url),'utf8');

const requireSource=(source,needle,message)=>{if(!source.includes(needle))throw new Error(message);};

requireSource(engine,"state.localStream?.removeTrack?.(track)",'Video Off does not remove the camera track from the meeting stream.');
requireSource(engine,"if(track.readyState!=='ended')track.stop()",'Video Off does not end physical camera capture.');
requireSource(engine,"for(const peer of state.peers.values())syncPeerTracks(peer).catch",'Video Off does not clear camera senders.');
requireSource(ui,"video:state.video?{width:{ideal:1280},height:{ideal:720}}:false",'Prejoin still requests camera while video is off.');
requireSource(ui,"state.stream.removeTrack(track)",'Prejoin Video Off does not release its camera track.');
requireSource(main,'useSystemPicker:supportsMacSystemPicker()','macOS native screen picker is not enabled conditionally.');
requireSource(main,'major>=15','Native picker is not restricted to supported macOS versions.');
requireSource(engine,"!desktopRuntime?.systemSharePicker",'Web meeting does not bypass the stale custom picker when native capture is available.');

console.log('PASS camera hardware privacy and macOS native screen-picker guardrails.');
