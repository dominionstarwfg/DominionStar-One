-- DOMINIONSTAR TEAM GROUPS FILES: REVIEW ONLY. DO NOT RUN IN PRODUCTION.
-- Apply only after agent-team-groups.DO-NOT-RUN.review.sql on isolated staging.
-- Never enable teamGroupsMediaV1 until this exact schema, private bucket,
-- storage RLS, malware/content handling and multi-account tests are verified.
begin;

do $$
begin
  if to_regclass('public.agent_group_posts') is null
    or to_regclass('storage.objects') is null
    or to_regclass('storage.buckets') is null then
    raise exception 'Team Groups and Supabase Storage must exist before media rollout';
  end if;
  if exists(select 1 from storage.buckets where id='agent-group-media') then
    raise exception 'agent-group-media already exists; stop and inspect privacy settings';
  end if;
end
$$;

-- Uniform path <group UUID>/<uploader UUID>/<random UUID>.<extension>
-- makes group and author identity server-checkable without trusting browser
-- strings, post captions, user_metadata, or Storage bucket visibility.
create function agent_private.media_group_from_path(p_path text)
returns uuid language sql immutable set search_path=''
as $$
  select case when p_path ~
      '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(png|jpg|jpeg|webp|pdf)$'
  then split_part(p_path,'/',1)::uuid else null end;
$$;
create function agent_private.media_path_matches(
  p_group uuid,p_author uuid,p_path text)
returns boolean language sql immutable set search_path=''
as $$
  select coalesce(
    agent_private.media_group_from_path(p_path)=p_group
    and split_part(p_path,'/',2)=p_author::text,false);
$$;
create function agent_private.media_path_authorized(
  p_path text,p_uploader_only boolean default false)
returns boolean language sql stable set search_path=''
as $$
  select coalesce(
    (select auth.uid()) is not null
    and agent_private.is_group_member(agent_private.media_group_from_path(p_path),false)
    and (not p_uploader_only
      or split_part(p_path,'/',2)=(select auth.uid())::text),
    false);
$$;
revoke all on function agent_private.media_group_from_path(text) from public,anon;
revoke all on function agent_private.media_path_matches(uuid,uuid,text) from public,anon;
revoke all on function agent_private.media_path_authorized(text,boolean) from public,anon;
grant execute on function agent_private.media_group_from_path(text) to authenticated;
grant execute on function agent_private.media_path_matches(uuid,uuid,text) to authenticated;
grant execute on function agent_private.media_path_authorized(text,boolean) to authenticated;

-- File-only posts allowed; metadata is either fully specified or absent.
-- The DB never accepts a path belonging to another group or another author.
alter table public.agent_group_posts
  add column media_path text,
  add column media_name text,
  add column media_mime text,
  add column media_size_bytes integer;
alter table public.agent_group_posts
  drop constraint if exists agent_group_posts_body_check;
alter table public.agent_group_posts add constraint agent_group_posts_text_or_media_check
  check (length(body)<=3000 and
    (length(btrim(body))>0 or media_path is not null));
alter table public.agent_group_posts add constraint agent_group_posts_media_integrity_check
  check (
    (media_path is null and media_name is null and media_mime is null and media_size_bytes is null)
    or
    (media_path is not null and media_name is not null
      and media_mime is not null and media_size_bytes is not null
      and length(media_name) between 1 and 140
      and media_size_bytes between 1 and 15728640
      and media_mime in ('image/jpeg','image/png','image/webp','application/pdf')
      and agent_private.media_path_matches(group_id,author_id,media_path)
      and lower(substring(media_path from '\.([a-z]+)$')) =
          case media_mime when 'image/jpeg' then
             -- Only .jpeg in persisted paths; .jpg uploads normalize to .jpeg
             'jpeg'
          when 'image/png' then 'png'
          when 'image/webp' then 'webp'
          when 'application/pdf' then 'pdf' end)
  );
grant insert(media_path,media_name,media_mime,media_size_bytes)
  on public.agent_group_posts to authenticated;

-- Bucket intentionally private; bucket-level MIME and size ceilings reinforce
-- client-side checks. No public download URLs and no service role in browser.
insert into storage.buckets(
  id,name,public,file_size_limit,allowed_mime_types)
values(
  'agent-group-media','agent-group-media',false,15728640,
  array['image/jpeg','image/png','image/webp','application/pdf']::text[]);

-- Supabase manages storage.objects and its built-in RLS/grants.
-- GET must be authenticated. No public/object listing from the group bucket.
-- A user losing group approval/member status immediately loses read access on
-- subsequent authenticated downloads. Existing browser copies are not revoked.
create policy ds_agent_group_media_read_authenticated
  on storage.objects for select to authenticated
  using(
    bucket_id='agent-group-media'
    and storage.allow_any_operation(
      array['object.get_authenticated','object.delete'])
    and agent_private.media_path_authorized(name,false));
create policy ds_agent_group_media_upload_member
  on storage.objects for insert to authenticated
  with check(
    bucket_id='agent-group-media'
    and owner_id=(select auth.uid())::text
    and agent_private.media_path_authorized(name,true));
-- Upload rollback permitted only for the original approved uploader when no
-- published group post references the file. No UPDATE / upsert policy.
create policy ds_agent_group_media_rollback_unpublished
  on storage.objects for delete to authenticated
  using(
    bucket_id='agent-group-media'
    and owner_id=(select auth.uid())::text
    and agent_private.media_path_authorized(name,true)
    and not exists(select 1 from public.agent_group_posts post
      where post.media_path=name));

commit;
