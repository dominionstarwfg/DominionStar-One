-- DOMINIONSTAR GATE 0 — DM/CONNECTION AUTHORIZATION READ-ONLY INVENTORY
-- Safe metadata inspection. Returns no message body or member identity.
-- Run before and after an approved, synthetic staging migration.
BEGIN TRANSACTION READ ONLY;

SELECT table_name,column_name,data_type
FROM information_schema.columns
WHERE table_schema='public'
  AND table_name IN ('direct_messages','member_connections')
ORDER BY table_name,ordinal_position;

SELECT tablename,policyname,cmd,permissive,roles::text,qual,with_check
FROM pg_policies
WHERE schemaname='public'
  AND tablename IN ('direct_messages','member_connections')
ORDER BY tablename,cmd,policyname;

SELECT c.relname AS relation,
       c.relrowsecurity AS rls_enabled,
       c.relforcerowsecurity AS force_rls
FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
WHERE n.nspname='public' AND c.relname IN ('direct_messages','member_connections');

SELECT tbl.relname AS relation,tr.tgname AS trigger_name,
       pg_get_triggerdef(tr.oid) AS trigger_def
FROM pg_trigger tr JOIN pg_class tbl ON tbl.oid=tr.tgrelid
JOIN pg_namespace n ON n.oid=tbl.relnamespace
WHERE n.nspname='public'
  AND tbl.relname IN ('direct_messages','member_connections')
  AND NOT tr.tgisinternal
ORDER BY tbl.relname,tr.tgname;

SELECT table_name,grantee,privilege_type
FROM information_schema.role_table_grants
WHERE table_schema='public'
  AND table_name IN ('direct_messages','member_connections')
  AND grantee IN ('anon','authenticated','service_role')
ORDER BY table_name,grantee,privilege_type;

SELECT n.nspname AS schema,p.proname,
       pg_get_function_identity_arguments(p.oid) AS args,
       p.prosecdef AS elevated,
       has_function_privilege('anon',p.oid,'EXECUTE') AS anon_can_call,
       has_function_privilege('authenticated',p.oid,'EXECUTE') AS member_can_call
FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
WHERE n.nspname='public'
  AND p.proname IN (
  'dm_mark_read','dm_edit_own_message','dm_soft_delete_own_message',
  'respond_member_connection','is_dominionstar_founder')
ORDER BY p.proname;

COMMIT;

-- Required separate real synthetic account-level negative tests:
-- Direct REST UPDATE of direct_messages and member_connections must be
-- denied for all browser roles even when RLS SELECT exposes a row.
-- Approvals, past message history, block semantics, and Founder behavior
-- must be tested with different real authenticated JWTs.
-- Re-check dangerous TRUNCATE/REFERENCES/TRIGGER table-level grants:
-- RLS does not enforce TRUNCATE. Revoke unneeded grants in a *separate*
-- staged migration after dependency analysis; no privilege changes here.
