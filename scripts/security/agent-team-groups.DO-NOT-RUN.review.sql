-- DOMINIONSTAR TEAM GROUPS — REVIEW ONLY. DO NOT RUN IN PRODUCTION.
-- Requires approved member_public_profiles projection and founder-approved agents.
-- Deploy only to isolated staging after security review, then enable
-- DOMINIONSTAR_AGENT_DATA_FEATURES.teamGroupsV1 and publicMemberProfilesV2.
-- No public group discovery, anonymous reads, unauthenticated invites, or SMS joins.
begin;

do $$ begin
  if to_regclass('public.agent_groups') is not null
     or to_regclass('public.agent_group_members') is not null
     or to_regclass('public.agent_group_messages') is not null then
    raise exception 'Team groups schema already exists; review collisions before rerun';
  end if;
  if to_regclass('public.member_profiles') is null
     or to_regclass('public.member_public_profiles') is null then
    raise exception 'Approved profiles and reviewed privacy projection must exist first';
  end if;
end $$;

create schema if not exists agent_private;
revoke all on schema agent_private from public, anon;
grant usage on schema agent_private to authenticated;

create table public.agent_groups(
  id uuid primary key default gen_random_uuid(),
  name text not null check(length(btrim(name)) between 3 and 70),
  topic text not null default '' check(length(topic)<=200),
  owner_id uuid not null references auth.users(id),
  created_at timestamptz not null default now()
);
create table public.agent_group_members(
  group_id uuid not null references public.agent_groups(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member' check(role in ('owner','admin','member')),
  status text not null default 'invited' check(status in ('invited','active')),
  invited_by uuid references auth.users(id),
  muted boolean not null default false,
  created_at timestamptz not null default now(),
  primary key(group_id,user_id),
  constraint group_owner_active_check check(role <> 'owner' or status='active')
);
create table public.agent_group_messages(
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.agent_groups(id) on delete cascade,
  author_id uuid not null references auth.users(id),
  body text not null check(length(btrim(body)) between 1 and 2000),
  created_at timestamptz not null default now()
);
create index agent_groups_owner_idx on public.agent_groups(owner_id);
create index agent_group_members_user_idx on public.agent_group_members(user_id,status);
create index agent_group_messages_timeline_idx on public.agent_group_messages(group_id,created_at,id);

alter table public.agent_groups enable row level security;
alter table public.agent_group_members enable row level security;
alter table public.agent_group_messages enable row level security;

-- SECURITY DEFINER used only for membership authorization lookups that would
-- otherwise recurse through RLS on agent_group_members. Private schema is
-- not a PostgREST-exposed API and functions pin empty search_path.
create function agent_private.is_group_member(p_group uuid,p_allow_invite boolean default false)
returns boolean language sql stable security definer set search_path=''
as $$
  select (select auth.uid()) is not null
    and exists (select 1 from public.member_profiles me
      where me.id=(select auth.uid()) and me.verification_status='approved')
    and exists (select 1 from public.agent_group_members m
      where m.group_id=p_group and m.user_id=(select auth.uid())
        and (m.status='active' or (p_allow_invite and m.status='invited')));
$$;
create function agent_private.is_group_admin(p_group uuid)
returns boolean language sql stable security definer set search_path=''
as $$
  select (select auth.uid()) is not null
    and exists(select 1 from public.member_profiles me
      where me.id=(select auth.uid()) and me.verification_status='approved')
    and exists(select 1 from public.agent_group_members m
      where m.group_id=p_group and m.user_id=(select auth.uid())
        and m.status='active' and m.role in ('owner','admin'));
$$;

revoke all on function agent_private.is_group_member(uuid,boolean) from public, anon;
revoke all on function agent_private.is_group_admin(uuid) from public, anon;
grant execute on function agent_private.is_group_member(uuid,boolean) to authenticated;
grant execute on function agent_private.is_group_admin(uuid) to authenticated;

create policy agent_groups_read_invited_or_active on public.agent_groups
  for select to authenticated
  using (agent_private.is_group_member(id,true));
-- Owners may update names/topics, never owner_id. Updating owner_id not granted.
create policy agent_groups_update_owner on public.agent_groups
  for update to authenticated
  using (owner_id=(select auth.uid()) and agent_private.is_group_admin(id))
  with check(owner_id=(select auth.uid()) and agent_private.is_group_admin(id));

create policy agent_members_read_active_or_self on public.agent_group_members
  for select to authenticated
  using (user_id=(select auth.uid()) or agent_private.is_group_member(group_id,false));

-- Admins invite approved, opted-in public-directory members by user ID.
-- Do not accept raw email, phone, Agent Code or user-metadata as identity.
create policy agent_members_invite_admin_only on public.agent_group_members
  for insert to authenticated
  with check(
    agent_private.is_group_admin(group_id)
    and role='member' and status='invited'
    and invited_by=(select auth.uid())
    and user_id<>(select auth.uid())
    and exists(select 1 from public.member_public_profiles visible
      where visible.id=user_id and visible.verification_status='approved')
  );

-- Only the invitee may accept, or an active member may change their mute
-- preference. Trigger below forbids altering role, identity or member status
-- outside the invited -> active transition.
create policy agent_members_self_update on public.agent_group_members
  for update to authenticated
  using(user_id=(select auth.uid()) and status in ('active','invited'))
  with check(user_id=(select auth.uid()) and status='active');
create policy agent_members_leave_or_admin_remove on public.agent_group_members
  for delete to authenticated
  using(role<>'owner' and
    (user_id=(select auth.uid()) or
      (agent_private.is_group_admin(group_id) and user_id<>(select auth.uid()))));

create function agent_private.guard_group_member_update()
returns trigger language plpgsql security invoker set search_path=''
as $$
begin
  if (old.group_id,old.user_id,old.role,old.invited_by,old.created_at)
     is distinct from
     (new.group_id,new.user_id,new.role,new.invited_by,new.created_at) then
    raise exception 'Membership identity and roles are immutable';
  end if;
  if old.status='invited' then
    if new.status<>'active' or new.muted is distinct from old.muted then
      raise exception 'Only invitation acceptance is allowed';
    end if;
  elsif old.status='active' then
    if new.status<>'active' then
      raise exception 'Active membership cannot be reassigned';
    end if;
  else
    raise exception 'Unknown membership state';
  end if;
  return new;
end;
$$;
revoke all on function agent_private.guard_group_member_update() from public, anon, authenticated;
create trigger guard_agent_group_member_update before update
  on public.agent_group_members for each row
  execute function agent_private.guard_group_member_update();

-- Only joined members may read/write group messages.
create policy agent_messages_read_members_only on public.agent_group_messages
  for select to authenticated
  using(agent_private.is_group_member(group_id,false));
create policy agent_messages_send_members_only on public.agent_group_messages
  for insert to authenticated
  with check(author_id=(select auth.uid())
    and agent_private.is_group_member(group_id,false));

-- One atomic, authenticated operation to create group + owner membership.
-- The public function is an intentional RPC with a narrow EXECUTE grant.
create function public.create_agent_group(p_name text,p_topic text default '')
returns uuid language plpgsql security definer set search_path=''
as $$
declare v_user uuid;v_group uuid;
begin
  v_user:=(select auth.uid());
  if v_user is null or not exists(
     select 1 from public.member_profiles
     where id=v_user and verification_status='approved'
  ) then raise exception 'Founder approval required'; end if;
  if p_name is null or length(btrim(p_name)) not between 3 and 70
      or coalesce(length(p_topic),0)>200 then
    raise exception 'Invalid group name or topic';
  end if;
  if (select count(*) from public.agent_groups where owner_id=v_user)>=50 then
    raise exception 'Maximum group count reached';
  end if;
  insert into public.agent_groups(name,topic,owner_id)
    values(btrim(p_name),coalesce(btrim(p_topic),''),v_user)
    returning id into v_group;
  insert into public.agent_group_members(group_id,user_id,role,status)
    values(v_group,v_user,'owner','active');
  return v_group;
end;
$$;
revoke all on function public.create_agent_group(text,text) from public, anon;
grant execute on function public.create_agent_group(text,text) to authenticated;

revoke all on public.agent_groups,public.agent_group_members,public.agent_group_messages from public, anon;
grant select on public.agent_groups to authenticated;
grant update(name,topic) on public.agent_groups to authenticated;
grant select,insert,update(muted,status),delete on public.agent_group_members to authenticated;
grant select,insert(group_id,author_id,body) on public.agent_group_messages to authenticated;
-- New group messages are not yet added to realtime publication or notifications.
-- Any future Realtime broadcast must preserve per-group RLS and membership gates.
commit;
