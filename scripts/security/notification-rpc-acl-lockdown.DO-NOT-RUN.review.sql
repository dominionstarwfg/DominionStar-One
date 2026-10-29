-- PROPOSED SECURITY REMEDIATION — REVIEW ONLY, NOT APPLIED.
-- Requires explicit production authorization. This file is intentionally NOT
-- referenced by GitHub Actions or Netlify scripts.
--
-- Existing call path: public.queue_appointment_email(uuid) uses the
-- SECURITY DEFINER owner context to call queue_email_notification(...).
-- The Netlify email processor uses service_role for claim batch.
--
-- queue_community_email_notifications is deliberately excluded: its client
-- caller is assets/js/community-chat.js and requires a separate server-side
-- sender/content validation fix before restricting its member EXECUTE.
BEGIN;
DO $verify_pre$
DECLARE
  claim_oid oid:=to_regprocedure('public.claim_email_notification_batch(integer)');
  queue_oid oid:=to_regprocedure('public.queue_email_notification(uuid,text,text,text)');
BEGIN
  IF claim_oid IS NULL OR queue_oid IS NULL THEN
    RAISE EXCEPTION 'Expected function signature not found; abort';
  END IF;
  IF NOT (SELECT prosecdef FROM pg_proc WHERE oid=claim_oid)
     OR NOT (SELECT prosecdef FROM pg_proc WHERE oid=queue_oid) THEN
    RAISE EXCEPTION 'SECURITY DEFINER assumption changed; re-audit';
  END IF;
END;
$verify_pre$;

REVOKE EXECUTE ON FUNCTION public.claim_email_notification_batch(integer)
  FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.queue_email_notification(uuid,text,text,text)
  FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.claim_email_notification_batch(integer)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.queue_email_notification(uuid,text,text,text)
  TO service_role;

DO $verify_post$
DECLARE
  claim_oid oid:=to_regprocedure('public.claim_email_notification_batch(integer)');
  queue_oid oid:=to_regprocedure('public.queue_email_notification(uuid,text,text,text)');
BEGIN
  IF has_function_privilege('anon',claim_oid,'EXECUTE')
    OR has_function_privilege('authenticated',claim_oid,'EXECUTE')
    OR NOT has_function_privilege('service_role',claim_oid,'EXECUTE')
    OR has_function_privilege('anon',queue_oid,'EXECUTE')
    OR has_function_privilege('authenticated',queue_oid,'EXECUTE')
    OR NOT has_function_privilege('service_role',queue_oid,'EXECUTE')
  THEN
    RAISE EXCEPTION 'Privilege verification failed; transaction rolled back';
  END IF;
END;
$verify_post$;
COMMIT;

-- Post-deployment required: test the scheduled mail sender using a designated
-- test outbox entry and test appointment email generation by a legitimate agent.
-- Monitor the queue and revoke only after confirming no other external caller.
