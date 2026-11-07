-- READ ONLY: DominionStar Agent OS privacy baseline (metadata only).
-- NEVER SELECT member records or personally identifiable information here.
-- This file intentionally contains no DDL, grants, mutation, or production deploy command.
-- Run only on a connection whose owner has authorized read-only catalog inspection.

-- 1. The current member_profiles table-level SELECT grant makes every column
-- addressable for rows allowed by RLS. RLS does not implement column masking.
select
  has_table_privilege('authenticated','public.member_profiles','SELECT') as member_profiles_authenticated_table_select,
  has_table_privilege('anon','public.member_profiles','SELECT') as member_profiles_anon_table_select,
  has_column_privilege('authenticated','public.member_profiles','account_notes','SELECT') as authenticated_notes_selectable,
  has_column_privilege('authenticated','public.member_profiles','address_line1','SELECT') as authenticated_address_selectable,
  has_column_privilege('authenticated','public.member_profiles','phone','SELECT') as authenticated_phone_selectable,
  has_column_privilege('authenticated','public.member_profiles','email','SELECT') as authenticated_email_selectable;

-- 2. Observe policies; this returns SQL metadata only, not user information.
select tablename,policyname,roles,cmd,qual,with_check
from pg_policies
where schemaname='public'
  and tablename in ('member_profiles','member_connections','direct_messages')
order by tablename,policyname;

-- 3. Check whether browser roles can mutate connection identities/status.
select
  has_table_privilege('authenticated','public.member_connections','INSERT') as connection_insert,
  has_table_privilege('authenticated','public.member_connections','UPDATE') as connection_update,
  has_table_privilege('authenticated','public.member_connections','DELETE') as connection_delete,
  has_column_privilege('authenticated','public.member_connections','requester_id','UPDATE') as requester_id_mutable,
  has_column_privilege('authenticated','public.member_connections','recipient_id','UPDATE') as recipient_id_mutable,
  has_column_privilege('authenticated','public.member_connections','status','UPDATE') as connection_status_mutable;

-- 4. Inventory privileged function exposure only; do not execute functions.
select p.proname,
       p.oid::regprocedure::text as signature,
       p.prosecdef as security_definer,
       has_function_privilege('anon',p.oid,'EXECUTE') as anon_execute,
       has_function_privilege('authenticated',p.oid,'EXECUTE') as authenticated_execute
from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where n.nspname='public'
  and p.proname in ('respond_my_member_connection','cancel_my_member_connection',
                   'assign_exclusive_founding_number','community_toggle_reaction')
order by p.proname;
