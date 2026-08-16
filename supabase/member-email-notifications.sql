-- DominionStar member email notifications.
-- Additive migration: safe to run more than once.

alter table public.executive_events add column if not exists read_at timestamptz;
alter table public.executive_events add column if not exists priority text not null default 'normal';

create table if not exists public.notification_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email_enabled boolean not null default true,
  announcements_email_enabled boolean not null default true,
  messages_email_enabled boolean not null default true,
  community_email_enabled boolean not null default true,
  appointments_email_enabled boolean not null default true,
  meeting_room_email_enabled boolean not null default true,
  updated_at timestamptz not null default now()
);
alter table public.notification_preferences add column if not exists email_enabled boolean not null default true;
alter table public.notification_preferences add column if not exists announcements_email_enabled boolean not null default true;
alter table public.notification_preferences add column if not exists messages_email_enabled boolean not null default true;
alter table public.notification_preferences add column if not exists community_email_enabled boolean not null default true;
alter table public.notification_preferences add column if not exists appointments_email_enabled boolean not null default true;
alter table public.notification_preferences add column if not exists meeting_room_email_enabled boolean not null default true;
alter table public.notification_preferences add column if not exists updated_at timestamptz not null default now();
alter table public.notification_preferences enable row level security;
drop policy if exists "members read own notification preferences" on public.notification_preferences;
create policy "members read own notification preferences" on public.notification_preferences for select to authenticated using (user_id=auth.uid());
drop policy if exists "members create own notification preferences" on public.notification_preferences;
create policy "members create own notification preferences" on public.notification_preferences for insert to authenticated with check (user_id=auth.uid());
drop policy if exists "members update own notification preferences" on public.notification_preferences;
create policy "members update own notification preferences" on public.notification_preferences for update to authenticated using (user_id=auth.uid()) with check (user_id=auth.uid());

create table if not exists public.email_notification_outbox (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid references auth.users(id) on delete cascade,
  recipient_email text not null,
  event_type text not null,
  subject text not null,
  body text not null,
  action_url text,
  dedupe_key text,
  status text not null default 'pending' check(status in('pending','processing','sent','failed')),
  attempts integer not null default 0,
  next_attempt_at timestamptz not null default now(),
  provider_message_id text,
  last_error text,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.email_notification_outbox add column if not exists recipient_id uuid references auth.users(id) on delete cascade;
alter table public.email_notification_outbox add column if not exists action_url text;
alter table public.email_notification_outbox add column if not exists dedupe_key text;
create unique index if not exists email_notification_outbox_dedupe_idx on public.email_notification_outbox(dedupe_key) where dedupe_key is not null;
create index if not exists email_notification_outbox_pending_idx on public.email_notification_outbox(status,next_attempt_at,created_at);
alter table public.email_notification_outbox enable row level security;

create or replace function public.queue_member_event_email() returns trigger
language plpgsql security definer set search_path=public,auth as $$
declare
  destination text;
  allowed boolean := false;
  prefs public.notification_preferences%rowtype;
begin
  -- Only server-authored or self-authored events may produce email. This keeps
  -- the permissive legacy event insert policy from becoming an email spam path.
  if new.actor_id is not null and new.actor_id <> new.member_id then return new; end if;
  select * into prefs from public.notification_preferences where user_id=new.member_id;
  if found and not prefs.email_enabled then return new; end if;
  allowed := case
    when new.event_type like 'meeting.%' then coalesce(prefs.meeting_room_email_enabled,true)
    when new.event_type like 'message.%' or new.event_type='call.missed' then coalesce(prefs.messages_email_enabled,true)
    when new.event_type like 'appointment.%' then coalesce(prefs.appointments_email_enabled,true)
    when new.event_type like 'announcement.%' or new.event_type like 'founder.%' then coalesce(prefs.announcements_email_enabled,true)
    when new.event_type like 'community.%' then coalesce(prefs.community_email_enabled,true)
    else new.priority in ('high','critical')
  end;
  if not allowed then return new; end if;
  select email into destination from auth.users where id=new.member_id and email_confirmed_at is not null;
  if destination is null then return new; end if;
  insert into public.email_notification_outbox(recipient_id,recipient_email,event_type,subject,body,action_url,dedupe_key)
  values(new.member_id,destination,new.event_type,left(new.title,180),left(new.description,4000),new.payload->>'action_url','event:'||new.id::text)
  on conflict(dedupe_key) where dedupe_key is not null do nothing;
  return new;
end $$;
drop trigger if exists queue_member_event_email_trigger on public.executive_events;
create trigger queue_member_event_email_trigger after insert on public.executive_events for each row execute function public.queue_member_event_email();

create or replace function public.queue_meeting_host_absent_notification(
  target_room text,
  visitor_name text default 'A guest'
) returns jsonb language plpgsql security definer set search_path=public,auth as $$
declare
  normalized_room text := regexp_replace(lower(coalesce(target_room,'')),'[^a-z0-9]','','g');
  owner uuid;
  destination text;
  room_topic text;
  safe_visitor text := left(regexp_replace(coalesce(nullif(trim(visitor_name),''),'A guest'),'[\r\n]+',' ','g'),80);
  bucket text := to_char(date_trunc('minute',now()) - ((extract(minute from now())::int % 10)||' minutes')::interval,'YYYYMMDDHH24MI');
  inserted_count integer := 0;
begin
  if length(normalized_room)<6 then return jsonb_build_object('queued',false,'reason','invalid_room'); end if;
  select r.owner_id,'Personal Meeting Room' into owner,room_topic from public.meet_rooms r
    where regexp_replace(lower(r.room_id),'[^a-z0-9]','','g')=normalized_room and r.active=true limit 1;
  if owner is null then
    select s.user_id,coalesce(nullif(s.topic,''),'Scheduled Meeting') into owner,room_topic from public.meet_scheduled_meetings s
      where regexp_replace(lower(s.meeting_id),'[^a-z0-9]','','g')=normalized_room limit 1;
  end if;
  if owner is null then
    select p.user_id,'Personal Meeting Room' into owner,room_topic from public.meet_personal_rooms p
      where regexp_replace(lower(p.personal_room_id),'[^a-z0-9]','','g')=normalized_room limit 1;
  end if;
  if owner is null or owner=auth.uid() then return jsonb_build_object('queued',false,'reason','not_applicable'); end if;
  if exists(select 1 from public.notification_preferences n where n.user_id=owner and (not n.email_enabled or not n.meeting_room_email_enabled)) then
    return jsonb_build_object('queued',false,'reason','disabled');
  end if;
  select email into destination from auth.users where id=owner and email_confirmed_at is not null;
  if destination is null then return jsonb_build_object('queued',false,'reason','no_verified_email'); end if;
  insert into public.email_notification_outbox(recipient_id,recipient_email,event_type,subject,body,action_url,dedupe_key)
  values(owner,destination,'meeting.host_absent',safe_visitor||' is waiting in your DominionStar meeting',safe_visitor||' entered '||room_topic||' while you were not present. Open DominionStar Meet to join or manage the room.','/meet/?room='||normalized_room,'meeting-absent:'||owner::text||':'||normalized_room||':'||coalesce(auth.uid()::text,'guest')||':'||bucket)
  on conflict(dedupe_key) where dedupe_key is not null do nothing;
  get diagnostics inserted_count = row_count;
  return jsonb_build_object('queued',inserted_count=1);
end $$;
revoke all on function public.queue_meeting_host_absent_notification(text,text) from public;
grant execute on function public.queue_meeting_host_absent_notification(text,text) to anon,authenticated;

create or replace function public.claim_email_notification_batch(batch_size integer default 25)
returns setof public.email_notification_outbox language plpgsql security definer set search_path=public as $$
begin
  return query
  with claimable as (
    select id from public.email_notification_outbox
    where status='pending' and next_attempt_at<=now()
    order by created_at for update skip locked limit greatest(1,least(batch_size,100))
  )
  update public.email_notification_outbox o set status='processing',attempts=o.attempts+1,updated_at=now()
  from claimable c where o.id=c.id returning o.*;
end $$;
revoke all on function public.claim_email_notification_batch(integer) from public;
grant execute on function public.claim_email_notification_batch(integer) to service_role;
