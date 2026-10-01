-- DominionStar Meet 2.0.24 profile-photo fallback metadata.
-- Additive only: the certified meet_v2_room_snapshot contract is not replaced.
-- The renderer never receives bucket credentials or a public storage URL.

create or replace function public.meet_v2_room_avatar_paths(p_room_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public'
as $$
declare
  v_user uuid := auth.uid();
  v_room public.meet_v2_rooms;
  v_allowed boolean;
  v_items jsonb;
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
    'avatarPath',coalesce(mp.avatar_path,'')
  ) order by case p.role when 'host' then 0 when 'cohost' then 1 else 2 end,p.created_at),'[]'::jsonb)
  into v_items
  from public.meet_v2_participants p
  left join public.member_profiles mp on mp.id=p.member_id
  where p.room_id=p_room_id
    and p.member_id is not null
    and p.state in ('waiting_host','waiting','admitted','joined');

  return jsonb_build_object('roomId',p_room_id,'avatars',v_items);
end
$$;

revoke all on function public.meet_v2_room_avatar_paths(uuid) from public;
revoke all on function public.meet_v2_room_avatar_paths(uuid) from anon;
grant execute on function public.meet_v2_room_avatar_paths(uuid) to authenticated;
