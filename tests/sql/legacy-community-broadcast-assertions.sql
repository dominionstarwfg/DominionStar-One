-- Disposable PostgreSQL permission assertion; no notification or email sent.
DO $verify$
BEGIN
  IF to_regprocedure('public.queue_community_message_email(uuid)') IS NULL THEN
    RAISE EXCEPTION 'Legacy function removed rather than safely gated';
  END IF;
  IF has_function_privilege(
    'authenticated','public.queue_community_message_email(uuid)'::regprocedure,'EXECUTE'
  ) OR has_function_privilege(
    'anon','public.queue_community_message_email(uuid)'::regprocedure,'EXECUTE'
  ) THEN
    RAISE EXCEPTION 'Any ordinary browser role can still invoke mass Community emails';
  END IF;
  RAISE NOTICE 'LEGACY_COMMUNITY_BROADCAST_BROWSER_DENIED_PASS';
END;
$verify$;
