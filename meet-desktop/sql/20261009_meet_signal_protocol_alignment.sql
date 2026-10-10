-- DominionStar Meet signaling protocol alignment.
-- Keeps the table constraint, RPC allow-list, and host/participant authority rules in sync.

alter table public.meet_v2_signals
  drop constraint if exists meet_v2_signals_signal_type_check;

alter table public.meet_v2_signals
  add constraint meet_v2_signals_signal_type_check
  check (signal_type in (
    'offer','answer','ice','bye','chat','reaction','caption','caption-request','recording-state',
    'poll:start','poll:vote','poll:end',
    'host:mute','host:ask-unmute','host:stop-video','host:ask-start-video',
    'host:lower-hand','host:spotlight','host:view-layout'
  ));

create or replace function public.meet_v2_send_signal(
  p_from_participant_id uuid,
  p_to_participant_id uuid,
  p_signal_type text,
  p_payload jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_user uuid:=auth.uid();
  v_from public.meet_v2_participants%rowtype;
  v_to public.meet_v2_participants%rowtype;
  v_room public.meet_v2_rooms%rowtype;
  v_id bigint;
  v_from_role text;
  v_to_role text;
begin
  if v_user is null then raise exception 'authentication_required'; end if;

  if p_signal_type not in (
    'offer','answer','ice','bye','chat','reaction','caption','caption-request','recording-state',
    'poll:start','poll:vote','poll:end',
    'host:mute','host:ask-unmute','host:stop-video','host:ask-start-video',
    'host:lower-hand','host:spotlight','host:view-layout'
  ) then raise exception 'invalid_signal_type'; end if;

  select * into v_from from public.meet_v2_participants where id=p_from_participant_id;
  select * into v_to from public.meet_v2_participants where id=p_to_participant_id;

  if v_from.id is null then raise exception 'participant_not_found'; end if;
  if v_from.member_id<>v_user or v_from.state not in ('admitted','joined') then
    raise exception 'signal_sender_not_authorized';
  end if;
  if v_to.id is null or v_to.room_id<>v_from.room_id or v_to.state not in ('admitted','joined') then
    raise exception 'signal_target_not_available';
  end if;

  select * into v_room from public.meet_v2_rooms where id=v_from.room_id;
  v_from_role:=lower(coalesce(v_from.role,'participant'));
  v_to_role:=lower(coalesce(v_to.role,'participant'));

  if p_signal_type='recording-state'
     and v_from_role not in ('host','cohost')
     and not coalesce(v_from.recording_allowed,false) then
    raise exception 'recording_authority_required';
  end if;

  if p_signal_type like 'host:%'
     and v_from_role not in ('host','cohost') then
    raise exception 'host_authority_required';
  end if;

  if p_signal_type in ('poll:start','poll:end')
     and v_from_role not in ('host','cohost') then
    raise exception 'host_authority_required';
  end if;

  if p_signal_type='poll:vote'
     and v_to_role not in ('host','cohost') then
    raise exception 'poll_host_target_required';
  end if;

  if p_signal_type='chat' then
    if v_room.chat_policy='disabled' and v_from_role not in ('host','cohost') then
      raise exception 'meeting_chat_disabled';
    end if;
    if v_room.chat_policy='host_cohost'
       and v_from_role not in ('host','cohost')
       and v_to_role not in ('host','cohost') then
      raise exception 'chat_host_cohost_only';
    end if;
  end if;

  insert into public.meet_v2_signals(
    room_id,from_participant_id,to_participant_id,signal_type,payload
  )
  values(
    v_from.room_id,v_from.id,v_to.id,p_signal_type,coalesce(p_payload,'{}'::jsonb)
  )
  returning id into v_id;

  return jsonb_build_object('ok',true,'signalId',v_id);
end
$$;

revoke all on function public.meet_v2_send_signal(uuid,uuid,text,jsonb) from public;
grant execute on function public.meet_v2_send_signal(uuid,uuid,text,jsonb) to authenticated;
