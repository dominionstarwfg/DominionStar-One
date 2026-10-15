import fs from 'node:fs';
import assert from 'node:assert/strict';

const read=path=>fs.readFileSync(new URL('../'+path,import.meta.url),'utf8');
const app=read('ui/app.js');
const canonical=read('ui/profile-photo-fallback.js');
const legacy=read('ui/approved-reference-parity.js');
const nativeVideo=read('ui/mac-share-video.js');
const nativeStyle=read('ui/mac-share-video.css');
const remoteVideo=read('ui/webrtc-controller.js');
const stage=read('ui/meeting-parity.js');
const stageStyle=read('ui/meeting-parity.css');
const panel=read('ui/runtime-stability.js');
const panelStyle=read('ui/runtime-stability.css');
const contract=read('QA-APPROVED-MULTIPARTICIPANT-SHARING-STANDARD-2026-10-14.md');
const check=(condition,message)=>assert.ok(condition,message);

// Roster: photo when present, short initial badge otherwise, full name and role beside.
check(app.includes("badge.textContent=initials(name)"),'roster identity badges must retain initials fallback');
check(app.includes("'(Host, me)'")&&app.includes("'(Co-host)'"),'host and co-host metadata must be present');
check(app.includes("nameNode.textContent=name"),'roster must retain real display name');

// Both native and in-room filmstrips: camera > photo > full display name, never initials badge.
check(nativeVideo.includes("const label=person.name"),'native tile must show the full display name when no camera/photo');
check(!nativeVideo.includes("const label=initials(person.name)"),'native filmstrip must not use abbreviated initials');
check(nativeStyle.includes("border-radius:0;background:transparent;color:#fff")||
  (nativeStyle.includes("border-radius:0;background:transparent;color:#f5f6f8")&&nativeStyle.includes("overflow-wrap:anywhere")),
  'name-only native fallback must not be styled as a circular initials badge');
check(remoteVideo.includes('<div class="remote-peer-fallback"><span>${esc(name)}</span>'),'main filmstrip must start with full-name fallback');
check(remoteVideo.includes("tile.querySelector('.remote-peer-fallback span').textContent=name"),'remote identity update must never reset to initials');
check(canonical.includes("setTilePhoto(tile.querySelector('.remote-peer-fallback'),person.avatarUrl,person.displayName)"),'canonical photo owner must show full name when image absent');
check(canonical.includes("setBoxPhoto(row.querySelector('.person-badge'),person.avatarUrl,initials(person.displayName))"),'canonical roster painter must preserve initials instead');
check(canonical.includes("#participantVideoDock .remote-peer-fallback:not(.has-photo)>span"),'main video panel needs explicit name-only fallback styling');
check(legacy.includes("safeAvatar(tile.dataset.avatarUrl||remoteAvatars.get(id)),name)"),'legacy identity code cannot reintroduce video initials');
check(stage.includes("avatar.hidden=!hasPhoto"),'stage must not show enlarged no-photo initials glyph');
check(stageStyle.includes(".remote-active-speaker-avatar[hidden]"),'stage CSS must respect name-only speaker fallback');

// Accommodate the real name plus role; no fixed 318px cap on large displays.
check(panel.includes("const baseWidth=panel===chat?330:440"),'participant window must have a readable desktop baseline');
check(panel.includes("const baseHeight=panel===chat?440:552"),'participant window must accommodate an internally scrolling roster');
check(!panelStyle.includes("width:min(318px"),'old 318px width cap must be retired');
check(panelStyle.includes("width:min(440px"),'responsive readable width must be enforced');
check(contract.includes("Never show an initials circle in a video tile"),'approved acceptance spec must explicitly reject initials in video tiles');

console.log('PASS 19 approved identity surface and participant spacing invariants — source checks only; NOT physical UI acceptance');
