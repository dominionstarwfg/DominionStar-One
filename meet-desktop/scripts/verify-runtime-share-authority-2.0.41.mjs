import fs from 'node:fs';
import assert from 'node:assert/strict';

const read=rel=>fs.readFileSync(new URL(`../${rel}`,import.meta.url),'utf8');
const pkg=JSON.parse(read('package.json'));
const index=read('ui/index.html');
const authority=read('ui/share-runtime-authority-2.0.41.js');
const intelligence=read('ui/physical-intelligence-2.0.41.js');
const personalRoom=read('ui/personal-room.js');
const physical=read('ui/zoom-physical-acceptance.js');
const integration=read('ui/share-integration.js');
const controller=read('ui/share-controller.js');
const preload=read('src/preload.cjs');

assert.equal(pkg.version,'2.0.41');
new Function(authority);
new Function(intelligence);

assert(index.includes('<script src="./share-runtime-authority-2.0.41.js"></script>'),'Packaged main renderer must load the single approved physical-share authority.');
assert(index.indexOf('share-runtime-authority-2.0.41.js')>index.indexOf('profile-photo-fallback.js'),'Runtime share authority must load after legacy static meeting decorators.');
assert(authority.includes("window.addEventListener('click',intercept,true)"),'Approved share authority must intercept at window capture before the rejected element-level legacy picker.');
assert(authority.includes("target.closest('#roomShare')")&&authority.includes("target.closest('[data-inline-command=\"new-share\"]')"),'Primary Share and presenter New Share must use the same approved runtime chooser.');
assert(authority.includes('event.stopImmediatePropagation()'),'Approved share authority must prevent the older physical-acceptance picker from receiving the same click.');
assert(authority.includes("pickerBridge.listSources({kind:'screen',includeDominionStar})")&&authority.includes("pickerBridge.listSources({kind:'window',includeDominionStar})"),'Approved runtime chooser must enumerate the same real screen/window bridge proven on physical Mac.');
assert(authority.includes('pickerBridge.choose(source.id,options)'),'Approved runtime chooser must commit the real selected source into the certified source-selection IPC.');
assert(preload.includes("sharePicker:Object.freeze({listSources:options=>invoke('share:list-sources',options),choose:(sourceId,options)=>invoke('share:select-source'"),'Runtime chooser must remain on the isolated preload source bridge.');
assert(!authority.includes('getDisplayMedia'),'Runtime chooser must not become a second display-capture owner.');
assert(controller.includes('navigator.mediaDevices.getDisplayMedia'),'ShareController must remain the sole renderer display-capture owner.');
assert(integration.includes('bridge?.onSourceSelected?.(async selection=>'),'ShareIntegration must remain the selected-source consumer that starts or replaces ShareController capture.');
assert(authority.includes("qa('.ds-smart-share-picker,.ds-share-permission,.ds-219-share-recovery,#screenPermissionDialog')"),'Approved runtime authority must suppress rejected duplicate physical-share/recovery surfaces.');
for(const label of ['Screens','Files','More','Presenter layout','Content only','As background','Over the shoulder','Side by side','Share sound','Optimize for video sharing','Share DominionStar Meet windows'])assert(authority.includes(label),`Approved runtime chooser is missing ${label}.`);
assert(authority.includes("desktop.media?.openPrivacy?.('screen')")&&authority.includes('desktop.app?.relaunch?.()'),'Legacy recovery remains bounded to macOS Settings plus one controlled app relaunch.');
assert(!authority.includes('Recheck'),'Permission recovery must not return to the rejected same-process Recheck loop.');
assert(!authority.includes('Share This Window')&&!authority.includes('Share Entire Screen')&&!authority.includes('Share All Application Windows'),'Apple system picker language must not return in the approved runtime chooser.');
assert(!authority.includes('#homeSection')&&!authority.includes('.app-shell')&&!authority.includes('.home-grid'),'Screen-share repair must not mutate the locked Home surface.');
assert(physical.includes("button.addEventListener('click',event=>{if(!inMeeting())return;event.preventDefault();event.stopImmediatePropagation();event.currentTarget.blur();void openSmartSharePicker();},true)"),'Legacy physical picker remains detectable until later cleanup; the new window-capture authority must supersede it without unrelated physical-layer churn.');

// Zoom-style physical Mac repair: the picker comes first; permission is a state inside it.
assert(personalRoom.includes("script.src='./physical-intelligence-2.0.41.js'"),'The late physical intelligence repair must load after the primary meeting scripts.');
assert(intelligence.includes('legacy.dispose()'),'Picker-first authority must remove the older Share click interceptor before taking ownership.');
assert(intelligence.includes("const ok=await legacy.open();")&&intelligence.includes('showPermissionPlaceholders()'),'Share must open the approved chooser first and keep it visible when permission is unavailable.');
const openBody=intelligence.slice(intelligence.indexOf('async function open(){'),intelligence.indexOf('function intercept(event)'));
assert(openBody.includes('const ok=await legacy.open();')&&!openBody.includes('requestScreen'),'Opening Share must present the picker without running a permission request in front of it.');
assert(intelligence.includes('ds2041-permission-placeholder')&&intelligence.includes('Desktop 1'),'A blocked picker must retain a selected Desktop placeholder rather than closing the chooser.');
assert(intelligence.includes("Allow DominionStar Meet to share your screen")&&intelligence.includes("Open System Settings"),'Permission guidance must live inside the approved picker instead of a second full-screen recovery surface.');
assert(intelligence.includes(".ds2041-recovery,.ds2041-smart-recovery,#screenPermissionDialog,.ds-share-permission,.ds-219-share-recovery{display:none!important}"),'Rejected stacked recovery surfaces must be suppressed while the picker-first flow owns permission UX.');
assert(intelligence.includes('async function requestPermissionFromPicker()')&&intelligence.includes('desktop.media?.requestScreen?.()'),'The picker Share action must trigger the real bounded macOS capture-permission path only when needed.');
assert(intelligence.includes("window.addEventListener('focus',onFocus)")&&intelligence.includes('async function recheckAfterSettings()'),'Returning from System Settings must refresh the same open picker automatically.');
assert(intelligence.includes('const ok=await legacy.reload();')&&intelligence.includes("current?.querySelector('.ds2041-permission-modal')?.setAttribute('hidden','')"),'A granted permission must refresh real thumbnails in-place without reopening or replacing the picker.');
assert(intelligence.includes('Stable signed builds will retain the permission like Zoom.'),'QA messaging must distinguish ad-hoc signing limitations from the intended stable signed product behavior.');
assert(intelligence.includes('left:auto!important')&&intelligence.includes('width:auto!important')&&intelligence.includes('max-width:max-content!important'),'Prejoin Backgrounds control must be explicitly compact and cannot inherit the rejected full-width overlay geometry.');
assert(!intelligence.includes('#homeSection')&&!intelligence.includes('.home-grid')&&!intelligence.includes('.action-card'),'Physical intelligence repair must not alter the locked Home surface.');

console.log('DOMINIONSTAR_RUNTIME_SHARE_AUTHORITY_2_0_41_OK one-primary-share-command picker-first-permission zoom-style-in-place-refresh no-stacked-recovery compact-prejoin approved-screens-files-more real-source-bridge no-second-capture-owner home-locked');
