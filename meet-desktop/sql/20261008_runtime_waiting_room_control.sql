-- Runtime Waiting Room control for DominionStar Meet hosts/co-hosts.
-- Applied to the active DominionStar Platform Supabase project on 2026-10-08.

create or replace function public.meet_v2_set_waiting_room(
  p_room_id uuid,
  p_enabled boolean
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
  v_enabled boolean := coalesce(p_enabled,true);
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
  set waiting_room_enabled=v_enabled,
      updated_at=now()
  where id=p_room_id
  returning * into v_room;

  if not v_enabled then
    update public.meet_v2_participants
    set state='admitted',
        admitted_at=coalesce(admitted_at,now()),
        updated_at=now()
    where room_id=p_room_id
      and state='waiting';
  end if;

  return jsonb_build_object(
    'roomId',v_room.id,
    'waitingRoomEnabled',v_room.waiting_room_enabled
  );
end
$function$;

revoke execute on function public.meet_v2_set_waiting_room(uuid,boolean) from public;
revoke execute on function public.meet_v2_set_waiting_room(uuid,boolean) from anon;
grant execute on function public.meet_v2_set_waiting_room(uuid,boolean) to authenticated;
