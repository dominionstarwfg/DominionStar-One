-- DOMINIONSTAR / GATE 0 / FOUNDER AUTHORITY READ-ONLY AUDIT
-- No member identifiers, emails, tokens or messages are returned.
-- Requires appropriately authorized database connection.
BEGIN TRANSACTION READ ONLY;

SELECT
  count(*) AS profile_total,
  count(*) FILTER (WHERE is_founder=true AND role='founder') AS marked_founders,
  count(*) FILTER (WHERE is_founder=true AND role='founder'
                    AND verification_status='approved') AS approved_founders
FROM public.member_profiles;

SELECT p.proname,
       pg_get_function_identity_arguments(p.oid) AS args,
       p.prosecdef AS security_definer,
       (
         lower(pg_get_functiondef(p.oid)) LIKE '%dominionstarld@gmail.com%'
         OR lower(pg_get_functiondef(p.oid)) LIKE '%dominionstarwfg@gmail.com%'
       ) AS contains_legacy_founder_email
FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
WHERE n.nspname='public'
  AND (
    lower(pg_get_functiondef(p.oid)) LIKE '%dominionstarld@gmail.com%'
    OR lower(pg_get_functiondef(p.oid)) LIKE '%dominionstarwfg@gmail.com%'
    OR p.proname IN ('is_dominionstar_founder','is_dominionstar_founder_v2')
  )
ORDER BY p.proname;

SELECT
  count(*) AS affected_rls_policies,
  count(DISTINCT tablename) AS affected_public_tables
FROM pg_policies
WHERE schemaname='public' AND (
  coalesce(qual,'') LIKE '%is_dominionstar_founder()%'
  OR coalesce(with_check,'') LIKE '%is_dominionstar_founder()%'
);

SELECT
  table_name,grantee,privilege_type
FROM information_schema.role_table_grants
WHERE table_schema='public'
  AND table_name IN ('member_profiles','audit_log')
  AND grantee IN ('anon','authenticated')
ORDER BY table_name,grantee,privilege_type;

-- Separate user-specific ID verification uses a private trusted channel;
-- never commit results containing actual Founder UIDs, emails or secrets.
COMMIT;
