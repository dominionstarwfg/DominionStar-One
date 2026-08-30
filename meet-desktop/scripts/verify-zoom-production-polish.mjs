import fs from 'node:fs';
import assert from 'node:assert/strict';

const read=rel=>fs.readFileSync(new URL(`../${rel}`,import.meta.url),'utf8');
const bootstrap=read('ui/auth-password.js');
const css=read('ui/zoom-production-polish.css');
const js=read('ui/zoom-production-polish.js');

assert(bootstrap.includes("zoom-production-polish.css")&&bootstrap.includes("zoom-production-polish.js"),'Desktop bootstrap must load the production Zoom polish layer.');
assert(css.includes('--ds-meeting-toolbar-h:84px'),'Production toolbar must use readable Zoom-scale height.');
assert(css.includes('.ds-control-icon{width:29px')&&css.includes('.ds-control-label{font-size:12px'),'Primary meeting icons and labels must not ship at the undersized QA scale.');
assert(css.includes('.meeting-footer>#roomMic{order:1')&&css.includes('#roomExitButton{order:99'),'Audio must anchor the left side and End must anchor the right side of the meeting toolbar.');
assert(css.includes('#roomShare .ds-control-icon')&&css.includes('#35c66a'),'Share Screen must carry Zoom-like green primary-action emphasis.');
assert(js.includes("button.id='roomHostTools'")&&js.includes("Host Tools"),'Host Tools must be a first-class host/co-host toolbar control.');
assert(js.includes('placeholder="Search participants"'),'Participants must expose direct search for large meetings.');
assert(js.includes("data-zoom-mute-all")&&js.includes("zoom-participant-more"),'Participants footer must use Zoom-style Mute All plus More instead of a row of tiny bulk buttons.');
assert(css.includes('--ds-panel-w:390px')&&css.includes('.room-side .person-copy strong{font-size:13px'),'Participants must use a readable Zoom-scale roster instead of the undersized admin-card layout.');
assert(js.includes('zoom-chat-more')&&css.includes('.meeting-chat-policy{display:none!important}'),'Chat policy must live behind a More control instead of a permanent policy dropdown.');
assert(css.includes('.meeting-chat-message p{font-size:13px'),'Meeting chat messages must be readable at normal desktop scale.');
assert(css.includes('.meeting-reaction-bubble{left:24px!important')&&css.includes('@keyframes dsZoomReactionRise'),'Meeting reactions must rise from the left side of the stage.');
assert(js.includes('re-check the actual capture permission automatically'),'Permission recovery copy must tell the user that Share performs a real re-check.');
assert(js.includes("observer.observe(document.body,{childList:true,subtree:true})")&&!js.includes("attributeFilter:['hidden','class']"),'Production polish must not observe its own visibility/class mutations and starve the renderer.');
assert(js.includes('setHidden=(node,value)'),'Repeated polish reconciliation must update visibility idempotently.');
assert(js.includes("version:'1.2.1'"),'Production polish module version must be explicit.');

console.log('DOMINIONSTAR_ZOOM_PRODUCTION_POLISH_OK readable-toolbar left-audio right-end green-share host-tools participant-search zoom-roster zoom-chat left-rising-reactions permission-recheck stable-reconciliation');
