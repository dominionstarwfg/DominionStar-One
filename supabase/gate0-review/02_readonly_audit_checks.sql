-- DOMINIONSTAR / GATE 0 / READ-ONLY AUDIT AND VERIFICATION QUERIES
-- Safe against a staging database; queries metadata only and never member rows.
-- Use before and after applying reviewed staging fixes.

BEGIN TRANSACTION READ ONLY;

-- 1. Notification worker function ACL: after Gate 0, anonymous and
-- authenticated should be false; service_role should remain true.
SELECT
  has_function_privilege('anon',
    'public.claim_email_notification_batch(integer)','EXECUTE') AS anon_can_claim_email,
  has_function_privilege('authenticated',
    'public.claim_email_notification_batch(integer)','EXECUTE') AS member_can_claim_email,
  has_function_privilege('service_role',
    'public.claim_email_notification_batch(integer)','EXECUTE') AS worker_can_claim_email;

-- 2. Row-level security enablement and force flags (not proof of safety).
SELECT n.nspname AS schema_name,c.relname AS relation,
       c.relrowsecurity AS rls_enabled,c.relforcerowsecurity AS force_rls
FROM pg_class c
JOIN pg_namespace n ON n.oid=c.relnamespace
WHERE n.nspname='public'
  AND c.relname IN ('member_profiles','direct_messages','community_messages',
                    'community_comments','community_presence','member_connections',
                    'member_notifications','meet_v2_rooms','meet_v2_participants')
  AND c.relkind IN ('r','p')
ORDER BY relation;

-- 3. Inspect live RLS policies; watch for permissive OR aggregation.
SELECT schemaname,tablename,policyname,cmd,qual,with_check
FROM pg_policies
WHERE (schemaname='public' AND tablename IN
 ('member_profiles','direct_messages','community_messages','community_comments',
  'community_presence','member_connections','member_notifications'))
 OR (schemaname='storage' AND tablename='objects')
ORDER BY schemaname,tablename,policyname;

-- 4. Exposure inventory: all callable SECURITY DEFINER functions require
-- their own review; do not mass-revoke and break production clients.
SELECT p.proname,pg_get_function_identity_arguments(p.oid) AS args,
       has_function_privilege('anon',p.oid,'EXECUTE') AS anon,
       has_function_privilege('authenticated',p.oid,'EXECUTE') AS authenticated
FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
WHERE n.nspname='public' AND p.prosecdef
ORDER BY p.proname,args;

-- 5. Storage buckets and permitted file types, not file contents.
SELECT id,public,file_size_limit,allowed_mime_types
FROM storage.buckets ORDER BY id;

COMMIT;

-- Interactive negative tests must additionally use real JWTs for:
-- anonymous, pending, approved A, approved B, suspended, founder.
-- A SQL metadata inspection alone cannot verify actual access decisions.
