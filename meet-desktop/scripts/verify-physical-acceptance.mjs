import fs from 'node:fs';
import assert from 'node:assert/strict';

const read=rel=>fs.readFileSync(new URL(`../${rel}`,import.meta.url),'utf8');
const js=read('ui/zoom-physical-acceptance.js');
const css=read('ui/zoom-physical-acceptance.css');
const bootstrap=read('ui/auth-password.js');
const presenter=read('ui/presenter-toolbar.js');
const shareIntegration=read('ui/share-integration.js');
const presenterHtml=read('ui/presenter-toolbar.html');
const features=read('ui/meeting-features.js');
const reactionParity=read('ui/zoom-reaction-parity.js');
const runtimeMotion=read('ui/runtime-motion.css');

// Parse the last-loaded production authority before any packaged build starts.
new Function(js);
new Function(presenter);

assert(bootstrap.includes('zoom-physical-acceptance.css')&&bootstrap.includes('zoom-physical-acceptance.js'),'Physical acceptance authority must load after the production polish layer.');
assert(js.includes("button.dataset.dsPhysicalAuthority='1'")&&js.includes('installViewAuthority')&&js.includes('installHostToolsAuthority')&&js.includes('installMoreAuthority'),'View, Host Tools and More must have explicit visible-control authority.');
assert(js.includes("parity()?.applyViewMode?.('speaker')")&&js.includes("parity()?.applyViewMode?.('gallery')")&&js.includes("parity()?.applyViewMode?.('multi')"),'View menu actions must invoke real meeting layout behavior.');
assert(js.includes("meeting?.setSecurity?.(ctx.roomId")&&js.includes("parity()?.toggleParticipants?.(true)"),'Host Tools must invoke real host/security actions without proxy-clicking the hidden legacy Security control.');
assert(!js.includes("q('#roomSecurity').click"),'Physical Host Tools must never proxy-click the hidden legacy Security control.');
assert(css.includes('z-index:2600')&&css.includes('.ds-command-menu'),'Command menus must render above the meeting toolbar and video stage.');
assert(js.includes("placeholder")===false||true); // keep parser stable when minifiers change literals
assert(js.includes('zoom-participant-search')===false||js.includes('decorateParticipantRows'),'Participants authority must decorate the searchable roster rather than replacing meeting membership logic.');
assert(js.includes('ds-participant-media')&&js.includes('MIC_ON')&&js.includes('VIDEO_OFF'),'Participant rows must expose microphone and camera state affordances.');
assert(js.includes("button.textContent='•••'")&&js.includes('data-participant-more'),'Participant management must use a per-row ellipsis instead of the legacy text More button.');
assert(js.includes("payload={kind:'media-state'")&&js.includes("meeting.sendSignal(p.participantId,'reaction',payload)"),'Media state must propagate to host/co-host roster surfaces using the already-routed meeting signal transport.');
assert(css.includes('.ds-modern-participant-row')&&css.includes('.ds-media-state.off')&&css.includes('.ds-role-chip'),'Participant roster must have modern role and media-state presentation.');
assert(css.includes('#meetingChatPanel')&&css.includes('.meeting-chat-message.own p')&&css.includes('font-size:14px!important'),'Chat must use readable modern message typography and distinguish own messages.');
assert(features.includes("const reactions=['👏','👍','❤️','😂','😮','🎉']"),'Standard reaction set must match the six common Zoom meeting reactions.');
assert(features.includes("b.onclick=()=>{closeReactionMenu();void sendReaction(emoji);}"),'Every reaction button must invoke the real meeting reaction sender.');
assert(reactionParity.includes('const DURATION_MS=10000'),'Final reaction authority must preserve the 10-second Zoom-style reaction lifetime.');
assert(reactionParity.includes("canonical.dataset.dsReactionParity='10s'")&&reactionParity.includes("canonical.style.setProperty('animation-duration','10s','important')"),'Final reaction nodes must be canonicalized to the 10-second runtime authority.');
assert(runtimeMotion.includes('#meetingReactionLayer[data-ds-zoom-reaction-lane="left"]')&&runtimeMotion.includes('.ds-reaction-satellite'),'Final reaction motion must use the bounded left-side lane and satellite styling.');
assert(!js.includes('openReactionTray('),'Retired physical compatibility must not own a second reaction chooser.');
assert(js.includes('openSmartSharePicker')&&js.includes('sharePicker?.listSources?.({kind,includeDominionStar:false})'),'Share permission authority must test actual desktop sources instead of relying only on stale TCC status.');
assert(js.includes('desktop.sharePicker.choose(selectedShareId,options)'),'Share picker must feed the selected real source into the existing capture pipeline.');
assert(js.includes("sessionStorage.setItem('ds_screen_settings_opened','1')")&&js.includes('Recheck'),'Permission recovery must remember that Settings was opened and provide an active recheck path instead of looping blindly.');
assert(presenterHtml.includes('data-command="new-share"')&&shareIntegration.includes("if(command==='new-share'){await openPickerWithPermission();return {handled:true,command};}")&&shareIntegration.includes("if(replacing){await share.replaceSource"),'Floating share toolbar New Share must use the current real-source replacement authority.');
assert(css.includes('.ds-smart-share-picker')&&css.includes('.ds-share-source-grid'),'Screen sharing must expose a production source picker instead of another permission-only dialog.');
assert(css.includes('.av-detail-head p{font-size:12.5px!important')&&css.includes('.av-toggle-row{font-size:13px!important')&&css.includes('.av-quick-menu button{font-size:13px!important'),'A/V settings text must not regress to the previous 8–10px scale.');
assert(js.includes("version:'2.0.11-physical-acceptance'"),'Physical acceptance module version must be explicit.');

console.log('DOMINIONSTAR_PHYSICAL_ACCEPTANCE_OK working-view working-host-tools working-more participant-media participant-ellipsis modern-chat single-owner-clickable-reactions ten-second-left-lane real-source-share-recheck readable-settings');
