import fs from 'node:fs';

const engine=fs.readFileSync(new URL('../assets/js/meeting-engine.js',import.meta.url),'utf8');
const ui=fs.readFileSync(new URL('../assets/js/meet-next/executive6.js',import.meta.url),'utf8');
const shareView=fs.readFileSync(new URL('../assets/js/meet/share-view-controls.js',import.meta.url),'utf8');
const main=fs.readFileSync(new URL('../desktop 2/src/main-v2.mjs',import.meta.url),'utf8');
const bootstrap=fs.readFileSync(new URL('../desktop 2/src/bootstrap.mjs',import.meta.url),'utf8');
const preload=fs.readFileSync(new URL('../desktop 2/src/preload.cjs',import.meta.url),'utf8');
const nativeCapture=fs.readFileSync(new URL('../desktop 2/src/macos-native-capture-authority.mjs',import.meta.url),'utf8');
const netlify=fs.readFileSync(new URL('../netlify.toml',import.meta.url),'utf8');
const headers=fs.readFileSync(new URL('../_headers',import.meta.url),'utf8');

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

// Desktop authority: the installed client owns a branded source picker backed
// by Electron desktopCapturer. Apple/Electron native picker capability can be
// detected as fallback capability but cannot silently replace DominionStar.
requireSource(main,'function supportsMacSystemPicker() {\n  return false;\n}','Main capture handler must keep the native system picker disabled by default.');
requireSource(main,"types: ['screen', 'window']",'DominionStar desktop capture handler must enumerate real screens and windows.');
requireSource(bootstrap,'macos-native-capture-authority.mjs','Desktop bootstrap must retain capture-capability reporting.');
requireSource(nativeCapture,"authority: 'dominionstar-custom-picker'",'macOS capability must report DominionStar as primary capture authority.');
requireSource(nativeCapture,'enabled: false','Native Apple picker must not be enabled as the default user-facing picker.');
requireSource(nativeCapture,'available: supportsNativeMacPicker()','Native picker availability may remain detectable as fallback capability.');
requireSource(preload,"ipcRenderer.invoke('desktop:native-capture-capability')",'Renderer does not read the final capture authority.');
requireSource(preload,'systemSharePicker: nativeSystemPicker','Renderer must expose the final system-picker state.');
requireSource(preload,'customSharePicker: !nativeSystemPicker','Renderer must expose the branded picker when native mode is disabled.');
requireSource(engine,'const useNativeSystemPicker=Boolean(desktopRuntime?.systemSharePicker)','Meeting engine must consume the desktop picker capability.');
requireSource(engine,'window.dominionDesktop?.isDesktop && !useNativeSystemPicker && window.DominionDesktopSharePicker?.choose','Meeting engine must route desktop sharing through the approved DominionStar picker.');

// Web/Netlify authority: standards-compliant browsers must own their own
// screen/window chooser via getDisplayMedia. The web build is intentionally
// lighter and must never depend on Electron/native permission bridges.
requireSource(engine,'navigator.mediaDevices.getDisplayMedia(displayOptions)','Browser sharing must use standards-native getDisplayMedia.');
requireSource(shareView,'const isDesktop = Boolean(window.dominionDesktop?.isDesktop)','Share controls must explicitly distinguish desktop from browser runtime.');
requireSource(shareView,"if (isDesktop && !document.querySelector('script[data-ds-operation-2030-bootstrap]'))",'Ordinary browsers must not auto-load the full desktop Operation 2030 bootstrap.');
requireSource(shareView,'media.__dsWebDisplayMediaBoundary = true','Browser display-media normalization boundary is missing.');
requireSource(shareView,'if (!window.isSecureContext)','Browser sharing must fail clearly outside HTTPS instead of presenting a misleading permission error.');
requireSource(shareView,"audio: chromiumFamily && Boolean(requested.audio)",'Safari/Firefox screen sharing must not be blocked by unsupported system-audio requests.');
requireSource(shareView,"name === 'NotAllowedError' || name === 'SecurityError'",'Browser/OS screen-share denial must have an actionable recovery message.');
requireSource(shareView,"name === 'InvalidStateError'",'Browser transient-user-activation failures must be diagnosed separately.');
requireSource(netlify,'Permissions-Policy = "camera=(self), microphone=(self), display-capture=(self), fullscreen=(self)"','Netlify Meet route must explicitly allow browser camera, microphone, display capture and fullscreen.');
requireSource(headers,'Permissions-Policy: camera=(self), microphone=(self), display-capture=(self), fullscreen=(self)','Published Netlify headers must preserve Meet media/display-capture permissions.');

console.log('PASS camera privacy plus desktop/browser single-authority screen-share guardrails.');
