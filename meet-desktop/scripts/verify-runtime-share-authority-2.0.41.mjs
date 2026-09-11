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

// Physical Mac repair: check the OS permission state before screen enumeration.
// This prevents desktopCapturer from triggering the native Apple permission
// prompt underneath DominionStar's own recovery surface.
assert(personalRoom.includes("script.src='./physical-intelligence-2.0.41.js'"),'The late physical intelligence repair must load after the primary meeting scripts.');
assert(intelligence.includes('legacy.dispose()'),'Permission-aware authority must remove the older Share click interceptor before taking ownership.');
assert(intelligence.includes("desktop.media?.permissions?.()")&&intelligence.includes("if(status==='granted')"),'Share must read macOS Screen Recording state before invoking the real source chooser.');
assert(intelligence.indexOf("if(status==='granted')")<intelligence.indexOf('return await legacy.open()'),'Permission readiness must gate source enumeration, not run after it.');
assert(intelligence.includes("if(status==='not-determined')")&&intelligence.includes('recovery.hidden=true')&&intelligence.includes('desktop.media?.requestScreen?.()'),'First-ever native TCC registration must hide DominionStar recovery so two permission dialogs cannot stack.');
assert(intelligence.includes("desktop.media?.openPrivacy?.('screen')")&&intelligence.includes('window.addEventListener(\'focus\',onFocus)'),'Returning from System Settings must trigger an automatic permission recheck.');
assert(intelligence.includes("copy.textContent='DominionStar Meet can now read your screen. Opening the approved Screens / Files / More chooser…'")&&intelligence.includes('return legacy.open()'),'A granted permission must automatically continue into the approved chooser without asking again.');
assert(intelligence.includes("copy.textContent='macOS has not exposed the new Screen Recording grant to this running process yet."),'A stale TCC process must be identified as a restart condition rather than another grant request.');
assert(intelligence.includes('left:auto!important')&&intelligence.includes('width:auto!important')&&intelligence.includes('max-width:max-content!important'),'Prejoin Backgrounds control must be explicitly compact and cannot inherit the rejected full-width overlay geometry.');
assert(!intelligence.includes('#homeSection')&&!intelligence.includes('.home-grid')&&!intelligence.includes('.action-card'),'Physical intelligence repair must not alter the locked Home surface.');

console.log('DOMINIONSTAR_RUNTIME_SHARE_AUTHORITY_2_0_41_OK one-primary-share-command permission-before-enumeration no-stacked-tcc-dialog automatic-grant-recheck compact-prejoin approved-screens-files-more real-source-bridge no-second-capture-owner home-locked');
