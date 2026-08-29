-- DominionStar Meet V2 persistent meeting identity contract.
-- Staged for rebuild QA. Do not apply to the live project until the desktop
-- migration gate and physical QA are approved.

create extension if not exists pgcrypto with schema extensions;

alter table public.meet_v2_participants
  add column if not exists last_seen_at timestamptz;

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
  add column if not exists last_started_at timestamptz,
  add column if not exists active_host_id uuid references auth.users(id) on delete set null,
  add column if not exists meeting_locked boolean not null default false,
  add column if not exists mute_on_entry boolean not null default false,
  add column if not exists chat_policy text not null default 'everyone' check (chat_policy in ('everyone','host_cohost','disabled')),
  add column if not exists caption_mode text not null default 'off' check (caption_mode in ('off','manual')),
  add column if not exists captioner_participant_id uuid references public.meet_v2_participants(id) on delete set null,
  add column if not exists transcript_enabled boolean not null default false;

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

alter table public.meet_v2_participants
  drop constraint if exists meet_v2_participants_state_check;
alter table public.meet_v2_participants
  add constraint meet_v2_participants_state_check
  check (state in ('waiting_host','waiting','admitted','declined','joined','left','removed'));

with ranked_active_members as (
  select id,
         row_number() over (
           partition by room_id,member_id
           order by case state when 'joined' then 0 when 'admitted' then 1 when 'waiting' then 2 else 3 end,
                    coalesce(joined_at,admitted_at,requested_at,created_at) desc,
                    created_at desc
         ) as rn
  from public.meet_v2_participants
  where member_id is not null and state in ('waiting_host','waiting','admitted','joined')
)
update public.meet_v2_participants p
set state='left',left_at=coalesce(p.left_at,now()),updated_at=now()
from ranked_active_members r
where p.id=r.id and r.rn>1;

create unique index if not exists meet_v2_one_active_member_per_room_idx
  on public.meet_v2_participants(room_id,member_id)
  where member_id is not null and state in ('waiting_host','waiting','admitted','joined');


create table if not exists public.meet_v2_transcript_lines (
  id bigserial primary key,
  room_id uuid not null references public.meet_v2_rooms(id) on delete cascade,
  participant_id uuid references public.meet_v2_participants(id) on delete set null,
  speaker_name text not null check (char_length(speaker_name) between 1 and 100),
  caption_text text not null check (char_length(caption_text) between 1 and 2000),
  spoken_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists meet_v2_transcript_lines_room_time_idx
  on public.meet_v2_transcript_lines(room_id,spoken_at);

alter table public.meet_v2_transcript_lines enable row level security;

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
  select * into v_room from public.meet_v2_rooms where id=p_room_id and host_id=v_user for update;
  if not found then raise exception 'host_authority_required'; end if;
  if v_room.status='cancelled' then raise exception 'meeting_not_found'; end if;
  if v_room.status='ended' and not v_room.reusable then raise exception 'meeting_expired'; end if;

  update public.meet_v2_participants
  set state='left',left_at=coalesce(left_at,now()),updated_at=now()
  where room_id=v_room.id and role='host' and state in ('waiting','admitted','joined');

  v_name := coalesce(public.meet_v2_host_name(v_user),'Host');
  insert into public.meet_v2_participants(room_id,member_id,display_name,role,state,admitted_at,joined_at,last_seen_at)
  values(v_room.id,v_user,v_name,'host','joined',now(),now(),now())
  returning * into v_participant;

  update public.meet_v2_rooms
  set status='live',started_at=now(),ended_at=null,last_started_at=now(),active_host_id=v_user,
      occurrence_count=occurrence_count+1,updated_at=now()
  where id=v_room.id returning * into v_room;

  update public.meet_v2_participants
  set state=case when v_room.waiting_room_enabled then 'waiting' else 'admitted' end,
      admitted_at=case when v_room.waiting_room_enabled then admitted_at else coalesce(admitted_at,now()) end,
      updated_at=now()
  where room_id=v_room.id and state='waiting_host';

  return jsonb_build_object(
    'roomId',v_room.id,'roomCode',v_room.room_code,'title',v_room.title,
    'status','live','passcode',v_room.passcode_value,
    'waitingRoomEnabled',v_room.waiting_room_enabled,
    'externalGuestsAllowed',v_room.external_guests_allowed,
    'participantId',v_participant.id,'joinToken',v_participant.join_token,
    'role','host','state','joined','meetingKind',v_room.meeting_kind,
    'reusable',v_room.reusable,'muteOnEntry',v_room.mute_on_entry,
    'meetingLocked',v_room.meeting_locked
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
    started_at,last_started_at,occurrence_count,active_host_id
  ) values(
    public.meet_v2_unique_room_code(11),v_user,coalesce(nullif(trim(p_title),''),'DominionStar Meeting'),'live',
    extensions.crypt(p_passcode,extensions.gen_salt('bf')),p_passcode,
    coalesce(p_waiting_room_enabled,true),coalesce(p_external_guests_allowed,true),'instant',false,
    now(),now(),1,v_user
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
  select * into v_room from public.meet_v2_rooms
  where room_code=regexp_replace(coalesce(p_room_code,''),'[^0-9]','','g');
  if not found or v_room.status in ('ended','cancelled') then raise exception 'meeting_not_found'; end if;
  if v_room.meeting_locked then raise exception 'meeting_locked'; end if;
  if extensions.crypt(coalesce(p_passcode,''),v_room.passcode_digest) <> v_room.passcode_digest then raise exception 'incorrect_passcode'; end if;
  if v_user is null and not v_room.external_guests_allowed then raise exception 'guest_access_disabled'; end if;

  if v_user is not null then
    perform pg_advisory_xact_lock(hashtext(v_room.id::text||':'||v_user::text));
    select * into v_existing from public.meet_v2_participants
    where room_id=v_room.id and member_id=v_user and state not in ('left','removed','declined')
    order by created_at desc limit 1;
    if found then
      return jsonb_build_object(
        'roomId',v_room.id,'roomCode',v_room.room_code,'title',v_room.title,
        'participantId',v_existing.id,'joinToken',v_existing.join_token,'role',v_existing.role,
        'state',v_existing.state,'waitingRoomEnabled',v_room.waiting_room_enabled,
        'meetingKind',v_room.meeting_kind,'reusable',v_room.reusable,
        'muteOnEntry',v_room.mute_on_entry,'meetingLocked',v_room.meeting_locked,
        'waitReason',case when v_existing.state='waiting_host' then 'host' when v_existing.state='waiting' then 'admission' else null end,
        'hostStarted',(v_room.status='live')
      );
    end if;
  end if;

  v_role := case when v_user is null then 'guest' else 'participant' end;
  v_state := case
    when v_room.status<>'live' then 'waiting_host'
    when v_room.waiting_room_enabled then 'waiting'
    else 'admitted'
  end;

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

create or replace function public.meet_v2_join_status(p_participant_id uuid,p_join_token uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_participant public.meet_v2_participants;
  v_room public.meet_v2_rooms;
begin
  select * into v_participant
  from public.meet_v2_participants
  where id=p_participant_id and join_token=p_join_token
  for update;
  if not found then raise exception 'join_request_not_found'; end if;

  select * into v_room from public.meet_v2_rooms where id=v_participant.room_id;
  if not found then raise exception 'meeting_not_found'; end if;

  if v_participant.state='waiting_host' and v_room.status='live' then
    update public.meet_v2_participants
    set state=case when v_room.waiting_room_enabled then 'waiting' else 'admitted' end,
        admitted_at=case when v_room.waiting_room_enabled then admitted_at else coalesce(admitted_at,now()) end,
        updated_at=now()
    where id=v_participant.id
    returning * into v_participant;
  end if;

  return jsonb_build_object(
    'roomId',v_room.id,'roomCode',v_room.room_code,'title',v_room.title,'roomStatus',v_room.status,
    'participantId',v_participant.id,'role',v_participant.role,'state',v_participant.state,
    'waitingRoomEnabled',v_room.waiting_room_enabled,'muteOnEntry',v_room.mute_on_entry,
    'meetingLocked',v_room.meeting_locked,'hostStarted',(v_room.status='live'),
    'waitReason',case when v_participant.state='waiting_host' then 'host' when v_participant.state='waiting' then 'admission' else null end
  );
end
$$;

create or replace function public.meet_v2_touch_presence(p_participant_id uuid,p_join_token uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_participant public.meet_v2_participants;
begin
  update public.meet_v2_participants
  set last_seen_at=now(),updated_at=now()
  where id=p_participant_id
    and join_token=p_join_token
    and state in ('admitted','joined')
  returning * into v_participant;
  if not found then raise exception 'participant_not_active'; end if;
  return jsonb_build_object('participantId',v_participant.id,'state',v_participant.state,'lastSeenAt',v_participant.last_seen_at);
end
$$;

create or replace function public.meet_v2_room_snapshot(p_room_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
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
    'canHost',(p.member_id is not null and p.state='joined')
  ) order by case p.role when 'host' then 0 when 'cohost' then 1 else 2 end,p.created_at),'[]'::jsonb)
  into v_people
  from public.meet_v2_participants p
  where p.room_id=p_room_id
    and (
      (p.state='admitted' and coalesce(p.admitted_at,p.updated_at)>now()-interval '75 seconds')
      or (p.state='joined' and coalesce(p.last_seen_at,p.joined_at,p.updated_at)>now()-interval '75 seconds')
    );

  return jsonb_build_object(
    'roomId',v_room.id,'roomCode',v_room.room_code,'title',v_room.title,
    'status',v_room.status,'waitingRoomEnabled',v_room.waiting_room_enabled,
    'ownerId',v_room.host_id,'activeHostId',v_room.active_host_id,
    'meetingLocked',v_room.meeting_locked,'muteOnEntry',v_room.mute_on_entry,'chatPolicy',v_room.chat_policy,
    'captionMode',v_room.caption_mode,'captionerParticipantId',v_room.captioner_participant_id,'transcriptEnabled',v_room.transcript_enabled,
    'participants',v_people
  );
end
$$;

create or replace function public.meet_v2_host_queue(p_room_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_user uuid := auth.uid();
  v_allowed boolean;
  v_items jsonb;
begin
  if v_user is null then raise exception 'authentication_required' using errcode='28000'; end if;
  select exists(
    select 1 from public.meet_v2_rooms r
      where r.id=p_room_id and coalesce(r.active_host_id,r.host_id)=v_user
    union all
    select 1 from public.meet_v2_participants p
      where p.room_id=p_room_id and p.member_id=v_user and p.role='cohost' and p.state in ('admitted','joined')
  ) into v_allowed;
  if not v_allowed then raise exception 'host_authority_required'; end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'participantId',p.id,'displayName',p.display_name,'role',p.role,
    'state',p.state,'requestedAt',p.requested_at
  ) order by p.requested_at),'[]'::jsonb)
  into v_items from public.meet_v2_participants p where p.room_id=p_room_id and p.state='waiting';

  return jsonb_build_object('roomId',p_room_id,'waiting',v_items);
end
$$;

create or replace function public.meet_v2_decide_participant(p_participant_id uuid,p_decision text)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_user uuid := auth.uid();
  v_participant public.meet_v2_participants;
  v_allowed boolean;
  v_new_state text;
begin
  if v_user is null then raise exception 'authentication_required' using errcode='28000'; end if;
  select * into v_participant from public.meet_v2_participants where id=p_participant_id for update;
  if not found then raise exception 'participant_not_found'; end if;

  select exists(
    select 1 from public.meet_v2_rooms r
      where r.id=v_participant.room_id and coalesce(r.active_host_id,r.host_id)=v_user
    union all
    select 1 from public.meet_v2_participants p
      where p.room_id=v_participant.room_id and p.member_id=v_user and p.role='cohost' and p.state in ('admitted','joined')
  ) into v_allowed;
  if not v_allowed then raise exception 'host_authority_required'; end if;
  if v_participant.state <> 'waiting' then raise exception 'participant_not_waiting'; end if;

  v_new_state := case p_decision when 'admit' then 'admitted' when 'decline' then 'declined' else null end;
  if v_new_state is null then raise exception 'invalid_decision'; end if;

  update public.meet_v2_participants
  set state=v_new_state,
      admitted_at=case when v_new_state='admitted' then now() else admitted_at end,
      decision_at=now(),decision_by=v_user,updated_at=now()
  where id=p_participant_id returning * into v_participant;

  return jsonb_build_object('participantId',v_participant.id,'state',v_participant.state);
end
$$;

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
begin
  if v_actor is null then raise exception 'authentication_required'; end if;
  select * into v_target from public.meet_v2_participants where id=p_participant_id for update;
  if not found then raise exception 'participant_not_found'; end if;
  select * into v_room from public.meet_v2_rooms where id=v_target.room_id;
  if coalesce(v_room.active_host_id,v_room.host_id) <> v_actor then raise exception 'host_authority_required'; end if;
  if v_target.role='host' then raise exception 'host_role_cannot_change'; end if;
  if v_target.state not in ('admitted','joined') then raise exception 'participant_not_active'; end if;

  update public.meet_v2_participants
  set role=case when p_enabled then 'cohost' else case when member_id is null then 'guest' else 'participant' end end,
      updated_at=now()
  where id=p_participant_id;

  return jsonb_build_object('ok',true,'participantId',p_participant_id,'role',case when p_enabled then 'cohost' else case when v_target.member_id is null then 'guest' else 'participant' end end);
end
$$;

create or replace function public.meet_v2_remove_participant(p_participant_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_actor uuid := auth.uid();
  v_target public.meet_v2_participants%rowtype;
  v_room public.meet_v2_rooms%rowtype;
  v_actor_role text;
begin
  if v_actor is null then raise exception 'authentication_required'; end if;
  select * into v_target from public.meet_v2_participants where id=p_participant_id for update;
  if not found then raise exception 'participant_not_found'; end if;
  select * into v_room from public.meet_v2_rooms where id=v_target.room_id;
  if v_target.role='host' then raise exception 'host_cannot_be_removed'; end if;

  if coalesce(v_room.active_host_id,v_room.host_id)=v_actor then
    v_actor_role := 'host';
  else
    select role into v_actor_role
    from public.meet_v2_participants
    where room_id=v_target.room_id and member_id=v_actor and state in ('admitted','joined')
    order by created_at desc limit 1;
  end if;
  if coalesce(v_actor_role,'') not in ('host','cohost') then raise exception 'host_authority_required'; end if;

  update public.meet_v2_participants
  set state='removed',left_at=now(),updated_at=now(),decision_at=now(),decision_by=v_actor
  where id=p_participant_id;

  return jsonb_build_object('ok',true,'participantId',p_participant_id,'state','removed');
end
$$;

create or replace function public.meet_v2_set_security(p_room_id uuid,p_locked boolean,p_mute_on_entry boolean)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_user uuid := auth.uid();
  v_room public.meet_v2_rooms%rowtype;
  v_role text;
begin
  if v_user is null then raise exception 'authentication_required'; end if;
  select * into v_room from public.meet_v2_rooms where id=p_room_id for update;
  if not found then raise exception 'meeting_not_found'; end if;
  if coalesce(v_room.active_host_id,v_room.host_id)=v_user then
    v_role:='host';
  else
    select role into v_role from public.meet_v2_participants
    where room_id=p_room_id and member_id=v_user and state in ('admitted','joined')
    order by created_at desc limit 1;
  end if;
  if coalesce(v_role,'') not in ('host','cohost') then raise exception 'host_authority_required'; end if;
  update public.meet_v2_rooms set meeting_locked=coalesce(p_locked,false),mute_on_entry=coalesce(p_mute_on_entry,false),updated_at=now() where id=p_room_id returning * into v_room;
  return jsonb_build_object('roomId',v_room.id,'meetingLocked',v_room.meeting_locked,'muteOnEntry',v_room.mute_on_entry);
end
$$;

create or replace function public.meet_v2_set_chat_policy(p_room_id uuid,p_policy text)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_user uuid := auth.uid();
  v_room public.meet_v2_rooms%rowtype;
  v_role text;
  v_policy text := lower(trim(coalesce(p_policy,'')));
begin
  if v_user is null then raise exception 'authentication_required'; end if;
  if v_policy not in ('everyone','host_cohost','disabled') then raise exception 'invalid_chat_policy'; end if;
  select * into v_room from public.meet_v2_rooms where id=p_room_id for update;
  if not found then raise exception 'meeting_not_found'; end if;
  if coalesce(v_room.active_host_id,v_room.host_id)=v_user then
    v_role:='host';
  else
    select role into v_role from public.meet_v2_participants
    where room_id=p_room_id and member_id=v_user and state in ('admitted','joined')
    order by created_at desc limit 1;
  end if;
  if coalesce(v_role,'') not in ('host','cohost') then raise exception 'host_authority_required'; end if;
  update public.meet_v2_rooms set chat_policy=v_policy,updated_at=now() where id=p_room_id returning * into v_room;
  return jsonb_build_object('roomId',v_room.id,'chatPolicy',v_room.chat_policy);
end
$$;

create or replace function public.meet_v2_send_signal(p_from_participant_id uuid,p_to_participant_id uuid,p_signal_type text,p_payload jsonb default '{}'::jsonb)
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
  if p_signal_type not in ('offer','answer','ice','bye','chat','reaction','caption','host:mute','host:ask-unmute','host:stop-video','host:ask-start-video','host:lower-hand','host:spotlight','host:view-layout') then raise exception 'invalid_signal_type'; end if;
  select * into v_from from public.meet_v2_participants where id=p_from_participant_id;
  select * into v_to from public.meet_v2_participants where id=p_to_participant_id;
  if v_from.id is null then raise exception 'participant_not_found'; end if;
  if v_from.member_id<>v_user or v_from.state not in ('admitted','joined') then raise exception 'signal_sender_not_authorized'; end if;
  if v_to.id is null or v_to.room_id<>v_from.room_id or v_to.state not in ('admitted','joined') then raise exception 'signal_target_not_available'; end if;

  select * into v_room from public.meet_v2_rooms where id=v_from.room_id;
  v_from_role:=lower(coalesce(v_from.role,'participant'));
  v_to_role:=lower(coalesce(v_to.role,'participant'));

  if p_signal_type='chat' then
    if v_room.chat_policy='disabled' and v_from_role not in ('host','cohost') then raise exception 'meeting_chat_disabled'; end if;
    if v_room.chat_policy='host_cohost' and v_from_role not in ('host','cohost') and v_to_role not in ('host','cohost') then raise exception 'chat_host_cohost_only'; end if;
  end if;

  insert into public.meet_v2_signals(room_id,from_participant_id,to_participant_id,signal_type,payload)
  values(v_from.room_id,v_from.id,v_to.id,p_signal_type,coalesce(p_payload,'{}'::jsonb)) returning id into v_id;
  return jsonb_build_object('ok',true,'signalId',v_id);
end
$$;

create or replace function public.meet_v2_set_caption_state(
  p_room_id uuid,
  p_mode text,
  p_captioner_participant_id uuid default null,
  p_transcript_enabled boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_user uuid := auth.uid();
  v_room public.meet_v2_rooms%rowtype;
  v_role text;
  v_mode text := lower(trim(coalesce(p_mode,'off')));
  v_captioner public.meet_v2_participants%rowtype;
begin
  if v_user is null then raise exception 'authentication_required'; end if;
  if v_mode not in ('off','manual') then raise exception 'invalid_caption_mode'; end if;
  select * into v_room from public.meet_v2_rooms where id=p_room_id for update;
  if not found then raise exception 'meeting_not_found'; end if;
  if coalesce(v_room.active_host_id,v_room.host_id)=v_user then
    v_role:='host';
  else
    select role into v_role from public.meet_v2_participants
    where room_id=p_room_id and member_id=v_user and state in ('admitted','joined')
    order by created_at desc limit 1;
  end if;
  if coalesce(v_role,'') not in ('host','cohost') then raise exception 'host_authority_required'; end if;

  if v_mode='manual' then
    if p_captioner_participant_id is null then raise exception 'captioner_required'; end if;
    select * into v_captioner from public.meet_v2_participants where id=p_captioner_participant_id;
    if not found or v_captioner.room_id<>p_room_id or v_captioner.state<>'joined' then raise exception 'captioner_not_available'; end if;
  end if;

  update public.meet_v2_rooms
  set caption_mode=v_mode,
      captioner_participant_id=case when v_mode='manual' then p_captioner_participant_id else null end,
      transcript_enabled=coalesce(p_transcript_enabled,false),
      updated_at=now()
  where id=p_room_id returning * into v_room;

  return jsonb_build_object(
    'roomId',v_room.id,'captionMode',v_room.caption_mode,
    'captionerParticipantId',v_room.captioner_participant_id,
    'transcriptEnabled',v_room.transcript_enabled
  );
end
$$;

create or replace function public.meet_v2_publish_caption(p_participant_id uuid,p_text text,p_speaker_name text)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_user uuid := auth.uid();
  v_participant public.meet_v2_participants%rowtype;
  v_room public.meet_v2_rooms%rowtype;
  v_text text := trim(coalesce(p_text,''));
  v_name text := left(trim(coalesce(p_speaker_name,'')),100);
  v_line_id bigint;
  v_spoken_at timestamptz := now();
begin
  if v_user is null then raise exception 'authentication_required'; end if;
  if v_text='' or char_length(v_text)>2000 then raise exception 'invalid_caption_text'; end if;
  if v_name='' then v_name:='Captioner'; end if;
  select * into v_participant from public.meet_v2_participants where id=p_participant_id;
  if not found or v_participant.member_id is distinct from v_user or v_participant.state<>'joined' then raise exception 'caption_sender_not_authorized'; end if;
  select * into v_room from public.meet_v2_rooms where id=v_participant.room_id;
  if v_room.caption_mode<>'manual' or v_room.captioner_participant_id<>v_participant.id then raise exception 'captioner_authority_required'; end if;

  if v_room.transcript_enabled then
    insert into public.meet_v2_transcript_lines(room_id,participant_id,speaker_name,caption_text,spoken_at)
    values(v_room.id,v_participant.id,v_name,v_text,v_spoken_at) returning id into v_line_id;
  end if;

  return jsonb_build_object('roomId',v_room.id,'lineId',v_line_id,'speakerName',v_name,'text',v_text,'spokenAt',v_spoken_at,'retained',v_room.transcript_enabled);
end
$$;

create or replace function public.meet_v2_get_transcript(p_room_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_user uuid := auth.uid();
  v_room public.meet_v2_rooms%rowtype;
  v_role text;
  v_lines jsonb;
begin
  if v_user is null then raise exception 'authentication_required'; end if;
  select * into v_room from public.meet_v2_rooms where id=p_room_id;
  if not found then raise exception 'meeting_not_found'; end if;
  if coalesce(v_room.active_host_id,v_room.host_id)=v_user or v_room.host_id=v_user then
    v_role:='host';
  else
    select role into v_role from public.meet_v2_participants
    where room_id=p_room_id and member_id=v_user and state in ('admitted','joined','left')
    order by created_at desc limit 1;
  end if;
  if coalesce(v_role,'') not in ('host','cohost') then raise exception 'transcript_access_denied'; end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'lineId',t.id,'speakerName',t.speaker_name,'text',t.caption_text,'spokenAt',t.spoken_at
  ) order by t.spoken_at,t.id),'[]'::jsonb)
  into v_lines from public.meet_v2_transcript_lines t where t.room_id=p_room_id;

  return jsonb_build_object('roomId',p_room_id,'transcriptEnabled',v_room.transcript_enabled,'lines',v_lines);
end
$$;

create or replace function public.meet_v2_rename_participant(p_participant_id uuid,p_display_name text)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_actor uuid := auth.uid();
  v_target public.meet_v2_participants%rowtype;
  v_room public.meet_v2_rooms%rowtype;
  v_actor_role text;
  v_name text := nullif(trim(coalesce(p_display_name,'')),'');
begin
  if v_actor is null then raise exception 'authentication_required'; end if;
  if v_name is null or char_length(v_name)>100 then raise exception 'invalid_display_name'; end if;
  select * into v_target from public.meet_v2_participants where id=p_participant_id for update;
  if not found then raise exception 'participant_not_found'; end if;
  select * into v_room from public.meet_v2_rooms where id=v_target.room_id;
  if coalesce(v_room.active_host_id,v_room.host_id)=v_actor then
    v_actor_role:='host';
  else
    select role into v_actor_role from public.meet_v2_participants
    where room_id=v_target.room_id and member_id=v_actor and state in ('admitted','joined')
    order by created_at desc limit 1;
  end if;
  if coalesce(v_actor_role,'') not in ('host','cohost') then raise exception 'host_authority_required'; end if;
  if v_target.role='host' and v_actor_role<>'host' then raise exception 'cohost_cannot_rename_host'; end if;
  update public.meet_v2_participants set display_name=v_name,updated_at=now() where id=p_participant_id;
  return jsonb_build_object('ok',true,'participantId',p_participant_id,'displayName',v_name);
end
$$;

create or replace function public.meet_v2_transfer_host_and_leave(p_target_participant_id uuid)
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

  select * into v_target from public.meet_v2_participants where id=p_target_participant_id for update;
  if not found then raise exception 'participant_not_found'; end if;

  select * into v_room from public.meet_v2_rooms where id=v_target.room_id for update;
  if not found then raise exception 'meeting_not_found'; end if;
  if coalesce(v_room.active_host_id,v_room.host_id)<>v_actor then raise exception 'host_authority_required'; end if;
  if v_target.state<>'joined' then raise exception 'participant_not_joined'; end if;
  if v_target.member_id is null then raise exception 'signed_in_participant_required_for_host'; end if;
  if v_target.member_id=v_actor then raise exception 'cannot_transfer_host_to_self'; end if;

  select * into v_old_host
  from public.meet_v2_participants
  where room_id=v_room.id and member_id=v_actor and role='host' and state='joined'
  order by created_at desc limit 1
  for update;
  if not found then raise exception 'active_host_participant_not_found'; end if;

  update public.meet_v2_participants
  set role='host',updated_at=now()
  where id=v_target.id;

  update public.meet_v2_participants
  set role='participant',state='left',left_at=now(),updated_at=now()
  where id=v_old_host.id;

  update public.meet_v2_rooms
  set active_host_id=v_target.member_id,updated_at=now()
  where id=v_room.id;

  return jsonb_build_object(
    'roomId',v_room.id,
    'previousHostParticipantId',v_old_host.id,
    'newHostParticipantId',v_target.id,
    'newHostMemberId',v_target.member_id,
    'newHostName',v_target.display_name,
    'state','left'
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
  if not exists(
    select 1 from public.meet_v2_rooms
    where id=p_room_id and coalesce(active_host_id,host_id)=v_user
  ) then raise exception 'host_authority_required'; end if;

  update public.meet_v2_rooms
  set status='ended',ended_at=now(),active_host_id=null,updated_at=now()
  where id=p_room_id;

  update public.meet_v2_participants
  set state=case when state in ('waiting','admitted','joined') then 'left' else state end,
      left_at=case when state in ('admitted','joined') then now() else left_at end,
      updated_at=now()
  where room_id=p_room_id;

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
grant execute on function public.meet_v2_touch_presence(uuid,uuid) to authenticated;
grant execute on function public.meet_v2_room_snapshot(uuid) to authenticated;
grant execute on function public.meet_v2_host_queue(uuid) to authenticated;
grant execute on function public.meet_v2_decide_participant(uuid,text) to authenticated;
grant execute on function public.meet_v2_set_cohost(uuid,boolean) to authenticated;
grant execute on function public.meet_v2_remove_participant(uuid) to authenticated;
grant execute on function public.meet_v2_rename_participant(uuid,text) to authenticated;
grant execute on function public.meet_v2_set_security(uuid,boolean,boolean) to authenticated;
grant execute on function public.meet_v2_set_chat_policy(uuid,text) to authenticated;
grant execute on function public.meet_v2_set_caption_state(uuid,text,uuid,boolean) to authenticated;
grant execute on function public.meet_v2_publish_caption(uuid,text,text) to authenticated;
grant execute on function public.meet_v2_get_transcript(uuid) to authenticated;
grant execute on function public.meet_v2_send_signal(uuid,uuid,text,jsonb) to authenticated;
grant execute on function public.meet_v2_transfer_host_and_leave(uuid) to authenticated;
grant execute on function public.meet_v2_end_room(uuid) to authenticated;
