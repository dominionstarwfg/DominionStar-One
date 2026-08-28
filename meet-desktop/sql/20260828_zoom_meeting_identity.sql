-- DominionStar Meet V2 persistent meeting identity contract.
-- Staged for rebuild QA. Do not apply to the live project until the desktop
-- migration gate and physical QA are approved.

create extension if not exists pgcrypto with schema extensions;

alter table public.meet_v2_rooms
  drop constraint if exists meet_v2_rooms_room_code_check;
alter table public.meet_v2_rooms
  add constraint meet_v2_rooms_room_code_check check (room_code ~ '^[0-9]{10,11}$');

alter table public.meet_v2_rooms
  add column if not exists meeting_kind text not null default 'instant',
  add column if not exists passcode_value text,
  add column if not exists reusable boolean not null default false,
  add column if not exists scheduled_start timestamptz,
  add column if not exists duration_minutes integer,
  add column if not exists recurrence jsonb,
  add column if not exists occurrence_count integer not null default 0,
  add column if not exists last_started_at timestamptz;

alter table public.meet_v2_rooms
  drop constraint if exists meet_v2_rooms_meeting_kind_check;
alter table public.meet_v2_rooms
  add constraint meet_v2_rooms_meeting_kind_check
  check (meeting_kind in ('instant','personal','scheduled','recurring'));

alter table public.meet_v2_rooms
  drop constraint if exists meet_v2_rooms_passcode_value_check;
alter table public.meet_v2_rooms
  add constraint meet_v2_rooms_passcode_value_check
  check (passcode_value is null or passcode_value ~ '^[0-9]{3,7}$');

alter table public.meet_v2_rooms
  drop constraint if exists meet_v2_rooms_duration_check;
alter table public.meet_v2_rooms
  add constraint meet_v2_rooms_duration_check
  check (duration_minutes is null or duration_minutes between 15 and 480);

create table if not exists public.meet_v2_personal_rooms (
  host_id uuid primary key references auth.users(id) on delete cascade,
  room_id uuid not null unique references public.meet_v2_rooms(id) on delete cascade,
  use_for_instant boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.meet_v2_schedules (
  id uuid primary key default gen_random_uuid(),
  host_id uuid not null references auth.users(id) on delete cascade,
  room_id uuid not null references public.meet_v2_rooms(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 120),
  scheduled_start timestamptz,
  duration_minutes integer not null default 60 check (duration_minutes between 15 and 480),
  recurrence jsonb,
  status text not null default 'scheduled' check (status in ('scheduled','started','ended','cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists meet_v2_schedules_host_start_idx
  on public.meet_v2_schedules(host_id, scheduled_start);

alter table public.meet_v2_personal_rooms enable row level security;
alter table public.meet_v2_schedules enable row level security;

drop policy if exists meet_v2_personal_rooms_owner on public.meet_v2_personal_rooms;
create policy meet_v2_personal_rooms_owner on public.meet_v2_personal_rooms
  for all using (host_id = auth.uid()) with check (host_id = auth.uid());

drop policy if exists meet_v2_schedules_owner on public.meet_v2_schedules;
create policy meet_v2_schedules_owner on public.meet_v2_schedules
  for all using (host_id = auth.uid()) with check (host_id = auth.uid());

create or replace function public.meet_v2_host_name(p_user uuid)
returns text
language sql
stable
security definer
set search_path to 'public'
as $$
  select coalesce(
    nullif(trim(preferred_name),''),
    nullif(trim(full_name),''),
    split_part(email,'@',1),
    'Host'
  )
  from public.member_profiles where id=p_user
$$;

create or replace function public.meet_v2_unique_room_code(p_digits integer)
returns text
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_code text;
  v_attempt integer := 0;
begin
  if p_digits not in (10,11) then raise exception 'invalid_room_code_length'; end if;
  loop
    v_attempt := v_attempt + 1;
    if p_digits = 10 then
      v_code := lpad((floor(random()*10000000000))::bigint::text,10,'0');
    else
      v_code := lpad((floor(random()*100000000000))::bigint::text,11,'0');
    end if;
    exit when not exists(select 1 from public.meet_v2_rooms where room_code=v_code);
    if v_attempt > 50 then raise exception 'room_code_generation_failed'; end if;
  end loop;
  return v_code;
end
$$;

create or replace function public.meet_v2_get_personal_room()
returns jsonb
language plpgsql
security definer
set search_path to 'public','extensions'
as $$
declare
  v_user uuid := auth.uid();
  v_link public.meet_v2_personal_rooms;
  v_room public.meet_v2_rooms;
  v_passcode text;
begin
  if v_user is null then raise exception 'authentication_required' using errcode='28000'; end if;

  select * into v_link from public.meet_v2_personal_rooms where host_id=v_user;
  if found then
    select * into v_room from public.meet_v2_rooms where id=v_link.room_id;
  else
    v_passcode := lpad((floor(random()*1000000))::integer::text,6,'0');
    insert into public.meet_v2_rooms(
      room_code,host_id,title,status,passcode_digest,passcode_value,
      waiting_room_enabled,external_guests_allowed,meeting_kind,reusable
    ) values(
      public.meet_v2_unique_room_code(10),v_user,'Personal Meeting Room','waiting',
      extensions.crypt(v_passcode,extensions.gen_salt('bf')),v_passcode,true,true,'personal',true
    ) returning * into v_room;

    insert into public.meet_v2_personal_rooms(host_id,room_id,use_for_instant)
    values(v_user,v_room.id,true) returning * into v_link;
  end if;

  return jsonb_build_object(
    'roomId',v_room.id,'roomCode',v_room.room_code,'title',v_room.title,
    'passcode',v_room.passcode_value,'waitingRoomEnabled',v_room.waiting_room_enabled,
    'externalGuestsAllowed',v_room.external_guests_allowed,'useForInstant',v_link.use_for_instant,
    'meetingKind','personal','reusable',true
  );
end
$$;

create or replace function public.meet_v2_update_personal_room(
  p_passcode text,
  p_use_for_instant boolean default true,
  p_waiting_room_enabled boolean default true,
  p_external_guests_allowed boolean default true
)
returns jsonb
language plpgsql
security definer
set search_path to 'public','extensions'
as $$
declare
  v_user uuid := auth.uid();
  v_room_id uuid;
begin
  if v_user is null then raise exception 'authentication_required' using errcode='28000'; end if;
  if coalesce(p_passcode,'') !~ '^[0-9]{3,7}$' then raise exception 'invalid_passcode'; end if;

  perform public.meet_v2_get_personal_room();
  select room_id into v_room_id from public.meet_v2_personal_rooms where host_id=v_user;

  update public.meet_v2_rooms set
    passcode_digest=extensions.crypt(p_passcode,extensions.gen_salt('bf')),
    passcode_value=p_passcode,
    waiting_room_enabled=coalesce(p_waiting_room_enabled,true),
    external_guests_allowed=coalesce(p_external_guests_allowed,true),
    updated_at=now()
  where id=v_room_id and host_id=v_user;

  update public.meet_v2_personal_rooms set
    use_for_instant=coalesce(p_use_for_instant,true),updated_at=now()
  where host_id=v_user;

  return public.meet_v2_get_personal_room();
end
$$;

create or replace function public.meet_v2_start_host_room(p_room_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_user uuid := auth.uid();
  v_room public.meet_v2_rooms;
  v_participant public.meet_v2_participants;
  v_name text;
begin
  if v_user is null then raise exception 'authentication_required' using errcode='28000'; end if;
  select * into v_room from public.meet_v2_rooms where id=p_room_id and host_id=v_user;
  if not found then raise exception 'host_authority_required'; end if;
  if v_room.status='cancelled' then raise exception 'meeting_not_found'; end if;
  if v_room.status='ended' and not v_room.reusable then raise exception 'meeting_expired'; end if;

  update public.meet_v2_participants set
    state=case when state in ('waiting','admitted','joined') and role='host' then 'left' else state end,
    left_at=case when state in ('admitted','joined') and role='host' then now() else left_at end,
    updated_at=now()
  where room_id=v_room.id and role='host' and state in ('waiting','admitted','joined');

  v_name := coalesce(public.meet_v2_host_name(v_user),'Host');
  insert into public.meet_v2_participants(room_id,member_id,display_name,role,state,admitted_at,joined_at)
  values(v_room.id,v_user,v_name,'host','joined',now(),now()) returning * into v_participant;

  update public.meet_v2_rooms set
    status='live',started_at=now(),ended_at=null,last_started_at=now(),
    occurrence_count=occurrence_count+1,updated_at=now()
  where id=v_room.id returning * into v_room;

  return jsonb_build_object(
    'roomId',v_room.id,'roomCode',v_room.room_code,'title',v_room.title,
    'status','live','passcode',v_room.passcode_value,
    'waitingRoomEnabled',v_room.waiting_room_enabled,
    'externalGuestsAllowed',v_room.external_guests_allowed,
    'participantId',v_participant.id,'joinToken',v_participant.join_token,
    'role','host','state','joined','meetingKind',v_room.meeting_kind,
    'reusable',v_room.reusable
  );
end
$$;

create or replace function public.meet_v2_start_personal_room()
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_user uuid := auth.uid();
  v_room_id uuid;
begin
  if v_user is null then raise exception 'authentication_required' using errcode='28000'; end if;
  perform public.meet_v2_get_personal_room();
  select room_id into v_room_id from public.meet_v2_personal_rooms where host_id=v_user;
  return public.meet_v2_start_host_room(v_room_id);
end
$$;

create or replace function public.meet_v2_create_room(
  p_title text,
  p_passcode text,
  p_waiting_room_enabled boolean default true,
  p_external_guests_allowed boolean default true
)
returns jsonb
language plpgsql
security definer
set search_path to 'public','extensions'
as $$
declare
  v_user uuid := auth.uid();
  v_room public.meet_v2_rooms;
  v_participant public.meet_v2_participants;
  v_name text;
begin
  if v_user is null then raise exception 'authentication_required' using errcode='28000'; end if;
  if coalesce(p_passcode,'') !~ '^[0-9]{3,7}$' then raise exception 'invalid_passcode'; end if;
  v_name := coalesce(public.meet_v2_host_name(v_user),'Host');

  insert into public.meet_v2_rooms(
    room_code,host_id,title,status,passcode_digest,passcode_value,
    waiting_room_enabled,external_guests_allowed,meeting_kind,reusable,
    started_at,last_started_at,occurrence_count
  ) values(
    public.meet_v2_unique_room_code(11),v_user,coalesce(nullif(trim(p_title),''),'DominionStar Meeting'),'live',
    extensions.crypt(p_passcode,extensions.gen_salt('bf')),p_passcode,
    coalesce(p_waiting_room_enabled,true),coalesce(p_external_guests_allowed,true),'instant',false,
    now(),now(),1
  ) returning * into v_room;

  insert into public.meet_v2_participants(room_id,member_id,display_name,role,state,admitted_at,joined_at)
  values(v_room.id,v_user,v_name,'host','joined',now(),now()) returning * into v_participant;

  return jsonb_build_object(
    'roomId',v_room.id,'roomCode',v_room.room_code,'title',v_room.title,
    'status','live','passcode',p_passcode,
    'waitingRoomEnabled',v_room.waiting_room_enabled,
    'externalGuestsAllowed',v_room.external_guests_allowed,
    'participantId',v_participant.id,'joinToken',v_participant.join_token,
    'role','host','state','joined','meetingKind','instant','reusable',false
  );
end
$$;

create or replace function public.meet_v2_schedule_meeting(
  p_title text,
  p_passcode text,
  p_scheduled_start timestamptz,
  p_duration_minutes integer default 60,
  p_recurrence jsonb default null,
  p_waiting_room_enabled boolean default true,
  p_external_guests_allowed boolean default true,
  p_use_personal_room boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path to 'public','extensions'
as $$
declare
  v_user uuid := auth.uid();
  v_room public.meet_v2_rooms;
  v_schedule public.meet_v2_schedules;
  v_personal jsonb;
  v_kind text;
  v_reusable boolean;
begin
  if v_user is null then raise exception 'authentication_required' using errcode='28000'; end if;
  if p_duration_minutes not between 15 and 480 then raise exception 'invalid_duration'; end if;

  if p_use_personal_room then
    if p_recurrence is not null and coalesce(p_recurrence->>'repeat','never') <> 'never' then
      raise exception 'personal_room_fixed_recurrence_not_allowed';
    end if;
    v_personal := public.meet_v2_get_personal_room();
    select * into v_room from public.meet_v2_rooms where id=(v_personal->>'roomId')::uuid;
  else
    if coalesce(p_passcode,'') !~ '^[0-9]{3,7}$' then raise exception 'invalid_passcode'; end if;
    v_kind := case when p_recurrence is not null and coalesce(p_recurrence->>'repeat','never') <> 'never' then 'recurring' else 'scheduled' end;
    v_reusable := (v_kind='recurring');
    insert into public.meet_v2_rooms(
      room_code,host_id,title,status,passcode_digest,passcode_value,
      waiting_room_enabled,external_guests_allowed,meeting_kind,reusable,
      scheduled_start,duration_minutes,recurrence
    ) values(
      public.meet_v2_unique_room_code(11),v_user,coalesce(nullif(trim(p_title),''),'DominionStar Meeting'),'waiting',
      extensions.crypt(p_passcode,extensions.gen_salt('bf')),p_passcode,
      coalesce(p_waiting_room_enabled,true),coalesce(p_external_guests_allowed,true),v_kind,v_reusable,
      p_scheduled_start,p_duration_minutes,p_recurrence
    ) returning * into v_room;
  end if;

  insert into public.meet_v2_schedules(host_id,room_id,title,scheduled_start,duration_minutes,recurrence,status)
  values(v_user,v_room.id,coalesce(nullif(trim(p_title),''),'DominionStar Meeting'),p_scheduled_start,p_duration_minutes,p_recurrence,'scheduled')
  returning * into v_schedule;

  return jsonb_build_object(
    'scheduleId',v_schedule.id,'roomId',v_room.id,'roomCode',v_room.room_code,
    'title',v_schedule.title,'scheduledStart',v_schedule.scheduled_start,
    'durationMinutes',v_schedule.duration_minutes,'recurrence',v_schedule.recurrence,
    'passcode',v_room.passcode_value,'waitingRoomEnabled',v_room.waiting_room_enabled,
    'externalGuestsAllowed',v_room.external_guests_allowed,
    'meetingKind',v_room.meeting_kind,'reusable',v_room.reusable,
    'usePersonalRoom',p_use_personal_room
  );
end
$$;

create or replace function public.meet_v2_list_host_schedules()
returns jsonb
language sql
security definer
set search_path to 'public'
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'scheduleId',s.id,'roomId',r.id,'roomCode',r.room_code,'title',s.title,
    'scheduledStart',s.scheduled_start,'durationMinutes',s.duration_minutes,
    'recurrence',s.recurrence,'status',s.status,'passcode',r.passcode_value,
    'meetingKind',r.meeting_kind,'reusable',r.reusable
  ) order by s.scheduled_start nulls last,s.created_at),'[]'::jsonb)
  from public.meet_v2_schedules s
  join public.meet_v2_rooms r on r.id=s.room_id
  where s.host_id=auth.uid() and s.status <> 'cancelled'
$$;

create or replace function public.meet_v2_cancel_schedule(p_schedule_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_user uuid := auth.uid();
  v_room_id uuid;
  v_kind text;
begin
  update public.meet_v2_schedules set status='cancelled',updated_at=now()
  where id=p_schedule_id and host_id=v_user and status<>'cancelled'
  returning room_id into v_room_id;
  if v_room_id is null then raise exception 'schedule_not_found'; end if;

  select meeting_kind into v_kind from public.meet_v2_rooms where id=v_room_id;
  if v_kind <> 'personal' then
    update public.meet_v2_rooms set status='cancelled',updated_at=now() where id=v_room_id and host_id=v_user and status<>'live';
  end if;
  return jsonb_build_object('scheduleId',p_schedule_id,'status','cancelled');
end
$$;

create or replace function public.meet_v2_mark_schedule_started(p_schedule_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_user uuid := auth.uid();
  v_room_id uuid;
  v_result jsonb;
begin
  select room_id into v_room_id from public.meet_v2_schedules where id=p_schedule_id and host_id=v_user and status<>'cancelled';
  if v_room_id is null then raise exception 'schedule_not_found'; end if;
  v_result := public.meet_v2_start_host_room(v_room_id);
  update public.meet_v2_schedules set status='started',updated_at=now() where id=p_schedule_id and host_id=v_user;
  return v_result || jsonb_build_object('scheduleId',p_schedule_id);
end
$$;

create or replace function public.meet_v2_update_room_passcode(p_room_id uuid,p_passcode text)
returns jsonb
language plpgsql
security definer
set search_path to 'public','extensions'
as $$
declare
  v_user uuid := auth.uid();
  v_room public.meet_v2_rooms;
begin
  if coalesce(p_passcode,'') !~ '^[0-9]{3,7}$' then raise exception 'invalid_passcode'; end if;
  update public.meet_v2_rooms set
    passcode_digest=extensions.crypt(p_passcode,extensions.gen_salt('bf')),
    passcode_value=p_passcode,updated_at=now()
  where id=p_room_id and host_id=v_user and status<>'cancelled'
  returning * into v_room;
  if not found then raise exception 'host_authority_required'; end if;
  return jsonb_build_object('roomId',v_room.id,'roomCode',v_room.room_code,'passcode',v_room.passcode_value);
end
$$;

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
  select * into v_room from public.meet_v2_rooms where room_code=regexp_replace(coalesce(p_room_code,''),'[^0-9]','','g');
  if not found or v_room.status in ('ended','cancelled') then raise exception 'meeting_not_found'; end if;
  if extensions.crypt(coalesce(p_passcode,''),v_room.passcode_digest) <> v_room.passcode_digest then raise exception 'incorrect_passcode'; end if;
  if v_user is null and not v_room.external_guests_allowed then raise exception 'guest_access_disabled'; end if;

  if v_user is not null then
    select * into v_existing from public.meet_v2_participants
    where room_id=v_room.id and member_id=v_user and state not in ('left','removed','declined')
    order by created_at desc limit 1;
    if found then
      return jsonb_build_object(
        'roomId',v_room.id,'roomCode',v_room.room_code,'title',v_room.title,
        'participantId',v_existing.id,'joinToken',v_existing.join_token,'role',v_existing.role,
        'state',v_existing.state,'waitingRoomEnabled',v_room.waiting_room_enabled,
        'meetingKind',v_room.meeting_kind,'reusable',v_room.reusable
      );
    end if;
  end if;

  v_role := case when v_user is null then 'guest' else 'participant' end;
  v_state := case when v_room.waiting_room_enabled then 'waiting' else 'admitted' end;
  insert into public.meet_v2_participants(room_id,member_id,display_name,role,state,admitted_at)
  values(v_room.id,v_user,coalesce(nullif(trim(p_display_name),''),'Guest'),v_role,v_state,case when v_state='admitted' then now() end)
  returning * into v_participant;

  return jsonb_build_object(
    'roomId',v_room.id,'roomCode',v_room.room_code,'title',v_room.title,
    'participantId',v_participant.id,'joinToken',v_participant.join_token,
    'role',v_participant.role,'state',v_participant.state,
    'waitingRoomEnabled',v_room.waiting_room_enabled,
    'meetingKind',v_room.meeting_kind,'reusable',v_room.reusable
  );
end
$$;

create or replace function public.meet_v2_end_room(p_room_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_user uuid := auth.uid();
begin
  if not exists(select 1 from public.meet_v2_rooms where id=p_room_id and host_id=v_user) then
    raise exception 'host_authority_required';
  end if;

  update public.meet_v2_rooms set status='ended',ended_at=now(),updated_at=now() where id=p_room_id;
  update public.meet_v2_participants set
    state=case when state in ('waiting','admitted','joined') then 'left' else state end,
    left_at=case when state in ('admitted','joined') then now() else left_at end,
    updated_at=now()
  where room_id=p_room_id;

  update public.meet_v2_schedules set
    status=case when recurrence is null or coalesce(recurrence->>'repeat','never')='never' then 'ended' else 'scheduled' end,
    updated_at=now()
  where room_id=p_room_id and host_id=v_user and status='started';

  return jsonb_build_object('roomId',p_room_id,'status','ended');
end
$$;

grant execute on function public.meet_v2_get_personal_room() to authenticated;
grant execute on function public.meet_v2_update_personal_room(text,boolean,boolean,boolean) to authenticated;
grant execute on function public.meet_v2_start_personal_room() to authenticated;
grant execute on function public.meet_v2_start_host_room(uuid) to authenticated;
grant execute on function public.meet_v2_schedule_meeting(text,text,timestamptz,integer,jsonb,boolean,boolean,boolean) to authenticated;
grant execute on function public.meet_v2_list_host_schedules() to authenticated;
grant execute on function public.meet_v2_cancel_schedule(uuid) to authenticated;
grant execute on function public.meet_v2_mark_schedule_started(uuid) to authenticated;
grant execute on function public.meet_v2_update_room_passcode(uuid,text) to authenticated;
