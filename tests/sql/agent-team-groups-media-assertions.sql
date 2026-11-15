-- Disposable Postgres only. No actual file bytes or user data.
\set ON_ERROR_STOP on
select id as group_id from public.agent_groups where owner_id=
  '11111111-1111-4111-8111-111111111111' limit 1 \gset
select :'group_id'||
  '/11111111-1111-4111-8111-111111111111/99999999-9999-4999-8999-999999999999.png'
  as media_path \gset
select set_config('test.group_id',:'group_id',false);
select set_config('test.media_path',:'media_path',false);

set role authenticated;
select set_config('request.jwt.claim.sub',
  '11111111-1111-4111-8111-111111111111',false);
select set_config('request.storage.operation','object.get_authenticated',false);

-- Legitimate owner can upload an owned object into their joined group.
insert into storage.objects(bucket_id,name,owner_id,metadata)
  values('agent-group-media',:'media_path',
    '11111111-1111-4111-8111-111111111111','{"mimetype":"image/png"}');
insert into public.agent_group_posts(
  group_id,author_id,kind,body,media_path,media_name,media_mime,media_size_bytes)
values(
  :'group_id','11111111-1111-4111-8111-111111111111','announcement','',
  :'media_path','Training flyer.png','image/png',1024);
do $$
begin
  if (select count(*) from public.agent_group_posts
      where media_path=current_setting('test.media_path'))<>1 then
    raise exception 'An authorized member could not create a file-only post';
  end if;
  if (select count(*) from storage.objects where bucket_id='agent-group-media')<>1 then
    raise exception 'Owner cannot download their own private group file';
  end if;
  if not public.synthetic_assert_denied(
    format($q$insert into public.agent_group_posts(
      group_id,author_id,kind,body,media_path,media_name,media_mime,media_size_bytes)
      values(%L,'11111111-1111-4111-8111-111111111111','update','',
        %L,'Wrong MIME','application/pdf',1024)$q$,
      current_setting('test.group_id'),current_setting('test.media_path'))
  ) then raise exception 'File extension and MIME mismatch was accepted';end if;
  if not public.synthetic_assert_denied(
    format($q$insert into public.agent_group_posts(
      group_id,author_id,kind,body,media_path,media_name,media_mime,media_size_bytes)
      values(%L,'11111111-1111-4111-8111-111111111111','update','',
        %L,'Oversized file','image/png',15728641)$q$,
      current_setting('test.group_id'),current_setting('test.media_path'))
  ) then raise exception 'Oversized file metadata was accepted';end if;
  if not public.synthetic_assert_denied(
    format($q$insert into public.agent_group_posts(
      group_id,author_id,kind,body,media_path,media_name,media_mime,media_size_bytes)
      values(%L,'11111111-1111-4111-8111-111111111111','update','',
        %L,'Wrong path','image/png',256)$q$,
      current_setting('test.group_id'),
      '33333333-3333-4333-8333-333333333333/11111111-1111-4111-8111-111111111111/99999999-9999-4999-8999-999999999999.png')
  ) then raise exception 'Cross-group post media path was accepted';end if;
end
$$;

-- Authenticated object-info reads are also scoped; LIST is denied.
select set_config('request.storage.operation','object.get_authenticated_info',false);
do $
begin
  if (select count(*) from storage.objects where bucket_id='agent-group-media')<>1
  then raise exception 'Authorized group member could not get private attachment metadata';end if;
end
$;
-- No listing of filenames, even for group members. Read operation is scoped.
select set_config('request.storage.operation','object.list',false);
do $$
begin
  if (select count(*) from storage.objects where bucket_id='agent-group-media')<>0
  then raise exception 'Group files were enumerable via Storage list';end if;
end
$$;
select set_config('request.storage.operation','object.get_authenticated',false);

-- Another APPROVED, joined member may access the post and download its file.
select set_config('request.jwt.claim.sub',
  '66666666-6666-4666-8666-666666666666',false);
do $$
begin
  if (select count(*) from storage.objects where bucket_id='agent-group-media')<>1
    then raise exception 'Joined admin cannot read authorized group file';end if;
  if (select count(*) from public.agent_group_posts where media_path is not null)<>1
    then raise exception 'Joined admin cannot read file-post metadata';end if;
end
$$;
-- Joined admin cannot upload under the owner's prefix.
do $$
begin
  if not public.synthetic_assert_denied(
    format($q$insert into storage.objects(bucket_id,name,owner_id)
      values('agent-group-media',%L,'66666666-6666-4666-8666-666666666666')$q$,
      current_setting('test.group_id')||
        '/11111111-1111-4111-8111-111111111111/55555555-5555-4555-8555-555555555555.png')
  ) then raise exception 'Joined admin spoofed the group owner upload prefix';end if;
end
$$;

-- Invited/revoked/outsider may not see file objects or metadata.
select set_config('request.jwt.claim.sub',
  '33333333-3333-4333-8333-333333333333',false);
do $$
begin
  if (select count(*) from storage.objects)<>0
    then raise exception 'Uninvited member accessed a private group file';end if;
  if (select count(*) from public.agent_group_posts where media_path is not null)<>0
    then raise exception 'Uninvited member accessed private flyer metadata';end if;
  if not public.synthetic_assert_denied(
    format($q$insert into storage.objects(bucket_id,name,owner_id)
      values('agent-group-media',%L,'33333333-3333-4333-8333-333333333333')$q$,
      current_setting('test.group_id')||
        '/33333333-3333-4333-8333-333333333333/55555555-5555-4555-8555-555555555555.png')
  ) then raise exception 'Uninvited member uploaded a group flyer';end if;
end
$$;
select set_config('request.jwt.claim.sub',
  '22222222-2222-4222-8222-222222222222',false);
do $$
begin
  if (select count(*) from storage.objects)<>0
    then raise exception 'Revoked agent downloaded a private group file';end if;
end
$$;
select set_config('request.jwt.claim.sub',
  '44444444-4444-4444-8444-444444444444',false);
do $$
begin
  if (select count(*) from storage.objects)<>0
    then raise exception 'Unapproved agent downloaded a private group file';end if;
end
$$;

-- Uploaded-but-unpublished objects can be rolled back by their owner only.
select set_config('request.jwt.claim.sub',
  '11111111-1111-4111-8111-111111111111',false);
select set_config('request.storage.operation','object.get_authenticated',false);
insert into storage.objects(bucket_id,name,owner_id)
values('agent-group-media',
  :'group_id'||'/11111111-1111-4111-8111-111111111111/88888888-8888-4888-8888-888888888888.jpeg',
  '11111111-1111-4111-8111-111111111111');
select set_config('request.storage.operation','object.delete',false);
delete from storage.objects
 where name=:'group_id'||'/11111111-1111-4111-8111-111111111111/88888888-8888-4888-8888-888888888888.jpeg';
do $$
begin
  if exists(select 1 from storage.objects where name=
      current_setting('test.group_id')||
        '/11111111-1111-4111-8111-111111111111/88888888-8888-4888-8888-888888888888.jpeg') then
    raise exception 'Uploader could not roll back unpublished attachment';end if;
  -- A published flyer cannot be deleted by its uploader: avoid broken posts.
  delete from storage.objects where name=current_setting('test.media_path');
  if not exists(select 1 from storage.objects
      where name=current_setting('test.media_path')) then
    raise exception 'Published group media was deleted by user';end if;
end
$$;

-- Anonymous user lacks access even with a guessed exact object path.
reset role;
set role anon;
do $$
begin
  if not public.synthetic_assert_denied(
    $q$select * from storage.objects$q$
  ) then raise exception 'Anonymous group file data was public';end if;
end
$$;
reset role;
select 'ISOLATED_TEAM_GROUP_MEDIA_RLS_PASS' as result;
