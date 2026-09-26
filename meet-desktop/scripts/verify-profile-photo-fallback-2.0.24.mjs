import fs from 'node:fs';
import assert from 'node:assert/strict';

const read=rel=>fs.readFileSync(new URL(`../${rel}`,import.meta.url),'utf8');
const auth=read('src/auth-service.mjs');
const meeting=read('src/meeting-service.mjs');
const sql=read('sql/20260903_meet_profile_avatar_fallback.sql');
const ui=read('ui/profile-photo-fallback.js');
const index=read('ui/index.html');
const share=read('src/share-service.mjs');

const has=(source,needle,message)=>assert.ok(source.includes(needle),message);
const lacks=(source,needle,message)=>assert.ok(!source.includes(needle),message);

// Private storage authority stays in the main process.
has(auth,"client.storage.from('member-avatars').createSignedUrl",'Private member-avatar signing authority is missing.');
has(auth,'const avatarUrlCache=new Map()','Signed avatar URLs must be cached.');
has(auth,"/^[0-9a-f-]{36}\\/avatar\\.(?:png|jpe?g|webp)$/i",'Avatar paths must be restricted to the existing member folder contract.');
has(auth,'expiresAt:now+50*60*1000','Signed URL cache must expire before the one-hour storage signature.');
has(auth,'avatarUrlCache.delete(avatarPath)','Uploading a replacement avatar must invalidate the signed URL cache.');
has(auth,'signedAvatarUrl,callbackUrl:CALLBACK_URL','Meeting service must receive signing authority without exposing it to the preload bridge.');
lacks(auth,'.getPublicUrl(','Private profile photos must never be converted to public bucket URLs.');

// Additive same-room metadata RPC; certified room snapshot is not replaced.
has(sql,'create or replace function public.meet_v2_room_avatar_paths(p_room_id uuid)','Avatar metadata RPC is missing.');
has(sql,'security definer','Avatar metadata RPC must enforce server-side authority.');
has(sql,'v_room.host_id=v_user','Host same-room authority is missing.');
has(sql,'v_room.active_host_id=v_user','Active host authority is missing.');
has(sql,"p.member_id=v_user and p.state in ('admitted','joined')",'Participant same-room authority is missing.');
has(sql,"'participantId',p.id",'Avatar metadata must key by participant identity.');
has(sql,"'avatarPath',coalesce(mp.avatar_path,'')",'Only the private avatar path should leave SQL.');
has(sql,'left join public.member_profiles mp on mp.id=p.member_id','Avatar metadata must come from the existing member profile.');
has(sql,"p.state in ('waiting_host','waiting','admitted','joined')",'Active and waiting member surfaces must be covered.');
has(sql,'revoke all on function public.meet_v2_room_avatar_paths(uuid) from public','Default PUBLIC execution must be revoked.');
has(sql,'revoke all on function public.meet_v2_room_avatar_paths(uuid) from anon','Supabase anonymous execution must be explicitly revoked.');
has(sql,'grant execute on function public.meet_v2_room_avatar_paths(uuid) to authenticated','Avatar RPC must be authenticated-only.');
lacks(sql,'signedUrl','Database RPC must not attempt to manufacture storage URLs.');

// Existing meeting snapshot remains the primary authority and avatar enrichment fails open.
has(meeting,"await auth.rpc('meet_v2_room_snapshot',{p_room_id:roomId})",'Certified room snapshot must remain the primary participant authority.');
has(meeting,"auth.rpc('meet_v2_room_avatar_paths',{p_room_id:roomId})",'Meeting service must request same-room avatar metadata.');
has(meeting,"typeof auth.signedAvatarUrl!=='function'",'Avatar enrichment must be optional for compatibility.');
has(meeting,'avatarMetaCache={roomId:String(roomId),records:known,expiresAtMs:now+15*1000}','Avatar RPC failure must retain the meeting payload and back off.');
has(meeting,'avatarUrl:record.avatarUrl','Enriched participants must expose only the signed URL to the renderer.');
has(meeting,"async function hostQueue(roomId){return enrichParticipantList",'Waiting-room members must receive the same photo fallback metadata.');

// Renderer consumes existing app events; it does not add another room poll.
has(index,'<script src="./profile-photo-fallback.js"></script>','Profile-photo fallback module is not loaded.');
has(ui,"window.addEventListener('dominion:meeting-snapshot'",'Participant photos must consume the existing snapshot event.');
has(ui,"window.addEventListener('dominion:waiting-room-update'",'Waiting-room photos must consume the existing queue event.');
lacks(ui,'meeting.snapshot(','Profile-photo module must not add another snapshot poll.');
has(ui,"q('#prejoinAvatar')",'Pre-join camera-off photo surface is missing.');
has(ui,"q('#stageAvatar')",'Main meeting camera-off photo surface is missing.');
has(ui,"q('#localVideoDockTile .remote-peer-fallback')",'Local floating dock photo surface is missing.');
has(ui,"qa('.remote-peer-tile[data-peer-id]')",'Remote video-tile photo surface is missing.');
has(ui,"qa('[data-participant-id]')",'Participants panel photo surface is missing.');
has(ui,"qa('[data-wait]')",'Waiting-room badge photo surface is missing.');
has(ui,"img.onerror=()=>",'Broken/expired image fallback is missing.');
has(ui,"span.hidden=false",'Remote image failure must reveal initials.');
has(ui,"box.textContent=fallback",'Local image failure must restore initials.');
has(ui,'applyForTesting:','Packaged physical verifier hook is missing.');
has(ui,"return /^https:\\/\\//i.test(url)?url:''",'Renderer must accept only HTTPS photo URLs.');

// Dynamic camera-off surfaces may arrive after the module loads, but repaint
// scheduling must yield back to Electron. A MutationObserver -> queueMicrotask
// -> DOM mutation cycle previously starved the renderer and CDP event loop.
has(ui,'let repaintTimer=0','Profile-photo DOM repaint work must be coalesced.');
has(ui,'repaintTimer=window.setTimeout(()=>{repaintTimer=0;paintAll();},32)','Profile-photo repaint scheduling must yield through a bounded task.');
has(ui,'const observer=new MutationObserver(schedulePaint)','Dynamic surface observation must use the bounded scheduler.');
lacks(ui,'queueMicrotask(paintAll)','Profile-photo DOM observation must never recursively queue paintAll as a microtask.');

// Avatar work must remain isolated from the fragile presenter/capture architecture.
lacks(share,'meet_v2_room_avatar_paths','Share service must remain independent from profile-photo metadata.');

console.log('DOMINIONSTAR_PROFILE_PHOTO_2_0_24_OK private-signed-avatars same-room-metadata authenticated-only-rpc additive-rpc cached-enrichment fail-open-snapshot existing-events local-and-remote-photo-first initials-fallback bounded-repaint no-extra-poll share-stack-untouched');
