-- REVIEW ONLY / READ ONLY: email outbox RPC authorization preflight.
-- Run through the SQL editor before any approved production ACL change.
-- Never invoke claim_email_notification_batch itself during audit:
-- it changes queue status and returns sensitive recipient data.
SELECT
  p.oid::regprocedure::text AS function_signature,
  p.prosecdef AS security_definer,
  has_function_privilege('anon',p.oid,'EXECUTE') AS anon_can_execute,
  has_function_privilege('authenticated',p.oid,'EXECUTE') AS authenticated_can_execute,
  has_function_privilege('service_role',p.oid,'EXECUTE') AS service_role_can_execute,
  p.proacl::text AS explicit_acl
FROM pg_proc AS p
JOIN pg_namespace AS n ON n.oid=p.pronamespace
WHERE n.nspname='public'
  AND p.proname='claim_email_notification_batch'
  AND p.oid='public.claim_email_notification_batch(integer)'::regprocedure;

-- Read-only caller dependency check within stored Postgres function bodies.
-- Note: cannot discover external scripts, jobs in other systems, or all dynamic SQL.
SELECT p.oid::regprocedure::text AS referencing_routine
FROM pg_proc p
JOIN pg_namespace n ON n.oid=p.pronamespace
WHERE p.prokind='f'
  AND n.nspname NOT IN ('pg_catalog','information_schema')
  AND p.oid <> 'public.claim_email_notification_batch(integer)'::regprocedure
  AND pg_get_functiondef(p.oid) ILIKE '%claim_email_notification_batch%'
ORDER BY 1;
