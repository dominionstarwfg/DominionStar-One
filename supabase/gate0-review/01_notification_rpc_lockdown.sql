-- DOMINIONSTAR / GATE 0 / PROPOSED STAGING MIGRATION
-- REVIEW ONLY: This file is deliberately outside supabase/migrations/.
-- Do NOT apply to production or staging until the dispatch caller has been
-- inventoried and confirmed to use service_role credentials server-side.
--
-- Risk: claim_email_notification_batch(integer) uses SECURITY DEFINER,
-- modifies outbox status, and RETURNS full email_notification_outbox rows.
-- Existing anon/authenticated execute grants must be removed.
-- This changes permissions only; existing rows are not modified by migration.

BEGIN;

DO $gate0$
BEGIN
  IF to_regprocedure('public.claim_email_notification_batch(integer)') IS NULL THEN
    RAISE EXCEPTION 'Missing notification batch function; stop Gate 0 migration';
  END IF;
END
$gate0$;

REVOKE EXECUTE ON FUNCTION public.claim_email_notification_batch(integer) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.claim_email_notification_batch(integer) FROM anon;
REVOKE EXECUTE ON FUNCTION public.claim_email_notification_batch(integer) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.claim_email_notification_batch(integer) TO service_role;

DO $gate0$
BEGIN
  IF has_function_privilege('anon','public.claim_email_notification_batch(integer)','EXECUTE')
     OR has_function_privilege('authenticated','public.claim_email_notification_batch(integer)','EXECUTE') THEN
    RAISE EXCEPTION 'Notification RPC still exposed to browser-accessible roles';
  END IF;
  IF NOT has_function_privilege('service_role','public.claim_email_notification_batch(integer)','EXECUTE') THEN
    RAISE EXCEPTION 'Trusted notification worker lost execute permission';
  END IF;
END
$gate0$;

COMMIT;

-- Post-migration smoke test in isolated staging:
--   Worker with service_role: can claim a deliberately seeded test notification.
--   Anonymous and approved agent tokens: cannot call function.
--   Test messages: delivered once, no accidental duplicate delivery.
--   Production outbox / member tables: unchanged until explicit release approval.
--
-- If the worker does not use service_role, STOP and adapt its credential
-- handling before this permission change. Never put service_role keys in JS.
