-- DominionStar Gate 0 staging ONLY: automated fail-closed checks.
-- Do NOT run before applying reviewed staging remediations.
-- This script reads only security metadata and raises an exception if a risk
-- persists; it does not create accounts, change permissions, or touch rows.

BEGIN TRANSACTION READ ONLY;

DO $checks$
BEGIN
 IF to_regprocedure('public.claim_email_notification_batch(integer)') IS NULL THEN
   RAISE EXCEPTION 'G0-01: notification processor function absent; check staging migration baseline';
 END IF;
 IF has_function_privilege('anon',
    'public.claim_email_notification_batch(integer)','EXECUTE') THEN
   RAISE EXCEPTION 'G0-01 FAIL: anonymous users can call notification processor';
 END IF;
 IF has_function_privilege('authenticated',
    'public.claim_email_notification_batch(integer)','EXECUTE') THEN
   RAISE EXCEPTION 'G0-01 FAIL: agent users can call notification processor';
 END IF;
 IF NOT has_function_privilege('service_role',
    'public.claim_email_notification_batch(integer)','EXECUTE') THEN
   RAISE EXCEPTION 'G0-01 FAIL: trusted worker cannot call processor';
 END IF;
 RAISE NOTICE 'G0-01 PASS: notification processor restricted to trusted role';
END
$checks$;

-- These are detection gates: they remain FAILING until the separate
-- DM media and presence policies have been independently remediated.
DO $checks$
BEGIN
 IF EXISTS (
   SELECT 1 FROM pg_policies
   WHERE schemaname='storage' AND tablename='objects'
     AND cmd IN ('SELECT','ALL')
     AND policyname='dm media read authenticated'
     AND qual ILIKE '%direct-message-media%'
 ) THEN
   RAISE EXCEPTION 'G0-02 FAIL: legacy broad authenticated voice-media read policy remains';
 END IF;
 RAISE NOTICE 'G0-02 metadata gate PASS; confirm conversation-level JWT tests';
END
$checks$;

DO $checks$
BEGIN
 IF EXISTS (
   SELECT 1 FROM pg_policies
   WHERE schemaname='public' AND tablename='community_presence'
    AND cmd IN ('SELECT','ALL') AND qual='true'
 ) THEN
   RAISE EXCEPTION 'G0-06 FAIL: community presence has an unrestricted SELECT policy';
 END IF;
 RAISE NOTICE 'G0-06 presence metadata gate PASS; confirm pending-user denial';
END
$checks$;

COMMIT;

-- REQUIRED HUMAN QA:
-- Compare real client requests with anon, pending, approved A, approved B,
-- suspended and Founder synthetic tokens. Metadata cannot prove all RLS
-- access paths are secure. Review storage signed URL expiry and prior links.
