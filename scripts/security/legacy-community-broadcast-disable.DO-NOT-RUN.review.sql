-- REVIEW ONLY — DO NOT RUN. Nonproduction staging candidate.
-- Agent OS Community Chat: retire the legacy RPC that allows an approved
-- member to fan out email for a routine chat message to every opted-in agent.
-- Routine chat stays in-app; source-proven Community mentions/replies use the
-- separate selected-priority event pipeline only after coordinated cutover.
-- NOT for Meet; no email is sent or existing queue item mutated by this SQL.
BEGIN;

DO $preflight$
BEGIN
  IF to_regprocedure('public.queue_community_message_email(uuid)') IS NULL THEN
    RAISE EXCEPTION 'Legacy Community Chat broadcast RPC missing; inspect schema drift';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc
    WHERE oid='public.queue_community_message_email(uuid)'::regprocedure
      AND prosecdef=true
  ) THEN
    RAISE EXCEPTION 'Legacy RPC metadata changed; refuse blind privilege update';
  END IF;
END;
$preflight$;

-- Browser agents must not enqueue arbitrary broad Community Chat emails by
-- calling a SECURITY DEFINER function, even with an old cached JS bundle.
-- Retain any existing backend-only service_role grant for explicit audit.
REVOKE EXECUTE ON FUNCTION public.queue_community_message_email(uuid)
  FROM PUBLIC, anon, authenticated;

DO $verify$
BEGIN
  IF has_function_privilege(
    'anon','public.queue_community_message_email(uuid)'::regprocedure,'EXECUTE'
  ) OR has_function_privilege(
    'authenticated','public.queue_community_message_email(uuid)'::regprocedure,'EXECUTE'
  ) THEN
    RAISE EXCEPTION 'Legacy Community Chat broadcast remains browser-executable';
  END IF;
END;
$verify$;
COMMIT;

-- Staging checks before production signoff:
-- 1. The current and cached Community Chat page cannot invoke the legacy RPC.
-- 2. Ordinary chat INSERT still works; no mass email is queued by chat send.
-- 3. Only a real saved Community mention/reply and opted-in verified recipient
--    may queue a selected email via the independent server-owned event path.
-- 4. Existing queued legacy emails require separate reconciliation, and
--    the disabled-by-default worker must not resume their delivery.
-- DO NOT deploy standalone, execute on production, or modify Meet.
