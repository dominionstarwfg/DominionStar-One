-- All assertions execute against the disposable fixture, NEVER production.
\set ON_ERROR_STOP on
set role authenticated;
select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',false);
select public.create_agent_group('Leadership Team','Weekly goals and training') as group_id \gset
do $$ begin
  if (select count(*) from public.agent_groups where name='Leadership Team') <> 1 then
    raise exception 'Owner cannot read newly created group';
  end if;
  if (select count(*) from public.agent_group_members where role='owner' and status='active') <> 1 then
    raise exception 'Creator must become active group owner atomically';
  end if;
end $$;

insert into public.agent_group_messages(group_id,author_id,body)
values(:'group_id','11111111-1111-4111-8111-111111111111','Private meeting: https://zoom.us/j/7443001370');
insert into public.agent_group_members(group_id,user_id,role,status,invited_by)
values(:'group_id','22222222-2222-4222-8222-222222222222','member','invited','11111111-1111-4111-8111-111111111111');

-- Seed synthetic pre-existing group administrators and an ordinary member.
-- Administrative membership promotion is NOT a public browser operation.
reset role;
insert into public.agent_group_members(group_id,user_id,role,status) values
 (:'group_id','66666666-6666-4666-8666-666666666666','admin','active'),
 (:'group_id','77777777-7777-4777-8777-777777777777','admin','active'),
 (:'group_id','88888888-8888-4888-8888-888888888888','member','active');
set role authenticated;
select set_config('request.jwt.claim.sub','66666666-6666-4666-8666-666666666666',false);
do $ begin
  -- Admin cannot kick another administrator (RLS affects zero rows).
  delete from public.agent_group_members where user_id='77777777-7777-4777-8777-777777777777';
  if not exists(select 1 from public.agent_group_members
    where user_id='77777777-7777-4777-8777-777777777777') then
    raise exception 'Admin could remove another admin';
  end if;
  delete from public.agent_group_members where user_id='88888888-8888-4888-8888-888888888888';
  if exists(select 1 from public.agent_group_members
    where user_id='88888888-8888-4888-8888-888888888888') then
    raise exception 'Admin could not remove ordinary member';
  end if;
  update public.agent_groups set name='Unauthorized Rename';
  if exists(select 1 from public.agent_groups where name='Unauthorized Rename') then
    raise exception 'Non-owner admin renamed the group';
  end if;
end $;
select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',false);
do $ begin
  update public.agent_groups set name='Leadership & Learning Team',
    topic='Updated owner-controlled topic';
  if not exists(select 1 from public.agent_groups
      where name='Leadership & Learning Team' and topic='Updated owner-controlled topic')
  then raise exception 'Group owner could not edit group details';end if;
  delete from public.agent_group_members
    where user_id='77777777-7777-4777-8777-777777777777';
  if exists(select 1 from public.agent_group_members
    where user_id='77777777-7777-4777-8777-777777777777') then
    raise exception 'Owner could not remove another admin';
  end if;
end $;

do $ begin
  if not public.synthetic_assert_denied(
    $q$insert into public.agent_group_members(group_id,user_id,role,status,invited_by)
       select id,'44444444-4444-4444-8444-444444444444','member','invited',owner_id
       from public.agent_groups limit 1$q$
  ) then raise exception 'Pending agent was invited';end if;
  if not public.synthetic_assert_denied(
    $q$insert into public.agent_group_members(group_id,user_id,role,status,invited_by)
       select id,'55555555-5555-4555-8555-555555555555','member','invited',owner_id
       from public.agent_groups limit 1$q$
  ) then raise exception 'Non-directory member was invited';end if;
  if not public.synthetic_assert_denied(
    $q$insert into public.agent_group_members(group_id,user_id,role,status,invited_by)
       select id,'33333333-3333-4333-8333-333333333333','admin','active',owner_id
       from public.agent_groups limit 1$q$
  ) then raise exception 'Owner bypassed invite-only membership restrictions';end if;
  if not public.synthetic_assert_denied(
    $q$update public.agent_group_members set role='admin'
       where user_id='22222222-2222-4222-8222-222222222222'$q$
  ) then raise exception 'Role elevation was possible';end if;
  -- RLS DELETE can safely affect zero rows without raising an error.
  -- Assert that owner membership survives an attempted self-removal.
  delete from public.agent_group_members
    where user_id='11111111-1111-4111-8111-111111111111';
  if not exists(select 1 from public.agent_group_members
      where user_id='11111111-1111-4111-8111-111111111111' and role='owner')
  then raise exception 'Owner could leave without transferring ownership';end if;
end $$;

-- Invited agent sees ONLY the group invitation and their membership row.
select set_config('request.jwt.claim.sub','22222222-2222-4222-8222-222222222222',false);
do $$ begin
  if (select count(*) from public.agent_groups)<>1 then
    raise exception 'Invited approved member cannot see group name';
  end if;
  if (select count(*) from public.agent_group_messages)<>0 then
    raise exception 'Invited, not joined agent read private messages';
  end if;
  if not public.synthetic_assert_denied(
    $q$insert into public.agent_group_messages(group_id,author_id,body)
       select id,'22222222-2222-4222-8222-222222222222','Not yet joined'
       from public.agent_groups limit 1$q$
  ) then raise exception 'Pending invitee could send before acceptance';end if;
end $$;
update public.agent_group_members set status='active'
 where user_id='22222222-2222-4222-8222-222222222222' and status='invited';
do $$ begin
  if (select count(*) from public.agent_group_messages)<>1 then
    raise exception 'Joined member could not read historical group message';
  end if;
  if not public.synthetic_assert_denied(
    $q$update public.agent_group_members set role='owner'
       where user_id='22222222-2222-4222-8222-222222222222'$q$
  ) then raise exception 'Joined member escalated role';end if;
  if not public.synthetic_assert_denied(
    $q$insert into public.agent_group_members(group_id,user_id,role,status,invited_by)
       select group_id,'33333333-3333-4333-8333-333333333333','member','invited',
         '22222222-2222-4222-8222-222222222222'
       from public.agent_group_members limit 1$q$
  ) then raise exception 'Ordinary member could invite';end if;
  if not public.synthetic_assert_denied(
    $q$insert into public.agent_group_messages(group_id,author_id,body)
       select group_id,'11111111-1111-4111-8111-111111111111','Spoofed message'
       from public.agent_group_members limit 1$q$
  ) then raise exception 'Ordinary member could spoof author';end if;
end $$;
update public.agent_group_members set muted=true
 where user_id='22222222-2222-4222-8222-222222222222';
insert into public.agent_group_messages(group_id,author_id,body)
values(:'group_id','22222222-2222-4222-8222-222222222222','Message after invitation acceptance');
do $$ begin
  if (select count(*) from public.agent_group_messages)<>2 then
    raise exception 'Joined member cannot send messages';
  end if;
end $$;

-- Approved but uninvited agent sees NOTHING.
select set_config('request.jwt.claim.sub','33333333-3333-4333-8333-333333333333',false);
do $$ begin
  if (select count(*) from public.agent_groups)<>0 then raise exception 'Uninvited agent sees group';end if;
  if (select count(*) from public.agent_group_members)<>0 then raise exception 'Uninvited agent sees membership';end if;
  if (select count(*) from public.agent_group_messages)<>0 then raise exception 'Uninvited agent sees chat';end if;
  if not public.synthetic_assert_denied(
    $q$select public.create_agent_group('', 'bad')$q$
  ) then raise exception 'Blank group name accepted';end if;
  if not public.synthetic_assert_denied(
    $q$insert into public.agent_group_messages(group_id,author_id,body)
       values('11111111-1111-4111-8111-111111111111',
       '33333333-3333-4333-8333-333333333333','Illegal')$q$
  ) then raise exception 'Uninvited sender not blocked';end if;
end $$;

-- Founder-approval loss must immediately revoke group access.
reset role;
update public.member_profiles set verification_status='revoked'
 where id='22222222-2222-4222-8222-222222222222';
set role authenticated;
select set_config('request.jwt.claim.sub','22222222-2222-4222-8222-222222222222',false);
do $$ begin
  if (select count(*) from public.agent_groups)<>0 then raise exception 'Revoked member sees group';end if;
  if (select count(*) from public.agent_group_messages)<>0 then raise exception 'Revoked member sees messages';end if;
end $$;

select set_config('request.jwt.claim.sub','44444444-4444-4444-8444-444444444444',false);
do $$ begin
  if not public.synthetic_assert_denied(
    $q$select public.create_agent_group('Unauthorized Team','')$q$
  ) then raise exception 'Pending member could create private group';end if;
end $$;

-- Anon has no table or creation access.
reset role;
set role anon;
do $$ begin
  if not public.synthetic_assert_denied($q$select * from public.agent_group_messages$q$)
    then raise exception 'Anonymous member read group messages';end if;
  if not public.synthetic_assert_denied($q$select public.create_agent_group('Anon Group','')$q$)
    then raise exception 'Anonymous member could create group';end if;
end $$;
reset role;
select 'ISOLATED_TEAM_GROUP_RLS_PASS' as result;
