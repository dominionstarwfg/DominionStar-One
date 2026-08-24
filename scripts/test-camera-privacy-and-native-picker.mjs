import fs from 'node:fs';

const engine=fs.readFileSync(new URL('../assets/js/meeting-engine.js',import.meta.url),'utf8');
const ui=fs.readFileSync(new URL('../assets/js/meet-next/executive6.js',import.meta.url),'utf8');
const main=fs.readFileSync(new URL('../desktop 2/src/main-v2.mjs',import.meta.url),'utf8');
const bootstrap=fs.readFileSync(new URL('../desktop 2/src/bootstrap.mjs',import.meta.url),'utf8');
const preload=fs.readFileSync(new URL('../desktop 2/src/preload.cjs',import.meta.url),'utf8');
const nativeCapture=fs.readFileSync(new URL('../desktop 2/src/macos-native-capture-authority.mjs',import.meta.url),'utf8');

const requireSource=(source,needle,message)=>{if(!source.includes(needle))throw new Error(message);};

// Video Off is a physical privacy boundary. Every local video track must be
// detached and physically ended before a new camera track can be acquired.
requireSource(engine,"const cameraTracks=[...(base?.getVideoTracks?.()||[])]",'Video Off does not enumerate every local camera track.');
requireSource(engine,"if(base?.getVideoTracks?.().includes(item)){try{base.removeTrack(item);}catch(_){}}",'Video Off does not remove every camera track from the meeting stream.');
requireSource(engine,"if(item?.readyState!=='ended'){try{item.stop();released=true;}catch(_){}}",'Video Off does not inspect and end every live physical camera track.');
requireSource(engine,"if(released||cameraTracks.length)state.lastCameraReleaseAt=Date.now()",'Video Off does not record hardware release for stable reacquisition.');
requireSource(engine,"Promise.allSettled([...state.peers.values()].map(peer=>syncPeerTracks(peer)))",'Video Off does not clear the negotiated camera senders after hardware release.');
requireSource(ui,"video:state.video?{width:{ideal:1280},height:{ideal:720},frameRate:{ideal:30,max:30}}:false",'Prejoin does not preserve the HD/30 video contract.');
requireSource(ui,"state.stream.removeTrack(track)",'Prejoin Video Off does not release its camera track.');
requireSource(ui,'markPreviewCameraReleased()','Prejoin Video Off does not mark the hardware release boundary before Video On.');

// Approved screen-share architecture: DominionStar owns the visible source
// picker on macOS, Windows and Web. Apple/Electron native picker support may be
// detected as a fallback capability but must not silently replace the approved
// Screens / Application windows experience or create a second picker authority.
requireSource(main,'function supportsMacSystemPicker() {\n  return false;\n}','Main capture handler must keep the native system picker disabled by default.');
requireSource(main,"types: ['screen', 'window']",'DominionStar capture handler must enumerate real screens and windows.');
requireSource(bootstrap,'macos-native-capture-authority.mjs','Desktop bootstrap must retain capture-capability reporting.');
requireSource(nativeCapture,"authority: 'dominionstar-custom-picker'",'macOS capability must report DominionStar as primary capture authority.');
requireSource(nativeCapture,'enabled: false','Native Apple picker must not be enabled as the default user-facing picker.');
requireSource(nativeCapture,'available: supportsNativeMacPicker()','Native picker availability may remain detectable as fallback capability.');
requireSource(preload,"ipcRenderer.invoke('desktop:native-capture-capability')",'Renderer does not read the final capture authority.');
requireSource(preload,'systemSharePicker: nativeSystemPicker','Renderer must expose the final system-picker state.');
requireSource(preload,'customSharePicker: !nativeSystemPicker','Renderer must expose the branded picker when native mode is disabled.');
requireSource(engine,'const useNativeSystemPicker=Boolean(desktopRuntime?.systemSharePicker)','Meeting engine must consume the desktop picker capability.');
requireSource(engine,'window.dominionDesktop?.isDesktop && !useNativeSystemPicker && window.DominionDesktopSharePicker?.choose','Meeting engine must route desktop sharing through the approved DominionStar picker.');

console.log('PASS camera privacy and approved single-authority DominionStar screen-share guardrails.');
