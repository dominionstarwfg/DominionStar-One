-- SECURITY CHANGE PROPOSAL, NOT APPROVED OR APPLIED.
-- This file must NEVER be executed by CI or a public build.
-- Obtain explicit production-change approval and validate every legitimate
-- caller uses SUPABASE_SERVICE_ROLE_KEY before applying.
--
-- Effect: remove anonymous / ordinary-user access to the SECURITY DEFINER
-- function that claims outbox rows; retain backend service_role access.
-- The existing Netlify process-email-outbox.mjs uses a service-role client.
--
-- No queue rows are changed by the ACL statements below.
BEGIN;

DO $preflight$
DECLARE
  fn_oid oid := to_regprocedure('public.claim_email_notification_batch(integer)');
BEGIN
  IF fn_oid IS NULL THEN
    RAISE EXCEPTION 'Expected email claim function missing; abort';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc
    WHERE oid=fn_oid AND prosecdef IS TRUE
  ) THEN
    RAISE EXCEPTION 'Expected SECURITY DEFINER semantics changed; re-audit';
  END IF;
  IF NOT has_function_privilege('service_role',fn_oid,'EXECUTE') THEN
    RAISE EXCEPTION 'Service role lacks pre-change EXECUTE; re-audit';
  END IF;
END;
$preflight$;

REVOKE EXECUTE ON FUNCTION public.claim_email_notification_batch(integer)
  FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.claim_email_notification_batch(integer)
  TO service_role;

DO $verify$
DECLARE
  fn_oid oid := to_regprocedure('public.claim_email_notification_batch(integer)');
BEGIN
  IF has_function_privilege('anon',fn_oid,'EXECUTE')
     OR has_function_privilege('authenticated',fn_oid,'EXECUTE')
     OR NOT has_function_privilege('service_role',fn_oid,'EXECUTE')
  THEN
    RAISE EXCEPTION 'Unexpected email outbox EXECUTE grants; transaction aborted';
  END IF;
END;
$verify$;

COMMIT;

-- After approval: run preflight again, verify false / false / true.
-- Then verify scheduled processing with a designated TEST queue item only,
-- and monitor email-delivery logs. Do not test by calling as anon:
-- before revocation, the function would mutate real queue rows.
--
-- Emergency recovery: inspect the saved pre-change ACL first and perform an
-- explicitly approved service recovery. Do NOT automatically re-grant anon
-- or authenticated permission to a privileged no-guard routine.
