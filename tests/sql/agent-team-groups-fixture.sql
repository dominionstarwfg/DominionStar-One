-- Disposable CI only: synthetic Auth and approved-directory fixtures.
create role anon nologin;
create role authenticated nologin;
grant usage on schema public to anon,authenticated;
create schema auth;
create table auth.users(id uuid primary key);
create function auth.uid() returns uuid language sql stable
as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
grant usage on schema auth to authenticated,anon;
grant execute on function auth.uid() to authenticated,anon;

create table public.member_profiles(id uuid primary key references auth.users(id),verification_status text not null);
create table public.member_public_profiles(id uuid primary key,full_name text,rank text,verification_status text not null);
grant select on public.member_public_profiles to authenticated;

insert into auth.users(id) values
 ('11111111-1111-4111-8111-111111111111'),
 ('22222222-2222-4222-8222-222222222222'),
 ('33333333-3333-4333-8333-333333333333'),
 ('44444444-4444-4444-8444-444444444444'),
 ('55555555-5555-4555-8555-555555555555');
insert into public.member_profiles(id,verification_status) values
 ('11111111-1111-4111-8111-111111111111','approved'),
 ('22222222-2222-4222-8222-222222222222','approved'),
 ('33333333-3333-4333-8333-333333333333','approved'),
 ('44444444-4444-4444-8444-444444444444','pending'),
 ('55555555-5555-4555-8555-555555555555','approved');
insert into public.member_public_profiles(id,full_name,rank,verification_status) values
 ('11111111-1111-4111-8111-111111111111','Group Owner','SMD','approved'),
 ('22222222-2222-4222-8222-222222222222','Approved Invitee','MD','approved'),
 ('33333333-3333-4333-8333-333333333333','Uninvited Member','SA','approved');
-- Opted-out approved member #5 is intentionally absent from safe projection.
create function public.synthetic_assert_denied(statement text)
returns boolean language plpgsql security invoker
as $$
begin
  begin
    execute statement;
  exception when others then
    return true;
  end;
  return false;
end;
$$;
grant execute on function public.synthetic_assert_denied(text) to authenticated,anon;
