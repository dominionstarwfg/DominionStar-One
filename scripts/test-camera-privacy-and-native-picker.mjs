import fs from 'node:fs';

const engine=fs.readFileSync(new URL('../assets/js/meeting-engine.js',import.meta.url),'utf8');
const ui=fs.readFileSync(new URL('../assets/js/meet-next/executive6.js',import.meta.url),'utf8');
const shareView=fs.readFileSync(new URL('../assets/js/meet/share-view-controls.js',import.meta.url),'utf8');
const main=fs.readFileSync(new URL('../desktop 2/src/main-v2.mjs',import.meta.url),'utf8');
const bootstrap=fs.readFileSync(new URL('../desktop 2/src/bootstrap.mjs',import.meta.url),'utf8');
const preload=fs.readFileSync(new URL('../desktop 2/src/preload.cjs',import.meta.url),'utf8');
const nativeCapture=fs.readFileSync(new URL('../desktop 2/src/macos-native-capture-authority.mjs',import.meta.url),'utf8');
const nativePickerSession=fs.readFileSync(new URL('../desktop 2/src/macos-system-picker-session.mjs',import.meta.url),'utf8');
const screenLifecycle=fs.readFileSync(new URL('../desktop 2/src/screen-permission-lifecycle.mjs',import.meta.url),'utf8');
const customPicker=fs.readFileSync(new URL('../assets/js/meet/desktop-share-picker.js',import.meta.url),'utf8');
const netlify=fs.readFileSync(new URL('../netlify.toml',import.meta.url),'utf8');
const headers=fs.readFileSync(new URL('../_headers',import.meta.url),'utf8');

const requireSource=(source,needle,message)=>{if(!source.includes(needle))throw new Error(message);};
const forbidSource=(source,needle,message)=>{if(source.includes(needle))throw new Error(message);};

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

// Physical-Mac authority: macOS 15+ must use Electron's native system picker.
// DominionStar's branded picker remains a fallback only when the system picker
// is unavailable.
requireSource(bootstrap,'macos-native-capture-authority.mjs','Desktop bootstrap must retain capture-capability reporting.');
requireSource(bootstrap,'macos-system-picker-session.mjs','Desktop bootstrap must install the physical-Mac system-picker session authority.');
requireSource(nativeCapture,'const nativePicker = supportsNativeMacPicker()','macOS capture authority must resolve system-picker support once per request.');
requireSource(nativeCapture,"enabled: nativePicker",'macOS 15+ capability must enable the native system picker.');
requireSource(nativeCapture,"nativePicker ? 'macos-system-picker' : 'dominionstar-custom-picker'",'macOS capability must expose native authority with DominionStar fallback.');
requireSource(nativePickerSession,"session.fromPartition(DESKTOP_PARTITION)",'Native picker must target the same persistent DominionStar desktop session.');
requireSource(nativePickerSession,'{ useSystemPicker: true }','macOS 15+ display capture must opt into Electron native system-picker handling.');
requireSource(main,"types: ['screen', 'window']",'DominionStar fallback capture handler must still enumerate real screens and windows.');
requireSource(preload,"ipcRenderer.invoke('desktop:native-capture-capability')",'Renderer does not read the final capture authority.');
requireSource(preload,'systemSharePicker: nativeSystemPicker','Renderer must expose the final system-picker state.');
requireSource(preload,'customSharePicker: !nativeSystemPicker','Renderer must expose the branded picker only when native mode is unavailable.');
requireSource(preload,'installDesktopMeetRuntimeLayers','Desktop preload must own installation of the advanced Meet runtime.');
requireSource(preload,'/assets/js/meet/operation-2030-bootstrap.js?v=13-clean-desktop-runtime','Desktop preload must own the Operation 2030 bootstrap URL.');
requireSource(engine,'const useNativeSystemPicker=Boolean(desktopRuntime?.systemSharePicker)','Meeting engine must consume the desktop picker capability.');
requireSource(engine,'window.dominionDesktop?.isDesktop && !useNativeSystemPicker && window.DominionDesktopSharePicker?.choose','Meeting engine must skip the custom picker when native system selection is active.');
requireSource(engine,'navigator.mediaDevices.getDisplayMedia(displayOptions)','Native Mac and browser sharing must enter standards getDisplayMedia after source authority is resolved.');

// Physical freeze regression: the fallback UI is deliberately non-modal so a
// stalled or denied share attempt cannot lock every other meeting control. The
// fallback checks lightweight TCC permission before it ever asks Electron to
// enumerate desktop sources, and all IPC/source waits remain time-bounded.
requireSource(customPicker,'dialog.show()','Fallback share picker must be visible without entering modal UI state.');
forbidSource(customPicker,'dialog.showModal()','Fallback share picker must stay non-modal so the meeting cannot be UI-locked.');
requireSource(customPicker,'#desktopSharePicker::backdrop{background:transparent}','Fallback picker must not place a blocking backdrop over the meeting.');
requireSource(customPicker,'const withTimeout=','Fallback share picker must bound native IPC waits instead of freezing indefinitely.');
requireSource(customPicker,'const requestSources=()=>withTimeout','Fallback source enumeration must have an explicit timeout.');
const permissionIndex=customPicker.indexOf('const permissionState=await status()');
const sourceIndex=customPicker.indexOf('next=await requestSources()');
if(permissionIndex<0||sourceIndex<0||permissionIndex>sourceIndex)throw new Error('macOS fallback must check permission before desktop source enumeration.');
requireSource(customPicker,"if(screen!=='granted'||permissionState?.requiresRestart){showProblem(permissionState);return;}",'Fallback must refuse source enumeration until macOS reports granted access and no restart is pending.');
requireSource(screenLifecycle,"systemPreferences.getMediaAccessStatus('screen')",'Permission lifecycle must use the lightweight macOS TCC status API.');
forbidSource(screenLifecycle,'desktopCapturer','Permission-status IPC must never enumerate desktop sources.');
requireSource(screenLifecycle,'captureProbed:false','Permission status must explicitly remain a non-capture diagnostic.');

// Web/Netlify authority: standards-compliant browsers own their own chooser via
// getDisplayMedia. The web build must not depend on Electron/native bridges.
requireSource(shareView,'const isDesktop = Boolean(window.dominionDesktop?.isDesktop)','Share controls must explicitly distinguish desktop from browser runtime.');
forbidSource(shareView,"bootstrap.src = '/assets/js/meet/operation-2030-bootstrap.js",'Web share controls must never bootstrap Operation 2030; desktop preload is the sole owner.');
requireSource(shareView,"if (!isDesktop && !document.querySelector('script[data-ds-share-annotation]'))",'Browser share fallbacks must be explicitly excluded from desktop mode.');
requireSource(shareView,"if (!isDesktop && !document.querySelector('script[data-ds-share-arbitration]'))",'Browser arbitration fallback must be explicitly excluded from desktop mode.');
requireSource(shareView,'media.__dsWebDisplayMediaBoundary = true','Browser display-media normalization boundary is missing.');
requireSource(shareView,'if (!window.isSecureContext)','Browser sharing must fail clearly outside HTTPS instead of presenting a misleading permission error.');
requireSource(shareView,"audio: chromiumFamily && Boolean(requested.audio)",'Safari/Firefox screen sharing must not be blocked by unsupported system-audio requests.');
requireSource(shareView,"name === 'NotAllowedError' || name === 'SecurityError'",'Browser/OS screen-share denial must have an actionable recovery message.');
requireSource(shareView,"name === 'InvalidStateError'",'Browser transient-user-activation failures must be diagnosed separately.');
requireSource(netlify,'Permissions-Policy = "camera=(self), microphone=(self), display-capture=(self), fullscreen=(self)"','Netlify Meet route must explicitly allow browser camera, microphone, display capture and fullscreen.');
requireSource(headers,'Permissions-Policy: camera=(self), microphone=(self), display-capture=(self), fullscreen=(self)','Published Netlify headers must preserve Meet media/display-capture permissions.');

console.log('PASS camera privacy plus native Mac picker and permission-first non-blocking fallback ownership.');
