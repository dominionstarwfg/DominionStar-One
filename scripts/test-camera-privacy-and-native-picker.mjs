import fs from 'node:fs';

const engine=fs.readFileSync(new URL('../assets/js/meeting-engine.js',import.meta.url),'utf8');
const ui=fs.readFileSync(new URL('../assets/js/meet-next/executive6.js',import.meta.url),'utf8');
const main=fs.readFileSync(new URL('../desktop 2/src/main-v2.mjs',import.meta.url),'utf8');
const bootstrap=fs.readFileSync(new URL('../desktop 2/src/bootstrap.mjs',import.meta.url),'utf8');
const preload=fs.readFileSync(new URL('../desktop 2/src/preload.cjs',import.meta.url),'utf8');
const nativeCapture=fs.readFileSync(new URL('../desktop 2/src/macos-native-capture-authority.mjs',import.meta.url),'utf8');

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

// Real Mac recovery policy: keep the cross-platform DominionStar picker as the
// fallback, but on macOS 15+ finish startup with exactly one effective authority:
// Electron/Apple's proven native system picker. The meeting engine must then
// bypass the branded custom picker instead of opening two competing pickers.
requireSource(main,'{ useSystemPicker: supportsMacSystemPicker() }','Cross-platform fallback capture handler is missing.');
requireSource(bootstrap,"await import('./macos-native-capture-authority.mjs')",'Desktop bootstrap does not install the macOS capture authority.');
requireSource(nativeCapture,"Number.isFinite(major) && major >= 15",'Native picker authority is not restricted to supported macOS versions.');
requireSource(nativeCapture,'{ useSystemPicker: true }','Native macOS capture authority does not enable Electron system picker mode.');
requireSource(nativeCapture,"callback({});",'Native authority must defensively deny a second stale custom capture callback.');
requireSource(preload,"ipcRenderer.invoke('desktop:native-capture-capability')",'Renderer does not read the final native capture authority.');
requireSource(preload,'systemSharePicker: nativeSystemPicker','Renderer does not advertise native picker authority to the meeting engine.');
requireSource(preload,'customSharePicker: !nativeSystemPicker','Renderer does not disable the custom picker when native capture owns the request.');
requireSource(engine,'const useNativeSystemPicker=Boolean(desktopRuntime?.systemSharePicker)','Meeting engine does not read the desktop picker capability.');
requireSource(engine,'window.dominionDesktop?.isDesktop && !useNativeSystemPicker && window.DominionDesktopSharePicker?.choose','Meeting engine still risks opening the custom picker before the macOS system picker.');

console.log('PASS all-track camera privacy and single-authority macOS screen-share guardrails.');
