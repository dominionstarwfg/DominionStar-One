import fs from 'node:fs';
import assert from 'node:assert/strict';

const read=rel=>fs.readFileSync(new URL(`../${rel}`,import.meta.url),'utf8');
const bootstrap=read('ui/auth-password.js');
const css=read('ui/zoom-production-polish.css');
const js=read('ui/zoom-production-polish.js');

assert(bootstrap.includes("zoom-production-polish.css")&&bootstrap.includes("zoom-production-polish.js"),'Desktop bootstrap must load the production Zoom polish layer.');
assert(css.includes('--ds-meeting-toolbar-h:84px'),'Production toolbar must use readable Zoom-scale height.');
assert(css.includes('.ds-control-icon{width:29px')&&css.includes('.ds-control-label{font-size:12px'),'Primary meeting icons and labels must not ship at the undersized QA scale.');
assert(css.includes('.meeting-footer>#roomMic{order:1!important')&&css.includes('#roomExitButton{order:99!important'),'Audio must anchor the left side and End must anchor the right side of the meeting toolbar.');
assert(css.includes('.av-device-caret.attached-device-caret[data-kind="audio"]{order:2!important}')&&css.includes('.av-device-caret.attached-device-caret[data-kind="video"]{order:4!important;margin-right:auto!important}'),'A/V carets must render immediately after their controls and Video must terminate the left toolbar zone.');
assert(css.includes('#roomShare .ds-control-icon')&&css.includes('#35c66a'),'Share Screen must carry Zoom-like green primary-action emphasis.');
assert(css.includes('color:#f3f5f7!important'),'Primary meeting toolbar text must retain readable light-on-dark contrast.');
assert(js.includes("button.id='roomHostTools'")&&js.includes("Host Tools"),'Host Tools must be a first-class host/co-host toolbar control.');
assert(js.includes('placeholder="Search participants"'),'Participants must expose direct search for large meetings.');
assert(js.includes("data-zoom-mute-all")&&js.includes("zoom-participant-more"),'Participants footer must use Zoom-style Mute All plus More instead of a row of tiny bulk buttons.');
assert(css.includes('--ds-panel-w:390px')&&css.includes('.room-side .person-copy strong{font-size:13px'),'Participants must use a readable Zoom-scale roster instead of the undersized admin-card layout.');
assert(css.includes('.room-side{position:absolute!important;z-index:62!important;left:auto!important;right:10px!important;top:10px!important;bottom:10px!important;transform:none!important'),'Participants must be pinned to the right-side Zoom panel geometry and must never regress to the rejected centered layout.');
assert(js.includes("localStorage.removeItem(LEGACY_PANEL_KEY)")&&js.includes("side.style.setProperty('right','10px','important')"),'Runtime must clear stale centered panel geometry and enforce the right-side production authority.');
assert(js.includes("requestAnimationFrame(normalizeParticipantPanel)"),'Participants click reconciliation must run after legacy placement in the same frame before paint.');
assert(css.includes('.zoom-participant-search input')&&css.includes('font-size:13px'),'Participant search must remain readable.');
assert(js.includes('function normalizeChatPanel()')&&js.includes("panel.style.setProperty('width','var(--ds-panel-w)','important')")&&js.includes("panel.style.setProperty('right','10px','important')"),'Chat must have a runtime geometry authority that late legacy CSS cannot shrink or reposition.');
assert(js.includes("requestAnimationFrame(normalizeChatPanel)"),'Chat click reconciliation must re-assert production geometry before paint.');
assert(css.includes('#meetingChatPanel header strong{font-size:15px!important')&&css.includes('#meetingChatInput{font-size:13px!important'),'Chat heading and composer typography must have ID-level authority over later legacy class rules.');
assert(css.includes('#meetingChatPanel .meeting-chat-message p{font-size:13px!important')&&css.includes('color:#f5f5f5!important'),'Chat body copy must retain readable production size and contrast.');
assert(js.includes('zoom-chat-more')&&css.includes('.meeting-chat-policy{display:none!important}'),'Chat policy must live behind a More control instead of a permanent policy dropdown.');
assert(js.includes("if(!q('#meetingChatPolicy'))return"),'Chat chrome must wait for the behavior controller to create and wire its policy control before moving the close-button anchor.');
assert(css.includes('.meeting-reaction-bubble{left:24px!important')&&css.includes('@keyframes dsZoomReactionRise'),'Meeting reactions must rise from the left side of the stage.');
assert(js.includes('re-check the actual capture permission automatically'),'Permission recovery copy must tell the user that Share performs a real re-check.');
assert(js.includes("observer.observe(document.body,{childList:true,subtree:true})")&&!js.includes("attributeFilter:['hidden','class']"),'Production polish must not observe its own visibility/class mutations and starve the renderer.');
assert(js.includes('setHidden=(node,value)'),'Repeated polish reconciliation must update visibility idempotently.');
assert(js.includes("version:'1.4.0'"),'Production polish module version must be explicit.');

console.log('DOMINIONSTAR_ZOOM_PRODUCTION_POLISH_OK toolbar-zones av-caret-sequence readable-toolbar left-audio right-end green-share host-tools participant-search participants-right runtime-right-authority prepaint-right zoom-roster zoom-chat chat-runtime-geometry chat-typography-authority chat-race-safe readable-contrast left-rising-reactions permission-recheck stable-reconciliation');
