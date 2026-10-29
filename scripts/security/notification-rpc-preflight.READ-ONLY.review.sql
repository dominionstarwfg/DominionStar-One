-- READ-ONLY. Checks three queue-related SECURITY DEFINER RPCs.
-- This does not invoke any queue function or inspect private email content.
SELECT
 p.oid::regprocedure::text AS routine,
 p.prosecdef AS security_definer,
 has_function_privilege('anon',p.oid,'EXECUTE') AS anonymous_execute,
 has_function_privilege('authenticated',p.oid,'EXECUTE') AS member_execute,
 has_function_privilege('service_role',p.oid,'EXECUTE') AS service_execute,
 p.proacl::text AS acl
FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
WHERE n.nspname='public'
  AND p.proname IN
  ('claim_email_notification_batch','queue_email_notification',
   'queue_community_email_notifications')
ORDER BY p.proname;

-- Read-only search for stored database functions that call these RPCs.
-- Does not capture callers outside Postgres or references in dynamic SQL.
WITH targets AS (
  SELECT unnest(ARRAY[
    'claim_email_notification_batch',
    'queue_email_notification',
    'queue_community_email_notifications'
  ]) AS routine_name
)
SELECT t.routine_name, p.oid::regprocedure::text AS referencing_routine
FROM targets t
JOIN pg_proc p ON p.prokind='f' AND p.proname<>t.routine_name
JOIN pg_namespace n ON n.oid=p.pronamespace
WHERE n.nspname NOT IN ('pg_catalog','information_schema')
  AND pg_get_functiondef(p.oid) ILIKE '%'||t.routine_name||'%'
ORDER BY t.routine_name,referencing_routine;
