alter table public.meet_v2_rooms
  add column if not exists annotation_names_visible boolean not null default true;

create or replace function public.meet_v2_set_annotation_names(
  p_room_id uuid,
  p_show_names boolean
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_user uuid := auth.uid();
  v_room public.meet_v2_rooms%rowtype;
  v_role text;
begin
  if v_user is null then raise exception 'authentication_required'; end if;

  select * into v_room
  from public.meet_v2_rooms
  where id=p_room_id
  for update;

  if not found then raise exception 'meeting_not_found'; end if;

  if coalesce(v_room.active_host_id,v_room.host_id)=v_user then
    v_role:='host';
  else
    select role into v_role
    from public.meet_v2_participants
    where room_id=p_room_id
      and member_id=v_user
      and state in ('admitted','joined')
    order by created_at desc
    limit 1;
  end if;

  if coalesce(v_role,'') not in ('host','cohost') then
    raise exception 'host_authority_required';
  end if;

  update public.meet_v2_rooms
  set annotation_names_visible=coalesce(p_show_names,true),
      updated_at=now()
  where id=p_room_id
  returning * into v_room;

  return jsonb_build_object(
    'roomId',v_room.id,
    'annotationNamesVisible',v_room.annotation_names_visible
  );
end
$function$;

create or replace function public.meet_v2_room_snapshot(p_room_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_user uuid := auth.uid();
  v_allowed boolean;
  v_room public.meet_v2_rooms;
  v_people jsonb;
begin
  if v_user is null then raise exception 'authentication_required' using errcode='28000'; end if;

  select * into v_room from public.meet_v2_rooms where id=p_room_id;
  if not found then raise exception 'meeting_not_found'; end if;

  select (v_room.host_id=v_user)
      or (v_room.active_host_id=v_user)
      or exists(
        select 1 from public.meet_v2_participants p
        where p.room_id=p_room_id and p.member_id=v_user and p.state in ('admitted','joined')
      )
  into v_allowed;
  if not v_allowed then raise exception 'meeting_access_required'; end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'participantId',p.id,
    'memberId',p.member_id,
    'displayName',p.display_name,
    'role',p.role,
    'state',p.state,
    'joinedAt',p.joined_at,
    'lastSeenAt',p.last_seen_at,
    'canHost',(p.member_id is not null and p.state='joined'),
    'recordingAllowed',p.recording_allowed,
    'isRecording',p.is_recording,
    'recordingPaused',p.recording_paused
  ) order by case p.role when 'host' then 0 when 'cohost' then 1 else 2 end,p.created_at),'[]'::jsonb)
  into v_people
  from public.meet_v2_participants p
  where p.room_id=p_room_id
    and (
      (p.state='admitted' and coalesce(p.admitted_at,p.updated_at)>now()-interval '75 seconds')
      or (p.state='joined' and coalesce(p.last_seen_at,p.joined_at,p.updated_at)>now()-interval '75 seconds')
    );

  return jsonb_build_object(
    'roomId',v_room.id,
    'roomCode',v_room.room_code,
    'title',v_room.title,
    'status',v_room.status,
    'waitingRoomEnabled',v_room.waiting_room_enabled,
    'ownerId',v_room.host_id,
    'activeHostId',v_room.active_host_id,
    'meetingLocked',v_room.meeting_locked,
    'muteOnEntry',v_room.mute_on_entry,
    'chatPolicy',v_room.chat_policy,
    'captionMode',v_room.caption_mode,
    'captionerParticipantId',v_room.captioner_participant_id,
    'transcriptEnabled',v_room.transcript_enabled,
    'annotationEnabled',v_room.annotation_enabled,
    'annotationSaveAllowed',v_room.annotation_save_allowed,
    'annotationNamesVisible',v_room.annotation_names_visible,
    'participants',v_people
  );
end
$function$;

grant execute on function public.meet_v2_set_annotation_names(uuid,boolean) to authenticated;
