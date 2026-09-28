-- DominionStar Meet host/co-host authority polish — 2026-09-28
-- Enforces a single co-host through the supported role RPC and adds
-- in-meeting host transfer without forcing the previous host to leave.

create or replace function public.meet_v2_set_cohost(p_participant_id uuid,p_enabled boolean)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_actor uuid := auth.uid();
  v_target public.meet_v2_participants%rowtype;
  v_room public.meet_v2_rooms%rowtype;
  v_role text;
begin
  if v_actor is null then raise exception 'authentication_required'; end if;

  select * into v_target
  from public.meet_v2_participants
  where id=p_participant_id
  for update;
  if not found then raise exception 'participant_not_found'; end if;

  select * into v_room
  from public.meet_v2_rooms
  where id=v_target.room_id
  for update;
  if not found then raise exception 'meeting_not_found'; end if;
  if coalesce(v_room.active_host_id,v_room.host_id)<>v_actor then raise exception 'host_authority_required'; end if;
  if v_target.role='host' then raise exception 'host_role_cannot_change'; end if;
  if v_target.state not in ('admitted','joined') then raise exception 'participant_not_active'; end if;

  if coalesce(p_enabled,false) then
    update public.meet_v2_participants
    set role=case when member_id is null then 'guest' else 'participant' end,
        updated_at=now()
    where room_id=v_target.room_id
      and id<>v_target.id
      and role='cohost'
      and state in ('admitted','joined');

    v_role:='cohost';
  else
    v_role:=case when v_target.member_id is null then 'guest' else 'participant' end;
  end if;

  update public.meet_v2_participants
  set role=v_role,updated_at=now()
  where id=v_target.id;

  return jsonb_build_object(
    'ok',true,
    'participantId',v_target.id,
    'role',v_role
  );
end
$$;

create or replace function public.meet_v2_transfer_host(p_target_participant_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_actor uuid := auth.uid();
  v_room public.meet_v2_rooms%rowtype;
  v_target public.meet_v2_participants%rowtype;
  v_old_host public.meet_v2_participants%rowtype;
begin
  if v_actor is null then raise exception 'authentication_required'; end if;

  select * into v_target
  from public.meet_v2_participants
  where id=p_target_participant_id
  for update;
  if not found then raise exception 'participant_not_found'; end if;

  select * into v_room
  from public.meet_v2_rooms
  where id=v_target.room_id
  for update;
  if not found then raise exception 'meeting_not_found'; end if;
  if coalesce(v_room.active_host_id,v_room.host_id)<>v_actor then raise exception 'host_authority_required'; end if;
  if v_target.state<>'joined' then raise exception 'participant_not_joined'; end if;
  if v_target.member_id is null then raise exception 'signed_in_participant_required_for_host'; end if;
  if v_target.member_id=v_actor then raise exception 'cannot_transfer_host_to_self'; end if;

  select * into v_old_host
  from public.meet_v2_participants
  where room_id=v_room.id
    and member_id=v_actor
    and role='host'
    and state='joined'
  order by created_at desc
  limit 1
  for update;
  if not found then raise exception 'active_host_participant_not_found'; end if;

  -- Demote the current host before promoting the replacement. This keeps the
  -- role model single-host throughout the transaction.
  update public.meet_v2_participants
  set role='participant',updated_at=now()
  where id=v_old_host.id;

  update public.meet_v2_participants
  set role='host',updated_at=now()
  where id=v_target.id;

  update public.meet_v2_rooms
  set active_host_id=v_target.member_id,updated_at=now()
  where id=v_room.id;

  return jsonb_build_object(
    'ok',true,
    'roomId',v_room.id,
    'previousHostParticipantId',v_old_host.id,
    'previousHostRole','participant',
    'newHostParticipantId',v_target.id,
    'newHostMemberId',v_target.member_id,
    'newHostName',v_target.display_name,
    'newHostRole','host'
  );
end
$$;

grant execute on function public.meet_v2_set_cohost(uuid,boolean) to authenticated;
grant execute on function public.meet_v2_transfer_host(uuid) to authenticated;
