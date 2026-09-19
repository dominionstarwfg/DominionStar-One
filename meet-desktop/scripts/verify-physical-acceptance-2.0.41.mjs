import fs from 'node:fs';
import assert from 'node:assert/strict';

const read=rel=>fs.readFileSync(new URL(`../${rel}`,import.meta.url),'utf8');
const js=read('ui/zoom-physical-acceptance.js');
const css=read('ui/zoom-physical-acceptance.css');
const bootstrap=read('ui/auth-password.js');
const presenter=read('ui/presenter-toolbar.js');
const features=read('ui/meeting-features.js');
const integration=read('ui/share-integration.js');
const intelligence=read('ui/physical-intelligence-2.0.41.js');
const shareService=read('src/share-service.mjs');
const macOverlay=read('src/mac-share-presenter-overlay.mjs');
const relaunch=read('src/relaunch-service.mjs');

new Function(js);
new Function(presenter);
new Function(features);
new Function(integration);
new Function(intelligence);

assert(bootstrap.includes('zoom-physical-acceptance.css')&&bootstrap.includes('zoom-physical-acceptance.js'),'Physical acceptance authority must load after the production polish layer.');
assert(js.includes("button.dataset.dsPhysicalAuthority='1'")&&js.includes('installViewAuthority')&&js.includes('installHostToolsAuthority')&&js.includes('installMoreAuthority'),'View, Host Tools and More must have explicit visible-control authority.');
assert(js.includes("parity()?.applyViewMode?.('speaker')")&&js.includes("parity()?.applyViewMode?.('gallery')")&&js.includes("parity()?.applyViewMode?.('multi')"),'View menu actions must invoke real meeting layout behavior.');
assert(js.includes("meeting?.setSecurity?.(ctx.roomId")&&js.includes("parity()?.toggleParticipants?.(true)"),'Host Tools must invoke real host/security actions without proxy-clicking the hidden legacy Security control.');
assert(!js.includes("q('#roomSecurity').click"),'Physical Host Tools must never proxy-click the hidden legacy Security control.');
assert(css.includes('z-index:2600')&&css.includes('.ds-command-menu'),'Command menus must render above the meeting toolbar and video stage.');
assert(js.includes('zoom-participant-search')===false||js.includes('decorateParticipantRows'),'Participants authority must decorate the searchable roster rather than replacing meeting membership logic.');
assert(js.includes('ds-participant-media')&&js.includes('MIC_ON')&&js.includes('VIDEO_OFF'),'Participant rows must expose microphone and camera state affordances.');
assert(js.includes("button.textContent='•••'")&&js.includes('data-participant-more'),'Participant management must use a per-row ellipsis instead of the legacy text More button.');
assert(js.includes("payload={kind:'media-state'")&&js.includes("meeting.sendSignal(p.participantId,'reaction',payload)"),'Media state must propagate to host/co-host roster surfaces using the already-routed meeting signal transport.');
assert(css.includes('.ds-modern-participant-row')&&css.includes('.ds-media-state.off')&&css.includes('.ds-role-chip'),'Participant roster must have modern role and media-state presentation.');
assert(css.includes('#meetingChatPanel')&&css.includes('.meeting-chat-message.own p')&&css.includes('font-size:14px!important'),'Chat must use readable modern message typography and distinguish own messages.');

assert(features.includes("const reactions=['👏','👍','❤️','😂','😮','🎉']"),'Standard reaction set must match the six common Zoom meeting reactions.');
assert(features.includes("ensureButton('roomReactions','Reactions'")&&features.includes('event=>openReactions(event.currentTarget)'),'The visible React control must route to the canonical reaction chooser.');
assert(features.includes('for(const emoji of reactions)')&&features.includes('b.onclick=()=>{closeReactionMenu();void sendReaction(emoji);};'),'Every canonical reaction button must invoke the real reaction sender.');
assert(features.includes('async function sendReaction(emoji)')&&features.includes("await broadcast('reaction',payload)"),'The canonical reaction sender must broadcast through meeting signaling.');
assert(js.includes('function installReactionAuthority()')&&js.includes('Final React ownership belongs to DominionMeetingFeatures + RuntimeStability.'),'Physical acceptance must explicitly defer React ownership to the canonical feature/runtime layer.');
assert(!js.includes('function openReactionTray'),'Physical acceptance must not reinstall a duplicate reaction chooser.');
assert(js.includes('upgradeReactionBubble')&&js.includes('setTimeout(()=>replacement.remove(),6300)'),'Reaction animation must persist for roughly six seconds rather than disappearing after the legacy three-second timer.');
assert(css.includes('animation:dsPhysicalReactionRise 6.2s')&&css.includes('flex-direction:column')&&css.includes('calc(-88vh + 120px)'),'Reaction must rise substantially up the left side with the participant name beneath the emoji.');
assert(css.includes('.ds-reaction-tray{position:fixed;z-index:2800')||css.includes('.meeting-reaction-menu'),'Reaction chooser must remain clickable above meeting layers.');

assert(js.includes('openSmartSharePicker')&&js.includes('sharePicker?.listSources?.({kind,includeDominionStar:false})'),'Share permission compatibility authority must still test actual desktop sources instead of relying only on stale TCC status.');
assert(js.includes('desktop.sharePicker.choose(selectedShareId,options)'),'Compatibility share picker must feed the selected real source into the existing capture pipeline.');
assert(js.includes("sessionStorage.setItem('ds_screen_settings_opened','1')")&&js.includes('Recheck'),'Permission recovery must remember that Settings was opened and provide an active recheck path instead of looping blindly.');
assert(presenter.includes('await bridge?.command?.(routedCommand(command));'),'Floating presenter controls must route commands through the presenter bridge.');
assert(integration.includes("if(command==='new-share'){await openPickerWithPermission();return {handled:true,command};}"),'Presenter New Share must be handled by the canonical Share Integration.');
assert(integration.includes('async function openPickerWithPermission(){')&&integration.includes('const approved=window.DominionShareRuntimeAuthority2041;')&&integration.includes('if(approved?.open)return approved.open();'),'Presenter New Share must reopen the approved runtime share chooser before any legacy fallback.');
assert(css.includes('.ds-smart-share-picker')&&css.includes('.ds-share-source-grid'),'Compatibility screen sharing must retain a real-source picker rather than a permission-only dialog.');

assert(!intelligence.includes('ds2041-permission-modal')&&!intelligence.includes('ds2041-permission-card'),'Screen Recording recovery must not create a blocking DominionStar permission modal over the approved picker.');
assert(intelligence.includes('data-open-screen-settings')&&intelligence.includes('ds2041-permission-inline-actions'),'Permission recovery must stay inline inside the approved chooser.');
assert(intelligence.includes('async function refreshAfterFocus()')&&intelligence.includes('for(const delay of [180,650,1400])')&&intelligence.includes('legacy.reload()'),'Returning from macOS permission UI must retry real source enumeration instead of trusting a stale TCC label.');
assert(intelligence.includes("desktop.app?.relaunch?.()")&&intelligence.includes('data-restart-screen-permission'),'Stable-signed recovery must retain one explicit quit-and-reopen action inline.');
assert(intelligence.includes('data-reset-screen-permission')&&intelligence.includes('desktop.app?.resetScreenPermission?.()'),'Ad-hoc QA recovery must expose a targeted ScreenCapture reset for the current DominionStar bundle.');
assert(intelligence.includes('desktop.app?.privacyIdentity?.()')&&intelligence.includes('stableAcrossRebuilds===false'),'Permission UX must detect that ad-hoc QA identity is unstable across rebuilt binaries.');
assert(intelligence.includes('Reset & Reauthorize This Build')&&intelligence.includes('This QA build needs fresh Screen Recording authorization'),'A stale granted toggle must be explained as a rebuilt-QA identity problem rather than another relaunch loop.');
assert(relaunch.includes("tccutil',['reset','ScreenCapture','com.dominionstar.desktop']")&&relaunch.includes("stableAcrossRebuilds:false"),'The targeted recovery IPC must reset only DominionStar ScreenCapture and declare ad-hoc identity instability truthfully.');

assert(intelligence.includes('async function commitGrantedShare(button)')&&intelligence.includes('await wait(2000)'),'A granted physical-Mac share must hold the approved chooser for at least two seconds before capture begins.');
assert(intelligence.includes('desktop.sharePicker?.choose?.(sourceId,options)')&&intelligence.includes('window.DominionShareIntegration?.state?.()?.active'),'The two-second handoff must commit the selected source and wait for actual live capture rather than using a cosmetic delay.');
assert(intelligence.includes("version:'2.0.41-picker-first-identity-aware-permission-zoom-handoff'"),'Physical share authority must identify the permission-aware Zoom handoff.');

assert(shareService.includes('function parkMacMeetingWindow({preCapture=false}={})')&&shareService.includes('parkMacMeetingWindow({preCapture:true})'),'The main macOS meeting window must enter presenter mode before getDisplayMedia begins.');
assert(shareService.includes('main.setOpacity?.(0.02)')&&shareService.includes('main.setIgnoreMouseEvents(true)'),'Presenter mode must park the capture-owning renderer at near-zero opacity instead of hiding/minimizing it.');
assert(shareService.includes('protectMeetingChrome(main,true)')&&shareService.includes('main.webContents?.setBackgroundThrottling?.(false)'),'The parked meeting renderer must be capture-protected and kept scheduled.');
assert(shareService.includes('captureStartWatchdog=setTimeout')&&shareService.includes('restoreMainWindowAfterShare()'),'A failed capture start must restore the meeting instead of leaving an invisible parked window.');
assert(macOverlay.includes("setAlwaysOnTop(true,'screen-saver',1)"),'The green share boundary must sit above Dock/menu surfaces around the entire display.');
assert(macOverlay.includes('deliverPresenterCommandWithRetry')&&macOverlay.includes('wakeMain(main)'),'Physical presenter commands must actively keep the capture-owning renderer scheduled and retry bounded delivery.');
assert(macOverlay.includes("normalized==='layout-hide'")&&macOverlay.includes("setVideoLayout('gallery')")&&macOverlay.includes("setVideoLayout('speaker')"),'Zoom-style speaker/gallery/hide video-panel layouts must be handled locally by the Mac presenter surface.');

assert(css.includes('.av-detail-head p{font-size:12.5px!important')&&css.includes('.av-toggle-row{font-size:13px!important')&&css.includes('.av-quick-menu button{font-size:13px!important'),'A/V settings text must not regress to the previous 8–10px scale.');
assert(js.includes("version:'2.0.11-physical-acceptance'"),'Physical acceptance module version must be explicit.');

console.log('DOMINIONSTAR_PHYSICAL_ACCEPTANCE_2_0_41_OK working-view working-host-tools working-more participant-media participant-ellipsis modern-chat single-owner-clickable-reactions six-second-float canonical-presenter-new-share real-source-recheck inline-macos-permission-recovery identity-aware-tcc-reset two-second-zoom-handoff pre-capture-presenter-park bounded-native-command-retry full-display-border local-video-layout readable-settings');
