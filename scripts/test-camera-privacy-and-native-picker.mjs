import fs from 'node:fs';

const engine=fs.readFileSync(new URL('../assets/js/meeting-engine.js',import.meta.url),'utf8');
const ui=fs.readFileSync(new URL('../assets/js/meet-next/executive6.js',import.meta.url),'utf8');
const main=fs.readFileSync(new URL('../desktop 2/src/main-v2.mjs',import.meta.url),'utf8');

const requireSource=(source,needle,message)=>{if(!source.includes(needle))throw new Error(message);};

// Video Off is a physical privacy boundary. The current implementation is
// intentionally stricter than the former single-track release: every video
// track in the local meeting stream is inspected, detached and physically ended.
requireSource(engine,"const cameraTracks=[...(base?.getVideoTracks?.()||[])]",'Video Off does not enumerate every local camera track.');
requireSource(engine,"if(base?.getVideoTracks?.().includes(item)){try{base.removeTrack(item);}catch(_){}}",'Video Off does not remove every camera track from the meeting stream.');
requireSource(engine,"if(item?.readyState!=='ended'){try{item.stop();released=true;}catch(_){}}",'Video Off does not inspect and end every live physical camera track.');
requireSource(engine,"if(released||cameraTracks.length)state.lastCameraReleaseAt=Date.now()",'Video Off does not record hardware release for stable reacquisition.');
requireSource(engine,"Promise.allSettled([...state.peers.values()].map(peer=>syncPeerTracks(peer)))",'Video Off does not clear the negotiated camera senders after hardware release.');
requireSource(ui,"video:state.video?{width:{ideal:1280},height:{ideal:720},frameRate:{ideal:30,max:30}}:false",'Prejoin still requests camera incorrectly or does not preserve the HD/30 video contract.');
requireSource(ui,"state.stream.removeTrack(track)",'Prejoin Video Off does not release its camera track.');
requireSource(ui,'markPreviewCameraReleased()','Prejoin Video Off does not mark the hardware release boundary before Video On.');
requireSource(main,'function supportsMacSystemPicker()','Clean desktop runtime is missing the macOS native-picker capability gate.');
requireSource(main,'return major >= 15','Native picker is not restricted to supported macOS versions.');
requireSource(main,'{ useSystemPicker: supportsMacSystemPicker() }','macOS native screen picker is not enabled conditionally.');
requireSource(engine,'const useNativeSystemPicker=Boolean(desktopRuntime?.systemSharePicker)','Web meeting does not read the native system-picker capability.');
requireSource(engine,'window.dominionDesktop?.isDesktop && !useNativeSystemPicker && window.DominionDesktopSharePicker?.choose','Web meeting still opens its custom picker before the macOS system picker.');

console.log('PASS all-track camera hardware privacy and single-picker macOS screen-share guardrails.');