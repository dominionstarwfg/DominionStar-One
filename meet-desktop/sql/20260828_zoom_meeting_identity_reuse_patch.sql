-- Follow-up patch for persistent DominionStar meeting identities.
-- Reusable rooms may accept the next waiting-room request after the previous
-- occurrence ended. The host then starts that same room identity.
-- Staged only; do not apply to the live project before physical QA approval.

create or replace function public.meet_v2_request_join(p_room_code text,p_passcode text,p_display_name text)
returns jsonb
language plpgsql
security definer
set search_path to 'public','extensions'
as $$
declare
  v_user uuid := auth.uid();
  v_room public.meet_v2_rooms;
  v_participant public.meet_v2_participants;
  v_state text;
  v_role text;
  v_existing public.meet_v2_participants;
begin
  select * into v_room
  from public.meet_v2_rooms
  where room_code=regexp_replace(coalesce(p_room_code,''),'[^0-9]','','g');

  if not found or v_room.status='cancelled' then raise exception 'meeting_not_found'; end if;
  if v_room.meeting_locked then raise exception 'meeting_locked'; end if;
  if v_room.status='ended' and not v_room.reusable then raise exception 'meeting_not_found'; end if;
  if extensions.crypt(coalesce(p_passcode,''),v_room.passcode_digest) <> v_room.passcode_digest then raise exception 'incorrect_passcode'; end if;
  if v_user is null and not v_room.external_guests_allowed then raise exception 'guest_access_disabled'; end if;

  -- Personal Rooms and generated recurring rooms keep their identity after an
  -- occurrence ends. Reopening the waiting state lets participants arrive
  -- before the host without generating a replacement Meeting ID.
  if v_room.status='ended' and v_room.reusable then
    update public.meet_v2_rooms set status='waiting',updated_at=now() where id=v_room.id;
    v_room.status := 'waiting';
  end if;

  if v_user is not null then
    select * into v_existing
    from public.meet_v2_participants
    where room_id=v_room.id and member_id=v_user and state not in ('left','removed','declined')
    order by created_at desc limit 1;
    if found then
      return jsonb_build_object(
        'roomId',v_room.id,'roomCode',v_room.room_code,'title',v_room.title,
        'participantId',v_existing.id,'joinToken',v_existing.join_token,
        'role',v_existing.role,'state',v_existing.state,
        'waitingRoomEnabled',v_room.waiting_room_enabled,
        'meetingKind',v_room.meeting_kind,'reusable',v_room.reusable,
        'muteOnEntry',v_room.mute_on_entry,'meetingLocked',v_room.meeting_locked,
        'waitReason',case when v_existing.state='waiting_host' then 'host' when v_existing.state='waiting' then 'admission' else null end,
        'hostStarted',(v_room.status='live')
      );
    end if;
  end if;

  v_role := case when v_user is null then 'guest' else 'participant' end;
  v_state := case when v_room.status<>'live' then 'waiting_host' when v_room.waiting_room_enabled then 'waiting' else 'admitted' end;
  insert into public.meet_v2_participants(room_id,member_id,display_name,role,state,admitted_at)
  values(v_room.id,v_user,coalesce(nullif(trim(p_display_name),''),'Guest'),v_role,v_state,
    case when v_state='admitted' then now() end)
  returning * into v_participant;

  return jsonb_build_object(
    'roomId',v_room.id,'roomCode',v_room.room_code,'title',v_room.title,
    'participantId',v_participant.id,'joinToken',v_participant.join_token,
    'role',v_participant.role,'state',v_participant.state,
    'waitingRoomEnabled',v_room.waiting_room_enabled,
    'meetingKind',v_room.meeting_kind,'reusable',v_room.reusable,
    'muteOnEntry',v_room.mute_on_entry,'meetingLocked',v_room.meeting_locked,
    'waitReason',case when v_participant.state='waiting_host' then 'host' when v_participant.state='waiting' then 'admission' else null end,
    'hostStarted',(v_room.status='live')
  );
end
$$;
