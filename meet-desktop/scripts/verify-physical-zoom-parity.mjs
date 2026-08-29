import fs from 'node:fs';
import assert from 'node:assert/strict';
const read=rel=>fs.readFileSync(new URL(`../${rel}`,import.meta.url),'utf8');
const physical=read('ui/physical-zoom-parity.js');
const physicalCss=read('ui/physical-zoom-parity.css');
const authBootstrap=read('ui/auth-password.js');
const app=read('ui/app.js');
const av=read('ui/av-settings.js');
const preload=read('src/preload.cjs');
const shareService=read('src/share-service.mjs');
const shareIntegration=read('ui/share-integration.js');
const sourceAuthority=read('src/share-source-authority.mjs');
const pickerHtml=read('ui/share-picker.html');
const picker=read('ui/share-picker.js');
const participantsHtml=read('ui/participants-window.html');
const participantsCss=read('ui/participants-window.css');
const participants=read('ui/participants-window.js');

assert(authBootstrap.includes("physical-zoom-parity.css")&&authBootstrap.includes("physical-zoom-parity.js"),'Physical Zoom parity layer must load in every desktop session.');
assert(av.includes("caret.className='av-device-caret attached-device-caret'")&&av.includes("button.insertAdjacentElement('afterend',caret)"),'Mic/Video device arrows must be created adjacent to the corresponding control.');
assert(physical.includes("if(button.nextElementSibling!==caret)button.insertAdjacentElement('afterend',caret)"),'Toolbar reconciliation must repair any detached Mic/Video caret instead of leaving orphan arrows.');
assert(physicalCss.includes('.av-device-caret.zoom-attached-caret')&&physicalCss.includes('margin-left:-20px'),'Physical toolbar must visually bind each device caret to its Mic/Video split control.');
assert(physical.includes("setFallback(q('#prejoinAvatar'),currentUser)")&&physical.includes("setFallback(q('#stageAvatar'),currentUser)"),'Signed-in profile picture must be used for camera-off prejoin and meeting stage fallback.');
assert(app.includes('id="stageAvatar"')&&app.includes('id="prejoinAvatar"'),'Camera-off profile fallback surfaces must exist.');
assert(physical.includes("detail.type||'')!=='host:media-state'")&&physical.includes('syncRemoteProfiles()'),'Remote camera-off identity must propagate to video-tile fallback.');

assert(shareService.includes("ipcMain.handle('share:open-picker',()=>openPicker())"),'Share must open the source chooser before consulting stale macOS screen status.');
assert(!shareIntegration.includes('requestScreen?.()'),'Renderer Share flow must not gate the picker with stale systemPreferences screen status.');
assert(shareIntegration.includes('openSharePicker')&&shareIntegration.includes('await bridge.openPicker()'),'In-meeting Share must route directly to the independent picker window.');
assert(sourceAuthority.includes('const sourceMaps=new Map()')&&sourceAuthority.includes('mergedMap().get'),'Screen and application source groups must coexist in one chooser session.');
assert(pickerHtml.includes('Entire screen')&&pickerHtml.includes('Application windows'),'Share chooser must visibly separate entire displays and application windows.');
assert(picker.includes("kind:'screen'")&&picker.includes("kind:'window'"),'Share chooser must enumerate real screens and windows.');
assert(picker.includes('const first=screens[0]||windows[0]||null'),'Share chooser must preselect the first available source.');
assert(pickerHtml.includes('Share sound')&&pickerHtml.includes('Optimize for video sharing'),'Share chooser must expose functional sound and optimization options.');
assert(!pickerHtml.includes('Presenter layout'),'Do not ship decorative presenter-layout controls without implemented presenter-layout behavior.');

assert(preload.includes('participants:Object.freeze'),'Participants utility window must use a narrow preload bridge.');
assert(shareService.includes("titleBarStyle:platform==='darwin'?'hiddenInset':'default'"),'Participants must be a macOS native-style utility BrowserWindow.');
assert(shareService.includes('positionParticipants(participantWindow)')&&shareService.includes('(bounds.width-width)/2')&&shareService.includes('bounds.y+78'),'Participants utility must initially open near top-center of the meeting.');
assert(participantsHtml.includes('Invite')&&participantsHtml.includes('Mute All')&&participantsHtml.includes('More'),'Participants footer must follow the Zoom Invite / Mute All / More hierarchy.');
assert(!participantsHtml.includes('Ask All to Unmute</button><button'),'Secondary bulk controls must not be permanently exposed in the Participants footer.');
assert(participantsHtml.includes('Ask All to Unmute')&&participantsHtml.includes('Mute participants upon entry')&&participantsHtml.includes('Play join and leave sound'),'Participants More menu must contain the secondary host controls.');
assert(participants.includes("meeting.sendSignal?.(id,'host:mute'")||participants.includes("add('Mute','host:mute')"),'Per-participant Mute must remain functional.');
assert(participants.includes("add('Ask to Unmute','host:ask-unmute')")&&participants.includes("add('Stop Video','host:stop-video')")&&participants.includes("add('Ask to Start Video','host:ask-start-video')"),'Per-participant audio/video request controls must remain functional.');
assert(physical.includes("desktop.participants?.toggle?.()")&&physical.includes("side.hidden=true"),'Main Participants control must open the utility window and keep the obsolete inline panel hidden.');
assert(participantsCss.includes('-webkit-app-region:drag'),'Participants title bar must be independently draggable like a utility window.');

console.log('DOMINIONSTAR_PHYSICAL_ZOOM_PARITY_OK attached-av-carets profile-camera-off-fallback no-stale-screen-gate functional-source-picker native-participants-window invite-mute-more remote-avatar-state');
