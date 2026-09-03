import assert from 'node:assert/strict';
import fs from 'node:fs';

const read=path=>fs.readFileSync(path,'utf8');
const pkg=JSON.parse(read('package.json'));
const bootstrap=read('src/bootstrap.mjs');
const main=read('src/main.mjs');
const preload=read('src/preload.cjs');
const app=read('ui/app.js');
const service=read('src/meeting-service.mjs');
const personal=read('ui/personal-room.js');
const schedule=read('ui/schedule-controller.js');

assert.equal(pkg.version,'2.0.36','Canonical join-entry candidate must report 2.0.36.');
assert.ok(pkg.build?.protocols?.some(item=>Array.isArray(item?.schemes)&&item.schemes.includes('dominionstar-meet')),'Packaged app must register dominionstar-meet protocol.');

assert.ok(bootstrap.includes("const JOIN_SCHEME='dominionstar-meet://join'"),'Bootstrap must recognize the canonical join scheme before app startup.');
assert.ok(bootstrap.includes("app.on('open-url'"),'macOS open-url events must be captured before main window creation.');
assert.ok(bootstrap.includes("for(const arg of process.argv)queueJoinUrl(arg)"),'Cold-start protocol URLs must be captured from process arguments.');
assert.ok(bootstrap.includes("app.on('second-instance'"),'Running-app protocol launches must use the single-instance handoff.');
assert.ok(bootstrap.includes('for(const arg of commandLine)queueJoinUrl(arg)'),'Second-instance arguments must forward join URLs to the running app.');

assert.ok(main.includes("url.protocol!=='dominionstar-meet:'||url.hostname!=='join'"),'Main process must reject unrelated custom-protocol URLs.');
assert.ok(main.includes("/^\\d{10,11}$/.test(meetingId)"),'Main process must validate Meeting ID before forwarding a join link.');
assert.ok(main.includes("/^\\d{3,7}$/.test(passcode)"),'Main process must validate passcode before forwarding a join link.');
assert.ok(main.includes("mainWindow.webContents.send('app:join-url',url)"),'Validated join URLs must be delivered to the active desktop window.');
assert.ok(main.includes("ipcMain.handle('app:consume-join-url'"),'Renderer must consume queued join URLs through narrow IPC.');
assert.ok(preload.includes("joinLinks:Object.freeze({consume:()=>invoke('app:consume-join-url'),onOpen:callback=>listen('app:join-url',callback)})"),'Preload must expose only consume/onOpen join-link commands.');

assert.ok(app.includes('function parseJoinValue(value)'),'Renderer must use one parser for manual Meeting ID and app links.');
assert.ok(app.includes("/^dominionstar-meet:\\/\\/join/i.test(raw)"),'Renderer must recognize canonical DominionStar app invites.');
assert.ok(app.includes("Meeting ID or DominionStar invite link"),'Join UI must tell users that pasted invite links are accepted.');
assert.ok(app.includes("desktop?.joinLinks?.onOpen?.("),'OS-opened join links must enter the same renderer path.');
assert.ok(app.includes("desktop?.joinLinks?.consume?.()"),'Cold-start queued join links must enter the same renderer path.');
assert.ok(app.includes("pendingJoin={roomCode:parsed.roomCode,passcode,displayName:"),'Manual and linked joins must converge before requestJoin.');
assert.ok(app.includes("const response=await meeting.requestJoin(pendingJoin)"),'Joined identity must still use the certified backend requestJoin authority.');
assert.ok(service.includes("auth.rpc('meet_v2_request_join'"),'Backend meeting lookup must remain RPC-backed.');
assert.ok(service.includes("if(!validRoomCode(roomCode))throw new Error('Meeting ID must contain 10 or 11 digits.')"),'Invalid Meeting IDs must fail explicitly.');
assert.ok(service.includes("assertPasscode(passcode)"),'Invalid passcodes must fail explicitly.');

assert.ok(personal.includes('dominionstar-meet://join?meetingId='),'Personal Room Copy invite must include a clickable desktop join link.');
assert.ok(schedule.includes('dominionstar-meet://join?meetingId='),'Scheduled Copy invite must include a clickable desktop join link.');

console.log('DOMINIONSTAR_CANONICAL_JOIN_ENTRY_2_0_36_OK manual-id pasted-link cold-link running-link validated-ipc requestJoin invite-links explicit-errors');
