-- Synthetic Storage API shape for disposable PostgreSQL only.
-- Never use this fixture against an actual Supabase project.
create schema storage;
grant usage on schema storage to authenticated,anon;
create table storage.buckets(
  id text primary key,
  name text not null unique,
  public boolean not null default false,
  file_size_limit bigint,
  allowed_mime_types text[]
);
create table storage.objects(
  id uuid primary key default gen_random_uuid(),
  bucket_id text not null references storage.buckets(id),
  name text not null,
  owner_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique(bucket_id,name)
);
alter table storage.objects enable row level security;
grant select,insert,delete on storage.objects to authenticated;
grant select on storage.buckets to authenticated;
create function storage.allow_any_operation(ops text[])
returns boolean language sql stable set search_path=''
as $$
  select coalesce(current_setting('request.storage.operation',true)=any(ops),false);
$$;
grant execute on function storage.allow_any_operation(text[]) to authenticated;
