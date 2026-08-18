import { readFile } from 'node:fs/promises';

const core=await readFile('assets/js/meet/share-arbitration.js','utf8');
const ui=await readFile('assets/js/meet/share-arbitration-ui.js','utf8');
const shareView=await readFile('assets/js/meet/share-view-controls.js','utf8');
const requireText=(text,needle,message)=>{if(!text.includes(needle))throw new Error(message);};

new Function(core);
new Function(ui);

requireText(core,'dominionstar-meet-share-arbitration-${snap.roomId}','share arbitration lost its isolated room-scoped realtime channel');
requireText(core,"event:'share-arbitration'",'share arbitration broadcast event disappeared');
requireText(core,'CLAIM_WINDOW_MS = 260','deterministic contention claim window disappeared');
requireText(core,'LEASE_STALE_MS = 12000','share arbitration stale-lease guard disappeared');
requireText(core,'RESTART_HOLD_MS = 5000','New Share lease hold disappeared');
requireText(core,"role === 'host' ? 3 : role === 'cohost' ? 2 : 1",'host/co-host arbitration priority disappeared');
requireText(core,'candidates.sort(compareClaims)','simultaneous claims are no longer deterministically ordered');
requireText(core,'member.admitted === false','non-admitted share claim rejection disappeared');
requireText(core,'holdForRestart','New Share no longer preserves presenter ownership');
requireText(core,'acceptIncoming','incoming share events no longer validate against the presenter lease');
requireText(core,'window.DominionShareArbitration=Object.freeze','share arbitration diagnostic/API surface disappeared');

requireText(ui,"document.addEventListener('click'",'Share/New Share capture gate disappeared');
requireText(ui,"event.stopImmediatePropagation()",'arbitration no longer blocks the legacy share action before lease resolution');
requireText(ui,'await arb.requestStart()','local share no longer acquires presenter lease before capture');
requireText(ui,"engine.moderate(presenterId,'stop-share')",'host/co-host takeover no longer stops the incumbent share first');
requireText(ui,'Stop share & start mine','explicit host/co-host takeover confirmation disappeared');
requireText(ui,'arb.holdForRestart?.()','New Share UI no longer holds the current presenter lease');
requireText(ui,'await arb.cancelRestart','failed/cancelled New Share no longer releases its reservation');
requireText(ui,"type:'screen.share.arbitration.rejected'",'losing remote share rejection is no longer observable');

requireText(shareView,'/assets/js/meet/share-arbitration.js?v=1-operation-2030','share-view bootstrap no longer loads arbitration core');
requireText(shareView,'/assets/js/meet/share-arbitration-ui.js?v=1-operation-2030','share-view bootstrap no longer loads arbitration UI');

await import('./test-share-arbitration-two-client.mjs');
console.log('DOMINIONSTAR_SINGLE_PRESENTER_ARBITRATION_GUARDRAIL_OK');