import assert from 'node:assert/strict';
import fs from 'node:fs';

const hotfix=fs.readFileSync(new URL('../assets/js/meet/hotfix-rc13-1-media-prejoin.js',import.meta.url),'utf8');
const ui=fs.readFileSync(new URL('../assets/js/meet-next/executive6.js',import.meta.url),'utf8');
const engine=fs.readFileSync(new URL('../assets/js/meeting-engine.js',import.meta.url),'utf8');
const requireSource=(source,needle,message)=>assert(source.includes(needle),message);

// Keep the existing Executive 6 leave/end lifecycle as the single owner of
// timer cleanup, navigation, and the terminal meeting event.
requireSource(ui,"ids.leaveOnlyBtn.onclick=async()=>{ stopMeetingTimer(); try{await leaveWithDeadline();}finally{location.replace(leaveDestination());} };",'Established Leave Meeting lifecycle is missing.');
requireSource(ui,'if(!state.isHost)return;','End Meeting for All is not host-gated in the UI.');
requireSource(engine,'if (endForAll && state.isHost) {','Meeting engine does not enforce host-only End for All.');
requireSource(engine,'await within(persistMeetingActiveState(false),1100);','End for All does not mark the meeting inactive.');
requireSource(engine,"await within(send('meet-ended',{endedAt,eventId,attempt}),650);",'End for All does not deliver the terminal meeting event.');

// Zoom parity: host leaving an active meeting must assign a replacement host.
requireSource(hotfix,"const baseLeaveOnlyHandler = leaveOnlyButton?.onclick;",'Host transfer layer does not preserve the proven Leave handler.');
requireSource(hotfix,"leaveOnlyButton.textContent = 'Assign and Leave';",'Host leave does not expose Assign and Leave.');
requireSource(hotfix,"select.setAttribute('aria-label','Select a new meeting host');",'Replacement host selector is not accessible.');
requireSource(hotfix,"const delivered = await engine.setRole(targetId,'host');",'Host authority is not transferred before leave.');
requireSource(hotfix,'return baseLeaveOnlyHandler();','Transferred host path does not reuse the established clean Leave lifecycle.');
requireSource(hotfix,'if (!snapshot.isHost) {','Participant and co-host Leave paths are not isolated from host transfer.');
requireSource(hotfix,'endAllButton?.click();','A host with nobody to transfer to can leave a stale active meeting.');
requireSource(hotfix,"window.__DS_MEET_HOST_LEAVE_FLOW = 'zoom-assign-and-leave-v1';",'Zoom host leave contract marker is missing.');

const transferIndex=hotfix.indexOf("const delivered = await engine.setRole(targetId,'host');");
const leaveIndex=hotfix.indexOf('return baseLeaveOnlyHandler();',transferIndex);
assert(transferIndex>=0&&leaveIndex>transferIndex,'Host must transfer authority before the original host disconnects.');

console.log('PASS Zoom-style host departure: assign a new host before leaving; host-alone ends the meeting; non-hosts leave normally.');
